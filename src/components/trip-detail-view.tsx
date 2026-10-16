"use client";

import Link from "next/link";

export type DayView = {
  id: string;
  dayNumber: number;
  destination: string | null;
  itineraryText: string | null;
  hotelName: string | null;
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
}) {
  return (
    <div className="trip-detail">
      <Link className="back-link" href="/dashboard">
        ← All trips
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

      {trip.status !== "published" && (
        <p className="form-note">
          This trip is still a draft. Your coordinator will publish it when the itinerary is final.
        </p>
      )}

      <div className="trip-columns">
        <section className="panel">
          <h2 className="serif">Trip notes</h2>
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
                    {day.hotelName && <p className="muted small">Stay: {day.hotelName}</p>}
                  </div>
                </div>

                {day.itineraryText && <p className="day-summary">{day.itineraryText}</p>}

                {day.activities.length > 0 && (
                  <ol className="timings">
                    {day.activities.map((activity) => (
                      <li key={activity.id}>
                        <span className="timing-time">
                          {activity.startTime ? activity.startTime.slice(0, 5) : "—"}
                        </span>
                        <div className="timing-body">
                          <strong>{activity.title}</strong>
                          {activity.description && <p>{activity.description}</p>}
                          {activity.endTime && (
                            <span className="timing-meta">
                              until {activity.endTime.slice(0, 5)}
                            </span>
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
        <Link className="btn btn-secondary" href={`/dashboard/trips/${trip.id}/feedback`}>
          Leave feedback
        </Link>
        <Link className="btn btn-secondary" href={`/dashboard/trips/${trip.id}/survey`}>
          Trip survey
        </Link>
        {canContribute && (
          <Link className="btn btn-secondary" href={`/admin/trips/${trip.id}`}>
            Edit in admin
          </Link>
        )}
      </div>
    </div>
  );
}