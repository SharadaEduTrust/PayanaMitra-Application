"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Unsatisfactory",
  3: "Needs Work",
  4: "Fair",
  5: "Average",
  6: "Decent",
  7: "Good",
  8: "Very Good",
  9: "Excellent",
  10: "Outstanding!",
};

export type FeedbackRecord = {
  id?: string;
  rating: number | null;
  comment: string | null;
  created_at?: string;
};

export default function FeedbackForm({
  tripId,
  initialFeedback,
}: {
  tripId: string;
  initialFeedback?: FeedbackRecord | null;
}) {
  const router = useRouter();

  const [rating, setRating] = useState<number>(initialFeedback?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>(initialFeedback?.comment ?? "");
  const [isEditing, setIsEditing] = useState<boolean>(!initialFeedback?.rating);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackRecord | null>(initialFeedback ?? null);

  const activeRating = hoverRating || rating;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (rating < 1 || rating > 10) {
      setError("Please select a rating from 1 to 10.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => null);
      setSubmitting(false);

      if (!res.ok) {
        setError(json?.error ?? "Failed to save your review.");
        return;
      }

      const savedData = json.data ?? { rating, comment, trip_id: tripId };
      setCurrentFeedback(savedData);
      setIsEditing(false);
      setSuccess("Your review has been successfully recorded!");
      router.refresh();
    } catch {
      setSubmitting(false);
      setError("Network error while submitting your review.");
    }
  }

  return (
    <section
      className="panel"
      style={{
        padding: "28px 24px",
        borderRadius: "8px",
        border: "1px solid var(--line, #e2d9cd)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="pill on" style={{ fontSize: "10px", textTransform: "uppercase" }}>
              Trail Review
            </span>
            <span className="small muted">Guest Experience Rating</span>
          </div>
          <h2 className="serif" style={{ fontSize: "1.45rem", margin: "2px 0 4px", color: "var(--forest, #14352a)" }}>
            Rate Your Trail Experience
          </h2>
          <p className="small muted" style={{ margin: 0 }}>
            Share your rating out of 10 and write comments (optional).
          </p>
        </div>

        {currentFeedback && !isEditing && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setIsEditing(true);
              setSuccess("");
            }}
            style={{ fontSize: "12px", padding: "6px 12px" }}
          >
            ✏️ Edit review
          </button>
        )}
      </div>

      {success && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(20,53,42,0.08)",
            border: "1px solid var(--forest, #14352a)",
            borderRadius: "6px",
            color: "var(--forest, #14352a)",
            fontSize: "13px",
            marginBottom: "18px",
          }}
        >
          <strong>✓ {success}</strong>
        </div>
      )}

      {error && (
        <div className="form-error" style={{ marginBottom: "16px" }} role="alert">
          {error}
        </div>
      )}

      {/* Read-only view when already submitted and not in edit mode */}
      {!isEditing && currentFeedback?.rating ? (
        <div
          style={{
            background: "var(--paper, #fdfbf7)",
            border: "1px solid var(--line, #e2d9cd)",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--soft, #F6E7C8)",
                border: "1px solid var(--line, #e2d9cd)",
                borderRadius: "20px",
                padding: "6px 14px",
                fontWeight: 700,
                fontSize: "15px",
                color: "var(--forest, #14352a)",
              }}
            >
              <span>⭐️</span>
              <span>{currentFeedback.rating} / 10</span>
            </div>
            <span style={{ fontWeight: 600, color: "var(--forest, #14352a)", fontSize: "14px" }}>
              {RATING_LABELS[currentFeedback.rating] ?? ""}
            </span>
          </div>

          <div style={{ marginTop: "12px" }}>
            <span className="small muted" style={{ display: "block", marginBottom: "4px", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.05em" }}>
              Your Comments
            </span>
            {currentFeedback.comment ? (
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", color: "var(--ink, #1e293b)", whiteSpace: "pre-wrap" }}>
                {currentFeedback.comment}
              </p>
            ) : (
              <p className="muted small" style={{ margin: 0, fontStyle: "italic" }}>
                No comments written.
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Interactive Review Form */
        <form onSubmit={handleSubmit}>
          {/* 1 to 10 Scale Selector */}
          <div className="form-field" style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
              <span className="form-label" style={{ fontWeight: 600 }}>
                Rate out of 10 <span className="req">*</span>
              </span>
              {activeRating > 0 && (
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--forest, #14352a)" }}>
                  ⭐️ {activeRating} / 10 &nbsp;•&nbsp; {RATING_LABELS[activeRating]}
                </span>
              )}
            </div>

            <div
              role="radiogroup"
              aria-label="Rating out of 10"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
                gap: "6px",
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                const isSelected = rating === val;
                const isHovered = hoverRating === val;

                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRating(val)}
                    onMouseEnter={() => setHoverRating(val)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`Rate ${val} out of 10`}
                    aria-pressed={isSelected}
                    style={{
                      padding: "12px 0",
                      textAlign: "center",
                      borderRadius: "6px",
                      border: isSelected
                        ? "2px solid var(--forest, #14352a)"
                        : isHovered
                        ? "2px solid #b8a68b"
                        : "1px solid var(--line, #e2d9cd)",
                      background: isSelected
                        ? "var(--forest, #14352a)"
                        : isHovered
                        ? "var(--soft, #F6E7C8)"
                        : "var(--paper, #fdfbf7)",
                      color: isSelected ? "#ffffff" : "var(--ink, #1e293b)",
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: "14px",
                      cursor: "pointer",
                      transition: "all 0.15s ease-in-out",
                    }}
                  >
                    {val}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", color: "var(--muted, #64748b)" }}>
              <span>1 - Poor</span>
              <span>5 - Average</span>
              <span>10 - Outstanding</span>
            </div>
          </div>

          {/* Optional Comments */}
          <label className="form-field" style={{ marginBottom: "20px" }}>
            <span className="form-label" style={{ fontWeight: 600 }}>
              Write comments <span className="small muted" style={{ fontWeight: 400 }}>(optional)</span>
            </span>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What made this trail special? Any thoughts on the itinerary, food, accommodation, leader, or highlights..."
              maxLength={2000}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            {currentFeedback?.rating && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setRating(currentFeedback.rating ?? 0);
                  setComment(currentFeedback.comment ?? "");
                  setIsEditing(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            )}
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : currentFeedback?.rating ? "Update review" : "Submit review"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}