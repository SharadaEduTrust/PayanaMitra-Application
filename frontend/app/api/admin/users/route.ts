import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/login-guard";

export const runtime = "nodejs";

const createSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z.string().trim().min(8).max(20),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["traveller", "leader", "admin"]).default("traveller"),
  dateOfJoining: z.string().optional(),
  location: z.string().trim().max(120).optional(),
  remarks: z.string().trim().max(500).optional(),
  mustChangePassword: z.boolean().default(true),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
  first_name: z.string().trim().min(1).max(60).optional(),
  last_name: z.string().trim().min(1).max(60).optional(),
  role: z.enum(["traveller", "leader", "admin"]).optional(),
  remarks: z.string().trim().max(500).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

function normalisePhone(raw: string) {
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (!hasPlus) {
    digits = digits.replace(/^0+/, "");
    if (digits.startsWith("91") && (digits.length === 11 || digits.length === 12)) digits = digits.slice(2);
    return digits.length === 10 ? `+91${digits}` : null;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  const admin = await requireProfile(["admin"]);

  if (!checkRateLimit(`admin-create:${clientIp(request)}`).allowed) {
    return NextResponse.json({ error: "Too many accounts created. Try again shortly." }, { status: 429 });
  }

  // Reset password path
  const resetPayload = await request.json().catch(() => null);
  const resetParsed = updateSchema.safeParse(resetPayload);
  if (resetPayload && resetParsed.success && resetParsed.data.newPassword) {
    const { id, newPassword } = resetParsed.data;
    const supabase = createAdminClient();
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });

    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });

    const target = list.users.find((user) => user.id === id);
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const { error: updateError } = await supabase.auth.admin.updateUserById(id, { password: newPassword });
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    await supabase
      .from("profiles")
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    await audit({
      actorId: admin.id,
      action: "reset_password",
      entity: "profiles",
      entityId: id,
      ip: clientIp(request),
    });

    return NextResponse.json({ ok: true });
  }

  // Create path
  const parsed = createSchema.safeParse(resetPayload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details." }, { status: 400 });
  }

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit phone number." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "That phone number already belongs to an account." }, { status: 409 });
  }

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
  });

  if (authError || !created.user) {
    return NextResponse.json({ error: authError?.message ?? "Could not create the sign-in." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: created.user.id,
      phone,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      role: parsed.data.role,
      is_active: true,
      must_change_password: parsed.data.mustChangePassword,
      date_of_joining: parsed.data.dateOfJoining || null,
      location: parsed.data.location || null,
      remarks: parsed.data.remarks || null,
    })
    .select()
    .single();

  if (profileError) {
    // Do not leave an orphaned auth user with a live password.
    await supabase.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await audit({
    actorId: admin.id,
    action: "create_user",
    entity: "profiles",
    entityId: profile.id,
    payload: { phone, role: parsed.data.role },
    ip: clientIp(request),
  });

  return NextResponse.json({ user: profile }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireProfile(["admin"]);
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const { id, newPassword, ...fields } = parsed.data;
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot modify your own administrator account here." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.is_active !== undefined) update.is_active = fields.is_active;
  if (fields.first_name !== undefined) update.first_name = fields.first_name;
  if (fields.last_name !== undefined) update.last_name = fields.last_name;
  if (fields.role !== undefined) update.role = fields.role;
  if (fields.remarks !== undefined) update.remarks = fields.remarks || null;

  const { data, error } = await supabase.from("profiles").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (newPassword) {
    const { error: authError } = await supabase.auth.admin.updateUserById(id, { password: newPassword });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
    await supabase.from("profiles").update({ must_change_password: true }).eq("id", id);
  }

  // Suspending must also end any live sessions.
  if (fields.is_active === false) {
    await supabase.auth.admin.signOut(id);
  }

  await audit({
    actorId: admin.id,
    action: fields.is_active === false ? "suspend_user" : "update_user",
    entity: "profiles",
    entityId: id,
    payload: newPassword ? { password_reset: true } : fields,
  });

  return NextResponse.json({ user: data });
}