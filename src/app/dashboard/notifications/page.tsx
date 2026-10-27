import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import type { Notification } from "@/lib/types";
import NotificationList from "@/components/notification-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const admin = createAdminClient();

  const { data } = await admin
    .from("notifications")
    .select("id, title, body, is_read, created_at")
    .eq("user_id", profile.id)
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
          <p>Trail changes, schedule alerts and travel reminders.</p>
        </div>
      </header>
      <NotificationList notifications={notifications} />
    </div>
  );
}