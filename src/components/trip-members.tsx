"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";

export default function TripMembers({ tripId }: { tripId: string }) {
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [members, setMembers] = useState<{ userId: string; name: string; phone: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [usersRes, membersRes] = await Promise.all([
          fetch("/api/admin/users?role=traveller&limit=100"),
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

        const enrolled = (membersJson.data ?? []).map((m: { profiles?: { id: string; first_name: string; last_name: string; phone: string } }) => ({
          userId: m.profiles?.id ?? "",
          name: m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : "Unknown",
          phone: m.profiles?.phone ?? "",
        })).filter((m: { userId: string }) => Boolean(m.userId));

        setMembers(enrolled);
      } catch {
        if (!ignore) setError("Failed to load members or guest list.");
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
      setStatus("Member added.");
    } catch {
      setLoading(false);
      setError("Network error while adding member.");
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
      setStatus("Member removed.");
    } catch {
      setError("Network error while removing member.");
    }
  }

  return (
    <section className="admin-card">
      <h2 className="serif">Members</h2>
      <p className="admin-hint">
        Only members can see a published trail. Adding someone here is what grants them access.
      </p>

      <div className="field-row">
        <label className="form-field">
          Add a guest
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Select a guest</option>
            {candidates
              .filter((candidate) => !members.some((member) => member.userId === candidate.id))
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.first_name} {candidate.last_name} · {candidate.phone}
                </option>
              ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={addMember} disabled={!selected || loading}>
          {loading ? "Adding…" : "Add to trail"}
        </button>
      </div>

      {members.length === 0 ? (
        <p className="panel-note">No members yet.</p>
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

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}
    </section>
  );
}