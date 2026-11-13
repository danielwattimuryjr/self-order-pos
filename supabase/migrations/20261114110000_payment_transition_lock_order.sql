-- Lock rows in order-then-payment sequence so webhook processing and customer
-- cancellation/expiry cannot deadlock each other while resolving a race.
create or replace function public.process_midtrans_payment_event(
  p_event_key text, p_payload_hash text, p_provider_order_id text, p_transaction_id text,
  p_provider_status text, p_amount bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_next_payment text;
  v_next_order text;
  v_inserted integer;
begin
  insert into public.payment_webhook_events(event_key, payload_hash)
  values (p_event_key, p_payload_hash) on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('duplicate', true, 'processed', true);
  end if;

  select * into v_payment from public.payments where provider_order_id = p_provider_order_id;
  if not found then
    update public.payment_webhook_events set processing_status = 'IGNORED', processed_at = now(), safe_error = 'PAYMENT_NOT_FOUND'
      where event_key = p_event_key;
    return jsonb_build_object('duplicate', false, 'processed', true, 'ignored', true);
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  select * into v_payment from public.payments where id = v_payment.id for update;
  if p_amount <> v_payment.amount then
    update public.payment_webhook_events set processing_status = 'FAILED', processed_at = now(), safe_error = 'AMOUNT_MISMATCH'
      where event_key = p_event_key;
    return jsonb_build_object('duplicate', false, 'processed', true, 'rejected', true, 'reason', 'AMOUNT_MISMATCH');
  end if;

  if p_provider_status = 'settlement' then
    if v_order.payment_status <> 'PAID' then
      v_next_payment := 'PAID'; v_next_order := 'PAID';
      update public.payments set status = 'PAID', provider_transaction_id = p_transaction_id,
        paid_at = coalesce(paid_at, now()), updated_at = now() where id = v_payment.id;
      update public.payments set status = 'CANCELLED', updated_at = now()
        where order_id = v_order.id and id <> v_payment.id and status = 'PENDING';
      update public.orders set payment_status = 'PAID', order_status = 'PAID', paid_at = coalesce(paid_at, now()) where id = v_order.id;
      perform public.resolve_voucher_reservation(v_order.id, 'CONSUMED');
    else
      v_next_payment := 'PAID'; v_next_order := 'PAID';
      update public.payments set status = 'PAID', provider_transaction_id = p_transaction_id,
        paid_at = coalesce(paid_at, now()), updated_at = now() where id = v_payment.id;
      update public.payments set status = 'CANCELLED', updated_at = now()
        where order_id = v_order.id and id <> v_payment.id and status = 'PENDING';
    end if;
  elsif p_provider_status in ('deny', 'failure') then
    v_next_payment := 'FAILED'; v_next_order := v_order.order_status;
    update public.payments set status = 'FAILED', provider_transaction_id = p_transaction_id, updated_at = now()
      where id = v_payment.id and status = 'PENDING';
  elsif p_provider_status = 'expire' then
    v_next_payment := 'EXPIRED'; v_next_order := 'EXPIRED';
    update public.payments set status = 'EXPIRED', provider_transaction_id = p_transaction_id, updated_at = now()
      where id = v_payment.id and status = 'PENDING';
    if v_order.payment_status = 'PENDING' then
      update public.orders set payment_status = 'EXPIRED', order_status = 'EXPIRED' where id = v_order.id;
      perform public.resolve_voucher_reservation(v_order.id, 'RELEASED');
    end if;
  elsif p_provider_status = 'cancel' then
    v_next_payment := 'CANCELLED'; v_next_order := 'CANCELLED';
    update public.payments set status = 'CANCELLED', provider_transaction_id = p_transaction_id, updated_at = now()
      where id = v_payment.id and status = 'PENDING';
    if v_order.payment_status = 'PENDING' then
      update public.orders set payment_status = 'CANCELLED', order_status = 'CANCELLED', cancelled_at = now() where id = v_order.id;
      perform public.resolve_voucher_reservation(v_order.id, 'RELEASED');
    end if;
  else
    v_next_payment := 'PENDING'; v_next_order := v_order.order_status;
  end if;
  update public.payment_webhook_events set processing_status = 'PROCESSED', processed_at = now() where event_key = p_event_key;
  return jsonb_build_object('duplicate', false, 'processed', true, 'paymentStatus', v_next_payment, 'orderStatus', v_next_order);
end $$;
