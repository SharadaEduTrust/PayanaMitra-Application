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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: guests, error } = await (admin.from("profiles") as any)
    .select("id, phone, first_name, last_name, email, location, is_active, date_of_joining, remarks, traveller_details(*)")
    .eq("leader_id", profile.id)
    .order("first_name", { ascending: true });

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
