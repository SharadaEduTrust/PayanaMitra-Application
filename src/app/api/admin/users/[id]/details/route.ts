import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, PHONE_REGEX } from '@/lib/server/auth'

interface Params { params: Promise<{ id: string }> }

const FoodPrefSchema = z.enum(['veg', 'non_veg']).nullable().optional()

const GuestDetailsSchema = z.object({
  dob:                      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  food_preference:          FoodPrefSchema,
  food_allergy:             z.string().max(50, 'Max 50 characters').nullable().optional(),
  emergency_contact_name:   z.string().max(50, 'Max 50 characters').nullable().optional(),
  emergency_contact_no:     z.string().regex(PHONE_REGEX, 'Must be 10-15 digits').nullable().optional(),
  travel_insurance_no:      z.string().max(50, 'Max 50 characters').nullable().optional(),
  insurance_company:        z.string().max(50, 'Max 50 characters').nullable().optional(),
  insurance_expiry:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  passport_issued_location: z.string().max(50, 'Max 50 characters').nullable().optional(),
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
  const { data, error } = await (admin.from('traveller_details') as any)
    .select('*')
    .eq('user_id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = GuestDetailsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const admin = createAdminClient()

  // Verify user exists
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id', id)
  if ((count ?? 0) === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('traveller_details') as any)
    .upsert({
      user_id: id,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
