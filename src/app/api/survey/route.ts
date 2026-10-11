import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/survey
 *
 * Body: { trip_id, responses: [{ question, answer }] }
 *
 * Batch-inserts all survey answers for a trip in one request.
 * User must be a member of the trip.
 */

const SurveySchema = z.object({
  trip_id: z.string().uuid('trip_id must be a UUID'),
  responses: z.array(
    z.object({
      question: z.string().min(1, 'Question cannot be empty').max(500),
      answer:   z.string().max(2000).optional().nullable(),
    }),
  ).min(1, 'Provide at least one response'),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
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

  // Verify user is a member of this trip
  const { count } = await admin
    .from('trip_members')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', trip_id)
    .eq('user_id', user.id)

  if ((count ?? 0) === 0) {
    return NextResponse.json({ error: 'Not a member of this trip' }, { status: 403 })
  }

  const rows = responses.map(r => ({
    trip_id,
    user_id: user.id,
    question: r.question,
    answer: r.answer ?? null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('survey_responses') as any)
    .insert(rows)
    .select('id, question, answer, created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, submitted: data?.length ?? 0 }, { status: 201 })
}
