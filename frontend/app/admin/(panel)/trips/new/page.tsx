import Link from "next/link";
import NewTripForm from "@/components/new-trip-form";

export default function NewTripPage() {
  return (
    <div className="admin-body">
      <Link className="back-link" href="/admin/trips">
        ← All trips
      </Link>
      <NewTripForm />
    </div>
  );
}