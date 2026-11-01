"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TrailLeaderView, TripStatus } from "@/lib/types";

type SortField =
  | "name"
  | "code"
  | "destination"
  | "startDate"
  | "endDate"
  | "leader"
  | "status";

type SortOrder = "asc" | "desc";

export default function TripListAdmin({ trips }: { trips: TrailLeaderView[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(trips);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loadingTripId, setLoadingTripId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Sorting state (default: sort by Name ascending, just like Users)
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Keep rows in sync if server props refresh
  useEffect(() => {
    setRows(trips);
  }, [trips]);

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
        (trip.trip_name ?? "").toLowerCase().includes(term) ||
        (trip.trip_code ?? "").toLowerCase().includes(term) ||
        (trip.destination ?? "").toLowerCase().includes(term) ||
        `${trip.leader_first_name ?? ""} ${trip.leader_last_name ?? ""}`.toLowerCase().includes(term);

      const matchesStatus = statusFilter === "all" || trip.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const sortedRows = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name": {
          const nameA = (a.trip_name ?? "").trim().toLowerCase();
          const nameB = (b.trip_name ?? "").trim().toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case "code": {
          const codeA = (a.trip_code ?? "").trim().toLowerCase();
          const codeB = (b.trip_code ?? "").trim().toLowerCase();
          comparison = codeA.localeCompare(codeB);
          break;
        }
        case "destination": {
          const destA = (a.destination ?? "").trim().toLowerCase();
          const destB = (b.destination ?? "").trim().toLowerCase();
          comparison = destA.localeCompare(destB);
          break;
        }
        case "startDate": {
          const tA = a.start_date ? new Date(a.start_date).getTime() : 0;
          const tB = b.start_date ? new Date(b.start_date).getTime() : 0;
          comparison = tA - tB;
          break;
        }
        case "endDate": {
          const tA = a.end_date ? new Date(a.end_date).getTime() : 0;
          const tB = b.end_date ? new Date(b.end_date).getTime() : 0;
          comparison = tA - tB;
          break;
        }
        case "leader": {
          const lA = `${a.leader_first_name ?? ""} ${a.leader_last_name ?? ""}`.trim().toLowerCase();
          const lB = `${b.leader_first_name ?? ""} ${b.leader_last_name ?? ""}`.trim().toLowerCase();
          comparison = lA.localeCompare(lB);
          break;
        }
        case "status": {
          const isItemActiveA = a.is_active !== false && a.status !== "archived";
          const isItemActiveB = b.is_active !== false && b.status !== "archived";
          if (isItemActiveA !== isItemActiveB) {
            comparison = isItemActiveA ? -1 : 1;
          } else {
            const statusOrder: Record<string, number> = { published: 1, draft: 2, archived: 3 };
            comparison = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
          }
          break;
        }
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filtered, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  function renderSortHeader(label: string, field: SortField, style?: React.CSSProperties) {
    const isSorted = sortField === field;
    return (
      <th
        onClick={() => toggleSort(field)}
        style={{
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
          ...style,
        }}
        title={`Sort by ${label} (${isSorted ? (sortOrder === "asc" ? "Descending" : "Ascending") : "Ascending"})`}
        aria-sort={isSorted ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          {label}
          <span style={{ fontSize: "11px", color: isSorted ? "var(--forest, #2d5a27)" : "var(--color-muted, #94a3b8)", opacity: isSorted ? 1 : 0.4 }}>
            {isSorted ? (sortOrder === "asc" ? "▲" : "▼") : "⇅"}
          </span>
        </span>
      </th>
    );
  }

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

  async function deleteTrip(trip: TrailLeaderView) {
    const confirmMessage = `Are you sure you want to permanently delete trail "${trip.trip_name}" (${trip.trip_code})?\n\nThis will permanently remove the trail, its itinerary days, activities, and guest assignments. This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    setError("");
    setNotice("");
    setLoadingTripId(trip.trip_id);

    try {
      const res = await fetch(`/api/admin/trips/${trip.trip_id}?hard=true`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => null);
      setLoadingTripId(null);

      if (!res.ok) {
        setError(json?.error ?? "Failed to delete trail.");
        return;
      }

      setRows((current) => current.filter((t) => t.trip_id !== trip.trip_id));
      setNotice(`Trail "${trip.trip_name}" (${trip.trip_code}) deleted permanently.`);
      router.refresh();
    } catch {
      setLoadingTripId(null);
      setError("Network error while deleting trail.");
    }
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const publishedCount = rows.filter((r) => r.status === "published").length;
    const draftCount = rows.filter((r) => r.status === "draft").length;
    const archivedCount = rows.filter((r) => r.status === "archived").length;
    return [
      { label: "Total Trails", value: total, sub: "Registered itineraries", status: "all" },
      { label: "Published Trails", value: publishedCount, sub: "Live and active itineraries", status: "published" },
      { label: "Draft Trails", value: draftCount, sub: "In-development itineraries", status: "draft" },
      { label: "Archived Trails", value: archivedCount, sub: "Past or closed trails", status: "archived" },
    ];
  }, [rows]);

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
    <>
      {/* KPI Stats Overview */}
      <div className="admin-stats" style={{ marginBottom: "22px" }}>
        {stats.map((s) => {
          const isSelected = statusFilter === s.status;
          return (
            <button
              key={s.label}
              type="button"
              className="stat"
              onClick={() => {
                setStatusFilter(s.status);
                setPage(1);
              }}
              style={{
                textAlign: "left",
                width: "100%",
                background: isSelected ? "var(--soft, #f4f8f5)" : "var(--white, #ffffff)",
                borderColor: isSelected ? "var(--forest, #1e3a2b)" : "var(--line, #e2e8f0)",
              }}
              title={`Filter by ${s.label}`}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{s.label}</span>
                {isSelected && (
                  <span style={{ fontSize: "10px", background: "var(--forest)", color: "#fff", padding: "1px 6px", borderRadius: "8px", fontWeight: 700 }}>
                    Active Filter
                  </span>
                )}
              </div>
              <strong>{s.value}</strong>
              <small style={{ fontSize: "11px", color: "#64748b" }}>{s.sub}</small>
            </button>
          );
        })}
      </div>

      <section className="admin-card">
        {/* Card Header: Title on Left, Primary Action (+ New Trail) on Right */}
        <div className="admin-card-header-row">
          <div>
            <h2 className="serif" style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
              Trails
              <span className="admin-count-badge">
                {sortedRows.length} {sortedRows.length === 1 ? "trail" : "trails"}
              </span>
            </h2>
            <p className="admin-hint" style={{ margin: "4px 0 0", fontSize: "13.5px", color: "#64748b" }}>
              Find, sort itineraries by name or dates, assign trail leaders, and manage publication status.
            </p>
          </div>
          <div className="admin-card-header-actions">
            <Link
              href="/admin/trips/new"
              className="admin-control-btn admin-control-btn-primary"
              style={{ textDecoration: "none" }}
            >
              + New Trail
            </Link>
          </div>
        </div>

        {/* Dedicated Toolbar Row for Search & Filters */}
        <div className="admin-toolbar-row">
          {/* Search Input Box */}
          <div className="admin-search-box">
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
              className="admin-control-input"
              placeholder="Search name, code, leader, destination…"
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

          {/* Filter & Action Controls on Right */}
          <div className="admin-filter-group">
            {/* Status Filter */}
            <select
              className="admin-control-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter trails by status"
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            {/* Sort Controls */}
            <div className="admin-sort-combo">
              <select
                className="admin-control-select"
                value={sortField}
                onChange={(e) => {
                  setSortField(e.target.value as SortField);
                  setPage(1);
                }}
                aria-label="Sort trails by field"
              >
                <option value="name">Sort: Name</option>
                <option value="code">Sort: Trail Id</option>
                <option value="destination">Sort: Destination</option>
                <option value="startDate">Sort: Start Date</option>
                <option value="endDate">Sort: End Date</option>
                <option value="leader">Sort: Leader</option>
                <option value="status">Sort: Status</option>
              </select>
              <button
                type="button"
                className="admin-control-btn admin-control-btn-secondary"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                title={`Sort ${sortOrder === "asc" ? "Ascending" : "Descending"} (Click to flip)`}
              >
                {sortOrder === "asc" ? "▲ Asc" : "▼ Desc"}
              </button>
            </div>

            {/* Import CSV Button */}
            <button
              type="button"
              className="admin-control-btn admin-control-btn-secondary"
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

        {sortedRows.length === 0 ? (
          <p className="panel-note">No trails match that filter.</p>
        ) : (
          <>
            <div className="admin-table-container">
              <table className="admin-table admin-table-trips">
                <thead>
                  <tr>
                    {renderSortHeader("Trail Id", "code", { width: "13%", minWidth: "110px", paddingLeft: "16px" })}
                    {renderSortHeader("Trail Name", "name", { width: "23%", minWidth: "160px" })}
                    {renderSortHeader("Destination", "destination", { width: "13%", minWidth: "110px" })}
                    {renderSortHeader("Start Date", "startDate", { width: "9%", minWidth: "90px" })}
                    {renderSortHeader("End Date", "endDate", { width: "9%", minWidth: "90px" })}
                    {renderSortHeader("Leader", "leader", { width: "12%", minWidth: "105px" })}
                    {renderSortHeader("Active / Inactive", "status", { width: "10%", minWidth: "110px" })}
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
                            <Link className="link-btn" href={`/admin/feedback?trip_id=${trip.trip_id}`}>
                              Feedback
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
                            <button
                              type="button"
                              className="link-btn"
                              style={{ color: "#ef4444", fontWeight: 600 }}
                              disabled={isLoading}
                              onClick={() => deleteTrip(trip)}
                              title={`Delete trail ${trip.trip_code}`}
                            >
                              Delete
                            </button>
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
                  Showing <strong>{(page - 1) * pageSize + 1}</strong> – <strong>{Math.min(page * pageSize, sortedRows.length)}</strong> of <strong>{sortedRows.length}</strong> trails (Page {page} of {totalPages})
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
      </section>
    </>
  );
}