create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(trim(code)) and char_length(code) between 1 and 40),
  name text not null check (char_length(trim(name)) between 1 and 120),
  discount_type text not null check (discount_type in ('PERCENT', 'FIXED')),
  discount_value bigint not null check (discount_value > 0),
  min_transaction bigint not null default 0 check (min_transaction >= 0),
  max_discount bigint check (max_discount is null or max_discount > 0),
  quota bigint check (quota is null or quota > 0),
  used_count bigint not null default 0 check (used_count >= 0),
  starts_on date not null,
  ends_on date not null,
  starts_time time not null,
  ends_time time not null,
  is_active boolean not null default true,
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on <= ends_on),
  check (starts_time <> ends_time),
  check (discount_type <> 'PERCENT' or discount_value <= 100)
);

create table public.voucher_category_scopes (
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  primary key (voucher_id, category_id)
);

create table public.operational_sequences (
  operational_date date primary key,
  last_sequence bigint not null check (last_sequence > 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key uuid not null,
  table_id uuid not null references public.dining_tables(id) on delete restrict,
  table_number_snapshot integer not null check (table_number_snapshot > 0),
  session_id uuid not null references public.table_sessions(id) on delete restrict,
  customer_name text check (customer_name is null or char_length(customer_name) <= 120),
  receipt_email text check (receipt_email is null or char_length(receipt_email) <= 254),
  order_notes text not null default '' check (char_length(order_notes) <= 1000),
  order_status text not null default 'PENDING_PAYMENT' check (order_status in ('PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED')),
  payment_status text not null default 'PENDING' check (payment_status in ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED')),
  subtotal bigint not null check (subtotal >= 0),
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  total_amount bigint not null check (total_amount >= 0),
  voucher_id uuid references public.vouchers(id) on delete set null,
  voucher_snapshot jsonb,
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  access_token_revoked_at timestamptz,
  operational_date date not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  check (total_amount = subtotal - discount_amount),
  check (expires_at > created_at)
);
create unique index orders_session_idempotency_idx on public.orders(session_id, idempotency_key);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  menu_id uuid references public.menus(id) on delete set null,
  menu_name_snapshot text not null,
  category_name_snapshot text not null,
  menu_description_snapshot text not null default '',
  base_price_snapshot bigint not null check (base_price_snapshot >= 0),
  unit_price_snapshot bigint not null check (unit_price_snapshot >= 0),
  quantity integer not null check (quantity between 1 and 99),
  item_note text not null default '' check (char_length(item_note) <= 500),
  variant_snapshot jsonb not null default '[]'::jsonb,
  addon_snapshot jsonb not null default '[]'::jsonb,
  line_total bigint not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  check (line_total = unit_price_snapshot * quantity)
);

create table public.voucher_reservations (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid references public.vouchers(id) on delete set null,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  reserved_until timestamptz not null,
  status text not null default 'RESERVED' check (status in ('RESERVED', 'CONSUMED', 'RELEASED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid references public.vouchers(id) on delete set null,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  redeemed_at timestamptz not null default now(),
  discount_snapshot jsonb not null
);

create index vouchers_active_code_idx on public.vouchers(code) where is_active;
create index vouchers_validity_idx on public.vouchers(starts_on, ends_on, starts_time, ends_time);
create index voucher_scopes_category_idx on public.voucher_category_scopes(category_id, voucher_id);
create index voucher_reservations_capacity_idx on public.voucher_reservations(voucher_id, reserved_until) where status = 'RESERVED';
create index orders_operational_date_created_idx on public.orders(operational_date, created_at desc);
create index orders_session_idx on public.orders(session_id, created_at desc);
create index order_items_order_idx on public.order_items(order_id);

create or replace function public.lock_menu_configuration_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_menu_id uuid; v_old_menu_id uuid; v_group_id uuid;
begin
  if tg_table_name in ('menu_variant_groups', 'menu_addon_groups') then
    if tg_op <> 'INSERT' then v_old_menu_id := old.menu_id; end if;
    if tg_op <> 'DELETE' then v_menu_id := new.menu_id; end if;
  else
    if tg_op <> 'INSERT' then
      v_group_id := old.group_id;
      select menu_id into v_old_menu_id from public.menu_variant_groups where id = v_group_id;
      if v_old_menu_id is null then select menu_id into v_old_menu_id from public.menu_addon_groups where id = v_group_id; end if;
    end if;
    if tg_op <> 'DELETE' then
      v_group_id := new.group_id;
      select menu_id into v_menu_id from public.menu_variant_groups where id = v_group_id;
      if v_menu_id is null then select menu_id into v_menu_id from public.menu_addon_groups where id = v_group_id; end if;
    end if;
  end if;
  perform m.id from public.menus m where m.id = any(array[v_menu_id, v_old_menu_id]) order by m.id for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger lock_variant_group_menu before insert or update or delete on public.menu_variant_groups
for each row execute function public.lock_menu_configuration_parent();
create trigger lock_variant_option_menu before insert or update or delete on public.menu_variant_options
for each row execute function public.lock_menu_configuration_parent();
create trigger lock_addon_group_menu before insert or update or delete on public.menu_addon_groups
for each row execute function public.lock_menu_configuration_parent();
create trigger lock_addon_option_menu before insert or update or delete on public.menu_addon_options
for each row execute function public.lock_menu_configuration_parent();

alter table public.vouchers enable row level security;
alter table public.voucher_category_scopes enable row level security;
alter table public.operational_sequences enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.voucher_reservations enable row level security;
alter table public.voucher_redemptions enable row level security;

create policy "Admins can read vouchers" on public.vouchers for select to authenticated using (public.is_active_admin());
create policy "Admins can read voucher scopes" on public.voucher_category_scopes for select to authenticated using (public.is_active_admin());
create policy "Admins can read orders" on public.orders for select to authenticated using (public.is_active_admin());
create policy "Admins can read order items" on public.order_items for select to authenticated using (public.is_active_admin());
create policy "Admins can read voucher reservations" on public.voucher_reservations for select to authenticated using (public.is_active_admin());
create policy "Admins can read voucher redemptions" on public.voucher_redemptions for select to authenticated using (public.is_active_admin());
grant select on public.vouchers, public.voucher_category_scopes, public.orders, public.order_items,
  public.voucher_reservations, public.voucher_redemptions to authenticated;
revoke all on public.operational_sequences from anon, authenticated;
revoke insert, update, delete on public.vouchers, public.voucher_category_scopes, public.orders,
  public.order_items, public.voucher_reservations, public.voucher_redemptions from anon, authenticated;

create or replace function public.admin_save_voucher(p_voucher_id uuid, p_payload jsonb)
returns public.vouchers
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_before jsonb;
  v_after public.vouchers;
  v_category_id uuid;
  v_code text := upper(trim(p_payload->>'code'));
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if jsonb_typeof(p_payload->'categoryIds') <> 'array' then raise exception 'INVALID_VOUCHER' using errcode = '22023'; end if;
  if p_payload->>'discountType' not in ('PERCENT', 'FIXED') then raise exception 'INVALID_VOUCHER' using errcode = '22023'; end if;
  if (p_payload->>'discountType' = 'PERCENT' and (p_payload->>'discountValue')::bigint > 100) then
    raise exception 'INVALID_VOUCHER' using errcode = '22023';
  end if;
  if (p_payload->>'startsOn')::date > (p_payload->>'endsOn')::date
    or (p_payload->>'startsTime')::time = (p_payload->>'endsTime')::time then
    raise exception 'INVALID_VOUCHER' using errcode = '22023';
  end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  if p_voucher_id is null then
    insert into public.vouchers(code, name, discount_type, discount_value, min_transaction, max_discount,
      quota, starts_on, ends_on, starts_time, ends_time, is_active, created_by, updated_by)
    values (v_code, trim(p_payload->>'name'), p_payload->>'discountType', (p_payload->>'discountValue')::bigint,
      coalesce((p_payload->>'minTransaction')::bigint, 0), nullif(p_payload->>'maxDiscount', '')::bigint,
      nullif(p_payload->>'quota', '')::bigint, (p_payload->>'startsOn')::date, (p_payload->>'endsOn')::date,
      (p_payload->>'startsTime')::time, (p_payload->>'endsTime')::time,
      coalesce((p_payload->>'isActive')::boolean, true), v_actor, v_actor)
    returning * into v_after;
  else
    select to_jsonb(v) || jsonb_build_object('categoryIds', coalesce((
      select jsonb_agg(s.category_id order by s.category_id) from public.voucher_category_scopes s where s.voucher_id = v.id
    ), '[]'::jsonb)) into v_before from public.vouchers v where id = p_voucher_id for update;
    if v_before is null then raise exception 'VOUCHER_NOT_FOUND' using errcode = 'P0002'; end if;
    update public.vouchers set code = v_code, name = trim(p_payload->>'name'),
      discount_type = p_payload->>'discountType', discount_value = (p_payload->>'discountValue')::bigint,
      min_transaction = coalesce((p_payload->>'minTransaction')::bigint, 0),
      max_discount = nullif(p_payload->>'maxDiscount', '')::bigint,
      quota = nullif(p_payload->>'quota', '')::bigint, starts_on = (p_payload->>'startsOn')::date,
      ends_on = (p_payload->>'endsOn')::date, starts_time = (p_payload->>'startsTime')::time,
      ends_time = (p_payload->>'endsTime')::time, is_active = coalesce((p_payload->>'isActive')::boolean, true),
      updated_by = v_actor, updated_at = now()
    where id = p_voucher_id returning * into v_after;
  end if;

  delete from public.voucher_category_scopes where voucher_id = v_after.id;
  for v_category_id in select value::uuid from jsonb_array_elements_text(p_payload->'categoryIds') loop
    if not exists (select 1 from public.categories where id = v_category_id) then raise exception 'INVALID_CATEGORY_SCOPE' using errcode = '22023'; end if;
    insert into public.voucher_category_scopes(voucher_id, category_id) values (v_after.id, v_category_id);
  end loop;

  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
  values (v_actor, case when p_voucher_id is null then 'VOUCHER_CREATED' else 'VOUCHER_UPDATED' end,
    'voucher', v_after.id::text, v_before, to_jsonb(v_after) || jsonb_build_object('categoryIds', p_payload->'categoryIds'));
  return v_after;
end $$;

create or replace function public.admin_delete_voucher(p_voucher_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_before jsonb; v_used bigint;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  select to_jsonb(v) || jsonb_build_object('categoryIds', coalesce((
      select jsonb_agg(s.category_id order by s.category_id) from public.voucher_category_scopes s where s.voucher_id = v.id
    ), '[]'::jsonb)), v.used_count into v_before, v_used
    from public.vouchers v where id = p_voucher_id for update;
  if v_before is null then raise exception 'VOUCHER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_used > 0 or exists (select 1 from public.voucher_redemptions where voucher_id = p_voucher_id)
     or exists (select 1 from public.voucher_reservations where voucher_id = p_voucher_id and status in ('RESERVED', 'CONSUMED')) then
    update public.vouchers set is_active = false, updated_by = v_actor, updated_at = now() where id = p_voucher_id;
    insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
    values (v_actor, 'VOUCHER_DEACTIVATED', 'voucher', p_voucher_id::text, v_before,
      (select to_jsonb(v) || jsonb_build_object('categoryIds', coalesce((
        select jsonb_agg(s.category_id order by s.category_id) from public.voucher_category_scopes s where s.voucher_id = v.id
      ), '[]'::jsonb)) from public.vouchers v where id = p_voucher_id));
    return 'DEACTIVATED';
  end if;
  delete from public.vouchers where id = p_voucher_id;
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
  values (v_actor, 'VOUCHER_DELETED', 'voucher', p_voucher_id::text, v_before, null);
  return 'DELETED';
end $$;

create or replace function public.order_line_snapshot(
  p_menu_id uuid, p_quantity integer, p_note text, p_variant_selections jsonb, p_addon_selections jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_menu record;
  v_group record;
  v_option record;
  v_key text;
  v_group_selection jsonb;
  v_selected_count integer;
  v_override bigint;
  v_adjustments bigint := 0;
  v_addon_total bigint := 0;
  v_unit_price bigint;
  v_variants jsonb := '[]'::jsonb;
  v_addons jsonb := '[]'::jsonb;
  v_line_total bigint;
begin
  if p_quantity not between 1 and 99 or jsonb_typeof(p_variant_selections) <> 'object' or jsonb_typeof(p_addon_selections) <> 'object' then
    raise exception 'INVALID_CART_LINE' using errcode = '22023';
  end if;
  select m.id, m.name, m.description, m.price, c.name as category_name into v_menu
  from public.menus m join public.categories c on c.id = m.category_id
  where m.id = p_menu_id and m.is_active and c.is_active for share of m, c;
  if not found then raise exception 'MENU_UNAVAILABLE' using errcode = 'P0002'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'INVALID_CART_LINE' using errcode = '22023'; end if;

  for v_key in select jsonb_object_keys(p_variant_selections) loop
    if not exists (select 1 from public.menu_variant_groups g where g.id = v_key::uuid and g.menu_id = p_menu_id) then
      raise exception 'INVALID_VARIANT_SELECTION' using errcode = '22023';
    end if;
  end loop;
  for v_group in select id, name, required from public.menu_variant_groups where menu_id = p_menu_id order by sort_order, id loop
    v_key := p_variant_selections->>v_group.id::text;
    if v_key is null then
      if v_group.required then raise exception 'VARIANT_REQUIRED' using errcode = '22023'; end if;
      continue;
    end if;
    select id, name, pricing_mode, price_value into v_option from public.menu_variant_options
    where id = v_key::uuid and group_id = v_group.id and is_active;
    if not found then raise exception 'VARIANT_UNAVAILABLE' using errcode = '22023'; end if;
    if v_option.pricing_mode = 'OVERRIDE' then
      if v_override is not null then raise exception 'MULTIPLE_OVERRIDE_SELECTIONS' using errcode = '22023'; end if;
      v_override := v_option.price_value;
    else v_adjustments := v_adjustments + v_option.price_value;
    end if;
    v_variants := v_variants || jsonb_build_array(jsonb_build_object(
      'group', v_group.name, 'option', v_option.name, 'pricingMode', v_option.pricing_mode,
      'priceValue', v_option.price_value));
  end loop;

  for v_key in select jsonb_object_keys(p_addon_selections) loop
    if not exists (select 1 from public.menu_addon_groups g where g.id = v_key::uuid and g.menu_id = p_menu_id) then
      raise exception 'INVALID_ADDON_SELECTION' using errcode = '22023';
    end if;
  end loop;
  for v_group in select id, name, required, min_select, max_select from public.menu_addon_groups where menu_id = p_menu_id order by sort_order, id loop
    v_group_selection := coalesce(p_addon_selections->v_group.id::text, '{}'::jsonb);
    if jsonb_typeof(v_group_selection) <> 'object' then raise exception 'INVALID_ADDON_SELECTION' using errcode = '22023'; end if;
    select count(*)::integer into v_selected_count from jsonb_object_keys(v_group_selection);
    if (v_group.required and v_selected_count = 0) or v_selected_count < v_group.min_select or v_selected_count > v_group.max_select then
      raise exception 'ADDON_SELECTION_COUNT_INVALID' using errcode = '22023';
    end if;
    for v_key in select jsonb_object_keys(v_group_selection) loop
      if (v_group_selection->>v_key)::integer not between 1 and 99 then raise exception 'INVALID_ADDON_SELECTION' using errcode = '22023'; end if;
      select id, name, unit_price into v_option from public.menu_addon_options
      where id = v_key::uuid and group_id = v_group.id and is_active;
      if not found then raise exception 'ADDON_UNAVAILABLE' using errcode = '22023'; end if;
      v_addon_total := v_addon_total + v_option.unit_price * (v_group_selection->>v_key)::integer;
      v_addons := v_addons || jsonb_build_array(jsonb_build_object(
        'group', v_group.name, 'option', v_option.name, 'unitPrice', v_option.unit_price,
        'quantity', (v_group_selection->>v_key)::integer));
    end loop;
  end loop;

  v_unit_price := coalesce(v_override, v_menu.price) + v_adjustments + v_addon_total;
  v_line_total := v_unit_price * p_quantity;
  if v_unit_price < 0 or v_line_total < 0 then raise exception 'INVALID_PRICE' using errcode = '22003'; end if;
  return jsonb_build_object('menuId', v_menu.id, 'menuName', v_menu.name, 'menuDescription', v_menu.description, 'categoryName', v_menu.category_name,
    'categoryId', (select category_id from public.menus where id = p_menu_id), 'basePrice', v_menu.price,
    'unitPrice', v_unit_price, 'quantity', p_quantity, 'itemNote', coalesce(p_note, ''),
    'variants', v_variants, 'addons', v_addons, 'lineTotal', v_line_total);
end $$;

create or replace function public.create_customer_order(
  p_table_code uuid, p_session_id uuid, p_idempotency_key uuid, p_items jsonb, p_voucher_code text,
  p_customer_name text, p_receipt_email text, p_order_notes text, p_access_token_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_local timestamp without time zone := now() at time zone 'Asia/Jakarta';
  v_local_date date := (now() at time zone 'Asia/Jakarta')::date;
  v_local_time time := (now() at time zone 'Asia/Jakarta')::time;
  v_opening time;
  v_closing time;
  v_open_date date;
  v_open_instant timestamptz;
  v_temp_closed boolean;
  v_temp_closed_at timestamptz;
  v_is_open boolean;
  v_table record;
  v_item jsonb;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_total bigint;
  v_eligible_subtotal bigint := 0;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_sequence bigint;
  v_voucher public.vouchers;
  v_voucher_id uuid;
  v_voucher_snapshot jsonb;
  v_existing public.orders;
  v_scope_count integer;
  v_reserved_count bigint;
  v_email text := nullif(trim(p_receipt_email), '');
  v_name text := nullif(trim(p_customer_name), '');
  v_order_note text := coalesce(trim(p_order_notes), '');
  v_local_code text := upper(trim(coalesce(p_voucher_code, '')));
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text || p_idempotency_key::text, 0));
  select * into v_existing from public.orders where session_id = p_session_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.access_token_hash <> p_access_token_hash then raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001'; end if;
    return jsonb_build_object('id', v_existing.id, 'orderNumber', v_existing.order_number,
      'tableNumber', v_existing.table_number_snapshot, 'status', v_existing.order_status,
      'paymentStatus', v_existing.payment_status, 'subtotal', v_existing.subtotal,
      'discountAmount', v_existing.discount_amount, 'totalAmount', v_existing.total_amount,
      'voucherSnapshot', v_existing.voucher_snapshot,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('menuId', i.menu_id, 'menuName', i.menu_name_snapshot,
        'categoryName', i.category_name_snapshot, 'basePrice', i.base_price_snapshot,
        'unitPrice', i.unit_price_snapshot, 'quantity', i.quantity, 'itemNote', i.item_note,
        'variants', i.variant_snapshot, 'addons', i.addon_snapshot, 'lineTotal', i.line_total) order by i.created_at, i.id), '[]'::jsonb)
        from public.order_items i where i.order_id = v_existing.id),
      'createdAt', v_existing.created_at, 'expiresAt', v_existing.expires_at,
      'operationalDate', v_existing.operational_date, 'replayed', true);
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100
     or p_access_token_hash !~ '^[0-9a-f]{64}$'
     or char_length(coalesce(p_order_notes, '')) > 1000
     or char_length(coalesce(v_name, '')) > 120
     or char_length(coalesce(v_email, '')) > 254 then
    raise exception 'INVALID_ORDER' using errcode = '22023';
  end if;

  select t.id as table_id, t.table_number, s.id as session_id, s.expires_at
    into v_table from public.dining_tables t join public.table_sessions s on s.table_id = t.id
    where t.table_code = p_table_code and t.is_active and s.id = p_session_id
      and s.status = 'ACTIVE' and s.expires_at > v_now for update of t, s;
  if not found then raise exception 'SESSION_EXPIRED' using errcode = 'P0002'; end if;

  select opening_time, closing_time, temporary_closed, temporary_closed_at
    into v_opening, v_closing, v_temp_closed, v_temp_closed_at
    from public.restaurant_settings where singleton for share;
  if v_opening is null or v_closing is null then raise exception 'RESTAURANT_NOT_CONFIGURED' using errcode = 'P0001'; end if;
  v_open_date := case when v_local_time >= v_opening then v_local_date else v_local_date - 1 end;
  v_open_instant := (v_open_date + v_opening) at time zone 'Asia/Jakarta';
  if v_temp_closed and (v_temp_closed_at is null or v_temp_closed_at >= v_open_instant) then
    raise exception 'RESTAURANT_TEMPORARILY_CLOSED' using errcode = 'P0001';
  end if;
  v_is_open := case when v_closing < v_opening
    then v_local_time >= v_opening or v_local_time < v_closing
    else v_local_time >= v_opening and v_local_time < v_closing end;
  if not v_is_open then raise exception 'OUTSIDE_OPERATING_HOURS' using errcode = 'P0001'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line := public.order_line_snapshot((v_item->>'menuId')::uuid, (v_item->>'quantity')::integer,
      coalesce(v_item->>'note', ''), coalesce(v_item->'variantSelections', '{}'::jsonb),
      coalesce(v_item->'addonSelections', '{}'::jsonb));
    v_lines := v_lines || jsonb_build_array(v_line);
    v_subtotal := v_subtotal + (v_line->>'lineTotal')::bigint;
  end loop;
  if v_subtotal < 0 then raise exception 'INVALID_PRICE' using errcode = '22003'; end if;

  if v_local_code <> '' then
    select * into v_voucher from public.vouchers where code = v_local_code for update;
    if not found or not v_voucher.is_active then raise exception 'VOUCHER_INVALID' using errcode = 'P0001'; end if;
    if v_local_date < v_voucher.starts_on or v_local_date > v_voucher.ends_on then raise exception 'VOUCHER_OUTSIDE_DATES' using errcode = 'P0001'; end if;
    if (v_voucher.starts_time < v_voucher.ends_time
        and not (v_local_time >= v_voucher.starts_time and v_local_time < v_voucher.ends_time))
      or (v_voucher.starts_time > v_voucher.ends_time
        and not (v_local_time >= v_voucher.starts_time or v_local_time < v_voucher.ends_time)) then
      raise exception 'VOUCHER_OUTSIDE_HOURS' using errcode = 'P0001';
    end if;
    select count(*)::integer into v_scope_count from public.voucher_category_scopes where voucher_id = v_voucher.id;
    select coalesce(sum((line->>'lineTotal')::bigint), 0) into v_eligible_subtotal
      from jsonb_array_elements(v_lines) line
      where v_scope_count = 0 or exists (select 1 from public.voucher_category_scopes s
        where s.voucher_id = v_voucher.id and s.category_id = (line->>'categoryId')::uuid);
    if v_eligible_subtotal < v_voucher.min_transaction then raise exception 'VOUCHER_MINIMUM_NOT_MET' using errcode = 'P0001'; end if;
    select count(*) into v_reserved_count from public.voucher_reservations
      where voucher_id = v_voucher.id and status = 'RESERVED';
    if v_voucher.quota is not null and v_voucher.used_count + v_reserved_count >= v_voucher.quota then
      raise exception 'VOUCHER_QUOTA_EXHAUSTED' using errcode = 'P0001';
    end if;
    if v_voucher.discount_type = 'PERCENT' then
      v_discount := floor(v_eligible_subtotal::numeric * v_voucher.discount_value / 100)::bigint;
    else
      v_discount := least(v_eligible_subtotal, v_voucher.discount_value);
    end if;
    if v_voucher.max_discount is not null then v_discount := least(v_discount, v_voucher.max_discount); end if;
    v_discount := least(v_discount, v_eligible_subtotal);
    v_voucher_id := v_voucher.id;
    v_voucher_snapshot := jsonb_build_object('code', v_voucher.code, 'name', v_voucher.name,
      'discountType', v_voucher.discount_type, 'discountValue', v_voucher.discount_value,
      'minimumTransaction', v_voucher.min_transaction, 'maximumDiscount', v_voucher.max_discount,
      'startsOn', v_voucher.starts_on, 'endsOn', v_voucher.ends_on,
      'startsTime', v_voucher.starts_time, 'endsTime', v_voucher.ends_time,
      'categoryIds', coalesce((select jsonb_agg(category_id order by category_id) from public.voucher_category_scopes where voucher_id = v_voucher.id), '[]'::jsonb),
      'eligibleSubtotal', v_eligible_subtotal, 'discountAmount', v_discount);
  end if;
  v_total := v_subtotal - v_discount;

  insert into public.operational_sequences(operational_date, last_sequence) values (v_open_date, 1)
    on conflict (operational_date) do update set last_sequence = public.operational_sequences.last_sequence + 1
    returning last_sequence into v_sequence;
  v_order_number := 'ORD-' || to_char(v_open_date, 'DDMMYY') || lpad(v_sequence::text, 3, '0');

  insert into public.orders(id, order_number, idempotency_key, table_id, table_number_snapshot, session_id, customer_name,
    receipt_email, order_notes, order_status, payment_status, subtotal, discount_amount, total_amount,
    voucher_id, voucher_snapshot, access_token_hash, operational_date, created_at, expires_at)
  values (v_order_id, v_order_number, p_idempotency_key, v_table.table_id, v_table.table_number, v_table.session_id, v_name,
    v_email, v_order_note, 'PENDING_PAYMENT', 'PENDING', v_subtotal, v_discount, v_total,
    v_voucher_id, v_voucher_snapshot, p_access_token_hash, v_open_date, v_now, v_now + interval '15 minutes');

  insert into public.order_items(order_id, menu_id, menu_name_snapshot, category_name_snapshot, menu_description_snapshot, base_price_snapshot,
    unit_price_snapshot, quantity, item_note, variant_snapshot, addon_snapshot, line_total)
  select v_order_id, (line->>'menuId')::uuid, line->>'menuName', line->>'categoryName', line->>'menuDescription', (line->>'basePrice')::bigint,
    (line->>'unitPrice')::bigint, (line->>'quantity')::integer, line->>'itemNote', line->'variants', line->'addons', (line->>'lineTotal')::bigint
  from jsonb_array_elements(v_lines) line;

  if v_voucher_id is not null then
    insert into public.voucher_reservations(voucher_id, order_id, reserved_until, status)
    values (v_voucher_id, v_order_id, v_now + interval '15 minutes', 'RESERVED');
  end if;
  update public.table_sessions set expires_at = greatest(expires_at, v_now + interval '60 minutes') where id = v_table.session_id;

  return jsonb_build_object('id', v_order_id, 'orderNumber', v_order_number, 'tableNumber', v_table.table_number,
    'status', 'PENDING_PAYMENT', 'paymentStatus', 'PENDING', 'subtotal', v_subtotal,
    'discountAmount', v_discount, 'totalAmount', v_total, 'voucherSnapshot', v_voucher_snapshot,
    'items', v_lines, 'createdAt', v_now, 'expiresAt', v_now + interval '15 minutes',
    'operationalDate', v_open_date);
end $$;

create or replace function public.resolve_voucher_reservation(p_order_id uuid, p_result text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_reservation public.voucher_reservations; v_snapshot jsonb;
begin
  if p_result not in ('CONSUMED', 'RELEASED') then raise exception 'INVALID_RESERVATION_RESULT' using errcode = '22023'; end if;
  select * into v_reservation from public.voucher_reservations where order_id = p_order_id for update;
  if not found then return 'NO_RESERVATION'; end if;
  if p_result = 'RELEASED' then
    if v_reservation.status = 'RESERVED' then
      update public.voucher_reservations set status = 'RELEASED', updated_at = now() where id = v_reservation.id;
    end if;
    return 'RELEASED';
  end if;
  if v_reservation.status <> 'CONSUMED' then
    if v_reservation.voucher_id is not null then
      update public.vouchers set used_count = used_count + 1, updated_at = now() where id = v_reservation.voucher_id;
    end if;
    select voucher_snapshot into v_snapshot from public.orders where id = p_order_id;
    insert into public.voucher_redemptions(voucher_id, order_id, discount_snapshot)
      values (v_reservation.voucher_id, p_order_id, coalesce(v_snapshot, '{}'::jsonb))
      on conflict (order_id) do nothing;
    update public.voucher_reservations set status = 'CONSUMED', updated_at = now() where id = v_reservation.id;
  end if;
  return 'CONSUMED';
end $$;

revoke all on function public.admin_save_voucher(uuid, jsonb), public.admin_delete_voucher(uuid),
  public.order_line_snapshot(uuid, integer, text, jsonb, jsonb),
  public.create_customer_order(uuid, uuid, uuid, jsonb, text, text, text, text, text), public.lock_menu_configuration_parent(),
  public.resolve_voucher_reservation(uuid, text) from public, anon;
grant execute on function public.admin_save_voucher(uuid, jsonb), public.admin_delete_voucher(uuid) to authenticated;
grant execute on function public.create_customer_order(uuid, uuid, uuid, jsonb, text, text, text, text, text) to service_role;
grant execute on function public.resolve_voucher_reservation(uuid, text) to service_role;
