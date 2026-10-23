import "server-only";
import { z } from "zod";
import { loginWithPhonePin } from "@/lib/server/auth";

export const runtime = "nodejs";

const schema = z
  .object({
    phone: z.string().trim().min(8).max(20),
    password: z.string().optional(),
    pin: z.string().optional(),
  })
  .refine((data) => (data.password?.trim().length ?? 0) >= 4 || (data.pin?.trim().length ?? 0) >= 4, {
    message: "Enter your password (at least 4 characters).",
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
      error: "Enter a valid phone number and password.",
      status: 400,
    };
  }

  const password = (parsed.data.password || parsed.data.pin || "").trim();

  const result = await loginWithPhonePin(
    parsed.data.phone,
    password,
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
