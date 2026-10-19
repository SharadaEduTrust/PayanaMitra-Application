import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { loginWithPhonePin, PHONE_REGEX, PIN_REGEX } from '@/lib/server/auth'

const LoginSchema = z.object({
  phone: z.string().transform((v) => v.trim().replace(/[\s\-()]/g, '')).pipe(z.string().regex(PHONE_REGEX, 'Phone must be a valid 10-15 digit number')),
  pin: z.string().transform((v) => v.trim()).pipe(z.string().regex(PIN_REGEX, 'PIN must be 4 digits')),
})

export async function POST(req: NextRequest) {
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

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'

  const result = await loginWithPhonePin(phone, pin, ip)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    role: result.profile.role,
    mustChangePassword: false,
    session: result.session,
    tokenHash: result.tokenHash,
    firstName: result.profile.first_name,
  })
}
