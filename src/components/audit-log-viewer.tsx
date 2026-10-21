"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
};

export default function AuditLogViewer({
  entries,
  total,
  page,
  limit,
  entityFilter,
  actionFilter,
}: {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  entityFilter: string;
  actionFilter: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState(actionFilter);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function updateQuery(newParams: { entity?: string; action?: string; page?: number }) {
    const params = new URLSearchParams();
    const entity = newParams.entity !== undefined ? newParams.entity : entityFilter;
    const action = newParams.action !== undefined ? newParams.action : search;
    const p = newParams.page !== undefined ? newParams.page : 1;

    if (entity && entity !== "all") params.set("entity", entity);
    if (action.trim()) params.set("action", action.trim());
    if (p > 1) params.set("page", String(p));

    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 className="serif">Activity Stream</h2>
          <p className="admin-hint" style={{ margin: 0 }}>
            {total} recorded action{total === 1 ? "" : "s"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            value={entityFilter}
            onChange={(e) => updateQuery({ entity: e.target.value, page: 1 })}
            style={{ padding: "6px 12px", borderRadius: "6px" }}
          >
            <option value="all">All entities</option>
            <option value="trips">Trails</option>
            <option value="profiles">Guests / Profiles</option>
            <option value="guest_documents">Documents</option>
            <option value="itinerary_days">Itinerary</option>
            <option value="notifications">Notifications</option>
          </select>

          <input
            className="admin-search"
            placeholder="Search action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateQuery({ action: search, page: 1 });
              }
            }}
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="panel-note">No audit records match the selected filter.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>IP Address</th>
              <th aria-label="Details" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const date = new Date(entry.created_at);
              return (
                <tr key={entry.id}>
                  <td className="muted small" style={{ whiteSpace: "nowrap" }}>
                    {date.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    {date.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    {entry.profiles ? (
                      <div>
                        <strong>
                          {entry.profiles.first_name} {entry.profiles.last_name}
                        </strong>
                        <div className="muted small mono">{entry.profiles.phone}</div>
                      </div>
                    ) : (
                      <span className="muted">System / Unknown</span>
                    )}
                  </td>
                  <td>
                    <span className="pill off" style={{ textTransform: "uppercase", fontSize: "11px" }}>
                      {entry.action}
                    </span>
                  </td>
                  <td>
                    <strong>{entry.entity}</strong>
                    {entry.entity_id && (
                      <div className="muted small mono" title={entry.entity_id}>
                        {entry.entity_id.slice(0, 8)}…
                      </div>
                    )}
                  </td>
                  <td className="mono small">{entry.ip || "—"}</td>
                  <td className="row-actions">
                    {entry.payload && Object.keys(entry.payload).length > 0 ? (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        {isExpanded ? "Hide" : "Payload"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {expandedId && (
        <div style={{ marginTop: "16px", padding: "12px", background: "var(--color-surface, #1e293b)", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span className="small"><strong>Payload details:</strong> {expandedId}</span>
            <button type="button" className="link-btn" onClick={() => setExpandedId(null)}>Close</button>
          </div>
          <pre style={{ margin: 0, fontSize: "12px", overflowX: "auto", maxHeight: "200px" }}>
            {JSON.stringify(
              entries.find((e) => e.id === expandedId)?.payload,
              null,
              2,
            )}
          </pre>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => updateQuery({ page: page - 1 })}
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
            onClick={() => updateQuery({ page: page + 1 })}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
