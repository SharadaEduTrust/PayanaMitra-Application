"use client";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button className="side-link side-logout" onClick={signOut}>
      Log out
    </button>
  );
}