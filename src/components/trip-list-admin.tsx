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

  // CSV import state
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{
    created: number;
    skipped: number;
    errorCount: number;
    results?: Array<{ row: number; trip_code: string; status: string; error?: string }>;
  } | null>(null);

  const pageSize = 15;

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportReport(null);
    setError("");
    setNotice("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/trips/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setImporting(false);

      if (!res.ok) {
        setError(json?.error ?? "Failed to import trails CSV.");
        return;
      }

      setImportReport(json);
      setNotice(`Trails CSV import complete: ${json.created} created, ${json.skipped} skipped.`);
      router.refresh();
    } catch {
      setImporting(false);
      setError("Network error while importing trails CSV.");
    }
  }

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
        <p>Create your first trail, add days and activities, or import multiple trails via CSV.</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginTop: "14px" }}>
          <Link className="btn btn-primary" href="/admin/trips/new">
            Create a trail
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowImport(!showImport)}
          >
            {showImport ? "Close Import" : "Import Trails (CSV)"}
          </button>
        </div>
        {showImport && (
          <div style={{ margin: "20px auto 0", maxWidth: "600px", textAlign: "left", padding: "18px", background: "var(--color-surface, #1e293b)", borderRadius: "8px", border: "1px dashed var(--color-border, #334155)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
              <h3 className="serif" style={{ margin: 0, fontSize: "1.15rem" }}>Bulk Import Trails (CSV)</h3>
              <a
                href="/api/admin/trips/import"
                download="trails_import_template.csv"
                className="link-btn"
                style={{ fontWeight: 600 }}
              >
                Download CSV Template
              </a>
            </div>
            <p className="admin-hint" style={{ margin: "4px 0 12px" }}>
              Upload a UTF-8 CSV with columns: <code>Trail Id</code> (e.g. HIHGOK01), <code>Trail Name</code>, <code>Destination</code>, <code>Start Date</code>, <code>End Date</code>, <code>Leader User Id</code> (phone number), <code>Active / Inactive</code>, <code>Remarks</code>.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={importing}
            />
            {importing && <p className="muted small" style={{ marginTop: "8px" }}>Processing trail import batch…</p>}
            {error && <p className="form-error" role="alert" style={{ marginTop: "10px" }}>{error}</p>}
            {notice && <p className="form-notice" role="status" style={{ marginTop: "10px" }}>{notice}</p>}
            {importReport && (
              <div style={{ marginTop: "14px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "6px" }}>
                <strong>Import Results:</strong> Created: {importReport.created} · Skipped (duplicates): {importReport.skipped}
                {importReport.errorCount > 0 && importReport.results && (
                  <div style={{ marginTop: "8px", color: "var(--color-danger, #ef4444)" }}>
                    <strong>Errors ({importReport.errorCount}):</strong>
                    {importReport.results
                      .filter((r) => r.status === "error")
                      .map((err, i) => (
                        <div key={i} className="small">
                          Row {err.row} ({err.trip_code || "Unknown"}): {err.error}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowImport(!showImport)}
          >
            {showImport ? "Close CSV Import" : "Import Trails (CSV)"}
          </button>
        </div>
      </div>

      {showImport && (
        <div style={{ margin: "16px 0", padding: "18px", background: "var(--color-surface, #1e293b)", borderRadius: "8px", border: "1px dashed var(--color-border, #334155)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 className="serif" style={{ margin: 0, fontSize: "1.15rem" }}>Bulk Import Trails (CSV)</h3>
              <p className="admin-hint" style={{ margin: "4px 0 0" }}>
                Upload a UTF-8 CSV with columns: <code>Trail Id</code> (e.g. HIHGOK01), <code>Trail Name</code>, <code>Destination</code>, <code>Start Date</code>, <code>End Date</code>, <code>Leader User Id</code> (phone number), <code>Active / Inactive</code>.
              </p>
            </div>
            <a
              href="/api/admin/trips/import"
              download="trails_import_template.csv"
              className="link-btn"
              style={{ fontWeight: 600 }}
            >
              Download CSV Template
            </a>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            disabled={importing}
            style={{ marginTop: "8px" }}
          />
          {importing && <p className="muted small" style={{ marginTop: "8px" }}>Processing trail import batch…</p>}
          {importReport && (
            <div style={{ marginTop: "14px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "6px" }}>
              <strong>Import Results:</strong> Created: {importReport.created} · Skipped (duplicates): {importReport.skipped}
              {importReport.errorCount > 0 && importReport.results && (
                <div style={{ marginTop: "8px", color: "var(--color-danger, #ef4444)" }}>
                  <strong>Errors ({importReport.errorCount}):</strong>
                  {importReport.results
                    .filter((r) => r.status === "error")
                    .map((err, i) => (
                      <div key={i} className="small">
                        Row {err.row} ({err.trip_code || "Unknown"}): {err.error}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="form-error" role="alert" style={{ marginBottom: "12px" }}>{error}</p>}
      {notice && <p className="form-notice" role="status" style={{ marginBottom: "12px" }}>{notice}</p>}

      {filtered.length === 0 ? (
        <p className="panel-note">No trails match that filter.</p>
      ) : (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Trail Id</th>
                <th>Trail Name</th>
                <th>Destination</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Leader</th>
                <th>Active / Inactive</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((trip) => {
                const isLoading = loadingTripId === trip.trip_id;
                const isItemActive = trip.is_active !== false && trip.status !== "archived";
                return (
                  <tr key={trip.trip_id}>
                    <td className="mono">{trip.trip_code}</td>
                    <td>
                      <strong>{trip.trip_name}</strong>
                    </td>
                    <td>{trip.destination || "—"}</td>
                    <td>
                      {trip.start_date ? new Date(trip.start_date).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td>
                      {trip.end_date ? new Date(trip.end_date).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td>
                      {trip.leader_first_name
                        ? `${trip.leader_first_name} ${trip.leader_last_name ?? ""}`.trim()
                        : "Unassigned"}
                    </td>
                    <td>
                      <span className={`pill ${isItemActive && trip.status === "published" ? "on" : "off"}`}>
                        {isItemActive ? "Active" : "Inactive"}
                        <span className="muted small" style={{ marginLeft: "4px" }}>({trip.status})</span>
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