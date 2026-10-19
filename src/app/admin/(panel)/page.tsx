import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

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
    { label: "Travellers", value: travellers ?? 0, href: "/admin/users" },
    { label: "Trips", value: trips ?? 0, href: "/admin/trips" },
    { label: "Published", value: published ?? 0, href: "/admin/trips" },
    { label: "Unread notifications", value: unread ?? 0, href: "/admin/notifications" },
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Overview</h1>
          <small>Signed in as {admin.first_name} {admin.last_name}</small>
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
            <li>Create traveller accounts in <Link href="/admin/users">Travellers</Link>.</li>
            <li>Create a trip in <Link href="/admin/trips">Trips</Link> and give it a unique code.</li>
            <li>Add day plans and activities to the itinerary.</li>
            <li>Add the travellers as members.</li>
            <li>Set the trip status to <strong>published</strong> so members can see it.</li>
          </ol>
        </section>
      </div>
    </>
  );
}