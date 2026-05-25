-- Migration 091: Basic coach team profiles
-- Adds the free Coaches Portal team identity layer used by tournament
-- participants before they upgrade into Premium Coaches Portal tools.

create table if not exists public.basic_coach_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  primary_coach_name text,
  primary_coach_email text not null,
  sport text,
  age_group text,
  source text not null default 'tournament_registration',
  team_workspace_id uuid references public.team_workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basic_coach_teams_source_check
    check (source in ('tournament_registration', 'coach_created', 'premium_upgrade', 'backfill'))
);

create table if not exists public.basic_coach_team_users (
  id uuid primary key default gen_random_uuid(),
  basic_coach_team_id uuid not null references public.basic_coach_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basic_coach_team_users_role_check
    check (role in ('owner', 'coach')),
  constraint basic_coach_team_users_status_check
    check (status in ('active', 'removed'))
);

create table if not exists public.basic_coach_team_registrations (
  id uuid primary key default gen_random_uuid(),
  basic_coach_team_id uuid not null references public.basic_coach_teams(id) on delete cascade,
  tournament_team_id uuid not null references public.teams(id) on delete cascade,
  linked_by_user_id uuid references auth.users(id) on delete set null,
  link_source text not null default 'explicit',
  created_at timestamptz not null default now(),
  constraint basic_coach_team_registrations_source_check
    check (link_source in ('explicit', 'registration_flow', 'backfill', 'email_fallback'))
);

alter table public.team_workspaces
  add column if not exists basic_coach_team_id uuid references public.basic_coach_teams(id) on delete set null;

create index if not exists basic_coach_teams_primary_email_idx
  on public.basic_coach_teams(lower(primary_coach_email));

create index if not exists basic_coach_teams_workspace_idx
  on public.basic_coach_teams(team_workspace_id);

create unique index if not exists basic_coach_team_users_team_user_unique
  on public.basic_coach_team_users(basic_coach_team_id, user_id);

create index if not exists basic_coach_team_users_user_status_idx
  on public.basic_coach_team_users(user_id, status);

create unique index if not exists basic_coach_team_registrations_tournament_team_unique
  on public.basic_coach_team_registrations(tournament_team_id);

create index if not exists basic_coach_team_registrations_basic_team_idx
  on public.basic_coach_team_registrations(basic_coach_team_id);

create index if not exists team_workspaces_basic_coach_team_idx
  on public.team_workspaces(basic_coach_team_id);

comment on table public.basic_coach_teams is
  'Free Coaches Portal team profiles created from tournament participation. These are distinct from paid team_workspaces until upgrade.';

comment on table public.basic_coach_team_users is
  'Explicit auth-user access to Basic Coaches Portal team profiles. Designed for multiple coaches but launched with the registering coach as owner.';

comment on table public.basic_coach_team_registrations is
  'Explicit links from Basic coach team profiles to tournament teams registration records.';

comment on column public.team_workspaces.basic_coach_team_id is
  'Optional Basic Coaches Portal team identity that Premium Coaches Portal workspaces can attach to on upgrade.';

-- Existing tournament coach access was email-derived. Backfill explicit Basic
-- team profiles for confirmed auth users by grouping registrations by user email
-- and normalized tournament team name.
with grouped as (
  select distinct on (u.id, lower(trim(t.name)))
    u.id as user_id,
    lower(u.email) as email,
    trim(t.name) as team_name,
    lower(trim(t.name)) as normalized_name,
    nullif(trim(t.coach), '') as coach_name,
    min(t.registered_at) over (partition by u.id, lower(trim(t.name))) as first_registered_at
  from public.teams t
  join auth.users u on lower(u.email) = lower(t.email)
  where t.email is not null
    and trim(t.email) <> ''
    and t.name is not null
    and trim(t.name) <> ''
    and u.email_confirmed_at is not null
  order by u.id, lower(trim(t.name)), t.registered_at nulls last
),
inserted_profiles as (
  insert into public.basic_coach_teams (
    name,
    normalized_name,
    primary_coach_name,
    primary_coach_email,
    source,
    created_at,
    updated_at
  )
  select
    g.team_name,
    g.normalized_name,
    g.coach_name,
    g.email,
    'backfill',
    coalesce(g.first_registered_at, now()),
    now()
  from grouped g
  where not exists (
    select 1
    from public.basic_coach_teams existing
    where lower(existing.primary_coach_email) = g.email
      and existing.normalized_name = g.normalized_name
  )
  returning id, primary_coach_email, normalized_name
),
all_profiles as (
  select id, lower(primary_coach_email) as email, normalized_name
  from public.basic_coach_teams
)
insert into public.basic_coach_team_users (
  basic_coach_team_id,
  user_id,
  role,
  status
)
select distinct
  p.id,
  g.user_id,
  'owner',
  'active'
from grouped g
join all_profiles p
  on p.email = g.email
 and p.normalized_name = g.normalized_name
on conflict do nothing;

with eligible_registrations as (
  select
    t.id as tournament_team_id,
    lower(t.email) as email,
    lower(trim(t.name)) as normalized_name,
    u.id as user_id
  from public.teams t
  join auth.users u on lower(u.email) = lower(t.email)
  where t.email is not null
    and trim(t.email) <> ''
    and t.name is not null
    and trim(t.name) <> ''
    and u.email_confirmed_at is not null
),
profile_matches as (
  select
    p.id as basic_coach_team_id,
    e.tournament_team_id,
    e.user_id
  from eligible_registrations e
  join public.basic_coach_teams p
    on lower(p.primary_coach_email) = e.email
   and p.normalized_name = e.normalized_name
)
insert into public.basic_coach_team_registrations (
  basic_coach_team_id,
  tournament_team_id,
  linked_by_user_id,
  link_source
)
select
  basic_coach_team_id,
  tournament_team_id,
  user_id,
  'backfill'
from profile_matches
on conflict do nothing;

alter table public.basic_coach_teams enable row level security;
alter table public.basic_coach_team_users enable row level security;
alter table public.basic_coach_team_registrations enable row level security;
