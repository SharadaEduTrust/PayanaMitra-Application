import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/server/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  compressFileBuffer,
  detectFileType,
  getMaxUploadFileSizeBytes,
} from '@/lib/compression'

export const maxDuration = 60

const FinalizeSchema = z.object({
  tempPath: z.string().min(1, 'tempPath is required'),
  fileName: z.string().min(1, 'fileName is required').max(255),
  targetUserId: z.string().uuid().optional().nullable(),
})

export async function POST(req: NextRequest) {
  const profile = await getSession()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = FinalizeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { tempPath, fileName, targetUserId } = parsed.data
  const admin = createAdminClient()

  // Always delete temp object in finally block (success or failure)
  try {
    // 1. Download file from temp storage
    const { data: blob, error: downloadError } = await admin.storage
      .from('temp-uploads')
      .download(tempPath)

    if (downloadError || !blob) {
      return NextResponse.json(
        { error: `Temp file not found or could not be downloaded: ${downloadError?.message ?? 'Unknown error'}` },
        { status: 404 },
      )
    }

    const buffer = Buffer.from(await blob.arrayBuffer())

    // 2. Enforce maximum file size
    const maxSizeBytes = getMaxUploadFileSizeBytes()
    if (buffer.length > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024))
      return NextResponse.json(
        { error: `File size exceeds maximum allowed limit of ${maxMb} MB.` },
        { status: 422 },
      )
    }

    // 3. Validate file type by magic bytes
    const detected = detectFileType(buffer)
    if (!detected) {
      return NextResponse.json(
        { error: 'Invalid file format. The file content does not match allowed types (PDF, JPEG, PNG, WebP).' },
        { status: 422 },
      )
    }

    // 4. Process compression (or keep as-is if <= 1MB, or fallback on error)
    const compressionResult = await compressFileBuffer({
      buffer,
      filename: fileName,
      mimeTypeHint: detected.mimeType,
    })

    // 5. Upload resulting buffer to final guest-documents bucket
    const userId = targetUserId || profile.id
    const finalPath = `${userId}/${Date.now()}_${crypto.randomUUID()}.${detected.ext}`

    const { error: uploadError } = await admin.storage
      .from('guest-documents')
      .upload(finalPath, compressionResult.buffer, {
        contentType: compressionResult.mimeType,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to store file in final destination: ${uploadError.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      storagePath: finalPath,
      fileName,
      fileSize: compressionResult.finalSize,
      mimeType: compressionResult.mimeType,
      originalSize: compressionResult.originalSize,
      finalSize: compressionResult.finalSize,
      compressed: compressionResult.compressed,
      reason: compressionResult.reason ?? null,
    })
  } finally {
    // Guaranteed cleanup of temp object
    try {
      await admin.storage.from('temp-uploads').remove([tempPath])
    } catch (cleanupErr) {
      console.error('[Uploads Finalize] Failed to remove temp upload object:', tempPath, cleanupErr)
    }
  }
}

