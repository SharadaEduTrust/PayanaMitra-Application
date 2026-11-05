"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Entry = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

function relativeTime(value: string) {
  const then = new Date(value).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationList({ notifications }: { notifications: Entry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(notifications);

  async function markRead(id: string) {
    const supabase = createClient();
    const updated = entries.map((entry) => (entry.id === id ? { ...entry, is_read: true } : entry));
    setEntries(updated);
    const newUnread = updated.filter((e) => !e.is_read).length;
    window.dispatchEvent(new CustomEvent("payana:notifications-updated", { detail: { unreadCount: newUnread } }));

    // RLS permits the user to update only their own rows.
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) {
      setEntries(notifications);
    }
    router.refresh();
  }

  async function markAllRead() {
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      setEntries((current) => current.map((e) => ({ ...e, is_read: true })));
      window.dispatchEvent(new CustomEvent("payana:notifications-updated", { detail: { unreadCount: 0 } }));
      router.refresh();
    } catch {
      // ignore
    }
  }

  if (entries.length === 0) {
    return (
      <div className="panel-empty">
        <h2 className="serif">Nothing new</h2>
        <p>Notifications from your trail coordinator will appear here.</p>
      </div>
    );
  }

  const unread = entries.filter((entry) => !entry.is_read).length;

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
        {unread > 0 ? (
          <p className="panel-note" style={{ margin: 0, fontWeight: 600 }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#e11d48", marginRight: "6px" }} />
            {unread} unread notification{unread > 1 ? "s" : ""}
          </p>
        ) : (
          <p className="panel-note" style={{ margin: 0 }}>All caught up</p>
        )}
        {unread > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={markAllRead}
            style={{ fontSize: "12px", padding: "4px 12px" }}
          >
            ✓ Mark all as read
          </button>
        )}
      </div>
      <div className="contact-list">
        {entries.map((entry) => (
          <button
            key={entry.id}
            className={`notification ${entry.is_read ? "read" : "unread"}`}
            onClick={() => !entry.is_read && markRead(entry.id)}
          >
            <span className="contact-label">{relativeTime(entry.created_at)}</span>
            <span className="contact-name">{entry.title}</span>
            {entry.body && <span className="muted small">{entry.body}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}