import { createAdminClient } from '@/lib/supabase/admin'

/** Base64url decode to Uint8Array */
function b64uDecode(str: string): Uint8Array {
  const padded = str.padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
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
 * Uses the Web Crypto API.
 */
async function buildVapidJwt(audience: string): Promise<string> {
  const publicKeyB64 = process.env.VAPID_PUBLIC_KEY
  const privateKeyB64 = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT

  if (!publicKeyB64 || !privateKeyB64 || !subject) {
    throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: audience, exp: now + 43200, sub: subject }

  const enc = new TextEncoder()
  const headerB64 = b64uEncode(enc.encode(JSON.stringify(header)))
  const payloadB64 = b64uEncode(enc.encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

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
 */
async function sendWebPush(
  endpoint: string,
  _p256dh: string | null,
  _auth_key: string | null,
  payload: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const url = new URL(endpoint)
    const audience = `${url.protocol}//${url.host}`
    const jwt = await buildVapidJwt(audience)

    const publicKey = process.env.VAPID_PUBLIC_KEY ?? ''
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt},k=${publicKey}`,
        'Content-Type': 'application/json',
        TTL: '86400',
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

export type BroadcastResult = {
  sent: number
  failed: number
  inAppCreated: number
  staleRemoved: number
  message?: string
}

/**
 * Delivers a notification to all members of a trail via:
 * 1. Web Push (RFC 8030 / VAPID)
 * 2. In-app notifications table
 */
export async function sendTrailNotification({
  tripId,
  title,
  body,
}: {
  tripId: string
  title: string
  body?: string | null
}): Promise<BroadcastResult> {
  const admin = createAdminClient()

  // 1. Fetch trip member user IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members, error: membersErr } = await (admin.from('trip_members') as any)
    .select('user_id')
    .eq('trip_id', tripId)

  if (membersErr) {
    throw new Error(`Failed to fetch trip members: ${membersErr.message}`)
  }

  if (!members || members.length === 0) {
    return {
      sent: 0,
      failed: 0,
      inAppCreated: 0,
      staleRemoved: 0,
      message: 'No guests enrolled in this trail',
    }
  }

  const userIds = (members as Array<{ user_id: string }>).map(m => m.user_id)

  // 2. Fetch all push subscriptions for these users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subscriptions, error: subErr } = await (admin.from('push_subscriptions') as any)
    .select('id, user_id, endpoint, p256dh, auth_key')
    .in('user_id', userIds)

  if (subErr) {
    throw new Error(`Failed to fetch push subscriptions: ${subErr.message}`)
  }

  type PushSub = { id: string; user_id: string; endpoint: string; p256dh: string | null; auth_key: string | null }
  const subsList = (subscriptions ?? []) as PushSub[]

  // 3. Fan-out Web Push
  const pushPayload = JSON.stringify({ title, body: body ?? '' })
  let sent = 0
  let failed = 0
  const staleEndpoints: string[] = []

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
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

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('push_subscriptions') as any).delete().in('endpoint', staleEndpoints)
    }
  }

  // 4. Insert in-app notification rows for every member
  const notificationRows = userIds.map(user_id => ({
    user_id,
    trip_id: tripId,
    title,
    body: body ?? null,
    is_read: false,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notifs, error: notifErr } = await (admin.from('notifications') as any)
    .insert(notificationRows)
    .select('id')

  if (notifErr) {
    console.error('[sendTrailNotification] In-app insert failed:', notifErr.message)
  }

  const inAppCreated = notifs?.length ?? 0

  return {
    sent,
    failed,
    inAppCreated,
    staleRemoved: staleEndpoints.length,
  }
}
