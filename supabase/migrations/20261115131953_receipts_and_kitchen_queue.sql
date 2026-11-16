create table public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  paid_at timestamptz not null,
  operational_date date not null,
  archive_after timestamptz not null,
  archived_at timestamptz,
  ticket_payload_snapshot jsonb not null check (jsonb_typeof(ticket_payload_snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create table public.kitchen_ticket_reads (
  ticket_id uuid not null references public.kitchen_tickets(id) on delete cascade,
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (ticket_id, staff_profile_id)
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  email_address text check (email_address is null or char_length(email_address) <= 254),
  email_status text not null check (email_status in ('NOT_REQUESTED', 'PENDING', 'SENDING', 'SENT', 'FAILED')),
  email_attempt_count integer not null default 0 check (email_attempt_count >= 0),
  email_claimed_at timestamptz,
  automatic_attempted_at timestamptz,
  email_sent_at timestamptz,
  last_email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((email_address is null and email_status = 'NOT_REQUESTED') or
         (email_address is not null and email_status <> 'NOT_REQUESTED')),
  check ((email_status = 'SENT') = (email_sent_at is not null))
);

create index kitchen_tickets_active_fifo_idx on public.kitchen_tickets(paid_at, id) where archived_at is null;
create index kitchen_tickets_history_idx on public.kitchen_tickets(operational_date desc, paid_at desc, id desc) where archived_at is not null;
create index kitchen_ticket_reads_staff_idx on public.kitchen_ticket_reads(staff_profile_id, ticket_id);

alter table public.kitchen_tickets enable row level security;
alter table public.kitchen_ticket_reads enable row level security;
alter table public.receipts enable row level security;

create policy "Active Staff can read kitchen tickets" on public.kitchen_tickets
  for select to authenticated using (exists (
    select 1 from public.staff_profiles p
    where p.auth_user_id = (select auth.uid()) and p.is_active and p.role = 'STAFF'
  ));

revoke all on public.kitchen_tickets, public.kitchen_ticket_reads, public.receipts from public, anon, authenticated;
grant select on public.kitchen_tickets to authenticated;
grant all on public.kitchen_tickets, public.kitchen_ticket_reads, public.receipts to service_role;

create or replace function public.kitchen_ticket_archive_after(p_paid_at timestamptz)
returns timestamptz language plpgsql stable security definer set search_path = '' as $$
declare
  v_opening time;
  v_closing time;
  v_local_date date := (p_paid_at at time zone 'Asia/Jakarta')::date;
  v_deadline timestamptz;
begin
  select opening_time, closing_time into v_opening, v_closing
    from public.restaurant_settings where singleton;
  if v_opening is null or v_closing is null then
    raise exception 'RESTAURANT_NOT_CONFIGURED' using errcode = 'P0001';
  end if;
  select min(((v_local_date + offsets.day_offset +
      case when v_closing < v_opening then 1 else 0 end) + v_closing) at time zone 'Asia/Jakarta')
    into v_deadline
    from generate_series(-1, 2) as offsets(day_offset)
    where ((v_local_date + offsets.day_offset +
      case when v_closing < v_opening then 1 else 0 end) + v_closing) at time zone 'Asia/Jakarta' > p_paid_at;
  if v_deadline is null then raise exception 'ARCHIVE_DEADLINE_UNAVAILABLE' using errcode = 'P0001'; end if;
  return v_deadline;
end $$;

revoke all on function public.kitchen_ticket_archive_after(timestamptz) from public, anon, authenticated;
grant execute on function public.kitchen_ticket_archive_after(timestamptz) to service_role;

create or replace function public.ensure_paid_receipt_artifacts(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_payload jsonb;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.payment_status <> 'PAID' or v_order.paid_at is null then
    raise exception 'ORDER_NOT_PAID' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
      'orderNumber', v_order.order_number,
      'tableNumber', v_order.table_number_snapshot,
      'customerName', v_order.customer_name,
      'paidAt', v_order.paid_at,
      'items', coalesce(jsonb_agg(jsonb_build_object(
        'name', i.menu_name_snapshot, 'quantity', i.quantity, 'note', i.item_note,
        'variants', coalesce((select jsonb_agg(jsonb_build_object('group', choice->>'group', 'option', choice->>'option'))
          from jsonb_array_elements(i.variant_snapshot) choice), '[]'::jsonb),
        'addons', coalesce((select jsonb_agg(jsonb_build_object('group', choice->>'group', 'option', choice->>'option', 'quantity', (choice->>'quantity')::integer))
          from jsonb_array_elements(i.addon_snapshot) choice), '[]'::jsonb)
      ) order by i.created_at, i.id), '[]'::jsonb)
    ) into v_payload
    from public.order_items i where i.order_id = p_order_id;
  insert into public.kitchen_tickets(order_id, paid_at, operational_date, archive_after, ticket_payload_snapshot)
  values (v_order.id, v_order.paid_at, v_order.operational_date,
    public.kitchen_ticket_archive_after(v_order.paid_at), v_payload)
  on conflict (order_id) do nothing;
  insert into public.receipts(order_id, email_address, email_status)
  values (v_order.id, v_order.receipt_email,
    case when v_order.receipt_email is null then 'NOT_REQUESTED' else 'PENDING' end)
  on conflict (order_id) do nothing;
end $$;

revoke all on function public.ensure_paid_receipt_artifacts(uuid) from public, anon, authenticated;
grant execute on function public.ensure_paid_receipt_artifacts(uuid) to service_role;

create or replace function public.archive_due_kitchen_tickets()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  with archived as (
    update public.kitchen_tickets set archived_at = now()
    where archived_at is null and archive_after <= now()
    returning id
  ), cleared as (
    delete from public.kitchen_ticket_reads r using archived a where r.ticket_id = a.id
    returning r.ticket_id
  ) select count(*)::integer into v_count from archived;
  return coalesce(v_count, 0);
end $$;

create or replace function public.mark_kitchen_ticket_read(p_ticket_id uuid, p_staff_profile_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.staff_profiles
      where id = p_staff_profile_id and is_active and role = 'STAFF') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.kitchen_ticket_reads(ticket_id, staff_profile_id)
  select p_ticket_id, p_staff_profile_id from public.kitchen_tickets
    where id = p_ticket_id and archived_at is null
  on conflict (ticket_id, staff_profile_id) do nothing;
  return exists (select 1 from public.kitchen_ticket_reads
    where ticket_id = p_ticket_id and staff_profile_id = p_staff_profile_id);
end $$;

revoke all on function public.archive_due_kitchen_tickets(),
  public.mark_kitchen_ticket_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.archive_due_kitchen_tickets(),
  public.mark_kitchen_ticket_read(uuid, uuid) to service_role;

create or replace function public.claim_receipt_email(p_order_id uuid, p_access_token_hash text default null, p_automatic boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_receipt public.receipts;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.payment_status <> 'PAID' or v_order.access_token_revoked_at is not null
    or (p_access_token_hash is not null and v_order.access_token_hash <> p_access_token_hash) then
    return jsonb_build_object('claimed', false, 'reason', 'NOT_FOUND');
  end if;
  select * into v_receipt from public.receipts where order_id = p_order_id for update;
  if not found or v_receipt.email_address is null then
    return jsonb_build_object('claimed', false, 'reason', 'NO_EMAIL');
  end if;
  if v_receipt.email_status = 'SENT' then
    return jsonb_build_object('claimed', false, 'reason', 'ALREADY_SENT');
  end if;
  if p_automatic and v_receipt.automatic_attempted_at is not null then
    return jsonb_build_object('claimed', false, 'reason', 'AUTOMATIC_ATTEMPTED');
  end if;
  if v_receipt.email_status = 'SENDING' and v_receipt.email_claimed_at > now() - interval '5 minutes' then
    return jsonb_build_object('claimed', false, 'reason', 'IN_PROGRESS');
  end if;
  update public.receipts set email_status = 'SENDING', email_claimed_at = now(),
    automatic_attempted_at = case when p_automatic then coalesce(automatic_attempted_at, now()) else automatic_attempted_at end,
    email_attempt_count = email_attempt_count + case when v_receipt.email_status = 'SENDING' then 0 else 1 end,
    last_email_error = null, updated_at = now()
    where order_id = p_order_id;
  return jsonb_build_object('claimed', true, 'emailAddress', v_receipt.email_address,
    'attemptNumber', v_receipt.email_attempt_count + case when v_receipt.email_status = 'SENDING' then 0 else 1 end);
end $$;

create or replace function public.finish_receipt_email(p_order_id uuid, p_success boolean, p_error_code text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.receipts set
    email_status = case when p_success then 'SENT' else 'FAILED' end,
    email_sent_at = case when p_success then coalesce(email_sent_at, now()) else null end,
    last_email_error = case when p_success then null else left(coalesce(p_error_code, 'DELIVERY_FAILED'), 80) end,
    email_claimed_at = null, updated_at = now()
  where order_id = p_order_id and email_status = 'SENDING';
  return found;
end $$;

revoke all on function public.claim_receipt_email(uuid, text, boolean),
  public.finish_receipt_email(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_receipt_email(uuid, text, boolean),
  public.finish_receipt_email(uuid, boolean, text) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kitchen_tickets') then
    alter publication supabase_realtime add table public.kitchen_tickets;
  end if;
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
  if v_inserted = 0 then return jsonb_build_object('duplicate', true, 'processed', true); end if;

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
    update public.payments set status = 'PAID', provider_transaction_id = p_transaction_id,
      paid_at = coalesce(paid_at, now()), updated_at = now() where id = v_payment.id;
    update public.payments set status = 'CANCELLED', updated_at = now()
      where order_id = v_order.id and id <> v_payment.id and status = 'PENDING';
    if v_order.payment_status <> 'PAID' then
      update public.orders set payment_status = 'PAID', order_status = 'PAID', paid_at = coalesce(paid_at, now())
        where id = v_order.id;
      perform public.resolve_voucher_reservation(v_order.id, 'CONSUMED');
    end if;
    perform public.ensure_paid_receipt_artifacts(v_order.id);
    v_next_payment := 'PAID'; v_next_order := 'PAID';
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

revoke all on function public.process_midtrans_payment_event(text, text, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.process_midtrans_payment_event(text, text, text, text, text, bigint)
  to service_role;
