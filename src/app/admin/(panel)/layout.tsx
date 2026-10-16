import Link from "next/link";
import Brand from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import AdminNav from "@/components/admin-nav";
import type { Notification, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile(["admin"]);
  const supabase = await createClient();

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  return (
    <div className="admin">
      <aside className="admin-side">
        <Link href="/admin" className="brand brand-light">
          <img
            className="brand-badge"
            src="/brand/payana-trails-badge.png"
            alt="Payana Trails"
            width={36}
            height={36}
            style={{ width: 36, height: 36 }}
          />
          <span className="brand-word">payana</span>
        </Link>
        <div className="side-label">Manage</div>
        <AdminNav
          links={[
            { href: "/admin", label: "Overview" },
            { href: "/admin/users", label: "Travellers" },
            { href: "/admin/trips", label: "Trips" },
            { href: "/admin/destinations", label: "Destinations" },
            { href: "/admin/notifications", label: `Notifications${count ? ` (${count})` : ""}` },
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
            View as traveller
          </Link>
        </div>
      </aside>
      <section className="admin-main">{children}</section>
    </div>
  );
}