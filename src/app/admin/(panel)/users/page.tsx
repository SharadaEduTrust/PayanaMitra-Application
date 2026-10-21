import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Profile, TravellerDetails } from "@/lib/types";
import UsersAdmin from "@/components/users-admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireProfile(["admin"]);
  const supabase = await createClient();

  const [{ data: people }, { data: details }, { data: leaders }] = await Promise.all([
    supabase.from("profiles").select("*").order("last_name", { ascending: true }),
    supabase.from("traveller_details").select("*"),
    supabase.from("profiles").select("id, first_name, last_name").eq("role", "leader").order("first_name", { ascending: true }),
  ]);

  const leaderMap = new Map((leaders ?? []).map((l) => [l.id, `${l.first_name} ${l.last_name}`.trim()]));

  const detailByUser = new Map(
    ((details ?? []) as TravellerDetails[]).map((d) => [d.user_id, d]),
  );

  const users = ((people ?? []) as Profile[]).map((profile) => {
    const detail = detailByUser.get(profile.id);
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
      location: profile.location,
      remarks: profile.remarks,
      lastActiveAt: profile.last_active_at,
      leaderId: profile.leader_id,
      leaderName: profile.leader_id ? (leaderMap.get(profile.leader_id) ?? null) : null,
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