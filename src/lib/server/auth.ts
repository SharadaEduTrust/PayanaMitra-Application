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

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

const PHONE_REGEX = /^\d{10}$/
const PIN_REGEX = /^\d{4}$/
const RATE_LIMIT_PER_PHONE = 5   // max failed attempts per phone per window
const RATE_LIMIT_PER_IP = 20     // max failed attempts per IP per window
const RATE_LIMIT_WINDOW_MINUTES = 15

/** Convert a phone number to the synthetic Supabase auth email. */
export function phoneToEmail(phone: string): string {
  return `${phone}@payana.app`
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
  phone: string,
  pin: string,
  ip: string,
): Promise<LoginResult> {
  const GENERIC_ERROR = 'Invalid phone number or PIN.'

  // 1. Validate input format
  if (!PHONE_REGEX.test(phone) || !PIN_REGEX.test(pin)) {
    return { ok: false, error: GENERIC_ERROR }
  }

  // 2. Check rate limit (uses service role — no RLS bypass needed for reads)
  const { blocked } = await checkRateLimit(phone, ip)
  if (blocked) {
    return {
      ok: false,
      error: 'Too many login attempts. Please try again in 15 minutes.',
    }
  }

  // 3. Derive credentials
  const email = phoneToEmail(phone)
  const password = await derivePassword(phone, pin)

  // 4. Attempt Supabase sign-in (via server client — sets session cookie)
  const supabase = await createServerClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    await recordAttempt(phone, ip, false)
    return { ok: false, error: GENERIC_ERROR }
  }

  // 5. Record success + fetch profile
  await recordAttempt(phone, ip, true)

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('phone', phone)
    .single()

  if (profileError || !profileData) {
    // Auth succeeded but profile missing — sign out and fail gracefully
    await supabase.auth.signOut()
    return { ok: false, error: GENERIC_ERROR }
  }

  const profile = profileData as Profile

  // 6. Check account is active
  if (!profile.is_active) {
    await supabase.auth.signOut()
    return { ok: false, error: GENERIC_ERROR }
  }

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
 * Safe to call in Server Components.
 */
export async function getSession(): Promise<Profile | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (data as Profile | null) ?? null
}
