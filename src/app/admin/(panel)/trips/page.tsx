import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Trip, TrailLeaderView } from "@/lib/types";
import TripListAdmin from "@/components/trip-list-admin";

export const dynamic = "force-dynamic";

export default async function AdminTripsPage() {
  await requireProfile(["admin"]);
  const supabase = await createClient();

  // Query trips with destination and is_active, joined with leader profiles
  const { data: tripsData } = await supabase
    .from("trips")
    .select("id, trip_code, name, destination, start_date, end_date, status, is_active, leader_id, leader:profiles!leader_id(id, first_name, last_name, phone, email)")
    .order("start_date", { ascending: false });

  let rows: TrailLeaderView[] = [];

  if (tripsData && tripsData.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows = tripsData.map((t: any) => ({
      trip_id: t.id,
      trip_code: t.trip_code,
      trip_name: t.name,
      destination: t.destination ?? null,
      start_date: t.start_date,
      end_date: t.end_date,
      status: t.status,
      is_active: t.is_active ?? true,
      leader_id: t.leader_id,
      leader_first_name: t.leader?.first_name ?? null,
      leader_last_name: t.leader?.last_name ?? null,
      leader_phone: t.leader?.phone ?? null,
      leader_email: t.leader?.email ?? null,
    }));
  } else {
    // Fallback to trail_leader_view
    const { data: viewData } = await supabase
      .from("trail_leader_view")
      .select("*")
      .order("start_date", { ascending: false });
    rows = (viewData ?? []) as TrailLeaderView[];
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Trails</h1>
          <small>Create, publish and manage itineraries.</small>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <Link className="admin-control admin-control-btn admin-control-btn-secondary" href="/admin/import?tab=mapping">
            Map Guests (CSV)
          </Link>
          <Link className="admin-control admin-control-btn admin-control-btn-secondary" href="/admin/import?tab=trails">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import Trails CSV
          </Link>
          <Link className="admin-control admin-control-btn admin-control-btn-primary" href="/admin/trips/new">
            + New Trail
          </Link>
        </div>
      </header>
      <div className="admin-body">
        <TripListAdmin trips={rows} />
      </div>
    </>
  );
}