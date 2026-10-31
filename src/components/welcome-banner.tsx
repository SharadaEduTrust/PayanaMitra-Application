"use client";

import { useEffect, useState } from "react";

export default function WelcomeBanner({ firstName }: { firstName?: string }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("payana_welcome");
      if (stored) {
        setMessage(stored);
        setVisible(true);
        sessionStorage.removeItem("payana_welcome");
      }
    }
  }, []);

  if (!visible && !message) return null;

  return (
    <div
      role="status"
      style={{
        margin: "0 0 20px 0",
        padding: "13px 18px",
        background: "#edf7ee",
        border: "1px solid #c7e6c9",
        borderLeft: "4px solid var(--forest, #1e3a2b)",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        color: "var(--forest, #1e3a2b)",
        fontSize: "14.5px",
        fontWeight: 600,
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "19px" }}>👋</span>
        <span>{message || `Welcome to Payana Mitra${firstName?.trim() ? `, ${firstName.trim()}` : ""}`}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setMessage("");
        }}
        style={{
          background: "transparent",
          border: 0,
          fontSize: "16px",
          cursor: "pointer",
          color: "inherit",
          padding: "4px 6px",
          lineHeight: 1,
          opacity: 0.7,
        }}
        title="Dismiss"
        aria-label="Dismiss welcome message"
      >
        ✕
      </button>
    </div>
  );
}
