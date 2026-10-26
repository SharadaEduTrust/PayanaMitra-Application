import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

interface Params { params: Promise<{ id: string }> }

const UpdateDocSchema = z.object({
  doc_type:       z.string().min(1).max(50).optional(),
  expiry_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry_date must be YYYY-MM-DD').optional().nullable(),
  issued_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'issued_date must be YYYY-MM-DD').optional().nullable(),
  issued_place:   z.string().max(100).optional().nullable(),
  issued_country: z.string().max(100).optional().nullable(),
  trip_id:        z.string().uuid().optional().nullable(),
}).strict()

export async function GET(_req: NextRequest, { params }: Params) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error } = await (admin.from('guest_documents') as any)
    .select('*')
    .eq('id', id)
    .single()

  if (error || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // Verify access: owner or admin or assigned leader
  if (doc.user_id !== profile.id && profile.role !== 'admin') {
    if (profile.role === 'leader') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: guestProfile } = await (admin.from('profiles') as any)
        .select('leader_id')
        .eq('id', doc.user_id)
        .single()

      let hasLeaderAccess = guestProfile?.leader_id === profile.id

      if (!hasLeaderAccess) {
        const { data: ledTrips } = await admin.from('trips').select('id').eq('leader_id', profile.id)
        const tripIds = (ledTrips ?? []).map((t: { id: string }) => t.id)
        if (tripIds.length > 0) {
          const { count } = await admin
            .from('trip_members')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', doc.user_id)
            .in('trip_id', tripIds)
          hasLeaderAccess = (count ?? 0) > 0
        }
      }

      if (!hasLeaderAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let download_url: string | null = null
  if (doc.storage_path) {
    const { data: signed } = await admin.storage
      .from('guest-documents')
      .createSignedUrl(doc.storage_path, 3600)
    download_url = signed?.signedUrl ?? null
  }

  const placeVal = (doc.issued_place as string | null) ?? (doc.issued_country as string | null) ?? null
  const countryVal = (doc.issued_country as string | null) ?? (doc.issued_place as string | null) ?? null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { doc_number_enc, iv, auth_tag, ...safe } = doc
  return NextResponse.json({
    ok: true,
    data: {
      ...safe,
      issued_date: (doc.issued_date as string | null) ?? null,
      issued_place: placeVal,
      issued_country: countryVal,
      download_url,
    },
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdateDocSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const admin = createAdminClient()

  // Fetch document to verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc } = await (admin.from('guest_documents') as any)
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (doc.user_id !== profile.id && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updatePayload: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  // Cross-map place & country for legacy compatibility
  if (parsed.data.issued_place !== undefined && parsed.data.issued_country === undefined) {
    updatePayload.issued_country = parsed.data.issued_place
  } else if (parsed.data.issued_country !== undefined && parsed.data.issued_place === undefined) {
    updatePayload.issued_place = parsed.data.issued_country
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: updated, error } = await (admin.from('guest_documents') as any)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  // Fallback if target DB has not migrated issued_date / issued_place columns yet
  if (error && (error.message.includes('column') || error.message.includes('issued_date') || error.message.includes('issued_place'))) {
    delete updatePayload.issued_date
    delete updatePayload.issued_place
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry = await (admin.from('guest_documents') as any)
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()
    updated = retry.data
    error = retry.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const placeVal = updated?.issued_place ?? updated?.issued_country ?? null
  const countryVal = updated?.issued_country ?? updated?.issued_place ?? null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { doc_number_enc, iv, auth_tag, ...safe } = updated
  return NextResponse.json({
    ok: true,
    data: {
      ...safe,
      issued_date: updated?.issued_date ?? parsed.data.issued_date ?? null,
      issued_place: placeVal,
      issued_country: countryVal,
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch document
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc } = await (admin.from('guest_documents') as any)
    .select('id, user_id, storage_path')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (doc.user_id !== profile.id && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete from storage if file exists
  if (doc.storage_path) {
    try {
      await admin.storage.from('guest-documents').remove([doc.storage_path])
    } catch {
      // Storage deletion failure should not block DB deletion
    }
  }

  // Delete record from DB
  const { error } = await admin.from('guest_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: 'Document deleted successfully' })
}
