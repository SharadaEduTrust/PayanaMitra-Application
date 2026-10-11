import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET    /api/admin/trips/[id]/days/[dayId]  — get single day (with activities)
 * PATCH  /api/admin/trips/[id]/days/[dayId]  — update day fields
 * DELETE /api/admin/trips/[id]/days/[dayId]  — delete day (cascades activities)
 */

interface Params { params: Promise<{ id: string; dayId: string }> }

const UpdateDaySchema = z.object({
  day_number:     z.number().int().min(1).optional(),
  destination:    z.string().max(200).optional().nullable(),
  itinerary_text: z.string().max(10000).optional().nullable(),
  hotel_name:     z.string().max(200).optional().nullable(),
}).strict()

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id, dayId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('itinerary_days')
    .select('*, activities(id, title, description, start_time, end_time, activity_order)')
    .eq('id', dayId)
    .eq('trip_id', trip_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Day not found' }, { status: 404 })
  return NextResponse.json({ data })
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id, dayId } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateDaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('itinerary_days') as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', dayId)
    .eq('trip_id', trip_id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That day number already exists for this trip.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Day not found' }, { status: 404 })

  return NextResponse.json({ data })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id, dayId } = await params
  const admin = createAdminClient()

  // Activities cascade-delete via DB foreign key (ON DELETE CASCADE)
  const { error } = await admin
    .from('itinerary_days')
    .delete()
    .eq('id', dayId)
    .eq('trip_id', trip_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
