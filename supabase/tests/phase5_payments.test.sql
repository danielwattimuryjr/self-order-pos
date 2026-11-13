begin;

do $$
declare
  v_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_code text := upper('P5-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_category_id uuid := gen_random_uuid();
  v_menu_id uuid := gen_random_uuid();
  v_table_id uuid := gen_random_uuid();
  v_table_code uuid := gen_random_uuid();
  v_session_id uuid := gen_random_uuid();
  v_items jsonb;
  v_order jsonb;
  v_payment jsonb;
  v_result jsonb;
  v_token_hash text := repeat('a', 64);
  v_event_key text;
  v_second_order jsonb;
  v_second_payment jsonb;
  v_table_number integer;
  v_payment_retry jsonb;
  v_payment_key uuid := gen_random_uuid();
begin
  assert (select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'payments must have RLS enabled';
  assert (select relrowsecurity from pg_class where oid = 'public.payment_webhook_events'::regclass), 'webhook events must have RLS enabled';
  assert not has_table_privilege('anon', 'public.payments', 'SELECT'), 'anonymous users must not read payment data';
  assert not has_table_privilege('authenticated', 'public.payments', 'INSERT'), 'authenticated users must not write payment data';
  assert has_table_privilege('service_role', 'public.orders', 'SELECT'), 'service role must read order ownership for payment routes';
  assert has_table_privilege('service_role', 'public.dining_tables', 'SELECT'), 'service role must validate table ownership for payment routes';
  assert has_table_privilege('service_role', 'public.payments', 'SELECT'), 'service role must read payment status';
  assert not has_function_privilege('anon', 'public.create_payment_attempt(uuid,text,uuid)', 'EXECUTE'), 'payment attempt RPC must be server-only';
  assert has_function_privilege('service_role', 'public.create_payment_attempt(uuid,text,uuid)', 'EXECUTE'), 'service role must create attempts';

  update public.restaurant_settings set opening_time = '00:00', closing_time = '23:59:59.999999',
    temporary_closed = false, temporary_close_reason = null, temporary_close_other = null,
    temporary_closed_at = null where singleton;
  insert into public.categories(id, name) values (v_category_id, 'Phase 5 smoke category');
  insert into public.menus(id, category_id, name, description, price) values (v_menu_id, v_category_id, 'Phase 5 smoke item', '', 12000);
  insert into public.vouchers(code, name, discount_type, discount_value, min_transaction, quota,
    starts_on, ends_on, starts_time, ends_time)
  values (v_code, 'Phase 5 smoke voucher', 'FIXED', 1000, 0, 2, v_date, v_date, '00:00', '23:59:59.999999');
  insert into public.voucher_category_scopes(voucher_id, category_id)
    select id, v_category_id from public.vouchers where code = v_code;
  select coalesce(max(table_number), 0) + 1 into v_table_number from public.dining_tables;
  insert into public.dining_tables(id, table_code, table_number) values (v_table_id, v_table_code, v_table_number);
  insert into public.table_sessions(id, table_id, expires_at) values (v_session_id, v_table_id, now() + interval '60 minutes');

  v_items := jsonb_build_array(jsonb_build_object('menuId', v_menu_id, 'quantity', 1, 'note', '',
    'variantSelections', '{}'::jsonb, 'addonSelections', '{}'::jsonb));
  v_order := public.create_customer_order(v_table_code, v_session_id, gen_random_uuid(), v_items, v_code,
    'Payment Test', null, '', v_token_hash);
  v_payment := public.create_payment_attempt((v_order->>'id')::uuid, v_token_hash, v_payment_key);
  assert v_payment->>'existing' = 'false', 'first payment attempt must be newly created';
  assert v_payment->>'attempt_number' = '1', 'first attempt number must be 1';
  v_payment_retry := public.create_payment_attempt((v_order->>'id')::uuid, v_token_hash, v_payment_key);
  assert v_payment_retry->>'existing' = 'true' and v_payment_retry->>'id' = v_payment->>'id', 'same idempotency key must reuse the attempt';
  v_payment_retry := public.create_payment_attempt((v_order->>'id')::uuid, v_token_hash, gen_random_uuid());
  assert v_payment_retry->>'existing' = 'true' and v_payment_retry->>'id' = v_payment->>'id', 'pending attempts must not be duplicated';
  v_event_key := 'p5-paid-' || gen_random_uuid()::text;
  perform public.save_payment_qr((v_payment->>'id')::uuid, 'local-provider-transaction-1',
    'https://local.invalid/qr.png', '{"transactionStatus":"pending"}'::jsonb);
  v_result := public.process_midtrans_payment_event(v_event_key, repeat('b', 64), v_payment->>'provider_order_id',
    'local-provider-transaction-1', 'settlement', (v_order->>'totalAmount')::bigint);
  assert v_result->>'paymentStatus' = 'PAID', 'verified settlement must mark payment paid';
  assert (select payment_status = 'PAID' and order_status = 'PAID' from public.orders where id = (v_order->>'id')::uuid),
    'settlement must transition order and payment atomically';
  assert (select status = 'PAID' from public.payments where id = (v_payment->>'id')::uuid), 'attempt must be paid';
  assert (select status = 'CONSUMED' from public.voucher_reservations where order_id = (v_order->>'id')::uuid),
    'paid order must consume its voucher reservation';
  v_result := public.process_midtrans_payment_event(v_event_key, repeat('b', 64), v_payment->>'provider_order_id',
    'local-provider-transaction-1', 'settlement', (v_order->>'totalAmount')::bigint);
  assert v_result->>'duplicate' = 'true', 'duplicate webhook event must be idempotent';
  assert not public.cancel_unpaid_order((v_order->>'id')::uuid), 'paid order must not be cancelled';

  v_second_order := public.create_customer_order(v_table_code, v_session_id, gen_random_uuid(), v_items, null,
    'Payment Race Test', null, '', repeat('c', 64));
  v_second_payment := public.create_payment_attempt((v_second_order->>'id')::uuid, repeat('c', 64), gen_random_uuid());
  assert public.cancel_unpaid_order((v_second_order->>'id')::uuid), 'unpaid order cancellation should succeed';
  v_event_key := 'p5-delayed-paid-' || gen_random_uuid()::text;
  perform public.process_midtrans_payment_event(v_event_key, repeat('d', 64), v_second_payment->>'provider_order_id',
    'local-provider-transaction-2', 'settlement', (v_second_order->>'totalAmount')::bigint);
  assert (select payment_status = 'PAID' and order_status = 'PAID' from public.orders where id = (v_second_order->>'id')::uuid),
    'a provider-confirmed delayed payment must win over local cancellation';
end $$;

rollback;
