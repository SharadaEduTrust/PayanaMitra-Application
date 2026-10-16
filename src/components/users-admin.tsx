"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: "traveller" | "leader" | "admin";
  isActive: boolean;
  mustChangePassword: boolean;
  dateOfJoining: string | null;
  location: string | null;
  remarks: string | null;
  lastActiveAt: string | null;
  foodPreference: string | null;
  emergencyContact: string | null;
};

const blank = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  password: "",
  role: "traveller" as UserRow["role"],
  location: "",
  remarks: "",
};

export default function UsersAdmin({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [draft, setDraft] = useState(blank);
  const [query, setQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        `${row.firstName} ${row.lastName}`.toLowerCase().includes(term) ||
        row.phone.includes(term) ||
        (row.email ?? "").toLowerCase().includes(term),
    );
  }, [rows, query]);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, mustChangePassword: true }),
    });

    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? "Could not create that account.");
      return;
    }

    setStatus("Account created. They must change this password on first sign in.");
    setDraft(blank);
    router.refresh();
  }

  async function updateUser(id: string, patch: Record<string, unknown>, message: string) {
    setError("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Update failed.");
      return;
    }

    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } as UserRow : row)));
    setStatus(message);
    router.refresh();
  }

  async function resetPassword(row: UserRow) {
    const password = window.prompt(`Temporary password for ${row.firstName} ${row.lastName} (min 8 characters):`);
    if (!password) return;
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, newPassword: password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not reset the password.");
      return;
    }

    setStatus(`Password reset for ${row.firstName}. They must change it at next sign in.`);
    router.refresh();
  }

  return (
    <>
      <section className="admin-card">
        <div className="admin-card-head">
          <h2 className="serif">Accounts</h2>
          <input
            className="admin-search"
            placeholder="Search name, phone or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="panel-note">No accounts match that search.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Travel details</th>
                <th>Last active</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>
                      {row.firstName} {row.lastName}
                    </strong>
                    {row.email && <div className="muted small">{row.email}</div>}
                  </td>
                  <td className="mono">{row.phone}</td>
                  <td style={{ textTransform: "capitalize" }}>{row.role}</td>
                  <td className="muted small">
                    {row.foodPreference ? `${row.foodPreference.replace("_", " ")}` : "—"}
                    {row.emergencyContact ? ` · ${row.emergencyContact}` : ""}
                  </td>
                  <td>
                    {row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleDateString("en-IN") : "Never"}
                  </td>
                  <td>
                    <span className={`pill ${row.isActive ? "on" : "off"}`}>
                      {row.isActive ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button className="link-btn" onClick={() => resetPassword(row)}>
                      Reset password
                    </button>
                    <button className="link-btn" onClick={() => updateUser(row.id, { is_active: !row.isActive }, row.isActive ? "Account suspended." : "Account restored.")}>
                      {row.isActive ? "Suspend" : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-card">
        <h2 className="serif">New account</h2>
        <p className="admin-hint">
          Creates a sign-in immediately with a temporary password. The traveller is forced to change
          it the first time they sign in.
        </p>

        <form onSubmit={createUser}>
          <div className="field-row">
            <label className="form-field">
              First name
              <input required value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
            </label>
            <label className="form-field">
              Last name
              <input required value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
            </label>
          </div>

          <div className="field-row">
            <label className="form-field">
              Phone number
              <input required type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="98765 43210" />
            </label>
            <label className="form-field">
              Email
              <input required type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </label>
          </div>

          <div className="field-row">
            <label className="form-field">
              Temporary password
              <span className="password-input">
                <input
                  required
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            <label className="form-field">
              Role
              <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRow["role"] })}>
                <option value="traveller">Traveller</option>
                <option value="leader">Trail leader</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
          </div>

          <div className="field-row">
            <label className="form-field">
              Home city
              <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </label>
            <label className="form-field">
              Remarks
              <input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} />
            </label>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {status && <p className="form-notice" role="status">{status}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
      </section>
    </>
  );
}