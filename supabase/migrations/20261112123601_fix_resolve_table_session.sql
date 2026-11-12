create or replace function public.resolve_table_session(p_table_code uuid)
returns table(session_id uuid, table_id uuid, table_number integer, session_expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare v_table public.dining_tables; v_session public.table_sessions;
begin
  select * into v_table from public.dining_tables as dt where dt.table_code = p_table_code for update;
  if not found or not v_table.is_active then raise exception 'TABLE_UNAVAILABLE' using errcode = 'P0002'; end if;
  select ts.* into v_session from public.table_sessions as ts
    where ts.table_id = v_table.id and ts.status = 'ACTIVE' for update;
  if found and v_session.expires_at <= now() then
    update public.table_sessions set status = 'EXPIRED', closed_at = now() where id = v_session.id;
    v_session := null;
  end if;
  if v_session.id is null then
    insert into public.table_sessions(table_id) values (v_table.id) returning * into v_session;
  end if;
  return query select v_session.id, v_table.id, v_table.table_number, v_session.expires_at;
end $$;
