import Link from "next/link";
import Brand from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import DashboardNav from "@/components/dashboard-nav";
import MobileNav from "@/components/mobile-nav";
import LogoutButton from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);

  const unreadCount = count ?? 0;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <Brand size={38} tone="light" />
        <DashboardNav role={profile.role} unreadCount={unreadCount} />
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
        <MobileNav title="Menu" redirectTo="/login" />
        {children}
      </section>
    </div>
  );
}
