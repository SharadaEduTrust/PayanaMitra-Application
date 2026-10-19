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
                    <button className="link-btn" onClick={() => remove(row.id)}>
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
    </>
  );
}