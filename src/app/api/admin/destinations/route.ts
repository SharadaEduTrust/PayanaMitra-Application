import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET  /api/admin/destinations  — list all destinations (paginated, searchable)
 * POST /api/admin/destinations  — create a destination
 *
 * Query params (GET):
 *   page   — page number (default 1)
 *   limit  — items per page (default 20, max 100)
 *   q      — search by name, region, or country
 */

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

const CreateDestinationSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  region:      z.string().max(200).nullable().optional(),
  country:     z.string().max(200).nullable().optional(),
  image_url:   z.string().url('Must be a valid URL').nullable().optional(),
})

// ─── GET /api/admin/destinations ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10))
  const search = searchParams.get('q') ?? ''
  const from  = (page - 1) * limit

  const admin = createAdminClient()

  let query = admin
    .from('destinations')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, from + limit - 1)

  if (search) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).or(`name.ilike.%${search}%,region.ilike.%${search}%,country.ilike.%${search}%`)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count ?? 0, page, limit })
}

// ─── POST /api/admin/destinations ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateDestinationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('destinations') as any)
    .insert({
      name:        parsed.data.name,
      description: parsed.data.description ?? null,
      region:      parsed.data.region ?? null,
      country:     parsed.data.country ?? null,
      image_url:   parsed.data.image_url ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
