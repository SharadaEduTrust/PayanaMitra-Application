import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, derivePassword, phoneToEmail, PHONE_REGEX } from '@/lib/server/auth'
import { encrypt } from '@/lib/server/crypto'
import { formatZodError } from '@/lib/server/zod-error'

/**
 * GET   /api/admin/users   — paginated, filterable user list with leader and guest details
 * POST  /api/admin/users   — create a new user (with leader assignment & optional guest details)
 * PATCH /api/admin/users   — update a single user's profile, leader, guest details, or reset PIN
 */

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

const GuestDetailsSchema = z.object({
  dob:                      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  food_preference:          FoodPrefSchema,
  food_allergy:             z.string().max(50, 'Max 50 characters').nullable().optional(),
  emergency_contact_name:   z.string().max(50, 'Max 50 characters').nullable().optional(),
  emergency_contact_no:     z.string().regex(PHONE_REGEX, 'Emergency contact number must be 10-15 digits').nullable().optional(),
  travel_insurance_no:      z.string().max(50, 'Max 50 characters').nullable().optional(),
  insurance_company:        z.string().max(50, 'Max 50 characters').nullable().optional(),
  insurance_expiry:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  passport_issued_location: z.string().max(50, 'Max 50 characters').nullable().optional(),
  passport_issue_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  pan:                      z.string().trim().max(10).nullable().optional(),
  passport_no:              z.string().trim().max(10).nullable().optional(),
  passport_expiry:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  visa_no:                  z.string().trim().max(10).nullable().optional(),
  visa_expiry:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  visa_country:             z.string().trim().max(50).nullable().optional(),
}).optional()

const OptionalEmailSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  z.string().email('Invalid email address').nullable().optional(),
)

const OptionalUuidSchema = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  z.string().uuid('Invalid leader ID').nullable().optional(),
)

const PhoneInputSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().replace(/[\s\-\(\)]/g, '') : val),
  z.string()
    .min(10, 'Phone number must be at least 10 digits (e.g. 9876543210 or +919876543210)')
    .max(16, 'Phone number cannot exceed 15 digits')
    .regex(PHONE_REGEX, 'Phone must be a valid 10-15 digit number (e.g. 9876543210 or +919876543210)'),
)


const CreateUserSchema = z.object({
  phone:           PhoneInputSchema,
  first_name:      z.string().min(1, 'First name is required').max(50, 'First name cannot exceed 50 characters'),
  last_name:       z.string().min(1, 'Last name is required').max(50, 'Last name cannot exceed 50 characters'),
  role:            RoleInputSchema.default('traveller'),
  leader_id:       OptionalUuidSchema,
  email:           OptionalEmailSchema,
  location:        z.string().max(50, 'Location cannot exceed 50 characters').nullable().optional(),
  date_of_joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of joining must be YYYY-MM-DD').nullable().optional(),
  referral_name:   z.string().max(100, 'Referral name cannot exceed 100 characters').nullable().optional(),
  remarks:         z.string().max(2000, 'Remarks cannot exceed 2000 characters').nullable().optional(),
  // Optional nested or flat guest details
  guest_details:   GuestDetailsSchema,
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
  pan:                      z.string().trim().max(10).nullable().optional(),
  passport_no:              z.string().trim().max(10).nullable().optional(),
  passport_expiry:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  visa_no:                  z.string().trim().max(10).nullable().optional(),
  visa_expiry:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  visa_country:             z.string().trim().max(50).nullable().optional(),
})

const PatchUserSchema = z.object({
  id:              z.string().uuid('Invalid user ID'),
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
  // Guest details update
  guest_details:   GuestDetailsSchema,
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
  pan:                      z.string().trim().max(10).nullable().optional(),
  passport_no:              z.string().trim().max(10).nullable().optional(),
  passport_expiry:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
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

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10))
  const search = searchParams.get('q') ?? ''
  const role   = searchParams.get('role')?.toLowerCase()
  const active = searchParams.get('active')
  const leaderId = searchParams.get('leader_id')
  const from   = (page - 1) * limit

  const admin = createAdminClient()

  let query = admin
    .from('profiles')
    .select(
      'id, phone, first_name, last_name, role, is_active, must_change_password, leader_id, date_of_joining, referral_name, last_active_at, location, email, remarks, created_at, updated_at, leader:profiles!leader_id(id, first_name, last_name, phone), traveller_details(*)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1)

  if (search) {
    // Sanitize search input to prevent PostgREST query syntax injection (strip syntax characters)
    const sanitizedSearch = search.replace(/[,.():\\]/g, '').trim()
    if (sanitizedSearch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).or(`first_name.ilike.%${sanitizedSearch}%,last_name.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%`)
    }
  }
  if (role) {
    const mapped = ROLE_MAP[role]
    if (mapped) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).eq('role', mapped)
    }
  }
  if (active === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq('is_active', true)
  } else if (active === 'false') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq('is_active', false)
  }
  if (leaderId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq('leader_id', leaderId)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 422 })
  }

  const data = parsed.data
  const phone = data.phone.trim().replace(/\s+/g, '')
  const role = data.role
  const leader_id = data.leader_id ?? null

  const admin = createAdminClient()

  // 1. Leader assignment validation
  if (leader_id) {
    if (['leader', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: { leader_id: ['Leaders and admins cannot be assigned a leader.'] } },
        { status: 422 },
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: leaderProfile } = await (admin.from('profiles') as any)
      .select('id, role')
      .eq('id', leader_id)
      .single()

    if (!leaderProfile || !['leader', 'admin'].includes(leaderProfile.role)) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: { leader_id: ['Selected user is not an active leader or admin.'] } },
        { status: 422 },
      )
    }
  }

  // 2. Duplicate phone check (accounting for +91 variants)
  const phoneVariants = [
    phone,
    phone.startsWith('+91') ? phone.replace(/^\+91/, '') : `+91${phone}`,
  ]
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('phone', phoneVariants)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: { phone: ['Phone number already registered.'] } },
      { status: 422 },
    )
  }

  // 3. Derive credentials
  const initialPin = phone.slice(-4)
  const email_auth = phoneToEmail(phone)
  const password   = await derivePassword(phone, initialPin)

  // 4. Create auth user in Supabase
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: email_auth,
    password,
    email_confirm: true,
  })

  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message ?? 'Auth user creation failed' }, { status: 500 })
  }

  // 5. Insert profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData, error: profileErr } = await (admin.from('profiles') as any)
    .insert({
      id: authData.user.id,
      phone,
      first_name: data.first_name,
      last_name: data.last_name,
      role,
      leader_id,
      email: data.email ?? null,
      location: data.location ?? null,
      date_of_joining: data.date_of_joining ?? null,
      referral_name: data.referral_name ?? null,
      remarks: data.remarks ?? null,
      must_change_password: false,
      is_active: true,
    })
    .select('*, leader:profiles!leader_id(id, first_name, last_name, phone)')
    .single()

  if (profileErr) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // 6. Handle optional guest details (traveller_details)
  const detailsSource = data.guest_details || {
    dob: data.dob,
    food_preference: data.food_preference,
    food_allergy: data.food_allergy,
    emergency_contact_name: data.emergency_contact_name,
    emergency_contact_no: data.emergency_contact_no,
    travel_insurance_no: data.travel_insurance_no,
    insurance_company: data.insurance_company,
    insurance_expiry: data.insurance_expiry,
    passport_issued_location: data.passport_issued_location,
    passport_issue_date: data.passport_issue_date,
    visa_no: data.visa_no,
    visa_expiry: data.visa_expiry,
    visa_country: data.visa_country,
  }

  const hasDetails = Object.values(detailsSource).some(v => v !== undefined && v !== null)
  let travellerDetails = null

  if (hasDetails) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tdData, error: tdErr } = await (admin.from('traveller_details') as any)
      .insert({
        user_id: authData.user.id,
        dob: detailsSource.dob ?? null,
        food_preference: detailsSource.food_preference ?? null,
        food_allergy: detailsSource.food_allergy ?? null,
        emergency_contact_name: detailsSource.emergency_contact_name ?? null,
        emergency_contact_no: detailsSource.emergency_contact_no ?? null,
        travel_insurance_no: detailsSource.travel_insurance_no ?? null,
        insurance_company: detailsSource.insurance_company ?? null,
        insurance_expiry: detailsSource.insurance_expiry ?? null,
        passport_issued_location: detailsSource.passport_issued_location ?? null,
        passport_issue_date: detailsSource.passport_issue_date ?? null,
        visa_no: detailsSource.visa_no ?? null,
        visa_expiry: detailsSource.visa_expiry ?? null,
        visa_country: detailsSource.visa_country ?? null,
      })
      .select()
      .single()

    if (tdErr) {
      await (admin.from('profiles') as any).delete().eq('id', authData.user.id)
      await admin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: tdErr.message || 'Failed to save guest details' }, { status: 500 })
    }

    travellerDetails = tdData

    // Handle PAN in guest_documents
    const panVal = data.pan !== undefined ? data.pan : data.guest_details?.pan
    if (panVal) {
      try {
        const enc = await encrypt(panVal.trim())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('guest_documents') as any).insert({
          user_id: authData.user.id,
          doc_type: 'pan',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
        })
      } catch (panErr) {
        console.error('Failed to encrypt PAN:', panErr)
      }
    }

    // Handle Passport in guest_documents
    const passVal = data.passport_no !== undefined ? data.passport_no : data.guest_details?.passport_no
    if (passVal) {
      try {
        const enc = await encrypt(passVal.trim())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('guest_documents') as any).insert({
          user_id: authData.user.id,
          doc_type: 'passport',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: data.passport_expiry ?? data.guest_details?.passport_expiry ?? null,
          issued_date: detailsSource.passport_issue_date ?? null,
          issued_country: detailsSource.passport_issued_location ?? 'India',
        })
      } catch (passErr) {
        console.error('Failed to encrypt Passport:', passErr)
      }
    }

    // Handle Visa in guest_documents
    const visaVal = detailsSource.visa_no
    if (visaVal) {
      try {
        const enc = await encrypt(visaVal.trim())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('guest_documents') as any).insert({
          user_id: authData.user.id,
          doc_type: 'visa',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: detailsSource.visa_expiry ?? null,
          issued_country: detailsSource.visa_country ?? null,
        })
      } catch (visaErr) {
        console.error('Failed to encrypt Visa:', visaErr)
      }
    }
  }

  return NextResponse.json(
    { data: { ...profileData, traveller_details: travellerDetails } },
    { status: 201 },
  )
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PatchUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 422 })
  }

  const { id, reset_pin, reset_password, guest_details, ...fields } = parsed.data
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current, error: fetchErr } = await (admin.from('profiles') as any)
    .select('id, phone, role, leader_id')
    .eq('id', id)
    .single()

  if (fetchErr || !current) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Leader assignment validation
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

  const shouldResetPassword = Boolean(reset_pin || reset_password)
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
  const detailsSource = guest_details || {
    dob: fields.dob,
    food_preference: fields.food_preference,
    food_allergy: fields.food_allergy,
    emergency_contact_name: fields.emergency_contact_name,
    emergency_contact_no: fields.emergency_contact_no,
    travel_insurance_no: fields.travel_insurance_no,
    insurance_company: fields.insurance_company,
    insurance_expiry: fields.insurance_expiry,
    passport_issued_location: fields.passport_issued_location,
    passport_issue_date: fields.passport_issue_date,
    visa_no: fields.visa_no,
    visa_expiry: fields.visa_expiry,
    visa_country: fields.visa_country,
  }

  const hasDetailUpdates = Object.values(detailsSource).some(v => v !== undefined)
  let travellerDetails = null

  if (hasDetailUpdates) {
    const tdPayload: Record<string, unknown> = { user_id: id }
    for (const [k, v] of Object.entries(detailsSource)) {
      if (v !== undefined) tdPayload[k] = v
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tdData } = await (admin.from('traveller_details') as any)
      .upsert(tdPayload, { onConflict: 'user_id' })
      .select()
      .single()
    travellerDetails = tdData
  } else {
    // Fetch existing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tdData } = await (admin.from('traveller_details') as any)
      .select('*')
      .eq('user_id', id)
      .maybeSingle()
    travellerDetails = tdData
  }

  // Handle PAN in guest_documents
  const panVal = fields.pan !== undefined ? fields.pan : guest_details?.pan
  if (panVal) {
    try {
      const enc = await encrypt(panVal.trim())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingPan } = await (admin.from('guest_documents') as any)
        .select('id')
        .eq('user_id', id)
        .eq('doc_type', 'pan')
        .maybeSingle()

      if (existingPan) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('guest_documents') as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          updated_at: new Date().toISOString(),
        }).eq('id', existingPan.id)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('guest_documents') as any).insert({
          user_id: id,
          doc_type: 'pan',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
        })
      }
    } catch (panErr) {
      console.error('Failed to encrypt PAN in admin user PATCH:', panErr)
    }
  }

  // Handle Passport in guest_documents
  const passportVal = fields.passport_no !== undefined ? fields.passport_no : guest_details?.passport_no
  const passportExpVal = fields.passport_expiry !== undefined ? fields.passport_expiry : guest_details?.passport_expiry
  const passportIssueVal = fields.passport_issue_date !== undefined ? fields.passport_issue_date : guest_details?.passport_issue_date
  const passportLocVal = (fields.passport_issued_location ?? guest_details?.passport_issued_location) || 'India'

  if (passportVal) {
    try {
      const enc = await encrypt(passportVal.trim())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingPass } = await (admin.from('guest_documents') as any)
        .select('id')
        .eq('user_id', id)
        .eq('doc_type', 'passport')
        .maybeSingle()

      if (existingPass) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('guest_documents') as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          issued_date: passportIssueVal || null,
          expiry_date: passportExpVal || null,
          issued_country: passportLocVal,
          updated_at: new Date().toISOString(),
        }).eq('id', existingPass.id)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('guest_documents') as any).insert({
          user_id: id,
          doc_type: 'passport',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          issued_date: passportIssueVal || null,
          expiry_date: passportExpVal || null,
          issued_country: passportLocVal,
        })
      }
    } catch (passErr) {
      console.error('Failed to encrypt Passport in admin user PATCH:', passErr)
    }
  }

  // Handle Visa in guest_documents
  const visaVal = fields.visa_no !== undefined ? fields.visa_no : guest_details?.visa_no
  const visaExpVal = fields.visa_expiry !== undefined ? fields.visa_expiry : guest_details?.visa_expiry
  const visaCountryVal = fields.visa_country !== undefined ? fields.visa_country : guest_details?.visa_country

  if (visaVal) {
    try {
      const enc = await encrypt(visaVal.trim())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingVisa } = await (admin.from('guest_documents') as any)
        .select('id')
        .eq('user_id', id)
        .eq('doc_type', 'visa')
        .maybeSingle()

      if (existingVisa) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('guest_documents') as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: visaExpVal || null,
          issued_country: visaCountryVal || null,
          updated_at: new Date().toISOString(),
        }).eq('id', existingVisa.id)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('guest_documents') as any).insert({
          user_id: id,
          doc_type: 'visa',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: visaExpVal || null,
          issued_country: visaCountryVal || null,
        })
      }
    } catch (visaErr) {
      console.error('Failed to encrypt Visa in admin user PATCH:', visaErr)
    }
  }

  return NextResponse.json({
    data: {
      ...updatedProfile,
      traveller_details: travellerDetails,
    },
  })
}
