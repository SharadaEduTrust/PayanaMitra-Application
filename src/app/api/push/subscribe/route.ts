import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * POST /api/push/subscribe
 *
 * Stores a Web Push subscription for the authenticated user so that the
 * admin can later send push notifications to trip members.
 *
 * The client should pass the full PushSubscription JSON object:
 * {
 *   endpoint: string,
 *   keys: { p256dh: string, auth: string }
 * }
 *
 * Upserting on (user_id, endpoint) means re-subscribing the same device
 * is safe and idempotent.
 */

const SubscribeSchema = z.object({
  endpoint: z.string().url('endpoint must be a valid URL'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
})

export async function POST(req: NextRequest) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { endpoint, keys } = parsed.data
  const admin = createAdminClient()

  // Upsert: one row per (user_id, endpoint). If the device re-subscribes,
  // the p256dh/auth keys get refreshed in place.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('push_subscriptions') as any)
    .upsert(
      { user_id: profile.id, endpoint, p256dh: keys.p256dh, auth_key: keys.auth },
      { onConflict: 'user_id,endpoint', ignoreDuplicates: false },
    )
    .select('id, endpoint, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

/**
 * DELETE /api/push/subscribe
 *
 * Removes a device's push subscription (called when the user revokes
 * push permission in the browser).
 *
 * Body: { endpoint: string }
 */
export async function DELETE(req: NextRequest) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = z.object({ endpoint: z.string().url() }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', profile.id)
    .eq('endpoint', parsed.data.endpoint)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
