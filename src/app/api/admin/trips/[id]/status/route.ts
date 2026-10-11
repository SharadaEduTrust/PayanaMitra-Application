import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * PATCH /api/admin/trips/[id]/status
 *
 * Body: { status: 'draft' | 'published' | 'archived' }
 *
 * Controls the trip lifecycle:
 *   draft → published   : makes trip visible to enrolled members
 *   published → archived : hides trip from members
 *   archived → draft     : restore to editing
 */

interface Params { params: Promise<{ id: string }> }

const StatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
})

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = StatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'status must be one of: draft, published, archived' },
      { status: 422 },
    )
  }

  const admin = createAdminClient()

  // Verify trip exists
  const { data: existing, error: fetchErr } = await admin
    .from('trips')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('trips') as any)
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, trip_code, name, status, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
