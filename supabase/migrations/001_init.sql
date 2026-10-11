-- ============================================================
-- 001_init.sql
-- Core tables, RLS helper functions, RLS policies
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- ENUMS
-- ──────────────────────────────────────────────────────────────
create type user_role as enum ('traveller', 'admin');
create type trip_status as enum ('draft', 'published', 'archived');
create type food_pref as enum ('veg', 'non_veg');

-- ──────────────────────────────────────────────────────────────
-- TABLES
-- All CREATE TABLE statements are grouped here so that the
-- helper functions below can resolve table references at
-- function-creation time (Postgres validates SQL function
-- bodies against existing objects when STABLE/IMMUTABLE).
-- ──────────────────────────────────────────────────────────────

-- ── profiles ──
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  phone             text not null unique,
  first_name        text not null,
  last_name         text not null,
  role              user_role not null default 'traveller',
  is_active         boolean not null default true,
  must_change_password boolean not null default false,
  date_of_joining   date,
  last_active_at    timestamptz,
  location          text,
  email             text,
  remarks           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── traveller_details ──
create table traveller_details (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references profiles(id) on delete cascade,
  dob                   date,
  food_preference       food_pref,
  food_allergy          text,
  emergency_contact_name text,
  emergency_contact_no  text,
  travel_insurance_no   text,
  insurance_company     text,
  insurance_expiry      date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── destinations ──
create table destinations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  region      text,
  country     text,
  image_url   text,
  created_at  timestamptz not null default now()
);

-- ── trips ──
create table trips (
  id            uuid primary key default gen_random_uuid(),
  trip_code     text not null unique,
  name          text not null,
  destination   text,
  start_date    date,
  end_date      date,
  leader_id     uuid references profiles(id),
  status        trip_status not null default 'draft',
  is_active     boolean not null default true,
  remarks       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── trip_members ──
create table trip_members (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(trip_id, user_id)
);

-- ── trip_contacts ──
create table trip_contacts (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  name        text not null,
  role        text,
  phone       text,
  email       text,
  created_at  timestamptz not null default now()
);

-- ── trip_destinations ──
create table trip_destinations (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  destination_id uuid not null references destinations(id) on delete cascade,
  visit_order    int,
  created_at     timestamptz not null default now(),
  unique(trip_id, destination_id)
);

-- ── itinerary_days ──
create table itinerary_days (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  day_number     int not null,
  destination    text,
  itinerary_text text,
  hotel_name     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(trip_id, day_number)
);

-- ── activities ──
create table activities (
  id              uuid primary key default gen_random_uuid(),
  itinerary_day_id uuid not null references itinerary_days(id) on delete cascade,
  title           text not null,
  description     text,
  start_time      time,
  end_time        time,
  activity_order  int,
  created_at      timestamptz not null default now()
);

-- ── feedback ──
create table feedback (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  rating      smallint check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

-- ── survey_responses ──
create table survey_responses (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  question    text not null,
  answer      text,
  created_at  timestamptz not null default now()
);

-- ── location_updates ──
create table location_updates (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  lat         double precision,
  lng         double precision,
  accuracy    double precision,
  recorded_at timestamptz not null default now()
);

-- ── notifications ──
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  trip_id     uuid references trips(id),
  title       text not null,
  body        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── push_subscriptions ──
create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text,
  auth_key    text,
  created_at  timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS (security definer, fixed search_path)
-- Placed after all tables so Postgres can resolve the table
-- references (profiles, trip_members) at function-creation time.
-- ──────────────────────────────────────────────────────────────
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function is_trip_member(trip uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from trip_members
    where trip_id = trip and user_id = auth.uid()
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY + POLICIES
-- All tables exist and both helper functions are defined above.
-- ──────────────────────────────────────────────────────────────

-- ── profiles ──
alter table profiles enable row level security;

create policy "Users read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Admins full access on profiles"
  on profiles for all
  using (is_admin());

-- ── traveller_details ──
alter table traveller_details enable row level security;

create policy "Users read own traveller_details"
  on traveller_details for select
  using (user_id = auth.uid());

create policy "Users update own traveller_details"
  on traveller_details for update
  using (user_id = auth.uid());

create policy "Admins full access on traveller_details"
  on traveller_details for all
  using (is_admin());

-- ── destinations ──
alter table destinations enable row level security;

create policy "Authenticated users read destinations"
  on destinations for select
  to authenticated
  using (true);

create policy "Admins manage destinations"
  on destinations for all
  using (is_admin());

-- ── trips ──
alter table trips enable row level security;

create policy "Guests see own published trips"
  on trips for select
  using (
    status = 'published'
    and is_active = true
    and is_trip_member(id)
  );

create policy "Admins full access on trips"
  on trips for all
  using (is_admin());

-- ── trip_members ──
alter table trip_members enable row level security;

create policy "Users see own trip memberships"
  on trip_members for select
  using (user_id = auth.uid());

create policy "Admins full access on trip_members"
  on trip_members for all
  using (is_admin());

-- ── trip_contacts ──
alter table trip_contacts enable row level security;

create policy "Trip members see trip contacts"
  on trip_contacts for select
  using (is_trip_member(trip_id));

create policy "Admins full access on trip_contacts"
  on trip_contacts for all
  using (is_admin());

-- ── trip_destinations ──
alter table trip_destinations enable row level security;

create policy "Trip members see trip destinations"
  on trip_destinations for select
  using (is_trip_member(trip_id));

create policy "Admins full access on trip_destinations"
  on trip_destinations for all
  using (is_admin());

-- ── itinerary_days ──
alter table itinerary_days enable row level security;

create policy "Trip members see itinerary"
  on itinerary_days for select
  using (is_trip_member(trip_id));

create policy "Admins full access on itinerary_days"
  on itinerary_days for all
  using (is_admin());

-- ── activities ──
alter table activities enable row level security;

create policy "Trip members see activities"
  on activities for select
  using (
    exists (
      select 1 from itinerary_days id2
      where id2.id = activities.itinerary_day_id
        and is_trip_member(id2.trip_id)
    )
  );

create policy "Admins full access on activities"
  on activities for all
  using (is_admin());

-- ── feedback ──
alter table feedback enable row level security;

create policy "Users see own feedback"
  on feedback for select
  using (user_id = auth.uid());

create policy "Trip members insert feedback"
  on feedback for insert
  with check (
    user_id = auth.uid()
    and is_trip_member(trip_id)
  );

create policy "Admins full access on feedback"
  on feedback for all
  using (is_admin());

-- ── survey_responses ──
alter table survey_responses enable row level security;

create policy "Users see own survey responses"
  on survey_responses for select
  using (user_id = auth.uid());

create policy "Trip members insert survey responses"
  on survey_responses for insert
  with check (
    user_id = auth.uid()
    and is_trip_member(trip_id)
  );

create policy "Admins full access on survey_responses"
  on survey_responses for all
  using (is_admin());

-- ── location_updates ──
alter table location_updates enable row level security;

create policy "Users insert own location"
  on location_updates for insert
  with check (
    user_id = auth.uid()
    and is_trip_member(trip_id)
  );

create policy "Users see own location"
  on location_updates for select
  using (user_id = auth.uid());

create policy "Admins full access on location_updates"
  on location_updates for all
  using (is_admin());

-- ── notifications ──
alter table notifications enable row level security;

create policy "Users see own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "Users update own notifications"
  on notifications for update
  using (user_id = auth.uid());

create policy "Admins full access on notifications"
  on notifications for all
  using (is_admin());

-- ── push_subscriptions ──
alter table push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on push_subscriptions for all
  using (user_id = auth.uid());

create policy "Admins full access on push_subscriptions"
  on push_subscriptions for all
  using (is_admin());
