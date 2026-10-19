"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TripSummary = {
  id: string;
  tripCode: string;
  name: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  publication: string;
};

const sections = [
  { key: "current", title: "Travelling now", note: "Your active trip." },
  { key: "upcoming", title: "Upcoming", note: "Trips you are booked on." },
  { key: "past", title: "Past", note: "Trips you have completed." },
] as const;

const statusLabel: Record<string, string> = {
  current: "Travelling now",
  upcoming: "Upcoming",
  past: "Completed",
  closed: "Not published",
};

export default function TripList({
  firstName,
  role,
  grouped,
}: {
  firstName: string;
  role: string;
  grouped: Record<string, TripSummary[]>;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const total = Object.values(grouped).reduce((count, list) => count + list.length, 0);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>My trips</h1>
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
            <h2 className="serif">No trips yet</h2>
            <p>
              Once your coordinator adds you to a trip and publishes it, it will appear here with the
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
                      {trip.status === "closed" ? (
                        <p className="muted small">Your coordinator has not published this trip yet.</p>
                      ) : (
                        <div className="trip-card-actions">
                          <Link className="btn btn-primary" href={`/dashboard/trips/${trip.id}`}>
                            View itinerary
                          </Link>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })
        )}

        <div className="account-strip">
          <p>
            Signed in as {firstName}
          </p>
          <button className="link-btn" onClick={signOut} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </div>
    </>
  );
}