import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/server/crypto";
import DocumentForm from "@/components/document-form";
import SavedDocumentsList from "@/components/saved-documents-list";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const profile = await requireProfile();
  const admin = createAdminClient();

  let hasChangedPassword = false;
  try {
    const { data: authUserData } = await admin.auth.admin.getUserById(profile.id);
    hasChangedPassword = Boolean(authUserData?.user?.user_metadata?.password_changed);
  } catch {
    hasChangedPassword = false;
  }

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

      {/* Document Privacy Notice */}
      {hasChangedPassword ? (
        <div
          style={{
            background: "#f4fbf6",
            border: "1px solid #ccebd7",
            borderLeft: "4px solid #2e7d32",
            borderRadius: "12px",
            padding: "14px 20px",
            marginBottom: "24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div style={{ flex: "1 1 320px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.1rem" }}>✅</span>
              <strong style={{ color: "#1e5e22", fontSize: "0.92rem" }}>
                Protected with Custom Password
              </strong>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "0.86rem", color: "#3d6645", lineHeight: "1.45" }}>
              Your identity documents (PAN, Aadhar, Passport) are safeguarded with your private password and cannot be accessed using the default mobile number suffix.
            </p>
          </div>
          <Link
            href="/change-password?from=documents"
            className="btn btn-secondary"
            style={{
              whiteSpace: "nowrap",
              padding: "6px 14px",
              fontSize: "0.84rem",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Update Password
          </Link>
        </div>
      ) : (
        <div
          style={{
            background: "#fff9f2",
            border: "1px solid #e3d5c4",
            borderLeft: "4px solid #b85d19",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div style={{ flex: "1 1 320px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "1.2rem" }}>🔒</span>
              <strong style={{ color: "#934228", fontSize: "0.98rem" }}>
                Protect Your Important Documents (PAN, Aadhar, Passport)
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink, #4a3b2a)", lineHeight: "1.45" }}>
              Your account currently uses the default password (last 4 digits of your phone number). Because other guests on your trail may know your mobile number, please <strong>create a new private password</strong> to ensure your confidential documents (PAN, Aadhar, Passport) cannot be viewed by others.
            </p>
          </div>
          <Link
            href="/change-password?from=documents"
            className="btn btn-primary"
            style={{
              whiteSpace: "nowrap",
              padding: "8px 18px",
              fontSize: "0.88rem",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Create New Password &rarr;
          </Link>
        </div>
      )}

      <div className={profile.role === "admin" ? "trip-columns" : ""} style={{ maxWidth: profile.role === "admin" ? undefined : "800px" }}>
        {profile.role === "admin" && (
          <section className="panel">
            <h2 className="serif">Add a Document</h2>
            <p className="panel-note">Aadhar, PAN, Passport, or any other document your trail needs.</p>
            <DocumentForm existingDocTypes={docs.map((d) => d.doc_type)} />
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