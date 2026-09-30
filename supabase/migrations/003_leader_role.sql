-- ============================================================
-- 003_leader_role.sql
-- Adds 'leader' to the user_role enum
-- Must be a separate migration because ALTER TYPE ADD VALUE
-- cannot run inside a transaction with other DDL in Postgres.
-- ============================================================

alter type user_role add value if not exists 'leader';
