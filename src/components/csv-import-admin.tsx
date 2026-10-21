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
    status: "created" | "skipped" | "error";
    error?: string;
  }>;
}

export default function CsvImportAdmin({ initialTab = "users" }: { initialTab?: "users" | "trails" | "details" }) {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "trails" | "details">(
    initialTab === "trails" ? "trails" : initialTab === "details" ? "details" : "users"
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

  // Guest Details import state
  const [detailsFile, setDetailsFile] = useState<File | null>(null);
  const [detailsImporting, setDetailsImporting] = useState(false);
  const [detailsReport, setDetailsReport] = useState<ImportResult | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [detailsNotice, setDetailsNotice] = useState("");
  const detailsInputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <div>
      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--line)" }}>
        <button
          type="button"
          onClick={() => setTab("users")}
          className={`link-btn ${tab === "users" ? "active" : ""}`}
          style={{
            padding: "10px 18px",
            fontSize: "15px",
            fontWeight: 600,
            borderBottom: tab === "users" ? "2px solid var(--forest, #2d5a27)" : "2px solid transparent",
            color: tab === "users" ? "var(--forest, #2d5a27)" : "var(--muted)",
            background: "none",
            cursor: "pointer",
            borderRadius: "0",
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
            fontSize: "15px",
            fontWeight: 600,
            borderBottom: tab === "trails" ? "2px solid var(--forest, #2d5a27)" : "2px solid transparent",
            color: tab === "trails" ? "var(--forest, #2d5a27)" : "var(--muted)",
            background: "none",
            cursor: "pointer",
            borderRadius: "0",
          }}
        >
          Trail Table (Trails)
        </button>
        <button
          type="button"
          onClick={() => setTab("details")}
          className={`link-btn ${tab === "details" ? "active" : ""}`}
          style={{
            padding: "10px 18px",
            fontSize: "15px",
            fontWeight: 600,
            borderBottom: tab === "details" ? "2px solid var(--forest, #2d5a27)" : "2px solid transparent",
            color: tab === "details" ? "var(--forest, #2d5a27)" : "var(--muted)",
            background: "none",
            cursor: "pointer",
            borderRadius: "0",
          }}
        >
          Guest Details Table
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
                  background: "var(--color-surface, #1e293b)",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #334155)",
                }}
              >
                <h3 className="serif" style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Import Summary</h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span className="pill on">Created/Updated: {userReport.created}</span>
                  <span className="pill off">Skipped (duplicates): {userReport.skipped}</span>
                  {userReport.errorCount > 0 && (
                    <span className="pill off" style={{ color: "#ef4444", borderColor: "#ef4444" }}>
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
              Field names exactly match the <strong>Payana Mitra App - Table Details</strong> sheet:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Field Name</th>
                    <th>Field Type</th>
                    <th>Limit</th>
                    <th>Mandatory</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>User Id</strong></td>
                    <td>10 digit Mobile Number</td>
                    <td>10 digits</td>
                    <td><span className="pill on">Yes</span></td>
                    <td className="mono">9019911700</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Password</strong></td>
                    <td>Last 4 digits of Mobile Number (auto-generated)</td>
                    <td>4 digits</td>
                    <td><span className="pill on">Yes</span></td>
                    <td className="mono">1700</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>First Name</strong></td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>20 characters</td>
                    <td><span className="pill on">Yes</span></td>
                    <td>Arvind</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Last Name</strong></td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>20 characters</td>
                    <td><span className="pill on">Yes</span></td>
                    <td>Kamath</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Role</strong></td>
                    <td>Guest / Leader / Admin</td>
                    <td>Not Applicable</td>
                    <td><span className="pill on">Yes</span></td>
                    <td>Guest (default)</td>
                  </tr>
                  <tr>
                    <td className="mono">Leader Name</td>
                    <td>Name or phone of assigned Trail Leader (for Guests)</td>
                    <td>Not Applicable</td>
                    <td>Optional</td>
                    <td>Anushree Kini</td>
                  </tr>
                  <tr>
                    <td className="mono">Date of Joining</td>
                    <td>DD/MM/YYYY or DD-MM-YYYY</td>
                    <td>Not Applicable</td>
                    <td>Optional</td>
                    <td className="mono">18-06-2025</td>
                  </tr>
                  <tr>
                    <td className="mono">Active / Inactive</td>
                    <td>Active or Inactive (default: Active)</td>
                    <td>Not Applicable</td>
                    <td>Optional</td>
                    <td>Active</td>
                  </tr>
                  <tr>
                    <td className="mono">Location</td>
                    <td>Home city or region</td>
                    <td>20 characters</td>
                    <td>Optional</td>
                    <td>Bengaluru</td>
                  </tr>
                  <tr>
                    <td className="mono">email id</td>
                    <td>Alphanumeric with special characters @ and .</td>
                    <td>No limit</td>
                    <td>Optional</td>
                    <td>arvindakamath@gmail.com</td>
                  </tr>
                  <tr>
                    <td className="mono">Mobile Number</td>
                    <td>Numeric only (10 digits)</td>
                    <td>10 digits</td>
                    <td><span className="pill on">Yes</span></td>
                    <td className="mono">9019911700</td>
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
                  background: "var(--color-surface, #1e293b)",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #334155)",
                }}
              >
                <h3 className="serif" style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Import Summary</h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span className="pill on">Created: {trailReport.created}</span>
                  <span className="pill off">Skipped (duplicates): {trailReport.skipped}</span>
                  {trailReport.errorCount > 0 && (
                    <span className="pill off" style={{ color: "#ef4444", borderColor: "#ef4444" }}>
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
                    <th>Limit</th>
                    <th>Mandatory</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>Trail Id</strong></td>
                    <td>Auto-generated / Unique code</td>
                    <td>3 digits / alphanumeric</td>
                    <td><span className="pill on">Yes</span></td>
                    <td className="mono">003</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Trail Name</strong></td>
                    <td>Alphanumeric</td>
                    <td>20 digits / characters</td>
                    <td><span className="pill on">Yes</span></td>
                    <td>The Asian Amazon Trail</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Destination</strong></td>
                    <td>Alphanumeric</td>
                    <td>20 digits / characters</td>
                    <td><span className="pill on">Yes</span></td>
                    <td>Borneo</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Start Date</strong></td>
                    <td>Calendar date (DD-MM-YYYY)</td>
                    <td>DD-MM-YYYY</td>
                    <td><span className="pill on">Yes</span></td>
                    <td className="mono">15-06-2026</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>End Date</strong></td>
                    <td>Calendar date (DD-MM-YYYY)</td>
                    <td>DD-MM-YYYY</td>
                    <td><span className="pill on">Yes</span></td>
                    <td className="mono">20-06-2026</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Leader</strong></td>
                    <td>Assigned Trail Leader name or phone</td>
                    <td>As per Table data</td>
                    <td>Optional</td>
                    <td>Devika Mohan</td>
                  </tr>
                  <tr>
                    <td className="mono">Active / Inactive</td>
                    <td>Dropdown (Active or Inactive)</td>
                    <td>Not Applicable</td>
                    <td>Optional</td>
                    <td>Active</td>
                  </tr>
                  <tr>
                    <td className="mono">Remarks</td>
                    <td>Trail overview notes</td>
                    <td>Free Text</td>
                    <td>Optional</td>
                    <td>Moderate summer trail</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card" style={{ background: "var(--paper)" }}>
            <h4 className="serif" style={{ margin: "0 0 6px" }}>Extension of Trail Table: Day wise Itinerary</h4>
            <p className="admin-hint" style={{ margin: "0 0 12px" }}>
              Per the sheet, the Day wise Itinerary contains: <code>Trail Id</code>, <code>Trail Name</code>, <code>Day</code>, <code>Destination</code>, <code>Itinerary</code>, <code>Hotel Name</code>.
            </p>
            <p className="admin-hint" style={{ margin: 0 }}>
              To upload day wise itinerary CSV, open any trail from <Link href="/admin/trips">Trails</Link>, click <strong>Edit</strong>, and use the <strong>Import CSV</strong> button in the Days & Itinerary section.
            </p>
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
                  Field names match the <strong>Guest Details Table</strong> specification. Includes Date of Birth, PAN, Passport, Travel Insurance, and Food Preferences.
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
                  background: "var(--color-surface, #1e293b)",
                  borderRadius: "8px",
                  border: "1px solid var(--color-border, #334155)",
                }}
              >
                <h3 className="serif" style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>Import Summary</h3>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <span className="pill on">Created/Updated: {detailsReport.created}</span>
                  <span className="pill off">Skipped (duplicates): {detailsReport.skipped}</span>
                  {detailsReport.errorCount > 0 && (
                    <span className="pill off" style={{ color: "#ef4444", borderColor: "#ef4444" }}>
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
                    <th>Limit</th>
                    <th>Mandatory</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>User Id</strong></td>
                    <td>Auto-generated / 10-digit mobile number</td>
                    <td>10 digits</td>
                    <td><span className="pill on">Yes</span></td>
                    <td className="mono">9019911700</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>First Name</strong></td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>20 characters</td>
                    <td><span className="pill on">Yes</span></td>
                    <td>Arvind</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>Last Name</strong></td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>20 characters</td>
                    <td><span className="pill on">Yes</span></td>
                    <td>Kamath</td>
                  </tr>
                  <tr>
                    <td className="mono">Date of Birth</td>
                    <td>DD/MM/YYYY or DD-MM-YYYY</td>
                    <td>Not Applicable</td>
                    <td>No</td>
                    <td className="mono">18-06-1965</td>
                  </tr>
                  <tr>
                    <td className="mono">PAN</td>
                    <td>AlphaNumeric (Encrypted at rest)</td>
                    <td>10 characters</td>
                    <td>No</td>
                    <td className="mono">AAADK9754A</td>
                  </tr>
                  <tr>
                    <td className="mono">Passport No.</td>
                    <td>AlphaNumeric (Encrypted at rest)</td>
                    <td>10 characters</td>
                    <td>No</td>
                    <td className="mono">ZA495775</td>
                  </tr>
                  <tr>
                    <td className="mono">Passport Expiry Date</td>
                    <td>DD/MM/YYYY or DD-MM-YYYY</td>
                    <td>Not Applicable</td>
                    <td>No</td>
                    <td className="mono">18-07-2030</td>
                  </tr>
                  <tr>
                    <td className="mono">Passport Issued Location</td>
                    <td>Alphabetic with special characters like . and space</td>
                    <td>20 characters</td>
                    <td>No</td>
                    <td>Bangalore</td>
                  </tr>
                  <tr>
                    <td className="mono">Travel Insurance No.</td>
                    <td>AlphaNumeric</td>
                    <td>20 characters</td>
                    <td>No</td>
                    <td className="mono">7103167389</td>
                  </tr>
                  <tr>
                    <td className="mono">Travel Insurance Company</td>
                    <td>Alphabetic with special characters</td>
                    <td>20 characters</td>
                    <td>No</td>
                    <td>TATA AIG</td>
                  </tr>
                  <tr>
                    <td className="mono">Travel Insurance Expiry Date</td>
                    <td>DD/MM/YYYY or DD-MM-YYYY</td>
                    <td>Not Applicable</td>
                    <td>No</td>
                    <td className="mono">10-09-2026</td>
                  </tr>
                  <tr>
                    <td className="mono">Food Preference</td>
                    <td>Dropdown (Veg / Non Veg)</td>
                    <td>Not Applicable</td>
                    <td>No</td>
                    <td>Veg</td>
                  </tr>
                  <tr>
                    <td className="mono">Food Allergy</td>
                    <td>Alphabetic with special characters</td>
                    <td>30 characters</td>
                    <td>No</td>
                    <td>Peanuts and Milk</td>
                  </tr>
                  <tr>
                    <td className="mono">Emergency Contact Name</td>
                    <td>Alphabetic with special characters</td>
                    <td>20 characters</td>
                    <td>No</td>
                    <td>Anita Kamath</td>
                  </tr>
                  <tr>
                    <td className="mono">Emergency Contact Number</td>
                    <td>Numeric only (10 digits)</td>
                    <td>10 digits</td>
                    <td>No</td>
                    <td className="mono">9019911700</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
