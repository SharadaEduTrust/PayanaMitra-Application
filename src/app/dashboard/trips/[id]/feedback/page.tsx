import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import FeedbackForm from "@/components/feedback-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function FeedbackPage({ params }: Params) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: tripData } = await supabase
    .from("trips")
    .select("id, name, trip_code")
    .eq("id", id)
    .maybeSingle();

  if (!tripData) redirect("/dashboard");

  const { data: mine } = await supabase
    .from("feedback")
    .select("id")
    .eq("trip_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();

  return (
    <div className="trip-detail">
      <Link className="back-link" href={`/dashboard/trips/${id}`}>
        ← Back to itinerary
      </Link>
      <header className="page-head">
        <div>
          <div className="eyebrow">Feedback</div>
          <h1 className="serif">How was {tripData.name}?</h1>
          <p>Your rating and comments help the coordinator improve future trips.</p>
        </div>
      </header>
      <FeedbackForm tripId={id} alreadySubmitted={Boolean(mine)} />
    </div>
  );
}