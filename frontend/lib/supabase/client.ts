import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "./config";

/**
 * Browser client. Uses the anon key and the user's own session, so every query
 * is filtered by the RLS policies in the migrations.
 *
 * Throws a readable error when the project is not configured. Forms guard with
 * `isSupabaseConfigured()` first, so this only surfaces if something bypasses
 * that check.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.",
    );
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
