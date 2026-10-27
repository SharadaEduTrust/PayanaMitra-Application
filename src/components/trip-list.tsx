"use client";

import Link from "next/link";

export type TripSummary = {
  id: string;
  tripCode: string;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  publication: string;
  feedbackState?: "not_configured" | "upcoming" | "open" | "closed";
  feedbackClosesOn?: string | null;
  feedbackDaysRemaining?: number;
  feedbackFormUrl?: string | null;
};

const sections = [
  { key: "current", title: "On trail now", note: "Your active trail." },
  { key: "upcoming", title: "Upcoming", note: "Trails you are booked on." },
  { key: "past", title: "Past", note: "Trails you have completed." },
] as const;

const statusLabel: Record<string, string> = {
  current: "On trail now",
  upcoming: "Upcoming",
  past: "Completed",
  closed: "Not published",
};

export default function TripList({
  firstName: _firstName,
  role,
  grouped,
}: {
  firstName?: string;
  role: string;
  grouped: Record<string, TripSummary[]>;
}) {
  const total = Object.values(grouped).reduce((count, list) => count + list.length, 0);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>My trails</h1>
          <small>Everything you are booked on.</small>
        </div>
        <div className="topbar-actions">
          {role === "admin" && (
            <Link className="btn btn-secondary" href="/admin">Admin panel</Link>
          )}
          <Link className="btn btn-secondary" href="/dashboard/profile">My profile</Link>
        </div>
      </header>

      <div className="trips-page">
        {total === 0 ? (
          <div className="panel-empty">
            <img src="/illustrations/empty-state.webp" alt="" />
            <h2 className="serif">No trails yet</h2>
            <p>
              Once your coordinator adds you to a trail and publishes it, it will appear here with the
              full day-by-day itinerary.
            </p>
          </div>
        ) : (
          sections.map((section) => {
            const list = grouped[section.key] ?? [];
            if (list.length === 0) return null;
            return (
              <section className="trip-section" key={section.key}>
                <div className="trip-section-head">
                  <h2 className="serif">{section.title}</h2>
                  <p>{section.note}</p>
                </div>
                <div className="trip-grid">
                  {list.map((trip) => (
                    <article className={`trip-card ${trip.status}`} key={trip.id}>
                      <div className="trip-card-top">
                        <span className={`pill ${trip.status}`}>{statusLabel[trip.status]}</span>
                        <span className="trip-code mono">{trip.tripCode}</span>
                      </div>
                      <h3 className="serif">{trip.name}</h3>
                      {trip.destination && <p className="trip-destination">{trip.destination}</p>}
                      <p className="trip-summary">
                        {trip.startDate
                          ? `${new Date(trip.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                          : "Dates to be decided"}
                        {trip.endDate &&
                          ` – ${new Date(trip.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                      </p>
                      {/* Time left for feedback after completion of trail */}
                      {trip.status === "past" && (
                        trip.feedbackState === "open" ? (
                          <div
                            style={{
                              margin: "10px 0 12px",
                              padding: "7px 11px",
                              borderRadius: "6px",
                              background: "rgba(20,53,42,0.06)",
                              border: "1px solid var(--forest, #14352a)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "11px",
                            }}
                          >
                            <span style={{ color: "var(--forest, #14352a)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <span>⏱️</span>
                              <span>
                                {(trip.feedbackDaysRemaining ?? 0) === 0
                                  ? "Feedback closes tonight (23:59 IST)"
                                  : `${trip.feedbackDaysRemaining ?? 0} day${(trip.feedbackDaysRemaining ?? 0) > 1 ? "s" : ""} left for feedback`}
                              </span>
                            </span>
                            {trip.feedbackClosesOn && (
                              <span className="muted" style={{ fontSize: "10px" }}>
                                until {trip.feedbackClosesOn}
                              </span>
                            )}
                          </div>
                        ) : trip.feedbackState === "closed" ? (
                          <div
                            style={{
                              margin: "10px 0 12px",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              background: "var(--paper, #fdfbf7)",
                              border: "1px solid var(--line, #e2d9cd)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "11px",
                              color: "var(--muted, #64748b)",
                            }}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <span>🔒</span>
                              <span>Feedback window closed {trip.feedbackClosesOn ? `on ${trip.feedbackClosesOn}` : ""}</span>
                            </span>
                            <span style={{ fontStyle: "italic", fontSize: "10px" }}>Review available</span>
                          </div>
                        ) : null
                      )}

                      {trip.status === "closed" ? (
                        <p className="muted small">Your coordinator has not published this trail yet.</p>
                      ) : (
                        <div className="trip-card-actions">
                          <Link className="btn btn-primary" href={`/dashboard/trips/${trip.id}`}>
                            View itinerary
                          </Link>
                          {(role === "traveller" || role === "leader" || !role) &&
                            (trip.status === "past" || trip.feedbackState === "open") && (
                              <Link
                                className="btn btn-secondary trip-card-feedback-btn"
                                href={`/dashboard/trips/${trip.id}/feedback`}
                              >
                                Feedback
                              </Link>
                            )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}