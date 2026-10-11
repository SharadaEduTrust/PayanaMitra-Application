import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * POST /api/admin/trips/[id]/copy
 *
 * Body: { new_trip_code, new_name, new_start_date? }
 *
 * Duplicates the trip and its full itinerary (days + activities).
 * Members are NOT copied. New trip starts in 'draft' status.
 * Delegates to the copy_trip() Postgres function defined in migration 004.
 */

interface Params { params: Promise<{ id: string }> }

const CopySchema = z.object({
  new_trip_code:  z.string().min(1, 'New trip code is required').max(50),
  new_name:       z.string().min(1, 'New name is required').max(200),
  new_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().nullable(),
})

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: source_trip_id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CopySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { new_trip_code, new_name, new_start_date } = parsed.data
  const admin = createAdminClient()

  // Check new trip_code uniqueness
  const { count } = await admin
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('trip_code', new_trip_code)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: { new_trip_code: ['Trip code already exists.'] } },
      { status: 422 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newTripId, error } = await (admin as any).rpc('copy_trip', {
    source_trip_id,
    new_trip_code,
    new_name,
    ...(new_start_date ? { new_start_date } : {}),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return the newly created trip
  const { data: newTrip } = await admin
    .from('trips')
    .select('*')
    .eq('id', newTripId as string)
    .single()

  return NextResponse.json({ data: newTrip }, { status: 201 })
}
