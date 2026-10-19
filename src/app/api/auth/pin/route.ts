import { NextResponse } from "next/server";
import { verifyPinLogin } from "@/lib/pin-login";

export const runtime = "nodejs";

/**
 * Traveller sign-in: phone number plus the last four digits of that phone number.
 */
export async function POST(request: Request) {
  const result = await verifyPinLogin(request);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    tokenHash: result.tokenHash,
    firstName: result.firstName,
    role: result.role,
    session: result.session,
  });
}
