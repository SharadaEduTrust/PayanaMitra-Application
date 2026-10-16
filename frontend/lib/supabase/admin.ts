import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. It bypasses Row Level Security, so it must only ever be
 * used inside server code and only where a traveller could not be trusted:
 * admin operations, login rate limiting, audit logging, and auth user creation.
 */
export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}