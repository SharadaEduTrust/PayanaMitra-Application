/**
 * POST /api/logout
 *
 * Signs out the current user and clears the session cookie.
 * Designed to be called from client-side JS (fetch).
 */

import { NextResponse } from 'next/server'
import { logout } from '@/lib/server/auth'

export async function POST() {
  await logout()
  return NextResponse.json({ ok: true })
}
