-- Early-access interest capture for coming-soon plans and modules.
-- Accessed via the service-role API route; RLS blocks direct browser writes.

create table if not exists early_access_leads (
  id                              uuid primary key default gen_random_uuid(),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  last_submitted_at               timestamptz not null default now(),
  submission_count                int not null default 1,
  status                          text not null default 'new',
  name                            text not null,
  email                           text not null,
  email_normalized                text not null unique,
  organization_name               text,
  role                            text,
  sports                          text,
  plan_interest                   text[] not null default '{}',
  features_interested             text[] not null default '{}',
  notes                           text,
  source_path                     text,
  user_agent                      text,
  release_notifications_consent   boolean not null default true,
  metadata                        jsonb not null default '{}'::jsonb
);

create index if not exists idx_early_access_leads_created_at
  on early_access_leads(created_at desc);

create index if not exists idx_early_access_leads_status
  on early_access_leads(status, created_at desc);

alter table early_access_leads enable row level security;

-- No client-side policies: public submissions go through /api/early-access.
