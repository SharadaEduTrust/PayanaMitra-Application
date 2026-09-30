import { redirect } from 'next/navigation'
import { getSession } from '@/lib/server/auth'

/**
 * / — Root page.
 * The middleware already protects this route (redirects to /login if not authed).
 * Once authenticated, redirect to the role-appropriate dashboard.
 */
export default async function RootPage() {
  const profile = await getSession()

  if (!profile) {
    // Middleware should have caught this, but just in case
    redirect('/login')
  }

  if (profile.role === 'admin') redirect('/admin')
  if (profile.role === 'leader') redirect('/leader')
  redirect('/app')
}
