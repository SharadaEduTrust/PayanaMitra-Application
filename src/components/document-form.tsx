"use client";

import { useState, type FormEvent } from "react";

const docTypes = ["pan", "passport", "visa", "aadhaar", "driving_licence", "other"];

export default function DocumentForm() {
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
    const docNumber = String(form.get("doc_number") || "");

    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doc_type: docType,
        doc_number: docNumber,
        expiry_date: expiry || undefined,
        issued_country: country || undefined,
      }),
    });

    // Clear the field from component state immediately after submit.
    event.currentTarget.reset();
    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not save that document.");
      return;
    }
    setStatus("Saved and encrypted. The number cannot be displayed again.");
    setExpiry("");
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

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Encrypting…" : "Save document"}
      </button>
    </form>
  );
}