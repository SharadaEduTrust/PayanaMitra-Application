import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Server-only admin Supabase client (service-role).
 * Bypasses RLS — use ONLY in:
 *   - POST /api/login (rate limiting, auth)
 *   - Server Actions that need cross-user writes (admin panel)
 *   - Seed / migration scripts
 *
 * NEVER import this in client components or pass it to the browser.
 * NEVER prefix SUPABASE_SERVICE_ROLE_KEY with NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'These must be set in .env.local and are server-only.',
    )
  }

  return createClient<Database>(url, key, {
    auth: {
      // Disable automatic session persistence — this is a server-only client
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
