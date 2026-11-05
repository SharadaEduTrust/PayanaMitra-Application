"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ExternalLink } from "lucide-react";
import { openExternalUrl } from "@/lib/utils";

interface NavLinkItem {
  href: string;
  label: string;
  external?: boolean;
}

const links: NavLinkItem[] = [
  { href: "/dashboard", label: "My Trails" },
  { href: "https://sulabh2-frontend-341341131750.europe-west3.run.app/login", label: "Payana Quiz", external: true },
  { href: "/dashboard/profile", label: "My Profile" },
  { href: "/dashboard/documents", label: "My Documents" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/change-password", label: "Change Password" },
];

export default function DashboardNav({
  role,
  initialUnreadCount = 0,
}: {
  role: string;
  initialUnreadCount?: number;
}) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    function handleUpdate(e: Event) {
      const customEvent = e as CustomEvent<{ unreadCount?: number }>;
      if (typeof customEvent.detail?.unreadCount === "number") {
        setUnreadCount(customEvent.detail.unreadCount);
      }
    }
    window.addEventListener("payana:notifications-updated", handleUpdate);
    return () => {
      window.removeEventListener("payana:notifications-updated", handleUpdate);
    };
  }, []);

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
      <div className="side-label">Your Trails</div>
      {links.map((link) =>
        link.external ? (
          <a
            key={link.href}
            className="side-link"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openExternalUrl(link.href, e)}
          >
            <span>{link.label}</span>
            <ExternalLink
              size={13}
              style={{ marginLeft: "auto", opacity: 0.65, flexShrink: 0 }}
              aria-hidden="true"
            />
          </a>
        ) : (
          <Link
            key={link.href}
            className={`side-link ${isActive(link.href) ? "active" : ""}`}
            href={link.href}
            prefetch={true}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              {link.href === "/dashboard/notifications" && <span>🔔</span>}
              <span>{link.label}</span>
            </span>
            {link.href === "/dashboard/notifications" && unreadCount > 0 && (
              <span className="nav-unread-badge" title={`${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        )
      )}

      {(role === "leader" || role === "admin") && (
        <>
          <div className="side-label">Trail Lead</div>
          <Link className={`side-link ${isActive("/dashboard/guests") ? "active" : ""}`} href="/dashboard/guests" prefetch={true}>
            Assigned Guests
          </Link>
          <Link className={`side-link ${isActive("/dashboard/feedback") ? "active" : ""}`} href="/dashboard/feedback" prefetch={true}>
            Guest Feedback
          </Link>
        </>
      )}

      {role === "admin" && (
        <>
          <div className="side-label">Administration</div>
          <Link className={`side-link ${isActive("/admin") ? "active" : ""}`} href="/admin" prefetch={true}>
            Admin panel
          </Link>
        </>
      )}
    </>
  );
}
