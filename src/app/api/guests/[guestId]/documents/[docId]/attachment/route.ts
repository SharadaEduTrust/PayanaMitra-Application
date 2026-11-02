import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/server/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/server/crypto'
import { compressFileBuffer, detectFileType } from '@/lib/compression'

export const maxDuration = 60

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]

interface RouteParams {
  params: Promise<{
    guestId: string
    docId: string
  }>
}

async function getAdminProfile(req: NextRequest) {
  let profile = await getSession()

  // Support direct Authorization header fallback on NextRequest
  if (!profile) {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim()
      const adminClient = createAdminClient()
      const { data: { user }, error: userErr } = await adminClient.auth.getUser(token)
      if (!userErr && user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (adminClient.from('profiles') as any)
          .select('*')
          .eq('id', user.id)
          .single()
        if (data && data.is_active) {
          profile = data
        }
      }
    }
  }

  if (!profile || profile.role !== 'admin') {
    return null
  }
  return profile
}

/**
 * PATCH /api/guests/[guestId]/documents/[docId]/attachment
 * Multipart form-data upload for attaching or replacing a file on an existing document.
 * Requires admin role.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const profile = await getAdminProfile(req)
  if (!profile) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  const { guestId, docId } = await params
  if (!guestId || !docId) {
    return NextResponse.json({ error: 'Invalid guestId or docId parameter' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Confirm document exists and belongs to the specified guest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error: fetchErr } = await (admin.from('guest_documents') as any)
    .select('*')
    .eq('id', docId)
    .single()

  if (fetchErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (doc.user_id !== guestId) {
    return NextResponse.json(
      { error: 'Document does not belong to the specified guest' },
      { status: 404 }
    )
  }

  // 2. Early Content-Length check to prevent unbounded memory allocation
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File size exceeds 25MB limit. Please upload a smaller file.' },
      { status: 422 }
    )
  }

  // 3. Parse multipart form-data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File size exceeds 25MB limit. Please upload a smaller file.' },
        { status: 422 }
      )
    }
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  const fileEntry = formData.get('file')
  if (!fileEntry || typeof fileEntry !== 'object' || !('arrayBuffer' in fileEntry)) {
    return NextResponse.json({ error: 'File is required in form-data field "file"' }, { status: 400 })
  }

  const file = fileEntry as File
  if (!file.size || file.size === 0) {
    return NextResponse.json({ error: 'Uploaded file cannot be empty' }, { status: 400 })
  }

  // 4. Validate file size (max 25MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File size exceeds 25MB limit. Please upload a smaller file.' },
      { status: 422 }
    )
  }

  // 5. Validate MIME type
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file format. Allowed types: PDF, JPEG, PNG, WebP.' },
      { status: 422 }
    )
  }

  const arrayBuf = await file.arrayBuffer()
  const rawBuffer = Buffer.from(arrayBuf)

  // Validate magic bytes
  const detected = detectFileType(rawBuffer)
  if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mimeType)) {
    return NextResponse.json(
      { error: 'Invalid file format. The file content does not match allowed types (PDF, JPEG, PNG, WebP).' },
      { status: 422 }
    )
  }

  // 5. Automatic compression for files > 1 MB (iLoveIMG for images, iLovePDF for PDFs)
  let compressionResult
  try {
    compressionResult = await compressFileBuffer({
      buffer: rawBuffer,
      filename: file.name,
      mimeTypeHint: detected.mimeType,
    })
  } catch (compressionErr) {
    console.warn('[Attachment Upload] Compression failed, falling back to original buffer:', compressionErr)
    compressionResult = {
      buffer: rawBuffer,
      compressed: false,
      originalSize: rawBuffer.length,
      finalSize: rawBuffer.length,
      mimeType: detected.mimeType,
      reason: 'Compression error, raw buffer preserved',
    }
  }

  // 6. Delete old file on replace if previous attachment existed
  if (doc.storage_path) {
    try {
      await admin.storage.from('guest-documents').remove([doc.storage_path])
    } catch (removeErr) {
      console.warn('[Attachment Upload] Failed to remove previous storage file:', doc.storage_path, removeErr)
    }
  }

  // 7. Upload new file to Supabase Storage at guests/{guestId}/{docType}/{timestamp}-{filename}
  const cleanDocType = (doc.doc_type || 'document').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_')
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  const storagePath = `guests/${guestId}/${cleanDocType}/${timestamp}-${cleanFileName}`

  const { error: uploadErr } = await admin.storage
    .from('guest-documents')
    .upload(storagePath, compressionResult.buffer, {
      contentType: compressionResult.mimeType,
      upsert: true,
    })

  if (uploadErr) {
    return NextResponse.json(
      { error: `Failed to upload file to storage: ${uploadErr.message}` },
      { status: 500 }
    )
  }

  // 8. Update database row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedDoc, error: updateErr } = await (admin.from('guest_documents') as any)
    .update({
      storage_path: storagePath,
      file_name: file.name,
      file_size: compressionResult.finalSize,
      mime_type: compressionResult.mimeType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', docId)
    .select('*')
    .single()

  if (updateErr || !updatedDoc) {
    return NextResponse.json(
      { error: `Failed to update document record: ${updateErr?.message ?? 'Unknown database error'}` },
      { status: 500 }
    )
  }

  // 9. Generate signed download URL for response
  let download_url: string | null = null
  try {
    const { data: signed } = await admin.storage
      .from('guest-documents')
      .createSignedUrl(storagePath, 3600)
    download_url = signed?.signedUrl ?? null
  } catch {
    download_url = null
  }

  // Decrypt document number for response
  let doc_number: string | null = null
  if (updatedDoc.doc_number_enc && updatedDoc.iv && updatedDoc.auth_tag) {
    try {
      doc_number = await decrypt({
        ciphertext: updatedDoc.doc_number_enc as string,
        iv: updatedDoc.iv as string,
        authTag: updatedDoc.auth_tag as string,
      })
    } catch {
      doc_number = null
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { doc_number_enc, iv, auth_tag, ...safe } = updatedDoc

  return NextResponse.json({
    ok: true,
    data: {
      ...safe,
      doc_number,
      download_url,
    },
    compression: {
      compressed: compressionResult.compressed,
      originalSize: compressionResult.originalSize,
      finalSize: compressionResult.finalSize,
      reason: compressionResult.reason ?? null,
    },
  })
}

/**
 * DELETE /api/guests/[guestId]/documents/[docId]/attachment
 * Detaches and removes only the uploaded file attachment from storage and DB,
 * keeping the document metadata row intact.
 * Requires admin role.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const profile = await getAdminProfile(req)
  if (!profile) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  const { guestId, docId } = await params
  if (!guestId || !docId) {
    return NextResponse.json({ error: 'Invalid guestId or docId parameter' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Confirm document exists and belongs to the specified guest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error: fetchErr } = await (admin.from('guest_documents') as any)
    .select('*')
    .eq('id', docId)
    .single()

  if (fetchErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  if (doc.user_id !== guestId) {
    return NextResponse.json(
      { error: 'Document does not belong to the specified guest' },
      { status: 404 }
    )
  }

  // 2. Remove file from storage if present
  if (doc.storage_path) {
    try {
      await admin.storage.from('guest-documents').remove([doc.storage_path])
    } catch (storageErr) {
      console.warn(`[Attachment DELETE] Failed removing file from storage:`, storageErr)
    }
  }

  // 3. Clear attachment columns on the document row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedDoc, error: updateErr } = await (admin.from('guest_documents') as any)
    .update({
      storage_path: null,
      file_name: null,
      file_size: null,
      mime_type: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', docId)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  let doc_number: string | null = null
  if (updatedDoc?.doc_number_enc && updatedDoc.iv && updatedDoc.auth_tag) {
    try {
      doc_number = await decrypt({
        ciphertext: updatedDoc.doc_number_enc as string,
        iv: updatedDoc.iv as string,
        authTag: updatedDoc.auth_tag as string,
      })
    } catch {
      doc_number = null
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { doc_number_enc, iv, auth_tag, ...safe } = updatedDoc

  return NextResponse.json({
    ok: true,
    message: 'Attachment removed successfully',
    data: {
      ...safe,
      doc_number,
      download_url: null,
    },
  })
}
