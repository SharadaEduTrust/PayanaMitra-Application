import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Destination } from "@/lib/types";
import DestinationsAdmin from "@/components/destinations-admin";

export const dynamic = "force-dynamic";

export default async function AdminDestinationsPage() {
  await requireProfile(["admin"]);
  const supabase = await createClient();

  const { data } = await supabase.from("destinations").select("*").order("name");

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Destinations</h1>
          <small>The catalogue travellers can browse.</small>
        </div>
      </header>
      <div className="admin-body">
        <DestinationsAdmin destinations={(data ?? []) as Destination[]} />
      </div>
    </>
  );
}