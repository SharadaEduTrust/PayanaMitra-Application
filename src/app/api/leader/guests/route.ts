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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = (admin.from('profiles') as any)
    .select('id, phone, first_name, last_name, email, location, is_active, date_of_joining, remarks, traveller_details(*)')
    .eq('leader_id', targetLeaderId)
    .order('first_name', { ascending: true })

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    leader_id: targetLeaderId,
    total: data?.length ?? 0,
    data: data ?? [],
  })
}
