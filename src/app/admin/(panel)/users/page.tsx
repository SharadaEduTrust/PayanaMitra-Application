import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { decrypt } from "@/lib/server/crypto";
import type { Profile, TravellerDetails } from "@/lib/types";
import UsersAdmin from "@/components/users-admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireProfile(["admin"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [
    { data: people },
    { data: details },
    { data: leaders },
    { data: documents },
    { data: tripMemberships },
    { data: tripsList },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("last_name", { ascending: true }),
    supabase.from("traveller_details").select("*"),
    supabase.from("profiles").select("id, first_name, last_name").eq("role", "leader").order("first_name", { ascending: true }),
    (admin.from("guest_documents") as any).select("user_id, doc_type, doc_number_enc, iv, auth_tag, expiry_date, issued_date, issued_country"),
    admin.from("trip_members").select("user_id, trip_id"),
    admin.from("trips").select("id, name, leader_id"),
  ]);

  const leaderMap = new Map((leaders ?? []).map((l) => [l.id, `${l.first_name} ${l.last_name}`.trim()]));
  const personNameMap = new Map((people ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]));
  const tripMap = new Map((tripsList ?? []).map((t) => [t.id, t]));

  // Map each user_id to their enrolled trails and corresponding leaders
  const userTripsMap = new Map<
    string,
    Array<{ tripId: string; tripName: string; leaderId: string | null; leaderName: string | null }>
  >();

  for (const tm of (tripMemberships ?? [])) {
    const trip = tripMap.get(tm.trip_id);
    if (!trip) continue;
    const leaderName = trip.leader_id
      ? (leaderMap.get(trip.leader_id) ?? personNameMap.get(trip.leader_id) ?? null)
      : null;

    const list = userTripsMap.get(tm.user_id) || [];
    list.push({
      tripId: trip.id,
      tripName: trip.name,
      leaderId: trip.leader_id,
      leaderName,
    });
    userTripsMap.set(tm.user_id, list);
  }

  const detailByUser = new Map(
    ((details ?? []) as TravellerDetails[]).map((d) => [d.user_id, d]),
  );

  const panByUser = new Map<string, string>();
  const passportByUser = new Map<string, string>();
  const passportIssueDateByUser = new Map<string, string>();
  const passportExpiryByUser = new Map<string, string>();
  const visaByUser = new Map<string, string>();
  const visaExpiryByUser = new Map<string, string>();
  const visaCountryByUser = new Map<string, string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await Promise.all(
    (documents ?? []).map(async (doc: any) => {
      const docType = String(doc.doc_type || "").toLowerCase();
      if (docType === "pan" || docType === "passport" || docType === "visa") {
        let docNum = "";
        if (doc.doc_number_enc && doc.iv && doc.auth_tag) {
          try {
            docNum = await decrypt({
              ciphertext: doc.doc_number_enc,
              iv: doc.iv,
              authTag: doc.auth_tag,
            });
          } catch {
            docNum = "";
          }
        }
        if (docType === "pan" && docNum) {
          panByUser.set(doc.user_id, docNum);
        } else if (docType === "passport" && docNum) {
          passportByUser.set(doc.user_id, docNum);
          if (doc.issued_date) {
            passportIssueDateByUser.set(doc.user_id, String(doc.issued_date).slice(0, 10));
          }
          if (doc.expiry_date) {
            passportExpiryByUser.set(doc.user_id, String(doc.expiry_date).slice(0, 10));
          }
        } else if (docType === "visa" && docNum) {
          visaByUser.set(doc.user_id, docNum);
          if (doc.expiry_date) {
            visaExpiryByUser.set(doc.user_id, String(doc.expiry_date).slice(0, 10));
          }
          if (doc.issued_country) {
            visaCountryByUser.set(doc.user_id, String(doc.issued_country));
          }
        }
      }
    }),
  );

  const users = ((people ?? []) as Profile[]).map((profile) => {
    const detail = detailByUser.get(profile.id);
    const mappedTrips = userTripsMap.get(profile.id) ?? [];

    // Distinct leader names across all trails this user is undertaking
    const distinctLeaders = Array.from(
      new Set(mappedTrips.map((mt) => mt.leaderName).filter(Boolean) as string[])
    );

    let derivedLeaderName: string | null = null;
    if (distinctLeaders.length > 0) {
      derivedLeaderName = distinctLeaders.join(", ");
    } else if (profile.leader_id) {
      // Backwards-compatibility fallback if legacy leader_id exists on profile
      derivedLeaderName = leaderMap.get(profile.leader_id) ?? personNameMap.get(profile.leader_id) ?? null;
    }

    const trailLeaders = mappedTrips.map((mt) => ({
      trailName: mt.tripName,
      leaderName: mt.leaderName || "No leader assigned",
    }));

    return {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone: profile.phone,
      email: profile.email,
      role: profile.role,
      isActive: profile.is_active,
      mustChangePassword: profile.must_change_password,
      dateOfJoining: profile.date_of_joining,
      referralName: profile.referral_name ?? null,
      location: profile.location,
      remarks: profile.remarks,
      lastActiveAt: profile.last_active_at,
      leaderId: profile.leader_id,
      leaderName: derivedLeaderName,
      trailLeaders: trailLeaders.length > 0 ? trailLeaders : null,
      dob: detail?.dob ?? null,
      foodPreference: detail?.food_preference ?? null,
      foodAllergy: detail?.food_allergy ?? null,
      emergencyContactName: detail?.emergency_contact_name ?? null,
      emergencyContactNo: detail?.emergency_contact_no ?? null,
      emergencyContact:
        detail?.emergency_contact_name && detail?.emergency_contact_no
          ? `${detail.emergency_contact_name} · ${detail.emergency_contact_no}`
          : null,
      travelInsuranceNo: detail?.travel_insurance_no ?? null,
      insuranceCompany: detail?.insurance_company ?? null,
      insuranceExpiry: detail?.insurance_expiry ?? null,
      passportIssuedLocation: detail?.passport_issued_location ?? null,
      passportIssueDate: passportIssueDateByUser.get(profile.id) ?? detail?.passport_issue_date ?? null,
      pan: panByUser.get(profile.id) ?? null,
      passportNo: passportByUser.get(profile.id) ?? null,
      passportExpiry: passportExpiryByUser.get(profile.id) ?? null,
      visaNo: visaByUser.get(profile.id) ?? detail?.visa_no ?? null,
      visaExpiry: visaExpiryByUser.get(profile.id) ?? detail?.visa_expiry ?? null,
      visaCountry: visaCountryByUser.get(profile.id) ?? detail?.visa_country ?? null,
    };
  });

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Guests</h1>
          <small>Guest accounts, roles and access.</small>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link className="btn btn-secondary" href="/admin/import?tab=guests">
            Import CSV
          </Link>
        </div>
      </header>
      <div className="admin-body">
        <UsersAdmin users={users} leaders={leaders ?? []} />
      </div>
    </>
  );
}