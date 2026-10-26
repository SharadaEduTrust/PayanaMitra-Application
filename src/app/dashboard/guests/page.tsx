import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import AssignedGuestsView from "@/components/assigned-guests-view";

export const dynamic = "force-dynamic";

export default async function LeaderGuestsPage() {
  const profile = await requireProfile();
  if (profile.role !== "leader" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  // Find all trips led by this leader
  const { data: ledTrips } = await admin
    .from("trips")
    .select("id, name")
    .eq("leader_id", profile.id);

  const tripIds = (ledTrips ?? []).map((t: { id: string }) => t.id);
  const tripNameMap = new Map((ledTrips ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));

  const memberUserIds: string[] = [];
  const userTrailsMap = new Map<string, string[]>();

  if (tripIds.length > 0) {
    const { data: members } = await admin
      .from("trip_members")
      .select("user_id, trip_id")
      .in("trip_id", tripIds);

    for (const m of (members ?? []) as Array<{ user_id: string; trip_id: string }>) {
      memberUserIds.push(m.user_id);
      const trails = userTrailsMap.get(m.user_id) || [];
      const tName = tripNameMap.get(m.trip_id);
      if (tName && !trails.includes(tName)) {
        trails.push(tName);
      }
      userTrailsMap.set(m.user_id, trails);
    }
  }

  // Also query legacy leader_id directly on profiles for backwards compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: legacyGuests } = await (admin.from("profiles") as any)
    .select("id")
    .eq("leader_id", profile.id);

  const legacyIds = (legacyGuests ?? []).map((g: { id: string }) => g.id);
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

  return (
    <div className="trip-detail">
      <header className="page-head">
        <div>
          <div className="eyebrow">Trail Leadership</div>
          <h1 className="serif">Assigned Guests</h1>
          <p>
            Guests currently assigned under your trail leadership. Review their dietary,
            emergency, and insurance details to ensure a seamless journey.
          </p>
        </div>
      </header>

      {error ? (
        <p className="form-error">Could not load assigned guests: {error.message}</p>
      ) : (
        <AssignedGuestsView initialGuests={guests ?? []} />
      )}
    </div>
  );
}
