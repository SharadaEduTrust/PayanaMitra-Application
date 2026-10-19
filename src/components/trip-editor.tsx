"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export type EditableDay = {
  id: string;
  dayNumber: number;
  destination: string;
  itineraryText: string;
  hotelName: string;
  activities: {
    id?: string;
    title: string;
    description: string;
    startTime: string;
    endTime: string;
  }[];
};

export default function TripEditor({
  trip,
  days,
  leaders,
}: {
  trip: {
    id: string;
    tripCode: string;
    name: string;
    destination: string;
    startDate: string;
    endDate: string;
    status: "draft" | "published" | "archived";
    isActive: boolean;
    remarks: string;
    leaderId: string;
  };
  days: EditableDay[];
  leaders: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(trip);
  const [rows, setRows] = useState<EditableDay[]>(days);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setDay(index: number, key: keyof Omit<EditableDay, "id" | "activities">, value: string | number) {
    setRows((current) => current.map((day, i) => (i === index ? { ...day, [key]: value } : day)));
  }

  function addDay() {
    setRows((current) => [
      ...current,
      {
        id: "",
        dayNumber: current.length + 1,
        destination: "",
        itineraryText: "",
        hotelName: "",
        activities: [],
      },
    ]);
  }

  function removeDay(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function addActivity(dayIndex: number) {
    setRows((current) =>
      current.map((day, i) =>
        i === dayIndex
          ? { ...day, activities: [...day.activities, { title: "", description: "", startTime: "", endTime: "" }] }
          : day,
      ),
    );
  }

  function setActivity(dayIndex: number, activityIndex: number, key: string, value: string) {
    setRows((current) =>
      current.map((day, i) =>
        i === dayIndex
          ? {
              ...day,
              activities: day.activities.map((activity, j) =>
                j === activityIndex ? { ...activity, [key]: value } : activity,
              ),
            }
          : day,
      ),
    );
  }

  function removeActivity(dayIndex: number, activityIndex: number) {
    setRows((current) =>
      current.map((day, i) =>
        i === dayIndex
          ? { ...day, activities: day.activities.filter((_, j) => j !== activityIndex) }
          : day,
      ),
    );
  }

  async function saveTrip(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("trips")
      .update({
        trip_code: form.tripCode,
        name: form.name,
        destination: form.destination || null,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        leader_id: form.leaderId || null,
        status: form.status,
        is_active: form.isActive,
        remarks: form.remarks || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", form.id);

    setSaving(false);

    if (updateError) {
      setError(
        updateError.message.includes("row-level security")
          ? "Only admins can edit trips."
          : updateError.message,
      );
      return;
    }

    setStatus("Trip saved.");
    router.refresh();
  }

  async function saveDay(day: EditableDay) {
    const supabase = createClient();

    const payload = {
      trip_id: trip.id,
      day_number: day.dayNumber,
      destination: day.destination || null,
      itinerary_text: day.itineraryText || null,
      hotel_name: day.hotelName || null,
    };

    let dayId = day.id;
    if (dayId) {
      const { error } = await supabase.from("itinerary_days").update(payload).eq("id", dayId);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from("itinerary_days").insert(payload).select("id").single();
      if (error) {
        setError(error.message);
        return;
      }
      dayId = data.id as string;
      setRows((current) => current.map((row) => (row === day ? { ...row, id: dayId } : row)));
    }

    // Activities are replaced wholesale for the day, which keeps ordering simple.
    await supabase.from("activities").delete().eq("itinerary_day_id", dayId);
    if (day.activities.length > 0) {
      const { error } = await supabase.from("activities").insert(
        day.activities.map((activity, index) => ({
          itinerary_day_id: dayId,
          title: activity.title,
          description: activity.description || null,
          start_time: activity.startTime || null,
          end_time: activity.endTime || null,
          activity_order: index + 1,
        })),
      );
      if (error) {
        setError(error.message);
        return;
      }
    }

    setStatus(`Day ${day.dayNumber} saved.`);
    router.refresh();
  }

  async function duplicateTrip() {
    const startDate = window.prompt("New trip code (must be unique):", `${form.tripCode}-COPY`);
    if (!startDate) return;
    const newName = window.prompt("New trip name:", form.name);
    if (!newName) return;

    const response = await fetch("/api/admin/copy-trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTripId: trip.id, newTripCode: startDate, newName }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not duplicate the trip.");
      return;
    }

    const data = await response.json();
    window.location.href = `/admin/trips/${data.tripId}`;
  }

  return (
    <>
      <form className="admin-card" onSubmit={saveTrip}>
        <div className="admin-card-head">
          <h2 className="serif">Trip details</h2>
          <button type="button" className="btn btn-secondary" onClick={duplicateTrip}>
            Duplicate
          </button>
        </div>

        <div className="field-row">
          <label className="form-field">
            Trip code
            <input required value={form.tripCode} onChange={(e) => set("tripCode", e.target.value)} placeholder="PM-2026-HAM-01" />
          </label>
          <label className="form-field">
            Trip name
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
        </div>

        <div className="field-row">
          <label className="form-field">
            Destination
            <input value={form.destination} onChange={(e) => set("destination", e.target.value)} />
          </label>
          <label className="form-field">
            Status
            <select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="draft">Draft — hidden from travellers</option>
              <option value="published">Published — visible to members</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="form-field">
            Start date
            <input type="date" value={form.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} />
          </label>
          <label className="form-field">
            End date
            <input type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} />
          </label>
        </div>

        <label className="form-field">
          Trail leader
          <select value={form.leaderId ?? ""} onChange={(e) => set("leaderId", e.target.value)}>
            <option value="">No leader assigned</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          Remarks shown to travellers
          <textarea rows={3} value={form.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} />
        </label>

        <label className="form-field" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          Trip is active
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        {status && <p className="form-notice" role="status">{status}</p>}

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save trip"}
        </button>
      </form>

      <section className="admin-card">
        <div className="admin-card-head">
          <h2 className="serif">Itinerary</h2>
          <button type="button" className="btn btn-secondary" onClick={addDay}>
            Add day
          </button>
        </div>

        {rows.length === 0 && <p className="panel-note">No days yet. Add the first day.</p>}

        <div className="days">
          {rows.map((day, dayIndex) => (
            <article className="day" key={day.id || `new-${dayIndex}`}>
              <div className="day-head">
                <span className="day-number">Day {day.dayNumber}</span>
                <div>
                  <h3>Day details</h3>
                </div>
              </div>

              <div className="field-row">
                <label className="form-field">
                  Day number
                  <input
                    type="number"
                    min={1}
                    value={day.dayNumber}
                    onChange={(e) => setDay(dayIndex, "dayNumber", Number(e.target.value))}
                  />
                </label>
                <label className="form-field">
                  Place for the day
                  <input value={day.destination} onChange={(e) => setDay(dayIndex, "destination", e.target.value)} />
                </label>
              </div>

              <label className="form-field">
                Hotel name
                <input value={day.hotelName} onChange={(e) => setDay(dayIndex, "hotelName", e.target.value)} />
              </label>

              <label className="form-field">
                Day plan
                <textarea
                  rows={3}
                  value={day.itineraryText}
                  onChange={(e) => setDay(dayIndex, "itineraryText", e.target.value)}
                />
              </label>

              <div className="admin-subhead">
                <span>Activities</span>
                <button type="button" className="link-btn" onClick={() => addActivity(dayIndex)}>
                  + Add activity
                </button>
              </div>

              {day.activities.map((activity, activityIndex) => (
                <div className="activity-row" key={activity.id ?? `new-activity-${activityIndex}`}>
                  <input
                    placeholder="Start"
                    type="time"
                    value={activity.startTime ?? ""}
                    onChange={(e) => setActivity(dayIndex, activityIndex, "startTime", e.target.value)}
                  />
                  <input
                    placeholder="End"
                    type="time"
                    value={activity.endTime ?? ""}
                    onChange={(e) => setActivity(dayIndex, activityIndex, "endTime", e.target.value)}
                  />
                  <input
                    placeholder="Title"
                    value={activity.title}
                    onChange={(e) => setActivity(dayIndex, activityIndex, "title", e.target.value)}
                  />
                  <input
                    placeholder="Description"
                    value={activity.description ?? ""}
                    onChange={(e) => setActivity(dayIndex, activityIndex, "description", e.target.value)}
                  />
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => removeActivity(dayIndex, activityIndex)}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div className="day-actions">
                <button type="button" className="btn btn-primary" onClick={() => saveDay(day)}>
                  Save day {day.dayNumber}
                </button>
                <button type="button" className="link-btn" onClick={() => removeDay(dayIndex)}>
                  Remove this day
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}