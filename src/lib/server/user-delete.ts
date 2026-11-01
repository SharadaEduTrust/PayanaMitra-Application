import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit'

export interface DeleteUserResult {
  ok: boolean
  error?: string
  status?: number
  deletedUser?: {
    id: string
    phone: string
    name: string
    role: string
  }
}

/**
 * Permanently removes a user account and safely unlinks/cleans up associated records:
 * 1. Verifies caller is not deleting themselves
 * 2. Unlinks non-cascading references (trips.leader_id, profiles.leader_id, audit_log.actor_id)
 * 3. Removes stored files in Supabase Storage (guest-documents & avatars)
 * 4. Removes user from Supabase Auth (which cascades to child profile tables)
 * 5. Explicitly deletes profiles row as a fallback
 * 6. Logs the action in audit_log
 */
export async function deleteUserAccount(
  userId: string,
  actorId: string,
  ip?: string | null,
): Promise<DeleteUserResult> {
  if (userId === actorId) {
    return { ok: false, error: 'You cannot remove your own admin account.', status: 400 }
  }

  const admin = createAdminClient()

  // 1. Verify user exists in profiles or auth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: findErr } = await (admin.from('profiles') as any)
    .select('id, phone, email, first_name, last_name, role')
    .eq('id', userId)
    .maybeSingle()

  if (findErr) {
    return { ok: false, error: findErr.message, status: 500 }
  }

  if (!existing) {
    // Check if user exists in auth.users alone
    const { data: authUser } = await admin.auth.admin.getUserById(userId).catch(() => ({ data: { user: null } }))
    if (!authUser?.user) {
      return { ok: false, error: 'User not found.', status: 404 }
    }
    await admin.auth.admin.deleteUser(userId).catch(() => null)
    return {
      ok: true,
      deletedUser: {
        id: userId,
        phone: authUser.user.phone || '',
        name: 'Unregistered User',
        role: 'traveller',
      },
    }
  }

  // 2. Unlink foreign key references that do not have ON DELETE SET NULL / CASCADE
  // Clear leader_id on trips so foreign key constraint does not block profile deletion
  await admin.from('trips').update({ leader_id: null }).eq('leader_id', userId)

  // Clear leader_id on profiles for any guests mapped to this leader
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('profiles') as any).update({ leader_id: null }).eq('leader_id', userId)

  // Unlink actor_id on historical audit logs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('audit_log') as any).update({ actor_id: null }).eq('actor_id', userId)

  // 3. Remove physical files from storage buckets
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: docs } = await (admin.from('guest_documents') as any)
      .select('storage_path')
      .eq('user_id', userId)

    if (docs && docs.length > 0) {
      const paths = docs
        .map((d: { storage_path: string | null }) => d.storage_path)
        .filter((p: string | null): p is string => Boolean(p))
      if (paths.length > 0) {
        await admin.storage.from('guest-documents').remove(paths)
      }
    }
  } catch {
    // Storage cleanup failure is non-fatal
  }

  try {
    const { data: avatarFiles } = await admin.storage.from('avatars').list(userId)
    if (avatarFiles && avatarFiles.length > 0) {
      await admin.storage.from('avatars').remove(avatarFiles.map((f) => `${userId}/${f.name}`))
    }
  } catch {
    // Storage cleanup failure is non-fatal
  }

  // 4. Delete user from auth (this cascades to profiles and child tables)
  const { error: authErr } = await admin.auth.admin.deleteUser(userId)

  // Ensure profile is deleted even if auth user was missing or didn't cascade
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileErr } = await (admin.from('profiles') as any).delete().eq('id', userId)

  if (authErr && profileErr) {
    return {
      ok: false,
      error: profileErr?.message || authErr?.message || 'Failed to remove user record.',
      status: 500,
    }
  }

  const fullName = `${existing.first_name} ${existing.last_name}`.trim()

  // 5. Audit log the permanent removal
  await audit({
    actorId,
    action: 'delete_user',
    entity: 'profiles',
    entityId: userId,
    payload: {
      phone: existing.phone,
      email: existing.email,
      name: fullName,
      role: existing.role,
    },
    ip: ip ?? null,
  })

  return {
    ok: true,
    deletedUser: {
      id: existing.id,
      phone: existing.phone,
      name: fullName,
      role: existing.role,
    },
  }
}
