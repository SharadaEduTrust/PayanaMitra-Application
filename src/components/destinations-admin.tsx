"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Destination } from "@/lib/types";

const blank = { name: "", region: "", country: "India", description: "", image_url: "" };

export default function DestinationsAdmin({ destinations }: { destinations: Destination[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(destinations);
  const [draft, setDraft] = useState(blank);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit destination state
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [editForm, setEditForm] = useState(blank);
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  function startEdit(dest: Destination) {
    setEditingDestination(dest);
    setEditForm({
      name: dest.name,
      region: dest.region ?? "",
      country: dest.country ?? "India",
      description: dest.description ?? "",
      image_url: dest.image_url ?? "",
    });
    setEditError("");
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingDestination) return;
    setEditError("");
    setEditLoading(true);

    try {
      const res = await fetch(`/api/admin/destinations/${editingDestination.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          region: editForm.region?.trim() || null,
          country: editForm.country?.trim() || null,
          description: editForm.description?.trim() || null,
          image_url: editForm.image_url?.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      setEditLoading(false);

      if (!res.ok) {
        if (json?.fieldErrors) {
          const firstErr = Object.values(json.fieldErrors).flat()[0];
          setEditError(String(firstErr || json.error || "Failed to update destination."));
        } else {
          setEditError(json?.error ?? "Failed to update destination.");
        }
        return;
      }

      const updated = json.data as Destination;
      setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)));
      setEditingDestination(null);
      setStatus(`Destination "${updated.name}" updated successfully.`);
      router.refresh();
    } catch {
      setEditLoading(false);
      setEditError("Network error while updating destination.");
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          region: draft.region?.trim() || null,
          country: draft.country?.trim() || null,
          description: draft.description?.trim() || null,
          image_url: draft.image_url?.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      setLoading(false);

      if (!res.ok) {
        if (json?.fieldErrors) {
          const firstErr = Object.values(json.fieldErrors).flat()[0];
          setError(String(firstErr || json.error || "Failed to create destination."));
        } else {
          setError(json?.error ?? "Failed to create destination.");
        }
        return;
      }

      setRows((current) => [...current, json.data as Destination]);
      setDraft(blank);
      setStatus("Destination added.");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error while adding destination.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Are you sure you want to delete this destination?")) return;
    setError("");
    setStatus("");

    try {
      const res = await fetch(`/api/admin/destinations/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Failed to delete destination.");
        return;
      }

      setRows((current) => current.filter((row) => row.id !== id));
      setStatus("Destination removed.");
    } catch {
      setError("Network error while deleting destination.");
    }
  }

  return (
    <>
      <section className="admin-card">
        <h2 className="serif">Catalogue</h2>
        {rows.length === 0 ? (
          <p className="panel-note">No destinations yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Region</th>
                <th>Country</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    {row.description && <div className="muted small">{row.description.slice(0, 80)}</div>}
                  </td>
                  <td>{row.region ?? "—"}</td>
                  <td>{row.country ?? "—"}</td>
                  <td className="row-actions">
                    <button type="button" className="link-btn" onClick={() => startEdit(row)}>
                      Edit
                    </button>
                    <button type="button" className="link-btn" onClick={() => remove(row.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-card">
        <h2 className="serif">Add destination</h2>
        <form onSubmit={create}>
          <div className="field-row">
            <label className="form-field">
              Name
              <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="form-field">
              Region
              <input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} placeholder="Karnataka" />
            </label>
          </div>

          <div className="field-row">
            <label className="form-field">
              Country
              <input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} />
            </label>
            <label className="form-field">
              Image URL
              <input value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://…" />
            </label>
          </div>

          <label className="form-field">
            Description
            <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          {status && <p className="form-notice" role="status">{status}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Adding…" : "Add destination"}
          </button>
        </form>
      </section>

      {/* Edit Destination Modal */}
      {editingDestination && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <form className="admin-card" onSubmit={saveEdit} style={{ maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="admin-card-head">
              <h2 className="serif">Edit {editingDestination.name}</h2>
              <button type="button" className="link-btn" onClick={() => setEditingDestination(null)}>✕ Cancel</button>
            </div>

            <div className="field-row">
              <label className="form-field">
                Name
                <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </label>
              <label className="form-field">
                Region
                <input value={editForm.region} onChange={(e) => setEditForm({ ...editForm, region: e.target.value })} placeholder="Karnataka" />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Country
                <input value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
              </label>
              <label className="form-field">
                Image URL
                <input value={editForm.image_url} onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })} placeholder="https://…" />
              </label>
            </div>

            <label className="form-field">
              Description
              <textarea rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </label>

            {editError && <p className="form-error" role="alert">{editError}</p>}

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button className="btn btn-primary" type="submit" disabled={editLoading}>
                {editLoading ? "Saving…" : "Save changes"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setEditingDestination(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}