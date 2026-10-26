import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import type { Activity, ItineraryDay, Trip, TripContact } from "@/lib/types";
import TripDetailView from "@/components/trip-detail-view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function TripPage({ params }: Params) {
  const { id } = await params;
  const profile = await requireProfile();
  const admin = createAdminClient();

  // Authorize: Admin can see any trip; Leaders can see their led trips; Travellers can see their enrolled trips.
  if (profile.role !== "admin") {
    const [{ data: isMember }, { data: isLeader }] = await Promise.all([
      admin.from("trip_members").select("id").eq("trip_id", id).eq("user_id", profile.id).maybeSingle(),
      admin.from("trips").select("id").eq("id", id).eq("leader_id", profile.id).maybeSingle(),
    ]);
    if (!isMember && !isLeader) {
      notFound();
    }
  }

  const { data: tripData } = await admin.from("trips").select("*").eq("id", id).maybeSingle();
  const trip = tripData as Trip | null;
  if (!trip) notFound();

  const [{ data: dayRows }, { data: contactRows }] = await Promise.all([
    admin.from("itinerary_days").select("*").eq("trip_id", id).order("day_number"),
    admin.from("trip_contacts").select("*").eq("trip_id", id).order("name"),
  ]);

  const days = (dayRows ?? []) as ItineraryDay[];
  const dayIds = days.map((day) => day.id);

  let activities: Activity[] = [];
  if (dayIds.length > 0) {
    const { data } = await admin
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
        mealPlan: (day as { meal_plan?: string | null }).meal_plan ?? null,
        activities: activities
          .filter((activity) => activity.itinerary_day_id === day.id)
          .map((activity) => ({
            id: activity.id,
            title: activity.title,
            description: activity.description || activity.title || "",
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
      userRole={profile.role}
    />
  );
}