import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'
import { sendWhatsAppBulk } from '@/lib/server/whatsapp'

/**
 * POST /api/admin/whatsapp/send
 *
 * Admin sends a WhatsApp message to all members of a trip.
 *
 * Strategy:
 *  1. Verify admin session.
 *  2. Verify the trip exists.
 *  3. Fetch all trip member user IDs.
 *  4. Fetch the `phone` field from their `profiles` rows.
 *  5. Fan-out via WhatsApp Cloud API.
 *  6. Optionally insert in-app notification rows (controlled by `createInApp`).
 *  7. Return { sent, failed, inAppCreated }.
 *
 * Environment variables required:
 *   WHATSAPP_PHONE_NUMBER_ID  — Meta Business Manager phone number ID
 *   WHATSAPP_ACCESS_TOKEN     — Long-lived system-user access token
 *
 * Body:
 * {
 *   trip_id:      string (UUID),
 *   message:      string  (plain-text body, max 4096 chars),
 *   createInApp?: boolean (default true — also create an in-app notification),
 * }
 */

// ─── Schema ───────────────────────────────────────────────────────────────────

const SendWhatsAppSchema = z.object({
  trip_id:      z.string().uuid(),
  message:      z.string().min(1).max(4096),
  createInApp:  z.boolean().optional().default(true),
})

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── POST /api/admin/whatsapp/send ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth check
  const guard = await requireAdmin()
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  // 2. Parse body
  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SendWhatsAppSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { trip_id, message, createInApp } = parsed.data
  const admin = createAdminClient()

  // 3. Verify trip exists
  const { data: trip, error: tripErr } = await admin
    .from('trips')
    .select('id, name')
    .eq('id', trip_id)
    .single()

  if (tripErr || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  // 4. Fetch trip member user IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members, error: membersErr } = await (admin.from('trip_members') as any)
    .select('user_id')
    .eq('trip_id', trip_id)

  if (membersErr) {
    return NextResponse.json({ error: membersErr.message }, { status: 500 })
  }

  if (!members || members.length === 0) {
    return NextResponse.json({
      sent: 0, failed: 0, inAppCreated: 0,
      message: 'No members in this trip',
    })
  }

  const userIds = (members as Array<{ user_id: string }>).map(m => m.user_id)

  // 5. Fetch phone numbers from profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles, error: profilesErr } = await (admin.from('profiles') as any)
    .select('id, phone')
    .in('id', userIds)

  if (profilesErr) {
    return NextResponse.json({ error: profilesErr.message }, { status: 500 })
  }

  const profilesWithPhone = ((profiles ?? []) as Array<{ id: string; phone: string | null }>)
    .filter(p => p.phone)

  if (profilesWithPhone.length === 0) {
    return NextResponse.json({
      sent: 0, failed: 0, inAppCreated: 0,
      message: 'No members have a phone number on file',
    })
  }

  // 6. Fan-out WhatsApp messages
  const phones = profilesWithPhone.map(p => p.phone as string)
  const results = await sendWhatsAppBulk(phones, message)

  let sent   = 0
  let failed = 0
  for (const r of results) {
    if (r.ok) { sent++ } else {
      failed++
      console.warn(`[whatsapp/send] Failed to send to ${r.to}: ${r.error}`)
    }
  }

  // 7. Optionally create in-app notifications
  let inAppCreated = 0
  if (createInApp) {
    // Use the first line of the message as the title (max 200 chars)
    const title = message.split('\n')[0].slice(0, 200)
    const notificationRows = userIds.map(user_id => ({
      user_id,
      trip_id,
      title,
      body:    message.length > 200 ? message : null,
      is_read: false,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: notifs, error: notifErr } = await (admin.from('notifications') as any)
      .insert(notificationRows)
      .select('id')

    if (notifErr) {
      // Non-fatal — WhatsApp was already sent
      console.error('[whatsapp/send] Failed to insert in-app notifications:', notifErr.message)
    } else {
      inAppCreated = notifs?.length ?? 0
    }
  }

  return NextResponse.json({ sent, failed, inAppCreated })
}
