import Link from "next/link";
import { redirect } from "next/navigation";
import Brand from "@/components/brand";
import ChangePasswordForm from "@/components/change-password-form";
import { getSession } from "@/lib/server/auth";

export const metadata = { title: "Change Password — Payana Mitra" };

export default async function ChangePasswordPage() {
  const profile = await getSession();
  if (!profile) {
    redirect("/login");
  }

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand size={44} tone="light" />
        <div>
          <div className="eyebrow" style={{ color: "#D4A373" }}>
            Account Security
          </div>
          <h1>Update your password.</h1>
          <p>
            The system initially allocated the last 4 digits of your phone number as your password.
            You can customize it anytime.
          </p>
        </div>
        <small style={{ color: "#D4A373", fontSize: "11px" }}>© 2026 Payana Trails</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Brand size={36} />
          <h2>Change your password</h2>
          <p>
            Enter your current password (initially the last 4 digits of your phone) and choose your new password.
          </p>
          <ChangePasswordForm />
          <div className="auth-switch" style={{ marginTop: "24px" }}>
            Return to <Link href="/dashboard/profile">My Profile</Link>
          </div>
        </div>
      </section>
    </main>
  );
}