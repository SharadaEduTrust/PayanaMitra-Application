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
          <p>Sign in with the phone number your trip coordinator registered.</p>
        </div>
        <small style={{ color: "#D4A373", fontSize: "11px" }}>© 2026 Payana Trails</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Brand size={36} />
          <h2>Welcome back.</h2>
          <p>Enter your phone number and the last four digits of it as your PIN.</p>
          <PinForm />
          <div className="auth-switch">
            No account yet? <Link href="/signup">Register first</Link>
          </div>
          <p className="auth-note">
            Trip coordinator? <Link href="/admin/login">Administrator sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}