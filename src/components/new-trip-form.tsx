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
      trip_code: String(form.get("trip_code") || "").trim().toUpperCase(),
      name: String(form.get("name") || "").trim(),
      destination: String(form.get("destination") || "").trim() || null,
      start_date: String(form.get("start_date") || "").trim() || null,
      end_date: String(form.get("end_date") || "").trim() || null,
      feedback_form_url: String(form.get("feedback_form_url") || "").trim() || null,
      feedback_window_days: Number(form.get("feedback_window_days")) || 7,
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
          setError(String(firstErr || json.error || "Failed to create trail."));
        } else {
          setError(json?.error ?? "Failed to create trail.");
        }
        return;
      }

      router.push(`/admin/trips/${json.data.id}`);
    } catch {
      setLoading(false);
      setError("Network error while creating trail.");
    }
  }

  return (
    <form className="admin-card" onSubmit={submit}>
      <h2 className="serif">New trail</h2>
      <p className="admin-hint">
        Trails are created as drafts. Guests only see a trail once you set the status to published
        and add them as guests.
      </p>

      <div className="field-row">
        <label className="form-field">
          Trail Id
          <input
            required
            name="trip_code"
            placeholder="e.g. HIHGOK01 (8-char alphanumeric)"
            maxLength={8}
            style={{ textTransform: "uppercase" }}
          />
        </label>
        <label className="form-field">
          Trail Name
          <input required name="name" placeholder="Hampi Heritage Trail" />
        </label>
      </div>

      <div className="field-row">
        <label className="form-field">
          Destination
          <input name="destination" placeholder="Hampi, Karnataka" />
        </label>
        <label className="form-field">
          Start Date
          <input type="date" name="start_date" />
        </label>
      </div>

      <label className="form-field">
        End Date
        <input type="date" name="end_date" />
      </label>

      <div className="field-row">
        <label className="form-field" style={{ flex: 2 }}>
          Google Form Link (Optional)
          <input
            type="url"
            name="feedback_form_url"
            placeholder="https://forms.gle/... (opens after trail finishes)"
          />
        </label>
        <label className="form-field" style={{ flex: 1, minWidth: "160px" }}>
          Feedback Window (Days)
          <input
            type="number"
            name="feedback_window_days"
            min={1}
            max={90}
            defaultValue={7}
            placeholder="7"
          />
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create draft trail"}
      </button>
    </form>
  );
}