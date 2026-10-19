"use client";

import { useState } from "react";

type Contact = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
};

const blank = { name: "", role: "", phone: "", email: "" };

export default function TripContactsEditor({
  tripId,
  contacts,
}: {
  tripId: string;
  contacts: Contact[];
}) {
  const [rows, setRows] = useState<Contact[]>(contacts);
  const [draft, setDraft] = useState(blank);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function addContact() {
    if (!draft.name.trim()) {
      setError("A contact needs a name.");
      return;
    }
    setError("");
    setStatus("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/trips/${tripId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          role: draft.role?.trim() || "Guide",
          custom_role: ["Guide", "Hotel Manager", "Transport Provider"].includes(draft.role?.trim()) ? null : draft.role?.trim(),
          phone: draft.phone?.trim() || null,
          email: draft.email?.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      setLoading(false);

      if (!res.ok) {
        if (json?.fieldErrors) {
          const firstErr = Object.values(json.fieldErrors).flat()[0];
          setError(String(firstErr || json.error || "Failed to add contact."));
        } else {
          setError(json?.error ?? "Failed to add contact.");
        }
        return;
      }

      setRows((current) => [
        ...current,
        {
          id: json.data.id,
          name: json.data.name,
          role: json.data.role ?? draft.role,
          phone: json.data.phone ?? draft.phone,
          email: json.data.email ?? draft.email,
        },
      ]);
      setDraft(blank);
      setStatus("Contact added.");
    } catch {
      setLoading(false);
      setError("Network error while adding contact.");
    }
  }

  async function removeContact(id: string) {
    setError("");
    setStatus("");

    try {
      const res = await fetch(`/api/admin/trips/${tripId}/contacts/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Failed to delete contact.");
        return;
      }

      setRows((current) => current.filter((row) => row.id !== id));
      setStatus("Contact removed.");
    } catch {
      setError("Network error while deleting contact.");
    }
  }

  return (
    <section className="admin-card">
      <h2 className="serif">Contacts</h2>
      <p className="admin-hint">Local guides, hotel managers and transport operators for this trip.</p>

      {rows.length === 0 ? (
        <p className="panel-note">No contacts yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Phone</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.role || "—"}</td>
                <td className="mono">{row.phone || "—"}</td>
                <td className="row-actions">
                  <button type="button" className="link-btn" onClick={() => removeContact(row.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="admin-subhead">
        <span>Add a contact</span>
      </div>

      <div className="field-row">
        <label className="form-field">
          Name
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <label className="form-field">
          Role
          <input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Local Guide" />
        </label>
      </div>

      <div className="field-row">
        <label className="form-field">
          Phone
          <input type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        </label>
        <label className="form-field">
          Email
          <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}

      <button type="button" className="btn btn-primary" onClick={addContact} disabled={loading || !draft.name.trim()}>
        {loading ? "Adding…" : "Add contact"}
      </button>
    </section>
  );
}