import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Trip, TripMember } from "@/lib/types";
import TripList from "@/components/trip-list";

export const dynamic = "force-dynamic";

function tripStatus(trip: Trip) {
  if (trip.status !== "published" || !trip.is_active) return "closed";
  const today = new Date().toISOString().slice(0, 10);
  if (trip.start_date && trip.end_date && trip.start_date <= today && today <= trip.end_date) return "current";
  if (trip.start_date && trip.start_date > today) return "upcoming";
  return "past";
}

export default async function DashboardPage() {
  const profile = await requireProfile();

  if (profile.must_change_password) redirect("/change-password");

  const supabase = await createClient();

  // RLS already limits these to trips the user belongs to, or leads.
  const { data: memberships, error: memberError } = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", profile.id);

  if (memberError) throw memberError;

  const tripIds = [...new Set((memberships as Pick<TripMember, "trip_id">[]).map((m) => m.trip_id))];

  let trips: Trip[] = [];
  if (tripIds.length > 0) {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .in("id", tripIds)
      .order("start_date", { ascending: true });
    if (error) throw error;
    trips = (data ?? []) as Trip[];
  }

  // Leaders see their assigned trips regardless of publication status.
  if (profile.role === "leader" || profile.role === "admin") {
    const { data } = await supabase.from("trips").select("*").eq("leader_id", profile.id);
    for (const trip of (data ?? []) as Trip[]) {
      if (!trips.some((existing) => existing.id === trip.id)) trips.push(trip);
    }
  }

  const grouped = {
    current: trips.filter((trip) => tripStatus(trip) === "current"),
    upcoming: trips.filter((trip) => tripStatus(trip) === "upcoming"),
    past: trips.filter((trip) => tripStatus(trip) === "past"),
  };

  return (
    <TripList
      firstName={profile.first_name}
      role={profile.role}
      grouped={{
        current: grouped.current.map(decorate),
        upcoming: grouped.upcoming.map(decorate),
        past: grouped.past.map(decorate),
      }}
    />
  );
}

function decorate(trip: Trip) {
  return {
    id: trip.id,
    tripCode: trip.trip_code,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    status: tripStatus(trip),
    publication: trip.status,
  };
}