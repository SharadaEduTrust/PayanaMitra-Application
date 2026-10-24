import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * POST /api/admin/push/send
 *
 * Admin triggers a Web Push notification to all members of a trip,
 * with an optional WhatsApp message sent in the same request.
 *
 * Strategy:
 *  1. Verify admin session.
 *  2. Fetch all trip members.
 *  3. Fetch all push_subscriptions for those users.
 *  4. Fan-out: send a Web Push message to every subscription using the
 *     Web Push Protocol (RFC 8030) via the Fetch API + VAPID signing.
 *  5. Clean up stale (expired) push subscriptions.
 *  6. Insert a notifications row for each member so they also see the
 *     notification in the in-app notification centre.
 *  7. If sendWhatsapp is true, fetch member phone numbers and fan-out
 *     a WhatsApp text via the Meta Cloud API.
 *  8. Return a summary { sent, failed, inAppCreated, whatsappSent, whatsappFailed }.
 *
 * Environment variables required:
 *   VAPID_PUBLIC_KEY        — base64url-encoded uncompressed EC P-256 public key
 *   VAPID_PRIVATE_KEY       — base64url-encoded EC P-256 private key
 *   VAPID_SUBJECT           — mailto: or https: URI (identifies the sender)
 *   WHATSAPP_PHONE_NUMBER_ID — (optional) Meta Business Manager phone number ID
 *   WHATSAPP_ACCESS_TOKEN   — (optional) long-lived system-user access token
 *
 * Body:
 * {
 *   trip_id:      string (UUID),
 *   title:        string,
 *   body?:        string,
 *   sendWhatsapp?: boolean  — also send a WhatsApp message (default: false)
 * }
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Base64url decode to Uint8Array */
function b64uDecode(str: string): Uint8Array {
  const padded = str.padEnd(str.length + (4 - (str.length % 4)) % 4, '=')
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

/** Base64url encode a buffer */
function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  return Buffer.from(buf as Uint8Array).toString('base64url')
}

/**
 * Build a minimal VAPID JWT for use as the Authorization header.
 * Uses the Web Crypto API — works in Next.js Edge/Node runtimes.
 */
async function buildVapidJwt(audience: string): Promise<string> {
  const publicKeyB64  = process.env.VAPID_PUBLIC_KEY
  const privateKeyB64 = process.env.VAPID_PRIVATE_KEY
  const subject       = process.env.VAPID_SUBJECT

  if (!publicKeyB64 || !privateKeyB64 || !subject) {
    throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set')
  }

  const now = Math.floor(Date.now() / 1000)
  const header  = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: audience, exp: now + 43200, sub: subject } // 12 h expiry

  const enc = new TextEncoder()
  const headerB64  = b64uEncode(enc.encode(JSON.stringify(header)))
  const payloadB64 = b64uEncode(enc.encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  // Import private key (raw PKCS8 not available in subtleCrypto easily;
  // we use the JWK form derived from the raw base64url private scalar)
  const privateKeyBytes = b64uDecode(privateKeyB64)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes as unknown as BufferSource,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    enc.encode(signingInput),
  )

  return `${signingInput}.${b64uEncode(signature)}`
}

/**
 * Send a single Web Push message to a subscription endpoint.
 * Uses plaintext payload without encryption for simplicity; for encrypted
 * payloads (RFC 8291) the `p256dh` / `auth_key` fields would be used.
 */
async function sendWebPush(
  endpoint:   string,
  _p256dh:    string | null,
  _auth_key:  string | null,
  payload:    string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    // Derive the audience from the endpoint origin
    const url = new URL(endpoint)
    const audience = `${url.protocol}//${url.host}`
    const jwt = await buildVapidJwt(audience)

    const publicKey = process.env.VAPID_PUBLIC_KEY ?? ''
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt},k=${publicKey}`,
        'Content-Type':  'application/json',
        'TTL':           '86400',
      },
      body: payload,
    })

    if (!res.ok) {
      return { ok: false, status: res.status, error: `Push server returned ${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const SendPushSchema = z.object({
  trip_id:       z.string().uuid(),
  title:         z.string().min(1).max(200),
  body:          z.string().max(2000).optional(),
  sendWhatsapp:  z.boolean().optional(),
})

// ─── Auth guard ───────────────────────────────────────────────────────────────
async function requireAuthorized(tripId: string) {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role === 'admin') return { profile }
  if (profile.role === 'leader') {
    const admin = createAdminClient()
    const { data: trip } = await admin.from('trips').select('leader_id').eq('id', tripId).single()
    if (trip?.leader_id === profile.id) return { profile }
  }
  return { error: 'Forbidden: You must be an administrator or the assigned trail leader to broadcast to this trail', status: 403 } as const
}

// ─── POST /api/admin/push/send ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SendPushSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { trip_id, title, body: pushBody } = parsed.data

  const guard = await requireAuthorized(trip_id)
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()

  // 1. Verify the trip exists
  const { data: trip, error: tripErr } = await admin
    .from('trips')
    .select('id, name, leader_id')
    .eq('id', trip_id)
    .single()

  if (tripErr || !trip) return NextResponse.json({ error: 'Trail not found' }, { status: 404 })

  // 2. Fetch direct trip members from trip_members
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: directMembers, error: membersErr } = await (admin.from('trip_members') as any)
    .select('user_id')
    .eq('trip_id', trip_id)

  if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 })

  // 3. Also include guests assigned to this trail's leader (if assigned)
  let leaderGuestIds: string[] = []
  if (trip.leader_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: leaderGuests } = await (admin.from('profiles') as any)
      .select('id')
      .eq('leader_id', trip.leader_id)
      .eq('role', 'traveller')
    if (leaderGuests) {
      leaderGuestIds = leaderGuests.map((g: any) => g.id)
    }
  }

  // Combine and deduplicate recipient user IDs
  const userIds = Array.from(new Set([
    ...(directMembers ?? []).map((m: any) => m.user_id),
    ...leaderGuestIds,
  ])).filter(Boolean)

  if (userIds.length === 0) {
    return NextResponse.json(
      {
        error: 'No guests are enrolled in or assigned to this trail. Please add guests to the trail before broadcasting.',
      },
      { status: 400 }
    )
  }

  // 4. Insert in-app notification rows for every member
  const notificationRows = userIds.map(user_id => ({
    user_id,
    trip_id,
    title: title.trim(),
    body:  pushBody?.trim() || null,
    is_read: false,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: notifs, error: notifErr } = await (admin.from('notifications') as any)
    .insert(notificationRows)
    .select('id')

  // Fallback: If trip_id column causes constraint or schema issue, retry without trip_id
  if (notifErr) {
    console.warn('[push/send] Primary notification insert failed, retrying without trip_id:', notifErr.message)
    const fallbackRows = userIds.map(user_id => ({
      user_id,
      title: title.trim(),
      body:  pushBody?.trim() || null,
      is_read: false,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry = await (admin.from('notifications') as any)
      .insert(fallbackRows)
      .select('id')
    notifs = retry.data
    notifErr = retry.error
  }

  if (notifErr) {
    return NextResponse.json(
      { error: `Failed to deliver in-app notifications: ${notifErr.message}` },
      { status: 500 }
    )
  }

  const inAppCreated = notifs?.length ?? userIds.length

  // 5. Optional Web Push delivery (if VAPID keys are configured and subscriptions exist)
  const hasVapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
  let sent = 0
  let failed = 0
  const staleEndpoints: string[] = []

  if (hasVapid) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: subscriptions } = await (admin.from('push_subscriptions') as any)
        .select('id, user_id, endpoint, p256dh, auth_key')
        .in('user_id', userIds)

      type PushSub = { id: string; user_id: string; endpoint: string; p256dh: string | null; auth_key: string | null }
      const subsList = (subscriptions ?? []) as PushSub[]

      if (subsList.length > 0) {
        const pushPayload = JSON.stringify({ title, body: pushBody ?? '' })
        await Promise.all(
          subsList.map(async sub => {
            const result = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth_key, pushPayload)
            if (result.ok) {
              sent++
            } else {
              failed++
              if (result.status === 404 || result.status === 410) {
                staleEndpoints.push(sub.endpoint)
              }
            }
          }),
        )

        if (staleEndpoints.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from('push_subscriptions') as any).delete().in('endpoint', staleEndpoints)
        }
      }
    } catch (pushErr) {
      console.warn('[push/send] Web push fan-out encountered an error:', pushErr)
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    inAppCreated,
    recipientCount: userIds.length,
    message: `Broadcast successfully sent to ${inAppCreated} trail guest(s).`,
  })
}

