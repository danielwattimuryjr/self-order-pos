begin;

do $$
declare
  v_category uuid;
  v_menu uuid;
  v_template_category uuid;
  v_rls_count integer;
  v_public_bucket boolean;
  v_blocked boolean := false;
  v_rate_allowed boolean;
begin
  assert to_regclass('public.categories') is not null, 'categories table must exist';
  assert to_regclass('public.menus') is not null, 'menus table must exist';
  assert to_regclass('public.menu_variant_groups') is not null, 'variant groups table must exist';
  assert to_regclass('public.menu_addon_groups') is not null, 'addon groups table must exist';
  assert to_regclass('public.option_templates') is not null, 'templates table must exist';
  assert to_regclass('public.restaurant_public_status') is not null, 'public status projection must exist';
  assert to_regclass('public.catalog_change_notices') is not null, 'public catalog notice must exist';
  assert to_regclass('public.api_rate_limits') is not null, 'rate limit table must exist';

  select count(*) into v_rls_count from pg_class
    where oid in ('public.categories'::regclass, 'public.menus'::regclass, 'public.menu_variant_groups'::regclass,
      'public.menu_variant_options'::regclass, 'public.menu_addon_groups'::regclass, 'public.menu_addon_options'::regclass,
      'public.template_categories'::regclass, 'public.option_templates'::regclass) and relrowsecurity;
  assert v_rls_count = 8, 'RLS must be enabled on all catalog and template tables';
  select public into v_public_bucket from storage.buckets where id = 'menu-images';
  assert v_public_bucket, 'menu images bucket must be public';
  assert not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and cmd in ('SELECT', 'ALL') and 'Public can view menu images' = policyname), 'public image bucket must not allow object listing';
  assert not has_function_privilege('anon', 'public.resolve_table_session(uuid)', 'EXECUTE'), 'anonymous users must not call the session resolver directly';
  assert has_function_privilege('service_role', 'public.resolve_table_session(uuid)', 'EXECUTE'), 'server-side service role must resolve table sessions';
  assert to_regprocedure('public.get_public_restaurant_settings()') is null, 'public restaurant status must be served through the sanitized RLS projection';
  assert not has_table_privilege('authenticated', 'public.menus', 'INSERT'), 'catalog writes must use Admin-checked RPCs';
  assert not has_table_privilege('authenticated', 'public.menu_variant_options', 'UPDATE'), 'configuration writes must use the atomic configuration RPC';
  assert not has_table_privilege('authenticated', 'public.option_templates', 'UPDATE'), 'template updates must use optimistic-lock RPC';

  select allowed into v_rate_allowed from public.consume_api_rate_limit(repeat('a', 64), 2, 60);
  assert v_rate_allowed, 'first request in the rate window must pass';
  select allowed into v_rate_allowed from public.consume_api_rate_limit(repeat('a', 64), 2, 60);
  assert v_rate_allowed, 'request at the configured rate limit must pass';
  select allowed into v_rate_allowed from public.consume_api_rate_limit(repeat('a', 64), 2, 60);
  assert not v_rate_allowed, 'requests above the configured rate limit must be rejected';

  insert into public.categories(name) values ('phase3-test') returning id into v_category;
  insert into public.categories(name, is_active) values ('phase3-inactive', false);
  insert into public.menus(category_id, name, price) values (v_category, 'phase3-menu', 12000) returning id into v_menu;
  insert into public.menus(category_id, name, price, is_active) values (v_category, 'phase3-menu-inactive', 1000, false);
  insert into public.menu_variant_groups(menu_id, name) values (v_menu, 'Ukuran');
  insert into public.menu_addon_groups(menu_id, name, max_select) values (v_menu, 'Tambahan', 1);

  begin
    insert into public.categories(name, sort_order) values ('invalid-sort', -1);
  exception when check_violation then
    v_blocked := true;
  end;
  assert v_blocked, 'negative category sort order must be rejected';

  v_blocked := false;
  begin
    perform public.admin_save_menu_configuration(v_menu, '[]'::jsonb, '[]'::jsonb);
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  assert v_blocked, 'unauthorized callers must not use the menu configuration RPC';

  insert into public.template_categories(name) values ('phase3-template-category') returning id into v_template_category;
  insert into public.option_templates(name, category_id, configuration) values
    ('phase3-template', v_template_category, '{"variants":[{"name":"Level","required":false,"sortOrder":0,"options":[{"name":"Sedang","pricingMode":"ADJUSTMENT","priceValue":0,"isActive":true,"sortOrder":0}]}],"addons":[]}');
  delete from public.template_categories where id = v_template_category;
  assert (select category_id is null from public.option_templates where name = 'phase3-template'), 'deleting template category must leave template uncategorized';

  update public.restaurant_settings set temporary_closed = true, temporary_close_reason = 'EMERGENCY', temporary_closed_at = now() where singleton;
  assert (select temporary_closed and temporary_close_reason = 'EMERGENCY' from public.restaurant_public_status where singleton), 'public status projection must follow restaurant settings';
end
$$;

set local role anon;
do $anon$
begin
  assert exists (select 1 from public.categories where name = 'phase3-test'), 'anonymous catalog must expose active categories';
  assert not exists (select 1 from public.categories where name = 'phase3-inactive'), 'anonymous catalog must hide inactive categories';
  assert exists (select 1 from public.menus where name = 'phase3-menu'), 'anonymous catalog must expose active menus in active categories';
  assert not exists (select 1 from public.menus where name = 'phase3-menu-inactive'), 'anonymous catalog must hide inactive menus';
end
$anon$;
reset role;

do $$
begin
  assert not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and cmd in ('INSERT', 'ALL') and 'anon' = any(roles::text[])), 'anonymous users must not have an upload policy';
  assert (select category_id is null from public.option_templates where name = 'phase3-template'), 'template category deletion must not delete the template';
end
$$;

rollback;
