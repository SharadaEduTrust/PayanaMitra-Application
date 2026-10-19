-- ============================================================
-- 006_spec_alignment.sql
-- Aligns the existing database with the Payana Mitra specification.
--
-- This migration adds:
--   1. user_roles table with seed data (Guest, Leader, Admin)
--   2. profiles.leader_id for leader ↔ guest assignment
--   3. traveller_details.passport_issued_location
--   4. CHECK constraints for field lengths & date validation
--   5. leader_guests_view and trip_summary_view
--   6. RLS policies for new table + leader access to guest profiles
--   7. Performance indexes
--   8. validate_role_status() trigger
--
-- Safe to re-run: all statements use IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. USER ROLES TABLE
-- ──────────────────────────────────────────────────────────────

create table if not exists user_roles (
  id          int generated always as identity primary key,
  role_name   text not null unique
              constraint user_roles_name_length check (char_length(role_name) <= 30),
  status      text not null default 'active'
              constraint user_roles_status_check check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed the three required roles (idempotent)
insert into user_roles (role_name, status)
values
  ('traveller', 'active'),
  ('leader', 'active'),
  ('admin', 'active')
on conflict (role_name) do nothing;

-- RLS on user_roles
alter table user_roles enable row level security;

-- Everyone can read roles (needed for dropdowns, etc.)
drop policy if exists "Authenticated users read roles" on user_roles;
create policy "Authenticated users read roles"
  on user_roles for select
  to authenticated
  using (true);

-- Only admins can manage roles
drop policy if exists "Admins manage roles" on user_roles;
create policy "Admins manage roles"
  on user_roles for all
  using (is_admin());

-- updated_at trigger for user_roles
create or replace function update_user_roles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_roles_updated_at on user_roles;
create trigger user_roles_updated_at
  before update on user_roles
  for each row execute function update_user_roles_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 2. PROFILES — ADD leader_id COLUMN
-- Models the "Trail Leader Table" requirement: each guest
-- user is assigned to one leader via this FK.
-- Reassignment = UPDATE profiles SET leader_id = :new_leader
-- ──────────────────────────────────────────────────────────────

alter table profiles
  add column if not exists leader_id uuid references profiles(id) on delete set null;

-- Index for fast "find all guests of leader X" queries
create index if not exists idx_profiles_leader_id on profiles(leader_id)
  where leader_id is not null;

-- ──────────────────────────────────────────────────────────────
-- 3. TRAVELLER_DETAILS — ADD passport_issued_location
-- The passport number itself is stored encrypted in
-- guest_documents. The issued location is not sensitive
-- enough to require encryption.
-- ──────────────────────────────────────────────────────────────

alter table traveller_details
  add column if not exists passport_issued_location text;

-- ──────────────────────────────────────────────────────────────
-- 4. CHECK CONSTRAINTS — Field lengths per specification
-- ──────────────────────────────────────────────────────────────

-- profiles: first_name ≤ 50, last_name ≤ 50, location ≤ 50, phone: 10-15 digits
do $$ begin
  alter table profiles
    add constraint profiles_first_name_length
    check (char_length(first_name) <= 50) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table profiles
    add constraint profiles_last_name_length
    check (char_length(last_name) <= 50) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table profiles
    add constraint profiles_location_length
    check (location is null or char_length(location) <= 50) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table profiles
    add constraint profiles_phone_format
    check (phone ~ '^\+?[0-9]{10,15}$') not valid;
exception when duplicate_object then null;
end $$;

-- trips: name ≤ 100, destination ≤ 100, end_date >= start_date
do $$ begin
  alter table trips
    add constraint trips_name_length
    check (char_length(name) <= 100) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table trips
    add constraint trips_destination_length
    check (destination is null or char_length(destination) <= 100) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table trips
    add constraint trips_date_order
    check (
      start_date is null
      or end_date is null
      or end_date >= start_date
    ) not valid;
exception when duplicate_object then null;
end $$;

-- itinerary_days: day_number > 0, destination ≤ 100, itinerary_text ≤ 500, hotel_name ≤ 100
do $$ begin
  alter table itinerary_days
    add constraint itinerary_day_positive
    check (day_number > 0) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table itinerary_days
    add constraint itinerary_destination_length
    check (destination is null or char_length(destination) <= 100) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table itinerary_days
    add constraint itinerary_text_length
    check (itinerary_text is null or char_length(itinerary_text) <= 500) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table itinerary_days
    add constraint itinerary_hotel_length
    check (hotel_name is null or char_length(hotel_name) <= 100) not valid;
exception when duplicate_object then null;
end $$;

-- traveller_details: field length constraints
do $$ begin
  alter table traveller_details
    add constraint td_food_allergy_length
    check (food_allergy is null or char_length(food_allergy) <= 50) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table traveller_details
    add constraint td_emergency_name_length
    check (emergency_contact_name is null or char_length(emergency_contact_name) <= 50) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table traveller_details
    add constraint td_emergency_no_format
    check (emergency_contact_no is null or emergency_contact_no ~ '^\+?[0-9]{10,15}$') not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table traveller_details
    add constraint td_insurance_no_length
    check (travel_insurance_no is null or char_length(travel_insurance_no) <= 50) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table traveller_details
    add constraint td_insurance_company_length
    check (insurance_company is null or char_length(insurance_company) <= 50) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table traveller_details
    add constraint td_passport_location_length
    check (passport_issued_location is null or char_length(passport_issued_location) <= 50) not valid;
exception when duplicate_object then null;
end $$;

-- ──────────────────────────────────────────────────────────────
-- 5. UNIQUE CONSTRAINT: one traveller_details per user
-- ──────────────────────────────────────────────────────────────

-- Clean up any duplicates before applying unique constraint
delete from traveller_details a
using traveller_details b
where a.user_id = b.user_id
  and a.ctid < b.ctid;

do $$ begin
  alter table traveller_details
    add constraint traveller_details_user_unique
    unique (user_id);
exception when duplicate_object then null;
end $$;

-- ──────────────────────────────────────────────────────────────
-- 6. VALIDATE ROLE TRIGGER
-- Ensures profiles.role corresponds to an active role in
-- user_roles when inserting or updating a profile.
-- ──────────────────────────────────────────────────────────────

create or replace function validate_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles
    where role_name = new.role::text
      and status = 'active'
  ) then
    raise exception 'Role "%" is not active in user_roles', new.role::text;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_profile_role_trigger on profiles;
create trigger validate_profile_role_trigger
  before insert or update of role on profiles
  for each row execute function validate_profile_role();

-- ──────────────────────────────────────────────────────────────
-- 7. VALIDATE LEADER ASSIGNMENT TRIGGER
-- Ensures that:
--   a) leader_id references a user with role = 'leader' or 'admin'
--   b) leaders and admins cannot be assigned a leader themselves
-- ──────────────────────────────────────────────────────────────

create or replace function validate_leader_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  leader_role user_role;
begin
  -- Skip if leader_id is null (unassigned)
  if new.leader_id is null then
    return new;
  end if;

  -- Check the leader has the 'leader' role (or is an 'admin' acting as leader)
  select role into leader_role from profiles where id = new.leader_id;
  if leader_role is null then
    raise exception 'Leader ID % does not exist', new.leader_id;
  end if;
  if leader_role not in ('leader', 'admin') then
    raise exception 'User % is not a leader or admin (role: %)', new.leader_id, leader_role;
  end if;

  -- A leader should not be assigned to another leader
  if new.role in ('leader', 'admin') and new.leader_id is not null then
    raise exception 'Leaders and admins cannot be assigned a leader';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_leader_assignment_trigger on profiles;
create trigger validate_leader_assignment_trigger
  before insert or update of leader_id on profiles
  for each row execute function validate_leader_assignment();

-- ──────────────────────────────────────────────────────────────
-- 8. CONVENIENCE VIEWS
-- ──────────────────────────────────────────────────────────────

-- Leader ↔ Guests view (maps to spec's "Trail Leader Table")
-- Shows each leader and the guests assigned to them.
create or replace view leader_guests_view
with (security_invoker = true)
as
  select
    l.id                as leader_id,
    l.first_name        as leader_first_name,
    l.last_name         as leader_last_name,
    l.phone             as leader_phone,
    g.id                as guest_id,
    g.first_name        as guest_first_name,
    g.last_name         as guest_last_name,
    g.phone             as guest_phone,
    g.email             as guest_email,
    g.is_active         as guest_is_active
  from profiles l
  inner join profiles g on g.leader_id = l.id
  where l.role in ('leader', 'admin');

-- Trip summary view: trip + leader + member count
create or replace view trip_summary_view
with (security_invoker = true)
as
  select
    t.id                as trip_id,
    t.trip_code,
    t.name              as trip_name,
    t.destination,
    t.start_date,
    t.end_date,
    t.status,
    t.is_active,
    p.id                as leader_id,
    p.first_name        as leader_first_name,
    p.last_name         as leader_last_name,
    p.phone             as leader_phone,
    (select count(*) from trip_members tm where tm.trip_id = t.id)
                        as member_count
  from trips t
  left join profiles p on p.id = t.leader_id;

-- ──────────────────────────────────────────────────────────────
-- 9. HELPER FUNCTION: is_leader_of_user
-- Returns true if the current auth user is the assigned leader
-- of the given user_id.
-- ──────────────────────────────────────────────────────────────

create or replace function is_leader_of_user(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = target_user_id
      and leader_id = auth.uid()
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- 10. RLS POLICY UPDATES
-- Leaders can now view profiles of their assigned guests.
-- ──────────────────────────────────────────────────────────────

-- Leaders can read profiles of guests assigned to them
drop policy if exists "Leaders read assigned guest profiles" on profiles;
create policy "Leaders read assigned guest profiles"
  on profiles for select
  using (leader_id = auth.uid());

-- Leaders can read traveller_details of their assigned guests
drop policy if exists "Leaders read assigned guest details" on traveller_details;
create policy "Leaders read assigned guest details"
  on traveller_details for select
  using (is_leader_of_user(user_id));

-- Leaders can read guest_documents of their assigned guests
-- (for trip coordination — e.g., verifying passport for bookings)
drop policy if exists "Leaders read assigned guest documents" on guest_documents;
create policy "Leaders read assigned guest documents"
  on guest_documents for select
  using (is_leader_of_user(user_id));

-- ──────────────────────────────────────────────────────────────
-- 11. ADDITIONAL INDEXES
-- ──────────────────────────────────────────────────────────────

-- Fast lookups by trip status
create index if not exists idx_trips_status on trips(status);

-- Fast lookups by user role
create index if not exists idx_profiles_role on profiles(role);

-- Itinerary ordering
create index if not exists idx_itinerary_trip_day on itinerary_days(trip_id, day_number);

-- Trip members by user (find all trips for a user)
create index if not exists idx_trip_members_user on trip_members(user_id);

-- Notifications unread
create index if not exists idx_notifications_unread on notifications(user_id, is_read)
  where not is_read;

-- ──────────────────────────────────────────────────────────────
-- 12. UPDATED_AT TRIGGERS for all tables with updated_at
-- ──────────────────────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- profiles
drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at_column();

-- traveller_details
drop trigger if exists traveller_details_updated_at on traveller_details;
create trigger traveller_details_updated_at
  before update on traveller_details
  for each row execute function update_updated_at_column();

-- trips
drop trigger if exists trips_updated_at on trips;
create trigger trips_updated_at
  before update on trips
  for each row execute function update_updated_at_column();

-- itinerary_days
drop trigger if exists itinerary_days_updated_at on itinerary_days;
create trigger itinerary_days_updated_at
  before update on itinerary_days
  for each row execute function update_updated_at_column();

-- guest_documents
drop trigger if exists guest_documents_updated_at on guest_documents;
create trigger guest_documents_updated_at
  before update on guest_documents
  for each row execute function update_updated_at_column();
