import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET    /api/admin/trips/[id]/days   — list all itinerary days (with activities)
 * POST   /api/admin/trips/[id]/days   — create a new itinerary day
 */

interface Params { params: Promise<{ id: string }> }

const CreateDaySchema = z.object({
  day_number:     z.number().int().min(1, 'Day number must be ≥ 1'),
  destination:    z.string().max(200).optional().nullable(),
  itinerary_text: z.string().max(10000).optional().nullable(),
  hotel_name:     z.string().max(200).optional().nullable(),
})

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── GET /api/admin/trips/[id]/days ──────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('itinerary_days')
    .select('*, activities(id, title, description, start_time, end_time, activity_order)')
    .eq('trip_id', trip_id)
    .order('day_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ─── POST /api/admin/trips/[id]/days ─────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateDaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('itinerary_days') as any)
    .insert({ ...parsed.data, trip_id })
    .select()
    .single()

  if (error) {
    // Unique constraint: trip_id + day_number
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Day ${parsed.data.day_number} already exists for this trip.` },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
