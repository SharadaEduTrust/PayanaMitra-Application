"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ExternalLink } from "lucide-react";

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

export default function DashboardNav({ role }: { role: string }) {
  const pathname = usePathname();

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
            {link.label}
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
