"use client";

import { useState, type FormEvent } from "react";
import type { TravellerDetails } from "@/lib/types";

export default function TravellerDetailsForm({
  details,
  initialPan = "",
  initialPassportNo = "",
  initialPassportExpiry = "",
}: {
  details: TravellerDetails | null;
  initialPan?: string;
  initialPassportNo?: string;
  initialPassportExpiry?: string;
}) {
  const [form, setForm] = useState({
    dob: details?.dob ?? "",
    pan: initialPan,
    passport_no: initialPassportNo,
    passport_expiry: initialPassportExpiry,
    passport_issued_location: details?.passport_issued_location ?? "",
    travel_insurance_no: details?.travel_insurance_no ?? "",
    insurance_company: details?.insurance_company ?? "",
    insurance_expiry: details?.insurance_expiry ?? "",
    food_preference: (details?.food_preference ?? "") as "" | "veg" | "non_veg",
    food_allergy: details?.food_allergy ?? "",
    emergency_contact_name: details?.emergency_contact_name ?? "",
    emergency_contact_no: details?.emergency_contact_no ?? "",
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
    setStatus("Guest details saved successfully.");
  }

  return (
    <form onSubmit={submit}>
      <div className="field-row">
        <label className="form-field">
          Date of Birth
          <input
            type="date"
            value={form.dob}
            onChange={(event) => set("dob", event.target.value)}
          />
        </label>
        <label className="form-field">
          PAN
          <input
            value={form.pan}
            maxLength={10}
            onChange={(event) => set("pan", event.target.value.toUpperCase())}
            placeholder="10 characters (e.g. AAADK9754A)"
          />
        </label>
      </div>

      <div className="field-row">
        <label className="form-field">
          Passport No.
          <input
            value={form.passport_no}
            maxLength={10}
            onChange={(event) => set("passport_no", event.target.value.toUpperCase())}
            placeholder="10 characters (e.g. ZA495775)"
          />
        </label>
        <label className="form-field">
          Passport Expiry Date
          <input
            type="date"
            value={form.passport_expiry}
            onChange={(event) => set("passport_expiry", event.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="form-field">
          Passport Issued Location
          <input
            value={form.passport_issued_location}
            maxLength={20}
            onChange={(event) => set("passport_issued_location", event.target.value)}
            placeholder="e.g. Bangalore"
          />
        </label>
        <label className="form-field">
          Travel Insurance No.
          <input
            value={form.travel_insurance_no}
            maxLength={20}
            onChange={(event) => set("travel_insurance_no", event.target.value)}
            placeholder="e.g. 7103167389"
          />
        </label>
      </div>

      <div className="field-row">
        <label className="form-field">
          Travel Insurance Company
          <input
            value={form.insurance_company}
            maxLength={20}
            onChange={(event) => set("insurance_company", event.target.value)}
            placeholder="e.g. TATA AIG"
          />
        </label>
        <label className="form-field">
          Travel Insurance Expiry Date
          <input
            type="date"
            value={form.insurance_expiry}
            onChange={(event) => set("insurance_expiry", event.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="form-field">
          Food Preference
          <select
            value={form.food_preference}
            onChange={(event) => set("food_preference", event.target.value)}
          >
            <option value="">No preference</option>
            <option value="veg">Veg</option>
            <option value="non_veg">Non Veg</option>
          </select>
        </label>
        <label className="form-field">
          Food Allergy
          <input
            value={form.food_allergy}
            maxLength={30}
            onChange={(event) => set("food_allergy", event.target.value)}
            placeholder="e.g. Peanuts and Milk"
          />
        </label>
      </div>

      <div className="field-row">
        <label className="form-field">
          Emergency Contact Name
          <input
            value={form.emergency_contact_name}
            maxLength={20}
            onChange={(event) => set("emergency_contact_name", event.target.value)}
            placeholder="e.g. Anita Kamath"
          />
        </label>
        <label className="form-field">
          Emergency Contact Number
          <input
            type="tel"
            value={form.emergency_contact_no}
            maxLength={10}
            onChange={(event) => set("emergency_contact_no", event.target.value.replace(/\D/g, ""))}
            placeholder="10 digits (e.g. 9019911700)"
          />
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {status && <p className="form-notice" role="status">{status}</p>}

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save Guest Details"}
      </button>
    </form>
  );
}