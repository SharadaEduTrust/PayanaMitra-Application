import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

const AssignGuestsSchema = z.object({
  leader_id: z.string().uuid('Invalid leader ID'),
  guest_ids: z.array(z.string().uuid('Invalid guest ID')).min(1, 'At least one guest ID required'),
})

/**
 * GET  /api/admin/leaders — list all users with role 'leader' or 'admin', with assigned guest count
 * POST /api/admin/leaders — bulk assign guests to a leader
 */
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()

  // 1. Fetch all leaders & admins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leaders, error: leaderErr } = await (admin.from('profiles') as any)
    .select('id, phone, first_name, last_name, role, is_active, email, location')
    .in('role', ['leader', 'admin'])
    .order('first_name', { ascending: true })

  if (leaderErr) return NextResponse.json({ error: leaderErr.message }, { status: 500 })

  // 2. Fetch assigned guest counts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: guests, error: guestErr } = await (admin.from('profiles') as any)
    .select('id, leader_id')
    .not('leader_id', 'is', null)

  if (guestErr) return NextResponse.json({ error: guestErr.message }, { status: 500 })

  const countByLeader: Record<string, number> = {}
  for (const g of (guests ?? [])) {
    if (g.leader_id) {
      countByLeader[g.leader_id] = (countByLeader[g.leader_id] ?? 0) + 1
    }
  }

  const result = (leaders ?? []).map((l: Record<string, unknown>) => ({
    ...l,
    assigned_guests_count: countByLeader[l.id as string] ?? 0,
  }))

  return NextResponse.json({ data: result })
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AssignGuestsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { leader_id, guest_ids } = parsed.data
  const admin = createAdminClient()

  // Verify leader exists and has role leader or admin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leaderProfile, error: leaderErr } = await (admin.from('profiles') as any)
    .select('id, role, first_name, last_name')
    .eq('id', leader_id)
    .single()

  if (leaderErr || !leaderProfile || !['leader', 'admin'].includes(leaderProfile.role)) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: { leader_id: ['Target user must have leader or admin role.'] } },
      { status: 422 },
    )
  }

  // Update guests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateErr } = await (admin.from('profiles') as any)
    .update({ leader_id, updated_at: new Date().toISOString() })
    .in('id', guest_ids)
    .eq('role', 'traveller') // only guests can be assigned
    .select('id, first_name, last_name, phone, leader_id')

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({
    message: `Assigned ${updated?.length ?? 0} guests to leader ${leaderProfile.first_name} ${leaderProfile.last_name}`,
    assigned: updated ?? [],
  })
}
