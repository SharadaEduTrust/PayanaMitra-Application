import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import SurveyForm from "@/components/survey-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function SurveyPage({ params }: Params) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const { data: tripData } = await supabase
    .from("trips")
    .select("id, name, remarks")
    .eq("id", id)
    .maybeSingle();

  if (!tripData) redirect("/dashboard");

  // The schema stores questions as rows, so the admin-defined question set
  // lives in survey_responses seeded by the coordinator. Reuse the trip's
  // remarks to carry the intro, and ask the standard closing questions.
  const questions = [
    "What did you enjoy most about this trip?",
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