"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NewTripForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      trip_code: String(form.get("trip_code") || "").trim(),
      name: String(form.get("name") || "").trim(),
      destination: String(form.get("destination") || "").trim() || null,
      start_date: String(form.get("start_date") || "").trim() || null,
      end_date: String(form.get("end_date") || "").trim() || null,
    };

    try {
      const res = await fetch("/api/admin/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      setLoading(false);

      if (!res.ok) {
        if (json?.fieldErrors) {
          const firstErr = Object.values(json.fieldErrors).flat()[0];
          setError(String(firstErr || json.error || "Failed to create trip."));
        } else {
          setError(json?.error ?? "Failed to create trip.");
        }
        return;
      }

      router.push(`/admin/trips/${json.data.id}`);
    } catch {
      setLoading(false);
      setError("Network error while creating trip.");
    }
  }

  return (
    <form className="admin-card" onSubmit={submit}>
      <h2 className="serif">New trip</h2>
      <p className="admin-hint">
        Trips are created as drafts. Travellers only see a trip once you set the status to published
        and add them as members.
      </p>

      <div className="field-row">
        <label className="form-field">
          Trip code
          <input required name="trip_code" placeholder="PM-2026-HAM-01" />
        </label>
        <label className="form-field">
          Trip name
          <input required name="name" placeholder="Hampi Heritage Trail" />
        </label>
      </div>

      <div className="field-row">
        <label className="form-field">
          Destination
          <input name="destination" placeholder="Hampi, Karnataka" />
        </label>
        <label className="form-field">
          Start date
          <input type="date" name="start_date" />
        </label>
      </div>

      <label className="form-field">
        End date
        <input type="date" name="end_date" />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create draft trip"}
      </button>
    </form>
  );
}