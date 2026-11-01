import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/server/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const SignedUrlSchema = z.object({
  fileName: z.string().min(1, 'fileName is required').max(255),
  mimeType: z.string().min(1, 'mimeType is required').max(100),
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

  const parsed = SignedUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { fileName } = parsed.data
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const tempPath = `temp_${Date.now()}_${crypto.randomUUID()}_${sanitizedFileName}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('temp-uploads')
    .createSignedUploadUrl(tempPath)

  if (error || !data) {
    return NextResponse.json(
      { error: `Failed to create signed upload URL: ${error?.message ?? 'Unknown storage error'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    signedUrl: data.signedUrl,
    path: data.path,
    token: data.token,
    tempPath,
  })
}

