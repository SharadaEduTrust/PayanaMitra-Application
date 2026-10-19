import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET    /api/admin/trips/[id]/days/[dayId]/activities  — list activities for a day
 * POST   /api/admin/trips/[id]/days/[dayId]/activities  — create an activity
 */

interface Params { params: Promise<{ id: string; dayId: string }> }

const CreateActivitySchema = z.object({
  title:          z.string().min(1, 'Title is required').max(300),
  description:    z.string().max(2000).optional().nullable(),
  start_time:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS').optional().nullable(),
  end_time:       z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS').optional().nullable(),
  activity_order: z.number().int().min(1).optional().nullable(),
}).refine(data => {
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

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { dayId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('activities')
    .select('*')
    .eq('itinerary_day_id', dayId)
    .order('activity_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { dayId } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateActivitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const admin = createAdminClient()

  // Verify day exists
  const { count } = await admin.from('itinerary_days').select('id', { count: 'exact', head: true }).eq('id', dayId)
  if ((count ?? 0) === 0) {
    return NextResponse.json({ error: 'Itinerary day not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('activities') as any)
    .insert({ ...parsed.data, itinerary_day_id: dayId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
