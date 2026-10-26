"use client";

import { useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENT_TYPES, formatDocType } from "@/lib/documents";

type AdminDoc = {
  id: string;
  doc_type: string;
  doc_number: string | null;
  issued_date?: string | null;
  expiry_date: string | null;
  issued_country: string | null;
  file_name: string | null;
  download_url: string | null;
  created_at: string;
};

type TrailLeaderInfo = {
  trailName: string;
  leaderName: string;
};

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
  trailLeaders?: TrailLeaderInfo[] | null;
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
        (row.referralName ?? "").toLowerCase().includes(term) ||
        (row.trailLeaders ?? []).some((tl) => tl.trailName.toLowerCase().includes(term));

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
    const isFirst = field === "phone";
    return (
      <th
        onClick={() => toggleSort(field)}
        style={{
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
          paddingLeft: isFirst ? "18px" : undefined,
        }}
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

  // Document management modal for a user
  const [docsUser, setDocsUser] = useState<UserRow | null>(null);
  const [guestDocs, setGuestDocs] = useState<AdminDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docUploadLoading, setDocUploadLoading] = useState(false);
  const [docUploadError, setDocUploadError] = useState("");
  const [docUploadStatus, setDocUploadStatus] = useState("");

  // Document upload form state
  const [newDocType, setNewDocType] = useState("aadhar");
  const [newDocNumber, setNewDocNumber] = useState("");
  const [newIssuedDate, setNewIssuedDate] = useState("");
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [newIssuedPlace, setNewIssuedPlace] = useState("");
  const [newDocFile, setNewDocFile] = useState<File | null>(null);

  async function openDocsModal(user: UserRow) {
    setDocsUser(user);
    setGuestDocs([]);
    setDocsLoading(true);
    setDocUploadError("");
    setDocUploadStatus("");
    setNewDocType("aadhar");
    setNewDocNumber("");
    setNewIssuedDate("");
    setNewExpiryDate("");
    setNewIssuedPlace("");
    setNewDocFile(null);

    try {
      const res = await fetch(`/api/documents?user_id=${user.id}`);
      const json = await res.json().catch(() => ({ data: [] }));
      if (res.ok && json.data) {
        setGuestDocs(json.data);
      }
    } catch {
      setDocUploadError("Failed to fetch documents for this guest.");
    } finally {
      setDocsLoading(false);
    }
  }

  async function handleAdminUploadDoc(e: FormEvent) {
    e.preventDefault();
    if (!docsUser) return;
    if (!newDocNumber.trim()) {
      setDocUploadError("Document number is required.");
      return;
    }
    setDocUploadError("");
    setDocUploadStatus("");
    setDocUploadLoading(true);

    try {
      const formData = new FormData();
      formData.set("user_id", docsUser.id);
      formData.set("doc_type", newDocType);
      formData.set("doc_number", newDocNumber.trim());
      if (newIssuedDate) formData.set("issued_date", newIssuedDate);
      if (newExpiryDate) formData.set("expiry_date", newExpiryDate);
      if (newIssuedPlace.trim()) {
        formData.set("issued_country", newIssuedPlace.trim());
        formData.set("issued_place", newIssuedPlace.trim());
      }
      if (newDocFile) {
        formData.set("file", newDocFile);
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const json = await res.json().catch(() => null);
      setDocUploadLoading(false);

      if (!res.ok) {
        setDocUploadError(json?.error ?? "Failed to upload document.");
        return;
      }

      setDocUploadStatus("Document uploaded successfully.");
      setNewDocNumber("");
      setNewIssuedDate("");
      setNewExpiryDate("");
      setNewIssuedPlace("");
      setNewDocFile(null);

      // Refresh documents list
      const refreshRes = await fetch(`/api/documents?user_id=${docsUser.id}`);
      const refreshJson = await refreshRes.json().catch(() => ({ data: [] }));
      if (refreshRes.ok && refreshJson.data) {
        setGuestDocs(refreshJson.data);
      }
      router.refresh();
    } catch {
      setDocUploadLoading(false);
      setDocUploadError("Network error while uploading document.");
    }
  }

  async function handleAdminDeleteDoc(docId: string) {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        setGuestDocs((prev) => prev.filter((d) => d.id !== docId));
        setDocUploadStatus("Document deleted.");
        router.refresh();
      } else {
        const json = await res.json().catch(() => null);
        setDocUploadError(json?.error ?? "Failed to delete document.");
      }
    } catch {
      setDocUploadError("Network error while deleting document.");
    }
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

  const stats = useMemo(() => {
    const total = rows.length;
    const activeGuests = rows.filter((r) => r.role === "traveller" && r.isActive).length;
    const leadersCount = rows.filter((r) => r.role === "leader").length;
    const adminsCount = rows.filter((r) => r.role === "admin").length;
    return [
      { label: "Total Accounts", value: total, sub: "Registered users & staff", role: "all" },
      { label: "Active Guests", value: activeGuests, sub: "Ready for upcoming trails", role: "traveller" },
      { label: "Trail Leaders", value: leadersCount, sub: "Assigned & active guides", role: "leader" },
      { label: "Administrators", value: adminsCount, sub: "Full management access", role: "admin" },
    ];
  }, [rows]);

  return (
    <>
      {/* KPI Stats Overview */}
      <div className="admin-stats" style={{ marginBottom: "22px" }}>
        {stats.map((s) => {
          const isSelected = roleFilter === s.role;
          return (
            <button
              key={s.label}
              type="button"
              className="stat"
              onClick={() => {
                setRoleFilter(s.role);
                setPage(1);
              }}
              style={{
                textAlign: "left",
                width: "100%",
                background: isSelected ? "var(--soft, #f4f8f5)" : "var(--white, #ffffff)",
                borderColor: isSelected ? "var(--forest, #1e3a2b)" : "var(--line, #e2e8f0)",
              }}
              title={`Filter by ${s.label}`}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{s.label}</span>
                {isSelected && (
                  <span style={{ fontSize: "10px", background: "var(--forest)", color: "#fff", padding: "1px 6px", borderRadius: "8px", fontWeight: 700 }}>
                    Active Filter
                  </span>
                )}
              </div>
              <strong>{s.value}</strong>
              <small style={{ fontSize: "11px", color: "#64748b" }}>{s.sub}</small>
            </button>
          );
        })}
      </div>

      <section className="admin-card">
        {/* Card Header: Title on Left, Primary Action (+ New Account) on Right */}
        <div className="admin-card-header-row">
          <div>
            <h2 className="serif" style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
              Accounts
              <span className="admin-count-badge">
                {filtered.length} {filtered.length === 1 ? "account" : "accounts"}
              </span>
            </h2>
            <p className="admin-hint" style={{ margin: "4px 0 0", fontSize: "13.5px", color: "#64748b" }}>
              Manage guest accounts, assign trail leaders, inspect travel credentials, and reset access.
            </p>
          </div>
          <div className="admin-card-header-actions">
            <a
              href="#new-account"
              className="admin-control-btn admin-control-btn-primary"
              style={{ textDecoration: "none" }}
            >
              + New Account
            </a>
          </div>
        </div>

        {/* Dedicated Toolbar Row for Search & Filters */}
        <div className="admin-toolbar-row">
          {/* Search Input Box */}
          <div className="admin-search-box">
            <svg
              className="admin-search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="admin-control-input"
              placeholder="Search name, phone, email, city…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              aria-label="Search accounts"
            />
            {query && (
              <button
                type="button"
                className="admin-search-clear"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter & Action Controls on Right */}
          <div className="admin-filter-group">
            {/* Role Filter */}
            <select
              className="admin-control-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by role"
            >
              <option value="all">All roles</option>
              <option value="traveller">Guests</option>
              <option value="leader">Trail leaders</option>
              <option value="admin">Administrators</option>
            </select>

            {/* Status Filter */}
            <select
              className="admin-control-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>

            {/* Sort Controls */}
            <div className="admin-sort-combo">
              <select
                className="admin-control-select"
                value={sortField}
                onChange={(e) => {
                  setSortField(e.target.value as SortField);
                  setPage(1);
                }}
                aria-label="Sort by field"
              >
                <option value="name">Sort: Name</option>
                <option value="role">Sort: Role</option>
                <option value="leaderName">Sort: Leader</option>
                <option value="referralName">Sort: Referral</option>
                <option value="location">Sort: Location</option>
                <option value="email">Sort: Email</option>
                <option value="isActive">Sort: Status</option>
                <option value="lastActiveAt">Sort: Last Active</option>
                <option value="phone">Sort: Mobile</option>
              </select>
              <button
                type="button"
                className="admin-control-btn admin-control-btn-secondary"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                title={`Sort ${sortOrder === "asc" ? "Ascending" : "Descending"} (Click to flip)`}
              >
                {sortOrder === "asc" ? "▲ Asc" : "▼ Desc"}
              </button>
            </div>

            {/* Import CSV Button */}
            <button
              type="button"
              className="admin-control-btn admin-control-btn-secondary"
              onClick={() => setShowImport(!showImport)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {showImport ? "Close Import" : "Import Guests (CSV)"}
            </button>
          </div>
        </div>

        {showImport && (
          <div style={{ margin: "16px 0", padding: "20px", background: "#f8fafc", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 className="serif" style={{ margin: 0, fontSize: "1.15rem", color: "#0f172a" }}>Bulk Import Guests (CSV)</h3>
                <p className="admin-hint" style={{ margin: "4px 0 0", color: "#475569" }}>
                  Upload a UTF-8 CSV with columns: <code>Mobile Number</code>, <code>First Name</code>, <code>Last Name</code>, <code>Role</code>, <code>Leader Name</code>, <code>Date of Joining</code>, <code>Location</code>, <code>email id</code>, <code>Referral&apos;s Name</code>.
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
              <div style={{ marginTop: "14px", padding: "12px", background: "rgba(0,0,0,0.05)", borderRadius: "6px" }}>
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
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    {renderSortHeader("User Id / Mobile Number", "phone")}
                    {renderSortHeader("First Name", "name")}
                    <th style={{ userSelect: "none", whiteSpace: "nowrap" }}>Last Name</th>
                    {renderSortHeader("Role", "role")}
                    {renderSortHeader("Leader Name", "leaderName")}
                    {renderSortHeader("Referral", "referralName")}
                    {renderSortHeader("Location", "location")}
                    {renderSortHeader("Email Id", "email")}
                    {renderSortHeader("Active / Inactive", "isActive")}
                    {renderSortHeader("Date Last Active", "lastActiveAt")}
                    <th style={{ textAlign: "right", paddingRight: "18px", whiteSpace: "nowrap" }} aria-label="Actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ paddingLeft: "18px" }}>
                        <span className="mono" style={{ fontWeight: 600, color: "#0f172a" }}>
                          {row.phone}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px", whiteSpace: "nowrap" }}>
                          <span className="guest-avatar-bubble">
                            {row.firstName?.charAt(0) || "U"}
                          </span>
                          <strong style={{ color: "#0f172a" }}>{row.firstName}</strong>
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: "#0f172a" }}>{row.lastName}</strong>
                      </td>
                      <td>
                        <span className={`role-badge role-badge-${row.role === "traveller" ? "guest" : row.role}`}>
                          {row.role === "traveller" ? "Guest" : row.role === "leader" ? "Trail Leader" : "Admin"}
                        </span>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600, color: row.leaderName ? "#0f172a" : "#94a3b8" }}>
                            {row.leaderName || "—"}
                          </div>
                          {row.trailLeaders && row.trailLeaders.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "3px" }}>
                              {row.trailLeaders.map((tl, i) => (
                                <span key={i} className="trail-pill-sub" title={tl.trailName}>
                                  Trail: {tl.trailName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{row.referralName || "—"}</td>
                      <td>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {row.location ? `📍 ${row.location}` : "—"}
                        </span>
                      </td>
                      <td className="small" style={{ color: row.email ? "#334155" : "#94a3b8" }}>
                        {row.email || "—"}
                      </td>
                      <td>
                        <span className={`status-pill ${row.isActive ? "active" : "inactive"}`}>
                          <span className="status-dot" />
                          {row.isActive ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="small muted" style={{ whiteSpace: "nowrap" }}>
                        {row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleDateString("en-IN") : "Never"}
                      </td>
                      <td style={{ textAlign: "right", paddingRight: "18px" }}>
                        <div className="row-action-pills" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="action-pill action-pill-neutral"
                            onClick={() => openDocsModal(row)}
                            title="View & upload travel documents"
                          >
                            📄 Docs
                          </button>
                          <button
                            type="button"
                            className="action-pill action-pill-primary"
                            onClick={() => startEdit(row)}
                            title="Edit account details"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="action-pill action-pill-neutral"
                            onClick={() => resetPassword(row)}
                            title="Reset PIN to last 4 digits of phone"
                          >
                            🔑 Reset PIN
                          </button>
                          <button
                            type="button"
                            className={`action-pill ${row.isActive ? "action-pill-danger" : "action-pill-success"}`}
                            onClick={() => updateUser(row.id, { is_active: !row.isActive }, row.isActive ? "Account suspended." : "Account restored.")}
                            title={row.isActive ? "Suspend guest account" : "Restore guest account"}
                          >
                            {row.isActive ? "Suspend" : "Restore"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "10px" }}>
                <button
                  type="button"
                  className="admin-control admin-control-btn admin-control-btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}
                >
                  ← Previous
                </button>
                <span className="muted small">
                  Showing <strong>{(page - 1) * pageSize + 1}</strong> – <strong>{Math.min(page * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> accounts (Page {page} of {totalPages})
                </span>
                <button
                  type="button"
                  className="admin-control admin-control-btn admin-control-btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  style={{ opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? "not-allowed" : "pointer" }}
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
                First Name <span className="req">*</span>
                <input required value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </label>
              <label className="form-field">
                Last Name <span className="req">*</span>
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
                Role <span className="req">*</span>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRow["role"] })}>
                  <option value="traveller">Guest</option>
                  <option value="leader">Trail leader</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label className="form-field">
                Location
                <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
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

      {/* Admin Guest Documents Modal */}
      {docsUser && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="admin-card" style={{ maxWidth: "680px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="admin-card-head" style={{ borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.1))", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <span className="eyebrow" style={{ color: "var(--forest, #2d5a27)", fontWeight: 700 }}>
                  Documents · {docsUser.role === "traveller" ? "Guest" : docsUser.role === "leader" ? "Leader" : "Admin"}
                </span>
                <h2 className="serif" style={{ margin: "2px 0 0" }}>
                  {docsUser.firstName} {docsUser.lastName}
                </h2>
                <span className="muted small mono">Phone: {docsUser.phone} {docsUser.location ? `· ${docsUser.location}` : ""}</span>
              </div>
              <button type="button" className="link-btn" onClick={() => setDocsUser(null)}>✕ Close</button>
            </div>

            {docUploadStatus && <p className="form-notice" role="status" style={{ marginBottom: "12px" }}>{docUploadStatus}</p>}
            {docUploadError && <p className="form-error" role="alert" style={{ marginBottom: "12px" }}>{docUploadError}</p>}

            {/* Existing Documents List */}
            <div style={{ marginBottom: "24px" }}>
              <h3 className="serif" style={{ fontSize: "16px", marginBottom: "10px" }}>
                Saved Documents ({guestDocs.length})
              </h3>
              {docsLoading ? (
                <p className="panel-note">Loading documents…</p>
              ) : guestDocs.length === 0 ? (
                <p className="panel-note" style={{ background: "rgba(0,0,0,0.03)", padding: "12px", borderRadius: "6px" }}>
                  No documents have been uploaded for this guest yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {guestDocs.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        padding: "10px 14px",
                        border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
                        borderRadius: "6px",
                        background: "rgba(0,0,0,0.02)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "var(--forest, #2d5a27)",
                            background: "var(--soft, #f7f3ee)",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            border: "1px solid var(--line, #e3d5c4)",
                          }}
                        >
                          {formatDocType(doc.doc_type)}
                        </span>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          {doc.download_url && (
                            <a
                              href={doc.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-btn"
                              style={{ fontSize: "12px" }}
                            >
                              Download {doc.file_name ? doc.file_name : "File"} ↗
                            </a>
                          )}
                          <button
                            type="button"
                            className="link-btn"
                            style={{ fontSize: "12px", color: "var(--color-danger, #ef4444)" }}
                            onClick={() => handleAdminDeleteDoc(doc.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mono" style={{ fontSize: "14px", fontWeight: 600 }}>
                        {doc.doc_number ? (
                          <>
                            <span style={{ opacity: 0.6 }}>•••• </span>
                            <span>{doc.doc_number.slice(-4)}</span>
                            <span className="muted small" style={{ marginLeft: "8px", fontWeight: "normal" }}>
                              ({doc.doc_number})
                            </span>
                          </>
                        ) : (
                          "Document on file"
                        )}
                      </div>

                      {(() => {
                        const details: string[] = [];
                        if (doc.issued_date) {
                          try {
                            details.push(`Issued: ${new Date(doc.issued_date).toLocaleDateString("en-IN")}`);
                          } catch {
                            details.push(`Issued: ${doc.issued_date}`);
                          }
                        }
                        if (doc.expiry_date) {
                          try {
                            details.push(`Expires: ${new Date(doc.expiry_date).toLocaleDateString("en-IN")}`);
                          } catch {
                            details.push(`Expires: ${doc.expiry_date}`);
                          }
                        }
                        if (doc.issued_country) {
                          details.push(`Issued at: ${doc.issued_country}`);
                        }
                        if (details.length === 0) return null;
                        return <span className="muted small">{details.join(" · ")}</span>;
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Document Form */}
            <div style={{ borderTop: "1px solid var(--color-border, rgba(255,255,255,0.1))", paddingTop: "18px" }}>
              <h3 className="serif" style={{ fontSize: "16px", marginBottom: "6px" }}>
                Upload Document for {docsUser.firstName}
              </h3>
              <p className="panel-note" style={{ marginBottom: "14px" }}>
                Upload verified identity or travel documents on behalf of this guest.
              </p>

              <form onSubmit={handleAdminUploadDoc}>
                <label className="form-field">
                  Document Type <span className="req">*</span>
                  <select value={newDocType} onChange={(e) => setNewDocType(e.target.value)}>
                    {DOCUMENT_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  Document Number <span className="req">*</span>
                  <input
                    required
                    minLength={4}
                    value={newDocNumber}
                    onChange={(e) => setNewDocNumber(e.target.value)}
                    placeholder="Enter document number (e.g. AAADK9754A)"
                  />
                </label>

                <div className="field-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                  <label className="form-field">
                    Issued Date
                    <input
                      type="date"
                      value={newIssuedDate}
                      onChange={(e) => setNewIssuedDate(e.target.value)}
                    />
                  </label>
                  <label className="form-field">
                    Expiry Date
                    <input
                      type="date"
                      value={newExpiryDate}
                      onChange={(e) => setNewExpiryDate(e.target.value)}
                    />
                  </label>
                  <label className="form-field">
                    Issued at (Place)
                    <input
                      value={newIssuedPlace}
                      placeholder="e.g. Bangalore"
                      onChange={(e) => setNewIssuedPlace(e.target.value)}
                    />
                  </label>
                </div>

                <label className="form-field">
                  Attachment (PDF or Image, Max 10MB)
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setNewDocFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                  <button className="btn btn-primary" type="submit" disabled={docUploadLoading}>
                    {docUploadLoading ? "Uploading & Encrypting…" : "Upload Document"}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setDocsUser(null)}>
                    Done
                  </button>
                </div>
              </form>
            </div>
          </div>
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
              First Name <span className="req">*</span>
              <input required value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
            </label>
            <label className="form-field">
              Last Name <span className="req">*</span>
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
              Role <span className="req">*</span>
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