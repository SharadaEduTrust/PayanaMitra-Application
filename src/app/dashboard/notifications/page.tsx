import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Notification } from "@/lib/types";
import NotificationList from "@/components/notification-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireProfile();
  const supabase = await createClient();

  // RLS allows a user to read only their own notifications.
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const notifications = (data ?? []) as Pick<
    Notification,
    "id" | "title" | "body" | "is_read" | "created_at"
  >[];

  return (
    <div className="trip-detail">
      <header className="page-head">
        <div>
          <div className="eyebrow">Notifications</div>
          <h1 className="serif">Updates from your coordinator</h1>
          <p>Trip changes, schedule alerts and travel reminders.</p>
        </div>
      </header>
      <NotificationList notifications={notifications} />
    </div>
  );
}