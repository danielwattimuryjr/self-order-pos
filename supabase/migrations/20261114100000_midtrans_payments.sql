create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  provider text not null default 'MIDTRANS' check (provider = 'MIDTRANS'),
  provider_order_id text not null unique,
  provider_transaction_id text unique,
  method text not null default 'QRIS' check (method = 'QRIS'),
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED')),
  amount bigint not null check (amount >= 0),
  qr_url text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  provider_response_safe jsonb not null default '{}'::jsonb,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, attempt_number),
  unique (order_id, idempotency_key)
);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'MIDTRANS' check (provider = 'MIDTRANS'),
  event_key text not null unique,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'RECEIVED' check (processing_status in ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED')),
  safe_error text
);

create index payments_order_attempt_idx on public.payments(order_id, attempt_number desc);
create index payments_status_expiry_idx on public.payments(status, expires_at) where status = 'PENDING';
create index payment_webhook_events_received_idx on public.payment_webhook_events(received_at desc);

alter table public.payments enable row level security;
alter table public.payment_webhook_events enable row level security;
create policy "Admins can read payments" on public.payments for select to authenticated using (public.is_active_admin());
grant select on public.payments to authenticated;
revoke insert, update, delete on public.payments, public.payment_webhook_events from anon, authenticated;
revoke all on public.payment_webhook_events from public, anon, authenticated;

create or replace function public.create_payment_attempt(
  p_order_id uuid, p_access_token_hash text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_payment public.payments;
  v_pending public.payments;
  v_attempt integer;
  v_provider_order_id text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.access_token_revoked_at is not null or v_order.access_token_hash <> p_access_token_hash then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_payment from public.payments where order_id = p_order_id and idempotency_key = p_idempotency_key;
  if found then return to_jsonb(v_payment) || jsonb_build_object('existing', true, 'orderStatus', v_order.order_status, 'orderExpiresAt', v_order.expires_at); end if;
  if v_order.order_status <> 'PENDING_PAYMENT' or v_order.payment_status <> 'PENDING' then
    raise exception 'ORDER_NOT_PAYABLE' using errcode = 'P0001';
  end if;
  if v_order.expires_at <= now() then raise exception 'ORDER_EXPIRED' using errcode = 'P0001'; end if;
  select * into v_pending from public.payments where order_id = p_order_id and status = 'PENDING'
    order by attempt_number desc limit 1 for update;
  if found then
    return to_jsonb(v_pending) || jsonb_build_object('existing', true, 'orderStatus', v_order.order_status, 'orderExpiresAt', v_order.expires_at,
      'customerName', v_order.customer_name, 'customerEmail', v_order.receipt_email);
  end if;
  select coalesce(max(attempt_number), 0) + 1 into v_attempt from public.payments where order_id = p_order_id;
  v_provider_order_id := v_order.order_number || '-A' || v_attempt::text;
  insert into public.payments(order_id, attempt_number, provider_order_id, amount, expires_at, idempotency_key)
  values (p_order_id, v_attempt, v_provider_order_id, v_order.total_amount, v_order.expires_at, p_idempotency_key)
  returning * into v_payment;
  return to_jsonb(v_payment) || jsonb_build_object('existing', false, 'orderStatus', v_order.order_status, 'orderExpiresAt', v_order.expires_at,
    'customerName', v_order.customer_name, 'customerEmail', v_order.receipt_email);
end $$;

create or replace function public.save_payment_qr(
  p_payment_id uuid, p_transaction_id text, p_qr_url text, p_provider_response_safe jsonb
) returns public.payments language plpgsql security definer set search_path = '' as $$
declare v_payment public.payments;
begin
  update public.payments set provider_transaction_id = p_transaction_id, qr_url = p_qr_url,
    provider_response_safe = p_provider_response_safe, updated_at = now()
  where id = p_payment_id and status = 'PENDING' returning * into v_payment;
  if v_payment.id is null then raise exception 'PAYMENT_ATTEMPT_NOT_PENDING' using errcode = 'P0001'; end if;
  return v_payment;
end $$;

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

  select * into v_payment from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then
    update public.payment_webhook_events set processing_status = 'IGNORED', processed_at = now(), safe_error = 'PAYMENT_NOT_FOUND'
      where event_key = p_event_key;
    return jsonb_build_object('duplicate', false, 'processed', true, 'ignored', true);
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
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

create or replace function public.expire_unpaid_order(p_order_id uuid, p_payment_id uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.order_status <> 'PENDING_PAYMENT' or v_order.payment_status <> 'PENDING' or v_order.expires_at > now() then
    return false;
  end if;
  update public.orders set order_status = 'EXPIRED', payment_status = 'EXPIRED' where id = p_order_id;
  update public.payments set status = 'EXPIRED', updated_at = now()
    where order_id = p_order_id and status = 'PENDING' and (p_payment_id is null or id = p_payment_id);
  perform public.resolve_voucher_reservation(p_order_id, 'RELEASED');
  return true;
end $$;

create or replace function public.cancel_unpaid_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if v_order.payment_status = 'PAID' then return false; end if;
  if v_order.order_status <> 'PENDING_PAYMENT' then return false; end if;
  update public.orders set order_status = 'CANCELLED', payment_status = 'CANCELLED', cancelled_at = now() where id = p_order_id;
  update public.payments set status = 'CANCELLED', updated_at = now() where order_id = p_order_id and status = 'PENDING';
  perform public.resolve_voucher_reservation(p_order_id, 'RELEASED');
  return true;
end $$;

revoke all on function public.create_payment_attempt(uuid, text, uuid),
  public.save_payment_qr(uuid, text, text, jsonb),
  public.process_midtrans_payment_event(text, text, text, text, text, bigint),
  public.expire_unpaid_order(uuid, uuid), public.cancel_unpaid_order(uuid) from public, anon, authenticated;
grant execute on function public.create_payment_attempt(uuid, text, uuid),
  public.save_payment_qr(uuid, text, text, jsonb),
  public.process_midtrans_payment_event(text, text, text, text, text, bigint),
  public.expire_unpaid_order(uuid, uuid), public.cancel_unpaid_order(uuid) to service_role;
