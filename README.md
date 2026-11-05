# Payana Mitra — Travel, Thoughtfully Planned

> **Payana Mitra** is a comprehensive trail planning and guest companion platform built for modern group travel, eco-expeditions, and guided trails. It bridges the gap between travel administrators, trail leaders, and guests by delivering day-by-day itineraries, instant notifications, emergency contacts, feedback loops, and document management.

---

## 🌟 Key Features

### 🥾 For Guests (Travellers)
- **Day-Wise Interactive Itinerary**: Clean, structured schedule of destinations, hotel stays, meal plans, and timestamped activities.
- **Logistics & Contacts Directory**: Placed conveniently below the itinerary, featuring direct phone and email links for:
  - Assigned **Trail Leader**
  - **Trail Coordinator** (Support)
  - Local **Guides**, **Hotels**, and **Transport Services**
- **Unread Notification Reminders (🔔)**:
  - Live unread notification badge in the sidebar and top navigation.
  - Mobile header bell button with real-time unread count.
  - Home dashboard alert card reminding travelers of schedule adjustments or weather notices.
  - One-click **"Mark all as read"** capability.
- **Post-Trail Feedback**: Seamless feedback submission with external Google Forms and in-app rating/reviews within a configurable submission window.
- **Travel Documents Wallet**: Secure AES-256-GCM encrypted storage for passports, visas, insurance policies, and flight tickets.
- **Payana Quiz**: Embedded knowledge and quiz companion linking safely to the external Sulabh quiz platform.
- **Mobile & PWA Ready**: External links (Quiz, Google Forms) automatically open in a dedicated browser window/tab, ensuring travelers are never trapped without a back button.

### 🧭 For Trail Leaders
- **Trail Roster & Guest Directory**: View all assigned guests on each led trail, with one-tap calling (`tel:`) and email access.
- **Emergency & Medical Info**: Immediate access to dietary preferences (Veg, Non-Veg), reported food allergies, emergency contact names, numbers, and travel insurance details.
- **Trail Announcements & Broadcasts**: Send broadcast notifications with push alerts directly to all booked guests on a trail.
- **Trail Overview**: Access assigned itineraries, logistical contacts, and coordinator support details.

### ⚙️ For Administrators
- **Trail & Itinerary Management**:
  - Full CRUD for trails, destination details, status (Draft / Published / Archived), and dates.
  - Granular day-by-day itinerary builder with ordered activities, hotel accommodations, and meal plans.
  - Assignment of Trail Leaders and logistical contacts.
- **Enrolled Guest Management**:
  - Quick **"+ Create New Guest"** modal to onboard and enroll new travelers on the fly.
  - Multi-guest selection and bulk **"+ Add Selected Guests to Trail"**.
  - Direct 1-click **"+ Add to Trail"** buttons on candidate guest rows.
  - CSV bulk guest import and trail mapping utilities.
- **User Accounts Administration**:
  - Search, filter, and sort by phone, name, role, leader, referral, and location.
  - **Sticky Actions Column** pinned to the right edge with 0-scroll accessibility.
  - **Direct Click-to-Edit** on guest names.
  - PIN reset (defaults to last 4 digits of phone) and account suspension controls.
  - Document verification and uploads on behalf of guests.
- **Feedback & Audit Logging**:
  - Trail ratings analysis and Google Form review tracking.
  - Comprehensive immutable audit log tracking administrative mutations and member assignments.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19, Server Components)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict type safety)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security - RLS)
- **Styling**: Modern responsive CSS with custom design tokens, semantic variables, and mobile drawer navigation.
- **Icons**: [Lucide React](https://lucide.dev/)
- **Security & Encryption**: AES-256-GCM document encryption, service-role admin isolation, session timeout watcher.
- **Deployment**: [Vercel](https://vercel.com)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18.18+ or 20+
- A Supabase project (free or pro)

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/pratyushanand16/payana-mitra.git
cd payana-mitra
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 32-byte Base64-encoded Encryption Key for Document Storage (AES-256-GCM)
ENCRYPTION_KEY=your-32-byte-base64-encryption-key
```

> **Tip**: Generate a 32-byte encryption key with Node:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
> ```

### 4. Database Setup & Migrations
Run the SQL migration files located in `supabase/migrations/` sequentially in your Supabase SQL Editor:
1. `001_init.sql` — Base tables, RLS policies, and triggers.
2. `002_rls.sql` — Row Level Security fine-tuning.
3. `003_storage.sql` — Supabase storage bucket setup for avatars and documents.
4. `004_sheet_features.sql` — Trail leader permissions, CSV import tracking, and contact policies.

### 5. Seed Initial Data (Optional)
To populate the database with a sample trail, itinerary days, activities, contacts, and test accounts:
```bash
npm run seed
```

### 6. Create an Initial Admin Account
```bash
npm run admin:create
```

### 7. Run the Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📁 Project Structure

```
payana-mitra/
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root layout (SessionTimeout, ExternalLinkWatcher)
│   │   ├── page.tsx                        # Public landing page
│   │   ├── login/                          # Password / PIN login
│   │   ├── signup/                         # Guest onboarding
│   │   ├── change-password/                # Mandatory & voluntary PIN updates
│   │   ├── dashboard/                      # Guest & Leader portal
│   │   │   ├── page.tsx                    # My Trails list & notification banner
│   │   │   ├── trips/[id]/                 # Trail itinerary, contacts & guest roster
│   │   │   ├── notifications/              # Guest notification inbox & mark all read
│   │   │   ├── documents/                  # Encrypted document wallet
│   │   │   ├── guests/                     # Trail Leader assigned guest manager
│   │   │   └── profile/                    # User profile, emergency contacts & avatar
│   │   ├── admin/                          # Administrative control panel
│   │   │   ├── (panel)/trips/              # Trail builder, itinerary & guest enrollment
│   │   │   ├── (panel)/users/              # User management (sticky actions, quick edit)
│   │   │   ├── (panel)/feedback/           # Google Form & rating reviews
│   │   │   ├── (panel)/import/             # CSV batch imports (trails, guests, mapping)
│   │   │   └── (panel)/audit-log/          # System audit trail
│   │   └── api/                            # Next.js Server Route Handlers
│   ├── components/                         # UI components
│   │   ├── trip-detail-view.tsx            # Itinerary, contacts & trail guest directory
│   │   ├── trip-members.tsx                # Guest enrollment & "+ Create New Guest" modal
│   │   ├── users-admin.tsx                 # Admin user table (click-to-edit, sticky actions)
│   │   ├── dashboard-nav.tsx               # Sidebar navigation with notification bell badge
│   │   ├── mobile-nav.tsx                  # Mobile drawer header with notification bell
│   │   ├── external-link-watcher.tsx       # Global PWA/webview external window opener
│   │   └── ...
│   ├── lib/                                # Core utilities, auth guards, Supabase clients
│   │   ├── auth.ts                         # Role guards (requireProfile, getSession)
│   │   ├── feedback.ts                     # Feedback window & Google Form URL logic
│   │   ├── utils.ts                        # openExternalUrl helper & class names
│   │   └── supabase/                       # Server, client & admin clients
│   └── types/                              # TypeScript database & view types
├── supabase/migrations/                    # SQL migrations
└── scripts/                                # Seed, admin creation, and RLS test scripts
```

---

## 🧪 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server on port 3000 |
| `npm run build` | Compiles production build with type checking |
| `npm run start` | Starts production server |
| `npm run lint` | Runs Next.js ESLint checks |
| `npm run seed` | Seeds database with sample trails, activities, contacts, and accounts |
| `npm run admin:create` | Interactive CLI to create or elevate an administrator account |
| `npm run rls-test` | Runs automated verification of Supabase Row Level Security policies |
| `npm run test` | Runs backend API test suite |

---

## 🔒 Security & Privacy

- **Row Level Security (RLS)**: Enforced directly at the PostgreSQL layer for all database operations.
- **Session Timeout Watcher**: Automatically terminates inactive sessions to prevent unauthorized access on shared devices.
- **Document Encryption**: Sensitive identity documents (passports, Aadhaar, insurance) are encrypted at rest using AES-256-GCM before storage.
- **Role Isolation**: Strict server-side route guards prevent unauthorized privilege escalation across travellers, leaders, and admins.

---

## 📄 License

Proprietary — Built with care for **Payana Mitra** / Payana Trails. All rights reserved.
