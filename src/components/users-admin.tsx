"use client";

import { useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

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
  leaderId?: string | null;
  leaderName?: string | null;
  dob?: string | null;
  foodAllergy?: string | null;
  emergencyContactName?: string | null;
  emergencyContactNo?: string | null;
  travelInsuranceNo?: string | null;
  insuranceCompany?: string | null;
  insuranceExpiry?: string | null;
  passportIssuedLocation?: string | null;
  pan?: string | null;
  passportNo?: string | null;
  passportExpiry?: string | null;
};

type LeaderOption = {
  id: string;
  first_name: string;
  last_name: string;
};

const blank = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  role: "traveller" as UserRow["role"],
  leaderId: "",
  location: "",
  remarks: "",
};

export default function UsersAdmin({
  users,
  leaders = [],
}: {
  users: UserRow[];
  leaders?: LeaderOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [draft, setDraft] = useState(blank);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "traveller" as UserRow["role"],
    leaderId: "",
    location: "",
    remarks: "",
    dob: "",
    foodPreference: "",
    foodAllergy: "",
    emergencyContactName: "",
    emergencyContactNo: "",
    travelInsuranceNo: "",
    insuranceCompany: "",
    insuranceExpiry: "",
    passportIssuedLocation: "",
    pan: "",
    passportNo: "",
    passportExpiry: "",
  });

  // CSV import modal state
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{
    created: number;
    skipped: number;
    errorCount?: number;
    results?: Array<{ row: number; phone: string; status: string; error?: string }>;
  } | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !term ||
        `${row.firstName} ${row.lastName}`.toLowerCase().includes(term) ||
        row.phone.includes(term) ||
        (row.email ?? "").toLowerCase().includes(term);

      const matchesRole = roleFilter === "all" || row.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && row.isActive) ||
        (statusFilter === "suspended" && !row.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [rows, query, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function startEdit(user: UserRow) {
    setEditingUser(user);
    const emergencyParts = (user.emergencyContact ?? "").split(" · ");
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email ?? "",
      role: user.role,
      leaderId: user.leaderId ?? "",
      location: user.location ?? "",
      remarks: user.remarks ?? "",
      dob: user.dob ?? "",
      foodPreference: user.foodPreference ?? "",
      foodAllergy: user.foodAllergy ?? "",
      emergencyContactName: user.emergencyContactName ?? emergencyParts[0] ?? "",
      emergencyContactNo: user.emergencyContactNo ?? emergencyParts[1] ?? "",
      travelInsuranceNo: user.travelInsuranceNo ?? "",
      insuranceCompany: user.insuranceCompany ?? "",
      insuranceExpiry: user.insuranceExpiry ?? "",
      passportIssuedLocation: user.passportIssuedLocation ?? "",
      pan: user.pan ?? "",
      passportNo: user.passportNo ?? "",
      passportExpiry: user.passportExpiry ?? "",
    });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setError("");
    setStatus("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser.id,
          first_name: editForm.firstName.trim(),
          last_name: editForm.lastName.trim(),
          role: editForm.role,
          leader_id: editForm.leaderId || null,
          email: editForm.email.trim() || null,
          location: editForm.location.trim() || null,
          remarks: editForm.remarks.trim() || null,
          dob: editForm.dob || null,
          food_preference: editForm.foodPreference || null,
          food_allergy: editForm.foodAllergy.trim() || null,
          emergency_contact_name: editForm.emergencyContactName.trim() || null,
          emergency_contact_no: editForm.emergencyContactNo.trim() || null,
          travel_insurance_no: editForm.travelInsuranceNo.trim() || null,
          insurance_company: editForm.insuranceCompany.trim() || null,
          insurance_expiry: editForm.insuranceExpiry || null,
          passport_issued_location: editForm.passportIssuedLocation.trim() || null,
          pan: editForm.pan.trim().toUpperCase() || null,
          passport_no: editForm.passportNo.trim().toUpperCase() || null,
          passport_expiry: editForm.passportExpiry || null,
        }),
      });

      const data = await response.json().catch(() => null);
      setLoading(false);

      if (!response.ok) {
        if (data?.fieldErrors) {
          const firstErr = Object.values(data.fieldErrors).flat()[0];
          setError(String(firstErr || data?.error || "Could not update user."));
        } else {
          setError(data?.error ?? "Could not update user.");
        }
        return;
      }

      const assignedLeader = leaders.find((l) => l.id === editForm.leaderId);
      const assignedLeaderName = assignedLeader
        ? `${assignedLeader.first_name} ${assignedLeader.last_name}`.trim()
        : null;

      setRows((current) =>
        current.map((r) =>
          r.id === editingUser.id
            ? {
                ...r,
                firstName: editForm.firstName.trim(),
                lastName: editForm.lastName.trim(),
                email: editForm.email.trim() || null,
                role: editForm.role,
                leaderId: editForm.leaderId || null,
                leaderName: assignedLeaderName,
                location: editForm.location.trim() || null,
                remarks: editForm.remarks.trim() || null,
                dob: editForm.dob || null,
                foodPreference: editForm.foodPreference || null,
                foodAllergy: editForm.foodAllergy.trim() || null,
                emergencyContactName: editForm.emergencyContactName.trim() || null,
                emergencyContactNo: editForm.emergencyContactNo.trim() || null,
                emergencyContact:
                  editForm.emergencyContactName.trim() && editForm.emergencyContactNo.trim()
                    ? `${editForm.emergencyContactName.trim()} · ${editForm.emergencyContactNo.trim()}`
                    : r.emergencyContact,
                travelInsuranceNo: editForm.travelInsuranceNo.trim() || null,
                insuranceCompany: editForm.insuranceCompany.trim() || null,
                insuranceExpiry: editForm.insuranceExpiry || null,
                passportIssuedLocation: editForm.passportIssuedLocation.trim() || null,
                pan: editForm.pan.trim().toUpperCase() || null,
                passportNo: editForm.passportNo.trim().toUpperCase() || null,
                passportExpiry: editForm.passportExpiry || null,
              }
            : r,
        ),
      );

      setStatus(`Updated account for ${editForm.firstName}.`);
      setEditingUser(null);
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error while updating user.");
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: draft.phone.trim(),
          first_name: draft.firstName.trim(),
          last_name: draft.lastName.trim(),
          role: draft.role,
          leader_id: draft.leaderId || null,
          email: draft.email.trim() || null,
          location: draft.location.trim() || null,
          remarks: draft.remarks.trim() || null,
        }),
      });

      const data = await response.json().catch(() => null);
      setLoading(false);

      if (!response.ok) {
        if (data?.fieldErrors) {
          const firstErr = Object.values(data.fieldErrors).flat()[0];
          setError(String(firstErr || data?.error || "Could not create that account."));
        } else {
          setError(data?.error ?? "Could not create that account.");
        }
        return;
      }

      setStatus(`Account created. Initial PIN is the last 4 digits of their phone (${draft.phone.trim().slice(-4)}).`);
      setDraft(blank);
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error while creating account.");
    }
  }

  async function updateUser(id: string, patch: Record<string, unknown>, message: string) {
    setError("");
    try {
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

      setRows((current) =>
        current.map((row) =>
          row.id === id
            ? ({
                ...row,
                ...patch,
                isActive: patch.is_active !== undefined ? Boolean(patch.is_active) : row.isActive,
              } as UserRow)
            : row,
        ),
      );
      setStatus(message);
      router.refresh();
    } catch {
      setError("Network error while updating user.");
    }
  }

  async function resetPassword(row: UserRow) {
    if (!window.confirm(`Reset password for ${row.firstName} ${row.lastName}? Their password will be reset to the last 4 digits of their phone (${row.phone.slice(-4)}).`)) {
      return;
    }
    setError("");
    setStatus("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, reset_pin: true, reset_password: true }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Could not reset the password.");
        return;
      }

      setStatus(`Password reset for ${row.firstName}. Their password has been reset to the last 4 digits of their phone (${row.phone.slice(-4)}).`);
      router.refresh();
    } catch {
      setError("Network error while resetting password.");
    }
  }

  async function handleCsvUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportReport(null);
    setError("");
    setStatus("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setImporting(false);

      if (!res.ok) {
        setError(json?.error ?? "Failed to process CSV import.");
        return;
      }

      setImportReport(json);
      setStatus(`Guest CSV import complete: ${json.created} created, ${json.skipped} skipped.`);
      router.refresh();
    } catch {
      setImporting(false);
      setError("Network error while importing guests CSV.");
    }
  }

  return (
    <>
      <section className="admin-card">
        <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "12px" }}>
          <h2 className="serif">Accounts</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="admin-search"
              placeholder="Search name, phone or email"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: "6px 12px", borderRadius: "6px" }}
            >
              <option value="all">All roles</option>
              <option value="traveller">Guest</option>
              <option value="leader">Trail leader</option>
              <option value="admin">Administrator</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{ padding: "6px 12px", borderRadius: "6px" }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowImport(!showImport)}
            >
              {showImport ? "Close CSV Import" : "Import Guests (CSV)"}
            </button>
          </div>
        </div>

        {showImport && (
          <div style={{ margin: "16px 0", padding: "18px", background: "var(--color-surface, #1e293b)", borderRadius: "8px", border: "1px dashed var(--color-border, #334155)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 className="serif" style={{ margin: 0, fontSize: "1.15rem" }}>Bulk Import Guests (CSV)</h3>
                <p className="admin-hint" style={{ margin: "4px 0 0" }}>
                  Upload a UTF-8 CSV with columns: <code>User Id</code>, <code>First Name</code>, <code>Last Name</code>, <code>Role</code>, <code>Leader Name</code>, <code>Date of Joining</code>, <code>Active / Inactive</code>, <code>Location</code>, <code>email id</code>, <code>Mobile Number</code>.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <a
                  href="/api/admin/users/import?template=users"
                  download="users_import_template.csv"
                  className="link-btn"
                  style={{ fontWeight: 600 }}
                >
                  Download User Table Template
                </a>
                <a
                  href="/api/admin/users/import?template=guest_details"
                  download="guest_details_import_template.csv"
                  className="link-btn"
                  style={{ fontWeight: 600 }}
                >
                  Download Guest Details Template
                </a>
              </div>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              disabled={importing}
              style={{ marginTop: "8px" }}
            />
            {importing && <p className="muted small" style={{ marginTop: "8px" }}>Processing CSV import batch…</p>}
            {importReport && (
              <div style={{ marginTop: "14px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "6px" }}>
                <strong>Import Results:</strong> Created: {importReport.created} · Skipped (duplicates): {importReport.skipped}
                {importReport.results && importReport.results.some((r) => r.status === "error") && (
                  <div style={{ marginTop: "8px", color: "var(--color-danger, #ef4444)" }}>
                    <strong>Errors:</strong>
                    {importReport.results
                      .filter((r) => r.status === "error")
                      .map((err, i) => (
                        <div key={i} className="small">
                          Row {err.row} ({err.phone}): {err.error}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="panel-note">No accounts match that filter.</p>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User Id / Mobile Number</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Role</th>
                  <th>Leader Name</th>
                  <th>Location</th>
                  <th>email id</th>
                  <th>Active / Inactive</th>
                  <th>Date Last Active</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.phone}</td>
                    <td>
                      <strong>{row.firstName}</strong>
                    </td>
                    <td>
                      <strong>{row.lastName}</strong>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{row.role === "traveller" ? "Guest" : row.role === "leader" ? "Trail leader" : "Admin"}</td>
                    <td>{row.leaderName || "—"}</td>
                    <td>{row.location || "—"}</td>
                    <td className="small">{row.email || "—"}</td>
                    <td>
                      <span className={`pill ${row.isActive ? "on" : "off"}`}>
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="small muted">
                      {row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleDateString("en-IN") : "Never"}
                    </td>
                    <td className="row-actions">
                      <button className="link-btn" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button className="link-btn" onClick={() => resetPassword(row)}>
                        Reset Password
                      </button>
                      <button className="link-btn" onClick={() => updateUser(row.id, { is_active: !row.isActive }, row.isActive ? "Account suspended." : "Account restored.")}>
                        {row.isActive ? "Suspend" : "Restore"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span className="muted small">
                  Page {page} of {totalPages} ({filtered.length} total)
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Edit User Modal */}
      {editingUser && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <form className="admin-card" onSubmit={saveEdit} style={{ maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="admin-card-head">
              <h2 className="serif">Edit {editingUser.firstName} {editingUser.lastName}</h2>
              <button type="button" className="link-btn" onClick={() => setEditingUser(null)}>✕ Cancel</button>
            </div>

            <div className="field-row">
              <label className="form-field">
                First Name
                <input required value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </label>
              <label className="form-field">
                Last Name
                <input required value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Mobile Number (User Id)
                <input disabled value={editingUser.phone} className="muted mono" />
              </label>
              <label className="form-field">
                email id
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Role
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRow["role"] })}>
                  <option value="traveller">Guest</option>
                  <option value="leader">Trail leader</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label className="form-field">
                Leader Name
                <select value={editForm.leaderId} onChange={(e) => setEditForm({ ...editForm, leaderId: e.target.value })}>
                  <option value="">No leader assigned</option>
                  {leaders.map((ldr) => (
                    <option key={ldr.id} value={ldr.id}>
                      {ldr.first_name} {ldr.last_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Location
                <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
              </label>
              <label className="form-field">
                Date of Birth
                <input type="date" value={editForm.dob} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                PAN
                <input
                  value={editForm.pan}
                  maxLength={10}
                  onChange={(e) => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })}
                  placeholder="10 characters (e.g. AAADK9754A)"
                />
              </label>
              <label className="form-field">
                Passport No.
                <input
                  value={editForm.passportNo}
                  maxLength={10}
                  onChange={(e) => setEditForm({ ...editForm, passportNo: e.target.value.toUpperCase() })}
                  placeholder="10 characters (e.g. ZA495775)"
                />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Passport Expiry Date
                <input
                  type="date"
                  value={editForm.passportExpiry}
                  onChange={(e) => setEditForm({ ...editForm, passportExpiry: e.target.value })}
                />
              </label>
              <label className="form-field">
                Passport Issued Location
                <input
                  value={editForm.passportIssuedLocation}
                  maxLength={20}
                  onChange={(e) => setEditForm({ ...editForm, passportIssuedLocation: e.target.value })}
                  placeholder="e.g. Bangalore"
                />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Travel Insurance No.
                <input
                  value={editForm.travelInsuranceNo}
                  maxLength={20}
                  onChange={(e) => setEditForm({ ...editForm, travelInsuranceNo: e.target.value })}
                  placeholder="e.g. 7103167389"
                />
              </label>
              <label className="form-field">
                Travel Insurance Company
                <input
                  value={editForm.insuranceCompany}
                  maxLength={20}
                  onChange={(e) => setEditForm({ ...editForm, insuranceCompany: e.target.value })}
                  placeholder="e.g. TATA AIG"
                />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Travel Insurance Expiry Date
                <input
                  type="date"
                  value={editForm.insuranceExpiry}
                  onChange={(e) => setEditForm({ ...editForm, insuranceExpiry: e.target.value })}
                />
              </label>
              <label className="form-field">
                Food Preference
                <select value={editForm.foodPreference} onChange={(e) => setEditForm({ ...editForm, foodPreference: e.target.value })}>
                  <option value="">None selected</option>
                  <option value="veg">Veg</option>
                  <option value="non_veg">Non Veg</option>
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Food Allergy
                <input
                  value={editForm.foodAllergy}
                  maxLength={30}
                  onChange={(e) => setEditForm({ ...editForm, foodAllergy: e.target.value })}
                  placeholder="e.g. Peanuts and Milk"
                />
              </label>
              <label className="form-field">
                Emergency Contact Name
                <input
                  value={editForm.emergencyContactName}
                  maxLength={20}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                  placeholder="e.g. Anita Kamath"
                />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Emergency Contact Number
                <input
                  type="tel"
                  value={editForm.emergencyContactNo}
                  maxLength={10}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContactNo: e.target.value.replace(/\D/g, "") })}
                  placeholder="10 digits (e.g. 9019911700)"
                />
              </label>
            </div>

            <label className="form-field">
              Remarks
              <textarea rows={2} value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} />
            </label>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Saving…" : "Save changes"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setEditingUser(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Account Form */}
      <section className="admin-card">
        <h2 className="serif">New account</h2>
        <p className="admin-hint">
          Creates an account immediately with an initial PIN (last 4 digits of their phone number).
          The user is required to set a new PIN on first sign in.
        </p>

        <form onSubmit={createUser}>
          <div className="field-row">
            <label className="form-field">
              First Name
              <input required value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
            </label>
            <label className="form-field">
              Last Name
              <input required value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
            </label>
          </div>

          <div className="field-row">
            <label className="form-field">
              Mobile Number
              <input required type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="98765 43210 (Used as User Id)" />
            </label>
            <label className="form-field">
              email id
              <input required type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </label>
          </div>

          <div className="field-row">
            <label className="form-field">
              Initial Password / PIN
              <input
                readOnly
                disabled
                value={draft.phone.trim().length >= 4 ? `Last 4 digits (${draft.phone.trim().slice(-4)})` : "Auto-set to last 4 digits of phone"}
                className="muted"
              />
            </label>
            <label className="form-field">
              Role
              <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRow["role"] })}>
                <option value="traveller">Guest</option>
                <option value="leader">Trail leader</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
          </div>

          <div className="field-row">
            <label className="form-field">
              Leader Name (Optional)
              <select value={draft.leaderId} onChange={(e) => setDraft({ ...draft, leaderId: e.target.value })}>
                <option value="">No leader assigned</option>
                {leaders.map((ldr) => (
                  <option key={ldr.id} value={ldr.id}>
                    {ldr.first_name} {ldr.last_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Location
              <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </label>
          </div>

          <label className="form-field">
            Remarks
            <input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} />
          </label>

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