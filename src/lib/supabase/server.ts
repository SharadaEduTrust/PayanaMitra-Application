import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Server-side Supabase client (anon/user role).
 * Uses the current user's session from cookies.
 * Use in Server Components, Route Handlers, and Server Actions.
 *
 * RLS is active — this client only sees what the logged-in
 * user is allowed to see.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll is called from Server Components where setting cookies
            // is not allowed. The middleware handles session refresh instead.
          }
        },
      },
    },
  )
}
