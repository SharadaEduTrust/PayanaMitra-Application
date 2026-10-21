import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession, derivePassword, phoneToEmail, pinMatches } from '@/lib/server/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ChangePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(4, 'New password must be at least 4 characters'),
    confirm_password: z.string().optional(),
  })
  .refine(
    (data) => !data.confirm_password || data.new_password === data.confirm_password,
    {
      message: 'New password and confirmation do not match',
      path: ['confirm_password'],
    },
  )

export async function POST(req: NextRequest) {
  const profile = await getSession()
  if (!profile) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ChangePasswordSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid password details.' }, { status: 400 })
  }

  const { current_password, new_password } = parsed.data
  const admin = createAdminClient()
  const supabase = await createServerClient()
  const authEmail = phoneToEmail(profile.phone)

  // 1. Verify current password
  let currentPasswordValid = false

  try {
    const currHash = await derivePassword(profile.phone, current_password)
    const res1 = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: currHash,
    })
    if (!res1.error && res1.data?.session) {
      currentPasswordValid = true
    } else {
      const cleanPhone = profile.phone.replace(/^\+/, '')
      if (cleanPhone !== profile.phone) {
        const altCurrHash = await derivePassword(cleanPhone, current_password)
        const res2 = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: altCurrHash,
        })
        if (!res2.error && res2.data?.session) {
          currentPasswordValid = true
        }
      }
    }
  } catch {
    // Non-fatal, check initial pin match below
  }

  if (!currentPasswordValid) {
    // Check if the user entered their initial system-allocated last 4 digits
    if (pinMatches(profile.phone, current_password)) {
      try {
        const { data: authUserData } = await admin.auth.admin.getUserById(profile.id)
        const hasChangedPassword = Boolean(authUserData?.user?.user_metadata?.password_changed)
        if (!hasChangedPassword) {
          currentPasswordValid = true
        }
      } catch {
        // Fallback
      }
    }
  }

  if (!currentPasswordValid) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
  }

  // 2. Derive and save the new password
  try {
    const newHash = await derivePassword(profile.phone, new_password)
    const { error: updateAuthErr } = await admin.auth.admin.updateUserById(profile.id, {
      password: newHash,
      user_metadata: {
        password_changed: true,
        password_changed_at: new Date().toISOString(),
      },
    })

    if (updateAuthErr) {
      return NextResponse.json(
        { error: updateAuthErr.message ?? 'Failed to update password.' },
        { status: 500 },
      )
    }

    // 3. Neutralize must_change_password in profile table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('profiles') as any)
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    return NextResponse.json({
      ok: true,
      message: 'Password updated successfully.',
    })
  } catch (err) {
    console.error('[change-password] Error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
