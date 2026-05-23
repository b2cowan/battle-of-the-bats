-- Migration 065: Team workspace foundation
-- Adds the standalone Team product data model, team-scoped entitlements,
-- tournament claim records, pricing slots, and Team plan/catalog scaffolding.

-- ---------------------------------------------------------------------------
-- Organization workspace flags
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists account_kind text not null default 'organization',
  add column if not exists team_workspace_status text,
  add column if not exists is_discoverable boolean not null default true;

alter table public.organizations
  drop constraint if exists organizations_account_kind_check;

alter table public.organizations
  add constraint organizations_account_kind_check
  check (account_kind in ('organization', 'team_workspace'));

alter table public.organizations
  drop constraint if exists organizations_team_workspace_status_check;

alter table public.organizations
  add constraint organizations_team_workspace_status_check
  check (
    team_workspace_status is null
    or team_workspace_status in ('active', 'linked', 'org_owned', 'archived')
  );

comment on column public.organizations.account_kind is
  'organization = normal org tenant; team_workspace = lightweight tenant backing a standalone Team workspace.';

comment on column public.organizations.team_workspace_status is
  'Lifecycle state for lightweight Team workspace organizations.';

comment on column public.organizations.is_discoverable is
  'False for hidden/lightweight Team workspace orgs that should not appear as normal public organizations.';

-- ---------------------------------------------------------------------------
-- Team workspace product records
-- ---------------------------------------------------------------------------
create table if not exists public.team_workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_org_id uuid not null references public.organizations(id) on delete cascade,
  rep_team_id uuid not null references public.rep_teams(id) on delete cascade,
  active_program_year_id uuid references public.rep_program_years(id) on delete set null,
  primary_owner_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'direct_signup',
  source_tournament_id uuid references public.tournaments(id) on delete set null,
  source_tournament_team_id uuid,
  workspace_state text not null default 'independent',
  billing_mode text not null default 'team_direct',
  billing_owner_org_id uuid references public.organizations(id) on delete set null,
  billing_owner_user_id uuid references auth.users(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_workspaces_source_check
    check (source in ('direct_signup', 'tournament_claim', 'org_invite', 'platform_admin')),
  constraint team_workspaces_state_check
    check (workspace_state in ('independent', 'linked', 'org_owned', 'archived')),
  constraint team_workspaces_billing_mode_check
    check (billing_mode in ('team_direct', 'org_team_addon', 'club_included', 'club_extra_team', 'platform_override')),
  constraint team_workspaces_subscription_status_check
    check (subscription_status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid'))
);

create unique index if not exists team_workspaces_workspace_org_unique
  on public.team_workspaces(workspace_org_id);

create unique index if not exists team_workspaces_rep_team_unique
  on public.team_workspaces(rep_team_id);

create index if not exists team_workspaces_state_idx
  on public.team_workspaces(workspace_state, subscription_status);

create index if not exists team_workspaces_source_tournament_idx
  on public.team_workspaces(source_tournament_id, source_tournament_team_id);

comment on table public.team_workspaces is
  'Standalone Team product workspace anchored to a lightweight org, one rep team, and one active program year.';

comment on column public.team_workspaces.source_tournament_team_id is
  'Optional tournament registration/team id captured from the tournament-to-team claim funnel. Not FK-constrained because legacy tournament team records predate this model.';

-- ---------------------------------------------------------------------------
-- Team-scoped entitlements
-- ---------------------------------------------------------------------------
create table if not exists public.team_entitlements (
  id uuid primary key default gen_random_uuid(),
  team_workspace_id uuid references public.team_workspaces(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  rep_team_id uuid not null references public.rep_teams(id) on delete cascade,
  source text not null,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  stripe_subscription_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_entitlements_source_check
    check (source in ('team_plan', 'org_team_addon', 'club_included', 'club_extra_team', 'platform_override')),
  constraint team_entitlements_status_check
    check (status in ('active', 'trialing', 'past_due', 'cancelled', 'canceled', 'expired'))
);

create index if not exists team_entitlements_org_team_idx
  on public.team_entitlements(org_id, rep_team_id, status);

create index if not exists team_entitlements_workspace_idx
  on public.team_entitlements(team_workspace_id, status);

create unique index if not exists team_entitlements_active_source_unique
  on public.team_entitlements(org_id, rep_team_id, source)
  where status in ('active', 'trialing', 'past_due');

comment on table public.team_entitlements is
  'Team-scoped access and billing entitlement rows for standalone Team, org Team add-ons, Club included teams, and overrides.';

-- ---------------------------------------------------------------------------
-- Team-to-organization links
-- ---------------------------------------------------------------------------
create table if not exists public.team_org_links (
  id uuid primary key default gen_random_uuid(),
  team_workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  rep_team_id uuid not null references public.rep_teams(id) on delete cascade,
  linked_org_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'requested',
  link_type text not null default 'visibility',
  sharing_level text not null default 'basic',
  requested_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_team_user_id uuid references auth.users(id) on delete set null,
  approved_by_org_user_id uuid references auth.users(id) on delete set null,
  billing_mode_after_approval text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_org_links_status_check
    check (status in ('requested', 'invited', 'linked', 'ownership_pending', 'org_owned', 'declined', 'revoked')),
  constraint team_org_links_type_check
    check (link_type in ('visibility', 'billing', 'ownership')),
  constraint team_org_links_sharing_level_check
    check (sharing_level in ('basic', 'roster_summary', 'financial_summary', 'full_org_owned')),
  constraint team_org_links_billing_mode_after_check
    check (
      billing_mode_after_approval is null
      or billing_mode_after_approval in ('team_direct', 'org_team_addon', 'club_included', 'club_extra_team', 'platform_override')
    )
);

create index if not exists team_org_links_workspace_idx
  on public.team_org_links(team_workspace_id, status);

create index if not exists team_org_links_linked_org_idx
  on public.team_org_links(linked_org_id, status);

create unique index if not exists team_org_links_active_unique
  on public.team_org_links(team_workspace_id, linked_org_id)
  where status in ('requested', 'invited', 'linked', 'ownership_pending', 'org_owned');

comment on table public.team_org_links is
  'Auditable relationship between a Team workspace and a parent organization, including visibility, billing, and ownership transfer states.';

-- ---------------------------------------------------------------------------
-- Tournament-to-Team claim funnel
-- ---------------------------------------------------------------------------
create table if not exists public.team_workspace_claims (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  tournament_team_id uuid,
  contact_email text not null,
  claim_token_hash text not null,
  status text not null default 'available',
  team_workspace_id uuid references public.team_workspaces(id) on delete set null,
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint team_workspace_claims_status_check
    check (status in ('available', 'claimed', 'expired', 'revoked'))
);

create unique index if not exists team_workspace_claims_token_hash_unique
  on public.team_workspace_claims(claim_token_hash);

create index if not exists team_workspace_claims_tournament_idx
  on public.team_workspace_claims(tournament_id, status);

create index if not exists team_workspace_claims_contact_email_idx
  on public.team_workspace_claims(lower(contact_email), status);

comment on table public.team_workspace_claims is
  'Single-use claim records that let tournament team contacts activate a standalone Team workspace.';

-- Keep new foundation tables service-role/API mediated until product routes are
-- built. Service role bypasses RLS; anon/authenticated clients have no direct access.
alter table public.team_workspaces enable row level security;
alter table public.team_entitlements enable row level security;
alter table public.team_org_links enable row level security;
alter table public.team_workspace_claims enable row level security;

-- ---------------------------------------------------------------------------
-- Product catalog, feature matrix, plan gating, and Stripe price slots
-- ---------------------------------------------------------------------------
alter table public.plan_gating
  drop constraint if exists plan_gating_plan_key_check;

alter table public.plan_gating
  add constraint plan_gating_plan_key_check
  check (plan_key in ('tournament', 'team', 'tournament_plus', 'league', 'club'));

insert into public.plan_gating (plan_key, gating_status, updated_by_email)
values ('team', 'live', 'migration_065')
on conflict (plan_key) do nothing;

alter table public.platform_plan_module_entitlements
  drop constraint if exists platform_plan_module_entitlements_plan_check;

alter table public.platform_plan_module_entitlements
  add constraint platform_plan_module_entitlements_plan_check
  check (plan_id in ('tournament', 'team', 'tournament_plus', 'league', 'club'));

insert into public.platform_plan_module_entitlements (
  plan_id,
  module_key,
  included,
  updated_by_email
)
values
  ('team', 'module_tournaments', true, 'migration_065'),
  ('team', 'module_communications', true, 'migration_065'),
  ('team', 'module_members', true, 'migration_065'),
  ('team', 'module_public_site', false, 'migration_065'),
  ('team', 'module_house_league', false, 'migration_065'),
  ('team', 'module_accounting', false, 'migration_065'),
  ('team', 'module_rep_teams', false, 'migration_065')
on conflict (plan_id, module_key) do nothing;

insert into public.stripe_prices (plan_id, billing_cycle, environment, product_name) values
  ('team',           'monthly', 'sandbox', 'FieldLogicHQ - Team'),
  ('team',           'annual',  'sandbox', 'FieldLogicHQ - Team'),
  ('org_team_addon', 'monthly', 'sandbox', 'Team Add-on (Org-billed)'),
  ('org_team_addon', 'annual',  'sandbox', 'Team Add-on (Org-billed)'),
  ('team',           'monthly', 'live',    'FieldLogicHQ - Team'),
  ('team',           'annual',  'live',    'FieldLogicHQ - Team'),
  ('org_team_addon', 'monthly', 'live',    'Team Add-on (Org-billed)'),
  ('org_team_addon', 'annual',  'live',    'Team Add-on (Org-billed)')
on conflict (plan_id, billing_cycle, environment) do nothing;

update public.stripe_prices
set product_name = 'Additional Rep Team (Club - $19)'
where plan_id = 'rep_team'
  and product_name = 'Additional Rep Team (Club)';

comment on column public.stripe_prices.plan_id is
  'tournament_plus | team | league | club | rep_team | org_team_addon';

insert into public.platform_addon_catalog (
  addon_key,
  label,
  description,
  module_key,
  status,
  default_included_plans,
  pricing_model,
  monthly_price,
  annual_price,
  notes
)
values
  (
    'org_team_addon',
    'Team Add-on',
    'Org-billed Team workspace for a specific rep team without upgrading the whole organization to Club.',
    'module_rep_teams',
    'live',
    array[]::text[],
    'per_team',
    29,
    290,
    'Available to Tournament, Tournament Plus, and League orgs as a paid team-scoped entitlement.'
  )
on conflict (addon_key) do update
set
  label = excluded.label,
  description = excluded.description,
  module_key = excluded.module_key,
  status = excluded.status,
  default_included_plans = excluded.default_included_plans,
  pricing_model = excluded.pricing_model,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  notes = excluded.notes,
  updated_at = now();

update public.platform_addon_catalog
set
  label = 'Club Extra Rep Team',
  description = 'Additional active rep team quantity for Club organizations after the included allowance.',
  status = 'live',
  monthly_price = 19,
  annual_price = 190,
  notes = 'Club includes the first 3 active rep teams. Additional active teams bill at the lower Club extra-team rate.'
where addon_key = 'extra_rep_team';

