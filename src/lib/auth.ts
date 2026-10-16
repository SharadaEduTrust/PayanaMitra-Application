import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, UserRole } from "@/lib/types";
import { redirect } from "next/navigation";

/** The signed-in Supabase auth user, or null. */
export async function getAuthUser() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    // Supabase not configured yet. Treat everyone as signed out.
    return null;
  }
}

/**
 * The profile row for the signed-in user.
 *
 * `profiles` has no client insert policy in the migrations, so profile rows are
 * written server-side with the service role. Until that row exists the user is
 * not onboarded and must be sent to /onboarding.
 */
export async function getProfile(): Promise<Profile | null> {
  const user = await getAuthUser();
  if (!user) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = admin
      ? await admin.from("profiles").select("*").eq("id", user.id).maybeSingle()
      : { data: null, error: null };

    if (error) throw error;
    return data as Profile | null;
  } catch {
    // Unconfigured or unreachable database. Treat as signed out rather than
    // throwing, so protected pages redirect instead of showing a 500.
    return null;
  }
}

export async function requireProfile(roles?: UserRole[]) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/suspended");
  if (roles && !roles.includes(profile.role)) redirect("/");
  return profile;
}

/** True when the user may open the admin panel. */
export async function isAdmin() {
  const profile = await getProfile();
  return profile?.role === "admin" && profile.is_active;
}

/** Marks a profile as recently seen. Called from server actions, not per render. */
export async function touchLastActive(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId);
}