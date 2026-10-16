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
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, is_read: true } : entry)));

    // RLS permits the user to update only their own rows.
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) {
      setEntries(notifications);
    }
    router.refresh();
  }

  if (entries.length === 0) {
    return (
      <div className="panel-empty">
        <h2 className="serif">Nothing new</h2>
        <p>Notifications from your trip coordinator will appear here.</p>
      </div>
    );
  }

  const unread = entries.filter((entry) => !entry.is_read).length;

  return (
    <section className="panel">
      {unread > 0 && <p className="panel-note">{unread} unread</p>}
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