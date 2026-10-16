import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  dob: z.string().optional(),
  food_preference: z.enum(["veg", "non_veg"]).optional().nullable(),
  food_allergy: z.string().trim().max(200).optional(),
  emergency_contact_name: z.string().trim().max(120).optional(),
  emergency_contact_no: z.string().trim().max(20).optional(),
  travel_insurance_no: z.string().trim().max(80).optional(),
  insurance_company: z.string().trim().max(120).optional(),
  insurance_expiry: z.string().optional(),
});

const emptyToNull = (value?: string) => (value && value.length > 0 ? value : null);

/**
 * Create-or-update for the caller's own traveller_details row.
 *
 * The migrations grant travellers SELECT and UPDATE but not INSERT, so the
 * first save needs the service role to create the row.
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

  const values = {
    dob: emptyToNull(parsed.data.dob),
    food_preference: parsed.data.food_preference || null,
    food_allergy: emptyToNull(parsed.data.food_allergy),
    emergency_contact_name: emptyToNull(parsed.data.emergency_contact_name),
    emergency_contact_no: emptyToNull(parsed.data.emergency_contact_no),
    travel_insurance_no: emptyToNull(parsed.data.travel_insurance_no),
    insurance_company: emptyToNull(parsed.data.insurance_company),
    insurance_expiry: emptyToNull(parsed.data.insurance_expiry),
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("traveller_details")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await admin.from("traveller_details").update(values).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: true });
  }

  const { error } = await admin
    .from("traveller_details")
    .insert({ ...values, user_id: user.id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: true }, { status: 201 });
}