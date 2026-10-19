import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * PATCH  /api/admin/trips/[id]/days/[dayId]/activities/[activityId]
 * DELETE /api/admin/trips/[id]/days/[dayId]/activities/[activityId]
 */

interface Params { params: Promise<{ dayId: string; activityId: string }> }

const UpdateActivitySchema = z.object({
  title:          z.string().min(1).max(300).optional(),
  description:    z.string().max(2000).optional().nullable(),
  start_time:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  end_time:       z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  activity_order: z.number().int().min(1).optional().nullable(),
}).strict().refine(data => {
  if (data.start_time && data.end_time) {
    return data.end_time >= data.start_time
  }
  return true
}, {
  message: 'End time must be after or equal to start time',
  path: ['end_time'],
})

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { dayId, activityId } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateActivitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('activities') as any)
    .update(parsed.data)
    .eq('id', activityId)
    .eq('itinerary_day_id', dayId) // scope to this day
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Activity not found' }, { status: 404 })

  return NextResponse.json({ data })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { dayId, activityId } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .from('activities')
    .delete()
    .eq('id', activityId)
    .eq('itinerary_day_id', dayId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
