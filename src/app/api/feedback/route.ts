import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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
  rating:  z.number().int().min(1).max(5).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
}).refine(d => d.rating != null || (d.comment && d.comment.trim().length > 0), {
  message: 'Provide at least a rating or a comment.',
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // Verify user is a member of this trip
  const { count: memberCount } = await admin
    .from('trip_members')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', trip_id)
    .eq('user_id', user.id)

  if ((memberCount ?? 0) === 0) {
    return NextResponse.json({ error: 'Not a member of this trip' }, { status: 403 })
  }

  // Guard: one feedback per user per trip
  const { count: existing } = await admin
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', trip_id)
    .eq('user_id', user.id)

  if ((existing ?? 0) > 0) {
    return NextResponse.json({ error: 'You have already submitted feedback for this trip.' }, { status: 409 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('feedback') as any)
    .insert({ trip_id, user_id: user.id, rating: rating ?? null, comment: comment ?? null })
    .select('id, trip_id, rating, comment, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
