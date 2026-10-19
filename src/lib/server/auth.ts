/**
 * Authentication utilities for Payana Mitra.
 *
 * Phone-Suffix Login Requirement:
 *   Every user logs in using their phone number and the last four digits of that phone number.
 *   Users are not required or prompted to change their password.
 *
 * Supabase auth uses a synthetic email:
 *   auth email    = "<phone>@payana.app"
 *   auth password = HMAC-SHA256(AUTH_PEPPER, "<phone>:<last_4_digits>") → base64url
 *
 * SERVER ONLY — never import in client components.
 */

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { expectedPin, normalisePhone, phoneCandidates, pinMatches } from '@/lib/pin'
export { expectedPin, normalisePhone, phoneCandidates, pinMatches }
import type { Profile } from '@/types/database'

export const PHONE_REGEX = /^\+?[0-9]{10,15}$/
export const PIN_REGEX = /^\d{4}$/
const RATE_LIMIT_PER_PHONE = 5   // max failed attempts per phone per window
const RATE_LIMIT_PER_IP = 20     // max failed attempts per IP per window
const RATE_LIMIT_WINDOW_MINUTES = 15

/** Convert a phone number to the synthetic Supabase auth email. */
export function phoneToEmail(phone: string): string {
  const clean = phone.replace(/^\+/, '')
  return `${clean}@payana.app`
}

/**
 * Derive the Supabase auth password for a given phone+pin pair.
 * Uses HMAC-SHA256 with AUTH_PEPPER so raw credentials are never stored.
 */
export async function derivePassword(phone: string, pin: string): Promise<string> {
  const pepper = process.env.AUTH_PEPPER
  if (!pepper) throw new Error('AUTH_PEPPER is not set')

  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const message = enc.encode(`${phone}:${pin}`)
  const signature = await crypto.subtle.sign('HMAC', keyMaterial, message)
  return Buffer.from(signature).toString('base64url')
}

// ─── Rate limiting ────────────────────────────────────────────

interface RateLimitCheck {
  blocked: boolean
}

async function checkRateLimit(phone: string, ip: string): Promise<RateLimitCheck> {
  const admin = createAdminClient()
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()
  const candidates = phoneCandidates(phone)
  if (!candidates.includes(phone)) candidates.push(phone)

  // Check rate limit across all candidate phone representations and ip
  const [phoneResult, ipResult] = await Promise.all([
    admin
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .in('phone', candidates)
      .eq('succeeded', false)
      .gte('attempted_at', windowStart),
    admin
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('succeeded', false)
      .gte('attempted_at', windowStart),
  ])

  const phoneCount = phoneResult.count ?? 0
  const ipCount = ipResult.count ?? 0

  return {
    blocked: phoneCount >= RATE_LIMIT_PER_PHONE || ipCount >= RATE_LIMIT_PER_IP,
  }
}

async function recordAttempt(phone: string, ip: string, succeeded: boolean) {
  const admin = createAdminClient()
  const canonical = normalisePhone(phone) ?? phone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('login_attempts') as any).insert({ phone: canonical, ip, succeeded })
}

// ─── Login ────────────────────────────────────────────────────

export interface LoginOptions {
  requireRole?: 'admin' | 'leader' | 'traveller'
}

export type LoginResult =
  | {
      ok: true
      profile: Profile
      session?: {
        access_token: string
        refresh_token: string
      } | null
      tokenHash?: string | null
    }
  | { ok: false; error: string; status: number }

/**
 * Single authoritative server-side login function.
 *
 * Requirements enforced:
 *   1. Normalizes phone and validates that submitted PIN matches the last 4 digits.
 *   2. Rejects invalid credentials before or during lookup with generic message.
 *   3. Enforces server-side rate-limiting using login_attempts table across formatting variants.
 *   4. Rejects inactive accounts immediately.
 *   5. Validates profile.phone suffix before derivation or credential reconciliation.
 *   6. Supports safe server-side credential reconciliation for existing accounts.
 *   7. Neutralizes must_change_password flag so users are never trapped.
 */
export async function loginWithPhonePin(
  phoneInput: string,
  pinInput: string,
  ip: string,
  options?: LoginOptions,
): Promise<LoginResult> {
  const GENERIC_ERROR = 'Invalid phone number or PIN.'
  const rawPhone = phoneInput.trim().replace(/\s+/g, '')
  const pin = pinInput.trim()

  // 1. Validate basic format
  if (!PHONE_REGEX.test(rawPhone) || !PIN_REGEX.test(pin)) {
    return { ok: false, error: GENERIC_ERROR, status: 400 }
  }

  // 2. Check rate limit
  const { blocked } = await checkRateLimit(rawPhone, ip)
  if (blocked) {
    return {
      ok: false,
      error: 'Too many login attempts. Please try again in 15 minutes.',
      status: 429,
    }
  }

  // 3. Validate submitted PIN matches the last 4 digits of the phone number
  if (!pinMatches(rawPhone, pin)) {
    await recordAttempt(rawPhone, ip, false)
    return { ok: false, error: GENERIC_ERROR, status: 401 }
  }

  const admin = createAdminClient()

  // 4. Find profile matching candidate variants
  const candidates = phoneCandidates(rawPhone)
  if (!candidates.includes(rawPhone)) candidates.push(rawPhone)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: matchedProfiles } = await (admin.from('profiles') as any)
    .select('*')
    .in('phone', candidates)
    .limit(1) as { data: Profile[] | null }

  const profile = matchedProfiles && matchedProfiles.length > 0 ? matchedProfiles[0] : null

  // Reject if profile does not exist, is inactive, or submitted pin does not match profile's phone suffix
  if (!profile || !profile.is_active || !pinMatches(profile.phone, pin)) {
    await recordAttempt(rawPhone, ip, false)
    return { ok: false, error: GENERIC_ERROR, status: 401 }
  }

  // 5. Check role requirement if requested
  if (options?.requireRole && profile.role !== options.requireRole) {
    await recordAttempt(rawPhone, ip, false)
    return { ok: false, error: GENERIC_ERROR, status: 401 }
  }

  // 6. Supabase Auth credential derivation
  const expectedFour = expectedPin(profile.phone)
  const authEmail = phoneToEmail(profile.phone)
  const expectedPassword = await derivePassword(profile.phone, expectedFour)

  const supabase = await createServerClient()
  let session: { access_token: string; refresh_token: string } | null = null

  // Attempt standard password sign-in
  const res1 = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: expectedPassword,
  })

  if (!res1.error && res1.data?.session) {
    session = {
      access_token: res1.data.session.access_token,
      refresh_token: res1.data.session.refresh_token,
    }
  } else {
    // Check if derived using cleanPhone without plus prefix
    const cleanPhone = profile.phone.replace(/^\+/, '')
    if (cleanPhone !== profile.phone) {
      const altPassword = await derivePassword(cleanPhone, expectedFour)
      const res2 = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: altPassword,
      })
      if (!res2.error && res2.data?.session) {
        session = {
          access_token: res2.data.session.access_token,
          refresh_token: res2.data.session.refresh_token,
        }
      }
    }
  }

  // Safe server-side credential reconciliation:
  // If the user entered their valid phone-suffix PIN, but Supabase Auth credentials
  // are out of sync (e.g. user set custom password in legacy form or old seed),
  // synchronize the password with the admin API and complete the login.
  if (!session) {
    try {
      await admin.auth.admin.updateUserById(profile.id, {
        password: expectedPassword,
        email: authEmail,
        email_confirm: true,
      })
      const retry = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: expectedPassword,
      })
      if (!retry.error && retry.data?.session) {
        session = {
          access_token: retry.data.session.access_token,
          refresh_token: retry.data.session.refresh_token,
        }
      }
    } catch (syncErr) {
      console.error('[auth] Credential reconciliation failed:', syncErr)
    }
  }

  if (!session) {
    await recordAttempt(rawPhone, ip, false)
    return { ok: false, error: GENERIC_ERROR, status: 401 }
  }

  // 7. Generate one-time magiclink tokenHash for callers utilizing verifyOtp
  let tokenHash: string | null = null
  try {
    const { data: link } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: authEmail,
    })
    tokenHash = link?.properties?.hashed_token ?? null
  } catch {
    // Non-fatal fallback
  }

  // 8. Neutralize must_change_password and update last_active_at
  const profileUpdates: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
  }
  if (profile.must_change_password) {
    profileUpdates.must_change_password = false
    profile.must_change_password = false
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('profiles') as any).update(profileUpdates).eq('id', profile.id)

  // 9. Record success
  await recordAttempt(rawPhone, ip, true)

  return {
    ok: true,
    profile,
    session,
    tokenHash,
  }
}

/**
 * Sign out the current user and clear the session cookie.
 */
export async function logout() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
}

/**
 * Get the current session's profile, or null if not authenticated.
 * Supports both Cookie session and Authorization: Bearer <jwt> header.
 *
 * Security: Checks is_active so deactivated accounts lose API access immediately.
 */
export async function getSession(): Promise<Profile | null> {
  let token: string | null = null
  try {
    const h = await headers()
    const authHeader = h.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim()
    }
  } catch {
    // headers() might throw in non-request contexts
  }

  const admin = createAdminClient()

  if (token) {
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (!error && user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (admin.from('profiles') as any)
        .select('*')
        .eq('id', user.id)
        .single()
      if (!data || !data.is_active) return null
      return (data as Profile) ?? null
    }
  }

  // Fallback to cookie-based session
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin.from('profiles') as any)
    .select('*')
    .eq('id', user.id)
    .single()

  if (!data || !data.is_active) return null

  return (data as Profile) ?? null
}
