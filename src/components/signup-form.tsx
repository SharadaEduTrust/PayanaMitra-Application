"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import SupabaseSetupNotice from "@/components/supabase-setup-notice";

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: String(form.get("firstName") || ""),
      lastName: String(form.get("lastName") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      location: String(form.get("location") || ""),
    };

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "We could not finish setting up your account.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      if (data.session) {
        await supabase.auth.setSession(data.session);
      } else if (data.tokenHash) {
        await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: "email",
        });
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error while creating account. Please try again.");
      setLoading(false);
    }
  }

  if (!isSupabaseConfigured()) return <SupabaseSetupNotice />;

  return (
    <form onSubmit={submit}>
      <div className="field-row">
        <label className="form-field">
          First name
          <input required name="firstName" autoComplete="given-name" placeholder="Divyanshu" />
        </label>
        <label className="form-field">
          Last name
          <input required name="lastName" autoComplete="family-name" placeholder="Kumar" />
        </label>
      </div>

      <label className="form-field">
        Phone number
        <input required name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="98765 43210" />
      </label>

      <div
        style={{
          margin: "12px 0",
          padding: "12px 14px",
          background: "rgba(212, 163, 115, 0.12)",
          border: "1px solid rgba(212, 163, 115, 0.3)",
          borderRadius: "8px",
          fontSize: "13px",
          lineHeight: "1.5",
        }}
      >
        <strong style={{ display: "block", marginBottom: "3px", color: "var(--accent, #D4A373)" }}>
          System-Allocated Password
        </strong>
        Your initial password is the <strong>last 4 digits</strong> of your phone number. You can change your password anytime after signing in.
      </div>

      <label className="form-field">
        Email address <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" />
      </label>

      <label className="form-field">
        Home city <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
        <input name="location" autoComplete="address-level2" placeholder="Dharwad" />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
        {loading ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}