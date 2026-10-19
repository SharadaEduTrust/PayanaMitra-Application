"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function NotificationComposer({ travellers }: { travellers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [recipients, setRecipients] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (recipients.length === 0) {
      setError("Choose at least one guest.");
      return;
    }
    if (!title.trim()) {
      setError("Give the notification a title.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients,
          title: title.trim(),
          body: body.trim() || null,
        }),
      });

      const data = await response.json().catch(() => null);
      setLoading(false);

      if (!response.ok) {
        setError(data?.error ?? "Could not send notification.");
        return;
      }

      setStatus(`Sent to ${recipients.length} guest${recipients.length > 1 ? "s" : ""}.`);
      setTitle("");
      setBody("");
      setRecipients([]);
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error while sending notification.");
    }
  }

  function toggle(id: string) {
    setRecipients((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <section className="admin-card">
      <h2 className="serif">Send a notification</h2>
      <p className="admin-hint">Guests see these in their notifications list.</p>

      <form onSubmit={send}>
        <div className="form-field">
          <span className="form-label">Recipients ({recipients.length} selected)</span>
          <div className="recipient-grid">
            {travellers.length === 0 ? (
              <p className="panel-note">No guests yet.</p>
            ) : (
              travellers.map((traveller) => (
                <label className="recipient" key={traveller.id}>
                  <input
                    type="checkbox"
                    checked={recipients.includes(traveller.id)}
                    onChange={() => toggle(traveller.id)}
                  />
                  <span>{traveller.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <label className="form-field">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Trail schedule changed" />
        </label>

        <label className="form-field">
          Message
          <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        {status && <p className="form-notice" role="status">{status}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send notification"}
        </button>
      </form>
    </section>
  );
}