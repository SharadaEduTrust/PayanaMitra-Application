import Link from "next/link";
import Brand from "@/components/brand";

const team = [
  { name: "Divyanshu", initials: "D" },
  { name: "Pratyush", initials: "P" },
  { name: "Adnan", initials: "A" },
];

export default function Home() {
  return (
    <main>
      <div className="container">
        <nav className="nav">
          <Brand size={76} />
          <div className="navlinks">
            <a href="#how">How it works</a>
            <a href="#why">Why Payana Mitra</a>
            <a href="#stories">Stories</a>
          </div>
          <div className="nav-actions">
            <Link href="/login" className="btn btn-primary">
              Sign in
            </Link>
          </div>
        </nav>
      </div>
      <section className="hero-photo">
        <picture>
          <source
            media="(min-width: 640px)"
            srcSet="/images/hero/trails-hero.webp"
          />
          <img
            src="/images/hero/trails-hero-mobile.webp"
            alt="A calm mountain lake ringed with snow-capped peaks"
          />
        </picture>
        <div className="hero-photo-inner container">
          <div className="eyebrow hero-eyebrow">Journeys, thoughtfully curated</div>
          <h1 className="serif">
            Curated Journeys for Guests who value{" "}
            <em>Stories over Sightseeing</em>
          </h1>
          <p className="hero-sub">
            Small groups. Deeper experiences. Journeys, thoughtfully curated!
          </p>
          <div className="hero-actions">
            <Link href="/login" className="btn btn-hero">
              Sign in to your trail
            </Link>
            <a href="#how" className="btn btn-hero-ghost">
              How it works
            </a>
          </div>
        </div>
      </section>
      <section className="container hero">
        <div>
          <div className="eyebrow">Your personal travel companion</div>
          <h2 className="serif">
            Go further.
            <br />
            <em>Plan smarter.</em>
          </h2>
          <p className="hero-copy">
            Payana Mitra turns the way you travel into a trail that actually
            feels like yours — thoughtful routes, local textures, and plans that
            leave room for the unexpected.
          </p>
          <div className="hero-actions">
            <Link href="/login" className="btn btn-primary">
              Sign in to your trail
            </Link>
            <a href="#how" className="btn btn-secondary">
              See how it works
            </a>
          </div>
          <div className="hero-note">
            <i /> No generic lists. No crowded itineraries.
          </div>
        </div>
        <div
          className="scene"
          aria-label="A folded map and travel backpack illustration"
        >
          <img
            className="scene-illustration"
            src="/illustrations/empty-state.webp"
            alt="A folded travel map beside a backpack"
          />
          <span className="route" />
          <span className="pin one" />
          <span className="pin two" />
          <span className="pin three" />
          <div className="scene-label">
            <small>Designed around you</small>
            <strong>Himalayas · 06 days</strong>
          </div>
        </div>
      </section>
      <div className="container trust">
        <span>
          For guests who prefer <strong>meaning over checklists</strong>
        </span>
        <span>
          Built for <strong>36 curious destinations</strong>
        </span>
        <span>
          <strong>4.9/5</strong> early explorer rating
        </span>
      </div>
      <section className="container section" id="how">
        <div className="section-head">
          <div>
            <div className="eyebrow">A better way to arrive</div>
            <h2 className="serif">
              The trail starts
              <br />
              with a conversation.
            </h2>
          </div>
          <p className="section-intro">
            Tell us how you like to travel. Payana Mitra brings the context, care, and
            local knowledge to shape a plan around it.
          </p>
        </div>
        <div className="feature-grid">
          <div className="feature">
            <span className="feature-num">01 / Tell us</span>
            <h3>Your kind of trail</h3>
            <p>
              Share your dates, budget, pace, and the moments you want to
              remember.
            </p>
          </div>
          <div className="feature">
            <span className="feature-num">02 / We shape</span>
            <h3>Plans with perspective</h3>
            <p>
              Get a thoughtful itinerary shaped around your interests, not a
              recycled template.
            </p>
          </div>
          <div className="feature">
            <span className="feature-num">03 / You go</span>
            <h3>More room to wander</h3>
            <p>
              Keep the useful details close and leave the rest open for
              discovery.
            </p>
          </div>
        </div>
      </section>
      <section className="quote" id="why">
        <div className="container">
          <p>
            “The best trails are not collected. They are felt, one small decision
            at a time.”
          </p>
          <span>— The Payana principle</span>
        </div>
      </section>
      <section className="cta" id="stories">
        <div className="container cta-inner">
          <h2>Ready to travel on your terms?</h2>
          <Link href="/login" className="btn">
            Sign in to your trail
          </Link>
        </div>
      </section>
      <footer className="footer">
        <div className="container">
          <div className="footer-top">
            <div className="footer-lead">
              <Brand size={88} tone="light" />
              <p className="footer-tagline serif">
                A long way is only worth taking
                <br />
                if it feels like your own.
              </p>
              <div className="footer-actions">
                <Link href="/login" className="btn btn-primary">
                  Sign in
                </Link>
              </div>
            </div>

            <div className="footer-col">
              <span className="footer-label">Explore</span>
              <a href="#how">How it works</a>
              <a href="#why">Why Payana Mitra</a>
              <a href="#stories">Stories</a>
            </div>

            <div className="footer-col">
              <span className="footer-label">Company</span>
              <a href="#">About</a>
              <a href="#">Contact</a>
              <a href="#">Privacy</a>
            </div>

            <div className="footer-team">
              <span className="footer-label">Built by</span>
              {team.map((member) => (
                <div className="member" key={member.name}>
                  <span className="member-mark">{member.initials}</span>
                  <span className="member-name">{member.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="footer-bottom">
            <span>© 2026 Payana Mitra</span>
            <span className="footer-route" aria-hidden="true" />
            <span>Travel thoughtfully.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
