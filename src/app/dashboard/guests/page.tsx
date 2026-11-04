import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import AssignedGuestsView from "@/components/assigned-guests-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ trip_id?: string }>;
};

export default async function LeaderGuestsPage({ searchParams }: PageProps) {
  const profile = await requireProfile();
  if (profile.role !== "leader" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const selectedTripId = params.trip_id;

  const admin = createAdminClient();

  // Find all trips led by this leader (or all trips if admin)
  let tripQuery = admin
    .from("trips")
    .select("id, name, trip_code");

  if (profile.role !== "admin") {
    tripQuery = tripQuery.eq("leader_id", profile.id);
  }

  const { data: ledTrips } = await tripQuery.order("start_date", { ascending: false });
  const ledTripsList = (ledTrips ?? []) as Array<{ id: string; name: string; trip_code: string }>;

  const tripIds = ledTripsList.map((t) => t.id);
  const tripMap = new Map(ledTripsList.map((t) => [t.id, t]));

  const memberUserIds: string[] = [];
  const userTripIdsMap = new Map<string, string[]>();
  const userTrailsMap = new Map<string, string[]>();

  if (tripIds.length > 0) {
    const { data: members } = await admin
      .from("trip_members")
      .select("user_id, trip_id")
      .in("trip_id", tripIds);

    for (const m of (members ?? []) as Array<{ user_id: string; trip_id: string }>) {
      memberUserIds.push(m.user_id);

      const userTrips = userTripIdsMap.get(m.user_id) || [];
      if (!userTrips.includes(m.trip_id)) {
        userTrips.push(m.trip_id);
      }
      userTripIdsMap.set(m.user_id, userTrips);

      const trails = userTrailsMap.get(m.user_id) || [];
      const t = tripMap.get(m.trip_id);
      const tName = t?.name;
      if (tName && !trails.includes(tName)) {
        trails.push(tName);
      }
      userTrailsMap.set(m.user_id, trails);
    }
  }

  // Also query legacy leader_id directly on profiles for backwards compatibility
  let legacyIds: string[] = [];
  if (profile.role === "leader") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: legacyGuests } = await (admin.from("profiles") as any)
      .select("id")
      .eq("leader_id", profile.id);
    legacyIds = (legacyGuests ?? []).map((g: { id: string }) => g.id);
  }

  const allGuestIds = Array.from(new Set([...memberUserIds, ...legacyIds]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let guests: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let error: any = null;

  if (allGuestIds.length > 0) {
    const res = await (admin.from("profiles") as any)
      .select("id, phone, first_name, last_name, email, location, is_active, date_of_joining, remarks, traveller_details(*)")
      .in("id", allGuestIds)
      .order("first_name", { ascending: true });
    guests = res.data ?? [];
    error = res.error;
  }

  const decoratedGuests = guests.map((g) => ({
    ...g,
    trip_ids: userTripIdsMap.get(g.id) || [],
    trails: userTrailsMap.get(g.id) || [],
  }));

  const selectedTrip = selectedTripId ? tripMap.get(selectedTripId) : null;

  return (
    <div className="trip-detail">
      <Link className="back-link" href="/dashboard" style={{ display: "inline-block" }}>
        ← All trails
      </Link>

      <header className="page-head">
        <div>
          <div className="eyebrow">Trail Leadership</div>
          <h1 className="serif">
            {selectedTrip ? `${selectedTrip.name} — Guests` : "Assigned Guests"}
          </h1>
          <p>
            {selectedTrip
              ? `Guests currently mapped to ${selectedTrip.name}${selectedTrip.trip_code ? ` (${selectedTrip.trip_code})` : ""}. Review dietary, emergency, and insurance details to ensure a seamless journey.`
              : "Guests currently assigned under your trail leadership. Review their dietary, emergency, and insurance details to ensure a seamless journey."}
          </p>
        </div>
      </header>

      {error ? (
        <p className="form-error">Could not load assigned guests: {error.message}</p>
      ) : (
        <AssignedGuestsView
          initialGuests={decoratedGuests}
          trips={ledTripsList}
          initialTripId={selectedTripId}
        />
      )}
    </div>
  );
}
