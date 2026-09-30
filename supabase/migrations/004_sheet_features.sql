-- ============================================================
-- 004_sheet_features.sql
-- roles table, leader trip mapping, guest_documents,
-- audit_log, trail_leader_view, copy_trip()
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- HELPER: is_leader_of_trip
-- ──────────────────────────────────────────────────────────────
create or replace function is_leader_of_trip(trip uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from trips
    where id = trip and leader_id = auth.uid()
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- Update existing admin policies to include leaders
-- Leaders can read (not write) their assigned trips
-- ──────────────────────────────────────────────────────────────

-- Extend trips SELECT so leaders see their trips regardless of status
drop policy if exists "Guests see own published trips" on trips;

create policy "Guests see own published trips"
  on trips for select
  using (
    (status = 'published' and is_active = true and is_trip_member(id))
    or is_leader_of_trip(id)
    or is_admin()
  );

-- Leaders see trip members for their trips
create policy "Leaders see members of own trips"
  on trip_members for select
  using (is_leader_of_trip(trip_id));

-- Leaders see itinerary for their trips
create policy "Leaders see itinerary of own trips"
  on itinerary_days for select
  using (is_leader_of_trip(trip_id));

-- Leaders see contacts for their trips
create policy "Leaders see contacts of own trips"
  on trip_contacts for select
  using (is_leader_of_trip(trip_id));

-- Leaders see activities for their trips
create policy "Leaders see activities of own trips"
  on activities for select
  using (
    exists (
      select 1 from itinerary_days id2
      where id2.id = activities.itinerary_day_id
        and is_leader_of_trip(id2.trip_id)
    )
  );

-- Leaders see feedback for their trips
create policy "Leaders see feedback of own trips"
  on feedback for select
  using (is_leader_of_trip(trip_id));

-- ──────────────────────────────────────────────────────────────
-- GUEST DOCUMENTS (PAN, Passport — encrypted at rest)
-- Encrypted via AES-256-GCM in application layer.
-- This table stores only ciphertext.
-- ──────────────────────────────────────────────────────────────
create table guest_documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  trip_id         uuid references trips(id),
  doc_type        text not null,           -- 'pan', 'passport', 'visa', etc.
  -- ciphertext fields (AES-256-GCM, base64-encoded)
  doc_number_enc  text,                    -- encrypted document number
  iv              text not null,           -- base64-encoded IV (12 bytes)
  auth_tag        text not null,           -- base64-encoded auth tag (16 bytes)
  expiry_date     date,
  issued_country  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table guest_documents enable row level security;

create policy "Users read own documents"
  on guest_documents for select
  using (user_id = auth.uid());

create policy "Users insert own documents"
  on guest_documents for insert
  with check (user_id = auth.uid());

create policy "Users update own documents"
  on guest_documents for update
  using (user_id = auth.uid());

create policy "Admins full access on guest_documents"
  on guest_documents for all
  using (is_admin());

-- ──────────────────────────────────────────────────────────────
-- AUDIT LOG
-- Written only by the service role via server actions.
-- RLS on, no user-facing read policies — admin reads via
-- service role in the admin panel.
-- ──────────────────────────────────────────────────────────────
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id),
  action      text not null,   -- 'create_user', 'update_trip', 'copy_trip', etc.
  entity      text not null,   -- table name
  entity_id   uuid,
  payload     jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);

alter table audit_log enable row level security;

-- No policies: only service-role key can read/write
-- Admins read audit_log only through server-side code using SUPABASE_SERVICE_ROLE_KEY

-- ──────────────────────────────────────────────────────────────
-- TRAIL LEADER VIEW
-- Convenience view: each trip with its leader details.
-- ──────────────────────────────────────────────────────────────
create view trail_leader_view
with (security_invoker = true)
as
  select
    t.id                as trip_id,
    t.trip_code,
    t.name              as trip_name,
    t.start_date,
    t.end_date,
    t.status,
    p.id                as leader_id,
    p.first_name        as leader_first_name,
    p.last_name         as leader_last_name,
    p.phone             as leader_phone,
    p.email             as leader_email
  from trips t
  left join profiles p on p.id = t.leader_id;

-- ──────────────────────────────────────────────────────────────
-- copy_trip(source_trip_id, new_trip_code, new_name, new_start_date)
-- Duplicates a trip and its full itinerary (no members).
-- Returns the new trip's id.
-- ──────────────────────────────────────────────────────────────
create or replace function copy_trip(
  source_trip_id  uuid,
  new_trip_code   text,
  new_name        text,
  new_start_date  date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  src             trips%rowtype;
  new_trip_id     uuid;
  day_offset      int;
  old_day         itinerary_days%rowtype;
  new_day_id      uuid;
begin
  -- Only admins may call this function
  if not is_admin() then
    raise exception 'permission denied';
  end if;

  select * into src from trips where id = source_trip_id;
  if not found then
    raise exception 'source trip not found';
  end if;

  -- If a new start date is provided, compute the offset to shift all days
  if new_start_date is not null and src.start_date is not null then
    day_offset := new_start_date - src.start_date;
  else
    day_offset := 0;
  end if;

  -- Insert the new trip (draft, no members)
  insert into trips (
    trip_code, name, destination,
    start_date, end_date, leader_id,
    status, is_active, remarks
  )
  values (
    new_trip_code,
    new_name,
    src.destination,
    case when new_start_date is not null then new_start_date else src.start_date end,
    case when new_start_date is not null and src.end_date is not null
         then src.end_date + day_offset
         else src.end_date
    end,
    src.leader_id,
    'draft',
    true,
    src.remarks
  )
  returning id into new_trip_id;

  -- Copy itinerary days
  for old_day in
    select * from itinerary_days
    where trip_id = source_trip_id
    order by day_number
  loop
    insert into itinerary_days (
      trip_id, day_number, destination, itinerary_text, hotel_name
    )
    values (
      new_trip_id,
      old_day.day_number,
      old_day.destination,
      old_day.itinerary_text,
      old_day.hotel_name
    )
    returning id into new_day_id;

    -- Copy activities for this day
    insert into activities (
      itinerary_day_id, title, description, start_time, end_time, activity_order
    )
    select
      new_day_id,
      title,
      description,
      start_time,
      end_time,
      activity_order
    from activities
    where itinerary_day_id = old_day.id;
  end loop;

  return new_trip_id;
end;
$$;
