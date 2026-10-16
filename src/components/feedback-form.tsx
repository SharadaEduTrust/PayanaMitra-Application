"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FeedbackForm({
  tripId,
  alreadySubmitted,
}: {
  tripId: string;
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (rating < 1 || rating > 5) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // RLS allows an insert only when user_id is the caller's own id and they
    // are a member of the trip.
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { error: insertError } = await supabase.from("feedback").insert({
      trip_id: tripId,
      user_id: userId,
      rating,
      comment: comment || null,
    });

    setLoading(false);

    if (insertError) {
      setError(
        insertError.message.includes("row-level security")
          ? "You can only leave feedback for trips you are part of."
          : insertError.message,
      );
      return;
    }

    setSaved(true);
    router.refresh();
  }

  if (alreadySubmitted || saved) {
    return (
      <div className="panel-empty">
        <h2 className="serif">Thank you</h2>
        <p>Your feedback for this trip has been recorded.</p>
        <Link className="btn btn-primary" href={`/dashboard/trips/${tripId}`}>
          Back to itinerary
        </Link>
      </div>
    );
  }

  return (
    <section className="panel">
      <form onSubmit={submit}>
        <div className="form-field">
          <span className="form-label">Overall rating</span>
          <div className="rating" role="radiogroup" aria-label="Rating out of five">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                type="button"
                key={value}
                className={value <= rating ? "on" : undefined}
                onClick={() => setRating(value)}
                aria-label={`${value} star${value > 1 ? "s" : ""}`}
                aria-pressed={value === rating}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <label className="form-field">
          Comments
          <textarea
            rows={5}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="The stay, food, transport, guide — what stood out?"
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Sending…" : "Submit feedback"}
        </button>
      </form>
    </section>
  );
}