alter table public.audit_logs
  add column if not exists metadata jsonb not null default '{}'::jsonb;
