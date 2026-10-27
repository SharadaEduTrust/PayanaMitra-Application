"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type AdminFeedbackItem = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  trip_id: string;
  user_id: string;
  trip: {
    id: string;
    name: string;
    trip_code: string;
    destination: string | null;
    feedback_form_url: string | null;
  } | null;
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    avatar_url?: string | null;
  } | null;
};

export type AdminTripOption = {
  id: string;
  name: string;
  trip_code: string;
  destination: string | null;
  feedback_form_url: string | null;
};

type Props = {
  feedback: AdminFeedbackItem[];
  trips: AdminTripOption[];
  initialTripId?: string;
};

export default function FeedbackAdmin({ feedback, trips, initialTripId }: Props) {
  const [selectedTripId, setSelectedTripId] = useState<string>(initialTripId || "all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  // Filter and sort items
  const filtered = useMemo(() => {
    let result = feedback;

    if (selectedTripId !== "all") {
      result = result.filter((item) => item.trip_id === selectedTripId);
    }

    if (ratingFilter === "excellent") {
      result = result.filter((item) => item.rating >= 9);
    } else if (ratingFilter === "good") {
      result = result.filter((item) => item.rating >= 7 && item.rating <= 8);
    } else if (ratingFilter === "average") {
      result = result.filter((item) => item.rating >= 5 && item.rating <= 6);
    } else if (ratingFilter === "low") {
      result = result.filter((item) => item.rating < 5);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        const guestName = `${item.profile?.first_name ?? ""} ${item.profile?.last_name ?? ""}`.toLowerCase();
        const phone = (item.profile?.phone ?? "").toLowerCase();
        const email = (item.profile?.email ?? "").toLowerCase();
        const tripName = (item.trip?.name ?? "").toLowerCase();
        const tripCode = (item.trip?.trip_code ?? "").toLowerCase();
        const comment = (item.comment ?? "").toLowerCase();
        return (
          guestName.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          tripName.includes(q) ||
          tripCode.includes(q) ||
          comment.includes(q)
        );
      });
    }

    return [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "highest") {
        return b.rating - a.rating;
      }
      if (sortBy === "lowest") {
        return a.rating - b.rating;
      }
      return 0;
    });
  }, [feedback, selectedTripId, ratingFilter, searchQuery, sortBy]);

  // Overall and filtered metrics
  const stats = useMemo(() => {
    const list = selectedTripId === "all" ? feedback : feedback.filter((i) => i.trip_id === selectedTripId);
    const count = list.length;
    if (count === 0) {
      return { avg: "0.0", count: 0, highRate: "0%", distinctTrails: 0 };
    }
    const sum = list.reduce((acc, curr) => acc + (curr.rating || 0), 0);
    const avg = (sum / count).toFixed(1);
    const highCount = list.filter((i) => i.rating >= 8).length;
    const highRate = `${Math.round((highCount / count) * 100)}%`;
    const distinctTrails = new Set(list.map((i) => i.trip_id)).size;
    return { avg, count, highRate, distinctTrails };
  }, [feedback, selectedTripId]);

  // Selected trip info
  const selectedTrip = useMemo(() => {
    if (selectedTripId === "all") return null;
    return trips.find((t) => t.id === selectedTripId) ?? null;
  }, [trips, selectedTripId]);

  // Export CSV
  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = [
      "Trail Code",
      "Trail Name",
      "Destination",
      "Guest First Name",
      "Guest Last Name",
      "Guest Phone",
      "Guest Email",
      "Rating (Out of 10)",
      "Review Comment",
      "Submitted At",
    ];

    const rows = filtered.map((item) => [
      `"${(item.trip?.trip_code ?? "").replace(/"/g, '""')}"`,
      `"${(item.trip?.name ?? "").replace(/"/g, '""')}"`,
      `"${(item.trip?.destination ?? "").replace(/"/g, '""')}"`,
      `"${(item.profile?.first_name ?? "").replace(/"/g, '""')}"`,
      `"${(item.profile?.last_name ?? "").replace(/"/g, '""')}"`,
      `"${(item.profile?.phone ?? "").replace(/"/g, '""')}"`,
      `"${(item.profile?.email ?? "").replace(/"/g, '""')}"`,
      item.rating,
      `"${(item.comment ?? "").replace(/"/g, '""')}"`,
      `"${new Date(item.created_at).toISOString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `payana_mitra_feedback_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getRatingBadge(score: number) {
    if (score >= 9) {
      return {
        text: `${score}/10 Outstanding`,
        bg: "rgba(42, 75, 40, 0.12)",
        color: "#2a4b28",
        border: "1px solid rgba(42, 75, 40, 0.25)",
      };
    }
    if (score >= 7) {
      return {
        text: `${score}/10 Good`,
        bg: "rgba(34, 112, 94, 0.12)",
        color: "#22705e",
        border: "1px solid rgba(34, 112, 94, 0.25)",
      };
    }
    if (score >= 5) {
      return {
        text: `${score}/10 Average`,
        bg: "rgba(217, 119, 6, 0.12)",
        color: "#b45309",
        border: "1px solid rgba(217, 119, 6, 0.25)",
      };
    }
    return {
      text: `${score}/10 Needs Attention`,
      bg: "rgba(220, 38, 38, 0.12)",
      color: "#b91c1c",
      border: "1px solid rgba(220, 38, 38, 0.25)",
    };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Metric Cards */}
      <div className="admin-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="stat">
          <span>Average Rating</span>
          <strong style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            ⭐ {stats.avg}
            <span style={{ fontSize: "14px", fontWeight: "400", color: "#64748b" }}>/ 10</span>
          </strong>
        </div>
        <div className="stat">
          <span>Total Reviews</span>
          <strong>{stats.count}</strong>
        </div>
        <div className="stat">
          <span>High Rating (8+)</span>
          <strong>{stats.highRate}</strong>
        </div>
        <div className="stat">
          <span>Reviewed Trails</span>
          <strong>{stats.distinctTrails}</strong>
        </div>
      </div>

      {/* Selected Trail Banner & Google Form link */}
      {selectedTrip && (
        <div
          style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, rgba(247, 243, 235, 0.95), rgba(255, 255, 255, 0.9))",
            border: "1px solid #e5dccb",
            borderRadius: "10px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#8a7356", fontWeight: "600" }}>
              Selected Trail
            </div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginTop: "2px" }}>
              {selectedTrip.name} <span style={{ fontWeight: "400", color: "#64748b", fontSize: "14px" }}>({selectedTrip.trip_code})</span>
            </div>
            {selectedTrip.destination && (
              <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                📍 {selectedTrip.destination}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {selectedTrip.feedback_form_url ? (
              <a
                href={selectedTrip.feedback_form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  borderColor: "#2a4b28",
                  color: "#2a4b28",
                  fontWeight: "600",
                }}
              >
                <span>📋</span> View Google Form ↗
              </a>
            ) : (
              <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                No external Google Form configured
              </span>
            )}
            <Link
              href={`/admin/trips/${selectedTrip.id}`}
              className="btn btn-secondary"
              style={{ fontSize: "13px" }}
            >
              Edit Trail Settings
            </Link>
          </div>
        </div>
      )}

      {/* Filter and Control Bar */}
      <section
        className="admin-card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "20px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
          {/* Search Input */}
          <div style={{ flex: "1 1 280px", maxWidth: "420px" }}>
            <input
              type="search"
              placeholder="Search by guest name, phone, trail, or comment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 14px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                background: "#ffffff",
              }}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            {/* Trail Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label htmlFor="tripSelect" style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>
                Trail:
              </label>
              <select
                id="tripSelect"
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  background: "#ffffff",
                  maxWidth: "240px",
                }}
              >
                <option value="all">All Trails ({trips.length})</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.trip_code} - {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Rating Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label htmlFor="ratingSelect" style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>
                Rating:
              </label>
              <select
                id="ratingSelect"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  background: "#ffffff",
                }}
              >
                <option value="all">All Ratings</option>
                <option value="excellent">9-10 (Outstanding)</option>
                <option value="good">7-8 (Good)</option>
                <option value="average">5-6 (Average)</option>
                <option value="low">&lt; 5 (Needs Attention)</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label htmlFor="sortSelect" style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", textTransform: "uppercase" }}>
                Sort:
              </label>
              <select
                id="sortSelect"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  background: "#ffffff",
                }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
              </select>
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="btn btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                padding: "8px 14px",
              }}
            >
              📥 Export CSV ({filtered.length})
            </button>
          </div>
        </div>

        {/* Results Counter & Active Filters Summary */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
          <div>
            Showing <strong>{filtered.length}</strong> of <strong>{feedback.length}</strong> total reviews
            {selectedTripId !== "all" && (
              <span style={{ marginLeft: "8px", color: "#2a4b28", fontWeight: "500" }}>
                • Filtered by trail
              </span>
            )}
            {ratingFilter !== "all" && (
              <span style={{ marginLeft: "8px", color: "#2a4b28", fontWeight: "500" }}>
                • Rating: {ratingFilter}
              </span>
            )}
            {searchQuery && (
              <span style={{ marginLeft: "8px", color: "#2a4b28", fontWeight: "500" }}>
                • &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>
          {(selectedTripId !== "all" || ratingFilter !== "all" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedTripId("all");
                setRatingFilter("all");
                setSearchQuery("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#991b1b",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600",
                textDecoration: "underline",
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      </section>

      {/* Reviews List */}
      {filtered.length === 0 ? (
        <section className="admin-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>💬</div>
          <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1e293b", marginBottom: "8px" }}>
            No guest feedback found
          </h3>
          <p style={{ color: "#64748b", fontSize: "14px", maxWidth: "460px", margin: "0 auto 16px auto" }}>
            {feedback.length === 0
              ? "Guests have not submitted any feedback yet. As soon as travellers rate completed trails, their reviews will appear here."
              : "No feedback entries match your active filter and search terms. Try adjusting your query or resetting filters."}
          </p>
          {(selectedTripId !== "all" || ratingFilter !== "all" || searchQuery) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSelectedTripId("all");
                setRatingFilter("all");
                setSearchQuery("");
              }}
            >
              Show all feedback
            </button>
          )}
        </section>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filtered.map((item) => {
            const badge = getRatingBadge(item.rating);
            const guestInitials = `${item.profile?.first_name?.charAt(0) ?? ""}${item.profile?.last_name?.charAt(0) ?? ""}`.toUpperCase() || "?";
            const dateStr = new Date(item.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={item.id}
                className="admin-card"
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  borderLeft: `4px solid ${badge.color}`,
                  transition: "box-shadow 0.2s ease",
                }}
              >
                {/* Header: Guest Info & Rating */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "50%",
                        backgroundColor: "#2a4b28",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "700",
                        fontSize: "15px",
                        letterSpacing: "0.05em",
                        flexShrink: 0,
                      }}
                    >
                      {guestInitials}
                    </div>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "16px", color: "#0f172a" }}>
                        {item.profile ? `${item.profile.first_name} ${item.profile.last_name}` : "Unknown Guest"}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                        {item.profile?.phone && <span>📞 {item.profile.phone}</span>}
                        {item.profile?.email && <span>✉️ {item.profile.email}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {/* Rating Pill */}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 14px",
                        borderRadius: "20px",
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: badge.border,
                        fontSize: "14px",
                        fontWeight: "700",
                      }}
                    >
                      ⭐ {badge.text}
                    </span>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>{dateStr}</span>
                  </div>
                </div>

                {/* Trail Info Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    fontSize: "13px",
                    color: "#334155",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "600", color: "#64748b" }}>Trail:</span>
                    <Link
                      href={`/admin/trips/${item.trip_id}`}
                      style={{ fontWeight: "600", color: "#2a4b28", textDecoration: "none" }}
                    >
                      {item.trip?.name ?? "Trail Details"} ({item.trip?.trip_code ?? "—"})
                    </Link>
                    {item.trip?.destination && (
                      <span style={{ color: "#64748b" }}>• {item.trip.destination}</span>
                    )}
                  </div>
                  {item.trip?.feedback_form_url && (
                    <a
                      href={item.trip.feedback_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: "12px",
                        color: "#2563eb",
                        textDecoration: "underline",
                        fontWeight: "500",
                      }}
                    >
                      Google Form ↗
                    </a>
                  )}
                </div>

                {/* Written Review Comment */}
                <div
                  style={{
                    padding: "12px 16px",
                    backgroundColor: item.comment ? "rgba(247, 243, 235, 0.6)" : "#fafafa",
                    borderRadius: "6px",
                    border: "1px solid #f1ece1",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: item.comment ? "#1e293b" : "#94a3b8",
                    fontStyle: item.comment ? "normal" : "italic",
                  }}
                >
                  {item.comment ? (
                    <span style={{ whiteSpace: "pre-wrap" }}>&ldquo;{item.comment}&rdquo;</span>
                  ) : (
                    "No written comments provided."
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
