"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TrailLeaderView, TripStatus } from "@/lib/types";

const statusPill: Record<string, string> = {
  draft: "off",
  published: "on",
  archived: "off",
};

export default function TripListAdmin({ trips }: { trips: TrailLeaderView[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(trips);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pageSize = 15;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((trip) => {
      const matchesSearch =
        !term ||
        trip.trip_name.toLowerCase().includes(term) ||
        trip.trip_code.toLowerCase().includes(term) ||
        `${trip.leader_first_name ?? ""} ${trip.leader_last_name ?? ""}`.toLowerCase().includes(term);

      const matchesStatus = statusFilter === "all" || trip.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  async function updateStatus(tripId: string, newStatus: TripStatus) {
    setError("");
    setNotice("");
    setLoadingTripId(tripId);

    try {
      const res = await fetch(`/api/admin/trips/${tripId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json().catch(() => null);
      setLoadingTripId(null);

      if (!res.ok) {
        setError(json?.error ?? "Failed to update trail status.");
        return;
      }

      setRows((current) =>
        current.map((t) => (t.trip_id === tripId ? { ...t, status: newStatus } : t)),
      );
      setNotice(`Trail status set to ${newStatus}.`);
      router.refresh();
    } catch {
      setLoadingTripId(null);
      setError("Network error while updating trail status.");
    }
  }

  async function duplicate(trip: TrailLeaderView) {
    const newCode = window.prompt("New trail code (must be unique):", `${trip.trip_code}-COPY`);
    if (!newCode || !newCode.trim()) return;
    const newName = window.prompt("New trail name:", trip.trip_name);
    if (!newName || !newName.trim()) return;

    setError("");
    setNotice("");
    setLoadingTripId(trip.trip_id);

    try {
      const res = await fetch(`/api/admin/trips/${trip.trip_id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_trip_code: newCode.trim(),
          new_name: newName.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      setLoadingTripId(null);

      if (!res.ok) {
        if (data?.fieldErrors) {
          const firstErr = Object.values(data.fieldErrors).flat()[0];
          setError(String(firstErr || data?.error || "Could not duplicate the trail."));
        } else {
          setError(data?.error ?? "Could not duplicate the trail.");
        }
        return;
      }

      const newTripId = data.data?.id;
      if (newTripId) {
        router.push(`/admin/trips/${newTripId}`);
      } else {
        router.refresh();
      }
    } catch {
      setLoadingTripId(null);
      setError("Network error while duplicating trail.");
    }
  }

  if (trips.length === 0) {
    return (
      <div className="panel-empty">
        <h2 className="serif">No trails yet</h2>
        <p>Create your first trail, add days and activities, then publish it to your members.</p>
        <Link className="btn btn-primary" href="/admin/trips/new">
          Create a trail
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-card">
      <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
        <h2 className="serif">All Trails ({filtered.length})</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="admin-search"
            placeholder="Search code, name, leader…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{ padding: "6px 12px", borderRadius: "6px" }}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {error && <p className="form-error" role="alert" style={{ marginBottom: "12px" }}>{error}</p>}
      {notice && <p className="form-notice" role="status" style={{ marginBottom: "12px" }}>{notice}</p>}

      {filtered.length === 0 ? (
        <p className="panel-note">No trails match that filter.</p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Trail Name</th>
                <th>Dates</th>
                <th>Leader</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((trip) => {
                const isLoading = loadingTripId === trip.trip_id;
                return (
                  <tr key={trip.trip_id}>
                    <td className="mono">{trip.trip_code}</td>
                    <td>
                      <strong>{trip.trip_name}</strong>
                    </td>
                    <td>
                      {trip.start_date ? new Date(trip.start_date).toLocaleDateString("en-IN") : "—"}
                      {trip.end_date ? ` – ${new Date(trip.end_date).toLocaleDateString("en-IN")}` : ""}
                    </td>
                    <td>
                      {trip.leader_first_name
                        ? `${trip.leader_first_name} ${trip.leader_last_name}`
                        : "Unassigned"}
                    </td>
                    <td>
                      <span className={`pill ${statusPill[trip.status] ?? "off"}`}>
                        {trip.status}
                      </span>
                    </td>
                    <td className="row-actions">
                      <Link className="link-btn" href={`/admin/trips/${trip.trip_id}`}>
                        Edit
                      </Link>
                      <Link className="link-btn" href={`/dashboard/trips/${trip.trip_id}`}>
                        Preview
                      </Link>
                      <button
                        type="button"
                        className="link-btn"
                        disabled={isLoading}
                        onClick={() => duplicate(trip)}
                      >
                        Copy
                      </button>
                      {trip.status === "draft" && (
                        <button
                          type="button"
                          className="link-btn"
                          disabled={isLoading}
                          onClick={() => updateStatus(trip.trip_id, "published")}
                        >
                          Publish
                        </button>
                      )}
                      {trip.status === "published" && (
                        <button
                          type="button"
                          className="link-btn"
                          disabled={isLoading}
                          onClick={() => updateStatus(trip.trip_id, "archived")}
                        >
                          Archive
                        </button>
                      )}
                      {trip.status === "archived" && (
                        <button
                          type="button"
                          className="link-btn"
                          disabled={isLoading}
                          onClick={() => updateStatus(trip.trip_id, "draft")}
                        >
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </button>
              <span className="muted small">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}