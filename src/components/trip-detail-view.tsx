"use client";

import Link from "next/link";

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

export type AnnouncementView = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  is_read: boolean;
};

export default function TripDetailView({
  trip,
  days,
  contacts,
  canContribute,
  userRole,
  announcements = [],
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
  };
  days: DayView[];
  contacts: ContactView[];
  canContribute: boolean;
  userRole?: string;
  announcements?: AnnouncementView[];
}) {
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
        <span className={`pill ${trip.status === "published" ? "upcoming" : "past"}`}>{trip.status}</span>
      </header>

      {announcements && announcements.length > 0 && (
        <section
          style={{
            margin: "16px 0",
            padding: "16px 20px",
            background: "linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)",
            border: "1px solid #fde68a",
            borderRadius: "10px",
            boxShadow: "0 2px 6px rgba(245, 158, 11, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
              📢 Trail Announcements ({announcements.length})
            </span>
            <Link href="/dashboard/notifications" style={{ fontSize: "12px", color: "#b45309", fontWeight: 600 }}>
              All notifications →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {announcements.map((a) => (
              <div
                key={a.id}
                style={{
                  background: "#ffffff",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: a.is_read ? "1px solid #e2e8f0" : "1.5px solid #f59e0b",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "15px" }}>{a.title}</div>
                  {!a.is_read && (
                    <span style={{ background: "#dc2626", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "8px", textTransform: "uppercase" }}>
                      New
                    </span>
                  )}
                </div>
                {a.body && <div style={{ color: "#475569", fontSize: "13.5px", marginTop: "4px", lineHeight: "1.5" }}>{a.body}</div>}
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                  {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </section>
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

      <div className="trip-footer-actions">
        {userRole === "traveller" && (
          <>
            <Link className="btn btn-secondary" href={`/dashboard/trips/${trip.id}/feedback`}>
              Leave feedback
            </Link>
            <Link className="btn btn-secondary" href={`/dashboard/trips/${trip.id}/survey`}>
              Trail survey
            </Link>
          </>
        )}
        {canContribute && (
          <Link className="btn btn-secondary" href={`/admin/trips/${trip.id}`}>
            Edit in admin
          </Link>
        )}
      </div>
    </div>
  );
}