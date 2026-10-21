"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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

  // Itinerary CSV import state
  const [showItineraryImport, setShowItineraryImport] = useState(false);
  const [itineraryImporting, setItineraryImporting] = useState(false);
  const [itineraryReport, setItineraryReport] = useState<string | null>(null);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState("");

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

  async function removeDay(index: number) {
    const day = rows[index];
    if (!day) return;
    if (day.id) {
      if (!window.confirm(`Are you sure you want to delete Day ${day.dayNumber}?`)) return;
      try {
        const res = await fetch(`/api/admin/trips/${trip.id}/days/${day.id}`, { method: "DELETE" });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          setError(json?.error ?? "Failed to delete day.");
          return;
        }
        setStatus(`Day ${day.dayNumber} deleted.`);
      } catch {
        setError("Network error while deleting day.");
        return;
      }
    }
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

    try {
      const res = await fetch(`/api/admin/trips/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          destination: form.destination?.trim() || null,
          start_date: form.startDate || null,
          end_date: form.endDate || null,
          leader_id: form.leaderId || null,
          status: form.status,
          is_active: form.isActive,
          remarks: form.remarks?.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      setSaving(false);

      if (!res.ok) {
        if (json?.fieldErrors) {
          const firstErr = Object.values(json.fieldErrors).flat()[0];
          setError(String(firstErr || json.error || "Failed to update trail."));
        } else {
          setError(json?.error ?? "Failed to update trail.");
        }
        return;
      }

      setStatus("Trail saved.");
      router.refresh();
    } catch {
      setSaving(false);
      setError("Network error while saving trail.");
    }
  }

  async function saveDay(day: EditableDay) {
    setError("");
    setStatus("");

    try {
      const formatTime = (t: string) => {
        if (!t) return null;
        return t.length === 5 ? `${t}:00` : t;
      };

      const validActivities = day.activities
        .filter((a) => a.title.trim())
        .map((a, idx) => ({
          id: a.id,
          title: a.title.trim(),
          description: a.description?.trim() || null,
          start_time: formatTime(a.startTime),
          end_time: formatTime(a.endTime),
          activity_order: idx + 1,
        }));

      let dayId = day.id;

      if (!dayId) {
        // Create new day with nested activities
        const res = await fetch(`/api/admin/trips/${trip.id}/days`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day_number: day.dayNumber,
            destination: day.destination?.trim() || null,
            itinerary_text: day.itineraryText?.trim() || null,
            hotel_name: day.hotelName?.trim() || null,
            activities: validActivities.map(({ id: _ignored, ...act }) => act),
          }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setError(json?.error ?? "Failed to create itinerary day.");
          return;
        }

        dayId = json.data.id;
        const savedActs = (json.data.activities ?? []).map((sa: { id: string; title: string; description?: string; start_time?: string; end_time?: string }) => ({
          id: sa.id,
          title: sa.title,
          description: sa.description ?? "",
          startTime: (sa.start_time ?? "").slice(0, 5),
          endTime: (sa.end_time ?? "").slice(0, 5),
        }));

        setRows((current) =>
          current.map((row) => (row === day ? { ...row, id: dayId, activities: savedActs.length > 0 ? savedActs : row.activities } : row)),
        );
      } else {
        // Update existing day
        const dayRes = await fetch(`/api/admin/trips/${trip.id}/days/${dayId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day_number: day.dayNumber,
            destination: day.destination?.trim() || null,
            itinerary_text: day.itineraryText?.trim() || null,
            hotel_name: day.hotelName?.trim() || null,
          }),
        });

        if (!dayRes.ok) {
          const json = await dayRes.json().catch(() => null);
          setError(json?.error ?? "Failed to update day details.");
          return;
        }

        // Fetch existing activities on server to synchronize
        const actsRes = await fetch(`/api/admin/trips/${trip.id}/days/${dayId}/activities`);
        const existingActsJson = await actsRes.json().catch(() => ({ data: [] }));
        const serverActs: { id: string }[] = existingActsJson.data ?? [];

        // Delete activities no longer in rows
        const keepIds = new Set(validActivities.map((a) => a.id).filter(Boolean));
        for (const sa of serverActs) {
          if (!keepIds.has(sa.id)) {
            await fetch(`/api/admin/trips/${trip.id}/days/${dayId}/activities/${sa.id}`, { method: "DELETE" });
          }
        }

        // Create or update current activities
        const updatedActivities: typeof validActivities = [];
        for (const act of validActivities) {
          if (act.id) {
            await fetch(`/api/admin/trips/${trip.id}/days/${dayId}/activities/${act.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: act.title,
                description: act.description,
                start_time: act.start_time,
                end_time: act.end_time,
                activity_order: act.activity_order,
              }),
            });
            updatedActivities.push(act);
          } else {
            const createRes = await fetch(`/api/admin/trips/${trip.id}/days/${dayId}/activities`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: act.title,
                description: act.description,
                start_time: act.start_time,
                end_time: act.end_time,
                activity_order: act.activity_order,
              }),
            });
            const createdJson = await createRes.json().catch(() => null);
            updatedActivities.push({
              ...act,
              id: createdJson?.data?.id ?? "",
            });
          }
        }

        setRows((current) =>
          current.map((row) =>
            row === day
              ? {
                  ...row,
                  activities: updatedActivities.map((ua) => ({
                    id: ua.id,
                    title: ua.title,
                    description: ua.description ?? "",
                    startTime: (ua.start_time ?? "").slice(0, 5),
                    endTime: (ua.end_time ?? "").slice(0, 5),
                  })),
                }
              : row,
          ),
        );
      }

      setStatus(`Day ${day.dayNumber} saved.`);
      router.refresh();
    } catch {
      setError("Network error while saving day.");
    }
  }

  async function duplicateTrip() {
    const newCode = window.prompt("New trail code (must be unique):", `${form.tripCode}-COPY`);
    if (!newCode || !newCode.trim()) return;
    const newName = window.prompt("New trail name:", form.name);
    if (!newName || !newName.trim()) return;

    setError("");
    setStatus("");

    try {
      const response = await fetch(`/api/admin/trips/${trip.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_trip_code: newCode.trim(),
          new_name: newName.trim(),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (data?.fieldErrors) {
          const firstErr = Object.values(data.fieldErrors).flat()[0];
          setError(String(firstErr || data?.error || "Could not duplicate the trail."));
        } else {
          setError(data?.error ?? "Could not duplicate the trail.");
        }
        return;
      }

      const newTripId = data.data?.id;
      if (newTripId) {
        router.push(`/admin/trips/${newTripId}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error while duplicating trail.");
    }
  }

  async function handleItineraryCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setItineraryImporting(true);
    setItineraryReport(null);
    setError("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`/api/admin/trips/${trip.id}/itinerary/import`, {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setItineraryImporting(false);

      if (!res.ok) {
        setError(json?.error ?? "Failed to import itinerary CSV.");
        return;
      }

      setItineraryReport(`Imported: ${json.days_upserted} days upserted, ${json.activities_inserted} activities created.`);
      setStatus("Itinerary CSV successfully imported.");
      router.refresh();
    } catch {
      setItineraryImporting(false);
      setError("Network error while importing itinerary CSV.");
    }
  }

  async function sendBroadcast(e: FormEvent) {
    e.preventDefault();
    if (!broadcastTitle.trim()) {
      setError("Broadcast title is required.");
      return;
    }

    setBroadcasting(true);
    setBroadcastStatus("");
    setError("");

    try {
      const res = await fetch("/api/admin/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: trip.id,
          title: broadcastTitle.trim(),
          body: broadcastBody.trim() || undefined,
          sendWhatsapp,
        }),
      });

      const json = await res.json().catch(() => null);
      setBroadcasting(false);

      if (!res.ok) {
        setError(json?.error ?? "Failed to send broadcast.");
        return;
      }

      setBroadcastStatus(
        `Broadcast sent! Push notifications: ${json.sent} sent (${json.failed} failed). In-app: ${json.inAppCreated ?? 0}.` +
          (sendWhatsapp ? ` WhatsApp: ${json.whatsappSent ?? 0} sent (${json.whatsappFailed ?? 0} failed).` : "")
      );
      setBroadcastTitle("");
      setBroadcastBody("");
    } catch {
      setBroadcasting(false);
      setError("Network error while sending broadcast.");
    }
  }

  return (
    <>
      <form className="admin-card" onSubmit={saveTrip}>
        <div className="admin-card-head">
          <h2 className="serif">Trail details</h2>
          <button type="button" className="btn btn-secondary" onClick={duplicateTrip}>
            Duplicate
          </button>
        </div>

        <div className="field-row">
          <label className="form-field">
            Trail Id
            <input required value={form.tripCode} onChange={(e) => set("tripCode", e.target.value)} placeholder="003 or PM-2026-HAM-01" />
          </label>
          <label className="form-field">
            Trail Name
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
        </div>

        <div className="field-row">
          <label className="form-field">
            Destination
            <input value={form.destination} onChange={(e) => set("destination", e.target.value)} />
          </label>
          <label className="form-field">
            Status / Visibility
            <select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="draft">Draft — hidden from guests</option>
              <option value="published">Published — visible to members</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="form-field">
            Start Date
            <input type="date" value={form.startDate ?? ""} onChange={(e) => set("startDate", e.target.value)} />
          </label>
          <label className="form-field">
            End Date
            <input type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} />
          </label>
        </div>

        <label className="form-field">
          Leader
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
          Remarks
          <textarea rows={3} value={form.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} />
        </label>

        <label className="form-field" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          Active / Inactive (Trail is active)
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        {status && <p className="form-notice" role="status">{status}</p>}

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save trail"}
        </button>
      </form>

      <section className="admin-card">
        <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "8px" }}>
          <h2 className="serif">Itinerary</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowItineraryImport(!showItineraryImport)}
            >
              {showItineraryImport ? "Close Import" : "Import CSV"}
            </button>
            <button type="button" className="btn btn-primary" onClick={addDay}>
              Add day
            </button>
          </div>
        </div>

        {showItineraryImport && (
          <div style={{ margin: "16px 0", padding: "16px", background: "var(--color-surface, #1e293b)", borderRadius: "8px", border: "1px dashed var(--color-border, #334155)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 className="serif" style={{ margin: 0, fontSize: "1.1rem" }}>Bulk Import Days & Activities</h3>
              <a
                href={`/api/admin/trips/${trip.id}/itinerary/import`}
                download="itinerary_template.csv"
                className="link-btn"
              >
                Download CSV Template
              </a>
            </div>
            <p className="admin-hint">
              Upload a UTF-8 CSV containing columns: <code>Trail Id</code>, <code>Trail Name</code>, <code>Day</code>, <code>Destination</code>, <code>Itinerary</code>, <code>Hotel Name</code> (and optional activities).
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleItineraryCsv}
              disabled={itineraryImporting}
              style={{ marginTop: "8px" }}
            />
            {itineraryImporting && <p className="muted small" style={{ marginTop: "8px" }}>Importing itinerary days & activities…</p>}
            {itineraryReport && (
              <p className="form-notice" role="status" style={{ marginTop: "10px" }}>{itineraryReport}</p>
            )}
          </div>
        )}

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
                  Day
                  <input
                    type="number"
                    min={1}
                    value={day.dayNumber}
                    onChange={(e) => setDay(dayIndex, "dayNumber", Number(e.target.value))}
                  />
                </label>
                <label className="form-field">
                  Destination
                  <input value={day.destination} onChange={(e) => setDay(dayIndex, "destination", e.target.value)} />
                </label>
              </div>

              <label className="form-field">
                Hotel Name
                <input value={day.hotelName} onChange={(e) => setDay(dayIndex, "hotelName", e.target.value)} />
              </label>

              <label className="form-field">
                Itinerary
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
 
      <section className="admin-card">
        <h2 className="serif">Broadcast to Trail Members</h2>
        <p className="admin-hint">
          Send an announcement to all guests enrolled in this trail via in-app alerts, Web Push,
          and optionally direct WhatsApp message.
        </p>

        <form onSubmit={sendBroadcast}>
          <label className="form-field">
            Announcement Title
            <input
              required
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="e.g. Tomorrow's departure time updated to 7:00 AM"
            />
          </label>

          <label className="form-field">
            Message
            <textarea
              rows={3}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Provide any additional details or instructions for guests..."
            />
          </label>

          <label className="form-field" style={{ display: "flex", gap: "10px", alignItems: "center", margin: "12px 0" }}>
            <input
              type="checkbox"
              checked={sendWhatsapp}
              onChange={(e) => setSendWhatsapp(e.target.checked)}
            />
            <span>Also send as WhatsApp message to all members</span>
          </label>

          {broadcastStatus && <p className="form-notice" role="status">{broadcastStatus}</p>}

          <button className="btn btn-primary" type="submit" disabled={broadcasting}>
            {broadcasting ? "Broadcasting…" : "Send broadcast"}
          </button>
        </form>
      </section>
    </>
  );
}