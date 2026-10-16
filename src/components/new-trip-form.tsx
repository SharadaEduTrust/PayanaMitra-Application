"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NewTripForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const supabase = createClient();

    const { data, error: insertError } = await supabase
      .from("trips")
      .insert({
        trip_code: String(form.get("trip_code") || ""),
        name: String(form.get("name") || ""),
        destination: String(form.get("destination") || "") || null,
        start_date: String(form.get("start_date") || "") || null,
        end_date: String(form.get("end_date") || "") || null,
        status: "draft",
        is_active: true,
      })
      .select("id")
      .single();

    setLoading(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "That trip code already exists. Codes must be unique."
          : insertError.message,
      );
      return;
    }

    router.push(`/admin/trips/${data.id}`);
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