import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Request-scoped client carrying the user's cookies. RLS applies, so this is
 * what traveller-facing pages and route handlers must use.
 */
export async function createClient() {
  const store = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component. Middleware refreshes the session,
          // so this can be safely ignored.
        }
      },
    },
  });
}