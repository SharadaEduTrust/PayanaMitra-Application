"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

interface LogoutButtonProps {
  redirectTo?: string;
  className?: string;
  showIcon?: boolean;
  label?: string;
  style?: React.CSSProperties;
}

export default function LogoutButton({
  redirectTo = "/login",
  className = "side-link side-logout",
  showIcon = true,
  label = "Log out",
  style,
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function signOut() {
    if (loading) return;
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("payana_last_active");
      }
      // 1. Clear server-side session cookies
      await fetch("/api/logout", { method: "POST" }).catch(() => null);
      // 2. Clear client-side Supabase state
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => null);
    } finally {
      // 3. Navigate to target redirect URL
      window.location.href = redirectTo;
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={signOut}
      disabled={loading}
      style={style}
      aria-label="Log out of account"
    >
      {showIcon && <LogOut size={16} aria-hidden="true" />}
      <span>{loading ? "Signing out…" : label}</span>
    </button>
  );
}