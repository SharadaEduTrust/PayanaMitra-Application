import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import CsvImportAdmin from "@/components/csv-import-admin";

export const dynamic = "force-dynamic";

export default async function AdminImportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireProfile(["admin"]);
  const params = await searchParams;
  const initialTab =
    params.tab === "trails"
      ? "trails"
      : params.tab === "details"
      ? "details"
      : params.tab === "mapping" || params.tab === "members"
      ? "mapping"
      : params.tab === "itinerary"
      ? "itinerary"
      : "users";

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trips } = await (admin.from("trips") as any)
    .select("id, trip_code, name")
    .order("trip_code", { ascending: true });

  return (
    <>
      <header className="topbar">
        <div>
          <h1>CSV Import Utility</h1>
          <small>Bulk upload Guest accounts, Trails, Itineraries, and Guest Mappings from spreadsheets.</small>
        </div>
      </header>
      <div className="admin-body">
        <CsvImportAdmin initialTab={initialTab} trips={trips ?? []} />
      </div>
    </>
  );
}
