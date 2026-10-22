import Link from "next/link";
import Brand from "@/components/brand";
import PinForm from "@/components/pin-form";

export const metadata = { title: "Sign in — Payana Mitra" };

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand size={44} tone="light" />
        <div>
          <div className="eyebrow" style={{ color: "#D4A373" }}>
            Your journey awaits
          </div>
          <h1>Leave room for the places that stay with you.</h1>
          <p>Sign in with your registered phone number to access your account.</p>
        </div>
        <small style={{ color: "#D4A373", fontSize: "11px" }}>© 2026 Payana Trails</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Brand size={36} />
          <h2>Welcome back.</h2>
          <p>Sign in with your registered phone number and password.</p>
          <PinForm />
          <div className="auth-switch">
            No account yet? <Link href="/signup">Register first</Link>
          </div>
        </div>
      </section>
    </main>
  );
}