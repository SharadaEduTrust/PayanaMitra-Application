"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import SupabaseSetupNotice from "@/components/supabase-setup-notice";

const passwordRule = "At least 8 characters";

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      password: String(form.get("password") || ""),
      location: String(form.get("location") || ""),
    };

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
    });

    if (signUpError) {
      setError(
        signUpError.message === "User already registered"
          ? "An account already exists for that email. Try logging in."
          : signUpError.message,
      );
      setLoading(false);
      return;
    }

    // profiles is insert-protected, so the row is written server-side.
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "We could not finish setting up your account.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
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

      <label className="form-field">
        Email address
        <input required name="email" type="email" autoComplete="email" placeholder="you@example.com" />
      </label>

      <label className="form-field">
        Password
        <span className="password-input">
          <input
            required
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={8}
            autoComplete="new-password"
            placeholder={passwordRule}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
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