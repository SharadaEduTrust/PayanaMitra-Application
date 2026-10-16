"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import SupabaseSetupNotice from "@/components/supabase-setup-notice";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (password !== confirm) {
      setError("Those two passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Clear the flag server-side. profiles has no client update policy for
    // this column, so it goes through the API route with the service role.
    await fetch("/api/profile/clear-password-flag", { method: "POST" });

    setDone(true);
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  if (done) {
    return <p className="form-notice" role="status">Password updated. Taking you to your trips…</p>;
  }

  if (!isSupabaseConfigured()) return <SupabaseSetupNotice />;

  return (
    <form onSubmit={submit}>
      <label className="form-field">
        New password
        <input required name="password" type="password" minLength={8} autoComplete="new-password" />
      </label>
      <label className="form-field">
        Confirm new password
        <input required name="confirm" type="password" minLength={8} autoComplete="new-password" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}