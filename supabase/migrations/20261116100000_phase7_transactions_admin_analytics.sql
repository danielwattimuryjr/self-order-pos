create index orders_transactions_operational_idx
  on public.orders(operational_date desc, created_at desc, id desc);
create index orders_paid_analytics_idx
  on public.orders(operational_date, paid_at)
  where payment_status = 'PAID';
create or replace function public.admin_cancel_unpaid_order(
  p_order_id uuid,
  p_reason_code text,
  p_reason_other text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_order public.orders;
  v_reason text;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_reason_code is null
    or p_reason_code not in ('CUSTOMER_REQUEST', 'DUPLICATE_ORDER', 'ITEM_UNAVAILABLE', 'OPERATIONAL_ISSUE', 'OTHER')
    or (p_reason_code = 'OTHER' and nullif(trim(p_reason_other), '') is null)
    or (p_reason_code <> 'OTHER' and p_reason_other is not null) then
    raise exception 'INVALID_CANCELLATION_REASON' using errcode = '22023';
  end if;

  select id into v_actor from public.staff_profiles
    where auth_user_id = auth.uid() and is_active and role = 'ADMIN';
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_order.payment_status = 'PAID' or v_order.order_status = 'PAID' then
    raise exception 'ORDER_ALREADY_PAID' using errcode = 'P0001';
  end if;
  if v_order.payment_status <> 'PENDING' or v_order.order_status <> 'PENDING_PAYMENT' then
    raise exception 'ORDER_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  v_reason := case p_reason_code
    when 'CUSTOMER_REQUEST' then 'Permintaan pelanggan'
    when 'DUPLICATE_ORDER' then 'Pesanan duplikat'
    when 'ITEM_UNAVAILABLE' then 'Item tidak tersedia'
    when 'OPERATIONAL_ISSUE' then 'Kendala operasional'
    else trim(p_reason_other)
  end;
  v_before := jsonb_build_object(
    'orderStatus', v_order.order_status,
    'paymentStatus', v_order.payment_status,
    'cancellationReason', v_order.cancellation_reason
  );
  update public.orders set order_status = 'CANCELLED', payment_status = 'CANCELLED',
    cancelled_at = now(), cancellation_reason = v_reason
    where id = p_order_id returning * into v_order;
  update public.payments set status = 'CANCELLED', updated_at = now()
    where order_id = p_order_id and status = 'PENDING';
  perform public.resolve_voucher_reservation(p_order_id, 'RELEASED');

  v_after := jsonb_build_object(
    'orderStatus', v_order.order_status,
    'paymentStatus', v_order.payment_status,
    'cancellationReasonCode', p_reason_code,
    'cancellationReason', v_reason
  );
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value, metadata)
    values (v_actor, 'ORDER_CANCELLED', 'order', p_order_id::text, v_before, v_after,
      jsonb_build_object('reasonCode', p_reason_code));
  return jsonb_build_object('orderId', p_order_id, 'orderStatus', 'CANCELLED', 'paymentStatus', 'CANCELLED');
end $$;

revoke all on function public.admin_cancel_unpaid_order(uuid, text, text) from public, anon;
grant execute on function public.admin_cancel_unpaid_order(uuid, text, text) to authenticated;

create or replace function public.admin_save_staff_profile(
  p_profile_id uuid,
  p_auth_user_id uuid,
  p_email text,
  p_name text,
  p_role text,
  p_is_active boolean
) returns public.staff_profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.staff_profiles;
  v_target public.staff_profiles;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) > 120
    or p_role is null or p_role not in ('ADMIN', 'STAFF') or p_is_active is null then
    raise exception 'INVALID_STAFF_PROFILE' using errcode = '22023';
  end if;
  select * into v_actor from public.staff_profiles
    where auth_user_id = auth.uid() and is_active and role = 'ADMIN';

  if p_profile_id is null then
    if p_auth_user_id is null or nullif(trim(p_email), '') is null then
      raise exception 'INVALID_STAFF_PROFILE' using errcode = '22023';
    end if;
    insert into public.staff_profiles(auth_user_id, email, name, role, is_active)
      values (p_auth_user_id, lower(trim(p_email)), trim(p_name), p_role, p_is_active)
      returning * into v_target;
    v_before := null;
    v_after := jsonb_build_object('name', v_target.name, 'email', v_target.email,
      'role', v_target.role, 'isActive', v_target.is_active);
    insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
      values (v_actor.id, 'STAFF_INVITED', 'staff_profile', v_target.id::text, v_before, v_after);
    return v_target;
  end if;

  if p_auth_user_id is not null or p_email is not null then
    raise exception 'INVALID_STAFF_PROFILE' using errcode = '22023';
  end if;
  select * into v_target from public.staff_profiles where id = p_profile_id for update;
  if not found then raise exception 'STAFF_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_target.auth_user_id = auth.uid()
    and (p_role <> v_target.role or not p_is_active) then
    raise exception 'CANNOT_CHANGE_SELF_ACCESS' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('phase7-active-admin-guard', 0));
  if v_target.role = 'ADMIN' and v_target.is_active and (p_role <> 'ADMIN' or not p_is_active)
    and (select count(*) from public.staff_profiles where role = 'ADMIN' and is_active) <= 1 then
    raise exception 'LAST_ACTIVE_ADMIN' using errcode = 'P0001';
  end if;

  v_before := jsonb_build_object('name', v_target.name, 'email', v_target.email,
    'role', v_target.role, 'isActive', v_target.is_active);
  update public.staff_profiles set name = trim(p_name), role = p_role, is_active = p_is_active,
    updated_at = now() where id = p_profile_id returning * into v_target;
  v_after := jsonb_build_object('name', v_target.name, 'email', v_target.email,
    'role', v_target.role, 'isActive', v_target.is_active);
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
    values (v_actor.id, 'STAFF_UPDATED', 'staff_profile', v_target.id::text, v_before, v_after);
  return v_target;
end $$;

revoke all on function public.admin_save_staff_profile(uuid, uuid, text, text, text, boolean) from public, anon;
grant execute on function public.admin_save_staff_profile(uuid, uuid, text, text, text, boolean) to authenticated;

create or replace function public.admin_record_auth_event(p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor public.staff_profiles;
begin
  if p_action is null or p_action not in ('LOGIN', 'LOGOUT') then
    raise exception 'INVALID_AUTH_EVENT' using errcode = '22023';
  end if;
  select * into v_actor from public.staff_profiles
    where auth_user_id = auth.uid() and is_active;
  if not found then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id)
    values (v_actor.id, p_action, 'staff_profile', v_actor.id::text);
end $$;

revoke all on function public.admin_record_auth_event(text) from public, anon;
grant execute on function public.admin_record_auth_event(text) to authenticated;

create or replace function public.admin_analytics_summary(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'revenue', coalesce(sum(o.total_amount), 0),
    'paidOrders', count(*),
    'voucherDiscount', coalesce(sum(o.discount_amount), 0),
    'averageOrderValue', coalesce(round(sum(o.total_amount)::numeric / nullif(count(*), 0)), 0)
  ) into v_result
  from public.orders o where o.payment_status = 'PAID' and o.order_status = 'PAID'
    and o.operational_date between p_from and p_to;
  return v_result;
end $$;

create or replace function public.admin_analytics_sales_chart(p_from date, p_to date, p_granularity text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366
    or p_granularity is null or p_granularity not in ('hour', 'day', 'week')
    or (p_granularity = 'hour' and p_from <> p_to) then
    raise exception 'INVALID_ANALYTICS_RANGE' using errcode = '22023';
  end if;
  if p_granularity = 'hour' then
    select jsonb_agg(jsonb_build_object('bucket', lpad(h.hour::text, 2, '0') || ':00', 'revenue', coalesce(s.revenue, 0)) order by h.hour)
      into v_result
      from generate_series(0, 23) h(hour)
      left join (
        select extract(hour from o.paid_at at time zone 'Asia/Jakarta')::integer as hour,
          sum(o.total_amount)::bigint as revenue
        from public.orders o where o.payment_status = 'PAID' and o.order_status = 'PAID'
          and o.operational_date between p_from and p_to
        group by 1
      ) s on s.hour = h.hour;
  elsif p_granularity = 'day' then
    select jsonb_agg(jsonb_build_object('bucket', d.day::date::text, 'revenue', coalesce(s.revenue, 0)) order by d.day)
      into v_result
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d(day)
      left join (
        select o.operational_date as day, sum(o.total_amount)::bigint as revenue
        from public.orders o where o.payment_status = 'PAID' and o.order_status = 'PAID'
          and o.operational_date between p_from and p_to group by o.operational_date
      ) s on s.day = d.day::date;
  else
    select jsonb_agg(jsonb_build_object('bucket', w.week::date::text, 'revenue', coalesce(s.revenue, 0)) order by w.week)
      into v_result
      from generate_series(date_trunc('week', p_from::timestamp), date_trunc('week', p_to::timestamp), interval '1 week') w(week)
      left join (
        select date_trunc('week', o.operational_date::timestamp) as week,
          sum(o.total_amount)::bigint as revenue
        from public.orders o where o.payment_status = 'PAID' and o.order_status = 'PAID'
          and o.operational_date between p_from and p_to
        group by date_trunc('week', o.operational_date::timestamp)
      ) s on s.week = w.week;
  end if;
  return coalesce(v_result, '[]'::jsonb);
end $$;

create or replace function public.admin_analytics_top_menus(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;
  select jsonb_agg(jsonb_build_object('menuName', t.menu_name_snapshot, 'quantity', t.quantity) order by t.quantity desc, t.menu_name_snapshot)
    into v_result
    from (
      select i.menu_name_snapshot, sum(i.quantity)::bigint as quantity
      from public.order_items i join public.orders o on o.id = i.order_id
      where o.payment_status = 'PAID' and o.order_status = 'PAID'
        and o.operational_date between p_from and p_to
      group by i.menu_name_snapshot order by sum(i.quantity) desc, i.menu_name_snapshot limit 10
    ) t;
  return coalesce(v_result, '[]'::jsonb);
end $$;

create or replace function public.admin_analytics_payment_methods(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;
  select jsonb_agg(jsonb_build_object('method', p.method, 'revenue', p.revenue, 'transactions', p.transactions) order by p.method)
    into v_result
    from (
      select p.method, sum(p.amount)::bigint as revenue, count(*)::bigint as transactions
      from public.payments p join public.orders o on o.id = p.order_id
      where p.status = 'PAID' and o.payment_status = 'PAID' and o.order_status = 'PAID'
        and o.operational_date between p_from and p_to
      group by p.method
    ) p;
  return coalesce(v_result, '[]'::jsonb);
end $$;

revoke all on function public.admin_analytics_summary(date, date),
  public.admin_analytics_sales_chart(date, date, text),
  public.admin_analytics_top_menus(date, date),
  public.admin_analytics_payment_methods(date, date) from public, anon;
grant execute on function public.admin_analytics_summary(date, date),
  public.admin_analytics_sales_chart(date, date, text),
  public.admin_analytics_top_menus(date, date),
  public.admin_analytics_payment_methods(date, date) to authenticated;
