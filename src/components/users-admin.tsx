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
  referralName?: string | null;
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
  passportIssueDate?: string | null;
  pan?: string | null;
  passportNo?: string | null;
  passportExpiry?: string | null;
  visaNo?: string | null;
  visaExpiry?: string | null;
  visaCountry?: string | null;
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
  referralName: "",
  location: "",
  remarks: "",
};

type SortField =
  | "name"
  | "role"
  | "leaderName"
  | "referralName"
  | "location"
  | "email"
  | "isActive"
  | "lastActiveAt"
  | "phone";

type SortOrder = "asc" | "desc";

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

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Edit modal state
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "traveller" as UserRow["role"],
    leaderId: "",
    referralName: "",
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
    passportIssueDate: "",
    pan: "",
    passportNo: "",
    passportExpiry: "",
    visaNo: "",
    visaExpiry: "",
    visaCountry: "",
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
        (row.email ?? "").toLowerCase().includes(term) ||
        (row.location ?? "").toLowerCase().includes(term) ||
        (row.leaderName ?? "").toLowerCase().includes(term) ||
        (row.referralName ?? "").toLowerCase().includes(term);

      const matchesRole = roleFilter === "all" || row.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && row.isActive) ||
        (statusFilter === "suspended" && !row.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [rows, query, roleFilter, statusFilter]);

  const sortedRows = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name": {
          const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case "role": {
          const roleOrder: Record<string, number> = { traveller: 1, leader: 2, admin: 3 };
          comparison = (roleOrder[a.role] ?? 0) - (roleOrder[b.role] ?? 0);
          break;
        }
        case "leaderName": {
          const lA = (a.leaderName ?? "").trim().toLowerCase();
          const lB = (b.leaderName ?? "").trim().toLowerCase();
          comparison = lA.localeCompare(lB);
          break;
        }
        case "referralName": {
          const rA = (a.referralName ?? "").trim().toLowerCase();
          const rB = (b.referralName ?? "").trim().toLowerCase();
          comparison = rA.localeCompare(rB);
          break;
        }
        case "location": {
          const locA = (a.location ?? "").trim().toLowerCase();
          const locB = (b.location ?? "").trim().toLowerCase();
          comparison = locA.localeCompare(locB);
          break;
        }
        case "email": {
          const emA = (a.email ?? "").trim().toLowerCase();
          const emB = (b.email ?? "").trim().toLowerCase();
          comparison = emA.localeCompare(emB);
          break;
        }
        case "isActive": {
          comparison = (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1);
          break;
        }
        case "lastActiveAt": {
          const tA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
          const tB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
          comparison = tA - tB;
          break;
        }
        case "phone": {
          comparison = a.phone.localeCompare(b.phone);
          break;
        }
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filtered, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }

  function renderSortHeader(label: string, field: SortField) {
    const isSorted = sortField === field;
    return (
      <th
        onClick={() => toggleSort(field)}
        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
        title={`Sort by ${label} (${isSorted ? (sortOrder === "asc" ? "Descending" : "Ascending") : "Ascending"})`}
        aria-sort={isSorted ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          {label}
          <span style={{ fontSize: "11px", color: isSorted ? "var(--forest, #2d5a27)" : "var(--color-muted, #94a3b8)", opacity: isSorted ? 1 : 0.4 }}>
            {isSorted ? (sortOrder === "asc" ? "▲" : "▼") : "⇅"}
          </span>
        </span>
      </th>
    );
  }

  function startEdit(user: UserRow) {
    setEditingUser(user);
    const emergencyParts = (user.emergencyContact ?? "").split(" · ");
    setEditForm({      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email ?? "",
      role: user.role,
      leaderId: user.leaderId ?? "",
      referralName: user.referralName ?? "",
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
      passportIssueDate: user.passportIssueDate ?? "",
      pan: user.pan ?? "",
      passportNo: user.passportNo ?? "",
      passportExpiry: user.passportExpiry ?? "",
      visaNo: user.visaNo ?? "",
      visaExpiry: user.visaExpiry ?? "",
      visaCountry: user.visaCountry ?? "",
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
          referral_name: editForm.referralName.trim() || null,
          email: editForm.email.trim() || null,
          location: editForm.location.trim() || null,
          remarks: editForm.remarks.trim() || null,
          dob: editForm.dob || null,
          food_preference: editForm.foodPreference || null,
          food_allergy: editForm.foodAllergy.trim() || null,
          emergencyContactName: editForm.emergencyContactName.trim() || null,
          emergencyContactNo: editForm.emergencyContactNo.trim() || null,
          travelInsuranceNo: editForm.travelInsuranceNo.trim() || null,
          insuranceCompany: editForm.insuranceCompany.trim() || null,
          insuranceExpiry: editForm.insuranceExpiry || null,
          passportIssuedLocation: editForm.passportIssuedLocation.trim() || null,
          passport_issue_date: editForm.passportIssueDate || null,
          pan: editForm.pan.trim().toUpperCase() || null,
          passportNo: editForm.passportNo.trim().toUpperCase() || null,
          passportExpiry: editForm.passportExpiry || null,
          visa_no: editForm.visaNo.trim().toUpperCase() || null,
          visa_expiry: editForm.visaExpiry || null,
          visa_country: editForm.visaCountry.trim() || null,
        }),
      });

      const data = await response.json().catch(() => null);
      setLoading(false);

      if (!response.ok) {
        if (data?.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
          const detailed = Object.entries(data.fieldErrors)
            .map(([field, msgs]) => {
              const fieldName = field.replace(/_/g, " ");
              const errList = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
              return `${fieldName}: ${errList}`;
            })
            .join(" | ");
          setError(detailed || data?.error || "Could not update user.");
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
                referralName: editForm.referralName.trim() || null,
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
                passportIssueDate: editForm.passportIssueDate || null,
                pan: editForm.pan.trim().toUpperCase() || null,
                passportNo: editForm.passportNo.trim().toUpperCase() || null,
                passportExpiry: editForm.passportExpiry || null,
                visaNo: editForm.visaNo.trim().toUpperCase() || null,
                visaExpiry: editForm.visaExpiry || null,
                visaCountry: editForm.visaCountry.trim() || null,
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

    const cleanPhone = draft.phone.trim().replace(/[\s\-\(\)]/g, "");
    if (cleanPhone.replace(/^\+/, "").length < 10) {
      setError("Mobile number must be at least 10 digits (e.g. 9876543210 or +919876543210).");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          first_name: draft.firstName.trim(),
          last_name: draft.lastName.trim(),
          role: draft.role,
          leader_id: draft.leaderId || null,
          referral_name: draft.referralName.trim() || null,
          email: draft.email.trim() || null,
          location: draft.location.trim() || null,
          remarks: draft.remarks.trim() || null,
        }),
      });

      const data = await response.json().catch(() => null);
      setLoading(false);

      if (!response.ok) {
        if (data?.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
          const detailed = Object.entries(data.fieldErrors)
            .map(([field, msgs]) => {
              const fieldName = field.replace(/_/g, " ");
              const errList = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
              return `${fieldName}: ${errList}`;
            })
            .join(" | ");
          setError(detailed || data?.error || "Could not create that account.");
        } else {
          setError(data?.error ?? "Could not create that account.");
        }
        return;
      }

      setStatus(`Account created. Initial PIN is the last 4 digits of their phone (${cleanPhone.slice(-4)}).`);
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
            {/* Search Input with Magnifying Glass */}
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: "absolute",
                  left: "12px",
                  color: "var(--color-muted, #94a3b8)",
                  pointerEvents: "none",
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="admin-search"
                placeholder="Search name, phone, email, city…"
                value={query}
                style={{ paddingLeft: "36px", paddingRight: query ? "30px" : "12px", minWidth: "240px" }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                  style={{
                    position: "absolute",
                    right: "8px",
                    background: "none",
                    border: "none",
                    color: "var(--color-muted, #94a3b8)",
                    cursor: "pointer",
                    padding: "2px 6px",
                    fontSize: "14px",
                    lineHeight: 1,
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Key Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="muted small" style={{ whiteSpace: "nowrap" }}>Sort by:</span>
              <select
                value={sortField}
                onChange={(e) => {
                  setSortField(e.target.value as SortField);
                  setPage(1);
                }}
                style={{ padding: "6px 12px", borderRadius: "6px" }}
                aria-label="Sort by field"
              >
                <option value="name">Names</option>
                <option value="role">Role</option>
                <option value="leaderName">Leader Name</option>
                <option value="referralName">Referral</option>
                <option value="location">Location</option>
                <option value="email">email id</option>
                <option value="isActive">Active / Inactive</option>
                <option value="lastActiveAt">Date Last Active</option>
                <option value="phone">Mobile Number</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                style={{ padding: "6px 10px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                title={`Sort ${sortOrder === "asc" ? "Ascending" : "Descending"} (Click to flip)`}
              >
                {sortOrder === "asc" ? "▲ Asc" : "▼ Desc"}
              </button>
            </div>

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
                  Upload a UTF-8 CSV with columns: <code>Mobile Number</code>, <code>First Name</code>, <code>Last Name</code>, <code>Role</code>, <code>Leader Name</code>, <code>Date of Joining</code>, <code>Location</code>, <code>email id</code>, <code>Referral&apos;s Name</code>. (Active status is automatically set in the backend).
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
                  {renderSortHeader("User Id / Mobile Number", "phone")}
                  {renderSortHeader("First Name", "name")}
                  <th>Last Name</th>
                  {renderSortHeader("Role", "role")}
                  {renderSortHeader("Leader Name", "leaderName")}
                  {renderSortHeader("Referral", "referralName")}
                  {renderSortHeader("Location", "location")}
                  {renderSortHeader("email id", "email")}
                  {renderSortHeader("Active / Inactive", "isActive")}
                  {renderSortHeader("Date Last Active", "lastActiveAt")}
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
                    <td>{row.referralName || "—"}</td>
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
                Referral&apos;s Name
                <input
                  value={editForm.referralName}
                  maxLength={100}
                  onChange={(e) => setEditForm({ ...editForm, referralName: e.target.value })}
                  placeholder="e.g. Ramesh Bhat"
                />
              </label>
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
                Passport Issue Date
                <input
                  type="date"
                  value={editForm.passportIssueDate}
                  onChange={(e) => setEditForm({ ...editForm, passportIssueDate: e.target.value })}
                />
              </label>
              <label className="form-field">
                Passport Expiry Date
                <input
                  type="date"
                  value={editForm.passportExpiry}
                  onChange={(e) => setEditForm({ ...editForm, passportExpiry: e.target.value })}
                />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Passport Issued Location
                <input
                  value={editForm.passportIssuedLocation}
                  maxLength={50}
                  onChange={(e) => setEditForm({ ...editForm, passportIssuedLocation: e.target.value })}
                  placeholder="e.g. Bangalore"
                />
              </label>
              <label className="form-field">
                Visa No.
                <input
                  value={editForm.visaNo}
                  maxLength={10}
                  onChange={(e) => setEditForm({ ...editForm, visaNo: e.target.value.toUpperCase() })}
                  placeholder="10 characters (e.g. V123456789)"
                />
              </label>
            </div>

            <div className="field-row">
              <label className="form-field">
                Visa Expiry Date
                <input
                  type="date"
                  value={editForm.visaExpiry}
                  onChange={(e) => setEditForm({ ...editForm, visaExpiry: e.target.value })}
                />
              </label>
              <label className="form-field">
                Country (Visa)
                <input
                  value={editForm.visaCountry}
                  maxLength={50}
                  onChange={(e) => setEditForm({ ...editForm, visaCountry: e.target.value })}
                  placeholder="e.g. Singapore"
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
              <input required type="tel" minLength={10} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="98765 43210 (Used as User Id)" />
            </label>
            <label className="form-field">
              email id (Optional)
              <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
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
              Referral&apos;s Name (Optional)
              <input
                value={draft.referralName}
                maxLength={100}
                onChange={(e) => setDraft({ ...draft, referralName: e.target.value })}
                placeholder="e.g. Ramesh Bhat"
              />
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