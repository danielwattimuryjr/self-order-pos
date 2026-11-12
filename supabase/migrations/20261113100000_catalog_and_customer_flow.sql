create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '',
  price bigint not null check (price >= 0),
  image_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_variant_groups (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  required boolean not null default false,
  selection_type text not null default 'SINGLE' check (selection_type = 'SINGLE'),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table public.menu_variant_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_variant_groups(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  pricing_mode text not null check (pricing_mode in ('ADJUSTMENT', 'OVERRIDE')),
  price_value bigint not null check (price_value >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  check (pricing_mode <> 'OVERRIDE' or price_value >= 0)
);

create table public.menu_addon_groups (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  required boolean not null default false,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 0 check (max_select >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  check (min_select <= max_select)
);

create table public.menu_addon_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_addon_groups(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  unit_price bigint not null default 0 check (unit_price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table public.template_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.option_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  category_id uuid references public.template_categories(id) on delete set null,
  configuration jsonb not null,
  schema_version integer not null default 1 check (schema_version = 1),
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menus_category_sort_idx on public.menus(category_id, sort_order, id);
create index categories_sort_idx on public.categories(sort_order, id);
create index menu_variant_groups_menu_sort_idx on public.menu_variant_groups(menu_id, sort_order, id);
create index menu_addon_groups_menu_sort_idx on public.menu_addon_groups(menu_id, sort_order, id);
create index option_templates_category_idx on public.option_templates(category_id, updated_at desc);

alter table public.categories enable row level security;
alter table public.menus enable row level security;
alter table public.menu_variant_groups enable row level security;
alter table public.menu_variant_options enable row level security;
alter table public.menu_addon_groups enable row level security;
alter table public.menu_addon_options enable row level security;
alter table public.template_categories enable row level security;
alter table public.option_templates enable row level security;

create policy "Public can read active categories" on public.categories for select to anon, authenticated using (is_active);
create policy "Admins manage categories" on public.categories for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy "Public can read active menus" on public.menus for select to anon, authenticated using (
  is_active and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
);
create policy "Admins manage menus" on public.menus for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy "Public can read menu variant groups" on public.menu_variant_groups for select to anon, authenticated using (
  exists (select 1 from public.menus m join public.categories c on c.id = m.category_id where m.id = menu_id and m.is_active and c.is_active)
);
create policy "Admins manage menu variant groups" on public.menu_variant_groups for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy "Public can read active variant options" on public.menu_variant_options for select to anon, authenticated using (
  is_active and exists (select 1 from public.menu_variant_groups g join public.menus m on m.id = g.menu_id join public.categories c on c.id = m.category_id where g.id = group_id and m.is_active and c.is_active)
);
create policy "Admins manage variant options" on public.menu_variant_options for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy "Public can read menu addon groups" on public.menu_addon_groups for select to anon, authenticated using (
  exists (select 1 from public.menus m join public.categories c on c.id = m.category_id where m.id = menu_id and m.is_active and c.is_active)
);
create policy "Admins manage menu addon groups" on public.menu_addon_groups for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy "Public can read active addon options" on public.menu_addon_options for select to anon, authenticated using (
  is_active and exists (select 1 from public.menu_addon_groups g join public.menus m on m.id = g.menu_id join public.categories c on c.id = m.category_id where g.id = group_id and m.is_active and c.is_active)
);
create policy "Admins manage addon options" on public.menu_addon_options for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy "Admins manage template categories" on public.template_categories for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy "Admins manage option templates" on public.option_templates for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

grant select on public.categories, public.menus, public.menu_variant_groups, public.menu_variant_options, public.menu_addon_groups, public.menu_addon_options to anon, authenticated;
grant insert, update, delete on public.categories, public.menus, public.menu_variant_groups, public.menu_variant_options, public.menu_addon_groups, public.menu_addon_options, public.template_categories, public.option_templates to authenticated;
grant select, insert, update, delete on public.template_categories, public.option_templates to authenticated;

create or replace function public.admin_record_catalog_audit(p_action text, p_entity_type text, p_entity_id text, p_before jsonb, p_after jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  insert into public.audit_logs(actor_staff_id, action, entity_type, entity_id, before_value, after_value)
  values (v_actor, p_action, p_entity_type, p_entity_id, p_before, p_after);
end $$;
revoke all on function public.admin_record_catalog_audit(text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.admin_record_catalog_audit(text, text, text, jsonb, jsonb) to authenticated;

create table public.restaurant_public_status (
  singleton boolean primary key default true check (singleton),
  opening_time time,
  closing_time time,
  temporary_closed boolean not null,
  temporary_close_reason text,
  temporary_close_other text,
  temporary_closed_at timestamptz,
  updated_at timestamptz not null
);
insert into public.restaurant_public_status(singleton, opening_time, closing_time, temporary_closed,
  temporary_close_reason, temporary_close_other, temporary_closed_at, updated_at)
select singleton, opening_time, closing_time, temporary_closed, temporary_close_reason,
  temporary_close_other, temporary_closed_at, updated_at from public.restaurant_settings;
alter table public.restaurant_public_status enable row level security;
create policy "Public can read restaurant status" on public.restaurant_public_status for select to anon, authenticated using (true);
grant select on public.restaurant_public_status to anon, authenticated;

create or replace function public.sync_restaurant_public_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.restaurant_public_status set opening_time = new.opening_time, closing_time = new.closing_time,
    temporary_closed = new.temporary_closed, temporary_close_reason = new.temporary_close_reason,
    temporary_close_other = new.temporary_close_other, temporary_closed_at = new.temporary_closed_at,
    updated_at = new.updated_at where singleton = new.singleton;
  return new;
end $$;
create trigger restaurant_settings_public_status_sync after insert or update on public.restaurant_settings
for each row execute function public.sync_restaurant_public_status();

create or replace function public.get_public_restaurant_settings()
returns table(opening_time time, closing_time time, temporary_closed boolean, temporary_close_reason text,
  temporary_close_other text, temporary_closed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.opening_time, s.closing_time, s.temporary_closed, s.temporary_close_reason,
    s.temporary_close_other, s.temporary_closed_at
  from public.restaurant_public_status s where s.singleton
$$;
revoke all on function public.get_public_restaurant_settings() from public;
grant execute on function public.get_public_restaurant_settings() to anon, authenticated;

create or replace function public.get_active_table_session(p_table_code uuid, p_session_id uuid)
returns table(session_id uuid, table_id uuid, table_number integer, session_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.dining_tables t join public.table_sessions s on s.table_id = t.id
      where t.table_code = p_table_code and t.is_active and s.id = p_session_id and s.status = 'ACTIVE' and s.expires_at > now())
    then raise exception 'SESSION_EXPIRED_OR_TABLE_UNAVAILABLE' using errcode = 'P0002'; end if;
  return query select s.id, t.id, t.table_number, s.expires_at
    from public.dining_tables t join public.table_sessions s on s.table_id = t.id
    where t.table_code = p_table_code and t.is_active and s.id = p_session_id and s.status = 'ACTIVE' and s.expires_at > now();
end $$;
revoke all on function public.get_active_table_session(uuid, uuid) from public;
grant execute on function public.get_active_table_session(uuid, uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view menu images" on storage.objects for select to anon, authenticated using (bucket_id = 'menu-images');
create policy "Admins can upload menu images" on storage.objects for insert to authenticated with check (bucket_id = 'menu-images' and public.is_active_admin());
create policy "Admins can update menu images" on storage.objects for update to authenticated using (bucket_id = 'menu-images' and public.is_active_admin()) with check (bucket_id = 'menu-images' and public.is_active_admin());
create policy "Admins can delete menu images" on storage.objects for delete to authenticated using (bucket_id = 'menu-images' and public.is_active_admin());

create or replace function public.admin_save_menu_configuration(p_menu_id uuid, p_variants jsonb, p_addons jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_group jsonb; v_option jsonb; v_group_id uuid;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not exists (select 1 from public.menus where id = p_menu_id) then raise exception 'MENU_NOT_FOUND' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_variants) <> 'array' or jsonb_typeof(p_addons) <> 'array' then raise exception 'INVALID_CONFIGURATION' using errcode = '22023'; end if;
  if (select count(*) from jsonb_array_elements(p_variants) group_data
      where exists (select 1 from jsonb_array_elements(coalesce(group_data.value->'options', '[]'::jsonb)) option_data where option_data.value->>'pricingMode' = 'OVERRIDE')) > 1
    then raise exception 'MULTIPLE_OVERRIDE_GROUPS' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(p_variants) g where jsonb_array_length(coalesce(g->'options', '[]'::jsonb)) = 0)
    or exists (select 1 from jsonb_array_elements(p_addons) g where jsonb_array_length(coalesce(g->'options', '[]'::jsonb)) = 0)
    then raise exception 'EMPTY_CONFIGURATION_GROUP' using errcode = '22023'; end if;
  delete from public.menu_variant_groups where menu_id = p_menu_id;
  delete from public.menu_addon_groups where menu_id = p_menu_id;
  for v_group in select value from jsonb_array_elements(p_variants) loop
    insert into public.menu_variant_groups(menu_id, name, required, sort_order)
      values (p_menu_id, trim(v_group->>'name'), coalesce((v_group->>'required')::boolean, false), coalesce((v_group->>'sortOrder')::integer, 0)) returning id into v_group_id;
    for v_option in select value from jsonb_array_elements(coalesce(v_group->'options', '[]'::jsonb)) loop
      insert into public.menu_variant_options(group_id, name, pricing_mode, price_value, is_active, sort_order)
      values (v_group_id, trim(v_option->>'name'), v_option->>'pricingMode', (v_option->>'priceValue')::bigint, coalesce((v_option->>'isActive')::boolean, true), coalesce((v_option->>'sortOrder')::integer, 0));
    end loop;
  end loop;
  for v_group in select value from jsonb_array_elements(p_addons) loop
    insert into public.menu_addon_groups(menu_id, name, required, min_select, max_select, sort_order)
      values (p_menu_id, trim(v_group->>'name'), coalesce((v_group->>'required')::boolean, false), coalesce((v_group->>'minSelect')::integer, 0), coalesce((v_group->>'maxSelect')::integer, 0), coalesce((v_group->>'sortOrder')::integer, 0)) returning id into v_group_id;
    for v_option in select value from jsonb_array_elements(coalesce(v_group->'options', '[]'::jsonb)) loop
      insert into public.menu_addon_options(group_id, name, unit_price, is_active, sort_order)
      values (v_group_id, trim(v_option->>'name'), (v_option->>'unitPrice')::bigint, coalesce((v_option->>'isActive')::boolean, true), coalesce((v_option->>'sortOrder')::integer, 0));
    end loop;
  end loop;
end $$;
revoke all on function public.admin_save_menu_configuration(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_menu_configuration(uuid, jsonb, jsonb) to authenticated;

create or replace function public.admin_save_menu(p_menu_id uuid, p_payload jsonb)
returns public.menus language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_before jsonb; v_menu public.menus; v_configuration jsonb;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  if p_menu_id is null then
    insert into public.menus(category_id, name, description, price, image_path, is_active, sort_order)
    values ((p_payload->>'categoryId')::uuid, trim(p_payload->>'name'), coalesce(p_payload->>'description', ''),
      (p_payload->>'price')::bigint, p_payload->>'imagePath', coalesce((p_payload->>'isActive')::boolean, true),
      coalesce((p_payload->>'sortOrder')::integer, 0)) returning * into v_menu;
  else
    select to_jsonb(m) into v_before from public.menus m where id = p_menu_id for update;
    if v_before is null then raise exception 'MENU_NOT_FOUND' using errcode = 'P0002'; end if;
    update public.menus set category_id = (p_payload->>'categoryId')::uuid, name = trim(p_payload->>'name'),
      description = coalesce(p_payload->>'description', ''), price = (p_payload->>'price')::bigint,
      image_path = p_payload->>'imagePath', is_active = coalesce((p_payload->>'isActive')::boolean, true),
      sort_order = coalesce((p_payload->>'sortOrder')::integer, 0), updated_at = now()
      where id = p_menu_id returning * into v_menu;
  end if;
  v_configuration := coalesce(p_payload->'configuration', '{"variants":[],"addons":[]}'::jsonb);
  perform public.admin_save_menu_configuration(v_menu.id, coalesce(v_configuration->'variants', '[]'::jsonb), coalesce(v_configuration->'addons', '[]'::jsonb));
  perform public.admin_record_catalog_audit(case when p_menu_id is null then 'MENU_CREATED' else 'MENU_UPDATED' end,
    'menu', v_menu.id::text, v_before, to_jsonb(v_menu) || jsonb_build_object('configuration', v_configuration));
  return v_menu;
end $$;
revoke all on function public.admin_save_menu(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_menu(uuid, jsonb) to authenticated;

create or replace function public.admin_delete_menu(p_menu_id uuid)
returns public.menus language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_result public.menus;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_result from public.menus where id = p_menu_id for update;
  if not found then raise exception 'MENU_NOT_FOUND' using errcode = 'P0002'; end if;
  v_before := to_jsonb(v_result);
  delete from public.menus where id = p_menu_id;
  perform public.admin_record_catalog_audit('MENU_DELETED', 'menu', p_menu_id::text, v_before, null);
  return v_result;
end $$;
revoke all on function public.admin_delete_menu(uuid) from public, anon;
grant execute on function public.admin_delete_menu(uuid) to authenticated;

create or replace function public.admin_update_option_template(p_template_id uuid, p_expected_version integer, p_name text, p_category_id uuid, p_configuration jsonb)
returns public.option_templates language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_before jsonb; v_result public.option_templates;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select id into v_actor from public.staff_profiles where auth_user_id = auth.uid() and is_active;
  select to_jsonb(t) into v_before from public.option_templates t where id = p_template_id;
  update public.option_templates set name = trim(p_name), category_id = p_category_id, configuration = p_configuration,
    version = version + 1, updated_by = v_actor, updated_at = now()
    where id = p_template_id and version = p_expected_version returning * into v_result;
  if not found then
    if exists (select 1 from public.option_templates where id = p_template_id) then raise exception 'TEMPLATE_VERSION_CONFLICT' using errcode = '40001'; end if;
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.admin_record_catalog_audit('TEMPLATE_UPDATED', 'option_template', p_template_id::text, v_before, to_jsonb(v_result));
  return v_result;
end $$;
revoke all on function public.admin_update_option_template(uuid, integer, text, uuid, jsonb) from public, anon;
grant execute on function public.admin_update_option_template(uuid, integer, text, uuid, jsonb) to authenticated;

create or replace function public.admin_reorder_categories(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_old jsonb;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(id order by sort_order, id), '[]'::jsonb) into v_old from public.categories;
  if cardinality(p_ids) <> (select count(*) from public.categories)
    or cardinality(p_ids) <> (select count(distinct entry.id) from unnest(p_ids) as entry(id))
    or exists (select 1 from public.categories c where not c.id = any(p_ids))
    then raise exception 'INVALID_CATEGORY_ORDER' using errcode = '22023'; end if;
  update public.categories c set sort_order = (ordered.ordinality - 1)::integer, updated_at = now()
    from unnest(p_ids) with ordinality ordered(id, ordinality) where c.id = ordered.id;
  perform public.admin_record_catalog_audit('CATEGORIES_REORDERED', 'category', null, v_old, to_jsonb(p_ids));
end $$;
revoke all on function public.admin_reorder_categories(uuid[]) from public, anon;
grant execute on function public.admin_reorder_categories(uuid[]) to authenticated;

create or replace function public.admin_reorder_category_menus(p_category_id uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_old jsonb;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(id order by sort_order, id), '[]'::jsonb) into v_old from public.menus where category_id = p_category_id;
  if cardinality(p_ids) <> (select count(*) from public.menus where category_id = p_category_id)
    or cardinality(p_ids) <> (select count(distinct entry.id) from unnest(p_ids) as entry(id))
    or exists (select 1 from public.menus m where m.category_id = p_category_id and not m.id = any(p_ids))
    or exists (select 1 from unnest(p_ids) as item(id) where not exists (select 1 from public.menus m where m.id = item.id and m.category_id = p_category_id))
    then raise exception 'INVALID_MENU_ORDER' using errcode = '22023'; end if;
  update public.menus m set sort_order = (ordered.ordinality - 1)::integer, updated_at = now()
    from unnest(p_ids) with ordinality ordered(id, ordinality) where m.id = ordered.id;
  perform public.admin_record_catalog_audit('CATEGORY_MENUS_REORDERED', 'category', p_category_id::text, v_old, to_jsonb(p_ids));
end $$;
revoke all on function public.admin_reorder_category_menus(uuid, uuid[]) from public, anon;
grant execute on function public.admin_reorder_category_menus(uuid, uuid[]) to authenticated;

alter table public.categories replica identity full;
alter table public.menus replica identity full;
alter table public.menu_variant_groups replica identity full;
alter table public.menu_variant_options replica identity full;
alter table public.menu_addon_groups replica identity full;
alter table public.menu_addon_options replica identity full;
alter table public.restaurant_public_status replica identity full;
alter publication supabase_realtime add table public.categories, public.menus, public.menu_variant_groups,
  public.menu_variant_options, public.menu_addon_groups, public.menu_addon_options, public.restaurant_public_status;
