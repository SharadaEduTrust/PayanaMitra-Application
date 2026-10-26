import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import SurveyForm from "@/components/survey-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function SurveyPage({ params }: Params) {
  const { id } = await params;
  const profile = await requireProfile();
  if (profile.role !== "traveller") {
    redirect(`/dashboard/trips/${id}`);
  }
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("trip_members")
    .select("id")
    .eq("trip_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!member) redirect("/dashboard");

  const { data: tripData } = await admin
    .from("trips")
    .select("id, name, remarks")
    .eq("id", id)
    .maybeSingle();

  if (!tripData) redirect("/dashboard");

  // The schema stores questions as rows, so the admin-defined question set
  // lives in survey_responses seeded by the coordinator. Reuse the trip's
  // remarks to carry the intro, and ask the standard closing questions.
  const questions = [
    "What did you enjoy most about this trail?",
    "What would you change for next time?",
    "Which destination would you like next?",
  ];

  return (
    <div className="trip-detail">
      <Link className="back-link" href={`/dashboard/trips/${id}`}>
        ← Back to itinerary
      </Link>
      <header className="page-head">
        <div>
          <div className="eyebrow">End of tour</div>
          <h1 className="serif">Tell us about {tripData.name}</h1>
          <p>{tripData.remarks ?? "A few questions before you go."}</p>
        </div>
      </header>
      <SurveyForm tripId={id} questions={questions} />
    </div>
  );
}