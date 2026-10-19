"use client";

import Link from "next/link";

/**
 * ChangePasswordForm is retired. Every user authenticates with their phone number
 * and the last four digits of that phone number.
 */
export default function ChangePasswordForm() {
  return (
    <div className="form-notice" role="status">
      <p>Password changes are not required. Your login PIN is permanently the last 4 digits of your phone number.</p>
      <div style={{ marginTop: "1rem" }}>
        <Link className="btn btn-primary" href="/dashboard">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}