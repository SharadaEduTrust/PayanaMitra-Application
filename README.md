# Payana Mitra (ಪಯಣ ಮಿತ್ರ)

> **Modern Tour & Expedition Operations Platform** for tour operators, trail leaders, and travellers.

[![Next.js](https://img.shields.io/badge/Next.js-16.3.7-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%7C%20Auth%20%7C%20Storage-emerald?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Security](https://img.shields.io/badge/Encryption-AES--256--GCM-red?style=flat-square)](#-security--data-protection-architecture)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features by Role](#-key-features-by-role)
  - [1. Tour Administrators](#1-tour-administrators)
  - [2. Trail Leaders (Field Leads)](#2-trail-leaders-field-leads)
  - [3. Travellers & Guests](#3-travellers--guests)
- [Security & Data Protection Architecture](#-security--data-protection-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone and Install](#1-clone-and-install)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Database Setup & Migrations](#3-database-setup--migrations)
  - [4. Seed Database & Create Admin](#4-seed-database--create-admin)
  - [5. Run Development Server](#5-run-development-server)
- [Environment Variables Reference](#-environment-variables-reference)
- [Available Scripts](#-available-scripts)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Deployment](#-deployment)
- [Contributing & License](#-contributing--license)

---

## 🌍 Overview

**Payana Mitra** (*"Travel Companion"*) is a full-stack, mobile-first expedition management system built to streamline operations for travel organizations and adventure groups.

Managing experiential tours often suffers from fragmented tools: itineraries sent over PDFs, emergency contacts lost in chat threads, sensitive passport scans floating unencrypted in email inboxes, and field leaders struggling to track guest needs on the ground.

Payana Mitra unifies these workflows into a single high-security portal:
- **Centralized Trip Control:** Admins design, publish, clone, and manage multi-day trips and itineraries.
- **Field Coordination:** Trail leaders receive real-time rosters with emergency details, dietary preferences, and one-tap broadcasts.
- **Secure Guest Companion:** Travellers get a mobile-optimized day-by-day itinerary, an AES-256 encrypted personal document vault, and real-time push & WhatsApp updates.

---

## 🎯 Key Features by Role

### 1. Tour Administrators
- **Trail / Trip Management:** Create, edit, publish, archive, and delete trips.
- **Deep Trip Duplication:** One-click cloning of entire itineraries, day schedules, and activities via the `copy_trip()` PostgreSQL stored procedure.
- **Granular Itinerary Builder:** Day-by-day scheduling with meal plans (`EP`, `CP`, `MAP`, `AP`, custom lunch/dinner flags), activity time intervals, order indexing, and destinations.
- **CSV Import Engine:**
  - Bulk import users with automatic duplicate checking, role assignment, and validation.
  - Bulk import complex multi-day itineraries with downloadable template sheets.
  - Smart column mapping and detailed per-row status reporting.
- **Multi-Channel Broadcasts:**
  - Web Push notifications (VAPID) delivered to desktop and mobile browsers.
  - Official WhatsApp Cloud API integration (Meta Business Platform) with automated E.164 phone formatting.
- **Asset Compression Pipeline:** Automatic server-side compression for guest documents and itinerary attachments via **iLoveAPI** (with fallback to `sharp`).
- **Comprehensive Audit Log:** Immutable event log tracking administrative actions, user updates, and data mutations.
- **Feedback & Surveys:** In-app guest reviews (1-10 rating, highlights, areas for improvement) plus integrated Google Forms survey workflows.

### 2. Trail Leaders (Field Leads)
- **Assigned Guests Roster:** Dedicated `trail_leader_view` showing enrolled guests, rooming/dietary requirements, medical disclosures, and emergency contacts.
- **Trail Broadcasts:** Instant alerts sent directly to travellers on a specific active trip.
- **Emergency Directory:** Quick-dial emergency contacts and logistics personnel.
- **Live Location Tracking:** Monitor check-ins and GPS pings submitted by travellers.

### 3. Travellers & Guests
- **Interactive Daily Itinerary:** Timeline view of daily activities, timing, meal arrangements, transit checkpoints, and hotel details.
- **Encrypted Document Locker:** Secure storage for flight tickets, visas, insurance policies, and identity documents (passports, PAN, Aadhaar).
- **Frictionless Auth:** Fast, passwordless phone + 4-digit PIN authentication with automated initial PIN assignment.
- **Notification Inbox:** Real-time updates and trip announcements with unread badge indicators.
- **Trip Surveys & Feedback:** Direct feedback submission to help organizers improve future departures.

---

## 🔒 Security & Data Protection Architecture

Payana Mitra implements enterprise-grade data isolation and encryption safeguards:

| Security Layer | Implementation Details |
|---|---|
| **Field-Level Encryption** | Sensitive guest fields (e.g., Passport numbers, PAN numbers, Identification details) are encrypted at rest using **AES-256-GCM** with 96-bit auth tags and cryptographically secure IVs (`lib/server/crypto.ts`). Values are decrypted strictly server-side for authorized sessions. |
| **Row Level Security (RLS)** | Supabase PostgreSQL enforces strict tenant policies across all 13+ tables. Travellers can only access their own profile, assigned trips, and own documents; Trail Leaders access only assigned guests; Admins bypass via Service Role where auditable. |
| **Password Derivation** | PINs and passwords are never stored in plaintext. They are derived using **HMAC-SHA256** combined with a high-entropy server-side pepper (`AUTH_PEPPER`). |
| **Brute-Force Login Guard** | Authentication attempts are tracked in the `login_attempts` table with exponential lockout penalties against brute-force attacks. |
| **Inactivity Session Timeout** | Automatic session revocation and cookie cleanup after **30 minutes of inactivity** monitored across both middleware and client watchers. |
| **Secure Document Storage** | Supabase Storage buckets (`guest-documents`) with strict file-type whitelisting, virus/magic-byte checks, and signed temporary URLs. |

---

## 💻 Tech Stack

### Core Framework & UI
- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Route Handlers)
- **Frontend Library:** [React 19](https://react.dev/)
- **Language:** [TypeScript 5](https://www.typescriptlang.org/) (Strict Mode)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) with OKLCH color palettes & [tw-animate-css](https://github.com)
- **Components:** [shadcn/ui](https://ui.shadcn.com/) & [@base-ui/react](https://base-ui.com/)
- **Icons:** [Lucide React](https://lucide.dev/)

### Backend, Database & Cloud Services
- **Database & Auth:** [Supabase](https://supabase.com/) (Managed PostgreSQL, GoTrue Auth, Storage)
- **Client & Middleware:** `@supabase/ssr` & `@supabase/supabase-js`
- **Schema Validation:** [Zod 4](https://zod.dev/)
- **Push Notifications:** [Web Push (VAPID)](https://github.com/web-push-libs/web-push)
- **Messaging:** [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) (Meta Business Platform)
- **Document Optimization:** [iLoveAPI](https://developer.ilovepdf.com/) (PDF & Image compression) & [sharp](https://sharp.pixelplumbing.com/)

---

## 📁 Project Structure

```text
payana-mitra/
├── docs/                      # Architectural docs, guides, and progress trackers
├── public/                    # Static assets, branding logos, icons, PWA manifests
├── scripts/                   # CLI maintenance & automated test scripts
│   ├── backend-test.ts        # Comprehensive 10-section backend verification suite
│   ├── create-admin.ts        # Script to elevate a user to admin role
│   ├── rls-test.ts            # Row Level Security isolation test suite
│   ├── seed.ts                # Database seeder (sample trips, days, activities, users)
│   ├── test-compression.ts    # iLoveAPI / sharp upload compression testing
│   ├── test-itinerary-import.ts # Itinerary CSV import integration tests
│   └── test-mapping-import.ts # User CSV import & mapping tests
├── src/
│   ├── app/                   # Next.js App Router (Pages, Layouts, API Handlers)
│   │   ├── (auth)/            # /login, /signup, /change-password
│   │   ├── admin/             # Admin control panel (/trips, /users, /audit-log, /import, etc.)
│   │   ├── dashboard/         # Traveller & Leader portal (/trips, /documents, /guests, etc.)
│   │   └── api/               # Serverless API routes (auth, admin, trips, push, whatsapp)
│   ├── components/            # Reusable UI components & feature modules
│   │   ├── ui/                # Base design system primitives (buttons, inputs, cards)
│   │   ├── csv-import-admin.tsx # Smart CSV bulk importer with column mapping
│   │   ├── trip-editor.tsx    # Multi-day itinerary and activity manager
│   │   ├── assigned-guests-view.tsx # Trail leader field roster
│   │   └── ...                # Feature-specific dialogs, forms, and views
│   ├── lib/                   # Shared utility libraries
│   │   ├── compression/       # iLoveAPI & Sharp file compression pipelines
│   │   ├── server/            # Server-only utilities (crypto, auth, whatsapp, push)
│   │   ├── supabase/          # Supabase client factories (client, server, admin, middleware)
│   │   ├── auth.ts            # Authentication helpers & session helpers
│   │   ├── crypto.ts          # AES-256-GCM symmetric encryption methods
│   │   └── types.ts           # Domain-specific TypeScript declarations
│   ├── middleware.ts          # Global edge auth verification and session keeper
│   └── types/                 # Auto-generated and custom database definitions
└── supabase/
    └── migrations/            # Ordered PostgreSQL migration scripts (001_init.sql ... 015)
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** `v20.x` or later (LTS recommended)
- **Package Manager:** `npm` (included with Node.js)
- **Supabase Account:** Free or Pro project at [supabase.com](https://supabase.com) (or local Supabase CLI)

---

### 1. Clone and Install

```bash
git clone https://github.com/your-username/payana-mitra.git
cd payana-mitra
npm install
```

---

### 2. Configure Environment Variables

Create your local environment file by copying the template:

```bash
cp .env.example .env.local
```

Open `.env.local` and configure your credentials.

#### Generating Cryptographic Keys

1. **Authentication Pepper (`AUTH_PEPPER`)**:
   ```bash
   openssl rand -base64 32
   ```

2. **Field Encryption Key (`ENCRYPTION_KEY`)**:
   ```bash
   openssl rand -base64 32
   ```

3. **Web Push VAPID Key Pair (`VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY`)**:
   ```bash
   npx web-push generate-vapid-keys
   ```

---

### 3. Database Setup & Migrations

Execute the migrations in sequential order against your Supabase SQL Editor (or apply via Supabase CLI):

```bash
# Order of execution:
# 1.  supabase/migrations/001_init.sql
# 2.  supabase/migrations/002_login_guard.sql
# 3.  supabase/migrations/003_leader_role.sql
# 4.  supabase/migrations/004_sheet_features.sql
# 5.  supabase/migrations/005_profile_avatar.sql
# 6.  supabase/migrations/006_spec_alignment.sql
# 7.  supabase/migrations/007_spec_alignment_and_storage.sql
# 8.  supabase/migrations/008_document_issued_date.sql
# 9.  supabase/migrations/009_profile_referral_name.sql
# 10. supabase/migrations/010_guest_details_passport_issue_and_visa.sql
# 11. supabase/migrations/011_google_form_feedback.sql
# 12. supabase/migrations/012_feedback_rating_ten.sql
# 13. supabase/migrations/013_allow_lunch_and_dinner_meal_plan.sql
# 14. supabase/migrations/014_temp_uploads_storage.sql
# 15. supabase/migrations/015_increase_guest_documents_bucket_limit.sql
```

Ensure the following Supabase Storage buckets exist:
- `guest-documents` (private, 25MB file size limit)
- `avatars` (public)
- `temp-uploads` (authenticated / private)

---

### 4. Seed Database & Create Admin

1. **Populate initial demo data** (creates destinations, Kashmir demo trip, itinerary days, and test accounts):
   ```bash
   npm run seed
   ```

2. **Create / Promote an Admin User**:
   - First, register an account by visiting [http://localhost:3000/signup](http://localhost:3000/signup)
   - Then run the promotion script with your registered email:
   ```bash
   npm run admin:create -- admin@example.com
   ```

---

### 5. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser:
- **Admin Panel:** `/admin`
- **Traveller & Leader Dashboard:** `/dashboard`
- **Sign In:** `/login`

---

## ⚙️ Environment Variables Reference

| Variable | Required | Description | Example / Generator |
|---|:---:|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Public Supabase project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Public Supabase anonymous client key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Server-only Supabase service role key (bypasses RLS) | `eyJhbGciOi...` |
| `AUTH_PEPPER` | **Yes** | Secret pepper for HMAC-SHA256 password derivation | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | **Yes** | 32-byte base64 key for AES-256-GCM data encryption | `openssl rand -base64 32` |
| `VAPID_PUBLIC_KEY` | Optional | Public VAPID key for browser Web Push | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Optional | Private VAPID key for browser Web Push | `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | Optional | Mailto contact identifier for push services | `mailto:admin@payanamitra.com` |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | Meta Business WhatsApp Phone Number ID | Numeric ID (e.g. `10482910...`) |
| `WHATSAPP_ACCESS_TOKEN` | Optional | Meta Business System User access token | Long-lived token from Meta Dev |
| `ILOVEAPI_PUBLIC_KEY` | Optional | iLoveAPI project public key (PDF/Image compression) | From developer.ilovepdf.com |
| `ILOVEAPI_SECRET_KEY` | Optional | iLoveAPI project secret key | From developer.ilovepdf.com |
| `IMAGE_COMPRESSION_PROVIDER` | Optional | Image compression engine: `iloveapi` or `sharp` | `iloveapi` *(default)* |
| `MAX_UPLOAD_FILE_SIZE_BYTES` | Optional | Max allowed upload size in bytes | `26214400` *(25MB)* |

---

## 📜 Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts the Next.js development server at `localhost:3000` |
| `npm run build` | Builds the application for production (`next build --webpack`) |
| `npm run start` | Boots the compiled production application |
| `npm run lint` | Runs ESLint checks across the codebase |
| `npm run seed` | Seeds database with destinations, sample trips, and test users |
| `npm run admin:create -- <email>` | Promotes an existing user email to `admin` role |
| `npm run rls-test` | Runs the automated Row Level Security tenant isolation test |
| `npm run test` | Executes the comprehensive 10-section backend verification suite |

---

## 🧪 Testing & Quality Assurance

Payana Mitra includes robust automated test suites to ensure complete security isolation, schema conformance, and business logic reliability:

### 1. Row Level Security (RLS) Isolation Tests
Verifies that database policies strictly prevent unauthorized access between guests, trail leaders, and unauthorized endpoints:
```bash
npm run rls-test
```

### 2. Comprehensive Backend & Integration Suite
Validates schema constraints, PIN derivation, rate limiting, trip lifecycle, time intervals, CSV ingestion, and encryption:
```bash
npm run test
```

### 3. File Compression Pipeline Test
Verifies end-to-end PDF and image optimization before storage uploads:
```bash
npx tsx scripts/test-compression.ts
```

---

## 🚢 Deployment

### Deploying to Vercel

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Import the project into [Vercel](https://vercel.com).
3. Set the Framework Preset to **Next.js**.
4. In **Project Settings → Environment Variables**, add all environment variables defined in [Environment Variables Reference](#-environment-variables-reference).
5. Ensure your production Supabase database has executed all migrations.
6. Trigger a deployment.

---

## 🤝 Contributing & License

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

*Crafted with ❤️ for travellers, trail leaders, and expedition teams by the Payana Mitra team.*
