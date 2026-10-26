-- ============================================================
-- 010_guest_details_passport_issue_and_visa.sql
-- Add passport_issue_date and visa columns to traveller_details
-- Supports capturing Passport Issue Date, Visa No. (10 chars),
-- Visa Expiry Date, and Country in Guest Details.
-- ============================================================

alter table traveller_details
  add column if not exists passport_issue_date date,
  add column if not exists visa_no text,
  add column if not exists visa_expiry date,
  add column if not exists visa_country text;

comment on column traveller_details.passport_issue_date is 'Passport issue date (DD/MM/YYYY or YYYY-MM-DD)';
comment on column traveller_details.visa_no is 'Visa number (alphanumeric up to 10 characters)';
comment on column traveller_details.visa_expiry is 'Visa expiration date';
comment on column traveller_details.visa_country is 'Country for which visa is issued';
