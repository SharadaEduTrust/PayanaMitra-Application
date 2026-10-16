import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TravellerDetails } from "@/lib/types";
import AvatarUpload from "@/components/avatar-upload";
import ProfileForm from "@/components/profile-form";
import ProfileSummary, { type CompletionItem } from "@/components/profile-summary";
import TravellerDetailsForm from "@/components/traveller-details-form";

export const dynamic = "force-dynamic";

const PANEL_ACCOUNT = "#account";
const PANEL_TRAVEL = "#travel";

function tripStatus(start: string | null, end: string | null, published: boolean, active: boolean) {
  if (!published || !active) return "closed";
  const today = new Date().toISOString().slice(0, 10);
  if (start && end && start <= today && today <= end) return "current";
  if (start && start > today) return "upcoming";
  return "past";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatLastActive(value: string | null) {
  if (!value) return "Not recorded yet";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  if (days < 30) return `Active ${days} days ago`;
  return `Active on ${formatDate(value)}`;
}

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: details }, { data: documents }, { data: memberships }] = await Promise.all([
    supabase
      .from("traveller_details")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle(),
    // RLS ("Users read own documents") already limits this to the caller.
    supabase.from("guest_documents").select("id").eq("user_id", profile.id),
    // RLS ("Users see own trip memberships") already limits this too.
    supabase.from("trip_members").select("trip_id").eq("user_id", profile.id),
  ]);

  const traveller = (details as TravellerDetails | null) ?? null;
  const documentCount = documents?.length ?? 0;

  const columns = "id, start_date, end_date, status, is_active";
  type TripRow = {
    id: string;
    start_date: string | null;
    end_date: string | null;
    status: string;
    is_active: boolean;
  };

  const tripIds = [...new Set((memberships ?? []).map((m) => m.trip_id))];
  const { data: memberTrips } = tripIds.length
    ? await supabase.from("trips").select(columns).in("id", tripIds)
    : { data: [] as TripRow[] };

  // Leaders and admins also see the trips they lead, mirroring /dashboard.
  const { data: ledTrips } =
    profile.role === "leader" || profile.role === "admin"
      ? await supabase.from("trips").select(columns).eq("leader_id", profile.id)
      : { data: [] as TripRow[] };

  const trips: TripRow[] = [...(memberTrips ?? [])];
  for (const trip of (ledTrips ?? []) as TripRow[]) {
    if (!trips.some((existing) => existing.id === trip.id)) trips.push(trip);
  }

  const counts = { current: 0, upcoming: 0, past: 0 };
  for (const trip of trips) {
    const status = tripStatus(trip.start_date, trip.end_date, trip.status === "published", trip.is_active);
    if (status === "current") counts.current += 1;
    else if (status === "upcoming") counts.upcoming += 1;
    else if (status === "past") counts.past += 1;
  }

  const completion: CompletionItem[] = [
    { label: "Home city", done: Boolean(profile.location), href: PANEL_ACCOUNT },
    // Not traveller-editable, so the checklist says who to ask rather than
    // linking to a field that cannot be changed here.
    { label: "Email address (ask your coordinator)", done: Boolean(profile.email), href: PANEL_ACCOUNT },
    { label: "Date of birth", done: Boolean(traveller?.dob), href: PANEL_TRAVEL },
    { label: "Food preference", done: Boolean(traveller?.food_preference), href: PANEL_TRAVEL },
    { label: "Emergency contact", done: Boolean(traveller?.emergency_contact_name && traveller?.emergency_contact_no), href: PANEL_TRAVEL },
    { label: "Travel insurance", done: Boolean(traveller?.travel_insurance_no), href: PANEL_TRAVEL },
    { label: "At least one document", done: documentCount > 0, href: "/dashboard/documents" },
  ];
  const missing = completion.filter((item) => !item.done);

  return (
    <div className="trip-detail">
      <header className="page-head">
        <div className="profile-hero">
          <AvatarUpload
            avatarUrl={profile.avatar_url}
            firstName={profile.first_name}
            lastName={profile.last_name}
          />
          <div>
            <div className="eyebrow">My profile</div>
            <h1 className="serif">
              {profile.first_name} {profile.last_name}
            </h1>
            <p>
              <span className="pill-role">{profile.role}</span>{" "}
              {profile.location ? `Home city ${profile.location}. ` : ""}
              Keep your details current so your coordinator can reach you during a trip.
            </p>
          </div>
        </div>
        <Link className="btn btn-secondary" href="/change-password">
          Change password
        </Link>
      </header>

      <div className="trip-columns">
        <ProfileSummary
          trips={counts}
          documents={documentCount}
          completion={completion}
          missing={missing}
        />
      </div>

      <div className="trip-columns">
        <section className="panel" id="account">
          <h2 className="serif">Account details</h2>
          <p className="panel-note">
            Phone, role and account status are set by your coordinator. Only your home city is editable.
          </p>
          <ProfileForm
            defaults={{ location: profile.location ?? "" }}
            phone={profile.phone}
            email={profile.email ?? ""}
            role={profile.role}
          />

          <h3 className="serif profile-subhead">Account history</h3>
          <dl className="fact-list">
            <div>
              <dt>Member since</dt>
              <dd>{formatDate(profile.date_of_joining)}</dd>
            </div>
            <div>
              <dt>Last active</dt>
              <dd>{formatLastActive(profile.last_active_at)}</dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>{profile.is_active ? "Active" : "Deactivated by your coordinator"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel" id="travel">
          <h2 className="serif">Travel details</h2>
          <p className="panel-note">Food needs, allergies, emergency contact and insurance.</p>
          <TravellerDetailsForm details={traveller} />
        </section>
      </div>
    </div>
  );
}
