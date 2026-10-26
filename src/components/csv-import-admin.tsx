"use client";

import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ImportResult {
  created: number;
  skipped: number;
  errorCount: number;
  results?: Array<{
    row: number;
    phone?: string;
    trip_code?: string;
    guest_name?: string;
    trip_name?: string;
    status: "created" | "skipped" | "error";
    error?: string;
  }>;
}

type ImportTab = "users" | "trails" | "itinerary" | "details" | "mapping";

export default function CsvImportAdmin({
  initialTab = "users",
  trips = [],
}: {
  initialTab?: "users" | "trails" | "details" | "mapping" | "itinerary";
  trips?: Array<{ id: string; trip_code: string; name: string }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<ImportTab>(
    initialTab === "trails"
      ? "trails"
      : initialTab === "details"
      ? "details"
      : initialTab === "mapping"
      ? "mapping"
      : initialTab === "itinerary"
      ? "itinerary"
      : "users"
  );

  // Users import state
  const [userFile, setUserFile] = useState<File | null>(null);
  const [userImporting, setUserImporting] = useState(false);
  const [userReport, setUserReport] = useState<ImportResult | null>(null);
  const [userError, setUserError] = useState("");
  const [userNotice, setUserNotice] = useState("");
  const userInputRef = useRef<HTMLInputElement | null>(null);

  // Trails import state
  const [trailFile, setTrailFile] = useState<File | null>(null);
  const [trailImporting, setTrailImporting] = useState(false);
  const [trailReport, setTrailReport] = useState<ImportResult | null>(null);
  const [trailError, setTrailError] = useState("");
  const [trailNotice, setTrailNotice] = useState("");
  const trailInputRef = useRef<HTMLInputElement | null>(null);

  // Trail Itinerary import state
  const [itineraryFile, setItineraryFile] = useState<File | null>(null);
  const [itineraryTripId, setItineraryTripId] = useState<string>("");
  const [itineraryImporting, setItineraryImporting] = useState(false);
  const [itineraryReport, setItineraryReport] = useState<{
    createdDays: number;
    createdActivities: number;
    skipped: number;
    errorCount: number;
    errors?: Array<{ row: number; error: string }>;
  } | null>(null);
  const [itineraryError, setItineraryError] = useState("");
  const [itineraryNotice, setItineraryNotice] = useState("");
  const itineraryInputRef = useRef<HTMLInputElement | null>(null);

  // Guest Details import state
  const [detailsFile, setDetailsFile] = useState<File | null>(null);
  const [detailsImporting, setDetailsImporting] = useState(false);
  const [detailsReport, setDetailsReport] = useState<ImportResult | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [detailsNotice, setDetailsNotice] = useState("");
  const detailsInputRef = useRef<HTMLInputElement | null>(null);

  // Trail to Guest Mapping import state
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [mappingImporting, setMappingImporting] = useState(false);
  const [mappingReport, setMappingReport] = useState<ImportResult | null>(null);
  const [mappingError, setMappingError] = useState("");
  const [mappingNotice, setMappingNotice] = useState("");
  const mappingInputRef = useRef<HTMLInputElement | null>(null);

  async function handleItinerarySubmit(e: FormEvent) {
    e.preventDefault();
    if (!itineraryFile) {
      setItineraryError("Please select an Itinerary CSV file to upload.");
      return;
    }

    setItineraryImporting(true);
    setItineraryError("");
    setItineraryNotice("");
    setItineraryReport(null);

    try {
      const fd = new FormData();
      fd.append("file", itineraryFile);
      if (itineraryTripId) {
        fd.append("trip_id", itineraryTripId);
      }

      const res = await fetch("/api/admin/trips/itinerary/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setItineraryImporting(false);

      if (!res.ok) {
        setItineraryError(json?.error ?? "Failed to import trail itinerary.");
        return;
      }

      setItineraryReport(json);
      setItineraryNotice(
        `Itinerary CSV successfully processed: ${json.createdDays ?? 0} day(s) upserted, ${json.createdActivities ?? 0} activity(ies) created, ${json.errorCount ?? 0} error(s).`
      );
      if (itineraryInputRef.current) itineraryInputRef.current.value = "";
      setItineraryFile(null);
      router.refresh();
    } catch {
      setItineraryImporting(false);
      setItineraryError("Network error while importing itinerary CSV.");
    }
  }

  async function handleUserSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userFile) {
      setUserError("Please select a CSV file to upload.");
      return;
    }

    setUserImporting(true);
    setUserError("");
    setUserNotice("");
    setUserReport(null);

    try {
      const fd = new FormData();
      fd.append("file", userFile);

      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setUserImporting(false);

      if (!res.ok) {
        setUserError(json?.error ?? "Failed to import user accounts.");
        return;
      }

      setUserReport(json);
      setUserNotice(`Users CSV successfully imported: ${json.created} created/updated, ${json.skipped} skipped.`);
      if (userInputRef.current) userInputRef.current.value = "";
      setUserFile(null);
      router.refresh();
    } catch {
      setUserImporting(false);
      setUserError("Network error while importing users CSV.");
    }
  }

  async function handleTrailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trailFile) {
      setTrailError("Please select a CSV file to upload.");
      return;
    }

    setTrailImporting(true);
    setTrailError("");
    setTrailNotice("");
    setTrailReport(null);

    try {
      const fd = new FormData();
      fd.append("file", trailFile);

      const res = await fetch("/api/admin/trips/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setTrailImporting(false);

      if (!res.ok) {
        setTrailError(json?.error ?? "Failed to import trails.");
        return;
      }

      setTrailReport(json);
      setTrailNotice(`Trails CSV successfully imported: ${json.created} created, ${json.skipped} skipped.`);
      if (trailInputRef.current) trailInputRef.current.value = "";
      setTrailFile(null);
      router.refresh();
    } catch {
      setTrailImporting(false);
      setTrailError("Network error while importing trails CSV.");
    }
  }

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    if (!detailsFile) {
      setDetailsError("Please select a CSV file to upload.");
      return;
    }

    setDetailsImporting(true);
    setDetailsError("");
    setDetailsNotice("");
    setDetailsReport(null);

    try {
      const fd = new FormData();
      fd.append("file", detailsFile);

      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setDetailsImporting(false);

      if (!res.ok) {
        setDetailsError(json?.error ?? "Failed to import guest details.");
        return;
      }

      setDetailsReport(json);
      setDetailsNotice(`Guest Details CSV successfully imported: ${json.created} records updated, ${json.skipped} skipped.`);
      if (detailsInputRef.current) detailsInputRef.current.value = "";
      setDetailsFile(null);
      router.refresh();
    } catch {
      setDetailsImporting(false);
      setDetailsError("Network error while importing guest details CSV.");
    }
  }

  async function handleMappingSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mappingFile) {
      setMappingError("Please select a CSV file to upload.");
      return;
    }

    setMappingImporting(true);
    setMappingError("");
    setMappingNotice("");
    setMappingReport(null);

    try {
      const fd = new FormData();
      fd.append("file", mappingFile);

      const res = await fetch("/api/admin/trips/mapping/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setMappingImporting(false);

      if (!res.ok) {
        setMappingError(json?.error ?? "Failed to import trail to guest mappings.");
        return;
      }

      setMappingReport(json);
      setMappingNotice(
        `Mapping CSV processed: ${json.created} guest(s) mapped, ${json.skipped} skipped, ${json.errorCount} error(s).`
      );
      if (mappingInputRef.current) mappingInputRef.current.value = "";
      setMappingFile(null);
      router.refresh();
    } catch {
      setMappingImporting(false);
      setMappingError("Network error while importing mapping CSV.");
    }
  }

  return (
    <div>
      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          borderBottom: "2px solid #e2e8f0",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setTab("users")}
          className={`link-btn ${tab === "users" ? "active" : ""}`}
          style={{
            padding: "10px 18px",
            fontSize: "14.5px",
            fontWeight: tab === "users" ? 700 : 600,
            borderBottom: tab === "users" ? "3px solid #166534" : "3px solid transparent",
            color: tab === "users" ? "#14532d" : "#334155",
            background: tab === "users" ? "#f0fdf4" : "transparent",
            cursor: "pointer",
            borderRadius: "6px 6px 0 0",
            transition: "all 0.15s ease",
          }}
        >
          User Table (Guests)
        </button>
        <button
          type="button"
          onClick={() => setTab("trails")}
          className={`link-btn ${tab === "trails" ? "active" : ""}`}
          style={{
            padding: "10px 18px",
            fontSize: "14.5px",
            fontWeight: tab === "trails" ? 700 : 600,
            borderBottom: tab === "trails" ? "3px solid #166534" : "3px solid transparent",
            color: tab === "trails" ? "#14532d" : "#334155",
            background: tab === "trails" ? "#f0fdf4" : "transparent",
            cursor: "pointer",
            borderRadius: "6px 6px 0 0",
            transition: "all 0.15s ease",
          }}
        >
          Trail Table (Trails)
        </button>
        <button
          type="button"
          onClick={() => setTab("itinerary")}
          className={`link-btn ${tab === "itinerary" ? "active" : ""}`}
          style={{
            padding: "10px 18px",
            fontSize: "14.5px",
            fontWeight: tab === "itinerary" ? 700 : 600,
            borderBottom: tab === "itinerary" ? "3px solid #166534" : "3px solid transparent",
            color: tab === "itinerary" ? "#14532d" : "#334155",
            background: tab === "itinerary" ? "#f0fdf4" : "transparent",
            cursor: "pointer",
            borderRadius: "6px 6px 0 0",
            transition: "all 0.15s ease",
          }}
        >
          Trail Itinerary Table
        </button>
        <button
          type="button"
          onClick={() => setTab("details")}
          className={`link-btn ${tab === "details" ? "active" : ""}`}
          style={{
            padding: "10px 18px",
            fontSize: "14.5px",
            fontWeight: tab === "details" ? 700 : 600,
            borderBottom: tab === "details" ? "3px solid #166534" : "3px solid transparent",
            color: tab === "details" ? "#14532d" : "#334155",
            background: tab === "details" ? "#f0fdf4" : "transparent",
            cursor: "pointer",
            borderRadius: "6px 6px 0 0",
            transition: "all 0.15s ease",
          }}
        >
          Guest Details Table
        </button>
        <button
          type="button"
          onClick={() => setTab("mapping")}
          className={`link-btn ${tab === "mapping" ? "active" : ""}`}
          style={{
            padding: "10px 18px",
            fontSize: "14.5px",
            fontWeight: tab === "mapping" ? 700 : 600,
            borderBottom: tab === "mapping" ? "3px solid #166534" : "3px solid transparent",
            color: tab === "mapping" ? "#14532d" : "#334155",
            background: tab === "mapping" ? "#f0fdf4" : "transparent",
            cursor: "pointer",
            borderRadius: "6px 6px 0 0",
            transition: "all 0.15s ease",
          }}
        >
          Trail to Guest Mapping
        </button>
      </div>

      {/* USER TABLE (GUESTS) TAB */}
      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="admin-card">
            <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
              <div>
                <h2 className="serif">User Table (Guests / Users)</h2>
                <p className="admin-hint" style={{ margin: "4px 0 0" }}>
                  Field names match the <strong>User Table</strong> specification. User Id is the 10-digit mobile number; initial password is the last 4 digits.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <a
                  href="/api/admin/users/import"
                  download="users_import_template.csv"
                  className="btn btn-secondary"
                >
                  Download User Table Template
                </a>
                <Link href="/admin/users" className="link-btn">
                  View Guests Directory →
                </Link>
              </div>
            </div>

            {userError && <p className="form-error" role="alert" style={{ marginBottom: "16px" }}>{userError}</p>}
            {userNotice && <p className="form-notice" role="status" style={{ marginBottom: "16px" }}>{userNotice}</p>}

            <form onSubmit={handleUserSubmit} style={{ marginTop: "16px" }}>
              <div
                style={{
                  border: "2px dashed var(--line, #334155)",
                  borderRadius: "8px",
                  padding: "24px",
                  textAlign: "center",
                  background: "var(--paper, rgba(255, 255, 255, 0.02))",
                  marginBottom: "16px",
                }}
              >
                <input
                  ref={userInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const f = e.target.files?.[0] || null;
                    setUserFile(f);
                    setUserError("");
                  }}
                  disabled={userImporting}
                  id="user-csv-input"
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="user-csv-input"
                  style={{
                    display: "inline-block",
                    cursor: "pointer",
                    padding: "10px 18px",
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    fontWeight: 500,
                    marginBottom: "8px",
                  }}
                >
                  {userFile ? "Change CSV File" : "Select CSV File"}
                </label>
                {userFile ? (
                  <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--foreground)" }}>
                    Selected file: <strong>{userFile.name}</strong> ({(userFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <p className="admin-hint" style={{ margin: "6px 0 0" }}>
                    Select a UTF-8 CSV file containing User Table records
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={userImporting || !userFile}
                >
                  {userImporting ? "Processing Batch…" : "Upload & Import Users"}
                </button>
                {userFile && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={userImporting}
                    onClick={() => {
                      setUserFile(null);
                      if (userInputRef.current) userInputRef.current.value = "";
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            {userReport && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <h3 className="serif" style={{ margin: "0 0 10px", fontSize: "1.1rem", color: "#0f172a" }}>Import Summary</h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span className="pill mandatory">Created/Updated: {userReport.created}</span>
                  <span className="pill optional">Skipped (duplicates): {userReport.skipped}</span>
                  {userReport.errorCount > 0 && (
                    <span className="pill off" style={{ color: "#ef4444", borderColor: "#ef4444", fontWeight: 700 }}>
                      Errors: {userReport.errorCount}
                    </span>
                  )}
                </div>

                {userReport.errorCount > 0 && userReport.results && (
                  <div style={{ marginTop: "12px" }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--color-danger, #ef4444)" }}>
                      Failed Records ({userReport.errorCount}):
                    </h4>
                    <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "4px" }}>
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>User Id / Mobile Number</th>
                            <th>Error Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userReport.results
                            .filter((r) => r.status === "error")
                            .map((r, i) => (
                              <tr key={i}>
                                <td className="mono">{r.row}</td>
                                <td className="mono">{r.phone || "—"}</td>
                                <td style={{ color: "var(--color-danger, #ef4444)" }}>{r.error}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="admin-card">
            <h3 className="serif" style={{ margin: "0 0 10px" }}>User Table Field Names Specification</h3>
            <p className="admin-hint">
              Field names match the <strong>Payana Mitra App - Table Details</strong> sheet:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>Field Type</th>
                    <th>Limit / Field Size</th>
                    <th>Requirement</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>Mobile Number</strong></td>
                    <td>10-15 digit Mobile Number (also acts as User Id — no need to enter twice)</td>
                    <td>10 to 15 digits</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td className="mono">9019911700</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Password</strong></td>
                    <td>Last 4 digits of Mobile Number (auto-generated on backend)</td>
                    <td>4 digits</td>
                    <td><span className="pill" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" }}>Auto (Backend)</span></td>
                    <td className="mono">1700</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>First Name</strong></td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td>Arvind</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Last Name</strong></td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td>Kamath</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Role</strong></td>
                    <td>Guest / Leader / Admin</td>
                    <td>Fixed Enum (Guest/Leader/Admin)</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td>Guest (default)</td>
                  </tr>
                  <tr>
                    <td className="mono">Leader Name</td>
                    <td>Name or phone of assigned Trail Leader (for Guests)</td>
                    <td>Max 50 characters / phone</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Anushree Kini</td>
                  </tr>
                  <tr>
                    <td className="mono">Date of Joining</td>
                    <td>DD/MM/YY, DD/MM/YYYY, or DD-MM-YYYY</td>
                    <td>Calendar Date</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">18/06/25</td>
                  </tr>
                  <tr>
                    <td className="mono">Active Status</td>
                    <td>Automatically enabled in backend on import (no CSV column needed)</td>
                    <td>Boolean (defaults to true)</td>
                    <td><span className="pill" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" }}>Auto (Backend)</span></td>
                    <td>Active</td>
                  </tr>
                  <tr>
                    <td className="mono">Location</td>
                    <td>Home city or region</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Bengaluru</td>
                  </tr>
                  <tr>
                    <td className="mono">email id</td>
                    <td>Alphanumeric with special characters @ and .</td>
                    <td>Valid email format (Max 100)</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>arvindakamath@gmail.com</td>
                  </tr>
                  <tr>
                    <td className="mono">Referral&apos;s Name</td>
                    <td>Name of the person who referred this guest/user</td>
                    <td>Max 100 characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Ramesh Bhat</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TRAIL TABLE TAB */}
      {tab === "trails" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="admin-card">
            <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
              <div>
                <h2 className="serif">Trail Table (Trails)</h2>
                <p className="admin-hint" style={{ margin: "4px 0 0" }}>
                  Field names match the <strong>Trail Table</strong> specification. Existing Trail Ids are automatically skipped. Imported trails are placed in Draft status ready for itinerary setup.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <a
                  href="/api/admin/trips/import"
                  download="trails_import_template.csv"
                  className="btn btn-secondary"
                >
                  Download Trail Table Template
                </a>
                <Link href="/admin/trips" className="link-btn">
                  View All Trails →
                </Link>
              </div>
            </div>

            {trailError && <p className="form-error" role="alert" style={{ marginBottom: "16px" }}>{trailError}</p>}
            {trailNotice && <p className="form-notice" role="status" style={{ marginBottom: "16px" }}>{trailNotice}</p>}

            <form onSubmit={handleTrailSubmit} style={{ marginTop: "16px" }}>
              <div
                style={{
                  border: "2px dashed var(--line, #334155)",
                  borderRadius: "8px",
                  padding: "24px",
                  textAlign: "center",
                  background: "var(--paper, rgba(255, 255, 255, 0.02))",
                  marginBottom: "16px",
                }}
              >
                <input
                  ref={trailInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const f = e.target.files?.[0] || null;
                    setTrailFile(f);
                    setTrailError("");
                  }}
                  disabled={trailImporting}
                  id="trail-csv-input"
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="trail-csv-input"
                  style={{
                    display: "inline-block",
                    cursor: "pointer",
                    padding: "10px 18px",
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    fontWeight: 500,
                    marginBottom: "8px",
                  }}
                >
                  {trailFile ? "Change CSV File" : "Select CSV File"}
                </label>
                {trailFile ? (
                  <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--foreground)" }}>
                    Selected file: <strong>{trailFile.name}</strong> ({(trailFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <p className="admin-hint" style={{ margin: "6px 0 0" }}>
                    Select a UTF-8 CSV file containing Trail Table records
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={trailImporting || !trailFile}
                >
                  {trailImporting ? "Processing Batch…" : "Upload & Import Trails"}
                </button>
                {trailFile && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={trailImporting}
                    onClick={() => {
                      setTrailFile(null);
                      if (trailInputRef.current) trailInputRef.current.value = "";
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            {trailReport && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <h3 className="serif" style={{ margin: "0 0 10px", fontSize: "1.1rem", color: "#0f172a" }}>Import Summary</h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span className="pill mandatory">Created: {trailReport.created}</span>
                  <span className="pill optional">Skipped (duplicates): {trailReport.skipped}</span>
                  {trailReport.errorCount > 0 && (
                    <span className="pill off" style={{ color: "#ef4444", borderColor: "#ef4444", fontWeight: 700 }}>
                      Errors: {trailReport.errorCount}
                    </span>
                  )}
                </div>

                {trailReport.errorCount > 0 && trailReport.results && (
                  <div style={{ marginTop: "12px" }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--color-danger, #ef4444)" }}>
                      Failed Records ({trailReport.errorCount}):
                    </h4>
                    <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "4px" }}>
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Trail Id</th>
                            <th>Error Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trailReport.results
                            .filter((r) => r.status === "error")
                            .map((r, i) => (
                              <tr key={i}>
                                <td className="mono">{r.row}</td>
                                <td className="mono">{r.trip_code || "—"}</td>
                                <td style={{ color: "var(--color-danger, #ef4444)" }}>{r.error}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="admin-card">
            <h3 className="serif" style={{ margin: "0 0 10px" }}>Trail Table Field Names Specification</h3>
            <p className="admin-hint">
              Field names exactly match the <strong>Payana Mitra App - Table Details</strong> sheet:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>Field Type</th>
                    <th>Limit / Field Size</th>
                    <th>Requirement</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>Trail Id</strong></td>
                    <td>Alpha-numeric (8 characters)</td>
                    <td>8 characters (e.g. <code>HIHGOK01</code>)</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td className="mono">HIHGOK01</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Trail Name</strong></td>
                    <td>Alphanumeric / text</td>
                    <td>Max 100 characters</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td>Heritage Gems of Karnataka</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Destination</strong></td>
                    <td>Alphanumeric / text</td>
                    <td>Max 100 characters</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td>Karnataka</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Start Date</strong></td>
                    <td>Calendar date (DD-MM-YYYY or DD/MM/YYYY)</td>
                    <td>DD-MM-YYYY / DD/MM/YYYY / YYYY-MM-DD</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td className="mono">15-06-2026</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>End Date</strong></td>
                    <td>Calendar date (DD-MM-YYYY or DD/MM/YYYY)</td>
                    <td>DD-MM-YYYY / DD/MM/YYYY / YYYY-MM-DD</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td className="mono">20-06-2026</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Leader User Id</strong></td>
                    <td>Leader's User Id (Phone Number) or Name</td>
                    <td>10-15 digits / text</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">9000000002</td>
                  </tr>
                  <tr>
                    <td className="mono">Active / Inactive</td>
                    <td>Dropdown (Active or Inactive)</td>
                    <td>Enum: Active / Inactive</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Active</td>
                  </tr>
                  <tr>
                    <td className="mono">Remarks</td>
                    <td>Trail overview notes</td>
                    <td>Free text (Max 1,000 characters)</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Moderate summer trail</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h4 className="serif" style={{ margin: "0 0 6px", color: "#14532d" }}>Extension of Trail Table: Day wise Itinerary</h4>
                <p className="admin-hint" style={{ margin: 0, color: "#166534" }}>
                  You can now import the day-wise itinerary directly here in the CSV Import Menu! Switch to the <strong>Trail Itinerary Table</strong> tab to download the template and upload your CSV.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab("itinerary")}
                className="btn btn-primary"
                style={{ whiteSpace: "nowrap" }}
              >
                Go to Trail Itinerary Tab →
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TRAIL ITINERARY TABLE TAB */}
      {tab === "itinerary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="admin-card">
            <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
              <div>
                <h2 className="serif">Trail Itinerary Table (Day wise Itinerary)</h2>
                <p className="admin-hint" style={{ margin: "4px 0 0", color: "#334155" }}>
                  Import day-by-day schedules, destinations, narrative highlights, hotel accommodations, meal plans, and timed activities.
                  Each row can be matched by the 8-character <strong>Trail Id</strong> (e.g. <code>HIHGOK01</code>), or you can select a target trail below.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <a
                  href="/api/admin/trips/itinerary/import"
                  download="trail_itinerary_template.csv"
                  className="btn btn-secondary"
                >
                  Download Itinerary Template
                </a>
                <Link href="/admin/trips" className="link-btn">
                  View Trails →
                </Link>
              </div>
            </div>

            {itineraryError && (
              <p className="form-error" role="alert" style={{ marginBottom: "16px" }}>
                {itineraryError}
              </p>
            )}
            {itineraryNotice && (
              <p className="form-notice" role="status" style={{ marginBottom: "16px" }}>
                {itineraryNotice}
              </p>
            )}

            <form onSubmit={handleItinerarySubmit} style={{ marginTop: "16px" }}>
              {trips && trips.length > 0 && (
                <div style={{ marginBottom: "18px" }}>
                  <label
                    htmlFor="itinerary-trip-select"
                    style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#0f172a",
                      marginBottom: "6px",
                    }}
                  >
                    Target Trail (Optional fallback if Trail Id is omitted from CSV rows):
                  </label>
                  <select
                    id="itinerary-trip-select"
                    value={itineraryTripId}
                    onChange={(e) => setItineraryTripId(e.target.value)}
                    disabled={itineraryImporting}
                    style={{
                      width: "100%",
                      maxWidth: "520px",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontSize: "14px",
                    }}
                  >
                    <option value="">— Automatically match from "Trail Id" in CSV (Recommended) —</option>
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.trip_code ? `${t.trip_code} — ${t.name}` : t.name}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "4px" }}>
                    If selected, rows without a Trail Id will automatically attach to this trail. If left empty, each row must specify a valid 8-character Trail Id.
                  </div>
                </div>
              )}

              <div
                style={{
                  border: "2px dashed #94a3b8",
                  padding: "24px",
                  borderRadius: "8px",
                  background: "#f8fafc",
                  textAlign: "center",
                }}
              >
                <input
                  ref={itineraryInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const f = e.target.files?.[0] || null;
                    setItineraryFile(f);
                    setItineraryError("");
                  }}
                  disabled={itineraryImporting}
                  id="itinerary-csv-file"
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="itinerary-csv-file"
                  style={{
                    display: "inline-block",
                    cursor: itineraryImporting ? "not-allowed" : "pointer",
                    padding: "12px 24px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontWeight: 600,
                    color: "#0f172a",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  {itineraryFile ? "Change CSV File" : "Select Trail Itinerary CSV File"}
                </label>
                <p style={{ margin: "10px 0 0", fontSize: "14px", color: "#334155" }}>
                  {itineraryFile ? (
                    <>
                      Selected: <strong>{itineraryFile.name}</strong> ({(itineraryFile.size / 1024).toFixed(1)} KB)
                    </>
                  ) : (
                    "Choose a CSV file containing Trail Id, Day, Destination, Itinerary, Hotel Name, Meal details, and Activities"
                  )}
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "16px", alignItems: "center" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!itineraryFile || itineraryImporting}
                  style={{ minWidth: "160px" }}
                >
                  {itineraryImporting ? "Importing Itinerary..." : "Upload & Import Itinerary"}
                </button>
                {itineraryFile && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={itineraryImporting}
                    onClick={() => {
                      setItineraryFile(null);
                      if (itineraryInputRef.current) itineraryInputRef.current.value = "";
                    }}
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </form>

            {itineraryReport && (
              <div
                style={{
                  marginTop: "24px",
                  padding: "18px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <h3 className="serif" style={{ margin: "0 0 12px", fontSize: "1.15rem", color: "#0f172a" }}>
                  Import Summary
                </h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
                  <span className="pill mandatory" style={{ fontSize: "13px", padding: "6px 12px" }}>
                    Days Processed / Upserted: {itineraryReport.createdDays}
                  </span>
                  <span className="pill mandatory" style={{ fontSize: "13px", padding: "6px 12px", background: "#e0e7ff", color: "#3730a3", border: "1px solid #a5b4fc" }}>
                    Activities Created: {itineraryReport.createdActivities}
                  </span>
                  {itineraryReport.skipped > 0 && (
                    <span className="pill optional" style={{ fontSize: "13px", padding: "6px 12px" }}>
                      Rows Skipped: {itineraryReport.skipped}
                    </span>
                  )}
                  {itineraryReport.errorCount > 0 && (
                    <span
                      className="pill"
                      style={{
                        fontSize: "13px",
                        padding: "6px 12px",
                        background: "#fee2e2",
                        color: "#991b1b",
                        border: "1px solid #fca5a5",
                        fontWeight: 700,
                      }}
                    >
                      Errors: {itineraryReport.errorCount}
                    </span>
                  )}
                </div>

                {itineraryReport.errorCount > 0 && itineraryReport.errors && itineraryReport.errors.length > 0 && (
                  <div style={{ marginTop: "14px" }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "#991b1b" }}>
                      Failed Rows ({itineraryReport.errorCount}):
                    </h4>
                    <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Error Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itineraryReport.errors.map((err, i) => (
                            <tr key={i}>
                              <td className="mono">{err.row}</td>
                              <td style={{ color: "#b91c1c", fontWeight: 500 }}>{err.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="admin-card">
            <h3 className="serif" style={{ margin: "0 0 10px", color: "#0f172a" }}>
              Trail Itinerary Table Field Names Specification
            </h3>
            <p className="admin-hint" style={{ color: "#334155", margin: "0 0 16px" }}>
              Field names match the <strong>Payana Mitra App - Day wise Itinerary</strong> specification.
              Every field limit, character constraint, and requirement status is detailed below:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>Field Type</th>
                    <th>Limit / Allowed Size</th>
                    <th>Requirement</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>Trail Id</strong></td>
                    <td>Alpha-numeric (8 characters)</td>
                    <td>8 characters (e.g. <code>HIHGOK01</code>)</td>
                    <td>
                      <span className="pill mandatory">Mandatory*</span>
                    </td>
                    <td className="mono">HIHGOK01</td>
                  </tr>
                  <tr>
                    <td className="mono">Trail Name</td>
                    <td>Alphanumeric / text</td>
                    <td>Max 100 characters</td>
                    <td>
                      <span className="pill optional">Optional</span>
                    </td>
                    <td>Heritage Gems of Karnataka</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Day</strong></td>
                    <td>Integer (Day Number)</td>
                    <td>Integer: 1 to 30</td>
                    <td>
                      <span className="pill mandatory">Mandatory</span>
                    </td>
                    <td className="mono">1</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Destination</strong></td>
                    <td>Alphanumeric / city name</td>
                    <td>Max 100 characters</td>
                    <td>
                      <span className="pill mandatory">Mandatory</span>
                    </td>
                    <td>Mysuru</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Itinerary</strong></td>
                    <td>Narrative / Day Highlights</td>
                    <td>Free text (Max 2,000 characters)</td>
                    <td>
                      <span className="pill mandatory">Mandatory</span>
                    </td>
                    <td>Arrival in Mysuru, heritage palace walk & welcome dinner</td>
                  </tr>
                  <tr>
                    <td className="mono">Hotel Name</td>
                    <td>Accommodation property name</td>
                    <td>Max 100 characters</td>
                    <td>
                      <span className="pill optional">Optional</span>
                    </td>
                    <td>Royal Orchid Metropole</td>
                  </tr>
                  <tr>
                    <td className="mono">Meal Plan</td>
                    <td>Meals provided (Breakfast/Lunch/Dinner)</td>
                    <td>Max 50 characters (e.g. <code>Breakfast & Dinner</code>)</td>
                    <td>
                      <span className="pill optional">Optional</span>
                    </td>
                    <td>Breakfast & Dinner</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Activity Description 1 .. 5</strong><br /><span style={{ fontSize: "11px", color: "#64748b" }}>(Column-wise format)</span></td>
                    <td>Free text for each daily activity</td>
                    <td>Free text (Max 500 chars each). Extend columns: <code>Activity Description 1</code>, <code>Activity Description 2</code>, <code>Activity Description 3</code>, <code>Activity Description 4</code>, <code>Activity Description 5</code></td>
                    <td>
                      <span className="pill optional">Optional</span>
                    </td>
                    <td>Sunset walk to Hemakuta Hill for panoramic sunset view</td>
                  </tr>
                  <tr>
                    <td className="mono">Activity Title<br /><span style={{ fontSize: "11px", color: "#64748b" }}>(Row-wise format)</span></td>
                    <td>Specific schedule item name</td>
                    <td>Max 100 characters (or companion <code>Activity Title 1..5</code>)</td>
                    <td>
                      <span className="pill optional">Optional</span>
                    </td>
                    <td>Mysore Palace Guided Walk</td>
                  </tr>
                  <tr>
                    <td className="mono">Activity Description<br /><span style={{ fontSize: "11px", color: "#64748b" }}>(Row-wise format)</span></td>
                    <td>Activity overview or guidance notes</td>
                    <td>Free text (Max 500 characters)</td>
                    <td>
                      <span className="pill optional">Optional</span>
                    </td>
                    <td>Private walking tour through palace durbar hall and gardens</td>
                  </tr>
                  <tr>
                    <td className="mono">Start Time</td>
                    <td>24-hour time format</td>
                    <td><code>HH:MM</code> (00:00 to 23:59, or <code>Start Time 1..5</code>)</td>
                    <td>
                      <span className="pill optional">Optional</span>
                    </td>
                    <td className="mono">09:30</td>
                  </tr>
                  <tr>
                    <td className="mono">End Time</td>
                    <td>24-hour time format</td>
                    <td><code>HH:MM</code> (00:00 to 23:59, or <code>End Time 1..5</code>)</td>
                    <td>
                      <span className="pill optional">Optional</span>
                    </td>
                    <td className="mono">11:30</td>
                  </tr>
                  <tr>
                    <td className="mono">Activity Order</td>
                    <td>Display order sequence</td>
                    <td>Integer &gt;= 1</td>
                    <td>
                      <span className="pill optional">Optional</span>
                    </td>
                    <td className="mono">1</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                background: "#f1f5f9",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "13.5px",
                color: "#1e293b",
                lineHeight: 1.6,
              }}
            >
              <strong>*Important Guidelines:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
                <li>
                  <strong>*Trail Id Requirement:</strong> You must supply <code>Trail Id</code> in the CSV row unless you have picked a specific <strong>Target Trail</strong> from the dropdown above as a fallback.
                </li>
                <li>
                  <strong>Column-wise Extended Activities:</strong> You can extend activities column-wise on the same day row using columns <code>Activity Description 1</code>, <code>Activity Description 2</code>, <code>Activity Description 3</code>, <code>Activity Description 4</code>, <code>Activity Description 5</code> (plus optional companion columns <code>Activity Title 1..5</code>, <code>Start Time 1..5</code>, <code>End Time 1..5</code>). This allows an entire day's schedule with multiple activities to be imported in a single row.
                </li>
                <li>
                  <strong>Row-wise Multiple Activities per Day:</strong> Alternatively, you can include multiple rows with the same <code>Trail Id</code> and <code>Day</code> to register multiple activities row-by-row. Destination, Itinerary narrative, Hotel, and Meal Plan are consolidated cleanly.
                </li>
                <li>
                  <strong>Re-importing & Updates:</strong> Re-uploading a CSV updates existing days and appends new activities without deleting your trail settings or enrolled guests.
                </li>
              </ul>
            </div>
          </section>
        </div>
      )}

      {/* GUEST DETAILS TABLE TAB */}
      {tab === "details" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="admin-card">
            <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
              <div>
                <h2 className="serif">Guest Details Table</h2>
                <p className="admin-hint" style={{ margin: "4px 0 0" }}>
                  Field names match the <strong>Guest Details Table</strong> specification. Includes Date of Birth, PAN, Passport, Visa details (Visa No., Expiry & Country), Travel Insurance, and Food Preferences.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <a
                  href="/api/admin/users/import?type=guest_details"
                  download="guest_details_import_template.csv"
                  className="btn btn-secondary"
                >
                  Download Guest Details Template
                </a>
                <Link href="/admin/users" className="link-btn">
                  View Guests Directory →
                </Link>
              </div>
            </div>

            {detailsError && <p className="form-error" role="alert" style={{ marginBottom: "16px" }}>{detailsError}</p>}
            {detailsNotice && <p className="form-notice" role="status" style={{ marginBottom: "16px" }}>{detailsNotice}</p>}

            <form onSubmit={handleDetailsSubmit} style={{ marginTop: "16px" }}>
              <div
                style={{
                  border: "2px dashed var(--line, #334155)",
                  borderRadius: "8px",
                  padding: "24px",
                  textAlign: "center",
                  background: "var(--paper, rgba(255, 255, 255, 0.02))",
                  marginBottom: "16px",
                }}
              >
                <input
                  ref={detailsInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const f = e.target.files?.[0] || null;
                    setDetailsFile(f);
                    setDetailsError("");
                  }}
                  disabled={detailsImporting}
                  id="details-csv-input"
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="details-csv-input"
                  style={{
                    display: "inline-block",
                    cursor: "pointer",
                    padding: "10px 18px",
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    fontWeight: 500,
                    marginBottom: "8px",
                  }}
                >
                  {detailsFile ? "Change CSV File" : "Select CSV File"}
                </label>
                {detailsFile ? (
                  <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--foreground)" }}>
                    Selected file: <strong>{detailsFile.name}</strong> ({(detailsFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <p className="admin-hint" style={{ margin: "6px 0 0" }}>
                    Select a UTF-8 CSV file containing Guest Details Table records
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={detailsImporting || !detailsFile}
                >
                  {detailsImporting ? "Processing Batch…" : "Upload & Import Guest Details"}
                </button>
                {detailsFile && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={detailsImporting}
                    onClick={() => {
                      setDetailsFile(null);
                      if (detailsInputRef.current) detailsInputRef.current.value = "";
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            {detailsReport && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <h3 className="serif" style={{ margin: "0 0 10px", fontSize: "1.1rem", color: "#0f172a" }}>Import Summary</h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span className="pill mandatory">Created/Updated: {detailsReport.created}</span>
                  <span className="pill optional">Skipped (duplicates): {detailsReport.skipped}</span>
                  {detailsReport.errorCount > 0 && (
                    <span className="pill off" style={{ color: "#ef4444", borderColor: "#ef4444", fontWeight: 700 }}>
                      Errors: {detailsReport.errorCount}
                    </span>
                  )}
                </div>

                {detailsReport.errorCount > 0 && detailsReport.results && (
                  <div style={{ marginTop: "12px" }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--color-danger, #ef4444)" }}>
                      Failed Records ({detailsReport.errorCount}):
                    </h4>
                    <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "4px" }}>
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>User Id</th>
                            <th>Error Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailsReport.results
                            .filter((r) => r.status === "error")
                            .map((r, i) => (
                              <tr key={i}>
                                <td className="mono">{r.row}</td>
                                <td className="mono">{r.phone || "—"}</td>
                                <td style={{ color: "var(--color-danger, #ef4444)" }}>{r.error}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="admin-card">
            <h3 className="serif" style={{ margin: "0 0 10px" }}>Guest Details Table Field Names Specification</h3>
            <p className="admin-hint">
              Field names exactly match the <strong>Payana Mitra App - Table Details</strong> sheet:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>Field Type</th>
                    <th>Limit / Field Size</th>
                    <th>Requirement</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>Mobile Number</strong> (User Id)</td>
                    <td>10-15 digit mobile number (used as User Id)</td>
                    <td>10 to 15 digits</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td className="mono">9019911700</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>First Name</strong></td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td>Arvind</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Last Name</strong></td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td>Kamath</td>
                  </tr>
                  <tr>
                    <td className="mono">Date of Birth</td>
                    <td>Calendar date (DD/MM/YY, DD/MM/YYYY, or DD-MM-YYYY)</td>
                    <td>Valid date format</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">18/06/65</td>
                  </tr>
                  <tr>
                    <td className="mono">PAN</td>
                    <td>AlphaNumeric (Encrypted at rest)</td>
                    <td>10 alphanumeric characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">AAADK9754A</td>
                  </tr>
                  <tr>
                    <td className="mono">Passport No.</td>
                    <td>AlphaNumeric (Encrypted at rest)</td>
                    <td>10 alphanumeric characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">ZA495775</td>
                  </tr>
                  <tr>
                    <td className="mono">Passport Issue Date</td>
                    <td>Calendar date (DD/MM/YY, DD/MM/YYYY, or DD-MM-YYYY)</td>
                    <td>Valid date format</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">19/07/20</td>
                  </tr>
                  <tr>
                    <td className="mono">Passport Expiry Date</td>
                    <td>Calendar date (DD/MM/YY, DD/MM/YYYY, or DD-MM-YYYY)</td>
                    <td>Valid date format</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">18/07/30</td>
                  </tr>
                  <tr>
                    <td className="mono">Passport Issued Location</td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Bangalore</td>
                  </tr>
                  <tr>
                    <td className="mono">Visa No.</td>
                    <td>AlphaNumeric (Encrypted at rest)</td>
                    <td>10 alphanumeric characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">V123456789</td>
                  </tr>
                  <tr>
                    <td className="mono">Visa Expiry Date</td>
                    <td>Calendar date (DD/MM/YY, DD/MM/YYYY, or DD-MM-YYYY)</td>
                    <td>Valid date format</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">15/08/28</td>
                  </tr>
                  <tr>
                    <td className="mono">Country</td>
                    <td>Alphabetic / text (Country for visa)</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Singapore</td>
                  </tr>
                  <tr>
                    <td className="mono">Travel Insurance No.</td>
                    <td>AlphaNumeric</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">7103167389</td>
                  </tr>
                  <tr>
                    <td className="mono">Travel Insurance Company</td>
                    <td>Alphabetic with special characters</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>TATA AIG</td>
                  </tr>
                  <tr>
                    <td className="mono">Travel Insurance Expiry Date</td>
                    <td>Calendar date (DD/MM/YY, DD/MM/YYYY, or DD-MM-YYYY)</td>
                    <td>Valid date format</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">10/09/26</td>
                  </tr>
                  <tr>
                    <td className="mono">Food Preference</td>
                    <td>Dropdown (Veg / Non Veg)</td>
                    <td>Enum (Veg / Non Veg)</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Veg</td>
                  </tr>
                  <tr>
                    <td className="mono">Food Allergy</td>
                    <td>Alphabetic with special characters</td>
                    <td>Max 30 characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Peanuts and Milk</td>
                  </tr>
                  <tr>
                    <td className="mono">Emergency Contact Name</td>
                    <td>Alphabetic with special characters</td>
                    <td>Max 20 characters</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td>Anita Kamath</td>
                  </tr>
                  <tr>
                    <td className="mono">Emergency Contact Number</td>
                    <td>Numeric only (10 digits)</td>
                    <td>10 digits numeric</td>
                    <td><span className="pill optional">Optional</span></td>
                    <td className="mono">9019911700</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TRAIL TO GUEST MAPPING TAB */}
      {tab === "mapping" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="admin-card">
            <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
              <div>
                <h2 className="serif">Trail to Guest Mapping (Enrolment)</h2>
                <p className="admin-hint" style={{ margin: "4px 0 0" }}>
                  Map registered Guests to their scheduled Trails using their <strong>Mobile Number</strong> and <strong>Trail Id</strong>.
                  Without this mapping, guests will not be able to get details of the Trail they will be undertaking.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <a
                  href="/api/admin/trips/mapping/import"
                  download="trail_guest_mapping_template.csv"
                  className="btn btn-secondary"
                >
                  Download Mapping Template
                </a>
                <Link href="/admin/trips" className="link-btn">
                  View Trails →
                </Link>
                <Link href="/admin/users" className="link-btn">
                  View Guests →
                </Link>
              </div>
            </div>

            {mappingError && <p className="form-error" role="alert" style={{ marginBottom: "16px" }}>{mappingError}</p>}
            {mappingNotice && <p className="form-notice" role="status" style={{ marginBottom: "16px" }}>{mappingNotice}</p>}

            <form onSubmit={handleMappingSubmit} style={{ marginTop: "16px" }}>
              <div
                style={{
                  border: "2px dashed var(--line, #334155)",
                  borderRadius: "8px",
                  padding: "24px",
                  textAlign: "center",
                  background: "var(--paper, rgba(255, 255, 255, 0.02))",
                  marginBottom: "16px",
                }}
              >
                <input
                  ref={mappingInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const f = e.target.files?.[0] || null;
                    setMappingFile(f);
                    setMappingError("");
                  }}
                  disabled={mappingImporting}
                  id="mapping-csv-input"
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="mapping-csv-input"
                  style={{
                    display: "inline-block",
                    cursor: "pointer",
                    padding: "10px 18px",
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                    fontWeight: 500,
                    marginBottom: "8px",
                  }}
                >
                  {mappingFile ? "Change CSV File" : "Select CSV File"}
                </label>
                {mappingFile ? (
                  <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--foreground)" }}>
                    Selected file: <strong>{mappingFile.name}</strong> ({(mappingFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <p className="admin-hint" style={{ margin: "6px 0 0" }}>
                    Select a UTF-8 CSV containing <code>Mobile Number of the Guest</code> and <code>Trail Id</code>
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={mappingImporting || !mappingFile}
                >
                  {mappingImporting ? "Mapping Guests…" : "Upload & Map Guests"}
                </button>
                {mappingFile && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={mappingImporting}
                    onClick={() => {
                      setMappingFile(null);
                      if (mappingInputRef.current) mappingInputRef.current.value = "";
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            {mappingReport && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <h3 className="serif" style={{ margin: "0 0 10px", fontSize: "1.1rem", color: "#0f172a" }}>Mapping Summary</h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span className="pill mandatory">Mapped / Enrolled: {mappingReport.created}</span>
                  <span className="pill optional">Skipped (already mapped): {mappingReport.skipped}</span>
                  {mappingReport.errorCount > 0 && (
                    <span className="pill off" style={{ color: "#ef4444", borderColor: "#ef4444", fontWeight: 700 }}>
                      Errors: {mappingReport.errorCount}
                    </span>
                  )}
                </div>

                {mappingReport.results && mappingReport.results.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: "14px" }}>
                      Processed Records ({mappingReport.results.length}):
                    </h4>
                    <div style={{ maxHeight: "320px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "4px" }}>
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Mobile Number</th>
                            <th>Guest Name</th>
                            <th>Trail Id</th>
                            <th>Trail Name</th>
                            <th>Status</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mappingReport.results.map((r, i) => (
                            <tr key={i}>
                              <td className="mono">{r.row}</td>
                              <td className="mono">{r.phone || "—"}</td>
                              <td>{r.guest_name || "—"}</td>
                              <td className="mono">{r.trip_code || "—"}</td>
                              <td>{r.trip_name || "—"}</td>
                              <td>
                                <span
                                  className={`pill ${
                                    r.status === "created" ? "on" : r.status === "skipped" ? "neutral" : "off"
                                  }`}
                                  style={
                                    r.status === "error"
                                      ? { color: "#ef4444", borderColor: "#ef4444" }
                                      : undefined
                                  }
                                >
                                  {r.status === "created"
                                    ? "Mapped"
                                    : r.status === "skipped"
                                    ? "Skipped"
                                    : "Failed"}
                                </span>
                              </td>
                              <td style={r.status === "error" ? { color: "var(--color-danger, #ef4444)" } : undefined}>
                                {r.error || (r.status === "created" ? "Enrolled successfully" : "—")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="admin-card">
            <h3 className="serif" style={{ margin: "0 0 10px" }}>Trail to Guest Mapping Field Specification</h3>
            <p className="admin-hint">
              This utility requires only <strong>2 fields</strong> in the CSV file:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>Aliases Accepted</th>
                    <th>Description</th>
                    <th>Limit / Field Size</th>
                    <th>Requirement</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>Mobile Number of the Guest</strong></td>
                    <td><code>Mobile Number</code>, <code>Mobile</code>, <code>Phone</code>, <code>User Id</code></td>
                    <td>10-15 digit mobile number of the registered Guest.</td>
                    <td>10 to 15 digits</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td className="mono">9019911700</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Trail Id</strong></td>
                    <td><code>TrailId</code>, <code>Trail Code</code>, <code>Trip Code</code>, <code>trail_id</code></td>
                    <td>Unique identifier / 8-char code of the Trail (e.g. <code>HIHGOK01</code>).</td>
                    <td>8 characters</td>
                    <td><span className="pill mandatory">Mandatory</span></td>
                    <td className="mono">HIHGOK01</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div
              style={{
                marginTop: "14px",
                padding: "12px 16px",
                background: "#f1f5f9",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "13.5px",
                color: "#1e293b",
                lineHeight: 1.6,
              }}
            >
              <strong>Tip:</strong> If a guest is already mapped to a trail, re-uploading will safely skip the duplicate without error. If a guest or trail is not found, the specific row will be flagged with a clear error while the remaining valid rows are processed.
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
