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
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('payana_last_active')
  return response
}
