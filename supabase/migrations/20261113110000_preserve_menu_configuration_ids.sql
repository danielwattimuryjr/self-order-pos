create or replace function public.admin_save_menu_configuration(p_menu_id uuid, p_variants jsonb, p_addons jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_group jsonb;
  v_option jsonb;
  v_group_id uuid;
  v_option_id uuid;
  v_existing_id uuid;
  v_seen_group_ids uuid[];
  v_seen_option_ids uuid[];
  v_is_variant boolean;
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

  v_seen_group_ids := array[]::uuid[];
  for v_is_variant, v_group in
    select true, value from jsonb_array_elements(p_variants)
    union all
    select false, value from jsonb_array_elements(p_addons)
  loop
    v_group_id := nullif(v_group->>'id', '')::uuid;
    v_existing_id := null;
    if v_group_id is not null then
      if v_is_variant then
        update public.menu_variant_groups set name = trim(v_group->>'name'), required = coalesce((v_group->>'required')::boolean, false),
          sort_order = coalesce((v_group->>'sortOrder')::integer, 0)
          where id = v_group_id and menu_id = p_menu_id returning id into v_existing_id;
      else
        update public.menu_addon_groups set name = trim(v_group->>'name'), required = coalesce((v_group->>'required')::boolean, false),
          min_select = coalesce((v_group->>'minSelect')::integer, 0), max_select = coalesce((v_group->>'maxSelect')::integer, 0),
          sort_order = coalesce((v_group->>'sortOrder')::integer, 0)
          where id = v_group_id and menu_id = p_menu_id returning id into v_existing_id;
      end if;
    end if;
    if v_existing_id is null then
      if v_is_variant then
        insert into public.menu_variant_groups(menu_id, name, required, sort_order)
        values (p_menu_id, trim(v_group->>'name'), coalesce((v_group->>'required')::boolean, false), coalesce((v_group->>'sortOrder')::integer, 0)) returning id into v_group_id;
      else
        insert into public.menu_addon_groups(menu_id, name, required, min_select, max_select, sort_order)
        values (p_menu_id, trim(v_group->>'name'), coalesce((v_group->>'required')::boolean, false), coalesce((v_group->>'minSelect')::integer, 0),
          coalesce((v_group->>'maxSelect')::integer, 0), coalesce((v_group->>'sortOrder')::integer, 0)) returning id into v_group_id;
      end if;
    else
      v_group_id := v_existing_id;
    end if;
    v_seen_group_ids := array_append(v_seen_group_ids, v_group_id);
    v_seen_option_ids := array[]::uuid[];

    for v_option in select value from jsonb_array_elements(coalesce(v_group->'options', '[]'::jsonb)) loop
      v_option_id := nullif(v_option->>'id', '')::uuid;
      v_existing_id := null;
      if v_option_id is not null then
        if v_is_variant then
          update public.menu_variant_options set name = trim(v_option->>'name'), pricing_mode = v_option->>'pricingMode',
            price_value = (v_option->>'priceValue')::bigint, is_active = coalesce((v_option->>'isActive')::boolean, true),
            sort_order = coalesce((v_option->>'sortOrder')::integer, 0)
            where id = v_option_id and group_id = v_group_id returning id into v_existing_id;
        else
          update public.menu_addon_options set name = trim(v_option->>'name'), unit_price = (v_option->>'unitPrice')::bigint,
            is_active = coalesce((v_option->>'isActive')::boolean, true), sort_order = coalesce((v_option->>'sortOrder')::integer, 0)
            where id = v_option_id and group_id = v_group_id returning id into v_existing_id;
        end if;
      end if;
      if v_existing_id is null then
        if v_is_variant then
          insert into public.menu_variant_options(group_id, name, pricing_mode, price_value, is_active, sort_order)
          values (v_group_id, trim(v_option->>'name'), v_option->>'pricingMode', (v_option->>'priceValue')::bigint,
            coalesce((v_option->>'isActive')::boolean, true), coalesce((v_option->>'sortOrder')::integer, 0)) returning id into v_option_id;
        else
          insert into public.menu_addon_options(group_id, name, unit_price, is_active, sort_order)
          values (v_group_id, trim(v_option->>'name'), (v_option->>'unitPrice')::bigint,
            coalesce((v_option->>'isActive')::boolean, true), coalesce((v_option->>'sortOrder')::integer, 0)) returning id into v_option_id;
        end if;
      else
        v_option_id := v_existing_id;
      end if;
      v_seen_option_ids := array_append(v_seen_option_ids, v_option_id);
    end loop;

    if v_is_variant then
      delete from public.menu_variant_options where group_id = v_group_id and not (id = any(v_seen_option_ids));
    else
      delete from public.menu_addon_options where group_id = v_group_id and not (id = any(v_seen_option_ids));
    end if;
  end loop;

  delete from public.menu_variant_groups where menu_id = p_menu_id and not (id = any(v_seen_group_ids));
  delete from public.menu_addon_groups where menu_id = p_menu_id and not (id = any(v_seen_group_ids));
end $$;
revoke all on function public.admin_save_menu_configuration(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_menu_configuration(uuid, jsonb, jsonb) to authenticated;
