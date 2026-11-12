begin;

do $$
declare
  v_code uuid;
  v_table uuid;
  v_first_session uuid;
  v_joined_session uuid;
  v_new_session uuid;
  v_rls_enabled boolean;
  v_inactive_rejected boolean := false;
begin
  assert to_regclass('public.restaurant_settings') is not null, 'restaurant_settings table must exist';
  assert to_regclass('public.dining_tables') is not null, 'dining_tables table must exist';
  assert to_regclass('public.table_sessions') is not null, 'table_sessions table must exist';

  select relrowsecurity into v_rls_enabled from pg_class where oid = 'public.dining_tables'::regclass;
  assert v_rls_enabled, 'RLS must be enabled on dining_tables';

  insert into public.dining_tables(table_number) values (987654) returning id, table_code into v_table, v_code;
  assert substring(v_code::text from 15 for 1) = '4', 'table code must use UUIDv4';
  select session_id into v_first_session from public.resolve_table_session(v_code);
  select session_id into v_joined_session from public.resolve_table_session(v_code);
  assert v_first_session = v_joined_session, 'a subsequent scan must join the active session';

  update public.table_sessions set started_at = now() - interval '2 minutes', expires_at = now() - interval '1 second'
    where id = v_first_session;
  select session_id into v_new_session from public.resolve_table_session(v_code);
  assert v_new_session <> v_first_session, 'an expired session must be replaced';

  update public.dining_tables set is_active = false where id = v_table;
  begin
    perform * from public.resolve_table_session(v_code);
  exception when sqlstate 'P0002' then
    v_inactive_rejected := true;
  end;
  assert v_inactive_rejected, 'an inactive table must reject new sessions';
end
$$;

rollback;
