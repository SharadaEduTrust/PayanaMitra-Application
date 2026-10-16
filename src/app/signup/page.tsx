import Link from "next/link";
import Brand from "@/components/brand";
import SignupForm from "@/components/signup-form";

export default function SignupPage() {
  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand size={44} tone="light" />
        <div>
          <div className="eyebrow" style={{ color: "#D4A373" }}>
            Start your journey
          </div>
          <h1>Tell us who is travelling.</h1>
          <p>Your phone number identifies your bookings across every trip.</p>
        </div>
        <small style={{ color: "#D4A373", fontSize: "11px" }}>© 2026 Payana Trails</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Brand size={36} />
          <h2>Create your account.</h2>
          <p>
            Your phone number must match the one your trip coordinator holds. After registering you
            sign in with that number and a PIN made from its last four digits.
          </p>
          <SignupForm />
          <div className="auth-switch">
            Already registered? <Link href="/login">Log in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}