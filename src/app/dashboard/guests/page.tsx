import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function LeaderGuestsPage() {
  const profile = await requireProfile();
  if (profile.role !== "leader" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: guests, error } = await (admin.from("profiles") as any)
    .select("id, phone, first_name, last_name, email, location, is_active, date_of_joining, remarks, traveller_details(*)")
    .eq("leader_id", profile.id)
    .order("first_name", { ascending: true });

  return (
    <div className="trip-detail">
      <header className="page-head">
        <div>
          <div className="eyebrow">Trail Leadership</div>
          <h1 className="serif">Assigned Guests</h1>
          <p>
            Guests currently assigned under your trail leadership. Review their dietary,
            emergency, and insurance details to ensure a seamless journey.
          </p>
        </div>
      </header>

      {error ? (
        <p className="form-error">Could not load assigned guests: {error.message}</p>
      ) : !guests || guests.length === 0 ? (
        <section className="panel">
          <p className="panel-note">No guests are currently assigned to you.</p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          {guests.map((guest: {
            id: string;
            first_name: string;
            last_name: string;
            phone: string;
            email?: string | null;
            location?: string | null;
            remarks?: string | null;
            traveller_details?: Array<{
              dob?: string | null;
              food_preference?: string | null;
              food_allergy?: string | null;
              emergency_contact_name?: string | null;
              emergency_contact_no?: string | null;
              travel_insurance_no?: string | null;
              insurance_company?: string | null;
            }> | {
              dob?: string | null;
              food_preference?: string | null;
              food_allergy?: string | null;
              emergency_contact_name?: string | null;
              emergency_contact_no?: string | null;
              travel_insurance_no?: string | null;
              insurance_company?: string | null;
            } | null;
          }) => {
            const details = Array.isArray(guest.traveller_details)
              ? guest.traveller_details[0]
              : guest.traveller_details;

            return (
              <article key={guest.id} className="panel" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
                  <div>
                    <h2 className="serif" style={{ margin: 0, fontSize: "1.3rem" }}>
                      {guest.first_name} {guest.last_name}
                    </h2>
                    <div className="muted small" style={{ marginTop: "4px" }}>
                      <span className="mono">{guest.phone}</span>
                      {guest.email && ` · ${guest.email}`}
                      {guest.location && ` · ${guest.location}`}
                    </div>
                  </div>
                  {details?.food_preference && (
                    <span className="pill on" style={{ textTransform: "none", fontWeight: 600 }}>
                      {details.food_preference === "veg" ? "Veg" : details.food_preference === "non_veg" ? "Non Veg" : details.food_preference}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", paddingTop: "12px", borderTop: "1px solid var(--color-border, rgba(255,255,255,0.08))" }}>
                  <div>
                    <span className="eyebrow" style={{ fontSize: "10px", display: "block", marginBottom: "4px" }}>Emergency Contact</span>
                    {details?.emergency_contact_name ? (
                      <div>
                        <strong>{details.emergency_contact_name}</strong>
                        {details.emergency_contact_no && (
                          <div className="mono small muted">{details.emergency_contact_no}</div>
                        )}
                      </div>
                    ) : (
                      <span className="muted small">Not provided</span>
                    )}
                  </div>

                  <div>
                    <span className="eyebrow" style={{ fontSize: "10px", display: "block", marginBottom: "4px" }}>Food Allergy</span>
                    <span className={details?.food_allergy ? "bold" : "muted small"}>
                      {details?.food_allergy || "None reported"}
                    </span>
                  </div>

                  <div>
                    <span className="eyebrow" style={{ fontSize: "10px", display: "block", marginBottom: "4px" }}>Travel Insurance</span>
                    {details?.travel_insurance_no ? (
                      <div>
                        <strong className="mono small">{details.travel_insurance_no}</strong>
                        {details.insurance_company && (
                          <div className="muted small">{details.insurance_company}</div>
                        )}
                      </div>
                    ) : (
                      <span className="muted small">Not provided</span>
                    )}
                  </div>

                  {guest.remarks && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span className="eyebrow" style={{ fontSize: "10px", display: "block", marginBottom: "4px" }}>Remarks</span>
                      <p className="small muted" style={{ margin: 0 }}>{guest.remarks}</p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
