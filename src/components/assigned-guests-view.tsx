"use client";

import { useState, useMemo } from "react";

export type AssignedGuest = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string | null;
  location?: string | null;
  remarks?: string | null;
  traveller_details?: Array<{
    dob?: string | null;
    food_preference?: string | null;
    food_allergy?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_no?: string | null;
    travel_insurance_no?: string | null;
    insurance_company?: string | null;
  }> | {
    dob?: string | null;
    food_preference?: string | null;
    food_allergy?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_no?: string | null;
    travel_insurance_no?: string | null;
    insurance_company?: string | null;
  } | null;
};

export default function AssignedGuestsView({ initialGuests }: { initialGuests: AssignedGuest[] }) {
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "location" | "food">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialGuests;

    return initialGuests.filter((guest) => {
      const details = Array.isArray(guest.traveller_details)
        ? guest.traveller_details[0]
        : guest.traveller_details;

      const fullName = `${guest.first_name} ${guest.last_name}`.toLowerCase();
      const phone = (guest.phone || "").toLowerCase();
      const email = (guest.email || "").toLowerCase();
      const location = (guest.location || "").toLowerCase();
      const emergency = (details?.emergency_contact_name || "").toLowerCase();
      const food = (details?.food_preference || "").toLowerCase();

      return (
        fullName.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        location.includes(q) ||
        emergency.includes(q) ||
        food.includes(q)
      );
    });
  }, [initialGuests, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const detailsA = Array.isArray(a.traveller_details) ? a.traveller_details[0] : a.traveller_details;
      const detailsB = Array.isArray(b.traveller_details) ? b.traveller_details[0] : b.traveller_details;

      let cmp = 0;
      if (sortField === "name") {
        const nameA = `${a.first_name} ${a.last_name}`.trim().toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.trim().toLowerCase();
        cmp = nameA.localeCompare(nameB);
      } else if (sortField === "location") {
        cmp = (a.location || "").localeCompare(b.location || "");
      } else if (sortField === "food") {
        cmp = (detailsA?.food_preference || "").localeCompare(detailsB?.food_preference || "");
      }

      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortOrder]);

  return (
    <div>
      {/* Search and Sort Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
          padding: "14px 18px",
          background: "var(--paper, rgba(255,255,255,0.03))",
          border: "1px solid var(--line, rgba(255,255,255,0.08))",
          borderRadius: "8px",
        }}
      >
        {/* Search Input with Magnifying Glass */}
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center", minWidth: "260px", flex: "1 1 280px" }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: "absolute",
              left: "12px",
              color: "var(--color-muted, #94a3b8)",
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="admin-search"
            placeholder="Search guests by name, phone, city, emergency contact…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", paddingLeft: "36px", paddingRight: query ? "30px" : "12px" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{
                position: "absolute",
                right: "8px",
                background: "none",
                border: "none",
                color: "var(--color-muted, #94a3b8)",
                cursor: "pointer",
                padding: "2px 6px",
                fontSize: "14px",
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span className="muted small" style={{ whiteSpace: "nowrap" }}>Sort by:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as "name" | "location" | "food")}
            style={{ padding: "6px 12px", borderRadius: "6px" }}
          >
            <option value="name">Name</option>
            <option value="location">Location</option>
            <option value="food">Food Preference</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSortOrder((p) => (p === "asc" ? "desc" : "asc"))}
            style={{ padding: "6px 10px", fontSize: "13px" }}
            title="Toggle Ascending/Descending"
          >
            {sortOrder === "asc" ? "▲ Asc" : "▼ Desc"}
          </button>
          <span className="muted small" style={{ marginLeft: "4px" }}>
            ({sorted.length} {sorted.length === 1 ? "guest" : "guests"})
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <section className="panel">
          <p className="panel-note">
            {query ? `No guests found matching "${query}".` : "No guests currently assigned."}
          </p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          {sorted.map((guest) => {
            const details = Array.isArray(guest.traveller_details)
              ? guest.traveller_details[0]
              : guest.traveller_details;

            return (
              <article key={guest.id} className="panel" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
                  <div>
                    <h2 className="serif" style={{ margin: 0, fontSize: "1.3rem" }}>
                      {guest.first_name} {guest.last_name}
                    </h2>
                    <div className="muted small" style={{ marginTop: "4px" }}>
                      <span className="mono">{guest.phone}</span>
                      {guest.email && ` · ${guest.email}`}
                      {guest.location && ` · ${guest.location}`}
                    </div>
                  </div>
                  {details?.food_preference && (
                    <span className="pill on" style={{ textTransform: "none", fontWeight: 600 }}>
                      {details.food_preference === "veg" ? "Veg" : details.food_preference === "non_veg" ? "Non Veg" : details.food_preference}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", paddingTop: "12px", borderTop: "1px solid var(--color-border, rgba(255,255,255,0.08))" }}>
                  <div>
                    <span className="eyebrow" style={{ fontSize: "10px", display: "block", marginBottom: "4px" }}>Emergency Contact</span>
                    {details?.emergency_contact_name ? (
                      <div>
                        <strong>{details.emergency_contact_name}</strong>
                        {details.emergency_contact_no && (
                          <div className="mono small muted">{details.emergency_contact_no}</div>
                        )}
                      </div>
                    ) : (
                      <span className="muted small">Not provided</span>
                    )}
                  </div>

                  <div>
                    <span className="eyebrow" style={{ fontSize: "10px", display: "block", marginBottom: "4px" }}>Food Allergy</span>
                    <span className={details?.food_allergy ? "bold" : "muted small"}>
                      {details?.food_allergy || "None reported"}
                    </span>
                  </div>

                  <div>
                    <span className="eyebrow" style={{ fontSize: "10px", display: "block", marginBottom: "4px" }}>Travel Insurance</span>
                    {details?.travel_insurance_no ? (
                      <div>
                        <strong className="mono small">{details.travel_insurance_no}</strong>
                        {details.insurance_company && (
                          <div className="muted small">{details.insurance_company}</div>
                        )}
                      </div>
                    ) : (
                      <span className="muted small">Not provided</span>
                    )}
                  </div>

                  {guest.remarks && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span className="eyebrow" style={{ fontSize: "10px", display: "block", marginBottom: "4px" }}>Remarks</span>
                      <p className="small muted" style={{ margin: 0 }}>{guest.remarks}</p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
