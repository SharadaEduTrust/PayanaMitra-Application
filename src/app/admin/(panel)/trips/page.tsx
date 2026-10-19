import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Trip, TrailLeaderView } from "@/lib/types";
import TripListAdmin from "@/components/trip-list-admin";

export const dynamic = "force-dynamic";

export default async function AdminTripsPage() {
  await requireProfile(["admin"]);
  const supabase = await createClient();

  // trail_leader_view joins each trip to its leader; RLS is security_invoker so
  // it only returns rows this admin may see.
  const { data } = await supabase
    .from("trail_leader_view")
    .select("*")
    .order("start_date", { ascending: false });

  const rows = (data ?? []) as TrailLeaderView[];

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Trips</h1>
          <small>Create, publish and manage itineraries.</small>
        </div>
        <Link className="btn btn-primary" href="/admin/trips/new">
          New trip
        </Link>
      </header>
      <div className="admin-body">
        <TripListAdmin trips={rows} />
      </div>
    </>
  );
}