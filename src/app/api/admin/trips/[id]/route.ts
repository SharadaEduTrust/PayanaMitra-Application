import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET    /api/admin/trips/[id]   — get single trip (with leader info)
 * PATCH  /api/admin/trips/[id]   — update trip fields
 * DELETE /api/admin/trips/[id]   — hard delete trip (use with caution)
 */

interface Params { params: Promise<{ id: string }> }

const UpdateTripSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  destination: z.string().max(200).optional().nullable(),
  start_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  leader_id:   z.string().uuid().optional().nullable(),
  is_active:   z.boolean().optional(),
  remarks:     z.string().max(2000).optional().nullable(),
}).strict()

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── GET /api/admin/trips/[id] ────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('trips')
    .select('*, profiles!trips_leader_id_fkey(id, first_name, last_name, phone, email)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  return NextResponse.json({ data })
}

// ─── PATCH /api/admin/trips/[id] ─────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateTripSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('trips') as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  return NextResponse.json({ data })
}

// ─── DELETE /api/admin/trips/[id] ────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params
  const admin = createAdminClient()

  const { error } = await admin.from('trips').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
