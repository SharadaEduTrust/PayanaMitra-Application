import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { GuestDocument } from "@/lib/types";
import DocumentForm from "@/components/document-form";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("guest_documents")
    .select("id, doc_type, expiry_date, issued_country, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="trip-detail">
      <header className="page-head">
        <div>
          <div className="eyebrow">My documents</div>
          <h1 className="serif">Identity & travel documents</h1>
          <p>
            Document numbers are encrypted with AES-256-GCM before they are stored. Only you and
            administrators can ever read them, and they are never shown again after saving.
          </p>
        </div>
      </header>

      <div className="trip-columns">
        <section className="panel">
          <h2 className="serif">Add a document</h2>
          <p className="panel-note">PAN, passport, visa, or any other document your trip needs.</p>
          <DocumentForm />
        </section>

        <section className="panel">
          <h2 className="serif">Saved documents</h2>
          {(!data || data.length === 0) ? (
            <p className="panel-note">Nothing saved yet.</p>
          ) : (
            <div className="contact-list">
              {(data as Pick<GuestDocument, "id" | "doc_type" | "expiry_date" | "issued_country" | "created_at">[]).map((doc) => (
                <div key={doc.id}>
                  <span className="contact-label">{doc.doc_type.toUpperCase()}</span>
                  <span className="contact-name">Number hidden</span>
                  <span className="muted small">
                    {doc.issued_country ?? "Country not recorded"}
                    {doc.expiry_date ? ` · expires ${new Date(doc.expiry_date).toLocaleDateString("en-IN")}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}