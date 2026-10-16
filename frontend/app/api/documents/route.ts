import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptDocumentNumber } from "@/lib/crypto";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const schema = z.object({
  doc_type: z.string().trim().min(2).max(40),
  doc_number: z.string().trim().min(4).max(80),
  expiry_date: z.string().optional(),
  issued_country: z.string().trim().max(60).optional(),
});

/**
 * Encrypts a document number server-side and stores only the ciphertext.
 *
 * The plaintext is used once, in this function, and never written to the
 * database, a log, or a response. `guest_documents` has no plaintext column,
 * which is deliberate.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid document." }, { status: 400 });
  }

  const encrypted = encryptDocumentNumber(parsed.data.doc_number);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("guest_documents")
    .insert({
      user_id: user.id,
      doc_type: parsed.data.doc_type,
      doc_number_enc: encrypted.doc_number_enc,
      iv: encrypted.iv,
      auth_tag: encrypted.auth_tag,
      expiry_date: parsed.data.expiry_date || null,
      issued_country: parsed.data.issued_country || null,
    })
    .select("id, doc_type, expiry_date, issued_country, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    actorId: user.id,
    action: "create_document",
    entity: "guest_documents",
    entityId: data.id,
    // Deliberately logs the type only, never the number.
    payload: { doc_type: parsed.data.doc_type },
  });

  return NextResponse.json({ document: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  // RLS already restricts deletion to the caller's own rows.
  const { error } = await supabase.from("guest_documents").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({ actorId: user.id, action: "delete_document", entity: "guest_documents", entityId: id });
  return NextResponse.json({ ok: true });
}