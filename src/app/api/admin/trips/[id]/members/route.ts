import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET    /api/admin/trips/[id]/members  — list all members of a trip
 * POST   /api/admin/trips/[id]/members  — enrol one or more users
 * DELETE /api/admin/trips/[id]/members  — remove one or more users
 */

interface Params { params: Promise<{ id: string }> }

const EnrolSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1, 'Provide at least one user_id'),
})

const RemoveSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1, 'Provide at least one user_id'),
})

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── GET /api/admin/trips/[id]/members ───────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('trip_members')
    .select('id, created_at, profiles(id, first_name, last_name, phone, email, role, is_active)')
    .eq('trip_id', trip_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

// ─── POST /api/admin/trips/[id]/members ──────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = EnrolSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const admin = createAdminClient()

  const rows = parsed.data.user_ids.map(user_id => ({ trip_id, user_id }))

  // upsert — ignore duplicates (unique constraint on trip_id + user_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('trip_members') as any)
    .upsert(rows, { onConflict: 'trip_id,user_id', ignoreDuplicates: true })
    .select('id, user_id, created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, enrolled: data?.length ?? 0 }, { status: 201 })
}

// ─── DELETE /api/admin/trips/[id]/members ────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RemoveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('trip_members')
    .delete()
    .eq('trip_id', trip_id)
    .in('user_id', parsed.data.user_ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
