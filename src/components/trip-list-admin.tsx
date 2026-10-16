"use client";

import Link from "next/link";
import type { TrailLeaderView } from "@/lib/types";

const statusPill: Record<string, string> = {
  draft: "off",
  published: "on",
  archived: "off",
};

export default function TripListAdmin({ trips }: { trips: TrailLeaderView[] }) {
  if (trips.length === 0) {
    return (
      <div className="panel-empty">
        <h2 className="serif">No trips yet</h2>
        <p>Create your first trip, add days and activities, then publish it to your members.</p>
        <Link className="btn btn-primary" href="/admin/trips/new">
          Create a trip
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-card">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Trip</th>
            <th>Dates</th>
            <th>Leader</th>
            <th>Status</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr key={trip.trip_id}>
              <td className="mono">{trip.trip_code}</td>
              <td>
                <strong>{trip.trip_name}</strong>
                {trip.trip_name && <div className="muted small">{trip.trip_name}</div>}
              </td>
              <td>
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString("en-IN") : "—"}
                {trip.end_date ? ` – ${new Date(trip.end_date).toLocaleDateString("en-IN")}` : ""}
              </td>
              <td>{trip.leader_first_name ? `${trip.leader_first_name} ${trip.leader_last_name}` : "Unassigned"}</td>
              <td>
                <span className={`pill ${statusPill[trip.status] ?? "off"}`}>{trip.status}</span>
              </td>
              <td className="row-actions">
                <Link className="link-btn" href={`/admin/trips/${trip.trip_id}`}>
                  Edit
                </Link>
                <Link className="link-btn" href={`/dashboard/trips/${trip.trip_id}`}>
                  Preview
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}