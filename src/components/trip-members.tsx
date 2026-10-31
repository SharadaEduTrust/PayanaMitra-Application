"use client";

import { useEffect, useState, useRef, useMemo, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/types";

export default function TripMembers({ tripId }: { tripId: string }) {
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [members, setMembers] = useState<{ userId: string; name: string; phone: string }[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Multi-guest selection state for adding to trail
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");

  // Multi-guest selection state for removing from trail
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  // CSV Import State
  const [showCsv, setShowCsv] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function reloadMembers() {
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/members`);
      const json = await res.json().catch(() => ({ data: [] }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enrolled = (json.data ?? []).map((m: any) => ({
        userId: m.profiles?.id ?? "",
        name: m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : "Unknown",
        phone: m.profiles?.phone ?? "",
      })).filter((m: { userId: string }) => Boolean(m.userId));

      setMembers(enrolled);
      setSelectedMemberIds([]);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [usersRes, membersRes] = await Promise.all([
          fetch("/api/admin/users?role=traveller&limit=500"),
          fetch(`/api/admin/trips/${tripId}/members`),
        ]);

        const usersJson = await usersRes.json().catch(() => ({ data: [] }));
        const membersJson = await membersRes.json().catch(() => ({ data: [] }));

        if (ignore) return;

        const people: Profile[] = (usersJson.data ?? []).map((u: Record<string, unknown>) => ({
          id: u.id as string,
          phone: (u.phone as string) ?? "",
          role: (u.role as "traveller" | "leader" | "admin") ?? "traveller",
          first_name: (u.first_name as string) ?? "",
          last_name: (u.last_name as string) ?? "",
          email: (u.email as string) ?? null,
          is_active: (u.is_active as boolean) ?? true,
          created_at: (u.created_at as string) ?? new Date().toISOString(),
          updated_at: (u.updated_at as string) ?? new Date().toISOString(),
        }));

        setCandidates(people);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enrolled = (membersJson.data ?? []).map((m: any) => ({
          userId: m.profiles?.id ?? "",
          name: m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : "Unknown",
          phone: m.profiles?.phone ?? "",
        })).filter((m: { userId: string }) => Boolean(m.userId));

        setMembers(enrolled);
      } catch {
        if (!ignore) setError("Failed to load trail guests.");
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [tripId]);

  // Available guests not yet mapped to this trail, sorted in ascending order of their names
  const availableCandidates = useMemo(() => {
    const enrolledSet = new Set(members.map((m) => m.userId));
    return candidates
      .filter((c) => !enrolledSet.has(c.id))
      .sort((a, b) => {
        const nameA = `${a.first_name} ${a.last_name}`.trim().toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [candidates, members]);

  // Filtered available candidates based on search
  const filteredCandidates = useMemo(() => {
    const term = candidateSearch.trim().toLowerCase();
    if (!term) return availableCandidates;
    return availableCandidates.filter(
      (c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        (c.email ?? "").toLowerCase().includes(term)
    );
  }, [availableCandidates, candidateSearch]);

  // Filtered enrolled members based on search, sorted in ascending order of names
  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    const list = term
      ? members.filter(
          (m) =>
            m.name.toLowerCase().includes(term) ||
            m.phone.includes(term)
        )
      : members;
    return [...list].sort((a, b) =>
      a.name.trim().toLowerCase().localeCompare(b.name.trim().toLowerCase())
    );
  }, [members, memberSearch]);

  function toggleCandidate(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  const allFilteredCandidatesSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((c) => selectedUserIds.includes(c.id));

  function toggleSelectAllFiltered() {
    const filteredIds = filteredCandidates.map((c) => c.id);
    if (allFilteredCandidatesSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  }

  async function addSelectedMembers() {
    if (selectedUserIds.length === 0) return;
    setError("");
    setStatus("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/trips/${tripId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: selectedUserIds }),
      });

      const json = await res.json().catch(() => null);
      setLoading(false);

      if (!res.ok) {
        setError(json?.error ?? "Failed to add guests to trail.");
        return;
      }

      const count = selectedUserIds.length;
      const newlyAdded = candidates
        .filter((c) => selectedUserIds.includes(c.id))
        .map((c) => ({
          userId: c.id,
          name: `${c.first_name} ${c.last_name}`,
          phone: c.phone,
        }));

      setMembers((current) => [...current, ...newlyAdded]);
      setSelectedUserIds([]);
      setStatus(`Successfully mapped ${count} guest${count !== 1 ? "s" : ""} to this trail.`);
    } catch {
      setLoading(false);
      setError("Network error while adding guests.");
    }
  }

  async function removeMember(userId: string) {
    setError("");
    setStatus("");

    try {
      const res = await fetch(`/api/admin/trips/${tripId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [userId] }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Failed to remove guest from trail.");
        return;
      }

      setMembers((current) => current.filter((member) => member.userId !== userId));
      setSelectedMemberIds((prev) => prev.filter((id) => id !== userId));
      setStatus("Guest removed.");
    } catch {
      setError("Network error while removing guest.");
    }
  }

  async function removeSelectedMembers() {
    if (selectedMemberIds.length === 0) return;
    const count = selectedMemberIds.length;
    if (!window.confirm(`Are you sure you want to remove ${count} guest${count !== 1 ? "s" : ""} from this trail?`)) {
      return;
    }

    setError("");
    setStatus("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/trips/${tripId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: selectedMemberIds }),
      });

      setLoading(false);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Failed to remove guests from trail.");
        return;
      }

      const removedSet = new Set(selectedMemberIds);
      setMembers((current) => current.filter((m) => !removedSet.has(m.userId)));
      setSelectedMemberIds([]);
      setStatus(`Removed ${count} guest${count !== 1 ? "s" : ""} from trail.`);
    } catch {
      setLoading(false);
      setError("Network error while removing guests.");
    }
  }

  const allFilteredMembersSelected =
    filteredMembers.length > 0 &&
    filteredMembers.every((m) => selectedMemberIds.includes(m.userId));

  function toggleSelectAllMembers() {
    const filteredIds = filteredMembers.map((m) => m.userId);
    if (allFilteredMembersSelected) {
      setSelectedMemberIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  }

  function toggleMemberSelection(userId: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleCsvUpload(e: FormEvent) {
    e.preventDefault();
    if (!csvFile) return;

    setCsvLoading(true);
    setError("");
    setStatus("");

    try {
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("trip_id", tripId);

      const res = await fetch("/api/admin/trips/mapping/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setCsvLoading(false);

      if (!res.ok) {
        setError(json?.error ?? "Failed to import guests CSV.");
        return;
      }

      setStatus(
        `Mapping complete: ${json.created} guest(s) mapped, ${json.skipped} skipped, ${json.errorCount} error(s).`
      );
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowCsv(false);
      await reloadMembers();
    } catch {
      setCsvLoading(false);
      setError("Network error while uploading guests CSV.");
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "10px", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <h2 className="serif" style={{ margin: 0 }}>Enrolled Guests ({members.length})</h2>
          <p className="admin-hint" style={{ margin: "4px 0 0" }}>
            Only enrolled guests can access details of this trail on their dashboard.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCsv(!showCsv)}
          >
            {showCsv ? "Hide CSV Import" : "Import Guests (CSV)"}
          </button>
          <Link href="/admin/import?tab=mapping" className="link-btn" style={{ fontSize: "13px" }}>
            Bulk Mapping Utility →
          </Link>
        </div>
      </div>

      {showCsv && (
        <div
          style={{
            padding: "16px",
            background: "var(--paper, rgba(255, 255, 255, 0.02))",
            border: "1px dashed var(--line)",
            borderRadius: "8px",
            marginBottom: "18px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <strong>Map Guests to This Trail via CSV</strong>
            <a
              href="/api/admin/trips/mapping/import"
              download="trail_guest_mapping_template.csv"
              className="link-btn"
              style={{ fontSize: "13px" }}
            >
              Download CSV Template
            </a>
          </div>
          <p className="admin-hint" style={{ fontSize: "13px", margin: "0 0 12px" }}>
            Upload a UTF-8 CSV with <code>Mobile Number of the Guest</code>. All valid guest mobile numbers in the file will be mapped directly to this trail.
          </p>
          <form onSubmit={handleCsvUpload} style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setCsvFile(e.target.files?.[0] || null);
                setError("");
              }}
              disabled={csvLoading}
              style={{ fontSize: "14px" }}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={csvLoading || !csvFile}
            >
              {csvLoading ? "Mapping…" : "Upload & Enrol"}
            </button>
            {csvFile && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setCsvFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Cancel
              </button>
            )}
          </form>
        </div>
      )}

      {/* Multi-Guest Selection & Enrollment Panel */}
      <div
        style={{
          background: "var(--paper, #f8fafc)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: "10px",
          padding: "16px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <strong style={{ fontSize: "14.5px", color: "#0f172a" }}>Choose Guests to Map to This Trail</strong>
            <div className="muted small" style={{ marginTop: "2px" }}>
              Select one or multiple guests below. ({availableCandidates.length} unregistered guest{availableCandidates.length !== 1 ? "s" : ""} available)
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {filteredCandidates.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={toggleSelectAllFiltered}
                style={{ fontSize: "12.5px", padding: "5px 12px" }}
              >
                {allFilteredCandidatesSelected ? "Deselect All Filtered" : `Select All (${filteredCandidates.length})`}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={addSelectedMembers}
              disabled={selectedUserIds.length === 0 || loading}
              style={{ fontSize: "13px", padding: "6px 16px" }}
            >
              {loading
                ? "Mapping…"
                : selectedUserIds.length === 0
                ? "Map Selected Guests"
                : `Map Selected Guests (${selectedUserIds.length})`}
            </button>
          </div>
        </div>

        {/* Search / Filter Available Guests */}
        <div style={{ marginBottom: "10px" }}>
          <input
            type="search"
            placeholder="Search by name, mobile number, or email…"
            value={candidateSearch}
            onChange={(e) => setCandidateSearch(e.target.value)}
            className="admin-control-input"
            style={{ width: "100%", padding: "7px 12px", fontSize: "13.5px" }}
          />
        </div>

        {/* Checkbox List of Available Guests */}
        <div
          style={{
            maxHeight: "220px",
            overflowY: "auto",
            border: "1px solid var(--line, #cbd5e1)",
            borderRadius: "6px",
            background: "#ffffff",
          }}
        >
          {availableCandidates.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "13.5px" }}>
              All registered guests are already enrolled in this trail.
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "13.5px" }}>
              No available guests match &ldquo;{candidateSearch}&rdquo;.
            </div>
          ) : (
            filteredCandidates.map((c) => {
              const isChecked = selectedUserIds.includes(c.id);
              return (
                <label
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 12px",
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    background: isChecked ? "rgba(45, 90, 39, 0.08)" : "transparent",
                    transition: "background 0.15s ease",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCandidate(c.id)}
                    style={{
                      width: "16px",
                      height: "16px",
                      accentColor: "var(--forest, #2d5a27)",
                      cursor: "pointer",
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flex: 1 }}>
                    <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "13.5px" }}>
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="mono" style={{ fontSize: "13px", color: "#334155" }}>
                      {c.phone}
                    </span>
                    {c.email && (
                      <span className="small muted" style={{ fontSize: "12px" }}>
                        · {c.email}
                      </span>
                    )}
                  </div>
                  {isChecked && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "var(--forest, #2d5a27)",
                        background: "rgba(45, 90, 39, 0.12)",
                        padding: "2px 8px",
                        borderRadius: "10px",
                      }}
                    >
                      Selected
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        {selectedUserIds.length > 0 && (
          <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--forest, #2d5a27)" }}>
              ✓ {selectedUserIds.length} guest{selectedUserIds.length !== 1 ? "s" : ""} selected ready to map
            </span>
            <button
              type="button"
              className="link-btn"
              onClick={() => setSelectedUserIds([])}
              style={{ fontSize: "12px", color: "#64748b" }}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Enrolled Guests List */}
      <div style={{ marginTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "10px" }}>
          <h3 className="serif" style={{ margin: 0, fontSize: "16px" }}>
            Enrolled Guest List ({members.length})
          </h3>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {members.length > 5 && (
              <input
                type="search"
                placeholder="Filter enrolled guests…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="admin-control-input"
                style={{ padding: "4px 10px", fontSize: "13px", width: "190px" }}
              />
            )}
            {selectedMemberIds.length > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={removeSelectedMembers}
                disabled={loading}
                style={{
                  background: "var(--color-danger, #ef4444)",
                  color: "#fff",
                  borderColor: "var(--color-danger, #ef4444)",
                  fontSize: "12.5px",
                  padding: "5px 12px",
                }}
              >
                Remove Selected ({selectedMemberIds.length})
              </button>
            )}
          </div>
        </div>

        {members.length === 0 ? (
          <p className="panel-note">No guests enrolled yet. Select guests above to map them to this trail.</p>
        ) : filteredMembers.length === 0 ? (
          <p className="panel-note">No enrolled guests match &ldquo;{memberSearch}&rdquo;.</p>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "36px", paddingLeft: "14px" }}>
                    <input
                      type="checkbox"
                      checked={allFilteredMembersSelected}
                      onChange={toggleSelectAllMembers}
                      title={allFilteredMembersSelected ? "Deselect all" : "Select all"}
                      style={{ cursor: "pointer", width: "15px", height: "15px" }}
                      aria-label="Select all enrolled guests"
                    />
                  </th>
                  <th>Name</th>
                  <th>Mobile Number</th>
                  <th style={{ textAlign: "right", paddingRight: "18px" }} aria-label="Actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const isChecked = selectedMemberIds.includes(member.userId);
                  return (
                    <tr key={member.userId} style={{ background: isChecked ? "rgba(239, 68, 68, 0.05)" : undefined }}>
                      <td style={{ paddingLeft: "14px" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMemberSelection(member.userId)}
                          style={{ cursor: "pointer", width: "15px", height: "15px" }}
                          aria-label={`Select ${member.name}`}
                        />
                      </td>
                      <td>
                        <strong style={{ color: "#0f172a" }}>{member.name}</strong>
                      </td>
                      <td className="mono">{member.phone}</td>
                      <td className="row-actions" style={{ textAlign: "right", paddingRight: "18px" }}>
                        <button
                          type="button"
                          className="action-pill action-pill-danger"
                          onClick={() => removeMember(member.userId)}
                          title="Remove guest from trail"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && <p className="form-error" role="alert" style={{ marginTop: "12px" }}>{error}</p>}
      {status && <p className="form-notice" role="status" style={{ marginTop: "12px" }}>{status}</p>}
    </section>
  );
}
