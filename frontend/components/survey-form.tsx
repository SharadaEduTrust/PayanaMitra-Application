"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SurveyForm({
  tripId,
  questions,
}: {
  tripId: string;
  questions: string[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    // One row per question, matching the survey_responses table shape.
    const rows = questions.map((question) => ({
      trip_id: tripId,
      user_id: userId,
      question,
      answer: answers[question]?.trim() || null,
    }));

    const { error: insertError } = await supabase.from("survey_responses").insert(rows);

    setLoading(false);

    if (insertError) {
      setError(
        insertError.message.includes("row-level security")
          ? "You can only respond to surveys for trips you are part of."
          : insertError.message,
      );
      return;
    }

    setSaved(true);
    router.refresh();
  }

  if (saved) {
    return (
      <div className="panel-empty">
        <h2 className="serif">Thank you</h2>
        <p>Your answers have been saved and shared with the coordinator.</p>
        <Link className="btn btn-primary" href="/dashboard">
          Back to my trips
        </Link>
      </div>
    );
  }

  return (
    <section className="panel">
      <form onSubmit={submit}>
        {questions.map((question) => (
          <label className="form-field" key={question}>
            {question}
            <textarea
              rows={3}
              value={answers[question] ?? ""}
              onChange={(event) => setAnswers((current) => ({ ...current, [question]: event.target.value }))}
            />
          </label>
        ))}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Submitting…" : "Submit survey"}
        </button>
      </form>
    </section>
  );
}