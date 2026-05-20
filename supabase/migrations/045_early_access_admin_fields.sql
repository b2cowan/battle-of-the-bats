-- Platform-admin workflow fields for early-access lead follow-up.

alter table early_access_leads
  add column if not exists internal_status text not null default 'new',
  add column if not exists internal_notes text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists last_contacted_by text,
  add column if not exists converted_org_id uuid references organizations(id) on delete set null;

create index if not exists idx_early_access_leads_internal_status
  on early_access_leads(internal_status, created_at desc);

create index if not exists idx_early_access_leads_plan_interest
  on early_access_leads using gin(plan_interest);

create index if not exists idx_early_access_leads_features_interested
  on early_access_leads using gin(features_interested);
