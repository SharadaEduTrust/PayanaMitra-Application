import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/server/crypto";

export const runtime = "nodejs";

const optionalDate = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : val),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").nullable().optional()
);

const schema = z.object({
  dob: optionalDate,
  pan: z.string().trim().max(10).optional().nullable(),
  aadhar: z.string().trim().max(20).optional().nullable(),
  passport_no: z.string().trim().max(10).optional().nullable(),
  passport_issue_date: optionalDate,
  passport_expiry: optionalDate,
  passport_issued_location: z.string().trim().max(50, "Max 50 characters").optional().nullable(),
  visa_no: z.string().trim().max(10).optional().nullable(),
  visa_expiry: optionalDate,
  visa_country: z.string().trim().max(50, "Max 50 characters").optional().nullable(),
  travel_insurance_no: z.string().trim().max(50, "Max 50 characters").optional().nullable(),
  insurance_company: z.string().trim().max(50, "Max 50 characters").optional().nullable(),
  insurance_expiry: optionalDate,
  food_preference: z.enum(["veg", "non_veg"]).optional().nullable(),
  food_allergy: z.string().trim().max(30, "Max 30 characters").optional().nullable(),
  emergency_contact_name: z.string().trim().max(20, "Max 20 characters").optional().nullable(),
  emergency_contact_no: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Emergency contact number must be 10-15 digits").nullable().optional()
  ),
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
    passport_issue_date: emptyToNull(parsed.data.passport_issue_date),
    visa_no: emptyToNull(parsed.data.visa_no),
    visa_expiry: emptyToNull(parsed.data.visa_expiry),
    visa_country: emptyToNull(parsed.data.visa_country),
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
  const docWarnings: string[] = [];
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
        const { error: panUpdErr } = await (admin.from("guest_documents") as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          updated_at: new Date().toISOString(),
        }).eq("id", existingPan.id);
        if (panUpdErr) { console.error("Failed to save PAN:", panUpdErr.message); docWarnings.push("PAN") }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: panInsErr } = await (admin.from("guest_documents") as any).insert({
          user_id: user.id,
          doc_type: "pan",
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
        });
        if (panInsErr) { console.error("Failed to save PAN:", panInsErr.message); docWarnings.push("PAN") }
      }
    } catch (panErr) {
      console.error("Failed to encrypt PAN:", panErr);
      docWarnings.push("PAN");
    }
  }

  // Handle Aadhar in guest_documents
  const aadhar = emptyToNull(parsed.data.aadhar);
  if (aadhar) {
    try {
      const enc = await encrypt(aadhar);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingAadhar } = await (admin.from("guest_documents") as any)
        .select("id")
        .eq("user_id", user.id)
        .in("doc_type", ["aadhar", "aadhaar"])
        .maybeSingle();

      if (existingAadhar) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: aadharUpdErr } = await (admin.from("guest_documents") as any).update({
          doc_type: "aadhar",
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          updated_at: new Date().toISOString(),
        }).eq("id", existingAadhar.id);
        if (aadharUpdErr) { console.error("Failed to save Aadhar:", aadharUpdErr.message); docWarnings.push("Aadhar") }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: aadharInsErr } = await (admin.from("guest_documents") as any).insert({
          user_id: user.id,
          doc_type: "aadhar",
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
        });
        if (aadharInsErr) { console.error("Failed to save Aadhar:", aadharInsErr.message); docWarnings.push("Aadhar") }
      }
    } catch (aadharErr) {
      console.error("Failed to encrypt Aadhar:", aadharErr);
      docWarnings.push("Aadhar");
    }
  }

  // Handle Passport in guest_documents
  const passportNo = emptyToNull(parsed.data.passport_no);
  const passportIssueDate = emptyToNull(parsed.data.passport_issue_date);
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
        const { error: passUpdErr } = await (admin.from("guest_documents") as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          issued_date: passportIssueDate,
          expiry_date: passportExpiry,
          issued_country: passportLocation,
          updated_at: new Date().toISOString(),
        }).eq("id", existingPassport.id);
        if (passUpdErr) { console.error("Failed to save Passport:", passUpdErr.message); docWarnings.push("Passport") }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: passInsErr } = await (admin.from("guest_documents") as any).insert({
          user_id: user.id,
          doc_type: "passport",
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          issued_date: passportIssueDate,
          expiry_date: passportExpiry,
          issued_country: passportLocation,
        });
        if (passInsErr) { console.error("Failed to save Passport:", passInsErr.message); docWarnings.push("Passport") }
      }
    } catch (passErr) {
      console.error("Failed to encrypt Passport:", passErr);
      docWarnings.push("Passport");
    }
  }

  // Handle Visa in guest_documents
  const visaNo = emptyToNull(parsed.data.visa_no);
  const visaExpiry = emptyToNull(parsed.data.visa_expiry);
  const visaCountry = emptyToNull(parsed.data.visa_country);

  if (visaNo) {
    try {
      const enc = await encrypt(visaNo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingVisa } = await (admin.from("guest_documents") as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("doc_type", "visa")
        .maybeSingle();

      if (existingVisa) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: visaUpdErr } = await (admin.from("guest_documents") as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: visaExpiry,
          issued_country: visaCountry,
          updated_at: new Date().toISOString(),
        }).eq("id", existingVisa.id);
        if (visaUpdErr) { console.error("Failed to save Visa:", visaUpdErr.message); docWarnings.push("Visa") }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: visaInsErr } = await (admin.from("guest_documents") as any).insert({
          user_id: user.id,
          doc_type: "visa",
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: visaExpiry,
          issued_country: visaCountry,
        });
        if (visaInsErr) { console.error("Failed to save Visa:", visaInsErr.message); docWarnings.push("Visa") }
      }
    } catch (visaErr) {
      console.error("Failed to encrypt Visa:", visaErr);
      docWarnings.push("Visa");
    }
  }

  if (docWarnings.length > 0) {
    return NextResponse.json({
      ok: true,
      saved: true,
      warnings: docWarnings,
      message: `Details saved, but the following documents could not be stored: ${docWarnings.join(", ")}`,
    });
  }

  return NextResponse.json({ ok: true, saved: true });
}