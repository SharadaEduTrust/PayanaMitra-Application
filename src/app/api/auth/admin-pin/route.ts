import { NextResponse } from "next/server";
import { verifyPinLogin } from "@/lib/pin-login";

export const runtime = "nodejs";

/**
 * Administrator sign-in: phone number plus the last four digits of that phone number,
 * restricted to role = 'admin'.
 */
export async function POST(request: Request) {
  const result = await verifyPinLogin(request, { requireRole: "admin" });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    tokenHash: result.tokenHash,
    firstName: result.firstName,
    role: "admin",
    session: result.session,
  });
}
