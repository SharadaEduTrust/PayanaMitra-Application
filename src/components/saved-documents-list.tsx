"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENT_TYPES, formatDocType } from "@/lib/documents";

export type SavedDoc = {
  id: string;
  doc_type: string;
  doc_number: string | null;
  issued_date?: string | null;
  expiry_date: string | null;
  issued_country: string | null;
  file_name: string | null;
  download_url: string | null;
  created_at: string;
};

export default function SavedDocumentsList({
  initialDocs,
}: {
  initialDocs: SavedDoc[];
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<SavedDoc[]>(initialDocs);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Edit document state
  const [editingDoc, setEditingDoc] = useState<SavedDoc | null>(null);
  const [editForm, setEditForm] = useState({
    doc_type: "aadhar",
    issued_date: "",
    expiry_date: "",
    issued_country: "",
  });
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  function startEdit(doc: SavedDoc) {
    setEditingDoc(doc);
    const normalizedType = (doc.doc_type || "aadhar").toLowerCase();
    const mappedType = normalizedType === "aadhaar" ? "aadhar" : normalizedType;
    setEditForm({
      doc_type: mappedType,
      issued_date: doc.issued_date ? doc.issued_date.slice(0, 10) : "",
      expiry_date: doc.expiry_date ? doc.expiry_date.slice(0, 10) : "",
      issued_country: doc.issued_country || "",
    });
    setEditError("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDoc) return;
    setEditError("");
    setEditLoading(true);

    try {
      const res = await fetch(`/api/documents/${editingDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: editForm.doc_type,
          issued_date: editForm.issued_date || null,
          expiry_date: editForm.expiry_date || null,
          issued_country: editForm.issued_country?.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      setEditLoading(false);

      if (!res.ok) {
        if (json?.fieldErrors) {
          const firstErr = Object.values(json.fieldErrors).flat()[0];
          setEditError(String(firstErr || json.error || "Failed to update document."));
        } else {
          setEditError(json?.error ?? "Failed to update document.");
        }
        return;
      }

      setDocs((current) =>
        current.map((d) =>
          d.id === editingDoc.id
            ? {
                ...d,
                doc_type: editForm.doc_type,
                issued_date: editForm.issued_date || null,
                expiry_date: editForm.expiry_date || null,
                issued_country: editForm.issued_country?.trim() || null,
              }
            : d,
        ),
      );
      setEditingDoc(null);
      setStatus("Document details updated.");
      router.refresh();
    } catch {
      setEditLoading(false);
      setEditError("Network error while updating document.");
    }
  }

  async function removeDoc(id: string) {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    setError("");
    setStatus("");

    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Failed to delete document.");
        return;
      }

      setDocs((current) => current.filter((d) => d.id !== id));
      setStatus("Document deleted.");
      router.refresh();
    } catch {
      setError("Network error while deleting document.");
    }
  }

  if (docs.length === 0) {
    return <p className="panel-note">Nothing saved yet.</p>;
  }

  return (
    <>
      {status && <p className="form-notice" role="status" style={{ marginBottom: "12px" }}>{status}</p>}
      {error && <p className="form-error" role="alert" style={{ marginBottom: "12px" }}>{error}</p>}

      <div className="contact-list">
        {docs.map((doc) => (
          <div
            key={doc.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "12px 0",
              borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.08))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <span
                className="contact-label"
                style={{
                  textTransform: "none",
                  letterSpacing: "0.02em",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--forest)",
                  background: "var(--soft, #f7f3ee)",
                  padding: "3px 9px",
                  border: "1px solid var(--line, #e3d5c4)",
                }}
              >
                {formatDocType(doc.doc_type)}
              </span>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {doc.download_url && (
                  <a
                    href={doc.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-btn"
                    style={{ fontSize: "12px" }}
                  >
                    Download {doc.file_name ? doc.file_name : "File"} ↗
                  </a>
                )}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => startEdit(doc)}
                  style={{ fontSize: "12px" }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => removeDoc(doc.id)}
                  style={{ fontSize: "12px" }}
                >
                  Delete
                </button>
              </div>
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

            {(() => {
              const details: string[] = [];
              if (doc.issued_date) {
                try {
                  details.push(`Issued: ${new Date(doc.issued_date).toLocaleDateString("en-IN")}`);
                } catch {
                  details.push(`Issued: ${doc.issued_date}`);
                }
              }
              if (doc.expiry_date) {
                try {
                  details.push(`Expires: ${new Date(doc.expiry_date).toLocaleDateString("en-IN")}`);
                } catch {
                  details.push(`Expires: ${doc.expiry_date}`);
                }
              }
              if (doc.issued_country) {
                details.push(`Issued at: ${doc.issued_country}`);
              }
              if (details.length === 0) return null;
              return <span className="muted small">{details.join(" · ")}</span>;
            })()}
          </div>
        ))}
      </div>

      {/* Edit Document Modal */}
      {editingDoc && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <form className="admin-card" onSubmit={saveEdit} style={{ maxWidth: "480px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="admin-card-head">
              <h2 className="serif">Edit {formatDocType(editingDoc.doc_type)}</h2>
              <button type="button" className="link-btn" onClick={() => setEditingDoc(null)}>✕ Cancel</button>
            </div>

            <label className="form-field">
              Document Type
              <select
                value={editForm.doc_type}
                onChange={(e) => setEditForm({ ...editForm, doc_type: e.target.value })}
              >
                {DOCUMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              <label className="form-field">
                Issued Date
                <input
                  type="date"
                  value={editForm.issued_date}
                  onChange={(e) => setEditForm({ ...editForm, issued_date: e.target.value })}
                />
              </label>
              <label className="form-field">
                Expiry Date
                <input
                  type="date"
                  value={editForm.expiry_date}
                  onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                />
              </label>
              <label className="form-field">
                Issued at (Place)
                <input
                  value={editForm.issued_country}
                  placeholder="e.g. Bangalore"
                  onChange={(e) => setEditForm({ ...editForm, issued_country: e.target.value })}
                />
              </label>
            </div>

            {editError && <p className="form-error" role="alert">{editError}</p>}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button className="btn btn-primary" type="submit" disabled={editLoading}>
                {editLoading ? "Saving…" : "Save Changes"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setEditingDoc(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
