/**
 * Authentication utilities for Payana Mitra.
 *
 * Login ID  : 10-digit phone number
 * Credential: last 4 digits of phone (initial PIN)
 *
 * Supabase auth uses a synthetic email because phone+password sign-in
 * requires an SMS provider (which we don't have).
 *   auth email = "<phone>@payana.app"
 *   auth password = HMAC-SHA256(AUTH_PEPPER, "<phone>:<pin>") → base64url
 *
 * The synthetic email is NEVER shown to users.
 *
 * SERVER ONLY — never import in client components.
 */

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
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
 * Uses HMAC-SHA256 with AUTH_PEPPER so the raw PIN is never stored.
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
  // base64url encode (URL-safe, no padding issues)
  return Buffer.from(signature).toString('base64url')
}

// ─── Rate limiting ────────────────────────────────────────────

interface RateLimitCheck {
  blocked: boolean
}

async function checkRateLimit(phone: string, ip: string): Promise<RateLimitCheck> {
  const admin = createAdminClient()
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()

  const [phoneResult, ipResult] = await Promise.all([
    admin
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await admin.from('login_attempts').insert({ phone, ip, succeeded } as any)
}

// ─── Login ────────────────────────────────────────────────────

export type LoginResult =
  | { ok: true; profile: Profile }
  | { ok: false; error: string }

/**
 * Validate credentials, enforce rate limiting, sign in via Supabase auth,
 * and return the user's profile on success.
 *
 * Always returns a generic error message on failure — never reveal
 * whether the phone exists or the PIN is wrong.
 */
export async function loginWithPhonePin(
  phoneInput: string,
  pin: string,
  ip: string,
): Promise<LoginResult> {
  const GENERIC_ERROR = 'Invalid phone number or PIN.'
  const phone = phoneInput.trim().replace(/\s+/g, '')

  // 1. Validate input format
  if (!PHONE_REGEX.test(phone) || !PIN_REGEX.test(pin)) {
    return { ok: false, error: GENERIC_ERROR }
  }

  // 2. Check rate limit
  const { blocked } = await checkRateLimit(phone, ip)
  if (blocked) {
    return {
      ok: false,
      error: 'Too many login attempts. Please try again in 15 minutes.',
    }
  }

  const admin = createAdminClient()

  // 3. Find the profile matching this phone (handles +91, stripped, or exact)
  const variants = [
    phone,
    phone.startsWith('+91') ? phone.replace(/^\+91/, '') : `+91${phone}`,
    phone.replace(/^\+/, ''),
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: matchedProfiles } = await (admin.from('profiles') as any)
    .select('*')
    .in('phone', variants)
    .limit(1) as { data: Profile[] | null }

  const profile = matchedProfiles && matchedProfiles.length > 0 ? matchedProfiles[0] : null

  if (!profile || !profile.is_active) {
    await recordAttempt(phone, ip, false)
    return { ok: false, error: GENERIC_ERROR }
  }

  // 4. Determine auth email
  const { data: authUserData } = await admin.auth.admin.getUserById(profile.id)
  const authEmail = authUserData?.user?.email || phoneToEmail(profile.phone)

  // 5. Try signing in with derived password
  const supabase = await createServerClient()
  let signInError: unknown = null

  // Try password derived from profile phone
  const password = await derivePassword(profile.phone, pin)
  const { error: err1 } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  })

  if (err1) {
    signInError = err1
    // Fallback try with phone input as entered
    if (phone !== profile.phone) {
      const altPassword = await derivePassword(phone, pin)
      const { error: err2 } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: altPassword,
      })
      if (!err2) {
        signInError = null
      }
    }
  }

  if (signInError) {
    await recordAttempt(phone, ip, false)
    return { ok: false, error: GENERIC_ERROR }
  }

  // 6. Record success
  await recordAttempt(phone, ip, true)
  return { ok: true, profile }
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
 * Safe to call in Server Components, Route Handlers, and Server Actions.
 */
export async function getSession(): Promise<Profile | null> {
  // Check for Authorization header first
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
      const { data } = await admin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      return (data as Profile | null) ?? null
    }
  }

  // Fallback to cookie-based session
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (data as Profile | null) ?? null
}
