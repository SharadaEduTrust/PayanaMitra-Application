import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * POST /api/survey
 *
 * Body: { trip_id, responses: [{ question, answer }] }
 *
 * Server-side authorization rules:
 *   1. Requires authenticated, active session (via getSession()).
 *   2. Only users with role 'traveller' (Guests) may submit surveys. Admin & Leader are rejected with 403.
 *   3. The guest must be an enrolled member of the submitted trip (trip_members).
 *   4. Validates question & answer lengths; rejects empty submission.
 *   5. Atomic write: all response rows inserted in a single database operation.
 */

const SurveySchema = z.object({
  trip_id: z.string().uuid('trip_id must be a valid UUID'),
  responses: z.array(
    z.object({
      question: z.string().trim().min(1, 'Question cannot be empty').max(500, 'Question cannot exceed 500 characters'),
      answer:   z.string().trim().max(2000, 'Answer cannot exceed 2000 characters').optional().nullable(),
    }),
  ).min(1, 'Provide at least one response'),
})

export async function POST(req: NextRequest) {
  const profile = await getSession()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Reject Admin and Leader roles; only Guests ('traveller') can submit surveys
  if (profile.role !== 'traveller') {
    return NextResponse.json(
      { error: 'Forbidden: Surveys may only be submitted by guests/travellers' },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SurveySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { trip_id, responses } = parsed.data
  const admin = createAdminClient()

<<<<<<< HEAD
  // Verify user role: survey is only available to guests (travellers) and not admins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (admin.from('profiles') as any)
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'traveller') {
    return NextResponse.json({ error: 'Surveys are only available to guests' }, { status: 403 })
  }

  // Verify user is a member of this trip
=======
  // Verify trip exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trip } = await (admin.from('trips') as any)
    .select('id')
    .eq('id', trip_id)
    .maybeSingle()

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // Verify user is an enrolled member of this trip
>>>>>>> origin/main
  const { count } = await admin
    .from('trip_members')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', trip_id)
    .eq('user_id', profile.id)

  if ((count ?? 0) === 0) {
<<<<<<< HEAD
    return NextResponse.json({ error: 'You are not a registered guest on this trail' }, { status: 403 })
=======
    return NextResponse.json(
      { error: 'Forbidden: You are not an enrolled member of this trip' },
      { status: 403 },
    )
>>>>>>> origin/main
  }

  const rows = responses.map(r => ({
    trip_id,
    user_id: profile.id,
    question: r.question,
    answer: r.answer || null,
  }))

  // Atomic batch insert: single SQL statement ensures all rows succeed or fail together
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('survey_responses') as any)
    .insert(rows)
    .select('id, question, answer, created_at')

  if (error) {
    return NextResponse.json({ error: 'Failed to record survey responses' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, submitted: data?.length ?? 0, data }, { status: 201 })
}

