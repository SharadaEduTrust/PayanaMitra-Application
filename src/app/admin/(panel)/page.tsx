import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import LogoutButton from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const admin = await requireProfile(["admin"]);
  const supabase = await createClient();

  const [{ count: travellers }, { count: trips }, { count: published }, { count: unread }] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "traveller"),
      supabase.from("trips").select("id", { count: "exact", head: true }),
      supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
    ]);

  const stats = [
    { label: "Guests", value: travellers ?? 0, href: "/admin/users" },
    { label: "Trails", value: trips ?? 0, href: "/admin/trips" },
    { label: "Published trails", value: published ?? 0, href: "/admin/trips" },
    { label: "Unread notifications", value: unread ?? 0, href: "/admin/notifications" },
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Overview</h1>
          <small>Signed in as {admin.first_name} {admin.last_name}</small>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <LogoutButton
            redirectTo="/login"
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
          />
        </div>
      </header>
      <div className="admin-body">
        <div className="admin-stats">
          {stats.map((stat) => (
            <Link className="stat" key={stat.label} href={stat.href}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </Link>
          ))}
        </div>

        <section className="admin-card">
          <h2 className="serif">Getting started</h2>
          <ol className="admin-steps">
            <li>Create guest accounts in <Link href="/admin/users">Guests</Link> or bulk upload via <Link href="/admin/import?tab=guests">CSV Import</Link>.</li>
            <li>Create a trail in <Link href="/admin/trips">Trails</Link> or bulk import via <Link href="/admin/import?tab=trails">CSV Import</Link>.</li>
            <li>Add day plans and activities to the itinerary.</li>
            <li>Add the guests to the trail.</li>
            <li>Set the trail status to <strong>published</strong> so guests can see it.</li>
          </ol>
        </section>
      </div>
    </>
  );
}