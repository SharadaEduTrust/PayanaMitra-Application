import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET    /api/admin/trips/[id]/days   — list all itinerary days (in ascending day order, with activities)
 * POST   /api/admin/trips/[id]/days   — create a new itinerary day (with optional nested activities)
 */

interface Params { params: Promise<{ id: string }> }

const MealPlanSchema = z.enum([
  'Breakfast',
  'Breakfast & Dinner',
  'Lunch & Dinner',
  'Breakfast, Lunch & Dinner',
]).nullable().optional()

const ActivityInputSchema = z.object({
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

const CreateDaySchema = z.object({
  day_number:     z.number().int().min(1, 'Day number must be >= 1'),
  destination:    z.string().max(100, 'Destination max 100 characters').optional().nullable(),
  itinerary_text: z.string().max(500, 'Description / itinerary text max 500 characters').optional().nullable(),
  hotel_name:     z.string().max(100, 'Hotel name max 100 characters').optional().nullable(),
  meal_plan:      MealPlanSchema,
  activities:     z.array(ActivityInputSchema).optional(),
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

  const { id: trip_id } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('itinerary_days') as any)
    .select('*, activities(id, title, description, start_time, end_time, activity_order, created_at)')
    .eq('trip_id', trip_id)
    .order('day_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Ensure activities within each day are ordered by activity_order
  const sorted = (data ?? []).map((day: { activities?: Record<string, unknown>[] }) => {
    if (Array.isArray(day.activities)) {
      day.activities.sort((a, b) => ((a.activity_order as number) ?? 999) - ((b.activity_order as number) ?? 999))
    }
    return day
  })

  return NextResponse.json({ data: sorted })
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateDaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { activities, ...dayFields } = parsed.data
  const admin = createAdminClient()

  // Check unique day_number for this trip
  const { count: existingDay } = await admin
    .from('itinerary_days')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', trip_id)
    .eq('day_number', dayFields.day_number)

  if ((existingDay ?? 0) > 0) {
    return NextResponse.json(
      { error: `Day ${dayFields.day_number} already exists for this trip.` },
      { status: 409 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: newDay, error: dayErr } = await (admin.from('itinerary_days') as any)
    .insert({ ...dayFields, trip_id })
    .select()
    .single()

  if (dayErr && dayErr.message.includes('meal_plan')) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { meal_plan, ...fallbackFields } = dayFields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry = await (admin.from('itinerary_days') as any)
      .insert({ ...fallbackFields, trip_id })
      .select()
      .single()
    newDay = retry.data
    dayErr = retry.error
  }

  if (dayErr || !newDay) {
    return NextResponse.json({ error: dayErr?.message ?? 'Failed to create itinerary day' }, { status: 500 })
  }

  // Insert activities if provided
  let createdActivities: unknown[] = []
  if (activities && activities.length > 0) {
    const actInserts = activities.map((act, idx) => ({
      ...act,
      itinerary_day_id: newDay.id,
      activity_order: act.activity_order ?? (idx + 1),
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: acts, error: actsErr } = await (admin.from('activities') as any)
      .insert(actInserts)
      .select()

    if (!actsErr && acts) {
      createdActivities = acts
    }
  }

  return NextResponse.json(
    { data: { ...newDay, activities: createdActivities } },
    { status: 201 },
  )
}
