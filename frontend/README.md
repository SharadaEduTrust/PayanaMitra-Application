# Payana Mitra

> Travel, thoughtfully planned.

Payana Mitra is a personalized trip-planning web application. Coordinators
author trips and itineraries; travellers sign in to see the trips they are
booked on, follow the day-by-day plan, and leave feedback.

## Stack

- Next.js 16, React 19, TypeScript
- Supabase (Postgres + Auth + Row Level Security)
- Server-side AES-256-GCM encryption for guest documents
- Vercel for deployment

## Getting started

### 1. Create a Supabase project and apply the migrations

See **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** for the full walkthrough. In
short: create a project, then run the four files in `supabase-migrations/` in
order through the SQL Editor.

### 2. Configure the environment

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ENCRYPTION_KEY=<openssl rand -base64 32>
```

> `ENCRYPTION_KEY` is the name the backend uses. `DOCUMENT_ENCRYPTION_KEY` is
> still accepted as a fallback.

### 3. Install and run

```bash
npm install
npm run dev
```

### 4. Create the first administrator

```bash
npm run admin:create -- your@email.com
```

Sign up at `/signup` first, then promote that account.

## Routes

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | Public | Landing page |
| `/signup` | Public | Self-registration |
| `/login` | Public | Sign-in (phone + PIN) |
| `/change-password` | Signed in | Forced password reset |
| `/dashboard` | Traveller | Trips they are booked on |
| `/dashboard/trips/[id]` | Member | Itinerary, activities, contacts |
| `/dashboard/trips/[id]/feedback` | Member | Star rating and comments |
| `/dashboard/trips/[id]/survey` | Member | End-of-tour questions |
| `/dashboard/profile` | Traveller | Contact and travel details |
| `/dashboard/documents` | Traveller | Encrypted PAN / passport |
| `/dashboard/notifications` | Traveller | Coordinator updates |
| `/admin` | Admin | Overview |
| `/admin/users` | Admin | Accounts, roles, suspension |
| `/admin/trips` | Admin | Trip list, create, publish |
| `/admin/trips/[id]` | Admin | Days, activities, members, contacts |
| `/admin/destinations` | Admin | Destination catalogue |
| `/admin/notifications` | Admin | Send notifications |
| `/admin/login` | Public | Administrator sign-in (phone + PIN, admin only) |

## How the access model works

There is no permission logic in the components. All data access is governed by
Postgres Row Level Security:

- `is_admin()` — role is admin
- `is_trip_member(trip)` — caller appears in `trip_members`
- `is_leader_of_trip(trip)` — caller is the trip's `leader_id`

A traveller sees a trip only when **all three** hold: they are a member, the
trip is `published`, and `is_active` is true. Admins write with the service role
key, which bypasses RLS, so every privileged action is written to `audit_log`.

## Scripts

```bash
npm run dev           # Development server
npm run build         # Production build
npm run start         # Production server
npm run admin:create -- <email>   # Promote an account to admin
```

## Project structure

```text
app/
├── admin/
│   ├── login/                 Outside the guard so it cannot loop
│   └── (panel)/               Role-guarded admin area
├── dashboard/                 Session-guarded traveller area
├── api/                       Server routes needing the service role
└── globals.css

lib/
├── supabase/{client,server,admin,middleware}.ts
├── auth.ts                    getAuthUser / getProfile / requireProfile
├── pin.ts                     Phone normalisation and PIN derivation
├── pin-login.ts               Shared PIN verification for both sign-in routes
├── crypto.ts                  AES-256-GCM for document numbers
├── audit.ts                   audit_log writer
├── types.ts                   Table types matching the migrations

supabase-migrations/           001-004, apply in order
```

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- `ENCRYPTION_KEY` is unrecoverable if lost.
- Document numbers are encrypted before storage and never returned to the client.
- No password is ever handled by this app. Sign-in is phone + derived PIN, and
  the resulting session is a real Supabase session governed by RLS.
- Admin actions are recorded in `audit_log`, including admin PIN sign-ins.

## Sign-in: phone number and PIN

Nobody signs in with a password — travellers **and** administrators alike. Both
enter:

```text
Phone: 98765 43210
PIN:    4230        ← the last four digits of that number
```

The PIN is never stored. `lib/pin.ts` recomputes it from the phone number in
`profiles` on every attempt and compares in constant time. After the check
passes, the server issues a one-time token which the browser exchanges for a real
Supabase session, so RLS still governs every later request.

Attempts are recorded in `login_attempts` (migration 002). Five failures for a
number inside fifteen minutes locks that number out for fifteen minutes.

### Two routes, one verifier

| Route | Form | Who it accepts |
| --- | --- | --- |
| `/login` → `POST /api/auth/pin` | `components/pin-form.tsx` | Any active account |
| `/admin/login` → `POST /api/auth/admin-pin` | `components/admin-login-form.tsx` | `role = 'admin'` only |

Both call `verifyPinLogin()` in `lib/pin-login.ts`. The admin route passes
`requireRole: "admin"`, and the role is checked **before** the PIN is compared,
so a traveller number cannot be probed for a valid PIN. A wrong role, a wrong
PIN and an unregistered number all return the same message and status, so the
endpoint cannot be used to enumerate accounts or discover who is an admin.

An authenticated admin session still reads only what RLS allows. `role` is
verified in Postgres by `is_admin()`, not by the client.

**This is weak authentication and should be treated as such.** The PIN is
derivable from the phone number, and the phone number is the identifier, so
anyone holding a member list can sign in as any member — including an admin. If
that matters, replace the derived PIN with a randomly generated 4 to 6 digit code
in a new column, or send one-time codes over SMS instead.

## Design system

Taken from the live brand at [payanatrails.com](https://payanatrails.com/).

```text
Primary brown:  #4A3B2A   text, dark surfaces, nav
Cream:          #F3EFE9   page background
Tan accent:     #D4A373   highlights, hover, badges
Secondary:      #8B6B50   muted text, borders on dark
Hairline:       #E3D5C4   card and table borders
Card white:     #FDFBF9
```

Type: **Lato** for interface text, a serif display stack for headings. Buttons
and nav pills are fully rounded. Cards use a 16px radius with a hairline border
rather than heavy shadows.

The illustrated circular badge, the hero photograph, and the wordmark lockup
are all sourced from the live site.

## License

Private project for the Payana Mitra team.