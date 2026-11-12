revoke insert, update, delete on public.menus, public.menu_variant_groups, public.menu_variant_options,
  public.menu_addon_groups, public.menu_addon_options from public, anon, authenticated;
revoke all on function public.admin_save_menu_configuration(uuid, jsonb, jsonb) from public, anon, authenticated;
