-- Migration 055: platform admin roles
-- Formalizes role values used by platform-admin permission gates.

alter table public.platform_users
  alter column role set default 'support';

update public.platform_users
set role = 'super_admin'
where role = 'admin';

alter table public.platform_users
  drop constraint if exists platform_users_role_check;

alter table public.platform_users
  add constraint platform_users_role_check
  check (role in ('super_admin', 'support', 'billing', 'product', 'read_only'));

comment on column public.platform_users.role is
  'Platform admin permission role: super_admin, support, billing, product, or read_only.';
