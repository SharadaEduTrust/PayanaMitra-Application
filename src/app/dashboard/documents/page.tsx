import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/crypto";
import DocumentForm from "@/components/document-form";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const profile = await requireProfile();
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from("guest_documents") as any)
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  // Decrypt numbers and generate signed URLs for attached files
  const docs = await Promise.all(
    (data ?? []).map(async (doc: Record<string, unknown>) => {
      let doc_number: string | null = null;
      if (doc.doc_number_enc && doc.iv && doc.auth_tag) {
        try {
          doc_number = await decrypt({
            ciphertext: doc.doc_number_enc as string,
            iv: doc.iv as string,
            authTag: doc.auth_tag as string,
          });
        } catch {
          doc_number = null;
        }
      }

      let download_url: string | null = null;
      if (doc.storage_path) {
        try {
          const { data: signed } = await admin.storage
            .from("guest-documents")
            .createSignedUrl(doc.storage_path as string, 3600);
          download_url = signed?.signedUrl ?? null;
        } catch {
          download_url = null;
        }
      }

      return {
        id: doc.id as string,
        doc_type: (doc.doc_type as string) || "document",
        doc_number,
        expiry_date: doc.expiry_date as string | null,
        issued_country: doc.issued_country as string | null,
        file_name: doc.file_name as string | null,
        download_url,
        created_at: doc.created_at as string,
      };
    }),
  );

  return (
    <div className="trip-detail">
      <header className="page-head">
        <div>
          <div className="eyebrow">My documents</div>
          <h1 className="serif">Identity & travel documents</h1>
          <p>
            Document numbers are encrypted with AES-256-GCM before they are stored. Only you,
            your assigned trail leader, and administrators can access them.
          </p>
        </div>
      </header>

      <div className="trip-columns">
        <section className="panel">
          <h2 className="serif">Add a document</h2>
          <p className="panel-note">PAN, passport, visa, or any other document your trail needs.</p>
          <DocumentForm />
        </section>

        <section className="panel">
          <h2 className="serif">Saved documents</h2>
          {docs.length === 0 ? (
            <p className="panel-note">Nothing saved yet.</p>
          ) : (
            <div className="contact-list">
              {docs.map((doc) => (
                <div key={doc.id} style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px 0", borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.08))" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="contact-label">{doc.doc_type.replace("_", " ").toUpperCase()}</span>
                    {doc.download_url && (
                      <a
                        href={doc.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-btn"
                        style={{ fontSize: "12px" }}
                      >
                        Download {doc.file_name ? doc.file_name : "file"} ↗
                      </a>
                    )}
                  </div>
                  <span className="contact-name mono">
                    {doc.doc_number ? (
                      <>
                        <span style={{ letterSpacing: "2px", opacity: 0.6 }}>•••• •••• </span>
                        <span>{doc.doc_number.slice(-4)}</span>
                        <span className="muted small" style={{ marginLeft: "8px", fontWeight: "normal" }}>
                          ({doc.doc_number})
                        </span>
                      </>
                    ) : (
                      "Document on file"
                    )}
                  </span>
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