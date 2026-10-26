import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET /api/admin/trips/[id]/surveys
 *
 * Admin retrieval of all survey responses for a specified trip.
 *
 * Authorization:
 *   - Admin session required (returns 401 if unauthenticated, 403 if not admin).
 *
 * Validations:
 *   - trip_id must be a valid UUID.
 *   - Returns 404 if the trip does not exist.
 *
 * Query Parameters:
 *   - page (default 1)
 *   - limit (default 50, max 100)
 *
 * Response Shape:
 *   {
 *     data: Array<{
 *       id: string,
 *       trip_id: string,
 *       user_id: string,
 *       question: string,
 *       answer: string | null,
 *       created_at: string,
 *       user: {
 *         id: string,
 *         first_name: string,
 *         last_name: string,
 *         phone: string,
 *         email: string | null
 *       } | null
 *     }>,
 *     total: number,
 *     page: number,
 *     limit: number
 *   }
 */

interface Params {
  params: Promise<{ id: string }>
}

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { id: trip_id } = await params
  if (!trip_id || !UUID_REGEX.test(trip_id)) {
    return NextResponse.json({ error: 'Invalid trip ID format' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify trip exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trip, error: tripErr } = await (admin.from('trips') as any)
    .select('id, trip_code, name')
    .eq('id', trip_id)
    .maybeSingle()

  if (tripErr) {
    return NextResponse.json({ error: tripErr.message }, { status: 500 })
  }

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const from  = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, count, error } = await (admin.from('survey_responses') as any)
    .select(
      'id, trip_id, user_id, question, answer, created_at, profiles:profiles!user_id(id, first_name, last_name, phone, email)',
      { count: 'exact' }
    )
    .eq('trip_id', trip_id)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Format response rows with nested user details
  const formatted = (data ?? []).map((row: {
    id: string
    trip_id: string
    user_id: string
    question: string
    answer: string | null
    created_at: string
    profiles?: {
      id: string
      first_name: string
      last_name: string
      phone: string
      email: string | null
    } | null
  }) => ({
    id: row.id,
    trip_id: row.trip_id,
    user_id: row.user_id,
    question: row.question,
    answer: row.answer,
    created_at: row.created_at,
    user: row.profiles ? {
      id: row.profiles.id,
      first_name: row.profiles.first_name,
      last_name: row.profiles.last_name,
      phone: row.profiles.phone,
      email: row.profiles.email,
    } : null,
  }))

  return NextResponse.json({
    data: formatted,
    total: count ?? 0,
    page,
    limit,
  })
}
