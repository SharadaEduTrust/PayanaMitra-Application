import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import type { Activity, ItineraryDay, Trip, TripContact } from "@/lib/types";
import TripDetailView from "@/components/trip-detail-view";
import { extractFeedbackConfig, cleanRemarks } from "@/lib/feedback";

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

  const [{ data: dayRows }, { data: contactRows }, { data: leaderProfile }, { data: coordinatorRows }] = await Promise.all([
    admin.from("itinerary_days").select("*").eq("trip_id", id).order("day_number"),
    admin.from("trip_contacts").select("*").eq("trip_id", id).order("name"),
    trip.leader_id
      ? admin.from("profiles").select("id, first_name, last_name, phone, email").eq("id", trip.leader_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("profiles").select("id, first_name, last_name, phone, email").eq("role", "admin").eq("is_active", true).order("created_at", { ascending: true }).limit(1),
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

  const isLeader = profile.role === "admin" || trip.leader_id === profile.id;

  // Build complete contacts list: Leader + Coordinator + Logistical Contacts (guides/hotels/transport)
  const combinedContacts: Array<{ id: string; name: string; role: string | null; phone: string | null; email: string | null }> = [];

  if (leaderProfile) {
    combinedContacts.push({
      id: `leader-${leaderProfile.id}`,
      name: `${leaderProfile.first_name} ${leaderProfile.last_name}`.trim(),
      role: "Trail Leader",
      phone: leaderProfile.phone,
      email: leaderProfile.email,
    });
  }

  const coordinator = coordinatorRows?.[0];
  if (coordinator && (!leaderProfile || leaderProfile.phone !== coordinator.phone)) {
    combinedContacts.push({
      id: `coord-${coordinator.id}`,
      name: `${coordinator.first_name} ${coordinator.last_name}`.trim(),
      role: "Trail Coordinator",
      phone: coordinator.phone,
      email: coordinator.email,
    });
  }

  for (const contact of (contactRows ?? []) as TripContact[]) {
    // Avoid duplicate phone/name if already listed
    if (!combinedContacts.some((c) => (c.phone && c.phone === contact.phone) || c.name.toLowerCase() === contact.name.toLowerCase())) {
      combinedContacts.push({
        id: contact.id,
        name: contact.name,
        role: contact.role,
        phone: contact.phone,
        email: contact.email,
      });
    }
  }

  // For Trail Leaders and Admins: query full guest roster with direct phone & emergency contacts
  let trailGuests: Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    emergencyName: string | null;
    emergencyPhone: string | null;
    foodPreference: string | null;
    foodAllergy: string | null;
  }> = [];

  if (isLeader) {
    const { data: memberRows } = await admin
      .from("trip_members")
      .select("user_id")
      .eq("trip_id", id);

    const guestIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);
    if (guestIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: guestProfiles } = await (admin.from("profiles") as any)
        .select("id, first_name, last_name, phone, email, traveller_details(*)")
        .in("id", guestIds)
        .order("first_name", { ascending: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      trailGuests = (guestProfiles ?? []).map((g: any) => {
        const details = Array.isArray(g.traveller_details) ? g.traveller_details[0] : g.traveller_details;
        return {
          id: g.id,
          name: `${g.first_name} ${g.last_name}`.trim(),
          phone: g.phone,
          email: g.email ?? null,
          emergencyName: details?.emergency_contact_name ?? null,
          emergencyPhone: details?.emergency_contact_no ?? null,
          foodPreference: details?.food_preference ?? null,
          foodAllergy: details?.food_allergy ?? null,
        };
      });
    }
  }

  const fbConfig = extractFeedbackConfig(trip);

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
        remarks: cleanRemarks(trip.remarks),
        feedbackFormUrl: fbConfig.url,
        feedbackWindowDays: fbConfig.windowDays,
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
      contacts={combinedContacts}
      trailGuests={trailGuests}
      canContribute={profile.role === "admin" || profile.role === "leader"}
      userRole={profile.role}
      isLeader={isLeader}
    />
  );
}