import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET /api/admin/csv-import/history
 *
 * Returns the most recent CSV import audit log entries, optionally filtered by section.
 *
 * Query params:
 *   section — 'users' | 'guest_details' | 'trails' | 'itinerary' | 'mapping' (optional, filters by section)
 *   limit   — number of entries to return (default 20, max 100)
 */

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(req.url)
  const section = searchParams.get('section') // optional filter
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin.from('audit_log') as any)
    .select('id, action, payload, created_at, profiles(id, first_name, last_name, phone)')
    .eq('action', 'csv_import')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (section) {
    // Filter by section inside payload JSONB
    query = query.eq('payload->>section', section)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

