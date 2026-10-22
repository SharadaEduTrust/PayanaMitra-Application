import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/crypto";
import DocumentForm from "@/components/document-form";
import SavedDocumentsList from "@/components/saved-documents-list";

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
        issued_date: (doc.issued_date as string | null) ?? null,
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
          <div className="eyebrow">My Documents</div>
          <h1 className="serif">Identity & Travel Documents</h1>
          <p>
            Document numbers are encrypted with AES-256-GCM before they are stored. Only you,
            your assigned trail leader, and administrators can access them.
          </p>
        </div>
      </header>

      <div className={profile.role === "admin" ? "trip-columns" : ""} style={{ maxWidth: profile.role === "admin" ? undefined : "800px" }}>
        {profile.role === "admin" && (
          <section className="panel">
            <h2 className="serif">Add a Document</h2>
            <p className="panel-note">Aadhar, PAN, Passport, or any other document your trail needs.</p>
            <DocumentForm />
          </section>
        )}

        <section className="panel">
          <h2 className="serif">Saved Documents</h2>
          <p className="panel-note">
            {profile.role === "admin"
              ? "All documents uploaded for your account."
              : "Identity and travel documents uploaded and verified by your trail coordinator."}
          </p>
          <SavedDocumentsList initialDocs={docs} isReadOnly={profile.role !== "admin"} />
        </section>
      </div>
    </div>
  );
}