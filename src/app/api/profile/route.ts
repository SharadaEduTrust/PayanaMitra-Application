import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().trim().min(8).max(20),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  location: z.string().trim().max(120).optional(),
  dateOfJoining: z.string().optional(),
});

function normalisePhone(raw: string) {
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (!hasPlus) {
    digits = digits.replace(/^0+/, "");
    if (digits.startsWith("91") && (digits.length === 11 || digits.length === 12)) {
      digits = digits.slice(2);
    }
    return digits.length === 10 ? `+91${digits}` : null;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * Creates the `profiles` row for a freshly signed-up auth user.
 *
 * The migrations grant insert on profiles only to admins, so this has to run
 * with the service role. It is safe to call from the client after signup: the
 * caller must already hold a valid Supabase session, and the phone uniqueness
 * check prevents anyone enrolling a second account with someone else's number
 * without their consent.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details." }, { status: 400 });
  }

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "That phone number is already registered. Try signing in instead." },
      { status: 409 },
    );
  }

  const { data: alreadyOnboarded } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (alreadyOnboarded) {
    return NextResponse.json({ ok: true, alreadyOnboarded: true });
  }

  const { data, error } = await admin
    .from("profiles")
    .insert({
      id: user.id,
      phone,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: user.email ?? null,
      role: "traveller",
      is_active: true,
      must_change_password: false,
      location: parsed.data.location ?? null,
      date_of_joining: parsed.data.dateOfJoining ?? null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique violation, which is a duplicate phone race.
    if (error.code === "23505") {
      return NextResponse.json({ error: "That phone number is already registered." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await audit({
    actorId: user.id,
    action: "self_register",
    entity: "profiles",
    entityId: data.id,
    payload: { phone },
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true, profile: data }, { status: 201 });
}