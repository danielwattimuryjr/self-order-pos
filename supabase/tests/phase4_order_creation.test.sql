begin;

do $$
declare
  v_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_code text := upper('P4-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_category_id uuid := gen_random_uuid();
  v_menu_id uuid := gen_random_uuid();
  v_table_id uuid := gen_random_uuid();
  v_table_code uuid := gen_random_uuid();
  v_session_id uuid := gen_random_uuid();
  v_idempotency_key uuid := gen_random_uuid();
  v_retry_order jsonb;
  v_table_number integer;
  v_order jsonb;
  v_items jsonb;
  v_token_hash text := repeat('a', 64);
begin
  update public.restaurant_settings set opening_time = '00:00', closing_time = '23:59:59.999999',
    temporary_closed = false, temporary_close_reason = null, temporary_close_other = null,
    temporary_closed_at = null where singleton;

  insert into public.categories(id, name) values (v_category_id, 'Phase 4 smoke category');
  insert into public.menus(id, category_id, name, description, price) values
    (v_menu_id, v_category_id, 'Phase 4 smoke item', 'Snapshot description', 15019);
  insert into public.vouchers(code, name, discount_type, discount_value, min_transaction, quota,
    starts_on, ends_on, starts_time, ends_time)
  values (v_code, 'Phase 4 smoke voucher', 'PERCENT', 10, 1000, 1,
    v_date, v_date, '00:00', '23:59:59.999999');
  insert into public.voucher_category_scopes(voucher_id, category_id)
    select id, v_category_id from public.vouchers where code = v_code;
  select coalesce(max(table_number), 0) + 1 into v_table_number from public.dining_tables;
  insert into public.dining_tables(id, table_code, table_number) values (v_table_id, v_table_code, v_table_number);
  insert into public.table_sessions(id, table_id, expires_at) values
    (v_session_id, v_table_id, now() + interval '60 minutes');

  v_items := jsonb_build_array(jsonb_build_object(
    'menuId', v_menu_id, 'quantity', 1, 'note', '',
    'variantSelections', '{}'::jsonb, 'addonSelections', '{}'::jsonb));
  v_order := public.create_customer_order(v_table_code, v_session_id, v_idempotency_key, v_items, v_code,
    'Smoke Customer', null, 'Smoke test', v_token_hash);

  if v_order->>'status' <> 'PENDING_PAYMENT' then raise exception 'Expected PENDING_PAYMENT, received %', v_order->>'status'; end if;
  if (v_order->>'subtotal')::bigint <> 15019 or (v_order->>'discountAmount')::bigint <> 1501
    or (v_order->>'totalAmount')::bigint <> 13518 then raise exception 'Unexpected server-side order totals: %', v_order; end if;
  if v_order->>'orderNumber' !~ '^ORD-[0-9]{6}[0-9]{3,}$' then raise exception 'Invalid operational order number: %', v_order->>'orderNumber'; end if;
  if (select access_token_hash from public.orders where id = (v_order->>'id')::uuid) <> v_token_hash then
    raise exception 'Order access token hash was not stored';
  end if;
  if (select menu_description_snapshot from public.order_items where order_id = (v_order->>'id')::uuid) <> 'Snapshot description' then
    raise exception 'Order item description snapshot was not stored';
  end if;
  if (select status from public.voucher_reservations where order_id = (v_order->>'id')::uuid) <> 'RESERVED' then
    raise exception 'Voucher quota was not reserved';
  end if;

  v_retry_order := public.create_customer_order(v_table_code, v_session_id, v_idempotency_key, v_items, v_code,
    'Smoke Customer', null, 'Smoke test', v_token_hash);
  if v_retry_order->>'id' <> v_order->>'id' or v_retry_order->>'replayed' <> 'true' then
    raise exception 'Order retry was not idempotent';
  end if;

  begin
    perform public.create_customer_order(v_table_code, v_session_id, v_idempotency_key, v_items, v_code,
      'Smoke Customer', null, 'Smoke test', repeat('d', 64));
    raise exception 'Expected idempotency token mismatch to be rejected';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_CONFLICT' then raise; end if;
  end;

  perform public.resolve_voucher_reservation((v_order->>'id')::uuid, 'RELEASED');
  if (select used_count from public.vouchers where code = v_code) <> 0 then
    raise exception 'Released voucher reservation changed used_count';
  end if;

  v_order := public.create_customer_order(v_table_code, v_session_id, gen_random_uuid(), v_items, v_code,
    'Smoke Customer', null, 'Smoke test', repeat('b', 64));
  perform public.resolve_voucher_reservation((v_order->>'id')::uuid, 'CONSUMED');
  perform public.resolve_voucher_reservation((v_order->>'id')::uuid, 'CONSUMED');
  if (select used_count from public.vouchers where code = v_code) <> 1 then
    raise exception 'Voucher consumption was not idempotent';
  end if;

  begin
    perform public.create_customer_order(v_table_code, v_session_id, gen_random_uuid(), v_items, v_code,
      'Smoke Customer', null, '', repeat('c', 64));
    raise exception 'Expected voucher quota to be exhausted';
  exception when others then
    if sqlerrm <> 'VOUCHER_QUOTA_EXHAUSTED' then raise; end if;
  end;
end $$;

rollback;
