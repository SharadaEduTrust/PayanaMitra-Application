import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, derivePassword, PHONE_REGEX } from '@/lib/server/auth'
import { formatZodError } from '@/app/api/admin/users/route'

interface Params { params: Promise<{ id: string }> }

const ROLE_MAP: Record<string, 'traveller' | 'leader' | 'admin'> = {
  traveller: 'traveller',
  guest: 'traveller',
  leader: 'leader',
  admin: 'admin',
}

const RoleInputSchema = z.string()
  .transform(val => val.trim().toLowerCase())
  .refine(val => val in ROLE_MAP, { message: 'Role must be guest, traveller, leader, or admin' })
  .transform(val => ROLE_MAP[val])

const FoodPrefSchema = z.enum(['veg', 'non_veg']).nullable().optional()

const OptionalEmailSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  z.string().email('Invalid email address').nullable().optional(),
)

const OptionalUuidSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  z.string().uuid('Invalid leader ID').nullable().optional(),
)

const PatchUserSchema = z.object({
  first_name:      z.string().min(1).max(50).optional(),
  last_name:       z.string().min(1).max(50).optional(),
  role:            RoleInputSchema.optional(),
  leader_id:       OptionalUuidSchema,
  email:           OptionalEmailSchema,
  location:        z.string().max(50).nullable().optional(),
  date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  referral_name:   z.string().max(100).nullable().optional(),
  remarks:         z.string().max(2000).nullable().optional(),
  is_active:       z.boolean().optional(),
  reset_pin:       z.boolean().optional(),
  reset_password:  z.boolean().optional(),
  // Guest details
  dob:                      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  food_preference:          FoodPrefSchema,
  food_allergy:             z.string().max(50).nullable().optional(),
  emergency_contact_name:   z.string().max(50).nullable().optional(),
  emergency_contact_no:     z.string().regex(PHONE_REGEX).nullable().optional(),
  travel_insurance_no:      z.string().max(50).nullable().optional(),
  insurance_company:        z.string().max(50).nullable().optional(),
  insurance_expiry:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  passport_issued_location: z.string().max(50).nullable().optional(),
  passport_issue_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  visa_no:                  z.string().trim().max(10).nullable().optional(),
  visa_expiry:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  visa_country:             z.string().trim().max(50).nullable().optional(),
})

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('profiles') as any)
    .select('*, leader:profiles!leader_id(id, first_name, last_name, phone, email), traveller_details(*)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PatchUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 422 })
  }

  const { reset_pin, ...fields } = parsed.data
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current, error: fetchErr } = await (admin.from('profiles') as any)
    .select('id, phone, role, leader_id')
    .eq('id', id)
    .single()

  if (fetchErr || !current) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const targetRole = fields.role ?? current.role
  const targetLeaderId = fields.leader_id !== undefined ? fields.leader_id : current.leader_id

  if (targetLeaderId) {
    if (['leader', 'admin'].includes(targetRole)) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: { leader_id: ['Leaders and admins cannot be assigned a leader.'] } },
        { status: 422 },
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: leaderProfile } = await (admin.from('profiles') as any)
      .select('id, role')
      .eq('id', targetLeaderId)
      .single()

    if (!leaderProfile || !['leader', 'admin'].includes(leaderProfile.role)) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: { leader_id: ['Selected user is not an active leader or admin.'] } },
        { status: 422 },
      )
    }
  }

  const shouldResetPassword = Boolean(reset_pin || (fields as Record<string, unknown>).reset_password)
  if (shouldResetPassword) {
    const phone = current.phone
    const initialPin = phone.slice(-4)
    const password = await derivePassword(phone, initialPin)
    const { error: pwErr } = await admin.auth.admin.updateUserById(id, {
      password,
      user_metadata: { password_changed: false },
    })
    if (pwErr) return NextResponse.json({ error: `Password reset failed: ${pwErr.message}` }, { status: 500 })
  }

  const profileUpdatePayload: Record<string, unknown> = {}
  const profileKeys = ['first_name', 'last_name', 'role', 'leader_id', 'email', 'location', 'date_of_joining', 'referral_name', 'remarks', 'is_active'] as const
  for (const key of profileKeys) {
    if (fields[key] !== undefined) profileUpdatePayload[key] = fields[key]
  }
  if (shouldResetPassword) profileUpdatePayload['must_change_password'] = false

  let updatedProfile = current
  if (Object.keys(profileUpdatePayload).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updateErr } = await (admin.from('profiles') as any)
      .update(profileUpdatePayload)
      .eq('id', id)
      .select('*, leader:profiles!leader_id(id, first_name, last_name, phone)')
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    updatedProfile = updated
  }

  // Update guest details if provided
  const tdKeys = ['dob', 'food_preference', 'food_allergy', 'emergency_contact_name', 'emergency_contact_no', 'travel_insurance_no', 'insurance_company', 'insurance_expiry', 'passport_issued_location', 'passport_issue_date', 'visa_no', 'visa_expiry', 'visa_country'] as const
  const tdPayload: Record<string, unknown> = { user_id: id }
  let hasTd = false
  for (const k of tdKeys) {
    if (fields[k] !== undefined) {
      tdPayload[k] = fields[k]
      hasTd = true
    }
  }

  let travellerDetails = null
  if (hasTd) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tdData } = await (admin.from('traveller_details') as any)
      .upsert(tdPayload, { onConflict: 'user_id' })
      .select()
      .single()
    travellerDetails = tdData
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tdData } = await (admin.from('traveller_details') as any)
      .select('*')
      .eq('user_id', id)
      .maybeSingle()
    travellerDetails = tdData
  }

  return NextResponse.json({
    data: {
      ...updatedProfile,
      traveller_details: travellerDetails,
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params
  const admin = createAdminClient()

  // Deactivate the user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('profiles') as any)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: 'User deactivated successfully', data })
}
