-- 012_feedback_rating_ten.sql
-- Allow rating to be between 1 and 10 in feedback table

alter table feedback drop constraint if exists feedback_rating_check;
alter table feedback add constraint feedback_rating_check check (rating between 1 and 10);
