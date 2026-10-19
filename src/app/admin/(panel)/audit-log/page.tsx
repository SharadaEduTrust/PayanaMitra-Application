import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import AuditLogViewer from "@/components/audit-log-viewer";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string; action?: string }>;
}) {
  await requireProfile(["admin"]);
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 25;
  const from = (page - 1) * limit;

  const admin = createAdminClient();
  let query = admin
    .from("audit_log")
    .select(
      "id, action, entity, entity_id, payload, ip, created_at, profiles(id, first_name, last_name, phone)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (params.entity && params.entity !== "all") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).eq("entity", params.entity);
  }
  if (params.action) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).ilike("action", `%${params.action}%`);
  }

  const { data, count } = await query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = (data ?? []).map((row: any) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entity_id: row.entity_id ?? null,
    payload: row.payload ?? null,
    ip: row.ip ?? null,
    created_at: row.created_at,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null,
  }));

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Audit Log</h1>
          <small>Security activity, administrative updates, and system operations.</small>
        </div>
      </header>
      <div className="admin-body">
        <AuditLogViewer
          entries={entries}
          total={count ?? 0}
          page={page}
          limit={limit}
          entityFilter={params.entity ?? "all"}
          actionFilter={params.action ?? ""}
        />
      </div>
    </>
  );
}
