import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

interface Params { params: Promise<{ id: string }> }

/**
 * GET /api/documents/[id]/download
 * Generates an authorized, short-lived signed URL (60-300 seconds) for downloading a document.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const profile = await getSession()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error } = await (admin.from('guest_documents') as any)
    .select('id, user_id, storage_path, file_name, mime_type')
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

  if (!doc.storage_path) {
    return NextResponse.json({ error: 'No attached file for this document' }, { status: 404 })
  }

  const { data: signedData, error: signErr } = await admin.storage
    .from('guest-documents')
    .createSignedUrl(doc.storage_path, 300) // 5 minutes validity

  if (signErr || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    file_name: doc.file_name,
    mime_type: doc.mime_type,
    signedUrl: signedData.signedUrl,
    expiresIn: 300,
  })
}
