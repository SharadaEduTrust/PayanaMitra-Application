import { redirect } from "next/navigation";

export const metadata = { title: "Password change not required — Payana Mitra" };

/**
 * Forced password changes have been retired in favor of universal phone-suffix PIN login.
 * Users visiting this route are automatically redirected to the dashboard.
 */
export default function ChangePasswordPage() {
  redirect("/dashboard");
}