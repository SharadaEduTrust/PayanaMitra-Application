# Supabase setup

The app now runs entirely on Supabase: Supabase Auth for sign-in and Row Level
Security for data access. These migrations live in `supabase-migrations/`.

## 1. Create the project

At [supabase.com/dashboard](https://supabase.com/dashboard) create a project and
wait for the database to finish provisioning.

## 2. Apply the migrations

In the dashboard go to **SQL Editor** and run these five files in order:

```text
supabase-migrations/001_init.sql
supabase-migrations/002_login_guard.sql
supabase-migrations/003_leader_role.sql
supabase-migrations/004_sheet_features.sql
supabase-migrations/005_profile_avatar.sql
```

Order matters. `003` uses `ALTER TYPE ... ADD VALUE`, which cannot run inside a
transaction alongside other DDL, so it must be its own statement.

If you have the Supabase CLI installed, the same thing is:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

## 3. Configure auth

Under **Authentication → Sign In / Providers**:

- Keep **Email** enabled
- If you want local testing without an inbox, turn off **Confirm email** under
  Email provider settings
- Set your **Site URL** to `http://localhost:3000`
- Add `http://localhost:3000/**` under **Redirect URLs**

## 4. Add the environment variables

Copy `.env.example` to `.env.local` and fill it in from
**Project Settings → API**:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
DOCUMENT_ENCRYPTION_KEY=<openssl rand -base64 32>
```

Generate the document key once and store it safely:

```bash
openssl rand -base64 32
```

`DOCUMENT_ENCRYPTION_KEY` decrypts guest document numbers. If you lose it, every
stored PAN or passport number becomes permanently unreadable.

## 5. Make yourself an administrator

Sign up normally at `/signup`, then promote that account:

```bash
npm run admin:create -- your@email.com
```

`profiles` is protected by RLS, so this has to run server-side with the service
role key. Sign in at `/admin/login` afterwards.

## 6. Run it

```bash
npm run dev
```

## How access control works

There is no application-level permission logic for data. Every read and write
goes through Postgres Row Level Security:

| Helper | Meaning |
| --- | --- |
| `is_admin()` | caller has `role = 'admin'` |
| `is_trip_member(trip)` | caller is in `trip_members` for that trip |
| `is_leader_of_trip(trip)` | caller is the trip's `leader_id` |

Two consequences worth knowing:

- The browser talks to Supabase with the **anon key** and the user's own JWT.
  It can only read rows the RLS policies allow.
- Server routes that need to bypass RLS — creating accounts, writing profiles,
  encrypting documents, reading the audit log — use
  `SUPABASE_SERVICE_ROLE_KEY` and live in `lib/supabase/admin.ts`. Keep that
  import inside server code only.

`login_attempts` and `audit_log` have RLS enabled with zero policies on
purpose, so only the service role can touch them.

## Tables created

```text
profiles              traveller_details    guest_documents
destinations          trips                trip_members
trip_contacts         trip_destinations    itinerary_days
activities            feedback             survey_responses
notifications         push_subscriptions   location_updates
login_attempts        audit_log
```

Plus the `trail_leader_view` view and the `copy_trip()` function, both from
migration 004.

Migration 005 also creates the public `avatars` storage bucket (2 MB limit,
JPEG/PNG/WebP only) that backs profile photos.

## Troubleshooting

**Everything returns empty even though data exists**
The Supabase session is not being refreshed. That is almost always a missing
middleware entry. `lib/supabase/middleware.ts` must not run any code between
creating the client and calling `getUser()`.

**`new row violates row-level security policy`**
The table has no INSERT policy for the current role. Traveller-facing creates go
through a server route using the service role, which is intentional.

**`must_change_password` never clears**
The traveller must complete `/change-password`. The flag is cleared by
`/api/profile/clear-password-flag` after a successful password update.

**Document save fails with a key error**
`DOCUMENT_ENCRYPTION_KEY` is missing or is not 32 base64-encoded bytes. Generate
it with `openssl rand -base64 32`.