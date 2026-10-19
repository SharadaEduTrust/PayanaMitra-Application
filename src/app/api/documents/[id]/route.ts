import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

interface Params { params: Promise<{ id: string }> }

const UpdateDocSchema = z.object({
  doc_type:       z.string().min(1).max(50).optional(),
  expiry_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
      if (guestProfile?.leader_id !== profile.id) {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { doc_number_enc, iv, auth_tag, ...safe } = doc
  return NextResponse.json({ ok: true, data: { ...safe, download_url } })
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (admin.from('guest_documents') as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { doc_number_enc, iv, auth_tag, ...safe } = updated
  return NextResponse.json({ ok: true, data: safe })
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
