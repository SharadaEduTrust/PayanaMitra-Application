import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Profile, TravellerDetails } from "@/lib/types";
import UsersAdmin from "@/components/users-admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireProfile(["admin"]);
  const supabase = await createClient();

  const [{ data: people }, { data: details }] = await Promise.all([
    supabase.from("profiles").select("*").order("last_name", { ascending: true }),
    supabase.from("traveller_details").select("user_id, food_preference, emergency_contact_name, emergency_contact_no"),
  ]);

  const detailByUser = new Map(
    ((details ?? []) as Pick<TravellerDetails, "user_id" | "food_preference" | "emergency_contact_name" | "emergency_contact_no">[]).map((d) => [
      d.user_id,
      d,
    ]),
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
      foodPreference: detail?.food_preference ?? null,
      emergencyContact:
        detail?.emergency_contact_name && detail?.emergency_contact_no
          ? `${detail.emergency_contact_name} · ${detail.emergency_contact_no}`
          : null,
    };
  });

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Travellers</h1>
          <small>Accounts, roles and access.</small>
        </div>
      </header>
      <div className="admin-body">
        <UsersAdmin users={users} />
      </div>
    </>
  );
}