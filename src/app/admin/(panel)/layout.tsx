import Link from "next/link";
import Brand from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import AdminNav from "@/components/admin-nav";
import MobileNav from "@/components/mobile-nav";
import LogoutButton from "@/components/logout-button";
import type { Notification, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const [profile, { count }] = await Promise.all([
    requireProfile(["admin"]),
    (async () => {
      const supabase = await createClient();
      return supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
    })(),
  ]);

  return (
    <div className="admin admin-layout">
      <aside className="admin-side">
        <Brand size={36} tone="light" href="/admin" />
        <div className="side-label">Manage</div>
        <AdminNav
          links={[
            { href: "/admin", label: "Overview" },
            { href: "/admin/users", label: "Guests" },
            { href: "/admin/trips", label: "Trails" },
            { href: "/admin/destinations", label: "Destinations" },
            { href: "/admin/import", label: "CSV Import" },
            { href: "/admin/notifications", label: `Notifications${count ? ` (${count})` : ""}` },
            { href: "/admin/audit-log", label: "Audit log" },
          ]}
        />
        <div className="side-bottom">
          <div className="side-user">
            <span className="avatar-initials">
              {profile.first_name.charAt(0)}
              {profile.last_name.charAt(0)}
            </span>
            <p>
              {profile.first_name} {profile.last_name}
              <span className="side-phone">Administrator</span>
            </p>
          </div>
          <Link className="side-link" href="/dashboard">
            View as guest
          </Link>
          <LogoutButton redirectTo="/login" />
        </div>
      </aside>
      <section className="admin-main">
        <MobileNav title="Admin Menu" redirectTo="/login" />
        {children}
      </section>
    </div>
  );
}