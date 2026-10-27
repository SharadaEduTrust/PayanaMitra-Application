import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'
import { sendTrailNotification } from '@/lib/server/notifications'

/**
 * POST /api/trips/[id]/notify
 *
 * Allows the assigned Trail Leader or an Admin to send an instant
 * broadcast notification to all guests enrolled in this trail.
 */

interface Params {
  params: Promise<{ id: string }>
}

const NotifySchema = z.object({
  title:        z.string().min(1, 'Title is required').max(200, 'Max 200 characters'),
  body:         z.string().max(2000, 'Max 2000 characters').optional(),
})

async function requireAdminOrLeader(tripId: string) {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role === 'admin') return { profile }

  if (profile.role === 'leader') {
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: trip } = await (admin.from('trips') as any)
      .select('id, leader_id')
      .eq('id', tripId)
      .maybeSingle()

    if (trip && trip.leader_id === profile.id) {
      return { profile }
    }
    return { error: 'Forbidden: You are not the assigned leader of this trail', status: 403 } as const
  }

  return { error: 'Forbidden: Only admins and the assigned trail leader may send notifications', status: 403 } as const
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: tripId } = await params

  const guard = await requireAdminOrLeader(tripId)
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = NotifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const admin = createAdminClient()
  const { data: trip, error: tripErr } = await admin
    .from('trips')
    .select('id, name')
    .eq('id', tripId)
    .maybeSingle()

  if (tripErr || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  try {
    const result = await sendTrailNotification({
      tripId,
      title: parsed.data.title.trim(),
      body: parsed.data.body?.trim() || null,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
