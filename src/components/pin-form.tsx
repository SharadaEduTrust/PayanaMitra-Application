"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import SupabaseSetupNotice from "@/components/supabase-setup-notice";
import { Eye, EyeOff } from "lucide-react";

export default function PinForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const cleanPassword = password.trim();
    if (cleanPassword.length < 4) {
      setError("Please enter your password (at least 4 characters).");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password: cleanPassword }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      setError(data?.error ?? "We could not sign you in. Please check your phone and password.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (data.session) {
      await supabase.auth.setSession(data.session);
    } else if (data.tokenHash) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: "email",
      });

      if (verifyError) {
        setError("Your sign-in expired. Please try again.");
        setLoading(false);
        return;
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("payana_last_active", String(Date.now()));
    }

    const nextUrl = new URLSearchParams(window.location.search).get("next");
    if (nextUrl && (data.role === "admin" || !nextUrl.startsWith("/admin"))) {
      router.push(nextUrl);
    } else {
      router.push(data.role === "admin" ? "/admin" : "/dashboard");
    }
  }

  if (!isSupabaseConfigured()) return <SupabaseSetupNotice />;

  return (
    <form onSubmit={submit}>
      <label className="form-field">
        Phone number
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="98765 43210"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
      </label>

      <label className="form-field">
        Password
        <p className="form-hint" style={{ marginTop: "2px", marginBottom: "4px" }}>
          Initial password is the last 4 digits of your phone number. If you changed it, enter your new password.
        </p>
        <span className="password-input">
          <input
            required
            minLength={4}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Last 4 digits or custom password"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button id="pin-submit" className="btn btn-primary auth-submit" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}