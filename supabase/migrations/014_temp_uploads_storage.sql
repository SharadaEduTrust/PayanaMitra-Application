-- ============================================================
-- 014_temp_uploads_storage.sql
-- Private Storage bucket for temporary admin uploads prior to
-- server-side validation, compression, and final placement.
-- ============================================================

-- 1. Create temp-uploads bucket (private)
insert into storage.buckets (id, name, public)
values ('temp-uploads', 'temp-uploads', false)
on conflict (id) do nothing;

-- 2. Storage RLS policies for temp-uploads bucket (Admin-only)
drop policy if exists "Admins view temp upload objects" on storage.objects;
create policy "Admins view temp upload objects"
  on storage.objects for select
  using (
    bucket_id = 'temp-uploads'
    and is_admin()
  );

drop policy if exists "Admins insert temp upload objects" on storage.objects;
create policy "Admins insert temp upload objects"
  on storage.objects for insert
  with check (
    bucket_id = 'temp-uploads'
    and is_admin()
  );

drop policy if exists "Admins update temp upload objects" on storage.objects;
create policy "Admins update temp upload objects"
  on storage.objects for update
  using (
    bucket_id = 'temp-uploads'
    and is_admin()
  );

drop policy if exists "Admins delete temp upload objects" on storage.objects;
create policy "Admins delete temp upload objects"
  on storage.objects for delete
  using (
    bucket_id = 'temp-uploads'
    and is_admin()
  );

