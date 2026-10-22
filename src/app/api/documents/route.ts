import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'
import { encrypt, decrypt } from '@/lib/server/crypto'

/**
 * GET  /api/documents — list documents for the user (or authorized leader/admin) with decrypted doc numbers & signed download URLs
 * POST /api/documents — upload and securely store a document (supports JSON and multipart/form-data with file upload)
 */

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const CreateDocSchema = z.object({
  user_id:        z.string().uuid().optional().nullable(),
  target_user_id: z.string().uuid().optional().nullable(),
  doc_type:       z.string().min(1, 'Document type required').max(50),
  doc_number:     z.string().max(100).optional().nullable(),
  issued_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  expiry_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  issued_country: z.string().max(100).optional().nullable(),
  issued_place:   z.string().max(100).optional().nullable(),
  trip_id:        z.string().uuid().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const requestedUserId = searchParams.get('user_id')

  let targetUserId = profile.id
  const admin = createAdminClient()

  if (requestedUserId && requestedUserId !== profile.id) {
    if (profile.role === 'admin') {
      targetUserId = requestedUserId
    } else if (profile.role === 'leader') {
      // Verify this guest is assigned to this leader via trail or legacy leader_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: guestProfile } = await (admin.from('profiles') as any)
        .select('id, leader_id')
        .eq('id', requestedUserId)
        .single()

      let hasLeaderAccess = guestProfile?.leader_id === profile.id

      if (!hasLeaderAccess) {
        const { data: ledTrips } = await admin.from('trips').select('id').eq('leader_id', profile.id)
        const tripIds = (ledTrips ?? []).map((t: { id: string }) => t.id)
        if (tripIds.length > 0) {
          const { count } = await admin
            .from('trip_members')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', requestedUserId)
            .in('trip_id', tripIds)
          hasLeaderAccess = (count ?? 0) > 0
        }
      }

      if (!hasLeaderAccess) {
        return NextResponse.json({ error: 'Forbidden: You are not assigned to this guest' }, { status: 403 })
      }
      targetUserId = requestedUserId
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('guest_documents') as any)
    .select('*')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Decrypt doc numbers and generate signed URLs for documents that have files stored
  const docs = await Promise.all(
    (data ?? []).map(async (doc: Record<string, unknown>) => {
      let doc_number: string | null = null
      if (doc.doc_number_enc && doc.iv && doc.auth_tag) {
        try {
          doc_number = await decrypt({
            ciphertext: doc.doc_number_enc as string,
            iv: doc.iv as string,
            authTag: doc.auth_tag as string,
          })
        } catch {
          doc_number = null
        }
      }

      let download_url: string | null = null
      if (doc.storage_path) {
        try {
          const { data: signedData } = await admin.storage
            .from('guest-documents')
            .createSignedUrl(doc.storage_path as string, 3600) // 1 hour
          download_url = signedData?.signedUrl ?? null
        } catch {
          download_url = null
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { doc_number_enc, iv, auth_tag, ...safe } = doc
      return {
        ...safe,
        doc_number,
        download_url,
      }
    }),
  )

  return NextResponse.json({ ok: true, data: docs })
}

export async function POST(req: NextRequest) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''
  const admin = createAdminClient()

  let doc_type = ''
  let doc_number: string | null = null
  let issued_date: string | null = null
  let expiry_date: string | null = null
  let issued_country: string | null = null
  let trip_id: string | null = null
  let targetUserId = profile.id

  let storage_path: string | null = null
  let file_name: string | null = null
  let file_size: number | null = null
  let mime_type: string | null = null

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }

    const requestedUser = (formData.get('user_id') as string)?.trim() || (formData.get('target_user_id') as string)?.trim() || null
    if (requestedUser && requestedUser !== profile.id) {
      if (profile.role === 'admin') {
        targetUserId = requestedUser
      } else {
        return NextResponse.json({ error: 'Forbidden: Only administrators can upload documents for other users' }, { status: 403 })
      }
    }

    doc_type = String(formData.get('doc_type') ?? formData.get('type') ?? '').trim()
    doc_number = (formData.get('doc_number') as string)?.trim() || (formData.get('document_number') as string)?.trim() || null
    issued_date = (formData.get('issued_date') as string)?.trim() || null
    expiry_date = (formData.get('expiry_date') as string)?.trim() || null
    issued_country = (formData.get('issued_place') as string)?.trim() || (formData.get('issued_country') as string)?.trim() || (formData.get('country') as string)?.trim() || null
    trip_id = (formData.get('trip_id') as string)?.trim() || null

    if (!doc_type) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors: { doc_type: ['doc_type is required'] } }, { status: 422 })
    }

    const fileEntry = formData.get('file')
    if (fileEntry && typeof fileEntry === 'object' && 'arrayBuffer' in fileEntry) {
      const file = fileEntry as File
      if (file.size > 0) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: 'File size exceeds maximum allowed limit (10MB)' }, { status: 422 })
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          return NextResponse.json({ error: 'Invalid file type. Allowed types: PDF, JPEG, PNG, WebP' }, { status: 422 })
        }

        file_name = file.name
        file_size = file.size
        mime_type = file.type

        const ext = file.name.split('.').pop() || 'bin'
        const safeDocType = doc_type.toLowerCase().replace(/[^a-z0-9]/g, '_')
        storage_path = `${targetUserId}/${safeDocType}_${Date.now()}_${crypto.randomUUID()}.${ext}`

        const buffer = Buffer.from(await file.arrayBuffer())
        const { error: uploadErr } = await admin.storage
          .from('guest-documents')
          .upload(storage_path, buffer, {
            contentType: file.type,
            upsert: true,
          })

        if (uploadErr) {
          return NextResponse.json({ error: `File upload failed: ${uploadErr.message}` }, { status: 500 })
        }
      }
    }
  } else {
    // Standard JSON body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = CreateDocSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      )
    }

    const requestedUser = parsed.data.user_id || parsed.data.target_user_id || null
    if (requestedUser && requestedUser !== profile.id) {
      if (profile.role === 'admin') {
        targetUserId = requestedUser
      } else {
        return NextResponse.json({ error: 'Forbidden: Only administrators can upload documents for other users' }, { status: 403 })
      }
    }

    doc_type = parsed.data.doc_type
    doc_number = parsed.data.doc_number ?? null
    issued_date = parsed.data.issued_date ?? null
    expiry_date = parsed.data.expiry_date ?? null
    issued_country = parsed.data.issued_place ?? parsed.data.issued_country ?? null
    trip_id = parsed.data.trip_id ?? null
  }

  // Encrypt document number if provided
  let ciphertext: string | null = null
  let iv = ''
  let authTag = ''

  if (doc_number) {
    const encResult = await encrypt(doc_number)
    ciphertext = encResult.ciphertext
    iv = encResult.iv
    authTag = encResult.authTag
  } else {
    // Generate dummy IV/tag if doc_number is optional for purely file uploads
    const dummy = await encrypt('N/A')
    iv = dummy.iv
    authTag = dummy.authTag
  }

  // Insert document record
  const insertPayload: Record<string, unknown> = {
    user_id: targetUserId,
    trip_id: trip_id || null,
    doc_type,
    doc_number_enc: ciphertext,
    iv,
    auth_tag: authTag,
    issued_date: issued_date || null,
    expiry_date: expiry_date || null,
    issued_country: issued_country || null,
  }

  if (storage_path) insertPayload.storage_path = storage_path
  if (file_name) insertPayload.file_name = file_name
  if (file_size) insertPayload.file_size = file_size
  if (mime_type) insertPayload.mime_type = mime_type

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let insertResult = await (admin.from('guest_documents') as any)
    .insert(insertPayload)
    .select()
    .single()

  if (insertResult.error && (insertResult.error.message.includes('column') || insertResult.error.message.includes('storage_path') || insertResult.error.message.includes('issued_date'))) {
    // Fallback if issued_date or storage columns have not been migrated
    if (insertResult.error.message.includes('issued_date')) {
      delete insertPayload.issued_date
    }
    if (insertResult.error.message.includes('storage_path') || insertResult.error.message.includes('column')) {
      delete insertPayload.storage_path
      delete insertPayload.file_name
      delete insertPayload.file_size
      delete insertPayload.mime_type
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insertResult = await (admin.from('guest_documents') as any)
      .insert(insertPayload)
      .select()
      .single()
  }

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ error: insertResult.error?.message ?? 'Document creation failed' }, { status: 500 })
  }

  const createdDoc = insertResult.data

  let download_url: string | null = null
  if (storage_path) {
    const { data: signed } = await admin.storage
      .from('guest-documents')
      .createSignedUrl(storage_path, 3600)
    download_url = signed?.signedUrl ?? null
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: createdDoc.id,
      doc_type: createdDoc.doc_type,
      doc_number,
      expiry_date: createdDoc.expiry_date,
      issued_country: createdDoc.issued_country,
      trip_id: createdDoc.trip_id,
      storage_path,
      file_name,
      file_size,
      download_url,
      created_at: createdDoc.created_at,
    },
  }, { status: 201 })
}
