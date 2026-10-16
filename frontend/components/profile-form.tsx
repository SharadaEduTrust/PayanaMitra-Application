"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProfileForm({
  defaults,
  phone,
  email,
  role,
}: {
  defaults: { location: string };
  phone: string;
  email: string;
  role: string;
}) {
  const [location, setLocation] = useState(defaults.location);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    setError("");

    const supabase = createClient();

    // profiles has no client UPDATE policy for this column, so route it
    // through the API with the service role.
    const response = await fetch("/api/profile/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not save your details.");
      return;
    }
    setStatus("Saved.");
  }

  return (
    <form onSubmit={submit}>
      <dl className="fact-list">
        <div>
          <dt>Phone</dt>
          <dd className="mono">{phone}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{email || "—"}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd style={{ textTransform: "capitalize" }}>{role}</dd>
        </div>
      </dl>

      <label className="form-field">
        Home city
        <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Dharwad" />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}

      <button className="btn btn-primary" type="submit">
        Save details
      </button>
    </form>
  );
}