"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { DOCUMENT_TYPES, formatDocType, areDocTypesEqual } from "@/lib/documents";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB limit

interface DocumentFormProps {
  existingDocTypes?: string[];
}

export default function DocumentForm({ existingDocTypes = [] }: DocumentFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pick the first document type that hasn't already been uploaded
  const defaultType =
    DOCUMENT_TYPES.find((item) => !existingDocTypes.some((t) => areDocTypesEqual(t, item.value)))?.value ??
    "aadhar";

  const [docType, setDocType] = useState(defaultType);
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [issuedPlace, setIssuedPlace] = useState("");
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isDuplicateType = existingDocTypes.some((t) => areDocTypesEqual(t, docType));


  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setFileNotice(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setError(`Selected file "${file.name}" is ${sizeMb} MB, which exceeds the 1MB limit. Please upload a document smaller than 1MB.`);
      setFileNotice(null);
      event.target.value = "";
      return;
    }

    setError("");
    const sizeKb = (file.size / 1024).toFixed(1);
    setFileNotice(`Selected: ${file.name} (${sizeKb} KB)`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    if (isDuplicateType) {
      setError(
        `A ${formatDocType(docType)} document is already saved for your account. You cannot upload another ${formatDocType(docType)} unless the earlier document is deleted.`
      );
      return;
    }

    const file = form.get("file") as File | null;
    if (file && file.size > 0 && file.size > MAX_FILE_SIZE) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 1MB limit. Please select a smaller file.`);
      return;
    }

    setLoading(true);
    form.set("doc_type", docType);
    if (issuedDate) form.set("issued_date", issuedDate);
    if (expiryDate) form.set("expiry_date", expiryDate);
    if (issuedPlace) {
      form.set("issued_country", issuedPlace);
      form.set("issued_place", issuedPlace);
    }

    let response: Response;
    try {
      response = await fetch("/api/documents", {
        method: "POST",
        body: form,
      });
    } catch (err) {
      setLoading(false);
      console.error("Failed to save document:", err);
      setError("Network error while saving document.");
      return;
    }

    setLoading(false);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error ?? "Could not save that document.");
      return;
    }

    formElement.reset();
    setStatus("Document saved and securely encrypted.");
    const nextAvailable =
      DOCUMENT_TYPES.find(
        (item) => !existingDocTypes.some((t) => areDocTypesEqual(t, item.value)) && !areDocTypesEqual(docType, item.value)
      )?.value ?? "aadhar";
    setDocType(nextAvailable);
    setIssuedDate("");
    setExpiryDate("");
    setIssuedPlace("");
    setFileNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <label className="form-field">
        Document Type
        <select value={docType} onChange={(event) => setDocType(event.target.value)}>
          {DOCUMENT_TYPES.map((item) => {
            const alreadyUploaded = existingDocTypes.some((t) => areDocTypesEqual(t, item.value));
            return (
              <option key={item.value} value={item.value}>
                {item.label} {alreadyUploaded ? "— Already uploaded (delete to replace)" : ""}
              </option>
            );
          })}
        </select>
        {isDuplicateType && (
          <div
            style={{
              marginTop: "8px",
              padding: "10px 14px",
              backgroundColor: "#fff7ed",
              border: "1px solid #fdba74",
              borderRadius: "6px",
              color: "#9a3412",
              fontSize: "13px",
              lineHeight: "1.4",
            }}
          >
            ⚠️ A <strong>{formatDocType(docType)}</strong> document is already saved for your account. You cannot upload another {formatDocType(docType)} unless the earlier document is deleted from the Saved Documents list.
          </div>
        )}
      </label>

      <label className="form-field">
        Document Number
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
        Attachment (Optional PDF or Image, Max 1MB)
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
        />
        <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "block" }}>
          Maximum file size is 1MB (PDF, JPEG, PNG, or WebP).
        </span>
        {fileNotice && (
          <span style={{ fontSize: "12.5px", color: "#166534", fontWeight: 600, marginTop: "4px", display: "block" }}>
            ✓ {fileNotice}
          </span>
        )}
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}

      <button
        className="btn btn-primary"
        type="submit"
        disabled={loading || isDuplicateType}
        style={{
          opacity: isDuplicateType ? 0.6 : 1,
          cursor: isDuplicateType ? "not-allowed" : "pointer",
        }}
      >
        {loading
          ? "Encrypting & Uploading…"
          : isDuplicateType
          ? `${formatDocType(docType)} Already Uploaded`
          : "Save Document"}
      </button>
    </form>
  );
}