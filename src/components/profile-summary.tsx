import Link from "next/link";

export type CompletionItem = { label: string; done: boolean; href: string };

function StatTile({
  value,
  label,
  note,
  href,
  cta,
}: {
  value: string;
  label: string;
  note: string;
  href: string;
  cta: string;
}) {
  return (
    <Link className="stat-tile" href={href}>
      <span className="stat-value serif">{value}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-note">{note}</span>
      <span className="stat-cta">{cta} →</span>
    </Link>
  );
}

export default function ProfileSummary({
  trips,
  documents,
  completion,
  missing,
}: {
  trips: { current: number; upcoming: number; past: number };
  documents: number;
  completion: CompletionItem[];
  missing: CompletionItem[];
}) {
  const done = completion.filter((item) => item.done).length;
  const percent = Math.round((done / completion.length) * 100);

  return (
    <>
      <section className="panel">
        <h2 className="serif">Your profile</h2>
        <p className="panel-note">
          {percent === 100
            ? "Everything a coordinator needs is filled in. Thank you."
            : "Fill in the details below so your coordinator can reach you and plan around your needs."}
        </p>

        <div
          className="profile-meter"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completion"
        >
          <div className="profile-meter-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="profile-meter-label">
          {percent}% complete · {done} of {completion.length} details filled in
        </p>

        {missing.length > 0 ? (
          <ul className="profile-todo">
            {missing.map((item) => (
              <li key={item.label}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel-note">Nothing outstanding.</p>
        )}
      </section>

      <section className="panel">
        <h2 className="serif">At a glance</h2>
        <p className="panel-note">Your trips, documents and account history.</p>

        <div className="stat-grid">
          <StatTile
            value={String(trips.current + trips.upcoming + trips.past)}
            label="Trips joined"
            note={`${trips.current} now · ${trips.upcoming} upcoming · ${trips.past} past`}
            href="/dashboard"
            cta="View trips"
          />
          <StatTile
            value={String(documents)}
            label={documents === 1 ? "Document saved" : "Documents saved"}
            note="PAN, passport, visa and anything else your trip needs"
            href="/dashboard/documents"
            cta="Manage documents"
          />
        </div>
      </section>
    </>
  );
}
