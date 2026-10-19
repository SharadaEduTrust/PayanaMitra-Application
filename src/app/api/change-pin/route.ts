/**
 * POST /api/change-pin
 *
 * Retired: Under the phone-suffix login architecture, custom PIN changes are disabled.
 * Every user authenticates using their registered phone number and its last 4 digits.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/server/auth'

export async function POST() {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  return NextResponse.json(
    {
      ok: false,
      error: 'Custom PINs are disabled. Your PIN is permanently the last 4 digits of your phone number.',
    },
    { status: 400 },
  )
}
