import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/notifications/[notificationId]/read
 *
 * Marks a single notification as read. User can only mark their own.
 */

interface Params { params: Promise<{ notificationId: string }> }

export async function PATCH(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { notificationId } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('notifications') as any)
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)  // scope to owner
    .select('id, is_read')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })

  return NextResponse.json({ data })
}
