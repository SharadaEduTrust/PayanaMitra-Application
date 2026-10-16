import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Writes to `audit_log`. That table has RLS enabled with no policies, so only
 * the service role can insert. Call this from server actions after any
 * privileged change.
 */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: unknown;
  ip?: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    actor_id: entry.actorId ?? null,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    payload: entry.payload ?? null,
    ip: entry.ip ?? null,
  });
}