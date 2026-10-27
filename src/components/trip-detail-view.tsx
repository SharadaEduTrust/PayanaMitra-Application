"use client";

import { useState } from "react";
import Link from "next/link";
import { calculateFeedbackStatus } from "@/lib/feedback";
import TrailBroadcastModal from "@/components/trail-broadcast-modal";

export type DayView = {
  id: string;
  dayNumber: number;
  destination: string | null;
  itineraryText: string | null;
  hotelName: string | null;
  mealPlan?: string | null;
  activities: {
    id: string;
    title: string;
    description: string | null;
    startTime: string | null;
    endTime: string | null;
    order: number | null;
  }[];
};

export type ContactView = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

function dateRange(start: string | null, end: string | null) {
  if (!start) return "Dates to be decided";
  const format = (value: string) =>
    new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return end ? `${format(start)} – ${format(end)}` : `From ${format(start)}`;
}

export default function TripDetailView({
  trip,
  days,
  contacts,
  canContribute,
  userRole,
  isLeader = false,
}: {
  trip: {
    id: string;
    tripCode: string;
    name: string;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
    status: "draft" | "published" | "archived";
    remarks: string | null;
    feedbackFormUrl?: string | null;
    feedbackWindowDays?: number | null;
  };
  days: DayView[];
  contacts: ContactView[];
  canContribute: boolean;
  userRole?: string;
  isLeader?: boolean;
}) {
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  const feedbackStatus = calculateFeedbackStatus({
    start_date: trip.startDate,
    end_date: trip.endDate,
    feedback_form_url: trip.feedbackFormUrl,
    feedback_window_days: trip.feedbackWindowDays,
    remarks: trip.remarks,
  });

  return (
    <div className="trip-detail">
      <Link className="back-link" href="/dashboard">
        ← All trails
      </Link>

      <header className="page-head">
        <div>
          <div className="eyebrow">{trip.destination ?? "Your itinerary"}</div>
          <h1 className="serif">{trip.name}</h1>
          <p className="trip-code mono">{trip.tripCode}</p>
          <p>{dateRange(trip.startDate, trip.endDate)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className={`pill ${trip.status === "published" ? "upcoming" : "past"}`}>{trip.status}</span>
          {isLeader && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowBroadcastModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "12px" }}
            >
              <span>📢</span>
              <span>Send Notification</span>
            </button>
          )}
        </div>
      </header>

      {isLeader && (
        <section
          style={{
            marginBottom: "20px",
            padding: "16px 20px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(20,53,42,0.06), rgba(246,231,200,0.4))",
            border: "1px solid var(--forest, #14352a)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ flex: 1, minWidth: "260px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="pill on" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Trail Lead Tools
              </span>
              <span className="small muted">Announcements & Alerts</span>
            </div>
            <h3 className="serif" style={{ margin: "2px 0 4px", fontSize: "1.15rem", color: "var(--forest, #14352a)" }}>
              Broadcast to Trail Guests
            </h3>
            <p className="small muted" style={{ margin: 0, lineHeight: "1.5" }}>
              Send schedule updates, weather warnings, or departure reminders directly to all guests booked on this trail via in-app alert and push notification.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowBroadcastModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}
            >
              <span>📢</span>
              <span>Send Notification</span>
            </button>
          </div>
        </section>
      )}

      {feedbackStatus.configured && feedbackStatus.state === "open" && (
        <section className="feedback-banner-card" style={{ marginBottom: "20px", padding: "18px 22px", borderRadius: "8px", background: "linear-gradient(135deg, rgba(20,53,42,0.12), rgba(246,231,200,0.35))", border: "1px solid var(--forest, #14352a)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
            <div style={{ flex: 1, minWidth: "260px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span className="pill on" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Feedback Open</span>
                <span className="small muted">
                  {feedbackStatus.daysRemaining === 0 ? "Closes tonight at 23:59" : `${feedbackStatus.daysRemaining} days remaining (until ${feedbackStatus.closesOnDate})`}
                </span>
              </div>
              <h2 className="serif" style={{ margin: "0 0 6px", fontSize: "1.25rem", color: "var(--forest, #14352a)" }}>
                How was your trail experience?
              </h2>
              <p className="small muted" style={{ margin: 0 }}>
                This trail has completed! Please share your thoughts in our official Google Form before submissions close on <strong>{feedbackStatus.closesOnDate}</strong>.
              </p>
            </div>
            <div>
              <a
                href={feedbackStatus.formUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", whiteSpace: "nowrap" }}
              >
                <span>Fill Google Form</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </section>
      )}

      {feedbackStatus.configured && feedbackStatus.state === "closed" && (
        <div style={{ marginBottom: "20px", padding: "12px 18px", borderRadius: "8px", background: "var(--paper, #fdfbf7)", border: "1px solid var(--line, #e2d9cd)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className="pill past" style={{ fontSize: "10px" }}>Feedback Closed</span>
          <span className="small muted">
            The feedback window for {trip.name} closed on {feedbackStatus.closesOnDate}. Thank you for traveling with us!
          </span>
        </div>
      )}

      {trip.status !== "published" && (
        <p className="form-note">
          This trail is still a draft. Your coordinator will publish it when the itinerary is final.
        </p>
      )}

      <div className="trip-columns">
        <section className="panel">
          <h2 className="serif">Trail notes</h2>
          {trip.remarks ? <p>{trip.remarks}</p> : <p className="panel-note">No notes from your coordinator yet.</p>}
        </section>

        <section className="panel">
          <h2 className="serif">Contacts</h2>
          {contacts.length === 0 ? (
            <p className="panel-note">Guide, hotel and transport contacts will appear here.</p>
          ) : (
            <div className="contact-list">
              {contacts.map((contact) => (
                <div key={contact.id}>
                  <span className="contact-label">{contact.role ?? "Contact"}</span>
                  <span className="contact-name">{contact.name}</span>
                  {contact.phone && (
                    <a className="contact-phone" href={`tel:${contact.phone}`}>
                      {contact.phone}
                    </a>
                  )}
                  {contact.email && <a className="contact-phone" href={`mailto:${contact.email}`}>{contact.email}</a>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <h2 className="serif">Day-wise itinerary</h2>
        {days.length === 0 ? (
          <p className="panel-note">The itinerary has not been added yet.</p>
        ) : (
          <div className="days">
            {days.map((day) => (
              <article className="day" key={day.id}>
                <div className="day-head">
                  <span className="day-number">Day {day.dayNumber}</span>
                  <div>
                    <h3>{day.destination ?? `Day ${day.dayNumber}`}</h3>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                      {day.hotelName && <p className="muted small" style={{ margin: 0 }}>Stay: {day.hotelName}</p>}
                      {day.mealPlan && <p className="muted small" style={{ margin: 0 }}>Meals: {day.mealPlan}</p>}
                    </div>
                  </div>
                </div>

                {day.itineraryText && <p className="day-summary">{day.itineraryText}</p>}

                {day.activities.length > 0 && (
                  <ol className="timings">
                    {day.activities.map((activity) => (
                      <li key={activity.id}>
                        <span className="timing-time">
                          {activity.startTime ? activity.startTime.slice(0, 5) : "—"}
                          {activity.endTime && (
                            <span className="timing-meta" style={{ display: "block", marginTop: "2px" }}>
                              to {activity.endTime.slice(0, 5)}
                            </span>
                          )}
                        </span>
                        <div className="timing-body">
                          <strong>{activity.description || activity.title}</strong>
                          {activity.description && activity.title && activity.description !== activity.title && (
                            <p>{activity.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {(isLeader || userRole === "admin") && (
        <div className="trip-footer-actions">
          {isLeader && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowBroadcastModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span>📢</span>
              <span>Send Trail Notification</span>
            </button>
          )}
          {userRole === "admin" && (
            <Link className="btn btn-secondary" href={`/admin/trips/${trip.id}`}>
              Edit in admin
            </Link>
          )}
        </div>
      )}

      {isLeader && (
        <TrailBroadcastModal
          trip={trip}
          isOpen={showBroadcastModal}
          onClose={() => setShowBroadcastModal(false)}
        />
      )}
    </div>
  );
}