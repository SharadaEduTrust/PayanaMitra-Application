"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/logout-button";

export default function MobileNav({
  title = "Menu",
  redirectTo = "/login",
  unreadCount = 0,
}: {
  title?: string;
  redirectTo?: string;
  unreadCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(unreadCount);

  useEffect(() => {
    setCount(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    function handleUpdate(e: Event) {
      const customEvent = e as CustomEvent<{ unreadCount?: number }>;
      if (typeof customEvent.detail?.unreadCount === "number") {
        setCount(customEvent.detail.unreadCount);
      }
    }
    window.addEventListener("payana:notifications-updated", handleUpdate);
    return () => {
      window.removeEventListener("payana:notifications-updated", handleUpdate);
    };
  }, []);

  function toggle() {
    const side = document.querySelector(".sidebar, .admin-side");
    if (side) {
      side.classList.toggle("open");
      setOpen(!open);
    }
  }

  function close() {
    const side = document.querySelector(".sidebar, .admin-side");
    if (side) {
      side.classList.remove("open");
      setOpen(false);
    }
  }

  return (
    <>
      <div className="mobile-bar" style={{ display: "none" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={toggle}
          aria-label="Toggle navigation"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px" }}
        >
          <span>☰</span> {title}
        </button>

        <Link
          href="/dashboard/notifications"
          className="btn btn-secondary"
          aria-label={`Notifications ${count > 0 ? `(${count} unread)` : ""}`}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "6px 11px",
            fontSize: "13px",
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: "14px" }}>🔔</span>
          {count > 0 && (
            <span className="mobile-bell-badge">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>

        <LogoutButton
          redirectTo={redirectTo}
          className="btn btn-secondary"
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            fontSize: "13px",
          }}
        />
      </div>
      {open && (
        <div
          className="mobile-backdrop"
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            zIndex: 998,
          }}
        />
      )}
    </>
  );
}

