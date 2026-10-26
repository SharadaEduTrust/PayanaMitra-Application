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
      <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "14px", alignItems: "center", marginBottom: "18px" }}>
        <h2 className="serif" style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          All Trails ({filtered.length})
        </h2>
        <div className="admin-toolbar" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div className="admin-search-box" style={{ minWidth: "260px", maxWidth: "340px", flex: "1 1 260px" }}>
            <svg
              className="admin-search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="admin-control admin-control-input"
              placeholder="Search code, name, leader…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search trails"
            />
            {query && (
              <button
                type="button"
                className="admin-search-clear"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <select
            className="admin-control admin-control-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter trails by status"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <button
            type="button"
            className="admin-control admin-control-btn admin-control-btn-secondary"
            onClick={() => setShowImport(!showImport)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {showImport ? "Close CSV Import" : "Import Trails (CSV)"}
          </button>
        </div>
      </div>

      {showImport && (
        <div style={{ margin: "16px 0", padding: "18px", background: "#f8fafc", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 className="serif" style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>Bulk Import Trails (CSV)</h3>
              <p className="admin-hint" style={{ margin: "4px 0 0", color: "#475569" }}>
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
            <div style={{ marginTop: "14px", padding: "12px", background: "rgba(0,0,0,0.05)", borderRadius: "6px" }}>
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
          <div className="admin-table-container">
            <table className="admin-table admin-table-trips">
              <thead>
                <tr>
                  <th style={{ width: "13%", minWidth: "110px", paddingLeft: "16px", whiteSpace: "nowrap" }}>Trail Id</th>
                  <th style={{ width: "23%", minWidth: "160px" }}>Trail Name</th>
                  <th style={{ width: "13%", minWidth: "110px" }}>Destination</th>
                  <th style={{ width: "9%", minWidth: "90px", whiteSpace: "nowrap" }}>Start Date</th>
                  <th style={{ width: "9%", minWidth: "90px", whiteSpace: "nowrap" }}>End Date</th>
                  <th style={{ width: "12%", minWidth: "105px", whiteSpace: "nowrap" }}>Leader</th>
                  <th style={{ width: "10%", minWidth: "110px", whiteSpace: "nowrap" }}>Active / Inactive</th>
                  <th style={{ width: "11%", minWidth: "140px", textAlign: "right", paddingRight: "16px", whiteSpace: "nowrap" }} aria-label="Actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((trip) => {
                  const isLoading = loadingTripId === trip.trip_id;
                  const isItemActive = trip.is_active !== false && trip.status !== "archived";
                  return (
                    <tr key={trip.trip_id}>
                      <td className="mono" style={{ paddingLeft: "16px", fontWeight: 600, color: "#0f172a", wordBreak: "break-word" }}>
                        {trip.trip_code}
                      </td>
                      <td>
                        <strong style={{ color: "#0f172a", lineHeight: 1.4, display: "block" }}>
                          {trip.trip_name}
                        </strong>
                      </td>
                      <td style={{ color: trip.destination ? "#334155" : "#94a3b8" }}>
                        {trip.destination || "—"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {trip.start_date ? new Date(trip.start_date).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {trip.end_date ? new Date(trip.end_date).toLocaleDateString("en-IN") : "—"}
                      </td>
                      <td style={{ color: trip.leader_first_name ? "#0f172a" : "#94a3b8", whiteSpace: "nowrap" }}>
                        {trip.leader_first_name
                          ? `${trip.leader_first_name} ${trip.leader_last_name ?? ""}`.trim()
                          : "Unassigned"}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className={`pill ${isItemActive && trip.status === "published" ? "on" : "off"}`}>
                          {isItemActive ? "Active" : "Inactive"}
                          <span className="muted small" style={{ marginLeft: "4px" }}>({trip.status})</span>
                        </span>
                      </td>
                      <td style={{ textAlign: "right", paddingRight: "16px", whiteSpace: "nowrap" }}>
                        <div className="row-actions" style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", whiteSpace: "nowrap" }}>
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "10px" }}>
              <button
                type="button"
                className="admin-control admin-control-btn admin-control-btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}
              >
                ← Previous
              </button>
              <span className="muted small">
                Showing <strong>{(page - 1) * pageSize + 1}</strong> – <strong>{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> trails (Page {page} of {totalPages})
              </span>
              <button
                type="button"
                className="admin-control admin-control-btn admin-control-btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? "not-allowed" : "pointer" }}
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