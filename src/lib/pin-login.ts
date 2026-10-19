import "server-only";
import { z } from "zod";
import { loginWithPhonePin } from "@/lib/server/auth";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().trim().min(8).max(20),
  pin: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits of your phone number."),
});

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1";
}

export type PinLoginResult =
  | {
      ok: true;
      tokenHash: string | null;
      firstName: string | null;
      role: string;
      session?: { access_token: string; refresh_token: string } | null;
    }
  | { ok: false; error: string; status: number };

/**
 * Unified verification bridge that delegates to the authoritative loginWithPhonePin implementation.
 */
export async function verifyPinLogin(
  request: Request,
  options: { requireRole?: "admin" | "leader" | "traveller" } = {},
): Promise<PinLoginResult> {
  const ip = clientIp(request);
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter a valid phone number and 4-digit PIN.",
      status: 400,
    };
  }

  const result = await loginWithPhonePin(
    parsed.data.phone,
    parsed.data.pin,
    ip,
    options,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: result.status,
    };
  }

  return {
    ok: true,
    tokenHash: result.tokenHash ?? null,
    firstName: result.profile.first_name,
    role: result.profile.role,
    session: result.session,
  };
}
