import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, PHONE_REGEX } from '@/lib/server/auth'

/**
 * PATCH  /api/admin/trips/[id]/contacts/[contactId]  — update a contact
 * DELETE /api/admin/trips/[id]/contacts/[contactId]  — delete a contact
 */

interface Params { params: Promise<{ id: string; contactId: string }> }

const UpdateContactSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  role:        z.string().max(100).optional().nullable(),
  custom_role: z.string().max(100).optional().nullable(),
  phone:       z.string().regex(PHONE_REGEX).optional().nullable(),
  email:       z.string().email().optional().nullable().or(z.literal('')),
}).strict()

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id, contactId } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateContactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { name, role, custom_role, phone, email } = parsed.data
  const updatePayload: Record<string, unknown> = {}

  if (name !== undefined) updatePayload.name = name
  if (phone !== undefined) updatePayload.phone = phone || null
  if (email !== undefined) updatePayload.email = email || null

  if (role !== undefined) {
    if (role && role.toLowerCase() === 'others') {
      if (custom_role && custom_role.trim()) {
        updatePayload.role = custom_role.trim()
      } else {
        return NextResponse.json(
          { error: 'Validation failed', fieldErrors: { custom_role: ['Custom role name required when role is "Others"'] } },
          { status: 422 },
        )
      }
    } else {
      updatePayload.role = role || null
    }
  } else if (custom_role !== undefined) {
    updatePayload.role = custom_role ? custom_role.trim() : null
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('trip_contacts') as any)
    .update(updatePayload)
    .eq('id', contactId)
    .eq('trip_id', trip_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const isStandard = data.role && ['Guide', 'Hotel Manager', 'Transport Provider'].includes(data.role)
  return NextResponse.json({
    data: {
      ...data,
      standard_role: isStandard ? data.role : (data.role ? 'Others' : null),
      custom_role: isStandard ? null : data.role,
    },
  })
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id, contactId } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .from('trip_contacts')
    .delete()
    .eq('id', contactId)
    .eq('trip_id', trip_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
