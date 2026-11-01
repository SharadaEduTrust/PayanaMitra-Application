import Brand from "@/components/brand";
import PinForm from "@/components/pin-form";
import { Clock } from "lucide-react";

export const metadata = { title: "Sign in — Payana Mitra" };

type Props = {
  searchParams?: Promise<{ timeout?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const isTimeout = resolvedParams?.timeout === "1" || resolvedParams?.timeout === "true";

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Brand size={88} tone="light" />
        <div>
          <div className="eyebrow" style={{ color: "#D4A373" }}>
            Your journey awaits
          </div>
          <h1>Leave room for the places that stay with you.</h1>
          <p>Sign in with your registered phone number to access your account as a guest or trail leader.</p>
        </div>
        <small style={{ color: "#D4A373", fontSize: "11px" }}>© 2026 Payana Mitra</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-card">
          <Brand size={72} />
          <h2>Welcome back.</h2>
          <p>Sign in with your registered phone number and password.</p>
          {isTimeout && (
            <div
              role="alert"
              style={{
                backgroundColor: "#FFF8F0",
                border: "1px solid var(--sun)",
                borderLeft: "4px solid var(--sun)",
                borderRadius: "8px",
                padding: "12px 14px",
                margin: "16px 0",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                color: "#4A3B2A",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              <Clock size={18} style={{ flexShrink: 0, marginTop: "2px", color: "var(--sun)" }} />
              <div>
                <strong>Session timed out</strong>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  You were inactive for more than 30 minutes. Please sign in again to continue.
                </p>
              </div>
            </div>
          )}
          <PinForm />
          <p className="auth-note" style={{ marginTop: "20px" }}>
            Sign in with your registered phone number and password to access your assigned trails and guests.
          </p>
        </div>
      </section>
    </main>
  );
}