import { NextResponse } from "next/server";
import { verifyPinLogin } from "@/lib/pin-login";

export const runtime = "nodejs";

/**
 * Administrator sign-in: the same phone number plus PIN the backend uses for
 * every account, but restricted to `role = 'admin'`.
 *
 * A traveller number gets the same response as an unknown number, so this route
 * cannot be used to discover which numbers are registered as admins.
 */
export async function POST(request: Request) {
  const result = await verifyPinLogin(request, { requireRole: "admin" });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ tokenHash: result.tokenHash, firstName: result.firstName });
}
