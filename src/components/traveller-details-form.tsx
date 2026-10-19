"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TravellerDetails } from "@/lib/types";

const empty = {
  dob: "",
  food_preference: "" as "" | "veg" | "non_veg",
  food_allergy: "",
  emergency_contact_name: "",
  emergency_contact_no: "",
  travel_insurance_no: "",
  insurance_company: "",
  insurance_expiry: "",
};

/**
 * RLS on traveller_details grants the user SELECT and UPDATE on their own row
 * only. There is no INSERT policy, so an insert here would be rejected. The
 * API route below handles create-or-update with the service role.
 */
export default function TravellerDetailsForm({ details }: { details: TravellerDetails | null }) {
  const [form, setForm] = useState({
    dob: details?.dob ?? empty.dob,
    food_preference: details?.food_preference ?? empty.food_preference,
    food_allergy: details?.food_allergy ?? empty.food_allergy,
    emergency_contact_name: details?.emergency_contact_name ?? empty.emergency_contact_name,
    emergency_contact_no: details?.emergency_contact_no ?? empty.emergency_contact_no,
    travel_insurance_no: details?.travel_insurance_no ?? empty.travel_insurance_no,
    insurance_company: details?.insurance_company ?? empty.insurance_company,
    insurance_expiry: details?.insurance_expiry ?? empty.insurance_expiry,
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    setError("");
    setLoading(true);

    const response = await fetch("/api/traveller-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not save your travel details.");
      return;
    }
    setStatus("Saved.");
  }

  return (
    <form onSubmit={submit}>
      <div className="field-row">
        <label className="form-field">
          Date of birth
          <input type="date" value={form.dob} onChange={(event) => set("dob", event.target.value)} />
        </label>
        <label className="form-field">
          Food preference
          <select
            value={form.food_preference}
            onChange={(event) => set("food_preference", event.target.value)}
          >
            <option value="">No preference</option>
            <option value="veg">Vegetarian</option>
            <option value="non_veg">Non-vegetarian</option>
          </select>
        </label>
      </div>

      <label className="form-field">
        Food allergies
        <input value={form.food_allergy} onChange={(event) => set("food_allergy", event.target.value)} placeholder="Peanuts, shellfish…" />
      </label>

      <div className="field-row">
        <label className="form-field">
          Emergency contact name
          <input value={form.emergency_contact_name} onChange={(event) => set("emergency_contact_name", event.target.value)} />
        </label>
        <label className="form-field">
          Emergency contact number
          <input type="tel" value={form.emergency_contact_no} onChange={(event) => set("emergency_contact_no", event.target.value)} />
        </label>
      </div>

      <div className="field-row">
        <label className="form-field">
          Insurance policy number
          <input value={form.travel_insurance_no} onChange={(event) => set("travel_insurance_no", event.target.value)} />
        </label>
        <label className="form-field">
          Insurance company
          <input value={form.insurance_company} onChange={(event) => set("insurance_company", event.target.value)} />
        </label>
      </div>

      <label className="form-field">
        Insurance expiry
        <input type="date" value={form.insurance_expiry} onChange={(event) => set("insurance_expiry", event.target.value)} />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save travel details"}
      </button>
    </form>
  );
}