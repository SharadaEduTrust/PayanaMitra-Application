"use client";

import { useEffect } from "react";

/**
 * Global listener ensuring all external links and target="_blank" links
 * open into a new browser tab/window across all environments, including
 * mobile Safari, Chrome, and standalone PWAs (installed web apps) where
 * default target="_blank" navigations are otherwise captured within the webview.
 */
export default function ExternalLinkWatcher() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor || !anchor.href) return;

      // Skip download links, javascript/hash links, tel, mailto
      if (anchor.hasAttribute("download")) return;
      if (
        anchor.href.startsWith("tel:") ||
        anchor.href.startsWith("mailto:") ||
        anchor.href.startsWith("javascript:")
      ) {
        return;
      }

      const isBlank = anchor.target === "_blank";
      const isHttp = anchor.href.startsWith("http://") || anchor.href.startsWith("https://");
      const isDifferentOrigin = isHttp && !anchor.href.startsWith(window.location.origin);

      if (isBlank || isDifferentOrigin) {
        // Enforce target and rel attributes for security and standard behavior
        anchor.target = "_blank";
        if (!anchor.rel) {
          anchor.rel = "noopener noreferrer";
        }

        try {
          const win = window.open(anchor.href, "_blank", "noopener,noreferrer");
          if (win) {
            e.preventDefault();
          }
        } catch {
          // Allow default action if window.open fails
        }
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  return null;
}

