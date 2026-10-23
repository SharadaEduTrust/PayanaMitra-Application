-- ============================================================
-- 009_profile_referral_name.sql
-- Adds referral_name column to profiles table to capture
-- the name of the person who referred the guest/user.
-- ============================================================

alter table profiles
  add column if not exists referral_name text;

comment on column profiles.referral_name is 'Name of the person who referred this guest/user';
