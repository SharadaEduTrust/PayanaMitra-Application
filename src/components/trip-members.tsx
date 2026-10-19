"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function TripMembers({ tripId }: { tripId: string }) {
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [members, setMembers] = useState<{ userId: string; name: string; phone: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, role, is_active")
        .eq("role", "traveller")
        .order("first_name");

      const { data: existing } = await supabase.from("trip_members").select("user_id").eq("trip_id", tripId);
      const memberIds = new Set((existing ?? []).map((row) => row.user_id as string));

      setCandidates((people ?? []) as Profile[]);
      setMembers(
        (people ?? [])
          .filter((person) => memberIds.has(person.id))
          .map((person) => ({
            userId: person.id,
            name: `${person.first_name} ${person.last_name}`,
            phone: person.phone,
          })),
      );
    })();
  }, [tripId]);

  async function addMember() {
    if (!selected) return;
    setError("");
    setStatus("");

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("trip_members")
      .insert({ trip_id: tripId, user_id: selected });

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "That traveller is already on this trip."
          : insertError.message,
      );
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
  }

  async function removeMember(userId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("trip_members")
      .delete()
      .eq("trip_id", tripId)
      .eq("user_id", userId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setMembers((current) => current.filter((member) => member.userId !== userId));
    setStatus("Member removed.");
  }

  return (
    <section className="admin-card">
      <h2 className="serif">Members</h2>
      <p className="admin-hint">
        Only members can see a published trip. Adding someone here is what grants them access.
      </p>

      <div className="field-row">
        <label className="form-field">
          Add a traveller
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Select a traveller</option>
            {candidates
              .filter((candidate) => !members.some((member) => member.userId === candidate.id))
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.first_name} {candidate.last_name} · {candidate.phone}
                </option>
              ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={addMember} disabled={!selected}>
          Add to trip
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