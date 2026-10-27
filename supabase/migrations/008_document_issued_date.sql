-- ============================================================
-- 008_document_issued_date.sql
-- Adds optional issued_date and issued_place to guest_documents.
-- ============================================================

alter table guest_documents
  add column if not exists issued_date date,
  add column if not exists issued_place text;

do $$ begin
  alter table guest_documents
    add constraint guest_documents_issued_place_length
    check (issued_place is null or char_length(issued_place) <= 100) not valid;
exception when duplicate_object then null;
end $$;
