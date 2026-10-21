"use client";

import { useState } from "react";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

const blank = {
  name: "",
  role: "Guide",
  custom_role: "",
  phone: "",
  email: "",
};

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

  // Edit contact state
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState(blank);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  function startEdit(contact: Contact) {
    const isStandard = ["Guide", "Hotel Manager", "Transport Provider"].includes(contact.role ?? "");
    setEditingContact(contact);
    setEditForm({
      name: contact.name,
      role: isStandard ? (contact.role ?? "Guide") : "Others",
      custom_role: isStandard ? "" : (contact.role ?? ""),
      phone: contact.phone ?? "",
      email: contact.email ?? "",
    });
    setEditError("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingContact) return;
    if (!editForm.name.trim()) {
      setEditError("A contact needs a name.");
      return;
    }
    if (editForm.role === "Others" && !editForm.custom_role.trim()) {
      setEditError("Please specify the actual role when 'Others' is selected.");
      return;
    }
    setEditError("");
    setEditLoading(true);

    try {
      const cleanPhone = editForm.phone ? editForm.phone.trim().replace(/[\s-]/g, "") : null;
      const finalRole = editForm.role === "Others" ? editForm.custom_role.trim() : editForm.role;

      const res = await fetch(`/api/admin/trips/${tripId}/contacts/${editingContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          role: editForm.role,
          custom_role: editForm.role === "Others" ? editForm.custom_role.trim() : null,
          phone: cleanPhone || null,
          email: editForm.email.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      setEditLoading(false);

      if (!res.ok) {
        if (json?.fieldErrors) {
          const firstErr = Object.values(json.fieldErrors).flat()[0];
          setEditError(String(firstErr || json.error || "Failed to update contact."));
        } else {
          setEditError(json?.error ?? "Failed to update contact.");
        }
        return;
      }

      setRows((current) =>
        current.map((c) =>
          c.id === editingContact.id
            ? {
                ...c,
                name: json.data.name,
                role: json.data.role ?? finalRole,
                phone: json.data.phone ?? cleanPhone ?? "",
                email: json.data.email ?? editForm.email.trim() ?? "",
              }
            : c,
        ),
      );
      setEditingContact(null);
      setStatus("Contact updated.");
    } catch {
      setEditLoading(false);
      setEditError("Network error while updating contact.");
    }
  }

  async function addContact() {
    if (!draft.name.trim()) {
      setError("A contact needs a name.");
      return;
    }
    if (draft.role === "Others" && !draft.custom_role.trim()) {
      setError("Please specify the actual role when 'Others' is selected.");
      return;
    }
    setError("");
    setStatus("");
    setLoading(true);

    try {
      const cleanPhone = draft.phone ? draft.phone.trim().replace(/[\s-]/g, "") : null;
      const finalRole = draft.role === "Others" ? draft.custom_role.trim() : draft.role;

      const res = await fetch(`/api/admin/trips/${tripId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          role: draft.role,
          custom_role: draft.role === "Others" ? draft.custom_role.trim() : null,
          phone: cleanPhone || null,
          email: draft.email.trim() || null,
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
          role: json.data.role ?? finalRole,
          phone: json.data.phone ?? cleanPhone ?? "",
          email: json.data.email ?? draft.email.trim() ?? "",
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
    if (!window.confirm("Are you sure you want to remove this contact?")) return;
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
      <p className="admin-hint">Local guides, hotel managers and transport operators for this trail.</p>

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
                  <button type="button" className="link-btn" onClick={() => startEdit(row)}>
                    Edit
                  </button>
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
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Full name"
          />
        </label>
        <label className="form-field">
          Role
          <select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          >
            <option value="Guide">Guide</option>
            <option value="Hotel Manager">Hotel Manager</option>
            <option value="Transport Provider">Transport Provider</option>
            <option value="Others">Others</option>
          </select>
        </label>
      </div>

      {draft.role === "Others" && (
        <label className="form-field" style={{ marginTop: "12px" }}>
          Actual Role
          <input
            required
            value={draft.custom_role}
            onChange={(e) => setDraft({ ...draft, custom_role: e.target.value })}
            placeholder="e.g. Driver, Photographer, Trek Lead"
          />
        </label>
      )}

      <div className="field-row">
        <label className="form-field">
          Phone
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            placeholder="+91 98765 43210"
          />
        </label>
        <label className="form-field">
          Email
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="contact@example.com"
          />
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}

      <button
        type="button"
        className="btn btn-primary"
        onClick={addContact}
        disabled={loading || !draft.name.trim() || (draft.role === "Others" && !draft.custom_role.trim())}
      >
        {loading ? "Adding…" : "Add contact"}
      </button>

      {/* Edit Contact Modal */}
      {editingContact && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <form className="admin-card" onSubmit={saveEdit} style={{ maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="admin-card-head">
              <h2 className="serif">Edit {editingContact.name}</h2>
              <button type="button" className="link-btn" onClick={() => setEditingContact(null)}>✕ Cancel</button>
            </div>

            <div className="field-row">
              <label className="form-field">
                Name
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </label>
              <label className="form-field">
                Role
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="Guide">Guide</option>
                  <option value="Hotel Manager">Hotel Manager</option>
                  <option value="Transport Provider">Transport Provider</option>
                  <option value="Others">Others</option>
                </select>
              </label>
            </div>

            {editForm.role === "Others" && (
              <label className="form-field" style={{ marginTop: "12px" }}>
                Actual Role
                <input
                  required
                  value={editForm.custom_role}
                  onChange={(e) => setEditForm({ ...editForm, custom_role: e.target.value })}
                  placeholder="e.g. Driver, Photographer, Trek Lead"
                />
              </label>
            )}

            <div className="field-row">
              <label className="form-field">
                Phone
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </label>
              <label className="form-field">
                Email
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </label>
            </div>

            {editError && <p className="form-error" role="alert">{editError}</p>}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={editLoading || !editForm.name.trim() || (editForm.role === "Others" && !editForm.custom_role.trim())}
              >
                {editLoading ? "Saving…" : "Save changes"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setEditingContact(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}