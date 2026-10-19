import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * POST /api/admin/notifications — send in-app notification to one or more user IDs
 */

const SendNotificationSchema = z.object({
  recipients: z.array(z.string().uuid('Invalid user ID')).min(1, 'At least one recipient is required'),
  title:      z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  body:       z.string().max(2000, 'Body cannot exceed 2000 characters').optional().nullable(),
})

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = SendNotificationSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { recipients, title, body } = parsed.data
  const admin = createAdminClient()

  const rows = recipients.map(user_id => ({
    user_id,
    title: title.trim(),
    body: body?.trim() || null,
    is_read: false,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('notifications') as any)
    .insert(rows)
    .select('id, user_id, title, created_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: data?.length ?? rows.length }, { status: 201 })
}
