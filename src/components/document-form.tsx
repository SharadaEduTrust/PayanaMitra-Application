"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DOCUMENT_TYPES } from "@/lib/documents";

export default function DocumentForm() {
  const router = useRouter();
  const [docType, setDocType] = useState("aadhar");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [issuedPlace, setIssuedPlace] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    form.set("doc_type", docType);
    if (issuedDate) form.set("issued_date", issuedDate);
    if (expiryDate) form.set("expiry_date", expiryDate);
    if (issuedPlace) {
      form.set("issued_country", issuedPlace);
      form.set("issued_place", issuedPlace);
    }

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: form,
      });

      const data = await response.json().catch(() => null);
      setLoading(false);

      if (!response.ok) {
        setError(data?.error ?? "Could not save that document.");
        return;
      }

      event.currentTarget.reset();
      setStatus("Document saved and securely encrypted.");
      setIssuedDate("");
      setExpiryDate("");
      setIssuedPlace("");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error while saving document.");
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="form-field">
        Document Type <span className="req">*</span>
        <select value={docType} onChange={(event) => setDocType(event.target.value)}>
          {DOCUMENT_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        Document Number <span className="req">*</span>
        <input
          name="doc_number"
          required
          minLength={4}
          autoComplete="off"
          placeholder="Encrypted before saving"
        />
      </label>

      <div className="field-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        <label className="form-field">
          Issued Date
          <input
            type="date"
            value={issuedDate}
            onChange={(event) => setIssuedDate(event.target.value)}
          />
        </label>
        <label className="form-field">
          Expiry Date
          <input
            type="date"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
          />
        </label>
        <label className="form-field">
          Issued at (Place)
          <input
            value={issuedPlace}
            placeholder="e.g. Bangalore"
            onChange={(event) => setIssuedPlace(event.target.value)}
          />
        </label>
      </div>

      <label className="form-field">
        Attachment (PDF or Image, Max 10MB)
        <input type="file" name="file" accept=".pdf,image/jpeg,image/png,image/webp" />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Encrypting & Uploading…" : "Save Document"}
      </button>
    </form>
  );
}