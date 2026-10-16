"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <div>
      {links.map((link) => {
        const active =
          link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link key={link.href} className={`side-link ${active ? "active" : ""}`} href={link.href}>
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}