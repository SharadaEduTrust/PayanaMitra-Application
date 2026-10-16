import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Activity, ItineraryDay, Trip, TripContact } from "@/lib/types";
import TripDetailView from "@/components/trip-detail-view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function TripPage({ params }: Params) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS blocks this query entirely if the user is not a member or leader.
  const { data: tripData } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  const trip = tripData as Trip | null;
  if (!trip) notFound();

  const [{ data: dayRows }, { data: contactRows }] = await Promise.all([
    supabase.from("itinerary_days").select("*").eq("trip_id", id).order("day_number"),
    supabase.from("trip_contacts").select("*").eq("trip_id", id).order("name"),
  ]);

  const days = (dayRows ?? []) as ItineraryDay[];
  const dayIds = days.map((day) => day.id);

  let activities: Activity[] = [];
  if (dayIds.length > 0) {
    const { data } = await supabase
      .from("activities")
      .select("*")
      .in("itinerary_day_id", dayIds)
      .order("activity_order");
    activities = (data ?? []) as Activity[];
  }

  return (
    <TripDetailView
      trip={{
        id: trip.id,
        tripCode: trip.trip_code,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        status: trip.status,
        remarks: trip.remarks,
      }}
      days={days.map((day) => ({
        id: day.id,
        dayNumber: day.day_number,
        destination: day.destination,
        itineraryText: day.itinerary_text,
        hotelName: day.hotel_name,
        activities: activities
          .filter((activity) => activity.itinerary_day_id === day.id)
          .map((activity) => ({
            id: activity.id,
            title: activity.title,
            description: activity.description,
            startTime: activity.start_time,
            endTime: activity.end_time,
            order: activity.activity_order,
          })),
      }))}
      contacts={(contactRows ?? []).map((contact: TripContact) => ({
        id: contact.id,
        name: contact.name,
        role: contact.role,
        phone: contact.phone,
        email: contact.email,
      }))}
      canContribute={profile.role === "admin" || profile.role === "leader"}
    />
  );
}