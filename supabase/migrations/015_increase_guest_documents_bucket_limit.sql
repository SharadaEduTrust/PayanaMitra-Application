-- ============================================================
-- 015_increase_guest_documents_bucket_limit.sql
-- Increase file size limit on guest-documents bucket to 25MB
-- to support larger administrative document uploads before and after compression.
-- ============================================================

update storage.buckets
set file_size_limit = 26214400
where id = 'guest-documents';
