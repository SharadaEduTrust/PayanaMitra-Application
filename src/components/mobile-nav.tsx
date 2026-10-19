"use client";

import { useState } from "react";

export default function MobileNav({ title = "Menu" }: { title?: string }) {
  const [open, setOpen] = useState(false);

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
