import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalisePhone, phoneCandidates, pinMatches } from "@/lib/pin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Attempts allowed before the phone number is locked out temporarily.
 * Attempts are recorded in `login_attempts` (migration 002), which is
 * RLS-locked to the service role, so the count survives a redeploy.
 */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const WINDOW_MINUTES = 15;

const schema = z.object({
  phone: z.string().trim().min(8).max(20),
  pin: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits of your phone number."),
});

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

type PinLoginResult =
  | { ok: true; tokenHash: string; firstName: string | null }
  | { ok: false; error: string; status: number };

/**
 * Verifies a phone number and PIN, then hands the browser a one-time token that
 * it exchanges for a real Supabase session.
 *
 * The PIN is never sent to the database and never trusted from the client: the
 * expected value is recomputed here from the stored phone number.
 *
 * `requireRole` narrows which accounts may complete the login. A traveller phone
 * number submitted to the admin route is rejected with the same message as an
 * unknown number, so the response cannot be used to enumerate accounts.
 */
export async function verifyPinLogin(
  request: Request,
  options: { requireRole?: "admin" | "traveller" } = {},
): Promise<PinLoginResult> {
  const ip = clientIp(request);
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter a 10-digit phone number and a 4-digit PIN.",
      status: 400,
    };
  }

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) {
    return { ok: false, error: "Enter a valid 10-digit phone number.", status: 400 };
  }

  const supabase = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: attempts } = await supabase
    .from("login_attempts")
    .select("id, succeeded")
    .eq("phone", phone)
    .gte("attempted_at", since);

  const failures = (attempts ?? []).filter((attempt) => !attempt.succeeded).length;

  if (failures >= MAX_ATTEMPTS) {
    await audit({ action: "pin_locked_out", entity: "profiles", payload: { phone, failures }, ip });
    return {
      ok: false,
      error: `Too many incorrect PINs. Try again in ${LOCKOUT_MINUTES} minutes.`,
      status: 429,
    };
  }

  const forms = phoneCandidates(parsed.data.phone);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone, email, first_name, is_active, role")
    .in("phone", forms)
    .limit(1)
    .maybeSingle();

  // One message for every failure so the response cannot be used to discover
  // which phone numbers are registered.
  const invalid = (): PinLoginResult => ({
    ok: false,
    error: "That phone number and PIN do not match an account.",
    status: 401,
  });

  const recordFailure = () => supabase.from("login_attempts").insert({ phone, ip, succeeded: false });

  if (!profile) {
    await recordFailure();
    return invalid();
  }

  if (!profile.is_active) {
    await recordFailure();
    await audit({ actorId: profile.id, action: "pin_login_blocked_inactive", entity: "profiles", ip });
    return {
      ok: false,
      error: "This account is suspended. Contact your trip coordinator.",
      status: 403,
    };
  }

  // Role is checked before the PIN comparison so a traveller number cannot be
  // probed for a valid PIN on the admin route.
  if (options.requireRole && profile.role !== options.requireRole) {
    await recordFailure();
    await audit({
      actorId: profile.id,
      action: "pin_login_wrong_role",
      entity: "profiles",
      payload: { required: options.requireRole, actual: profile.role },
      ip,
    });
    return invalid();
  }

  if (!profile.phone || !pinMatches(profile.phone, parsed.data.pin)) {
    await recordFailure();
    await audit({ actorId: profile.id, action: "pin_login_failed", entity: "profiles", ip });
    return invalid();
  }

  // The sign-in address comes from the auth user as a fallback: seeded rows
  // can leave profiles.email empty while the auth user still has one.
  const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
  const email = profile.email || authUser?.user?.email || null;

  if (!email) {
    await recordFailure();
    return {
      ok: false,
      error: "This account has no email on file. Contact your coordinator.",
      status: 400,
    };
  }

  // Trade the verified identity for a single-use sign-in token. The browser
  // exchanges this for a genuine Supabase session, so every later request is
  // authorised by RLS exactly as it would be for a password login.
  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !link?.properties?.hashed_token) {
    return {
      ok: false,
      error: "Sign-in is unavailable right now. Please try again shortly.",
      status: 503,
    };
  }

  await supabase.from("login_attempts").insert({ phone, ip, succeeded: true });
  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", profile.id);
  await audit({
    actorId: profile.id,
    action: options.requireRole === "admin" ? "admin_pin_login_success" : "pin_login_success",
    entity: "profiles",
    ip,
  });

  return { ok: true, tokenHash: link.properties.hashed_token, firstName: profile.first_name };
}
