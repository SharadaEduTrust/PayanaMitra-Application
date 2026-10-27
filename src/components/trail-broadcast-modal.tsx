"use client";

import { useState, type FormEvent } from "react";

export default function TrailBroadcastModal({
  trip,
  isOpen,
  onClose,
}: {
  trip: {
    id: string;
    name: string;
    tripCode: string;
  };
  isOpen: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide an announcement title.");
      return;
    }

    setSending(true);
    setStatus(null);
    setError(null);

    try {
      const res = await fetch(`/api/trips/${trip.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => null);
      setSending(false);

      if (!res.ok) {
        setError(json?.error ?? "Failed to send notification to trail guests.");
        return;
      }

      const inAppCount = json.inAppCreated ?? 0;
      const pushCount = json.sent ?? 0;

      setStatus(
        `✓ Notification sent! In-app alerts: ${inAppCount} created • Push alerts: ${pushCount} delivered`
      );

      setTitle("");
      setBody("");
    } catch {
      setSending(false);
      setError("Network error while sending trail notification.");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel"
        style={{
          maxWidth: "580px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "28px 24px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          border: "1px solid var(--forest, #14352a)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span className="pill on" style={{ fontSize: "10px", textTransform: "uppercase" }}>
                Trail Leader
              </span>
              <span className="mono small muted">{trip.tripCode}</span>
            </div>
            <h2 className="serif" style={{ margin: 0, fontSize: "1.45rem", color: "var(--forest, #14352a)" }}>
              Send Notification to Guests
            </h2>
            <p className="small muted" style={{ margin: "4px 0 0" }}>
              {trip.name} • Broadcast updates to all enrolled guests.
            </p>
          </div>
          <button
            type="button"
            className="link-btn"
            onClick={onClose}
            style={{ fontSize: "18px", color: "var(--muted, #64748b)", background: "none", border: "none", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {status && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "6px",
              background: "rgba(20,53,42,0.08)",
              border: "1px solid var(--forest, #14352a)",
              color: "var(--forest, #14352a)",
              fontSize: "13px",
              marginBottom: "16px",
              lineHeight: "1.5",
            }}
          >
            <strong>{status}</strong>
          </div>
        )}

        {error && (
          <div className="form-error" style={{ marginBottom: "16px" }} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="form-field">
            Announcement Title <span className="req">*</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tomorrow's departure time updated to 7:00 AM"
              maxLength={200}
            />
          </label>

          <label className="form-field">
            Message / Details
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Provide meeting point, gear reminders, weather notice, or additional instructions..."
              maxLength={2000}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {status ? "Done" : "Cancel"}
            </button>
            <button className="btn btn-primary" type="submit" disabled={sending}>
              {sending ? "Broadcasting…" : "Send Notification"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
