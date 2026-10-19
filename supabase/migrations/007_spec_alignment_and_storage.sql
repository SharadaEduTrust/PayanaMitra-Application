-- ============================================================
-- 007_spec_alignment_and_storage.sql
-- Completes specification requirements:
--   1. itinerary_days.meal_plan column with check constraint
--   2. guest_documents storage fields (storage_path, file_name, file_size, mime_type)
--   3. Private storage bucket for guest-documents
--   4. Update copy_trip to copy meal_plan and support service_role execution
-- ============================================================

-- 1. ITINERARY DAYS MEAL PLAN
alter table itinerary_days
  add column if not exists meal_plan text;

do $$ begin
  alter table itinerary_days
    add constraint itinerary_meal_plan_check
    check (
      meal_plan is null or meal_plan in (
        'Breakfast',
        'Breakfast & Dinner',
        'Breakfast, Lunch & Dinner'
      )
    ) not valid;
exception when duplicate_object then null;
end $$;

-- 2. GUEST DOCUMENTS STORAGE FIELDS
alter table guest_documents
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists file_size integer,
  add column if not exists mime_type text;

-- 3. STORAGE BUCKET FOR GUEST DOCUMENTS (PRIVATE)
insert into storage.buckets (id, name, public)
values ('guest-documents', 'guest-documents', false)
on conflict (id) do nothing;

-- Storage RLS policies for guest-documents bucket
-- Users can view their own documents: folder structure is `<user_id>/<file>`
drop policy if exists "Users view own storage documents" on storage.objects;
create policy "Users view own storage documents"
  on storage.objects for select
  using (
    bucket_id = 'guest-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or is_admin()
      or exists (
        select 1 from profiles
        where id::text = (storage.foldername(name))[1]
          and leader_id = auth.uid()
      )
    )
  );

drop policy if exists "Users upload own storage documents" on storage.objects;
create policy "Users upload own storage documents"
  on storage.objects for insert
  with check (
    bucket_id = 'guest-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or is_admin()
    )
  );

drop policy if exists "Users delete own storage documents" on storage.objects;
create policy "Users delete own storage documents"
  on storage.objects for delete
  using (
    bucket_id = 'guest-documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or is_admin()
    )
  );

-- 4. UPDATE COPY_TRIP FUNCTION
-- Copies itinerary days including meal_plan, and allows service_role or admin execution
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
  -- Allow admin users and service_role callers
  if not (
    is_admin()
    or coalesce(auth.jwt()->>'role', '') = 'service_role'
    or current_user in ('postgres', 'service_role')
  ) then
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

  -- Copy itinerary days (including meal_plan)
  for old_day in
    select * from itinerary_days
    where trip_id = source_trip_id
    order by day_number
  loop
    insert into itinerary_days (
      trip_id, day_number, destination, itinerary_text, hotel_name, meal_plan
    )
    values (
      new_trip_id,
      old_day.day_number,
      old_day.destination,
      old_day.itinerary_text,
      old_day.hotel_name,
      old_day.meal_plan
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
