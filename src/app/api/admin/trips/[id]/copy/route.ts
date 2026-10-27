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
 */

interface Params { params: Promise<{ id: string }> }

const CopySchema = z.object({
  new_trip_code:  z.string().min(1, 'New trip code is required').max(50, 'Max 50 characters'),
  new_name:       z.string().min(1, 'New name is required').max(100, 'Max 100 characters'),
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

  // 1. Check new trip_code uniqueness
  const { count: codeExists } = await admin
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('trip_code', new_trip_code)

  if ((codeExists ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: { new_trip_code: ['Trip code already exists.'] } },
      { status: 422 },
    )
  }

  // 2. Fetch source trip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: src, error: srcErr } = await (admin.from('trips') as any)
    .select('*')
    .eq('id', source_trip_id)
    .single()

  if (srcErr || !src) {
    return NextResponse.json({ error: 'Source trip not found' }, { status: 404 })
  }

  // Calculate date shift if new_start_date is given
  let calculatedEndDate = src.end_date
  if (new_start_date && src.start_date && src.end_date) {
    const diffMs = new Date(src.end_date).getTime() - new Date(src.start_date).getTime()
    const newEndMs = new Date(new_start_date).getTime() + diffMs
    calculatedEndDate = new Date(newEndMs).toISOString().split('T')[0]
  }

  // 3. Create new trip
  const newTripPayload: Record<string, unknown> = {
    trip_code: new_trip_code,
    name: new_name,
    destination: src.destination,
    start_date: new_start_date ?? src.start_date,
    end_date: calculatedEndDate,
    leader_id: src.leader_id,
    status: 'draft',
    is_active: true,
    remarks: src.remarks,
  }

  const srcRecord = src as unknown as Record<string, unknown>
  if (srcRecord.feedback_form_url !== undefined) {
    newTripPayload.feedback_form_url = srcRecord.feedback_form_url
  }
  if (srcRecord.feedback_window_days !== undefined) {
    newTripPayload.feedback_window_days = srcRecord.feedback_window_days
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: newTrip, error: createErr } = await (admin.from('trips') as any)
    .insert(newTripPayload)
    .select()
    .single()

  if (createErr && (createErr.code === '42703' || String(createErr.message).includes('feedback_form_url'))) {
    delete newTripPayload.feedback_form_url
    delete newTripPayload.feedback_window_days
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry = await (admin.from('trips') as any)
      .insert(newTripPayload)
      .select()
      .single()
    newTrip = retry.data
    createErr = retry.error
  }

  if (createErr || !newTrip) {
    return NextResponse.json({ error: createErr?.message ?? 'Failed to create new trip' }, { status: 500 })
  }

  // 4. Fetch source itinerary days and activities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: oldDays } = await (admin.from('itinerary_days') as any)
    .select('*, activities(*)')
    .eq('trip_id', source_trip_id)
    .order('day_number', { ascending: true })

  // 5. Copy itinerary days and activities
  for (const oldDay of (oldDays ?? [])) {
    const dayInsertPayload: Record<string, unknown> = {
      trip_id: newTrip.id,
      day_number: oldDay.day_number,
      destination: oldDay.destination,
      itinerary_text: oldDay.itinerary_text,
      hotel_name: oldDay.hotel_name,
    }
    if (oldDay.meal_plan !== undefined) {
      dayInsertPayload.meal_plan = oldDay.meal_plan
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newDay, error: dayErr } = await (admin.from('itinerary_days') as any)
      .insert(dayInsertPayload)
      .select('id')
      .single()

    if (!dayErr && newDay && oldDay.activities?.length > 0) {
      const activitiesToInsert = oldDay.activities.map((act: Record<string, unknown>) => ({
        itinerary_day_id: newDay.id,
        title: act.title,
        description: act.description,
        start_time: act.start_time,
        end_time: act.end_time,
        activity_order: act.activity_order,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('activities') as any).insert(activitiesToInsert)
    }
  }

  // Fetch full duplicated trip with joined leader info
  const { data: fullTrip } = await admin
    .from('trips')
    .select('*, profiles!trips_leader_id_fkey(id, first_name, last_name, phone)')
    .eq('id', newTrip.id)
    .single()

  return NextResponse.json({ data: fullTrip ?? newTrip }, { status: 201 })
}
