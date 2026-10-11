import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * POST /api/admin/push/send
 *
 * Admin triggers a Web Push notification to all members of a trip.
 *
 * Strategy:
 *  1. Verify admin session.
 *  2. Fetch all trip members.
 *  3. Fetch all push_subscriptions for those users.
 *  4. Fan-out: send a Web Push message to every subscription using the
 *     Web Push Protocol (RFC 8030) via the Fetch API + VAPID signing.
 *  5. Insert a notifications row for each member so they also see the
 *     notification in the in-app notification centre.
 *  6. Return a summary { sent, failed, inAppCreated }.
 *
 * Environment variables required:
 *   VAPID_PUBLIC_KEY   — base64url-encoded uncompressed EC P-256 public key
 *   VAPID_PRIVATE_KEY  — base64url-encoded EC P-256 private key
 *   VAPID_SUBJECT      — mailto: or https: URI (identifies the sender)
 *
 * Body:
 * {
 *   trip_id:  string (UUID),
 *   title:    string,
 *   body?:    string,
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

/** Base64url encode a Uint8Array */
function b64uEncode(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString('base64url')
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
    privateKeyBytes,
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
  trip_id: z.string().uuid(),
  title:   z.string().min(1).max(200),
  body:    z.string().max(500).optional(),
})

// ─── Auth guard ───────────────────────────────────────────────────────────────
async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── POST /api/admin/push/send ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SendPushSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { trip_id, title, body: pushBody } = parsed.data
  const admin = createAdminClient()

  // 1. Verify the trip exists
  const { data: trip, error: tripErr } = await admin.from('trips').select('id, name').eq('id', trip_id).single()
  if (tripErr || !trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  // 2. Fetch trip member user IDs
  const { data: members, error: membersErr } = await admin
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', trip_id)

  if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 })
  if (!members || members.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, inAppCreated: 0, message: 'No members in this trip' })
  }

  const userIds = members.map(m => m.user_id)

  // 3. Fetch all push subscriptions for these users
  const { data: subscriptions, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth_key')
    .in('user_id', userIds)

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })

  // 4. Fan-out Web Push
  const pushPayload = JSON.stringify({ title, body: pushBody ?? '' })
  let sent = 0
  let failed = 0
  const staleEndpoints: string[] = []

  await Promise.all(
    (subscriptions ?? []).map(async sub => {
      const result = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth_key, pushPayload)
      if (result.ok) {
        sent++
      } else {
        failed++
        // 404 / 410 from the push service means the subscription is expired
        if (result.status === 404 || result.status === 410) {
          staleEndpoints.push(sub.endpoint)
        }
      }
    }),
  )

  // 5. Clean up stale subscriptions
  if (staleEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
  }

  // 6. Insert in-app notification rows for every member
  const notificationRows = userIds.map(user_id => ({
    user_id,
    trip_id,
    title,
    body:    pushBody ?? null,
    is_read: false,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notifs, error: notifErr } = await (admin.from('notifications') as any)
    .insert(notificationRows)
    .select('id')

  if (notifErr) {
    // Non-fatal — push was already sent; log and continue
    console.error('[push/send] Failed to insert in-app notifications:', notifErr.message)
  }

  const inAppCreated = notifs?.length ?? 0

  return NextResponse.json({ sent, failed, inAppCreated, staleRemoved: staleEndpoints.length })
}
