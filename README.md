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
- **Field Coordination:** Trail leaders receive real-time rosters with emergency details, dietary preferences, guest directory, and one-tap broadcasts.
- **Secure Guest Companion:** Travellers get a mobile-optimized day-by-day itinerary, an AES-256 encrypted personal document vault, and real-time push & WhatsApp updates.

---

## 🎯 Key Features by Role

### 1. Tour Administrators
- **Trail / Trip Management:** Create, edit, publish, archive, and delete trips.
- **Deep Trip Duplication:** One-click cloning of entire itineraries, day schedules, and activities via the `copy_trip()` PostgreSQL stored procedure.
- **Granular Itinerary Builder:** Day-by-day scheduling with meal plans (`EP`, `CP`, `MAP`, `AP`, custom lunch/dinner flags), activity time intervals, order indexing, and destinations.
- **Guest Enrollment:** Instant guest mapping, single-click trail addition, and modal creation for new guests.
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
- **Booked Guest Directory:** Immediate access to guest contacts and emergency phone numbers on assigned trail pages.
- **Trail Broadcasts:** Instant alerts sent directly to travellers on a specific active trip.
- **Emergency Directory:** Quick-dial emergency contacts and logistics personnel placed below the day-by-day itinerary.
- **Guest Feedback Portal:** Dedicated leader portal (`/dashboard/feedback`) to monitor satisfaction ratings and written comments across assigned expeditions.
- **Live Location Tracking:** Monitor check-ins and GPS pings submitted by travellers.

### 3. Travellers & Guests
- **Mobile-First Itinerary Companion:** Day-by-day timeline showing planned timings, activity details, transport logistics, and meal coverage.
- **Encrypted Document Vault:** Secure AES-256-GCM encrypted storage for passports, Aadhaar cards, visas, permits, and vaccination certificates.
- **External Resource Watching:** Automatic new tab / window launching for Payana Quiz, external Google Forms, and documents without disrupting active app sessions.
- **Live Notification Alerts:** Visual unread bell badge counters across top headers, sidebar navigation, and dashboard notification banner cards.
- **Direct Emergency Calling:** One-tap calling for tour coordinators, guides, drivers, and local hotel front desks.
- **Feedback Submission:** Post-trail star ratings, comments, and direct Google Form survey integration.

---

## 🔒 Security & Data Protection Architecture

Payana Mitra enforces strict defense-in-depth security across every layer of the application:

1. **PostgreSQL Row Level Security (RLS)**
   - All 15 database tables enforce RLS policies.
   - Enrolled travellers can *only* select and read their own trips, documents, and notifications.
   - Field trail leaders can only view rosters and guest details for trails they are explicitly assigned to lead.
   - Only users with verified `role = 'admin'` can mutate platform data, perform CSV bulk imports, or trigger mass broadcasts.

2. **End-to-End At-Rest Document Encryption**
   - Personal travel documents uploaded by guests (passports, national IDs, medical records) are encrypted using **AES-256-GCM** before being streamed to Supabase Storage.
   - Decryption occurs entirely server-side in streaming memory chunks, requiring verified ownership or administrative permissions.

3. **Secure PIN & Password Derivation**
   - User PINs and passwords are hashed using **HMAC-SHA256** combined with a high-entropy server-side secret pepper (`AUTH_PEPPER`).
   - Constant-time string comparison (`crypto.timingSafeEqual`) prevents timing attack vulnerabilities during authentication.

4. **Inactivity Session Timeout Protection**
   - Continuous client-side activity listener automatically logs out inactive sessions after 15 minutes of inactivity on shared or public devices.

---

## 🛠 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Server Components)
- **Frontend Library:** [React 19](https://react.dev/)
- **Language:** [TypeScript 5](https://www.typescriptlang.org/)
- **Database & Storage:** [Supabase](https://supabase.com/) (PostgreSQL 15+, Row Level Security, S3-Compatible Storage Buckets)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Document Compression:** [iLoveAPI](https://developer.ilovepdf.com/) + [sharp](https://sharp.pixelplumbing.com/)
- **Notifications:** Web Push API (`web-push` / VAPID) + Meta WhatsApp Cloud API
- **Icons:** [Lucide React](https://lucide.dev/)

---

## 📁 Project Structure

```
payana-mitra/
├── src/
│   ├── app/
│   │   ├── (auth)/             # Login, signup, pin verification
│   │   ├── admin/              # Admin dashboard, trip builder, CSV import
│   │   ├── dashboard/          # Traveller & trail leader dashboard, itineraries
│   │   └── api/                # Secure API endpoints (auth, trips, documents, push)
│   ├── components/             # Reusable UI components & modals
│   ├── lib/
│   │   ├── auth.ts             # Auth session resolution and role guards
│   │   ├── crypto.ts           # AES-256-GCM and HMAC-SHA256 crypto helpers
│   │   ├── compression/        # iLoveAPI & sharp file optimization pipeline
│   │   ├── feedback.ts         # Google Form & feedback calculation logic
│   │   ├── notifications.ts    # Web push and in-app notification dispatcher
│   │   ├── whatsapp.ts         # Meta Cloud WhatsApp API client
│   │   └── supabase/           # Supabase client singletons & admin clients
│   └── types/                  # TypeScript interface definitions
├── supabase/
│   └── migrations/             # Idempotent PostgreSQL DDL, procedures, RLS policies
├── scripts/
│   ├── seed.ts                 # Database seeding script for development
│   ├── create-admin.ts         # Interactive CLI admin promotion tool
│   └── test-backend.ts         # Automated backend test suite
└── public/                     # Static assets, branding, PWA manifest
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** `v20.x` or higher
- **Package Manager:** `npm` (v10+)
- **Supabase Account:** Local Supabase CLI or cloud project instance

---

### 1. Clone and Install

```bash
git clone https://github.com/SharadaEduTrust/PayanaMitra-Application.git
cd PayanaMitra-Application
npm install
```

---

### 2. Configure Environment Variables

Create a local environment configuration file:
```bash
cp .env.example .env.local
```

Fill in your project credentials (see [Environment Variables Reference](#-environment-variables-reference) below).

---

### 3. Database Setup & Migrations

Execute the migrations in sequential order against your Supabase PostgreSQL instance:
```bash
# Using Supabase CLI
supabase db push

# Or run the SQL files in supabase/migrations/ directly via Supabase SQL Editor
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
