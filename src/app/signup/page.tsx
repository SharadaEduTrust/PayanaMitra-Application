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
          <h1>Tell us who is joining.</h1>
          <p>Your phone number identifies your bookings across every trail.</p>
        </div>
        <small style={{ color: "#D4A373", fontSize: "11px" }}>© 2026 Payana Trails</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Brand size={36} />
          <h2>Create your account.</h2>
          <p>
            Your phone number identifies your account. The system automatically allocates the last four digits
            of your phone number as your initial password, which you can change later.
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