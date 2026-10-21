import { requireProfile } from "@/lib/auth";
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
      : "users";

  return (
    <>
      <header className="topbar">
        <div>
          <h1>CSV Import Utility</h1>
          <small>Bulk upload Guest accounts and Trails data from spreadsheets.</small>
        </div>
      </header>
      <div className="admin-body">
        <CsvImportAdmin initialTab={initialTab} />
      </div>
    </>
  );
}
