import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { loginWithPhonePin } from '@/lib/server/auth'

/**
 * POST /api/login
 *
 * Body: { phone: string, pin: string }
 *
 * On success: sets session cookies (via @supabase/ssr) and returns the
 * user's role so the client can redirect to the right dashboard.
 *
 * On failure: returns a generic 401 — no information about whether the
 * phone exists or the PIN is wrong.
 */

const LoginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
})

export async function POST(req: NextRequest) {
  // Parse + validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid phone number or PIN.' }, { status: 400 })
  }

  const { phone, pin } = parsed.data

  // Extract client IP for rate limiting
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'

  const result = await loginWithPhonePin(phone, pin, ip)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  // Return just enough for the client to redirect — no sensitive data
  return NextResponse.json({
    role: result.profile.role,
    mustChangePassword: result.profile.must_change_password,
  })
}
