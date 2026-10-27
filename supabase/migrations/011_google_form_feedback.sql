-- ============================================================
-- 011_google_form_feedback.sql
-- Add feedback_form_url and feedback_window_days to trips
-- Supports capturing a Google Form link for post-trail feedback,
-- and setting a fixed submission window (in days) after the trail ends.
-- ============================================================

alter table trips
  add column if not exists feedback_form_url text,
  add column if not exists feedback_window_days integer default 7;

comment on column trips.feedback_form_url is 'Google Form (or external form) link for post-trail guest feedback';
comment on column trips.feedback_window_days is 'Number of days the feedback form remains accessible after the trail ends';
