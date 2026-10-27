import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import FeedbackForm, { type FeedbackRecord } from "@/components/feedback-form";
import GoogleFormFeedbackView from "@/components/google-form-feedback";
import { calculateFeedbackStatus } from "@/lib/feedback";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function FeedbackPage({ params }: Params) {
  const { id } = await params;
  const profile = await requireProfile();
  const admin = createAdminClient();

  const { data: tripData } = await admin
    .from("trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!tripData) redirect("/dashboard");

  const isLeader = tripData.leader_id === profile.id;

  const { data: member } = await admin
    .from("trip_members")
    .select("id")
    .eq("trip_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!member && !isLeader && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const feedbackStatus = calculateFeedbackStatus(tripData);

  // Fetch current user's existing review (if already recorded)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingFeedback } = await (admin.from("feedback") as any)
    .select("id, rating, comment, created_at")
    .eq("trip_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();

  // If leader or admin, fetch guest reviews submitted for this trail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let guestReviews: any[] = [];
  if (isLeader || profile.role === "admin") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: reviews } = await (admin.from("feedback") as any)
      .select(`
        id,
        rating,
        comment,
        created_at,
        profiles (
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .eq("trip_id", id)
      .neq("user_id", profile.id)
      .order("created_at", { ascending: false });
    guestReviews = reviews ?? [];
  }

  return (
    <div className="trip-detail">
      <Link className="back-link" href={`/dashboard/trips/${id}`}>
        ← Back to itinerary
      </Link>

      <header className="page-head" style={{ marginBottom: "24px" }}>
        <div>
          <div className="eyebrow">
            {isLeader ? "Trail Leader Experience" : "Guest Experience"}
          </div>
          <h1 className="serif">Feedback & Reviews</h1>
          <p className="small muted">
            {tripData.name} {tripData.destination ? `• ${tripData.destination}` : ""}
          </p>
        </div>
      </header>

      {/* 1. Google Form Feedback */}
      <GoogleFormFeedbackView
        trip={{
          id: tripData.id,
          name: tripData.name,
          tripCode: tripData.trip_code,
          destination: tripData.destination,
        }}
        feedbackStatus={feedbackStatus}
      />

      {/* 2. Review Section: Rate out of 10 and write comments (optional) */}
      <FeedbackForm
        tripId={id}
        initialFeedback={existingFeedback as FeedbackRecord | null}
      />

      {/* 3. For Trail Leaders: Guest Reviews Submitted on this Trail */}
      {(isLeader || profile.role === "admin") && (
        <section
          style={{
            marginTop: "32px",
            background: "#ffffff",
            border: "1px solid #e2d9cd",
            borderRadius: "8px",
            padding: "24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 className="serif" style={{ margin: "0 0 4px", fontSize: "1.25rem", color: "#1e293b" }}>
                Guest Reviews on this Trail
              </h2>
              <p className="small muted" style={{ margin: 0 }}>
                {guestReviews.length} {guestReviews.length === 1 ? "review" : "reviews"} received from enrolled travellers.
              </p>
            </div>
            <Link className="btn btn-secondary" href="/dashboard/feedback" style={{ fontSize: "13px" }}>
              View All Trail Feedback →
            </Link>
          </div>

          {guestReviews.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#64748b", background: "#fdfbf7", borderRadius: "6px", fontSize: "13px" }}>
              No guest reviews have been submitted for this trail yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {guestReviews.map((rev: any) => {
                const guestName = rev.profiles
                  ? `${rev.profiles.first_name} ${rev.profiles.last_name}`
                  : "Guest";
                return (
                  <div
                    key={rev.id}
                    style={{
                      padding: "14px 18px",
                      borderRadius: "6px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>{guestName}</strong>
                        {rev.profiles?.phone && (
                          <span style={{ fontSize: "12px", color: "#64748b" }}>{rev.profiles.phone}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "14px",
                            backgroundColor: rev.rating >= 8 ? "rgba(42, 75, 40, 0.12)" : "rgba(217, 119, 6, 0.12)",
                            color: rev.rating >= 8 ? "#2a4b28" : "#b45309",
                            fontWeight: "700",
                            fontSize: "13px",
                          }}
                        >
                          ⭐ {rev.rating}/10
                        </span>
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                          {new Date(rev.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    {rev.comment ? (
                      <p style={{ margin: 0, fontSize: "13px", color: "#334155", fontStyle: "italic", lineHeight: 1.5 }}>
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                        No written comments provided.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}