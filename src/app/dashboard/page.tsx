import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import type { Trip, TripMember } from "@/lib/types";
import TripList from "@/components/trip-list";
import { calculateFeedbackStatus } from "@/lib/feedback";

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
  const admin = createAdminClient();

  const { data: memberships, error: memberError } = await admin
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", profile.id);

  if (memberError) throw memberError;

  const tripIds = [...new Set(((memberships ?? []) as Pick<TripMember, "trip_id">[]).map((m) => m.trip_id))];

  let trips: Trip[] = [];
  if (tripIds.length > 0) {
    const { data, error } = await admin
      .from("trips")
      .select("*")
      .in("id", tripIds)
      .order("start_date", { ascending: true });
    if (error) throw error;
    trips = (data ?? []) as Trip[];
  }

  // Leaders see their assigned trips regardless of publication status.
  if (profile.role === "leader" || profile.role === "admin") {
    const { data } = await admin.from("trips").select("*").eq("leader_id", profile.id);
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
  const fbStatus = calculateFeedbackStatus(trip);
  return {
    id: trip.id,
    tripCode: trip.trip_code,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    status: tripStatus(trip),
    publication: trip.status,
    feedbackState: fbStatus.state,
    feedbackClosesOn: fbStatus.closesOnDate,
    feedbackDaysRemaining: fbStatus.daysRemaining,
    feedbackFormUrl: fbStatus.formUrl,
  };
}