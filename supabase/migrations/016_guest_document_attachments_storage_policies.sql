-- ============================================================
-- 016_guest_document_attachments_storage_policies.sql
-- Updates Storage RLS policies for guest-documents bucket:
--   Supports both legacy folder structure: `<user_id>/<file>`
--   and new folder structure: `guests/<user_id>/<doc_type>/<filename>`
--   Admins have write (insert, update, delete) and read access.
--   Travellers have read access to their own files only.
--   Assigned leaders have read access to their travellers' files.
-- ============================================================

-- Ensure storage bucket exists
insert into storage.buckets (id, name, public)
values ('guest-documents', 'guest-documents', false)
on conflict (id) do update set public = false;

-- 1. SELECT (View / Download) policy
drop policy if exists "Users view own storage documents" on storage.objects;
create policy "Users view own storage documents"
  on storage.objects for select
  using (
    bucket_id = 'guest-documents'
    and (
      -- Admin has full read access
      is_admin()
      -- Legacy path: <user_id>/<file>
      or auth.uid()::text = (storage.foldername(name))[1]
      -- New path: guests/<user_id>/<doc_type>/<filename>
      or (
        (storage.foldername(name))[1] = 'guests'
        and auth.uid()::text = (storage.foldername(name))[2]
      )
      -- Assigned leader read access (legacy or new path)
      or exists (
        select 1 from profiles
        where (
          id::text = (storage.foldername(name))[1]
          or (
            (storage.foldername(name))[1] = 'guests'
            and id::text = (storage.foldername(name))[2]
          )
        )
        and leader_id = auth.uid()
      )
    )
  );

-- 2. INSERT (Upload) policy
drop policy if exists "Users upload own storage documents" on storage.objects;
create policy "Users upload own storage documents"
  on storage.objects for insert
  with check (
    bucket_id = 'guest-documents'
    and (
      -- Admin has full insert access
      is_admin()
      -- Legacy path: <user_id>/<file>
      or auth.uid()::text = (storage.foldername(name))[1]
      -- New path: guests/<user_id>/<doc_type>/<filename>
      or (
        (storage.foldername(name))[1] = 'guests'
        and auth.uid()::text = (storage.foldername(name))[2]
      )
    )
  );

-- 3. UPDATE policy
drop policy if exists "Users update own storage documents" on storage.objects;
create policy "Users update own storage documents"
  on storage.objects for update
  using (
    bucket_id = 'guest-documents'
    and (
      is_admin()
      or auth.uid()::text = (storage.foldername(name))[1]
      or (
        (storage.foldername(name))[1] = 'guests'
        and auth.uid()::text = (storage.foldername(name))[2]
      )
    )
  );

-- 4. DELETE policy
drop policy if exists "Users delete own storage documents" on storage.objects;
create policy "Users delete own storage documents"
  on storage.objects for delete
  using (
    bucket_id = 'guest-documents'
    and (
      is_admin()
      or auth.uid()::text = (storage.foldername(name))[1]
      or (
        (storage.foldername(name))[1] = 'guests'
        and auth.uid()::text = (storage.foldername(name))[2]
      )
    )
  );

