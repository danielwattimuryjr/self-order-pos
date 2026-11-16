begin;

do $$
declare
  v_category uuid := gen_random_uuid();
  v_menu uuid := gen_random_uuid();
  v_table uuid := gen_random_uuid();
  v_table_code uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_staff_auth uuid := gen_random_uuid();
  v_staff uuid;
  v_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_table_number integer;
  v_items jsonb;
  v_no_email_order jsonb;
  v_email_order jsonb;
  v_no_email_payment jsonb;
  v_email_payment jsonb;
  v_claim jsonb;
  v_result jsonb;
  v_no_email_hash text := repeat('e', 64);
  v_email_hash text := repeat('f', 64);
  v_event_no_email text := 'p6-no-email-' || gen_random_uuid()::text;
  v_event_email text := 'p6-email-' || gen_random_uuid()::text;
  v_overnight_deadline timestamptz;
begin
  assert not has_table_privilege('anon', 'public.receipts', 'SELECT'), 'receipts must not be directly readable by anonymous users';
  assert not has_table_privilege('anon', 'public.kitchen_tickets', 'SELECT'), 'kitchen tickets must not be directly readable by anonymous users';
  assert not has_table_privilege('authenticated', 'public.receipts', 'SELECT'), 'receipts must not be directly readable by Staff';
  assert has_function_privilege('service_role', 'public.claim_receipt_email(uuid,text,boolean)', 'EXECUTE'), 'service role must claim email sends';
  assert not has_function_privilege('anon', 'public.claim_receipt_email(uuid,text,boolean)', 'EXECUTE'), 'email claim must not be public';

  update public.restaurant_settings set opening_time = '10:00', closing_time = '02:00' where singleton;
  v_overnight_deadline := public.kitchen_ticket_archive_after('2026-11-15 23:00:00+07'::timestamptz);
  assert v_overnight_deadline = '2026-11-16 02:00:00+07'::timestamptz, 'overnight ticket must archive at next local closing time';
  v_overnight_deadline := public.kitchen_ticket_archive_after('2026-11-16 03:00:00+07'::timestamptz);
  assert v_overnight_deadline = '2026-11-17 02:00:00+07'::timestamptz, 'ticket paid after overnight close must remain active until next closing';

  update public.restaurant_settings set opening_time = '00:00', closing_time = '23:59:59.999999',
    temporary_closed = false, temporary_close_reason = null, temporary_close_other = null,
    temporary_closed_at = null where singleton;
  insert into public.categories(id, name) values (v_category, 'Phase 6 test category');
  insert into public.menus(id, category_id, name, description, price) values (v_menu, v_category, 'Phase 6 test item', '', 15000);
  select coalesce(max(table_number), 0) + 1 into v_table_number from public.dining_tables;
  insert into public.dining_tables(id, table_code, table_number) values (v_table, v_table_code, v_table_number);
  insert into public.table_sessions(id, table_id, expires_at) values (v_session, v_table, now() + interval '60 minutes');
  v_items := jsonb_build_array(jsonb_build_object('menuId', v_menu, 'quantity', 1, 'note', 'tanpa cabai',
    'variantSelections', '{}'::jsonb, 'addonSelections', '{}'::jsonb));

  v_no_email_order := public.create_customer_order(v_table_code, v_session, gen_random_uuid(), v_items, null,
    'No Email', null, '', v_no_email_hash);
  v_no_email_payment := public.create_payment_attempt((v_no_email_order->>'id')::uuid, v_no_email_hash, gen_random_uuid());
  perform public.save_payment_qr((v_no_email_payment->>'id')::uuid, 'p6-no-email-transaction',
    'https://local.invalid/qr.png', '{}'::jsonb);
  v_result := public.process_midtrans_payment_event(v_event_no_email, repeat('a', 64), v_no_email_payment->>'provider_order_id',
    'p6-no-email-transaction', 'settlement', (v_no_email_order->>'totalAmount')::bigint);
  assert v_result->>'paymentStatus' = 'PAID', 'verified payment must be marked paid';
  assert (select count(*) = 1 from public.kitchen_tickets where order_id = (v_no_email_order->>'id')::uuid), 'paid order must create one kitchen ticket';
  assert (select email_status = 'NOT_REQUESTED' and email_address is null from public.receipts where order_id = (v_no_email_order->>'id')::uuid), 'missing checkout email must stay not requested';
  v_claim := public.claim_receipt_email((v_no_email_order->>'id')::uuid, v_no_email_hash, false);
  assert v_claim->>'claimed' = 'false' and v_claim->>'reason' = 'NO_EMAIL', 'missing checkout email must not be sent manually';
  perform public.process_midtrans_payment_event(v_event_no_email, repeat('a', 64), v_no_email_payment->>'provider_order_id',
    'p6-no-email-transaction', 'settlement', (v_no_email_order->>'totalAmount')::bigint);
  assert (select count(*) = 1 from public.kitchen_tickets where order_id = (v_no_email_order->>'id')::uuid), 'duplicate webhook must not duplicate kitchen ticket';

  v_email_order := public.create_customer_order(v_table_code, v_session, gen_random_uuid(), v_items, null,
    'Email Checkout', 'customer@example.test', '', v_email_hash);
  v_email_payment := public.create_payment_attempt((v_email_order->>'id')::uuid, v_email_hash, gen_random_uuid());
  perform public.save_payment_qr((v_email_payment->>'id')::uuid, 'p6-email-transaction',
    'https://local.invalid/qr.png', '{}'::jsonb);
  perform public.process_midtrans_payment_event(v_event_email, repeat('b', 64), v_email_payment->>'provider_order_id',
    'p6-email-transaction', 'settlement', (v_email_order->>'totalAmount')::bigint);
  v_claim := public.claim_receipt_email((v_email_order->>'id')::uuid, null, true);
  assert v_claim->>'claimed' = 'true' and v_claim->>'attemptNumber' = '1', 'email checkout must allow one automatic attempt';
  perform public.finish_receipt_email((v_email_order->>'id')::uuid, false, 'TEST_DELIVERY_FAILURE');
  v_claim := public.claim_receipt_email((v_email_order->>'id')::uuid, null, true);
  assert v_claim->>'claimed' = 'false' and v_claim->>'reason' = 'AUTOMATIC_ATTEMPTED', 'duplicate webhook must not retry automatic email';
  v_claim := public.claim_receipt_email((v_email_order->>'id')::uuid, v_email_hash, false);
  assert v_claim->>'claimed' = 'true' and v_claim->>'attemptNumber' = '2', 'customer may manually retry the checkout email';
  perform public.finish_receipt_email((v_email_order->>'id')::uuid, true, null);
  v_claim := public.claim_receipt_email((v_email_order->>'id')::uuid, v_email_hash, false);
  assert v_claim->>'claimed' = 'false' and v_claim->>'reason' = 'ALREADY_SENT', 'successful email must never be sent again';
  assert (select email_status = 'SENT' and email_sent_at is not null from public.receipts where order_id = (v_email_order->>'id')::uuid), 'successful email state must be persisted';

  insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_staff_auth, 'authenticated', 'authenticated', 'phase6-staff@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.staff_profiles(auth_user_id, name, email, role) values (v_staff_auth, 'Phase 6 Staff', 'phase6-staff@example.test', 'STAFF') returning id into v_staff;
  perform public.mark_kitchen_ticket_read((select id from public.kitchen_tickets where order_id = (v_no_email_order->>'id')::uuid), v_staff);
  update public.kitchen_tickets set archive_after = now() - interval '1 second' where order_id = (v_no_email_order->>'id')::uuid;
  assert public.archive_due_kitchen_tickets() = 1, 'due ticket must move to history';
  assert (select archived_at is not null from public.kitchen_tickets where order_id = (v_no_email_order->>'id')::uuid), 'archived ticket must receive archive timestamp';
  assert not exists (select 1 from public.kitchen_ticket_reads where ticket_id = (select id from public.kitchen_tickets where order_id = (v_no_email_order->>'id')::uuid)), 'archive must clear per-account NEW markers';
end $$;

rollback;
