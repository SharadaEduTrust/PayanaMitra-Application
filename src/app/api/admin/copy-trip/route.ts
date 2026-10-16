import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const schema = z.object({
  sourceTripId: z.string().uuid(),
  newTripCode: z.string().trim().min(3).max(60),
  newName: z.string().trim().min(3).max(120),
});

/**
 * Calls the `copy_trip()` function from migration 004, which duplicates a trip
 * with its itinerary days and activities but no members. The function itself
 * enforces `is_admin()`, so this route only needs to prove the caller is a
 * signed-in admin.
 */
export async function POST(request: Request) {
  await requireProfile(["admin"]);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid copy request." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_trip", {
    source_trip_id: parsed.data.sourceTripId,
    new_trip_code: parsed.data.newTripCode,
    new_name: parsed.data.newName,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await audit({
    action: "copy_trip",
    entity: "trips",
    entityId: data as string,
    payload: { sourceTripId: parsed.data.sourceTripId, newTripCode: parsed.data.newTripCode },
  });

  return NextResponse.json({ tripId: data }, { status: 201 });
}