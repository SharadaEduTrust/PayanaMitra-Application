import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, derivePassword, PHONE_REGEX } from '@/lib/server/auth'
import { formatZodError } from '@/lib/server/zod-error'
import { deleteUserAccount } from '@/lib/server/user-delete'
import { encrypt } from '@/lib/server/crypto'

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

const GuestDetailsSchema = z.object({
  dob:                      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  food_preference:          FoodPrefSchema,
  food_allergy:             z.string().max(30, 'Max 30 characters').nullable().optional(),
  emergency_contact_name:   z.string().max(20, 'Max 20 characters').nullable().optional(),
  emergency_contact_no:     z.string().regex(PHONE_REGEX, 'Emergency contact number must be 10-15 digits').nullable().optional(),
  travel_insurance_no:      z.string().max(50, 'Max 50 characters').nullable().optional(),
  insurance_company:        z.string().max(50, 'Max 50 characters').nullable().optional(),
  insurance_expiry:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  passport_issued_location: z.string().max(50, 'Max 50 characters').nullable().optional(),
  passport_issue_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  pan:                      z.string().trim().max(10).nullable().optional(),
  aadhar:                   z.string().trim().max(20).nullable().optional(),
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
  guest_details:   GuestDetailsSchema,
  dob:                      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  food_preference:          FoodPrefSchema,
  food_allergy:             z.string().max(30).nullable().optional(),
  emergency_contact_name:   z.string().max(20).nullable().optional(),
  emergency_contact_no:     z.string().regex(PHONE_REGEX).nullable().optional(),
  travel_insurance_no:      z.string().max(50).nullable().optional(),
  insurance_company:        z.string().max(50).nullable().optional(),
  insurance_expiry:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  passport_issued_location: z.string().max(50).nullable().optional(),
  passport_issue_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pan:                      z.string().trim().max(10).nullable().optional(),
  aadhar:                   z.string().trim().max(20).nullable().optional(),
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

  const { reset_pin, reset_password, ...fields } = parsed.data
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
  const { guest_details } = fields
  const tdKeys = ['dob', 'food_preference', 'food_allergy', 'emergency_contact_name', 'emergency_contact_no', 'travel_insurance_no', 'insurance_company', 'insurance_expiry', 'passport_issued_location', 'passport_issue_date', 'visa_no', 'visa_expiry', 'visa_country'] as const
  const tdPayload: Record<string, unknown> = { user_id: id }
  let hasTd = false
  for (const k of tdKeys) {
    const val = fields[k] !== undefined ? fields[k] : (guest_details && guest_details[k] !== undefined ? guest_details[k] : undefined)
    if (val !== undefined) {
      tdPayload[k] = val
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

  // Handle encrypted documents: PAN, Aadhar, Passport, Visa
  const docWarnings: string[] = []

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
        const { error: panUpdErr } = await (admin.from('guest_documents') as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          updated_at: new Date().toISOString(),
        }).eq('id', existingPan.id)
        if (panUpdErr) {
          console.error('Failed to update PAN:', panUpdErr.message)
          docWarnings.push('PAN could not be saved')
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: panInsErr } = await (admin.from('guest_documents') as any).insert({
          user_id: id,
          doc_type: 'pan',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
        })
        if (panInsErr) {
          console.error('Failed to insert PAN:', panInsErr.message)
          docWarnings.push('PAN could not be saved')
        }
      }
    } catch (panErr) {
      console.error('Failed to encrypt PAN:', panErr)
      docWarnings.push('PAN could not be saved')
    }
  }

  const aadharVal = fields.aadhar !== undefined ? fields.aadhar : guest_details?.aadhar
  if (aadharVal) {
    try {
      const cleanAadhar = aadharVal.trim().replace(/\s+/g, '')
      const enc = await encrypt(cleanAadhar)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingAadhar } = await (admin.from('guest_documents') as any)
        .select('id')
        .eq('user_id', id)
        .in('doc_type', ['aadhar', 'aadhaar'])
        .maybeSingle()

      if (existingAadhar) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: aadharUpdErr } = await (admin.from('guest_documents') as any).update({
          doc_type: 'aadhar',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          updated_at: new Date().toISOString(),
        }).eq('id', existingAadhar.id)
        if (aadharUpdErr) {
          console.error('Failed to update Aadhar:', aadharUpdErr.message)
          docWarnings.push('Aadhar could not be saved')
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: aadharInsErr } = await (admin.from('guest_documents') as any).insert({
          user_id: id,
          doc_type: 'aadhar',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
        })
        if (aadharInsErr) {
          console.error('Failed to insert Aadhar:', aadharInsErr.message)
          docWarnings.push('Aadhar could not be saved')
        }
      }
    } catch (aadharErr) {
      console.error('Failed to encrypt Aadhar:', aadharErr)
      docWarnings.push('Aadhar could not be saved')
    }
  }

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
        const { error: passUpdErr } = await (admin.from('guest_documents') as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          issued_date: passportIssueVal || null,
          expiry_date: passportExpVal || null,
          issued_country: passportLocVal,
          updated_at: new Date().toISOString(),
        }).eq('id', existingPass.id)
        if (passUpdErr) {
          console.error('Failed to update Passport:', passUpdErr.message)
          docWarnings.push('Passport could not be saved')
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: passInsErr } = await (admin.from('guest_documents') as any).insert({
          user_id: id,
          doc_type: 'passport',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          issued_date: passportIssueVal || null,
          expiry_date: passportExpVal || null,
          issued_country: passportLocVal,
        })
        if (passInsErr) {
          console.error('Failed to insert Passport:', passInsErr.message)
          docWarnings.push('Passport could not be saved')
        }
      }
    } catch (passErr) {
      console.error('Failed to encrypt Passport:', passErr)
      docWarnings.push('Passport could not be saved')
    }
  }

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
        const { error: visaUpdErr } = await (admin.from('guest_documents') as any).update({
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: visaExpVal || null,
          issued_country: visaCountryVal || null,
          updated_at: new Date().toISOString(),
        }).eq('id', existingVisa.id)
        if (visaUpdErr) {
          console.error('Failed to update Visa:', visaUpdErr.message)
          docWarnings.push('Visa could not be saved')
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: visaInsErr } = await (admin.from('guest_documents') as any).insert({
          user_id: id,
          doc_type: 'visa',
          doc_number_enc: enc.ciphertext,
          iv: enc.iv,
          auth_tag: enc.authTag,
          expiry_date: visaExpVal || null,
          issued_country: visaCountryVal || null,
        })
        if (visaInsErr) {
          console.error('Failed to insert Visa:', visaInsErr.message)
          docWarnings.push('Visa could not be saved')
        }
      }
    } catch (visaErr) {
      console.error('Failed to encrypt Visa:', visaErr)
      docWarnings.push('Visa could not be saved')
    }
  }

  return NextResponse.json({
    data: {
      ...updatedProfile,
      traveller_details: travellerDetails,
    },
    ...(docWarnings.length > 0 ? { warnings: docWarnings, message: 'User updated, but some documents could not be saved: ' + docWarnings.join(', ') } : {}),
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  const result = await deleteUserAccount(id, guard.profile.id, ip)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({
    ok: true,
    message: `User ${result.deletedUser?.name || id} removed successfully`,
    data: result.deletedUser,
  })
}
