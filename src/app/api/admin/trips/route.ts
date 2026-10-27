import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'
import { embedFeedbackConfigIntoRemarks } from '@/lib/feedback'

/**
 * GET  /api/admin/trips          — list all trips (paginated)
 * POST /api/admin/trips          — create a new trip
 */

const CreateTripSchema = z.object({
  trip_code:   z.string().trim().min(1, 'Trail ID is required').max(50, 'Trail ID cannot exceed 50 characters').transform(v => v.toUpperCase()),
  name:        z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  destination: z.string().max(100, 'Destination cannot exceed 100 characters').optional().nullable(),
  start_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  end_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  leader_id:   z.string().uuid('Invalid leader ID').optional().nullable(),
  remarks:     z.string().max(2000, 'Remarks cannot exceed 2000 characters').optional().nullable(),
  feedback_form_url: z.string().trim().max(1000).optional().nullable(),
  feedback_window_days: z.coerce.number().int().min(1).max(365).optional().nullable(),
}).refine(data => {
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) >= new Date(data.start_date)
  }
  return true
}, {
  message: 'End date must be on or after start date',
  path: ['end_date'],
})

// ─── Auth guard helper ─────────────────────────────────────────────────────────
async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── GET /api/admin/trips ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10))
  const status = searchParams.get('status') // draft | published | archived
  const search = searchParams.get('q') ?? ''
  const active = searchParams.get('active')
  const from   = (page - 1) * limit

  const admin = createAdminClient()

  let query = admin
    .from('trips')
    .select('*, profiles!trips_leader_id_fkey(id, first_name, last_name, phone)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (status && ['draft', 'published', 'archived'].includes(status)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq('status', status)
  }
  if (active === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq('is_active', true)
  } else if (active === 'false') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq('is_active', false)
  }
  if (search) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).or(`name.ilike.%${search}%,trip_code.ilike.%${search}%,destination.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: count ?? 0, page, limit })
}

// ─── POST /api/admin/trips ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateTripSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const admin = createAdminClient()

  // Verify leader_id if provided
  if (parsed.data.leader_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: leaderProfile } = await (admin.from('profiles') as any)
      .select('id, role')
      .eq('id', parsed.data.leader_id)
      .single()

    if (!leaderProfile || !['leader', 'admin'].includes(leaderProfile.role)) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: { leader_id: ['Selected user is not an active leader or admin.'] } },
        { status: 422 },
      )
    }
  }

  // Check trip_code uniqueness
  const { count } = await admin.from('trips').select('id', { count: 'exact', head: true }).eq('trip_code', parsed.data.trip_code)
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: { trip_code: ['Trip code already exists.'] } }, { status: 422 })
  }

  const insertPayload = {
    ...parsed.data,
    feedback_form_url: parsed.data.feedback_form_url ? parsed.data.feedback_form_url.trim() : null,
    feedback_window_days: parsed.data.feedback_window_days ?? 7,
    status: 'draft',
    is_active: true,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await (admin.from('trips') as any)
    .insert(insertPayload)
    .select('*, profiles!trips_leader_id_fkey(id, first_name, last_name, phone)')
    .single()

  // Resilient fallback if columns have not been added to remote DB yet
  if (error && (error.code === '42703' || String(error.message).includes('feedback_form_url'))) {
    const { feedback_form_url, feedback_window_days, ...rest } = insertPayload
    const fallbackRemarks = embedFeedbackConfigIntoRemarks(rest.remarks, {
      url: feedback_form_url,
      windowDays: feedback_window_days,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallbackRes = await (admin.from('trips') as any)
      .insert({ ...rest, remarks: fallbackRemarks })
      .select('*, profiles!trips_leader_id_fkey(id, first_name, last_name, phone)')
      .single()
    data = fallbackRes.data
    error = fallbackRes.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
