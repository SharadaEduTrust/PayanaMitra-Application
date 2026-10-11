/**
 * POST /api/change-pin
 *
 * Body: { newPin: string }
 *
 * Changes the authenticated user's Supabase password to the HMAC-SHA256
 * derivation of their new PIN, then clears the must_change_password flag.
 *
 * Returns: { ok: true, role: string } on success
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { derivePassword, getSession } from '@/lib/server/auth'

const schema = z.object({
  newPin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
})

export async function POST(req: NextRequest) {
  try {
    // 1. Validate body
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 },
      )
    }
    const { newPin } = parsed.data

    // 2. Ensure authenticated
    const supabase = await createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 3. Derive phone from synthetic email (strip @payana.app)
    const phone = user.email.replace(/@payana\.app$/, '')

    // 4. Derive new password
    const newPassword = await derivePassword(phone, newPin)

    // 5. Update password via admin (service role) — avoids requiring old password
    const admin = createAdminClient()
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })
    if (updateError) {
      console.error('[change-pin] updateUserById error:', updateError.message)
      return NextResponse.json({ error: 'Failed to update PIN' }, { status: 500 })
    }

    // 6. Clear must_change_password flag
    const { error: profileError } = await admin
      .from('profiles')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ must_change_password: false, updated_at: new Date().toISOString() } as unknown as never)
      .eq('id', user.id)
    if (profileError) {
      console.error('[change-pin] profile update error:', profileError.message)
      // Non-fatal — user can still use the app
    }

    // 7. Return role for redirect
    const profile = await getSession()
    return NextResponse.json({ ok: true, role: profile?.role ?? 'traveller' })
  } catch (err) {
    console.error('[change-pin] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
