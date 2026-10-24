"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "All Trails" },
  { href: "/dashboard/profile", label: "My Profile" },
  { href: "/dashboard/documents", label: "My Documents" },
  { href: "/dashboard/notifications", label: "Notifications" },
];

export default function DashboardNav({ role, unreadCount = 0 }: { role: string; unreadCount?: number }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
      <div className="side-label">Your Trails</div>
      {links.map((link) => {
        const isNotif = link.href === "/dashboard/notifications";
        const showBadge = isNotif && unreadCount > 0;
        return (
          <Link
            key={link.href}
            className={`side-link ${isActive(link.href) ? "active" : ""}`}
            href={link.href}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>{link.label}</span>
            {showBadge && (
              <span
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  borderRadius: "10px",
                  padding: "1px 7px",
                  lineHeight: "16px",
                }}
              >
                {unreadCount}
              </span>
            )}
          </Link>
        );
      })}

      {(role === "leader" || role === "admin") && (
        <>
          <div className="side-label">Trail Lead</div>
          <Link className={`side-link ${isActive("/dashboard/guests") ? "active" : ""}`} href="/dashboard/guests">
            Assigned Guests
          </Link>
        </>
      )}

      {role === "admin" && (
        <>
          <div className="side-label">Administration</div>
          <Link className={`side-link ${isActive("/admin") ? "active" : ""}`} href="/admin">
            Admin panel
          </Link>
        </>
      )}
    </>
  );
}
