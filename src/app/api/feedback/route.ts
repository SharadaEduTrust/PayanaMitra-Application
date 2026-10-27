import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * POST /api/feedback
 *
 * Body: { trip_id, rating?, comment? }
 *
 * Traveller submits feedback for a trip they are a member of.
 * One submission per user per trip (enforced at DB level — no unique constraint
 * in migrations, but we guard here to return a clear error).
 */

const FeedbackSchema = z.object({
  trip_id: z.string().uuid('trip_id must be a UUID'),
  rating:  z.number().int().min(1, 'Rating must be between 1 and 10').max(10, 'Rating must be between 1 and 10'),
  comment: z.string().max(2000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tripId = searchParams.get('trip_id')
  if (!tripId) return NextResponse.json({ error: 'trip_id is required' }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('feedback') as any)
    .select('id, trip_id, rating, comment, created_at')
    .eq('trip_id', tripId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data ?? null })
}

export async function POST(req: NextRequest) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { trip_id, rating, comment } = parsed.data
  const admin = createAdminClient()

  // Verify user is a member of this trip OR the assigned leader of this trip
  const [{ count: memberCount }, { count: leaderCount }] = await Promise.all([
    admin
      .from('trip_members')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', trip_id)
      .eq('user_id', profile.id),
    admin
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('id', trip_id)
      .eq('leader_id', profile.id),
  ])

  if ((memberCount ?? 0) === 0 && (leaderCount ?? 0) === 0 && profile.role !== 'admin') {
    return NextResponse.json({ error: 'You are not enrolled on this trail' }, { status: 403 })
  }

  // Check if feedback already exists: update or insert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin.from('feedback') as any)
    .select('id')
    .eq('trip_id', trip_id)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from('feedback') as any)
      .update({
        rating,
        comment: comment?.trim() || null,
      })
      .eq('id', existing.id)
      .select('id, trip_id, rating, comment, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, updated: true }, { status: 200 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('feedback') as any)
    .insert({
      trip_id,
      user_id: profile.id,
      rating,
      comment: comment?.trim() || null,
    })
    .select('id, trip_id, rating, comment, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
