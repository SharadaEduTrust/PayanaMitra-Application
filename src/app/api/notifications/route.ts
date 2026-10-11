import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET   /api/notifications           — list logged-in user's notifications
 * PATCH /api/notifications            — mark ALL as read
 */

// ─── GET /api/notifications ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'

  const admin = createAdminClient()

  let query = admin
    .from('notifications')
    .select('id, title, body, is_read, trip_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (unreadOnly) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq('is_read', false)
  }

  const { data, error } = await query as {
    data: Array<{ id: string; title: string; body: string | null; is_read: boolean; trip_id: string | null; created_at: string }> | null
    error: { message: string } | null
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unreadCount = (data ?? []).filter(n => !n.is_read).length
  return NextResponse.json({ data, unreadCount })
}

// ─── PATCH /api/notifications — mark ALL unread as read ───────────────────────
export async function PATCH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from('notifications') as any)
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
