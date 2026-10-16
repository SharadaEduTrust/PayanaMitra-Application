"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Destination } from "@/lib/types";

const blank = { name: "", region: "", country: "India", description: "", image_url: "" };

export default function DestinationsAdmin({ destinations }: { destinations: Destination[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(destinations);
  const [draft, setDraft] = useState(blank);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("destinations")
      .insert({
        name: draft.name.trim(),
        region: draft.region || null,
        country: draft.country || null,
        description: draft.description || null,
        image_url: draft.image_url || null,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setRows((current) => [...current, data as Destination]);
    setDraft(blank);
    setStatus("Destination added.");
    router.refresh();
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("destinations").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRows((current) => current.filter((row) => row.id !== id));
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

          <button className="btn btn-primary" type="submit">
            Add destination
          </button>
        </form>
      </section>
    </>
  );
}