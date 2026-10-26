import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TravellerDetails } from "@/lib/types";
import AvatarUpload from "@/components/avatar-upload";
import ProfileForm from "@/components/profile-form";
import ProfileSummary, { type CompletionItem } from "@/components/profile-summary";
import TravellerDetailsForm from "@/components/traveller-details-form";
import { decrypt } from "@/lib/server/crypto";

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
    supabase.from("guest_documents").select("*").eq("user_id", profile.id),
    // RLS ("Users see own trip memberships") already limits this too.
    supabase.from("trip_members").select("trip_id").eq("user_id", profile.id),
  ]);

  const traveller = (details as TravellerDetails | null) ?? null;
  const documentCount = documents?.length ?? 0;

  let hasChangedPassword = false;
  try {
    const admin = createAdminClient();
    const { data: authUserData } = await admin.auth.admin.getUserById(profile.id);
    hasChangedPassword = Boolean(authUserData?.user?.user_metadata?.password_changed);
  } catch {
    hasChangedPassword = false;
  }

  // Decrypt PAN and Passport if stored in documents
  const panDoc = (documents ?? []).find(
    (d: Record<string, unknown>) => String(d.doc_type || "").toLowerCase() === "pan",
  );
  const passportDoc = (documents ?? []).find(
    (d: Record<string, unknown>) => String(d.doc_type || "").toLowerCase() === "passport",
  );
  const visaDoc = (documents ?? []).find(
    (d: Record<string, unknown>) => String(d.doc_type || "").toLowerCase() === "visa",
  );

  let initialPan = "";
  if (panDoc && panDoc.doc_number_enc && panDoc.iv && panDoc.auth_tag) {
    try {
      initialPan = await decrypt({
        ciphertext: String(panDoc.doc_number_enc),
        iv: String(panDoc.iv),
        authTag: String(panDoc.auth_tag),
      });
    } catch {
      initialPan = "";
    }
  }

  let initialPassportNo = "";
  if (passportDoc && passportDoc.doc_number_enc && passportDoc.iv && passportDoc.auth_tag) {
    try {
      initialPassportNo = await decrypt({
        ciphertext: String(passportDoc.doc_number_enc),
        iv: String(passportDoc.iv),
        authTag: String(passportDoc.auth_tag),
      });
    } catch {
      initialPassportNo = "";
    }
  }

  const initialPassportIssueDate = passportDoc?.issued_date
    ? String(passportDoc.issued_date).slice(0, 10)
    : (traveller?.passport_issue_date ?? "");
  const initialPassportExpiry = passportDoc?.expiry_date ? String(passportDoc.expiry_date).slice(0, 10) : "";

  let initialVisaNo = traveller?.visa_no ?? "";
  if (visaDoc && visaDoc.doc_number_enc && visaDoc.iv && visaDoc.auth_tag) {
    try {
      initialVisaNo = await decrypt({
        ciphertext: String(visaDoc.doc_number_enc),
        iv: String(visaDoc.iv),
        authTag: String(visaDoc.auth_tag),
      });
    } catch {
      initialVisaNo = traveller?.visa_no ?? "";
    }
  }
  const initialVisaExpiry = visaDoc?.expiry_date
    ? String(visaDoc.expiry_date).slice(0, 10)
    : (traveller?.visa_expiry ?? "");
  const initialVisaCountry = visaDoc?.issued_country
    ? String(visaDoc.issued_country)
    : (traveller?.visa_country ?? "");

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
    { label: "Location", done: Boolean(profile.location), href: PANEL_ACCOUNT },
    // Not traveller-editable, so the checklist says who to ask rather than
    // linking to a field that cannot be changed here.
    { label: "Email ID (ask your coordinator)", done: Boolean(profile.email), href: PANEL_ACCOUNT },
    { label: "Date of Birth", done: Boolean(traveller?.dob), href: PANEL_TRAVEL },
    { label: "Food Preference", done: Boolean(traveller?.food_preference), href: PANEL_TRAVEL },
    { label: "Emergency Contact", done: Boolean(traveller?.emergency_contact_name && traveller?.emergency_contact_no), href: PANEL_TRAVEL },
    { label: "Travel Insurance", done: Boolean(traveller?.travel_insurance_no), href: PANEL_TRAVEL },
    { label: "At Least One Document", done: documentCount > 0, href: "/dashboard/documents" },
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
              <span className="pill-role">{profile.role === "traveller" ? "Guest" : profile.role}</span>{" "}
              {profile.location ? `Location: ${profile.location}. ` : ""}
              Keep your details current so your coordinator can reach you during a trail.
            </p>
          </div>
        </div>
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
              <dt>Guest since</dt>
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

          <h3 className="serif profile-subhead">Security & Password</h3>
          {hasChangedPassword ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                background: "#f4fbf6",
                border: "1px solid #ccebd7",
                borderRadius: "8px",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontSize: "1rem" }}>✅</span>
              <span style={{ fontSize: "0.88rem", color: "#1e5e22", fontWeight: 500 }}>
                Custom password active. Your identity documents (PAN, Aadhar, Passport) are protected.
              </span>
            </div>
          ) : (
            <div
              style={{
                padding: "12px 16px",
                background: "#fff9f2",
                border: "1px solid #e3d5c4",
                borderLeft: "4px solid #b85d19",
                borderRadius: "8px",
                marginBottom: "14px",
              }}
            >
              <strong style={{ display: "block", color: "#934228", fontSize: "0.92rem", marginBottom: "4px" }}>
                🔒 Default Password in Use ({profile.phone.slice(-4)})
              </strong>
              <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--ink, #4a3b2a)", lineHeight: "1.45" }}>
                Your account currently uses the last 4 digits of your phone number. Because other guests on your trail may know your mobile number, please <strong>create a unique password</strong> to ensure your confidential documents (PAN, Aadhar, Passport) cannot be viewed by other travellers.
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginTop: "12px" }}>
            <Link
              className={hasChangedPassword ? "btn btn-secondary" : "btn btn-primary"}
              href="/change-password"
              style={{ padding: "8px 16px", fontSize: "0.88rem" }}
            >
              {hasChangedPassword ? "Change Password" : "Create New Password →"}
            </Link>
          </div>
        </section>

        <section className="panel" id="travel">
          <h2 className="serif">Guest details</h2>
          <p className="panel-note">Identity, travel insurance, food preferences and emergency contact.</p>
          <TravellerDetailsForm
            details={traveller}
            initialPan={initialPan}
            initialPassportNo={initialPassportNo}
            initialPassportIssueDate={initialPassportIssueDate}
            initialPassportExpiry={initialPassportExpiry}
            initialVisaNo={initialVisaNo}
            initialVisaExpiry={initialVisaExpiry}
            initialVisaCountry={initialVisaCountry}
          />
        </section>
      </div>
    </div>
  );
}
