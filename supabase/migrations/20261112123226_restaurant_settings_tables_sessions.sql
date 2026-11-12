create table public.restaurant_settings (
  singleton boolean primary key default true check (singleton),
  timezone text not null default 'Asia/Jakarta' check (timezone = 'Asia/Jakarta'),
  opening_time time,
  closing_time time,
  temporary_closed boolean not null default false,
  temporary_close_reason text,
  temporary_close_other text,
  temporary_closed_at timestamptz,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((opening_time is null) = (closing_time is null)),
  check (opening_time is null or opening_time <> closing_time),
  check (temporary_close_reason is null or temporary_close_reason in ('STOCK_OUT', 'OPERATIONAL_ISSUE', 'EMERGENCY', 'OTHER')),
  check (temporary_close_reason <> 'OTHER' or nullif(trim(temporary_close_other), '') is not null)
);

insert into public.restaurant_settings (singleton) values (true);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  table_code uuid not null unique default gen_random_uuid(),
  table_number integer not null unique check (table_number > 0),
  is_active boolean not null default true,
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dining_tables(id) on delete restrict,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  closed_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXPIRED', 'CLOSED')),
  check (expires_at > started_at),
  check ((status = 'ACTIVE') = (closed_at is null))
);

create unique index table_sessions_one_active_per_table
  on public.table_sessions (table_id) where status = 'ACTIVE';
create index table_sessions_expiry_idx on public.table_sessions (expires_at) where status = 'ACTIVE';

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references public.staff_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.restaurant_settings enable row level security;
alter table public.dining_tables enable row level security;
alter table public.table_sessions enable row level security;
alter table public.audit_logs enable row level security;

create policy "Authenticated staff can read restaurant settings"
  on public.restaurant_settings for select to authenticated using (
    exists (select 1 from public.staff_profiles p where p.auth_user_id = (select auth.uid()) and p.is_active)
  );
create policy "Admins can manage restaurant settings"
  on public.restaurant_settings for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy "Admins can read dining tables"
  on public.dining_tables for select to authenticated using (public.is_active_admin());
create policy "Staff can read active dining tables"
  on public.dining_tables for select to authenticated using (
    is_active and exists (select 1 from public.staff_profiles p where p.auth_user_id = (select auth.uid()) and p.is_active)
  );
create policy "Admins can manage dining tables"
  on public.dining_tables for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy "Staff can read sessions"
  on public.table_sessions for select to authenticated using (
    exists (select 1 from public.staff_profiles p where p.auth_user_id = (select auth.uid()) and p.is_active)
  );
create policy "Admins can read audit logs"
  on public.audit_logs for select to authenticated using (public.is_active_admin());

grant select on public.restaurant_settings, public.dining_tables, public.table_sessions, public.audit_logs to authenticated;

create or replace function public.admin_save_operating_hours(p_opening_time time, p_closing_time time)
returns public.restaurant_settings
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid; v_before jsonb; v_result public.restaurant_settings;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  select to_jsonb(s) into v_before from public.restaurant_settings s where singleton for update;
  update public.restaurant_settings set opening_time = p_opening_time, closing_time = p_closing_time,
    updated_by = v_actor, updated_at = now() where singleton returning * into v_result;
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
    values (v_actor, 'OPERATING_HOURS_UPDATED', 'restaurant_settings', 'singleton', v_before, to_jsonb(v_result));
  return v_result;
end $$;

create or replace function public.admin_temporary_close(p_reason text, p_other text default null)
returns public.restaurant_settings
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid; v_before jsonb; v_result public.restaurant_settings;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_reason not in ('STOCK_OUT', 'OPERATIONAL_ISSUE', 'EMERGENCY', 'OTHER') then raise exception 'INVALID_REASON' using errcode = '22023'; end if;
  if p_reason = 'OTHER' and nullif(trim(p_other), '') is null then raise exception 'OTHER_REASON_REQUIRED' using errcode = '22023'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  select to_jsonb(s) into v_before from public.restaurant_settings s where singleton for update;
  update public.restaurant_settings set temporary_closed = true, temporary_close_reason = p_reason,
    temporary_close_other = case when p_reason = 'OTHER' then trim(p_other) else null end,
    temporary_closed_at = now(), updated_by = v_actor, updated_at = now()
    where singleton returning * into v_result;
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
    values (v_actor, 'RESTAURANT_TEMPORARILY_CLOSED', 'restaurant_settings', 'singleton', v_before, to_jsonb(v_result));
  return v_result;
end $$;

create or replace function public.admin_reopen_restaurant()
returns public.restaurant_settings
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid; v_before jsonb; v_result public.restaurant_settings;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  select to_jsonb(s) into v_before from public.restaurant_settings s where singleton for update;
  update public.restaurant_settings set temporary_closed = false, temporary_close_reason = null,
    temporary_close_other = null, temporary_closed_at = null, updated_by = v_actor, updated_at = now()
    where singleton returning * into v_result;
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
    values (v_actor, 'RESTAURANT_REOPENED', 'restaurant_settings', 'singleton', v_before, to_jsonb(v_result));
  return v_result;
end $$;

create or replace function public.admin_create_table(p_table_number integer)
returns public.dining_tables
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid; v_result public.dining_tables;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_table_number <= 0 then raise exception 'INVALID_TABLE_NUMBER' using errcode = '22023'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  insert into public.dining_tables(table_number, created_by, updated_by) values (p_table_number, v_actor, v_actor) returning * into v_result;
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, after_value)
    values (v_actor, 'TABLE_CREATED', 'dining_table', v_result.id::text, to_jsonb(v_result));
  return v_result;
end $$;

create or replace function public.admin_update_table(p_table_id uuid, p_table_number integer)
returns public.dining_tables
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid; v_before jsonb; v_result public.dining_tables;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_table_number <= 0 then raise exception 'INVALID_TABLE_NUMBER' using errcode = '22023'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  select to_jsonb(t) into v_before from public.dining_tables t where id = p_table_id for update;
  if v_before is null then raise exception 'TABLE_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.dining_tables set table_number = p_table_number, updated_by = v_actor, updated_at = now()
    where id = p_table_id returning * into v_result;
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
    values (v_actor, 'TABLE_UPDATED', 'dining_table', v_result.id::text, v_before, to_jsonb(v_result));
  return v_result;
end $$;

create or replace function public.admin_set_table_active(p_table_id uuid, p_is_active boolean)
returns public.dining_tables
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid; v_before jsonb; v_result public.dining_tables;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  select to_jsonb(t) into v_before from public.dining_tables t where id = p_table_id for update;
  if v_before is null then raise exception 'TABLE_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.dining_tables set is_active = p_is_active, updated_by = v_actor, updated_at = now()
    where id = p_table_id returning * into v_result;
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
    values (v_actor, case when p_is_active then 'TABLE_ACTIVATED' else 'TABLE_DEACTIVATED' end,
      'dining_table', v_result.id::text, v_before, to_jsonb(v_result));
  return v_result;
end $$;

create or replace function public.resolve_table_session(p_table_code uuid)
returns table(session_id uuid, table_id uuid, table_number integer, session_expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare v_table public.dining_tables; v_session public.table_sessions;
begin
  select * into v_table from public.dining_tables where table_code = p_table_code for update;
  if not found or not v_table.is_active then raise exception 'TABLE_UNAVAILABLE' using errcode = 'P0002'; end if;
  select * into v_session from public.table_sessions where table_id = v_table.id and status = 'ACTIVE' for update;
  if found and v_session.expires_at <= now() then
    update public.table_sessions set status = 'EXPIRED', closed_at = now() where id = v_session.id;
    v_session := null;
  end if;
  if v_session.id is null then
    insert into public.table_sessions(table_id) values (v_table.id) returning * into v_session;
  end if;
  return query select v_session.id, v_table.id, v_table.table_number, v_session.expires_at;
end $$;

create or replace function public.extend_active_table_session(p_session_id uuid)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare v_expiry timestamptz;
begin
  update public.table_sessions set expires_at = now() + interval '60 minutes'
    where id = p_session_id and status = 'ACTIVE' and expires_at > now()
    returning expires_at into v_expiry;
  if v_expiry is null then raise exception 'SESSION_EXPIRED' using errcode = 'P0002'; end if;
  return v_expiry;
end $$;

revoke all on function public.admin_save_operating_hours(time, time), public.admin_temporary_close(text, text),
  public.admin_reopen_restaurant(), public.admin_create_table(integer), public.admin_update_table(uuid, integer),
  public.admin_set_table_active(uuid, boolean) from public, anon;
grant execute on function public.admin_save_operating_hours(time, time), public.admin_temporary_close(text, text),
  public.admin_reopen_restaurant(), public.admin_create_table(integer), public.admin_update_table(uuid, integer),
  public.admin_set_table_active(uuid, boolean) to authenticated;

revoke all on function public.resolve_table_session(uuid), public.extend_active_table_session(uuid) from public;
grant execute on function public.resolve_table_session(uuid) to anon, authenticated;
grant execute on function public.extend_active_table_session(uuid) to service_role;
