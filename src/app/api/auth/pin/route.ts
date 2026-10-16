import { NextResponse } from "next/server";
import { verifyPinLogin } from "@/lib/pin-login";

export const runtime = "nodejs";

/**
 * Traveller sign-in: phone number plus the last four digits of that number.
 * Any role may use this route; the dashboard is what enforces the traveller view.
 */
export async function POST(request: Request) {
  const result = await verifyPinLogin(request);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ tokenHash: result.tokenHash, firstName: result.firstName });
}
