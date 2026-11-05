import Link from "next/link";
import Brand from "@/components/brand";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import DashboardNav from "@/components/dashboard-nav";
import MobileNav from "@/components/mobile-nav";
import LogoutButton from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const admin = createAdminClient();

  const { count: unreadCount } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);

  const unread = unreadCount ?? 0;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand size={68} tone="light" />
        <DashboardNav role={profile.role} initialUnreadCount={unread} />
        <div className="side-bottom">
          <Link className="side-user" href="/dashboard/profile">
            {profile.avatar_url ? (
              // Supabase serves the bucket over plain img; next/image would add
              // a proxy hop for no benefit here.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar-initials avatar-photo" src={profile.avatar_url} alt="" />
            ) : (
              <span className="avatar-initials">
                {profile.first_name.charAt(0)}
                {profile.last_name.charAt(0)}
              </span>
            )}
            <p>
              {profile.first_name} {profile.last_name}
              <span className="side-phone mono">{profile.phone}</span>
            </p>
          </Link>
          <LogoutButton redirectTo="/login" />
        </div>
      </aside>
      <section className="main">
        <MobileNav title="Menu" redirectTo="/login" unreadCount={unread} />
        {children}
      </section>
    </div>
  );
}
