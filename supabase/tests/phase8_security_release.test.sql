begin;

do $$
declare
  v_unprotected_tables text;
  v_unsafe_search_path text;
  v_public_security_definers text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by c.relname)
    into v_unprotected_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  assert v_unprotected_tables is null, format('public tables must enable RLS: %s', v_unprotected_tables);

  select string_agg(p.proname, ', ' order by p.proname)
    into v_unsafe_search_path
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[];
  assert v_unsafe_search_path is null, format('SECURITY DEFINER functions must pin an empty search_path: %s', v_unsafe_search_path);

  select string_agg(p.proname, ', ' order by p.proname)
    into v_public_security_definers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.oid <> to_regprocedure('public.get_public_restaurant_settings()');
  assert v_public_security_definers is null,
    format('unexpected anonymous EXECUTE on SECURITY DEFINER functions: %s', v_public_security_definers);

  assert not has_table_privilege('anon', 'public.staff_profiles', 'SELECT'), 'anonymous users must not read staff profiles';
  assert not has_table_privilege('anon', 'public.payments', 'SELECT'), 'anonymous users must not read payment details';
  assert not has_table_privilege('anon', 'public.receipts', 'SELECT'), 'anonymous users must not read receipt state';
  assert not has_table_privilege('anon', 'public.audit_logs', 'SELECT'), 'anonymous users must not read audit logs';
  assert not has_table_privilege('authenticated', 'public.orders', 'INSERT, UPDATE, DELETE'), 'authenticated users must not mutate orders directly';
  assert not has_table_privilege('authenticated', 'public.payments', 'INSERT, UPDATE, DELETE'), 'authenticated users must not mutate payments directly';
  assert not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT, UPDATE, DELETE'), 'authenticated users must not mutate audit logs directly';

  assert not has_function_privilege('anon', 'public.consume_api_rate_limit(text,integer,integer)', 'EXECUTE'), 'rate limit counter must be server-only';
  assert not has_function_privilege('anon', 'public.resolve_table_session(uuid)', 'EXECUTE'), 'table session resolution must be server-only';
  assert not has_function_privilege('anon', 'public.create_customer_order(uuid,uuid,uuid,jsonb,text,text,text,text,text)', 'EXECUTE'), 'order creation must be server-only';
  assert not has_function_privilege('anon', 'public.process_midtrans_payment_event(text,text,text,text,text,bigint)', 'EXECUTE'), 'payment transitions must be server-only';
  assert not has_function_privilege('anon', 'public.claim_receipt_email(uuid,text,boolean)', 'EXECUTE'), 'receipt email claims must be server-only';
end
$$;

rollback;
