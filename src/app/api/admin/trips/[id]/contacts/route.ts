import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, PHONE_REGEX } from '@/lib/server/auth'

/**
 * GET    /api/admin/trips/[id]/contacts  — list contacts for a trip
 * POST   /api/admin/trips/[id]/contacts  — add a contact (Guide | Hotel Manager | Transport Provider | Others + custom)
 */

interface Params { params: Promise<{ id: string }> }

const CreateContactSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(100, 'Max 100 characters'),
  role:        z.string().min(1, 'Role is required').max(100),
  custom_role: z.string().max(100).optional().nullable(),
  phone:       z.string().regex(PHONE_REGEX, 'Must be a valid 10-15 digit phone number').optional().nullable(),
  email:       z.string().email('Invalid email').optional().nullable().or(z.literal('')),
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

  const { id: trip_id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('trip_contacts')
    .select('*')
    .eq('trip_id', trip_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map roles back so frontend knows whether it was standard or Others
  const mapped = (data ?? []).map((c: { role: string | null; [key: string]: unknown }) => {
    const isStandard = c.role && ['Guide', 'Hotel Manager', 'Transport Provider'].includes(c.role)
    return {
      ...c,
      standard_role: isStandard ? c.role : (c.role ? 'Others' : null),
      custom_role: isStandard ? null : c.role,
    }
  })

  return NextResponse.json({ data: mapped })
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateContactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { name, role, custom_role, phone, email } = parsed.data

  let finalRole = role
  if (role.toLowerCase() === 'others') {
    if (!custom_role || !custom_role.trim()) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: { custom_role: ['Custom role name is required when role is "Others"'] } },
        { status: 422 },
      )
    }
    finalRole = custom_role.trim()
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('trip_contacts') as any)
    .insert({
      trip_id,
      name,
      role: finalRole,
      phone: phone || null,
      email: email || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const isStandard = ['Guide', 'Hotel Manager', 'Transport Provider'].includes(finalRole)
  return NextResponse.json({
    data: {
      ...data,
      standard_role: isStandard ? finalRole : 'Others',
      custom_role: isStandard ? null : finalRole,
    },
  }, { status: 201 })
}
