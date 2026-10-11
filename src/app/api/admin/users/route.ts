import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, derivePassword, phoneToEmail } from '@/lib/server/auth'

/**
 * GET   /api/admin/users   — paginated, filterable user list
 * POST  /api/admin/users   — create a new user
 * PATCH /api/admin/users   — update a single user's profile / reset PIN
 *
 * Query params (GET):
 *   page    — page number (default 1)
 *   limit   — items per page (default 20, max 100)
 *   q       — search across first_name, last_name, phone
 *   role    — filter by role (traveller | leader | admin)
 *   active  — 'true' | 'false'
 */

const PHONE_REGEX = /^\d{10}$/
const VALID_ROLES = ['traveller', 'leader', 'admin'] as const

// Auth guard
async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

const CreateUserSchema = z.object({
  phone:           z.string().regex(PHONE_REGEX, 'Phone must be 10 digits'),
  first_name:      z.string().min(1).max(100),
  last_name:       z.string().min(1).max(100),
  role:            z.enum(VALID_ROLES).default('traveller'),
  email:           z.string().email().nullable().optional(),
  location:        z.string().max(200).nullable().optional(),
  date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  remarks:         z.string().max(2000).nullable().optional(),
})

const PatchUserSchema = z.object({
  id:              z.string().uuid(),
  first_name:      z.string().min(1).max(100).optional(),
  last_name:       z.string().min(1).max(100).optional(),
  role:            z.enum(VALID_ROLES).optional(),
  email:           z.string().email().nullable().optional(),
  location:        z.string().max(200).nullable().optional(),
  date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  remarks:         z.string().max(2000).nullable().optional(),
  is_active:       z.boolean().optional(),
  reset_pin:       z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10))
  const search = searchParams.get('q') ?? ''
  const role   = searchParams.get('role')
  const active = searchParams.get('active')
  const from   = (page - 1) * limit

  const admin = createAdminClient()

  let query = admin
    .from('profiles')
    .select('id, phone, first_name, last_name, role, is_active, must_change_password, date_of_joining, last_active_at, location, email, remarks, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (search) {
    query = (query as any).or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`) // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  if (role && VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    query = (query as any).eq('role', role) // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  if (active === 'true') {
    query = (query as any).eq('is_active', true) // eslint-disable-line @typescript-eslint/no-explicit-any
  } else if (active === 'false') {
    query = (query as any).eq('is_active', false) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count ?? 0, page, limit })
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { phone, first_name, last_name, role, email, location, date_of_joining, remarks } = parsed.data
  const admin = createAdminClient()

  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('phone', phone)
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: { phone: ['Phone number already registered.'] } }, { status: 422 })
  }

  const initialPin = phone.slice(-4)
  const email_auth = phoneToEmail(phone)
  const password   = await derivePassword(phone, initialPin)

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({ email: email_auth, password, email_confirm: true })
  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message ?? 'Auth user creation failed' }, { status: 500 })
  }

  const { data: profileData, error: profileErr } = await (admin.from('profiles') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ id: authData.user.id, phone, first_name, last_name, role, email: email ?? null, location: location ?? null, date_of_joining: date_of_joining ?? null, remarks: remarks ?? null, must_change_password: true, is_active: true })
    .select().single()

  if (profileErr) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  return NextResponse.json({ data: profileData }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { id, reset_pin, ...fields } = parsed.data
  const admin = createAdminClient()

  const { data: current, error: fetchErr } = await (admin.from('profiles') as any).select('phone').eq('id', id).single() // eslint-disable-line @typescript-eslint/no-explicit-any
  if (fetchErr || !current) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (reset_pin) {
    const phone      = (current as { phone: string }).phone
    const initialPin = phone.slice(-4)
    const password   = await derivePassword(phone, initialPin)
    const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password })
    if (pwErr) return NextResponse.json({ error: `PIN reset failed: ${pwErr.message}` }, { status: 500 })
  }

  const updatePayload: Record<string, unknown> = {}
  const profileFields = ['first_name', 'last_name', 'role', 'email', 'location', 'date_of_joining', 'remarks', 'is_active'] as const
  for (const key of profileFields) {
    if (fields[key] !== undefined) updatePayload[key] = fields[key]
  }
  if (reset_pin) updatePayload['must_change_password'] = true

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 422 })
  }

  const { data: updated, error: updateErr } = await (admin.from('profiles') as any).update(updatePayload).eq('id', id).select().single() // eslint-disable-line @typescript-eslint/no-explicit-any
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  return NextResponse.json({ data: updated })
}
