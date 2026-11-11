-- ---------------------------------------------------------------
-- Migration 463 — Board Ready · two-step sign-in, Part 1 (the foundation). Plan of record
-- docs/projects/active/BOARD_READY_PLAN.md §5 Stage 0a "Two-step sign-in"; build prompt
-- BOARD_READY_TWO_STEP_BUILD_PROMPTS.md Part 1; drawings BOARD_READY_TWO_STEP_SIGNIN_DRAWINGS.html (every ask ruled by the
-- owner 2026-11-10; the database-level check ruled in 2026-11-11).
--
-- WHY: an authenticator code after the password, offered to everyone, required for FieldLogicHQ staff, and required by a
-- club for its board (and, separately, its coaches) when the club's owner switches it on (Part 3 builds the switches'
-- screen; the rule in lib/two-step-rule.ts reads them from day one). This is the ONE migration the project needs, so
-- Parts 2–4 add none.
--
-- WHAT CHANGES:
--   (1) organizations.two_step_board_required_since / two_step_coaches_required_since — the club's two switches. NULL is
--       off (both off by default); a time is ON, and is when it was turned on (the 14-day grace counts from it).
--   (2) organizations.two_step_prompt_closed_at — the owner closed the one-time Overview prompt (Part 4 shows it).
--   (3) organizations.is_test_organization — the "test organization" exemption, set by platform admin: no requirement ever
--       applies in it. Set here on both public demos, the Milton prospect demo and every UAT / fixture club.
--   (4) two_step_backup_codes — ten per person, ONE-WAY HASHES ONLY (sha-256 of a per-code salt and the code; a code is
--       40 random bits, so a hash is not a lookup table). used_at + used_session_id mark one used, and the session it let
--       through (the sign-in service still calls that session password-only; our server and the database accept it).
--   (5) two_step_code_uses — the codes WE have accepted (hashed with the person's id), so a code is never accepted twice
--       for a "type your code" check or a backup code: the sign-in service accepts the same code twice in its window.
--   (6) two_step_grace — a person's own grace start in one club (a seat accepted after the club switched on, Part 3).
--   (7) two_step_owner_resets — a support reset of a club owner's two-step waiting its 24 hours (Part 3): who asked, how,
--       why, when it was confirmed, when it runs, held / cancelled / done.
--   (8) public.session_passed_two_step() — the DATABASE half of the check (owner ruling 2026-11-11). True when nobody is
--       signed in, when the session typed the code (aal2), when the person has no authenticator, or when a backup code
--       let this very session through. The server half is lib/two-step-session.ts; both say the same thing.
--   (9) a RESTRICTIVE policy "two_step_passed" for `authenticated` on EVERY public table that role can read or write
--       (the mig 311 keep-list: chat, notifications, games, teams, venues, rules, resources, facilities, lanes), found by
--       its grants rather than listed by hand, and on storage.objects. A stolen password alone then reads and writes
--       nothing directly, even where our server is skipped. Anonymous reads are untouched (the policy is `to authenticated`).
--
-- The new tables are SERVICE ROLE ONLY (RLS on, no policies, nothing granted to anon / authenticated; the service role is
-- granted its own access explicitly, since Supabase stopped auto-granting new tables 2026-10-30).
-- Additive and re-runnable (IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS first). check:migrations sees the
-- columns, tables and indexes; the function and the policies are invisible to it (MANUAL_PROD_STEPS.json).
-- ⚠ ORDER ON PRODUCTION: this migration FIRST, then the code (the server reads the new columns and tables).
-- ---------------------------------------------------------------

begin;

-- (1)–(3) the organization's switches, prompt and exemption ------------------------------------------------------------
alter table public.organizations
  add column if not exists two_step_board_required_since timestamptz,
  add column if not exists two_step_coaches_required_since timestamptz,
  add column if not exists two_step_prompt_closed_at timestamptz,
  add column if not exists is_test_organization boolean not null default false;

comment on column public.organizations.two_step_board_required_since is
  'Two-step sign-in: NULL = the board is not required to use it; a time = required since then (owner, admin, treasurer, league admin, registrar). Board Ready, mig 463.';
comment on column public.organizations.two_step_coaches_required_since is
  'Two-step sign-in: NULL = coaches are not required; a time = required since then. Board Ready, mig 463.';
comment on column public.organizations.two_step_prompt_closed_at is
  'When the owner closed the one-time "your club can require two-step sign-in" prompt on Overview. Mig 463.';
comment on column public.organizations.is_test_organization is
  'Test organization exemption (demos, prospect demos, UAT and fixture clubs): no two-step requirement applies here. Set by platform admin. Mig 463.';

update public.organizations set is_test_organization = true
 where is_test_organization = false
   and (
     slug in ('riverdale-minor-ball', 'riverdale-ridge', 'milton-bats',
              'uat-test-org', 'uat-plus-org', 'uat-club-org', 'uat-rep-club', 'qa-families-fixture')
     or coalesce(internal_notes, '') like '%[UAT_PROTECTED]%'
   );

-- (4) backup codes -----------------------------------------------------------------------------------------------------
create table if not exists public.two_step_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  salt text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_session_id uuid
);
create index if not exists two_step_backup_codes_user_idx on public.two_step_backup_codes (user_id) where used_at is null;
create index if not exists two_step_backup_codes_session_idx on public.two_step_backup_codes (user_id, used_session_id)
  where used_session_id is not null;
alter table public.two_step_backup_codes enable row level security;
revoke all on public.two_step_backup_codes from anon, authenticated;
grant select, insert, update, delete on public.two_step_backup_codes to service_role;

-- A new set of ten in ONE step (/review 2026-11-11): the person's unused codes go and the new ones arrive together, under
-- a per-person lock, so a double-pressed set-up can never leave twenty, or none. Used codes stay (each keeps the session
-- it let in working). Rows: [{ "salt": "…", "code_hash": "…" }, …].
create or replace function public.two_step_backup_codes_replace(p_user uuid, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('two_step_backup_codes:' || p_user::text, 0));
  delete from public.two_step_backup_codes where user_id = p_user and used_at is null;
  insert into public.two_step_backup_codes (user_id, salt, code_hash)
  select p_user, r ->> 'salt', r ->> 'code_hash' from jsonb_array_elements(p_rows) r;
end;
$$;
revoke all on function public.two_step_backup_codes_replace(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.two_step_backup_codes_replace(uuid, jsonb) to service_role;

-- (5) codes we have accepted -------------------------------------------------------------------------------------------
create table if not exists public.two_step_code_uses (
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz not null default now(),
  primary key (user_id, code_hash)
);
alter table public.two_step_code_uses enable row level security;
revoke all on public.two_step_code_uses from anon, authenticated;
grant select, insert, update, delete on public.two_step_code_uses to service_role;

-- (6) a person's own grace start in one club ---------------------------------------------------------------------------
create table if not exists public.two_step_grace (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  starts_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);
alter table public.two_step_grace enable row level security;
revoke all on public.two_step_grace from anon, authenticated;
grant select, insert, update, delete on public.two_step_grace to service_role;

-- (7) a support reset of an owner, waiting its day ---------------------------------------------------------------------
create table if not exists public.two_step_owner_resets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asked_by text not null,
  asked_how text not null,
  reason text not null,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  runs_at timestamptz,
  held_at timestamptz,
  held_by text,
  cancelled_at timestamptz,
  completed_at timestamptz
);
create index if not exists two_step_owner_resets_waiting_idx on public.two_step_owner_resets (runs_at)
  where completed_at is null and cancelled_at is null;
alter table public.two_step_owner_resets enable row level security;
revoke all on public.two_step_owner_resets from anon, authenticated;
grant select, insert, update, delete on public.two_step_owner_resets to service_role;

-- (8) the database half of the check -----------------------------------------------------------------------------------
create or replace function public.session_passed_two_step()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is null
    or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or (
      not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
      )
      -- Replacing a lost phone (app_metadata, service-role written): two-step stays ON until the new one is verified.
      and coalesce((auth.jwt() -> 'app_metadata' ->> 'two_step_replacing')::boolean, false) = false
    )
    or exists (
      select 1 from public.two_step_backup_codes b
       where b.user_id = auth.uid()
         and b.used_session_id is not null
         and b.used_session_id::text = (auth.jwt() ->> 'session_id')
    )
$$;
revoke all on function public.session_passed_two_step() from public;
grant execute on function public.session_passed_two_step() to anon, authenticated, service_role;

-- (9) every table a signed-in token can reach, and the file store ------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select distinct c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and (
         has_table_privilege('authenticated', c.oid, 'SELECT')
         or has_table_privilege('authenticated', c.oid, 'INSERT')
         or has_table_privilege('authenticated', c.oid, 'UPDATE')
         or has_table_privilege('authenticated', c.oid, 'DELETE')
         or has_any_column_privilege('authenticated', c.oid, 'SELECT')
         or has_any_column_privilege('authenticated', c.oid, 'INSERT')
         or has_any_column_privilege('authenticated', c.oid, 'UPDATE')
       )
  loop
    if not (select c2.relrowsecurity from pg_class c2 join pg_namespace n2 on n2.oid = c2.relnamespace
             where n2.nspname = 'public' and c2.relname = t) then
      raise exception 'two-step: public.% is reachable by authenticated but has row security OFF; a policy would not apply', t;
    end if;
    execute format('drop policy if exists two_step_passed on public.%I', t);
    execute format(
      'create policy two_step_passed on public.%I as restrictive for all to authenticated '
      'using ((select public.session_passed_two_step())) with check ((select public.session_passed_two_step()))', t);
  end loop;
end $$;

drop policy if exists two_step_passed on storage.objects;
create policy two_step_passed on storage.objects as restrictive for all to authenticated
  using ((select public.session_passed_two_step())) with check ((select public.session_passed_two_step()));

commit;
