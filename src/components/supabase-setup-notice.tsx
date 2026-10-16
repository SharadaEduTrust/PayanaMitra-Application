"use client";

import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Rendered in place of a form when Supabase credentials are missing. Without
 * this, the Supabase SDK throws inside the client and Next.js replaces the whole
 * page with a runtime-error overlay.
 */
export default function SupabaseSetupNotice() {
  if (isSupabaseConfigured()) return null;

  return (
    <section className="setup-notice">
      <div className="setup-notice-head">
        <span className="setup-badge">Setup needed</span>
      </div>
      <h3>Connect your Supabase project</h3>
      <p>
        Sign-in and every database feature stay switched off until the Supabase keys are
        present. The landing page and design still work, so you can keep working on those.
      </p>

      <ol className="setup-steps">
        <li>
          Create a free project at{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
            supabase.com/dashboard
          </a>
        </li>
        <li>
          Open <strong>SQL Editor</strong> and run the four files in{" "}
          <code>supabase-migrations/</code> in order, starting with{" "}
          <code>001_init.sql</code>
        </li>
        <li>
          Copy <strong>Project Settings → API</strong> values into <code>.env.local</code>
        </li>
        <li>
          Restart the dev server, since Next.js only reads env files at boot
        </li>
      </ol>

      <div className="setup-env">
        <p>.env.local</p>
        <pre>
{`NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
DOCUMENT_ENCRYPTION_KEY=<openssl rand -base64 32>`}
        </pre>
        <p className="setup-note">
          The anon key is safe in the browser because Row Level Security protects the data. The
          service role key bypasses RLS, so it must stay server-side and never be committed.
        </p>
      </div>

      <p className="setup-help">
        Full walkthrough in <code>SUPABASE_SETUP.md</code>.
      </p>
    </section>
  );
}