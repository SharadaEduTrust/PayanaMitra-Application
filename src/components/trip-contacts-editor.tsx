"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

  async function addContact() {
    if (!draft.name.trim()) {
      setError("A contact needs a name.");
      return;
    }
    setError("");
    setStatus("");

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("trip_contacts")
      .insert({
        trip_id: tripId,
        name: draft.name.trim(),
        role: draft.role || null,
        phone: draft.phone || null,
        email: draft.email || null,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setRows((current) => [...current, { ...(data as Contact), role: draft.role, phone: draft.phone, email: draft.email }]);
    setDraft(blank);
    setStatus("Contact added.");
  }

  async function removeContact(id: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("trip_contacts").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRows((current) => current.filter((row) => row.id !== id));
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

      <button type="button" className="btn btn-primary" onClick={addContact}>
        Add contact
      </button>
    </section>
  );
}