"use client";

import { useEffect, useState, useRef, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/types";

export default function TripMembers({ tripId }: { tripId: string }) {
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [members, setMembers] = useState<{ userId: string; name: string; phone: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [usersRes, membersRes] = await Promise.all([
          fetch("/api/admin/users?role=traveller&limit=200"),
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

  async function addMember() {
    if (!selected) return;
    setError("");
    setStatus("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/trips/${tripId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [selected] }),
      });

      const json = await res.json().catch(() => null);
      setLoading(false);

      if (!res.ok) {
        setError(json?.error ?? "Failed to add guest to trail.");
        return;
      }

      const person = candidates.find((candidate) => candidate.id === selected);
      if (person) {
        setMembers((current) => [
          ...current,
          { userId: person.id, name: `${person.first_name} ${person.last_name}`, phone: person.phone },
        ]);
      }
      setSelected("");
      setStatus("Guest added.");
    } catch {
      setLoading(false);
      setError("Network error while adding guest.");
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
      setStatus("Guest removed.");
    } catch {
      setError("Network error while removing guest.");
    }
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

      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "18px" }}>
        <label className="form-field" style={{ flex: "1 1 280px", maxWidth: "420px", margin: 0 }}>
          Add a guest manually
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Select a registered guest</option>
            {candidates
              .filter((candidate) => !members.some((member) => member.userId === candidate.id))
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.first_name} {candidate.last_name} · {candidate.phone}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={addMember}
          disabled={!selected || loading}
          style={{ width: "auto" }}
        >
          {loading ? "Adding…" : "Add guest"}
        </button>
      </div>

      {members.length === 0 ? (
        <p className="panel-note">No guests enrolled yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.userId}>
                <td>{member.name}</td>
                <td className="mono">{member.phone}</td>
                <td className="row-actions">
                  <button type="button" className="link-btn" onClick={() => removeMember(member.userId)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <p className="form-error" role="alert" style={{ marginTop: "12px" }}>{error}</p>}
      {status && <p className="form-notice" role="status" style={{ marginTop: "12px" }}>{status}</p>}
    </section>
  );
}