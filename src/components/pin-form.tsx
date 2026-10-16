"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import SupabaseSetupNotice from "@/components/supabase-setup-notice";

export default function PinForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Auto-advance between the four PIN boxes.
  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function moveFocus(index: number) {
    inputs.current[index]?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const fullPin = pin.padEnd(4, "0");
    if (fullPin.length !== 4) {
      setError("Enter all four digits.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, pin: fullPin }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setError(data?.error ?? "We could not sign you in.");
      setLoading(false);
      return;
    }

    // Exchange the one-time token for a real session so RLS applies from here.
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: "email",
    });

    if (verifyError) {
      setError("Your sign-in expired. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "");
    if (!digit) return;

    const chars = pin.padEnd(4, " ").split("");
    chars[index] = digit;
    const next = chars.join("").trimEnd();
    setPin(next);

    if (index < 3) {
      moveFocus(index + 1);
    } else {
      // Submit as soon as the fourth digit lands.
      setTimeout(() => {
        inputs.current[3]?.blur();
        document.getElementById("pin-submit")?.click();
      }, 60);
    }
  }

  function handleKeyDown(index: number, key: string) {
    if (key === "Backspace" && !pin[index]) {
      moveFocus(Math.max(0, index - 1));
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

      <div className="form-field">
        <span className="form-label">PIN</span>
        <p className="form-hint">The last four digits of your phone number.</p>
        <div className="pin-inputs">
          {[0, 1, 2, 3].map((index) => (
            <input
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              pattern="[0-9]*"
              aria-label={`PIN digit ${index + 1}`}
              value={pin[index] ?? ""}
              onChange={(event) => handleDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event.key)}
            />
          ))}
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button id="pin-submit" className="btn btn-primary auth-submit" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}