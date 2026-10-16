"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      setError("Choose at least one traveller.");
      return;
    }
    if (!title.trim()) {
      setError("Give the notification a title.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const rows = recipients.map((userId) => ({
      user_id: userId,
      title: title.trim(),
      body: body.trim() || null,
    }));

    const { error: insertError } = await supabase.from("notifications").insert(rows);
    setLoading(false);

    if (insertError) {
      setError(
        insertError.message.includes("row-level security")
          ? "Only admins can create notifications."
          : insertError.message,
      );
      return;
    }

    setStatus(`Sent to ${recipients.length} traveller${recipients.length > 1 ? "s" : ""}.`);
    setTitle("");
    setBody("");
    setRecipients([]);
    router.refresh();
  }

  function toggle(id: string) {
    setRecipients((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <section className="admin-card">
      <h2 className="serif">Send a notification</h2>
      <p className="admin-hint">Travellers see these in their notifications list.</p>

      <form onSubmit={send}>
        <div className="form-field">
          <span className="form-label">Recipients ({recipients.length} selected)</span>
          <div className="recipient-grid">
            {travellers.length === 0 ? (
              <p className="panel-note">No travellers yet.</p>
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Trip schedule changed" />
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