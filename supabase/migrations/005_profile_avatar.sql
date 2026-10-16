-- ============================================================
-- 005_profile_avatar.sql
-- profiles.avatar_url + public `avatars` storage bucket
-- ============================================================
--
-- Run this after 004_sheet_features.sql, in the SQL Editor or via
-- `supabase db push`. It is safe to re-run: every statement is
-- guarded with `if not exists` / `drop policy if exists`.

-- ──────────────────────────────────────────────────────────────
-- AVATAR COLUMN
-- `profiles` has no client UPDATE policy, so writes go through the
-- service-role route at app/api/profile/avatar/route.ts. The column
-- is still readable by the owner through "Users read own profile".
-- ──────────────────────────────────────────────────────────────
alter table profiles
  add column if not exists avatar_url text;

-- ──────────────────────────────────────────────────────────────
-- STORAGE BUCKET
-- Public read so the <img> tag can load it without a signed URL;
-- avatars are not sensitive. Writes are restricted to the owner of
-- the first path segment, i.e. `avatars/<auth.uid()>/<file>`.
-- ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Users may read any avatar (the bucket is public anyway, but this
-- keeps direct storage API reads consistent).
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
