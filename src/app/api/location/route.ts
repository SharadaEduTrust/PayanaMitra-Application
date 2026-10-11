import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/location
 *
 * Body: { trip_id, lat, lng, accuracy? }
 *
 * Accepts a GPS ping from a traveller's device and stores it in
 * location_updates. The user must be an active member of the trip.
 *
 * Rate limit: caller should throttle to once every 30–60 seconds.
 * This endpoint does NOT throttle — that should be done client-side
 * or via an edge middleware if needed.
 */

const LocationSchema = z.object({
  trip_id:  z.string().uuid('trip_id must be a UUID'),
  lat:      z.number().min(-90).max(90),
  lng:      z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = LocationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { trip_id, lat, lng, accuracy } = parsed.data
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('location_updates') as any)
    .insert({
      trip_id,
      user_id: user.id,
      lat,
      lng,
      accuracy: accuracy ?? null,
    })
    .select('id, lat, lng, accuracy, recorded_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
