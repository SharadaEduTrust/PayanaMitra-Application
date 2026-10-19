"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "All trips" },
  { href: "/dashboard/profile", label: "My profile" },
  { href: "/dashboard/documents", label: "My documents" },
  { href: "/dashboard/notifications", label: "Notifications" },
];

export default function DashboardNav({ role }: { role: string }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <>
      <div className="side-label">Your trips</div>
      {links.map((link) => (
        <Link
          key={link.href}
          className={`side-link ${isActive(link.href) ? "active" : ""}`}
          href={link.href}
        >
          {link.label}
        </Link>
      ))}

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
