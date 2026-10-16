import Link from "next/link";
import Brand from "@/components/brand";
import ChangePasswordForm from "@/components/change-password-form";

export const metadata = { title: "Set a new password — Payana Mitra" };

export default function ChangePasswordPage() {
  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand size={44} tone="light" />
        <div>
          <div className="eyebrow" style={{ color: "#D4A373" }}>
            Almost there
          </div>
          <h1>Choose a password only you know.</h1>
          <p>Your coordinator issued a temporary password. Replace it before you continue.</p>
        </div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Brand size={36} />
          <h2>Set a new password.</h2>
          <p>At least 8 characters. Avoid passwords you use elsewhere.</p>
          <ChangePasswordForm />
          <div className="auth-switch">
            <Link href="/dashboard">Back to my trips</Link>
          </div>
        </div>
      </section>
    </main>
  );
}