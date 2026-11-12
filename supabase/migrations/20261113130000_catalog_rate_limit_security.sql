drop policy if exists "Public can view menu images" on storage.objects;
revoke all on function public.bump_public_catalog_revision() from public, anon, authenticated;
revoke all on function public.sync_restaurant_public_status() from public, anon, authenticated;
revoke all on function public.resolve_table_session(uuid), public.get_active_table_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_table_session(uuid), public.get_active_table_session(uuid, uuid) to service_role;

drop policy "Public can read active categories" on public.categories;
create policy "Public can read active categories" on public.categories for select to anon using (is_active);
drop policy "Public can read active menus" on public.menus;
create policy "Public can read active menus" on public.menus for select to anon using (
  is_active and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
);
drop policy "Public can read menu variant groups" on public.menu_variant_groups;
create policy "Public can read menu variant groups" on public.menu_variant_groups for select to anon using (
  exists (select 1 from public.menus m join public.categories c on c.id = m.category_id where m.id = menu_id and m.is_active and c.is_active)
);
drop policy "Public can read active variant options" on public.menu_variant_options;
create policy "Public can read active variant options" on public.menu_variant_options for select to anon using (
  is_active and exists (select 1 from public.menu_variant_groups g join public.menus m on m.id = g.menu_id join public.categories c on c.id = m.category_id where g.id = group_id and m.is_active and c.is_active)
);
drop policy "Public can read menu addon groups" on public.menu_addon_groups;
create policy "Public can read menu addon groups" on public.menu_addon_groups for select to anon using (
  exists (select 1 from public.menus m join public.categories c on c.id = m.category_id where m.id = menu_id and m.is_active and c.is_active)
);
drop policy "Public can read active addon options" on public.menu_addon_options;
create policy "Public can read active addon options" on public.menu_addon_options for select to anon using (
  is_active and exists (select 1 from public.menu_addon_groups g join public.menus m on m.id = g.menu_id join public.categories c on c.id = m.category_id where g.id = group_id and m.is_active and c.is_active)
);

create table public.api_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);
create index api_rate_limits_window_idx on public.api_rate_limits(window_started_at);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(p_key_hash text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
  v_retry_after integer;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'INVALID_RATE_LIMIT_INPUT' using errcode = '22023';
  end if;
  insert into public.api_rate_limits(key_hash, window_started_at, request_count, updated_at)
    values (p_key_hash, v_now, 1, v_now)
  on conflict (key_hash) do update set
    window_started_at = case
      when public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now then v_now
      else public.api_rate_limits.window_started_at end,
    request_count = case
      when public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now then 1
      else public.api_rate_limits.request_count + 1 end,
    updated_at = v_now
  returning public.api_rate_limits.window_started_at, public.api_rate_limits.request_count
    into v_window_started_at, v_request_count;

  delete from public.api_rate_limits where window_started_at < v_now - interval '10 minutes';
  v_retry_after := greatest(1, ceil(extract(epoch from (v_window_started_at + make_interval(secs => p_window_seconds) - v_now)))::integer);
  return query select v_request_count <= p_limit, v_retry_after;
end $$;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
