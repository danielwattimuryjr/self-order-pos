create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  email text not null,
  role text not null check (role in ('ADMIN', 'STAFF')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index staff_profiles_email_lower_unique
  on public.staff_profiles (lower(email));

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles p
    where p.auth_user_id = (select auth.uid())
      and p.role = 'ADMIN'
      and p.is_active
  );
$$;

revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

alter table public.staff_profiles enable row level security;

create policy "Staff can read own active profile"
  on public.staff_profiles
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()) and is_active);

create policy "Admins can read staff profiles"
  on public.staff_profiles
  for select
  to authenticated
  using (public.is_active_admin());

grant select on public.staff_profiles to authenticated;

comment on table public.staff_profiles is
  'Application roles and active state for Supabase Auth users. Account provisioning is server-side only.';
