"use client";

import { useState } from "react";
import Link from "next/link";
import { calculateFeedbackStatus } from "@/lib/feedback";
import TrailBroadcastModal from "@/components/trail-broadcast-modal";
import { openExternalUrl } from "@/lib/utils";

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

export type TrailGuestView = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  foodPreference: string | null;
  foodAllergy: string | null;
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
  trailGuests = [],
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
  trailGuests?: TrailGuestView[];
  canContribute: boolean;
  userRole?: string;
  isLeader?: boolean;
}) {
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [isGuestsCollapsed, setIsGuestsCollapsed] = useState(false);

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
          <Link
            href={`/dashboard/trips/${trip.id}/feedback`}
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "12px" }}
          >
            <span>⭐</span>
            <span>{isLeader ? "Feedback & Reviews" : "Feedback"}</span>
          </Link>
          {isLeader && (
            <Link
              href={`/dashboard/guests?trip_id=${trip.id}`}
              className="btn btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", fontSize: "12px" }}
            >
              <span>👥</span>
              <span>View Guests</span>
            </Link>
          )}
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
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <Link
              href={`/dashboard/trips/${trip.id}/feedback`}
              className="btn btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
            >
              <span>⭐</span>
              <span>Feedback & Reviews</span>
            </Link>
            <Link
              href={`/dashboard/guests?trip_id=${trip.id}`}
              className="btn btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
            >
              <span>👥</span>
              <span>View Trail Guests</span>
            </Link>
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
                onClick={(e) => openExternalUrl(feedbackStatus.formUrl!, e)}
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

      {trip.remarks && (
        <section className="panel" style={{ marginBottom: "20px" }}>
          <h2 className="serif">Trail notes</h2>
          <p>{trip.remarks}</p>
        </section>
      )}

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

      {isLeader && trailGuests && trailGuests.length > 0 && (
        <section className="panel" style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isGuestsCollapsed ? 0 : "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div className="eyebrow">Trail Lead Directory</div>
              <h2 className="serif" style={{ margin: "2px 0 0" }}>
                Booked Trail Guests & Emergency Contacts ({trailGuests.length})
              </h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsGuestsCollapsed((prev) => !prev)}
                style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                aria-expanded={!isGuestsCollapsed}
              >
                <span>{isGuestsCollapsed ? "Expand" : "Collapse"}</span>
                <span style={{ fontSize: "10px" }}>{isGuestsCollapsed ? "▼" : "▲"}</span>
              </button>
              <Link
                href={`/dashboard/guests?trip_id=${trip.id}`}
                className="btn btn-secondary"
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                Full Guest Manager →
              </Link>
            </div>
          </div>

          {!isGuestsCollapsed && (
            <div style={{ display: "grid", gap: "12px" }}>
              {trailGuests.map((guest) => (
                <div
                  key={guest.id}
                  style={{
                    padding: "14px 18px",
                    borderRadius: "8px",
                    background: "var(--paper, #fdfbf7)",
                    border: "1px solid var(--line, #e2d9cd)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "14px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1.05rem", color: "var(--forest, #1e3a2b)" }}>{guest.name}</strong>
                      {guest.foodPreference && (
                        <span className="pill on" style={{ fontSize: "10px", padding: "1px 6px" }}>
                          {guest.foodPreference === "veg" ? "Veg" : guest.foodPreference === "non_veg" ? "Non-Veg" : guest.foodPreference}
                        </span>
                      )}
                      {guest.foodAllergy && (
                        <span className="pill" style={{ fontSize: "10px", padding: "1px 6px", background: "#fef3c7", color: "#92400e" }}>
                          ⚠️ {guest.foodAllergy}
                        </span>
                      )}
                    </div>
                    <div className="muted small" style={{ marginTop: "4px" }}>
                      <a className="contact-phone mono" href={`tel:${guest.phone}`} style={{ textDecoration: "none", fontWeight: 600 }}>
                        📞 {guest.phone}
                      </a>
                      {guest.email && (
                        <span style={{ marginLeft: "12px" }}>
                          <a href={`mailto:${guest.email}`} style={{ color: "inherit" }}>
                            ✉️ {guest.email}
                          </a>
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ minWidth: "200px" }}>
                    <span className="eyebrow" style={{ fontSize: "10px", display: "block", marginBottom: "2px" }}>Emergency Contact</span>
                    {guest.emergencyName ? (
                      <div>
                        <strong>{guest.emergencyName}</strong>
                        {guest.emergencyPhone && (
                          <div>
                            <a className="contact-phone mono small" href={`tel:${guest.emergencyPhone}`}>
                              📞 {guest.emergencyPhone}
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="muted small">Not provided</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="panel" style={{ marginTop: "24px" }}>
        <h2 className="serif">Contact details</h2>
        {contacts.length === 0 ? (
          <p className="panel-note">Guide, hotel, leader and transport contacts will appear here.</p>
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

      {(isLeader || userRole === "admin") && (
        <div className="trip-footer-actions">
          {isLeader && (
            <Link className="btn btn-secondary" href={`/dashboard/guests?trip_id=${trip.id}`}>
              View Trail Guests
            </Link>
          )}
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