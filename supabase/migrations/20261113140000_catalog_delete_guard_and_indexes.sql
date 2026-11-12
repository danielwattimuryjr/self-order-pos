create index menu_variant_options_group_sort_idx on public.menu_variant_options(group_id, sort_order, id);
create index menu_addon_options_group_sort_idx on public.menu_addon_options(group_id, sort_order, id);

create or replace function public.admin_delete_menu(p_menu_id uuid)
returns public.menus language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_result public.menus;
  v_has_history boolean := false;
begin
  if not public.is_active_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_result from public.menus where id = p_menu_id for update;
  if not found then raise exception 'MENU_NOT_FOUND' using errcode = 'P0002'; end if;
  if to_regclass('public.order_items') is not null then
    execute 'select exists (select 1 from public.order_items where menu_id = $1)' into v_has_history using p_menu_id;
    if v_has_history then raise exception 'MENU_HAS_HISTORY' using errcode = '23503'; end if;
  end if;
  v_before := to_jsonb(v_result);
  delete from public.menus where id = p_menu_id;
  perform public.admin_record_catalog_audit('MENU_DELETED', 'menu', p_menu_id::text, v_before, null);
  return v_result;
end $$;
revoke all on function public.admin_delete_menu(uuid) from public, anon;
grant execute on function public.admin_delete_menu(uuid) to authenticated;
