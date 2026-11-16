begin;

do $$
declare
  v_admin_auth uuid := gen_random_uuid();
  v_staff_auth uuid := gen_random_uuid();
  v_admin_profile uuid;
  v_staff_profile uuid;
  v_category uuid := gen_random_uuid();
  v_menu uuid := gen_random_uuid();
  v_table uuid := gen_random_uuid();
  v_table_code uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_table_number integer;
  v_items jsonb;
  v_order jsonb;
  v_paid_order jsonb;
  v_payment jsonb;
  v_summary jsonb;
  v_cancelled jsonb;
  v_event text := 'p7-paid-' || gen_random_uuid()::text;
  v_rejected boolean := false;
begin
  assert not has_function_privilege('anon', 'public.admin_cancel_unpaid_order(uuid,text,text)', 'EXECUTE'), 'anonymous role must not cancel orders';
  assert has_function_privilege('authenticated', 'public.admin_cancel_unpaid_order(uuid,text,text)', 'EXECUTE'), 'authenticated role must call the admin-guarded cancellation RPC';
  assert not has_function_privilege('anon', 'public.admin_analytics_summary(date,date)', 'EXECUTE'), 'anonymous role must not query analytics';

  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (v_admin_auth, 'authenticated', 'authenticated', 'phase7-admin@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.staff_profiles(auth_user_id, name, email, role)
    values (v_admin_auth, 'Phase 7 Admin', 'phase7-admin@example.test', 'ADMIN') returning id into v_admin_profile;
  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (v_staff_auth, 'authenticated', 'authenticated', 'phase7-staff@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  perform set_config('request.jwt.claim.sub', v_admin_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select id into v_staff_profile from public.admin_save_staff_profile(null, v_staff_auth,
    'phase7-staff@example.test', 'Phase 7 Staff', 'STAFF', true);
  assert exists (select 1 from public.audit_logs where action = 'STAFF_INVITED' and entity_id = v_staff_profile::text), 'staff invite must be audited';
  perform public.admin_record_auth_event('LOGIN');
  assert exists (select 1 from public.audit_logs where action = 'LOGIN' and actor_staff_id = v_admin_profile), 'login must be audited';

  update public.restaurant_settings set opening_time = '00:00', closing_time = '23:59:59.999999',
    temporary_closed = false, temporary_close_reason = null, temporary_close_other = null,
    temporary_closed_at = null where singleton;
  insert into public.categories(id, name) values (v_category, 'Phase 7 category');
  insert into public.menus(id, category_id, name, description, price) values (v_menu, v_category, 'Phase 7 item', '', 16000);
  select coalesce(max(table_number), 0) + 1 into v_table_number from public.dining_tables;
  insert into public.dining_tables(id, table_code, table_number) values (v_table, v_table_code, v_table_number);
  insert into public.table_sessions(id, table_id, expires_at) values (v_session, v_table, now() + interval '60 minutes');
  v_items := jsonb_build_array(jsonb_build_object('menuId', v_menu, 'quantity', 1, 'note', '',
    'variantSelections', '{}'::jsonb, 'addonSelections', '{}'::jsonb));

  v_order := public.create_customer_order(v_table_code, v_session, gen_random_uuid(), v_items,
    null, 'Phase 7 unpaid order', null, '', repeat('a', 64));
  v_cancelled := public.admin_cancel_unpaid_order((v_order->>'id')::uuid, 'DUPLICATE_ORDER', null);
  assert v_cancelled->>'orderStatus' = 'CANCELLED', 'Admin can cancel an unpaid order';
  assert (select cancellation_reason = 'Pesanan duplikat' from public.orders where id = (v_order->>'id')::uuid), 'cancellation reason must be retained';
  assert exists (select 1 from public.audit_logs where action = 'ORDER_CANCELLED' and entity_id = v_order->>'id'
    and after_value->>'cancellationReasonCode' = 'DUPLICATE_ORDER'), 'cancellation reason and actor must be audited';

  v_paid_order := public.create_customer_order(v_table_code, v_session, gen_random_uuid(), v_items,
    null, 'Phase 7 paid order', null, '', repeat('b', 64));
  v_payment := public.create_payment_attempt((v_paid_order->>'id')::uuid, repeat('b', 64), gen_random_uuid());
  perform public.save_payment_qr((v_payment->>'id')::uuid, 'phase7-provider-transaction',
    'https://local.invalid/qr.png', '{}'::jsonb);
  perform public.process_midtrans_payment_event(v_event, repeat('c', 64), v_payment->>'provider_order_id',
    'phase7-provider-transaction', 'settlement', (v_paid_order->>'totalAmount')::bigint);
  begin
    perform public.admin_cancel_unpaid_order((v_paid_order->>'id')::uuid, 'OTHER', 'Sudah dibayar');
  exception when sqlstate 'P0001' then
    v_rejected := true;
  end;
  assert v_rejected, 'paid orders cannot be cancelled by Admin';
  v_summary := public.admin_analytics_summary((v_paid_order->>'operationalDate')::date, (v_paid_order->>'operationalDate')::date);
  assert (v_summary->>'paidOrders')::integer = 1, 'analytics counts only paid orders';
  assert (v_summary->>'revenue')::bigint = (v_paid_order->>'totalAmount')::bigint, 'analytics revenue uses the paid total';

  perform public.admin_save_staff_profile(v_staff_profile, null, null, 'Updated Phase 7 Staff', 'STAFF', false);
  assert (select not is_active and name = 'Updated Phase 7 Staff' from public.staff_profiles where id = v_staff_profile), 'Admin can update and deactivate Staff';
  assert exists (select 1 from public.audit_logs where action = 'STAFF_UPDATED' and entity_id = v_staff_profile::text), 'staff changes must be audited';
  perform public.admin_record_auth_event('LOGOUT');
end $$;

rollback;
