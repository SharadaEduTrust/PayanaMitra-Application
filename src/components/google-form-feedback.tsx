"use client";

import { useState } from "react";
import type { FeedbackStatus } from "@/lib/feedback";

export default function GoogleFormFeedbackView({
  trip,
  feedbackStatus,
}: {
  trip: {
    id: string;
    name: string;
    tripCode: string;
    destination?: string | null;
  };
  feedbackStatus: FeedbackStatus;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!feedbackStatus.formUrl) return;
    navigator.clipboard.writeText(feedbackStatus.formUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  // 1. If no Google Form link has been set yet by the coordinator
  if (!feedbackStatus.formUrl || feedbackStatus.state === "not_configured") {
    return (
      <section
        className="panel"
        style={{
          marginBottom: "28px",
          padding: "24px",
          background: "linear-gradient(135deg, rgba(20,53,42,0.03), rgba(246,231,200,0.35))",
          border: "1px solid var(--line, #e2d9cd)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "var(--soft, #F6E7C8)",
              color: "var(--forest, #14352a)",
              display: "grid",
              placeItems: "center",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            📋
          </div>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="pill on" style={{ fontSize: "10px", textTransform: "uppercase" }}>
                Google Form
              </span>
              <span className="small muted">Post-Trail Questionnaire</span>
            </div>
            <h3 className="serif" style={{ margin: "2px 0 6px", fontSize: "1.25rem", color: "var(--forest, #14352a)" }}>
              Official Google Feedback Form
            </h3>
            <p className="small muted" style={{ margin: "0 0 10px", lineHeight: "1.5" }}>
              Our team captures comprehensive feedback regarding accommodation, meals, itinerary pacing, transportation, and trail leadership through an official Google Form questionnaire.
            </p>
            <div style={{ padding: "10px 14px", borderRadius: "6px", background: "var(--paper, #fdfbf7)", border: "1px solid var(--line, #e2d9cd)", display: "inline-block" }}>
              <span className="small muted" style={{ fontSize: "12px" }}>
                ℹ️ The Google Form link will be linked by your trail coordinator. You can also rate and review this trail below.
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // 2. Trail has not finished yet (upcoming)
  if (feedbackStatus.state === "upcoming") {
    return (
      <section
        className="panel"
        style={{
          marginBottom: "28px",
          padding: "26px 24px",
          background: "linear-gradient(135deg, rgba(246,231,200,0.45), rgba(253,251,247,0.9))",
          border: "1px solid var(--line, #e2d9cd)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "var(--soft, #F6E7C8)",
              color: "var(--forest, #14352a)",
              display: "grid",
              placeItems: "center",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            ⏳
          </div>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="pill upcoming" style={{ fontSize: "10px", textTransform: "uppercase" }}>
                Google Form Feedback
              </span>
              <span className="small muted">Opens Post-Trail</span>
            </div>
            <h3 className="serif" style={{ margin: "2px 0 6px", fontSize: "1.25rem", color: "var(--forest, #14352a)" }}>
              Google Feedback Form
            </h3>
            <p className="small muted" style={{ margin: 0, lineHeight: "1.5" }}>
              The comprehensive Google feedback form for <strong>{trip.name}</strong> will activate once the trail concludes on{" "}
              <strong>{feedbackStatus.opensOnDate}</strong>. Submissions will be accepted for {feedbackStatus.windowDays} days.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // 3. Feedback window has closed
  if (feedbackStatus.state === "closed") {
    return (
      <section
        className="panel"
        style={{
          marginBottom: "28px",
          padding: "24px",
          background: "var(--paper, #fdfbf7)",
          border: "1px solid var(--line, #e2d9cd)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#EFE9DD",
              color: "var(--muted, #64748b)",
              display: "grid",
              placeItems: "center",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            🔒
          </div>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="pill past" style={{ fontSize: "10px", textTransform: "uppercase" }}>
                Google Form Feedback
              </span>
              <span className="small muted">Closed</span>
            </div>
            <h3 className="serif" style={{ margin: "2px 0 6px", fontSize: "1.2rem", color: "var(--forest, #14352a)" }}>
              Google Feedback Form Closed
            </h3>
            <p className="small muted" style={{ margin: 0, lineHeight: "1.5" }}>
              The post-trail submission window for this Google Form closed on <strong>{feedbackStatus.closesOnDate}</strong>. Submissions are no longer accepted because the feedback period has ended.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // 4. Feedback window is active and open!
  return (
    <section
      className="panel"
      style={{
        marginBottom: "28px",
        padding: "26px 24px",
        border: "1px solid var(--forest, #14352a)",
        background: "linear-gradient(135deg, rgba(20,53,42,0.04), rgba(246,231,200,0.4))",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px", marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="pill on" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Active Form
            </span>
            <span className="small muted">Official Survey</span>
          </div>
          <h2 className="serif" style={{ fontSize: "1.4rem", margin: "4px 0 6px", color: "var(--forest, #14352a)" }}>
            Google Feedback Form
          </h2>
          <p className="small muted" style={{ margin: 0 }}>
            {trip.destination ? `${trip.destination} • ` : ""}Fill out the official post-trail survey.
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ background: "var(--soft, #F6E7C8)", border: "1px solid var(--line, #e2d9cd)", borderRadius: "8px", padding: "6px 12px", display: "inline-block" }}>
            <span style={{ display: "block", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted, #64748b)" }}>
              Time Remaining
            </span>
            <strong style={{ fontSize: "13px", color: "var(--forest, #14352a)" }}>
              {feedbackStatus.daysRemaining === 0
                ? "Closes tonight (23:59 IST)"
                : `${feedbackStatus.daysRemaining} Day${feedbackStatus.daysRemaining > 1 ? "s" : ""} Left`}
            </strong>
          </div>
          <span className="small muted" style={{ display: "block", marginTop: "4px", fontSize: "11px" }}>
            Closes {feedbackStatus.closesOnDate}
          </span>
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid var(--line, #e2d9cd)", borderRadius: "8px", padding: "18px 20px", marginBottom: "14px" }}>
        <p style={{ margin: "0 0 14px", lineHeight: "1.5", fontSize: "14px", color: "var(--ink, #1e293b)" }}>
          Your detailed feedback on accommodation, food, transportation, guides, and activities helps us refine future expeditions.
        </p>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <a
            href={feedbackStatus.formUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: "10px 20px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }}
          >
            <span>Open Google Feedback Form</span>
            <span>↗</span>
          </a>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={copyLink}
            style={{ padding: "10px 16px", fontSize: "13px" }}
          >
            {copied ? "✓ Link Copied!" : "Copy Form Link"}
          </button>
        </div>
      </div>

      <span className="small muted" style={{ fontSize: "12px", display: "block" }}>
        ℹ️ Responses submitted in the Google Form are securely recorded in the official survey sheet.
      </span>
    </section>
  );
}
