import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/server/crypto'

/**
 * GET  /api/documents  — list logged-in user's documents (with decrypted doc number)
 * POST /api/documents  — encrypt and store a new document
 *
 * The raw doc_number is NEVER stored. We encrypt it server-side before writing,
 * and decrypt it server-side before returning. Only the owner can access their docs
 * (enforced by RLS + session check).
 */

const CreateDocSchema = z.object({
  doc_type:       z.string().min(1, 'Document type required').max(50),
  doc_number:     z.string().min(1, 'Document number required').max(100),
  expiry_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  issued_country: z.string().max(100).optional().nullable(),
  trip_id:        z.string().uuid().optional().nullable(),
})

// ─── GET /api/documents ───────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('guest_documents') as any)
    .select('id, doc_type, doc_number_enc, iv, auth_tag, expiry_date, issued_country, trip_id, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as {
      data: Array<{
        id: string; doc_type: string; doc_number_enc: string | null
        iv: string | null; auth_tag: string | null
        expiry_date: string | null; issued_country: string | null
        trip_id: string | null; created_at: string; updated_at: string
      }> | null
      error: { message: string } | null
    }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Decrypt doc numbers server-side before returning
  const docs = await Promise.all(
    (data ?? []).map(async (doc) => {
      let doc_number: string | null = null
      if (doc.doc_number_enc && doc.iv && doc.auth_tag) {
        try {
          doc_number = await decrypt({
            ciphertext: doc.doc_number_enc,
            iv: doc.iv,
            authTag: doc.auth_tag,
          })
        } catch {
          doc_number = null
        }
      }
      const { doc_number_enc: _enc, iv: _iv, auth_tag: _tag, ...safe } = doc
      return { ...safe, doc_number }
    }),
  )

  return NextResponse.json({ data: docs })
}

// ─── POST /api/documents ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateDocSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { doc_number, ...rest } = parsed.data

  // Encrypt the document number
  const { ciphertext, iv, authTag } = await encrypt(doc_number)

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from('guest_documents') as any)
    .insert({
      ...rest,
      user_id: user.id,
      doc_number_enc: ciphertext,
      iv,
      auth_tag: authTag,
    })
    .select('id, doc_type, expiry_date, issued_country, trip_id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return without cipher fields
  return NextResponse.json({ data: { ...data, doc_number } }, { status: 201 })
}
