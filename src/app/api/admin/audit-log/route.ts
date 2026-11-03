import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET /api/admin/audit-log
 *
 * Query params:
 *   page    — page number (default 1)
 *   limit   — items per page (default 20, max 100)
 *   actor   — filter by actor_id (UUID)
 *   entity  — filter by entity table name (e.g. 'trips', 'profiles')
 *   action  — filter by action string
 *
 * Returns paginated audit log entries. Read via service-role key
 * (no RLS policy — audit_log has no user-facing read policies).
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
  const rawPage = parseInt(searchParams.get('page') ?? '1', 10)
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const page   = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage)
  const limit  = Math.min(100, Math.max(1, Number.isNaN(rawLimit) ? 20 : rawLimit))
  const actor  = searchParams.get('actor')
  const entity = searchParams.get('entity')
  const action = searchParams.get('action')
  const from   = (page - 1) * limit

  const admin = createAdminClient()

  // Build query — join profiles to get actor name
  let query = admin
    .from('audit_log')
    .select(
      'id, action, entity, entity_id, payload, ip, created_at, profiles(id, first_name, last_name, phone)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (actor) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq('actor_id', actor)
  }
  if (entity) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq('entity', entity)
  }
  if (action) {
    const cleanAction = action.replace(/[%_,()\\*]/g, ' ').trim()
    if (cleanAction) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).ilike('action', `%${cleanAction}%`)
    }
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: count ?? 0, page, limit })
}
