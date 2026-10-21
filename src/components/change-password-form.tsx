"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setError(data?.error ?? "Failed to update password. Please check your current password.");
        setLoading(false);
        return;
      }

      setSuccess("Password updated successfully! Redirecting…");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/dashboard/profile");
        router.refresh();
      }, 1500);
    } catch {
      setError("Network error while updating password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="form-field">
        Current Password
        <p className="form-hint" style={{ marginTop: "2px", marginBottom: "4px" }}>
          Initial password is the last 4 digits of your phone number.
        </p>
        <span className="password-input">
          <input
            required
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowCurrent(!showCurrent)}
            aria-label={showCurrent ? "Hide password" : "Show password"}
          >
            {showCurrent ? "Hide" : "Show"}
          </button>
        </span>
      </label>

      <label className="form-field">
        New Password
        <p className="form-hint" style={{ marginTop: "2px", marginBottom: "4px" }}>
          At least 4 characters.
        </p>
        <span className="password-input">
          <input
            required
            minLength={4}
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowNew(!showNew)}
            aria-label={showNew ? "Hide password" : "Show password"}
          >
            {showNew ? "Hide" : "Show"}
          </button>
        </span>
      </label>

      <label className="form-field">
        Confirm New Password
        <span className="password-input">
          <input
            required
            minLength={4}
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowConfirm(!showConfirm)}
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? "Hide" : "Show"}
          </button>
        </span>
      </label>

      {error && (
        <p className="form-error" role="alert" style={{ marginTop: "12px" }}>
          {error}
        </p>
      )}

      {success && (
        <p className="form-notice" role="status" style={{ marginTop: "12px" }}>
          {success}
        </p>
      )}

      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "18px" }}>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Updating password…" : "Update Password"}
        </button>
        <Link className="btn btn-secondary" href="/dashboard/profile">
          Back to Profile
        </Link>
      </div>
    </form>
  );
}