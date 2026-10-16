import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Activity, ItineraryDay, Trip } from "@/lib/types";
import TripEditor from "@/components/trip-editor";
import TripMembers from "@/components/trip-members";
import TripContactsEditor from "@/components/trip-contacts-editor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function AdminTripPage({ params }: Params) {
  const { id } = await params;
  await requireProfile(["admin"]);
  const supabase = await createClient();

  const { data: tripData } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!tripData) {
    return (
      <div className="admin-body">
        <p className="form-error">That trip could not be found.</p>
        <Link className="btn btn-secondary" href="/admin/trips">
          Back to trips
        </Link>
      </div>
    );
  }
  const trip = tripData as Trip;

  const [{ data: dayRows }, { data: contactRows }, { data: leaderRows }] = await Promise.all([
    supabase.from("itinerary_days").select("*").eq("trip_id", id).order("day_number"),
    supabase.from("trip_contacts").select("*").eq("trip_id", id).order("name"),
    supabase.from("profiles").select("id, first_name, last_name, role").eq("role", "leader"),
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
    <div className="admin-body">
      <Link className="back-link" href="/admin/trips">
        ← All trips
      </Link>

      <TripEditor
        trip={{
          id: trip.id,
          tripCode: trip.trip_code,
          name: trip.name,
          destination: trip.destination ?? "",
          startDate: trip.start_date ?? "",
          endDate: trip.end_date ?? "",
          status: trip.status,
          isActive: trip.is_active,
          remarks: trip.remarks ?? "",
          leaderId: trip.leader_id ?? "",
        }}
        days={days.map((day) => ({
          id: day.id,
          dayNumber: day.day_number,
          destination: day.destination ?? "",
          itineraryText: day.itinerary_text ?? "",
          hotelName: day.hotel_name ?? "",
          activities: activities
            .filter((activity) => activity.itinerary_day_id === day.id)
            .map((activity) => ({
              id: activity.id,
              title: activity.title,
              description: activity.description ?? "",
              startTime: activity.start_time ?? "",
              endTime: activity.end_time ?? "",
              order: activity.activity_order,
            })),
        }))}
        leaders={(leaderRows ?? []).map((leader) => ({
          id: leader.id as string,
          name: `${leader.first_name as string} ${leader.last_name as string}`,
        }))}
      />

      <TripMembers tripId={trip.id} />

      <TripContactsEditor
        tripId={trip.id}
        contacts={(contactRows ?? []).map((contact) => ({
          id: contact.id as string,
          name: contact.name as string,
          role: contact.role,
          phone: contact.phone,
          email: contact.email,
        }))}
      />
    </div>
  );
}