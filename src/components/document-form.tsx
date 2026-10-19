"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const docTypes = ["pan", "passport", "visa", "aadhaar", "driving_licence", "other"];

export default function DocumentForm() {
  const router = useRouter();
  const [docType, setDocType] = useState("pan");
  const [expiry, setExpiry] = useState("");
  const [country, setCountry] = useState("India");
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
    if (expiry) form.set("expiry_date", expiry);
    if (country) form.set("issued_country", country);

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
      setExpiry("");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error while saving document.");
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="form-field">
        Document type
        <select value={docType} onChange={(event) => setDocType(event.target.value)}>
          {docTypes.map((type) => (
            <option key={type} value={type}>
              {type.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        Document number
        <input
          name="doc_number"
          required
          minLength={4}
          autoComplete="off"
          placeholder="Encrypted before saving"
        />
      </label>

      <div className="field-row">
        <label className="form-field">
          Expiry date
          <input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
        </label>
        <label className="form-field">
          Issuing country
          <input value={country} onChange={(event) => setCountry(event.target.value)} />
        </label>
      </div>

      <label className="form-field">
        Attachment (Optional PDF or Image, max 10MB)
        <input type="file" name="file" accept=".pdf,image/jpeg,image/png,image/webp" />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Encrypting & Uploading…" : "Save document"}
      </button>
    </form>
  );
}