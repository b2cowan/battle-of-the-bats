-- Migration 057: early-access conversion tracking and growth role
-- Adds durable conversion/follow-up fields for Platform Admin Phase 5.

alter table public.early_access_leads
  add column if not exists converted_at timestamptz,
  add column if not exists follow_up_due_at date,
  add column if not exists next_action text;

update public.early_access_leads
set
  converted_at = coalesce(converted_at, updated_at, now()),
  internal_status = 'converted'
where converted_org_id is not null
  and converted_at is null;

create index if not exists idx_early_access_leads_converted_at
  on public.early_access_leads(converted_at desc)
  where converted_at is not null;

create index if not exists idx_early_access_leads_follow_up_due_at
  on public.early_access_leads(follow_up_due_at asc)
  where follow_up_due_at is not null;

alter table public.platform_users
  drop constraint if exists platform_users_role_check;

alter table public.platform_users
  add constraint platform_users_role_check
  check (role in ('super_admin', 'support', 'billing', 'product', 'growth', 'read_only'));

comment on column public.platform_users.role is
  'Platform admin permission role: super_admin, support, billing, product, growth, or read_only.';

comment on column public.early_access_leads.converted_at is
  'Timestamp when a platform admin marked the lead as converted.';

comment on column public.early_access_leads.follow_up_due_at is
  'Optional next follow-up due date for growth pipeline management.';

comment on column public.early_access_leads.next_action is
  'Optional short next-action note for the lead.';
