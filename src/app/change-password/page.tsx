import Link from "next/link";
import { redirect } from "next/navigation";
import Brand from "@/components/brand";
import ChangePasswordForm from "@/components/change-password-form";
import { getSession } from "@/lib/server/auth";

export const metadata = { title: "Create New Password — Payana Mitra" };

type Props = {
  searchParams: Promise<{ from?: string }>;
};

export default async function ChangePasswordPage({ searchParams }: Props) {
  const profile = await getSession();
  if (!profile) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const from = resolvedParams?.from;
  const redirectTarget = from === "documents" ? "/dashboard/documents" : "/dashboard/profile";

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand size={44} tone="light" />
        <div>
          <div className="eyebrow" style={{ color: "#D4A373" }}>
            Account Security & Privacy
          </div>
          <h1>Protect your documents.</h1>
          <p>
            Default logins use the last 4 digits of your mobile number. Because other guests or fellow travellers may know your phone number, creating a unique, private password ensures sensitive documents like your PAN, Aadhar, and Passport remain strictly confidential.
          </p>
        </div>
        <small style={{ color: "#D4A373", fontSize: "11px" }}>© 2026 Payana Mitra</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Brand size={36} />
          <h2>Create a New Password</h2>
          <p>
            Enter your current password (initial password is the last 4 digits of your phone) and create a private password to ensure your documents cannot be accessed by others.
          </p>
          <ChangePasswordForm redirectTarget={redirectTarget} />
          <div className="auth-switch" style={{ marginTop: "24px" }}>
            Return to{" "}
            <Link href={redirectTarget}>
              {from === "documents" ? "My Documents" : "My Profile"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}