import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'
import { derivePassword, phoneToEmail } from '@/lib/server/auth'

/**
 * POST /api/admin/import
 *
 * Accepts a JSON body of users to bulk-create. Typically called after
 * the frontend parses a CSV and shows a preview. Returns per-row results.
 *
 * Body:
 * {
 *   users: [
 *     { phone, first_name, last_name, role, email?, location?, date_of_joining?, remarks? },
 *     ...
 *   ]
 * }
 *
 * Returns:
 * {
 *   created: number,
 *   skipped: number,
 *   errors: [{ row, phone, error }],
 *   results: [{ row, phone, status: 'created' | 'skipped' | 'error', id? }]
 * }
 */

const PHONE_REGEX = /^\d{10}$/
const VALID_ROLES = ['traveller', 'leader', 'admin'] as const

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

interface ImportUser {
  phone: string
  first_name: string
  last_name: string
  role: string
  email?: string | null
  location?: string | null
  date_of_joining?: string | null
  remarks?: string | null
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: { users?: unknown[] }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body?.users) || body.users.length === 0) {
    return NextResponse.json({ error: '`users` must be a non-empty array' }, { status: 422 })
  }

  if (body.users.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 users per import batch' }, { status: 422 })
  }

  const admin = createAdminClient()
  const results: { row: number; phone: string; status: 'created' | 'skipped' | 'error'; id?: string; error?: string }[] = []

  // Fetch all existing phones in one query for fast duplicate detection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingProfiles } = await (admin.from('profiles') as any).select('phone') as { data: { phone: string }[] | null }
  const existingPhones = new Set((existingProfiles ?? []).map((p: { phone: string }) => p.phone))

  for (let i = 0; i < body.users.length; i++) {
    const raw = body.users[i] as Record<string, unknown>
    const row = i + 1

    const phone = String(raw.phone ?? '').trim()
    const first_name = String(raw.first_name ?? '').trim()
    const last_name = String(raw.last_name ?? '').trim()
    const role = String(raw.role ?? 'traveller').trim().toLowerCase()

    // Row-level validation
    if (!PHONE_REGEX.test(phone)) {
      results.push({ row, phone, status: 'error', error: 'Invalid phone (must be 10 digits)' })
      continue
    }
    if (!first_name) {
      results.push({ row, phone, status: 'error', error: 'first_name is required' })
      continue
    }
    if (!last_name) {
      results.push({ row, phone, status: 'error', error: 'last_name is required' })
      continue
    }
    if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      results.push({ row, phone, status: 'error', error: `Invalid role: ${role}` })
      continue
    }

    // Skip duplicates (already registered)
    if (existingPhones.has(phone)) {
      results.push({ row, phone, status: 'skipped', error: 'Phone already registered' })
      continue
    }

    try {
      const initialPin = phone.slice(-4)
      const email_auth = phoneToEmail(phone)
      const password = await derivePassword(phone, initialPin)

      // Create auth user
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: email_auth,
        password,
        email_confirm: true,
      })

      if (authErr || !authData.user) {
        results.push({ row, phone, status: 'error', error: authErr?.message ?? 'Auth creation failed' })
        continue
      }

      // Insert profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profileData, error: profileErr } = await (admin.from('profiles') as any)
        .insert({
          id: authData.user.id,
          phone,
          first_name,
          last_name,
          role,
          email: raw.email ? String(raw.email).trim() || null : null,
          location: raw.location ? String(raw.location).trim() || null : null,
          date_of_joining: raw.date_of_joining ? String(raw.date_of_joining).trim() || null : null,
          remarks: raw.remarks ? String(raw.remarks).trim() || null : null,
          must_change_password: true,
          is_active: true,
        })
        .select('id')
        .single()

      if (profileErr) {
        // Roll back the auth user to avoid orphans
        await admin.auth.admin.deleteUser(authData.user.id)
        results.push({ row, phone, status: 'error', error: profileErr.message })
        continue
      }

      existingPhones.add(phone) // prevent duplicates within same batch
      results.push({ row, phone, status: 'created', id: profileData?.id })
    } catch (err) {
      results.push({ row, phone, status: 'error', error: String(err) })
    }
  }

  const created = results.filter(r => r.status === 'created').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors  = results.filter(r => r.status === 'error')

  return NextResponse.json({ created, skipped, errorCount: errors.length, results })
}
