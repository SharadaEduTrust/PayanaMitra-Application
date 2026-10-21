import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/server/crypto";

export const runtime = "nodejs";

const schema = z.object({
  dob: z.string().optional().nullable(),
  pan: z.string().trim().max(10).optional().nullable(),
  passport_no: z.string().trim().max(10).optional().nullable(),
  passport_expiry: z.string().optional().nullable(),
  passport_issued_location: z.string().trim().max(120).optional().nullable(),
  travel_insurance_no: z.string().trim().max(80).optional().nullable(),
  insurance_company: z.string().trim().max(120).optional().nullable(),
  insurance_expiry: z.string().optional().nullable(),
  food_preference: z.enum(["veg", "non_veg"]).optional().nullable(),
  food_allergy: z.string().trim().max(200).optional().nullable(),
  emergency_contact_name: z.string().trim().max(120).optional().nullable(),
  emergency_contact_no: z.string().trim().max(20).optional().nullable(),
});

const emptyToNull = (value?: string | null) => (value && value.trim().length > 0 ? value.trim() : null);

/**
 * Create-or-update for the caller's own traveller_details and linked documents.
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
    passport_issued_location: emptyToNull(parsed.data.passport_issued_location),
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
  } else {
    const { error } = await admin
      .from("traveller_details")
      .insert({ ...values, user_id: user.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Handle PAN in guest_documents
  const pan = emptyToNull(parsed.data.pan);
  if (pan) {
    try {
      const enc = await encrypt(pan);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingPan } = await (admin.from("guest_documents") as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("doc_type", "pan")
        .maybeSingle();

      if (existingPan) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from("guest_documents") as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          updated_at: new Date().toISOString(),
        }).eq("id", existingPan.id);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from("guest_documents") as any).insert({
          user_id: user.id,
          doc_type: "pan",
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
        });
      }
    } catch (panErr) {
      console.error("Failed to encrypt PAN:", panErr);
    }
  }

  // Handle Passport in guest_documents
  const passportNo = emptyToNull(parsed.data.passport_no);
  const passportExpiry = emptyToNull(parsed.data.passport_expiry);
  const passportLocation = emptyToNull(parsed.data.passport_issued_location) || "India";

  if (passportNo) {
    try {
      const enc = await encrypt(passportNo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingPassport } = await (admin.from("guest_documents") as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("doc_type", "passport")
        .maybeSingle();

      if (existingPassport) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from("guest_documents") as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: passportExpiry,
          issued_country: passportLocation,
          updated_at: new Date().toISOString(),
        }).eq("id", existingPassport.id);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from("guest_documents") as any).insert({
          user_id: user.id,
          doc_type: "passport",
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: passportExpiry,
          issued_country: passportLocation,
        });
      }
    } catch (passErr) {
      console.error("Failed to encrypt Passport:", passErr);
    }
  }

  return NextResponse.json({ ok: true, saved: true });
}