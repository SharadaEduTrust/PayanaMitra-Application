"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 30 minutes in milliseconds
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
// Throttle activity updates so we don't write to storage on every single mousemove/keypress
const ACTIVITY_THROTTLE_MS = 10 * 1000; // 10 seconds
const CHECK_INTERVAL_MS = 10 * 1000; // Check inactivity every 10 seconds

export default function SessionTimeoutWatcher() {
  const pathname = usePathname();
  const isTimingOutRef = useRef(false);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    // If the user is on the login or signup page, do not track inactivity
    if (pathname === "/login" || pathname === "/signup") {
      return;
    }

    const supabase = createClient();
    let isSubscribed = true;

    async function handleTimeout() {
      if (isTimingOutRef.current) return;
      isTimingOutRef.current = true;

      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("payana_last_active");
          document.cookie = "payana_last_active=; path=/; max-age=0; SameSite=Lax";
        }
        await fetch("/api/logout", { method: "POST" }).catch(() => null);
        await supabase.auth.signOut().catch(() => null);
      } finally {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?timeout=1&next=${next}`;
      }
    }

    function recordActivity() {
      const now = Date.now();
      if (now - lastUpdateRef.current < ACTIVITY_THROTTLE_MS) {
        return;
      }
      lastUpdateRef.current = now;
      try {
        localStorage.setItem("payana_last_active", String(now));
        document.cookie = `payana_last_active=${now}; path=/; max-age=86400; SameSite=Lax`;
      } catch {
        // Storage might be restricted
      }
    }

    function checkInactivity() {
      if (isTimingOutRef.current) return;

      let lastActive = 0;
      try {
        const stored = localStorage.getItem("payana_last_active");
        if (stored) {
          lastActive = parseInt(stored, 10);
        }
      } catch {
        // Storage restricted
      }

      // Fallback to cookie if localStorage is empty
      if (!lastActive) {
        const match = document.cookie.match(/(?:^|;\s*)payana_last_active=([^;]*)/);
        if (match && match[1]) {
          lastActive = parseInt(match[1], 10);
        }
      }

      // If user is authenticated but no timestamp is recorded yet, initialize it
      if (!lastActive) {
        recordActivity();
        return;
      }

      const now = Date.now();
      if (now - lastActive >= INACTIVITY_TIMEOUT_MS) {
        handleTimeout();
      }
    }

    // Check if the user is authenticated before attaching listeners
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isSubscribed || !session) return;

      // Run an initial check and record baseline activity
      checkInactivity();

      const events: Array<keyof WindowEventMap> = [
        "mousedown",
        "keydown",
        "scroll",
        "touchstart",
        "click",
      ];

      events.forEach((event) => {
        window.addEventListener(event, recordActivity, { passive: true });
      });

      // Handle returning to tab after sleep or background inactivity
      function onVisibilityChange() {
        if (document.visibilityState === "visible") {
          checkInactivity();
        }
      }
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("focus", checkInactivity);

      const interval = setInterval(checkInactivity, CHECK_INTERVAL_MS);

      return () => {
        events.forEach((event) => {
          window.removeEventListener(event, recordActivity);
        });
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("focus", checkInactivity);
        clearInterval(interval);
      };
    });

    return () => {
      isSubscribed = false;
    };
  }, [pathname]);

  return null;
}
