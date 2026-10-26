import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET /api/leader/guests — list guests assigned to the authenticated leader
 * For Leaders: only returns guests assigned to auth.uid()
 * For Admins: returns all assigned guests or filtered by ?leader_id=
 */
export async function GET(req: NextRequest) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (profile.role !== 'leader' && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Leader access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const targetLeaderId = profile.role === 'admin'
    ? (searchParams.get('leader_id') || profile.id)
    : profile.id

  const admin = createAdminClient()

  // 1. Get trips led by target leader
  const { data: ledTrips } = await admin
    .from('trips')
    .select('id')
    .eq('leader_id', targetLeaderId)

  const tripIds = (ledTrips ?? []).map((t: { id: string }) => t.id)

  let memberUserIds: string[] = []
  if (tripIds.length > 0) {
    const { data: members } = await admin
      .from('trip_members')
      .select('user_id')
      .in('trip_id', tripIds)
    memberUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
  }

  // 2. Legacy leader_id on profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: legacyGuests } = await (admin.from('profiles') as any)
    .select('id')
    .eq('leader_id', targetLeaderId)

  const legacyIds = (legacyGuests ?? []).map((g: { id: string }) => g.id)
  const allGuestIds = Array.from(new Set([...memberUserIds, ...legacyIds]))

  if (allGuestIds.length === 0) {
    return NextResponse.json({
      leader_id: targetLeaderId,
      total: 0,
      data: [],
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('profiles') as any)
    .select('id, phone, first_name, last_name, email, location, is_active, date_of_joining, remarks, traveller_details(*)')
    .in('id', allGuestIds)
    .order('first_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    leader_id: targetLeaderId,
    total: data?.length ?? 0,
    data: data ?? [],
  })
}
