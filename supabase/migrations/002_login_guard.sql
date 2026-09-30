-- ============================================================
-- 002_login_guard.sql
-- login_attempts table for rate limiting
-- RLS is ON but no policies are added — this table is
-- accessible only via the service-role key (server-only).
-- ============================================================

create table login_attempts (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  ip          text not null,
  succeeded   boolean not null default false,
  attempted_at timestamptz not null default now()
);

-- Index for fast rate-limit queries
create index login_attempts_phone_idx
  on login_attempts (phone, attempted_at desc);

create index login_attempts_ip_idx
  on login_attempts (ip, attempted_at desc);

-- RLS on, but zero policies → only service-role can access
alter table login_attempts enable row level security;
