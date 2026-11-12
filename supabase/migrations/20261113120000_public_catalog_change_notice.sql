create table public.catalog_change_notices (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.catalog_change_notices(singleton, revision) values (true, 0);
alter table public.catalog_change_notices enable row level security;
create policy "Public can read catalog revision" on public.catalog_change_notices for select to anon, authenticated using (true);
grant select on public.catalog_change_notices to anon, authenticated;
alter table public.catalog_change_notices replica identity full;

create or replace function public.bump_public_catalog_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.catalog_change_notices set revision = revision + 1, updated_at = clock_timestamp() where singleton;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger categories_catalog_revision after insert or update or delete on public.categories
for each row execute function public.bump_public_catalog_revision();
create trigger menus_catalog_revision after insert or update or delete on public.menus
for each row execute function public.bump_public_catalog_revision();
create trigger menu_variant_groups_catalog_revision after insert or update or delete on public.menu_variant_groups
for each row execute function public.bump_public_catalog_revision();
create trigger menu_variant_options_catalog_revision after insert or update or delete on public.menu_variant_options
for each row execute function public.bump_public_catalog_revision();
create trigger menu_addon_groups_catalog_revision after insert or update or delete on public.menu_addon_groups
for each row execute function public.bump_public_catalog_revision();
create trigger menu_addon_options_catalog_revision after insert or update or delete on public.menu_addon_options
for each row execute function public.bump_public_catalog_revision();
create trigger restaurant_status_catalog_revision after insert or update or delete on public.restaurant_public_status
for each row execute function public.bump_public_catalog_revision();

alter publication supabase_realtime add table public.catalog_change_notices;
