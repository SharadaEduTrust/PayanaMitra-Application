import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { derivePassword, loginWithPhonePin, normalisePhone, phoneCandidates, phoneToEmail } from "@/lib/server/auth";

export const runtime = "nodejs";

const SignupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  phone: z.string().trim().min(8, "Valid phone number is required").max(20),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
});

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid sign up details.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { firstName, lastName, phone: rawPhone, email, location } = parsed.data;
  const canonicalPhone = normalisePhone(rawPhone) ?? rawPhone.trim().replace(/\s+/g, "");

  if (canonicalPhone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check if phone number is already registered across formatting variants
  const candidates = phoneCandidates(canonicalPhone);
  if (!candidates.includes(canonicalPhone)) candidates.push(canonicalPhone);

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .in("phone", candidates)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "That phone number is already registered. Try signing in instead." },
      { status: 409 },
    );
  }

  // System allocates initial password as the last 4 digits of the phone number
  const initialPassword = canonicalPhone.slice(-4);
  const emailAuth = phoneToEmail(canonicalPhone);
  const derivedInitialPassword = await derivePassword(canonicalPhone, initialPassword);

  // 1. Create auth user in Supabase
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: emailAuth,
    password: derivedInitialPassword,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    return NextResponse.json(
      { error: authErr?.message ?? "Failed to create user credentials." },
      { status: 500 },
    );
  }

  // 2. Insert profile record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileErr } = await (admin.from("profiles") as any).insert({
    id: authData.user.id,
    phone: canonicalPhone,
    first_name: firstName,
    last_name: lastName,
    email: email || null,
    location: location || null,
    role: "traveller",
    is_active: true,
    must_change_password: false,
    date_of_joining: new Date().toISOString().slice(0, 10),
  });

  if (profileErr) {
    // Rollback auth user
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json(
      { error: profileErr.message ?? "Failed to initialize profile." },
      { status: 500 },
    );
  }

  // 3. Log the user in to establish session
  const ip = clientIp(req);
  const loginRes = await loginWithPhonePin(canonicalPhone, initialPassword, ip);

  if (!loginRes.ok) {
    return NextResponse.json({
      ok: true,
      message: "Account created successfully. Please sign in with your phone and the last 4 digits.",
      role: "traveller",
    });
  }

  return NextResponse.json({
    ok: true,
    session: loginRes.session,
    tokenHash: loginRes.tokenHash,
    role: loginRes.profile.role,
    firstName: loginRes.profile.first_name,
  });
}
