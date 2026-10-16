import Link from "next/link";
import Brand from "@/components/brand";
import AdminLoginForm from "@/components/admin-login-form";

export const metadata = { title: "Admin sign in — Payana Mitra" };

export default function AdminLoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand size={44} tone="light" />
        <div>
          <div className="eyebrow" style={{ color: "#D4A373" }}>
            Restricted access
          </div>
          <h1>Manage travellers, trips and itineraries.</h1>
          <p>Everything a coordinator needs to publish a trip and support the people on it.</p>
        </div>
        <small style={{ color: "#D4A373", fontSize: "11px" }}>© 2026 Payana Trails</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Brand size={36} />
          <h2>Administrator sign in.</h2>
          <p>
            Use the phone number registered to your admin account, with the last four digits as your
            PIN.
          </p>
          <AdminLoginForm />
          <div className="auth-switch">
            Traveller? <Link href="/login">Go to traveller sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}