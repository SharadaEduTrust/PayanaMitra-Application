import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'
import { embedFeedbackConfigIntoRemarks, extractFeedbackConfig } from '@/lib/feedback'

/**
 * GET    /api/admin/trips/[id]   — get single trip (with leader info)
 * PATCH  /api/admin/trips/[id]   — update trip fields, leader, deactivation
 * DELETE /api/admin/trips/[id]   — soft-deactivate (or ?hard=true for delete)
 */

interface Params { params: Promise<{ id: string }> }

const UpdateTripSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(100, 'Max 100 characters').optional(),
  destination: z.string().max(100, 'Max 100 characters').optional().nullable(),
  start_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  end_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
  leader_id:   z.string().uuid('Invalid leader ID').optional().nullable(),
  status:      z.enum(['draft', 'published', 'archived']).optional(),
  is_active:   z.boolean().optional(),
  remarks:     z.string().max(2000).optional().nullable(),
  feedback_form_url: z.string().trim().max(1000).optional().nullable(),
  feedback_window_days: z.coerce.number().int().min(1).max(365).optional().nullable(),
}).strict().refine(data => {
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) >= new Date(data.start_date)
  }
  return true
}, {
  message: 'End date must be on or after start date',
  path: ['end_date'],
})

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── GET /api/admin/trips/[id] ────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('trips')
    .select('*, profiles!trips_leader_id_fkey(id, first_name, last_name, phone, email)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const fbConfig = extractFeedbackConfig(data)
  const enriched = {
    ...data,
    feedback_form_url: fbConfig.url,
    feedback_window_days: fbConfig.windowDays,
  }

  return NextResponse.json({ data: enriched })
}

// ─── PATCH /api/admin/trips/[id] ─────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateTripSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate leader_id if supplied
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

  const updatePayload: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.feedback_form_url !== undefined) {
    updatePayload.feedback_form_url = parsed.data.feedback_form_url ? parsed.data.feedback_form_url.trim() : null
  }
  if (parsed.data.feedback_window_days !== undefined) {
    updatePayload.feedback_window_days = parsed.data.feedback_window_days ?? 7
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = await (admin.from('trips') as any)
    .update(updatePayload)
    .eq('id', id)
    .select('*, profiles!trips_leader_id_fkey(id, first_name, last_name, phone, email)')
    .single()

  // Resilient fallback if columns do not exist yet on remote table
  if (error && (error.code === '42703' || String(error.message).includes('feedback_form_url'))) {
    const { feedback_form_url, feedback_window_days, ...rest } = updatePayload
    let fallbackRemarks = rest.remarks as string | null | undefined
    if (parsed.data.feedback_form_url !== undefined || parsed.data.feedback_window_days !== undefined) {
      if (fallbackRemarks === undefined) {
        const { data: curr } = await admin.from('trips').select('remarks').eq('id', id).maybeSingle()
        fallbackRemarks = curr?.remarks ?? null
      }
      fallbackRemarks = embedFeedbackConfigIntoRemarks(fallbackRemarks, {
        url: (feedback_form_url as string | null) ?? null,
        windowDays: (feedback_window_days as number) ?? 7,
      })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallbackRes = await (admin.from('trips') as any)
      .update({ ...rest, ...(fallbackRemarks !== undefined ? { remarks: fallbackRemarks } : {}) })
      .eq('id', id)
      .select('*, profiles!trips_leader_id_fkey(id, first_name, last_name, phone, email)')
      .single()
    data = fallbackRes.data
    error = fallbackRes.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const fbConfig = extractFeedbackConfig(data)
  const enriched = {
    ...data,
    feedback_form_url: fbConfig.url,
    feedback_window_days: fbConfig.windowDays,
  }

  return NextResponse.json({ data: enriched })
}

// ─── DELETE /api/admin/trips/[id] ────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const isHard = searchParams.get('hard') === 'true'

  const admin = createAdminClient()

  if (isHard) {
    const { error } = await admin.from('trips').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  }

  // Default: Soft-deactivate to retain historical records
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('trips') as any)
    .update({ is_active: false, status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, is_active, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'Trip archived successfully', data })
}
