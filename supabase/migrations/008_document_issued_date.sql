-- ============================================================
-- 008_document_issued_date.sql
-- Add issued_date column to guest_documents table
-- Supports recording Document Issued Date alongside Expiry Date
-- ============================================================

alter table guest_documents
  add column if not exists issued_date date;
