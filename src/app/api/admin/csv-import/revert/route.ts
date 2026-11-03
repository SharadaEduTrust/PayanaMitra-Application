import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'
import { deleteUserAccount } from '@/lib/server/user-delete'
import { audit } from '@/lib/audit'

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: { auditId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { auditId } = body
  if (!auditId) {
    return NextResponse.json({ error: 'auditId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Fetch audit log entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: fetchErr } = await (admin.from('audit_log') as any)
    .select('*')
    .eq('id', auditId)
    .eq('action', 'csv_import')
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!entry) {
    return NextResponse.json({ error: 'Import record not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = (entry.payload ?? {}) as Record<string, any>
  if (payload.reverted) {
    return NextResponse.json({ error: 'This import has already been reverted.' }, { status: 400 })
  }

  const section = payload.section as string
  const filename = payload.filename || 'file'
  let revertedCount = 0

  // Correlation time window for past imports that do not have created_ids
  const auditTime = new Date(entry.created_at).getTime()
  const windowStart = new Date(auditTime - 5 * 60 * 1000).toISOString()
  const windowEnd = new Date(auditTime + 60 * 1000).toISOString()

  try {
    switch (section) {
      case 'trails': {
        const createdIds: string[] = payload.created_ids ?? []
        if (createdIds.length > 0) {
          for (const tripId of createdIds) {
            // Unlink non-cascading references
            await admin.from('notifications').update({ trip_id: null }).eq('trip_id', tripId)
            await admin.from('guest_documents').update({ trip_id: null }).eq('trip_id', tripId)
            const { error: delErr } = await admin.from('trips').delete().eq('id', tripId)
            if (!delErr) revertedCount++
          }
        } else {
          // Fallback for past imports
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: pastTrips } = await (admin.from('trips') as any)
            .select('id')
            .gte('created_at', windowStart)
            .lte('created_at', windowEnd)
          if (pastTrips && pastTrips.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const t of pastTrips as any[]) {
              await admin.from('notifications').update({ trip_id: null }).eq('trip_id', t.id)
              await admin.from('guest_documents').update({ trip_id: null }).eq('trip_id', t.id)
              const { error: delErr } = await admin.from('trips').delete().eq('id', t.id)
              if (!delErr) revertedCount++
            }
          }
        }
        break
      }

      case 'users': {
        const createdIds: string[] = payload.created_ids ?? []
        if (createdIds.length > 0) {
          for (const userId of createdIds) {
            const res = await deleteUserAccount(userId, guard.profile.id)
            if (res.ok) revertedCount++
          }
        } else {
          // Fallback for past imports
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: pastProfiles } = await (admin.from('profiles') as any)
            .select('id, role')
            .neq('role', 'admin') // safety: never delete admins
            .gte('created_at', windowStart)
            .lte('created_at', windowEnd)
          if (pastProfiles && pastProfiles.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const p of pastProfiles as any[]) {
              const res = await deleteUserAccount(p.id, guard.profile.id)
              if (res.ok) revertedCount++
            }
          }
        }
        break
      }

      case 'mapping': {
        const createdIds: string[] = payload.created_ids ?? []
        if (createdIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: delErr } = await (admin.from('trip_members') as any)
            .delete()
            .in('id', createdIds)
          if (!delErr) revertedCount = createdIds.length
        } else {
          // Fallback for past imports
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: pastMembers } = await (admin.from('trip_members') as any)
            .select('id')
            .gte('created_at', windowStart)
            .lte('created_at', windowEnd)
          if (pastMembers && pastMembers.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ids = (pastMembers as any[]).map(m => m.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin.from('trip_members') as any).delete().in('id', ids)
            revertedCount = ids.length
          }
        }
        break
      }

      case 'itinerary': {
        const dayIds: string[] = payload.day_ids ?? []
        if (dayIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from('activities') as any).delete().in('itinerary_day_id', dayIds)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: delErr } = await (admin.from('itinerary_days') as any).delete().in('id', dayIds)
          if (!delErr) revertedCount = dayIds.length
        } else {
          // Fallback for past imports
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: pastDays } = await (admin.from('itinerary_days') as any)
            .select('id')
            .gte('created_at', windowStart)
            .lte('created_at', windowEnd)
          if (pastDays && pastDays.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ids = (pastDays as any[]).map(d => d.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin.from('activities') as any).delete().in('itinerary_day_id', ids)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin.from('itinerary_days') as any).delete().in('id', ids)
            revertedCount = ids.length
          }
        }
        break
      }

      case 'guest_details': {
        const createdIds: string[] = payload.created_ids ?? []
        const updatedIds: string[] = payload.updated_ids ?? []

        // If any users were auto-created by this import, remove them
        for (const userId of createdIds) {
          await deleteUserAccount(userId, guard.profile.id)
          revertedCount++
        }

        if (updatedIds.length > 0) {
          // Delete guest documents created/updated
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from('guest_documents') as any).delete().in('user_id', updatedIds)
          // Reset traveller details
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from('traveller_details') as any).delete().in('user_id', updatedIds)
          revertedCount += updatedIds.length
        } else {
          // Fallback for past imports: find guest documents and traveller details touched in that window
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: pastDocs } = await (admin.from('guest_documents') as any)
            .select('id, user_id')
            .gte('updated_at', windowStart)
            .lte('updated_at', windowEnd)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docUserIds = Array.from(new Set((pastDocs ?? []).map((d: any) => d.user_id as string)))

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: pastDetails } = await (admin.from('traveller_details') as any)
            .select('id, user_id')
            .gte('updated_at', windowStart)
            .lte('updated_at', windowEnd)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detailUserIds = Array.from(new Set((pastDetails ?? []).map((d: any) => d.user_id as string)))

          const allUserIds = Array.from(new Set([...docUserIds, ...detailUserIds]))
          if (allUserIds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin.from('guest_documents') as any).delete().in('user_id', allUserIds)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (admin.from('traveller_details') as any).delete().in('user_id', allUserIds)
            revertedCount = allUserIds.length
          }
        }
        break
      }

      default: {
        return NextResponse.json({ error: `Reverting is not supported for section: ${section}` }, { status: 400 })
      }
    }

    // Mark the audit entry as reverted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('audit_log') as any)
      .update({
        payload: {
          ...payload,
          reverted: true,
          reverted_at: new Date().toISOString(),
          reverted_by: guard.profile.id,
          reverted_count: revertedCount,
        },
      })
      .eq('id', auditId)

    // Log the revert action itself
    await audit({
      actorId: guard.profile.id,
      action: 'csv_import_revert',
      entity: 'csv_import',
      entityId: auditId,
      payload: {
        original_audit_id: auditId,
        section,
        filename,
        reverted_count: revertedCount,
      },
    })

    return NextResponse.json({
      ok: true,
      revertedCount,
      message: `Successfully reverted import of ${filename} (${revertedCount} record${revertedCount === 1 ? '' : 's'} affected).`,
    })
  } catch (err) {
    return NextResponse.json({ error: `Failed to revert import: ${String(err)}` }, { status: 500 })
  }
}

