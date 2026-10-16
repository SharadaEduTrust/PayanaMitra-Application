import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Notification } from "@/lib/types";
import NotificationComposer from "@/components/notification-composer";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await requireProfile(["admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: travellers } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, phone")
    .eq("role", "traveller")
    .order("first_name");

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Notifications</h1>
          <small>Send updates to travellers.</small>
        </div>
      </header>
      <div className="admin-body">
        <NotificationComposer
          travellers={((travellers ?? []) as { id: string; first_name: string; last_name: string; phone: string }[]).map(
            (traveller) => ({
              id: traveller.id,
              name: `${traveller.first_name} ${traveller.last_name}`,
            }),
          )}
        />

        <section className="admin-card">
          <h2 className="serif">Recent</h2>
          {(!data || data.length === 0) ? (
            <p className="panel-note">Nothing sent yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {(data as Pick<Notification, "id" | "title" | "body" | "is_read" | "created_at">[]).map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.title}</td>
                    <td className="muted small">{entry.body ?? "—"}</td>
                    <td>
                      <span className={`pill ${entry.is_read ? "on" : "off"}`}>
                        {entry.is_read ? "Read" : "Unread"}
                      </span>
                    </td>
                    <td>{new Date(entry.created_at).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}