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

export default function CsvImportAdmin({ initialTab = "guests" }: { initialTab?: "guests" | "trails" }) {
  const router = useRouter();
  const [tab, setTab] = useState<"guests" | "trails">(initialTab);

  // Guests import state
  const [guestFile, setGuestFile] = useState<File | null>(null);
  const [guestImporting, setGuestImporting] = useState(false);
  const [guestReport, setGuestReport] = useState<ImportResult | null>(null);
  const [guestError, setGuestError] = useState("");
  const [guestNotice, setGuestNotice] = useState("");
  const guestInputRef = useRef<HTMLInputElement | null>(null);

  // Trails import state
  const [trailFile, setTrailFile] = useState<File | null>(null);
  const [trailImporting, setTrailImporting] = useState(false);
  const [trailReport, setTrailReport] = useState<ImportResult | null>(null);
  const [trailError, setTrailError] = useState("");
  const [trailNotice, setTrailNotice] = useState("");
  const trailInputRef = useRef<HTMLInputElement | null>(null);

  async function handleGuestSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guestFile) {
      setGuestError("Please select a CSV file to upload.");
      return;
    }

    setGuestImporting(true);
    setGuestError("");
    setGuestNotice("");
    setGuestReport(null);

    try {
      const fd = new FormData();
      fd.append("file", guestFile);

      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => null);
      setGuestImporting(false);

      if (!res.ok) {
        setGuestError(json?.error ?? "Failed to import guest accounts.");
        return;
      }

      setGuestReport(json);
      setGuestNotice(`Guests CSV successfully imported: ${json.created} created, ${json.skipped} skipped.`);
      if (guestInputRef.current) guestInputRef.current.value = "";
      setGuestFile(null);
      router.refresh();
    } catch {
      setGuestImporting(false);
      setGuestError("Network error while importing guest CSV.");
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

  return (
    <div>
      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--line)" }}>
        <button
          type="button"
          onClick={() => setTab("guests")}
          className={`link-btn ${tab === "guests" ? "active" : ""}`}
          style={{
            padding: "10px 18px",
            fontSize: "15px",
            fontWeight: 600,
            borderBottom: tab === "guests" ? "2px solid var(--forest, #2d5a27)" : "2px solid transparent",
            color: tab === "guests" ? "var(--forest, #2d5a27)" : "var(--muted)",
            background: "none",
            cursor: "pointer",
            borderRadius: "0",
          }}
        >
          Guests CSV Upload
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
          Trails CSV Upload
        </button>
      </div>

      {/* GUESTS TAB */}
      {tab === "guests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="admin-card">
            <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
              <div>
                <h2 className="serif">Import Guests</h2>
                <p className="admin-hint" style={{ margin: "4px 0 0" }}>
                  Bulk create guest and leader accounts from a spreadsheet. Existing phone numbers are automatically skipped. Initial PIN is the last 4 digits of the phone.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <a
                  href="/api/admin/users/import"
                  download="users_import_template.csv"
                  className="btn btn-secondary"
                >
                  Download Guests CSV Template
                </a>
                <Link href="/admin/users" className="link-btn">
                  View Guests Directory →
                </Link>
              </div>
            </div>

            {guestError && <p className="form-error" role="alert" style={{ marginBottom: "16px" }}>{guestError}</p>}
            {guestNotice && <p className="form-notice" role="status" style={{ marginBottom: "16px" }}>{guestNotice}</p>}

            <form onSubmit={handleGuestSubmit} style={{ marginTop: "16px" }}>
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
                  ref={guestInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const f = e.target.files?.[0] || null;
                    setGuestFile(f);
                    setGuestError("");
                  }}
                  disabled={guestImporting}
                  id="guest-csv-input"
                  style={{ display: "none" }}
                />
                <label
                  htmlFor="guest-csv-input"
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
                  {guestFile ? "Change CSV File" : "Select CSV File"}
                </label>
                {guestFile ? (
                  <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--foreground)" }}>
                    Selected file: <strong>{guestFile.name}</strong> ({(guestFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <p className="admin-hint" style={{ margin: "6px 0 0" }}>
                    Select a UTF-8 CSV file containing guest records
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={guestImporting || !guestFile}
                >
                  {guestImporting ? "Processing Batch…" : "Upload & Import Guests"}
                </button>
                {guestFile && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={guestImporting}
                    onClick={() => {
                      setGuestFile(null);
                      if (guestInputRef.current) guestInputRef.current.value = "";
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            {guestReport && (
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
                  <span className="pill on">Created: {guestReport.created}</span>
                  <span className="pill off">Skipped (duplicates): {guestReport.skipped}</span>
                  {guestReport.errorCount > 0 && (
                    <span className="pill off" style={{ color: "#ef4444", borderColor: "#ef4444" }}>
                      Errors: {guestReport.errorCount}
                    </span>
                  )}
                </div>

                {guestReport.errorCount > 0 && guestReport.results && (
                  <div style={{ marginTop: "12px" }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--color-danger, #ef4444)" }}>
                      Failed Records ({guestReport.errorCount}):
                    </h4>
                    <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "4px" }}>
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Phone</th>
                            <th>Error Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {guestReport.results
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
            <h3 className="serif" style={{ margin: "0 0 10px" }}>Guests CSV Format Specification</h3>
            <p className="admin-hint">
              The CSV file must include headers in the first row. Extra spaces are trimmed automatically.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Required</th>
                    <th>Allowed Values / Format</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>phone</strong></td>
                    <td><span className="pill on">Required</span></td>
                    <td>10 to 15 digits (standard phone number)</td>
                    <td className="mono">9876543210</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>first_name</strong></td>
                    <td><span className="pill on">Required</span></td>
                    <td>First name (max 50 characters)</td>
                    <td>Aarav</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>last_name</strong></td>
                    <td><span className="pill on">Required</span></td>
                    <td>Last name (max 50 characters)</td>
                    <td>Patel</td>
                  </tr>
                  <tr>
                    <td className="mono">role</td>
                    <td>Optional</td>
                    <td><code>guest</code>, <code>traveller</code>, <code>leader</code>, or <code>admin</code> (default: guest)</td>
                    <td>guest</td>
                  </tr>
                  <tr>
                    <td className="mono">leader_phone</td>
                    <td>Optional</td>
                    <td>Phone number of an active leader to assign the guest to</td>
                    <td className="mono">9000000002</td>
                  </tr>
                  <tr>
                    <td className="mono">email</td>
                    <td>Optional</td>
                    <td>Valid email address for communications</td>
                    <td>aarav@example.com</td>
                  </tr>
                  <tr>
                    <td className="mono">location</td>
                    <td>Optional</td>
                    <td>Home city or region (max 50 characters)</td>
                    <td>Bengaluru</td>
                  </tr>
                  <tr>
                    <td className="mono">date_of_joining</td>
                    <td>Optional</td>
                    <td>YYYY-MM-DD format</td>
                    <td className="mono">2026-01-15</td>
                  </tr>
                  <tr>
                    <td className="mono">remarks</td>
                    <td>Optional</td>
                    <td>Freeform notes, dietary or special requests</td>
                    <td>Enjoys mountain treks</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TRAILS TAB */}
      {tab === "trails" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section className="admin-card">
            <div className="admin-card-head" style={{ flexWrap: "wrap", gap: "12px", alignItems: "flex-start" }}>
              <div>
                <h2 className="serif">Import Trails</h2>
                <p className="admin-hint" style={{ margin: "4px 0 0" }}>
                  Bulk create trails from a spreadsheet. Existing trail codes are automatically skipped. Imported trails are placed in Draft status ready for itinerary setup.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <a
                  href="/api/admin/trips/import"
                  download="trails_import_template.csv"
                  className="btn btn-secondary"
                >
                  Download Trails CSV Template
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
                    Select a UTF-8 CSV file containing trail records
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
                            <th>Trail Code</th>
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
            <h3 className="serif" style={{ margin: "0 0 10px" }}>Trails CSV Format Specification</h3>
            <p className="admin-hint">
              The CSV file must include headers in the first row. Maximum 200 trails per import batch.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Required</th>
                    <th>Allowed Values / Format</th>
                    <th>Example</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono"><strong>trip_code</strong></td>
                    <td><span className="pill on">Required</span></td>
                    <td>Unique identifier, max 50 chars</td>
                    <td className="mono">TRIP-2026-01</td>
                  </tr>
                  <tr>
                    <td className="mono"><strong>name</strong></td>
                    <td><span className="pill on">Required</span></td>
                    <td>Trail name, max 100 chars</td>
                    <td>Hampta Pass Trek</td>
                  </tr>
                  <tr>
                    <td className="mono">destination</td>
                    <td>Optional</td>
                    <td>Destination or region name (max 100 chars)</td>
                    <td>Manali, Himachal Pradesh</td>
                  </tr>
                  <tr>
                    <td className="mono">start_date</td>
                    <td>Optional</td>
                    <td>YYYY-MM-DD format</td>
                    <td className="mono">2026-06-15</td>
                  </tr>
                  <tr>
                    <td className="mono">end_date</td>
                    <td>Optional</td>
                    <td>YYYY-MM-DD format (must be on or after start_date)</td>
                    <td className="mono">2026-06-20</td>
                  </tr>
                  <tr>
                    <td className="mono">leader_phone</td>
                    <td>Optional</td>
                    <td>Phone number of assigned leader</td>
                    <td className="mono">9000000002</td>
                  </tr>
                  <tr>
                    <td className="mono">remarks</td>
                    <td>Optional</td>
                    <td>Trail overview notes (max 2000 chars)</td>
                    <td>Moderate high-altitude summer trail</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card" style={{ background: "var(--paper)" }}>
            <h4 className="serif" style={{ margin: "0 0 6px" }}>Tip: Importing Days & Itinerary Activities</h4>
            <p className="admin-hint" style={{ margin: 0 }}>
              After creating your trails, you can bulk import daily itineraries, hotel bookings, meal plans, and activity schedules via CSV directly on the trail edit page. Open any trail from <Link href="/admin/trips">Trails</Link> and click <strong>Import CSV</strong> in the Days section.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
