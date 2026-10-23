import { type NextRequest, NextResponse } from 'next/server'
import { POST as changePasswordPost } from '@/app/api/change-password/route'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  // Normalize legacy pin keys to password keys
  const normalizedBody = {
    current_password: body.current_password ?? body.current_pin ?? body.old_password ?? body.old_pin,
    new_password: body.new_password ?? body.new_pin ?? body.password ?? body.pin,
    confirm_password: body.confirm_password ?? body.confirm_pin,
  }

  const modifiedReq = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(normalizedBody),
  })

  return changePasswordPost(modifiedReq as unknown as NextRequest)
}
