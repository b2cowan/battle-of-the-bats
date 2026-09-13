-- 296 — A general note about a player, so everything written about them reads in ONE place
-- (COACH_ROSTER_AND_PLAYER_PAGE_REVIEW_PLAN.md §9 F20 — owner rulings 2026-09-13, hub R2-3 +
-- Q7–Q10; built 2026-09-13.)
--
-- THE RULING: a coach could write about a player in four places on three tabs — a one-line game
-- moment from the bench, a skill observation and a goal review (mig 295), and the undated
-- `rep_roster_players.notes` box — and nowhere read them together. The player page gains a NOTES
-- tab: one timeline of every dated entry, each marked with its source and linking back, written
-- ONCE at its source and only READ here. The one thing that had no source was the general note
-- that fits none of the others ("asked to try second base Thursday"). This table is that source.
--
-- WHAT THIS DOES: one table, `rep_player_notes` — a dated body (≤600, the observation limit) with
-- an optional goal it is about and an optional game it was noticed at. Nothing else. No tags, no
-- categories, no attachments (Q10: a season is a few dozen entries; the source chip does the
-- sorting a reader's eye needs). Season-scoped through the roster row, like every per-player
-- development table (a roster row is one player in one season).
--
-- ⚠ THE SAME SENSITIVITY CLASS AS A GOAL. A dated free-text log about a minor is the surface most
-- likely to drift into what the product's privacy posture rules out (DATA_DICTIONARY, goals:
-- skill/goal-oriented content, no behavioural profiling). So it takes the goals rules exactly:
-- READ on Internal notes (`canViewDevelopmentGoals`), WRITE on the Development grant AND notes
-- (`canWriteDevelopmentGoals`); families never see it; the season recap never reads it. The RLS
-- below encodes the grant alone (mig 292's reasoning: `notes` is a read grant and belongs to the
-- route's compound). RLS is not the coach portal's enforcement layer — every route runs
-- service-role and gates in the app — so a lagging policy lies rather than breaks a screen.
--
-- ⚠ SCHEMA-VISIBLE for the table, columns, CHECKs and indexes (the parity gate sees them);
-- SCHEMA-INVISIBLE for the FIVE policies (recorded in MANUAL_PROD_STEPS.json for that reason).
-- Verify on prod with the query at the foot of this file.
--
-- ⚠ ORDER: after 295 — the composite FK onto `rep_player_development_goals(id, team_id)` needs the
-- unique that 295 created.

begin;

create table if not exists public.rep_player_notes (
  id          uuid          primary key default gen_random_uuid(),
  org_id      uuid          not null references public.organizations(id) on delete cascade,
  team_id     uuid          not null references public.rep_teams(id) on delete cascade,
  player_id   uuid          not null,
  -- When the coach noticed it — coach-chosen, defaults to today on the form. Date, not a
  -- timestamp: a note is "Thursday's practice", not 19:42:07.
  noted_on    date          not null,
  body        text          not null check (char_length(body) between 1 and 600),
  -- What it is ABOUT, when it is about something the product already knows.
  goal_id     uuid,
  event_id    uuid          references public.rep_team_events(id) on delete set null,
  created_by  uuid          references auth.users(id) on delete set null,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  constraint rep_player_notes_player_team_fkey
    foreign key (player_id, team_id) references public.rep_roster_players(id, team_id) on delete cascade,
  constraint rep_player_notes_goal_team_fkey
    foreign key (goal_id, team_id) references public.rep_player_development_goals(id, team_id) on delete set null
);
create index if not exists rep_player_notes_player_idx on public.rep_player_notes(player_id, noted_on desc);
create index if not exists rep_player_notes_team_idx   on public.rep_player_notes(team_id, noted_on desc);
create index if not exists rep_player_notes_org_idx    on public.rep_player_notes(org_id);
create index if not exists rep_player_notes_goal_idx   on public.rep_player_notes(goal_id) where goal_id is not null;
create index if not exists rep_player_notes_event_idx  on public.rep_player_notes(event_id) where event_id is not null;

comment on table public.rep_player_notes is
  'A dated general note a coach wrote about a player — the one kind of entry on the Notes tab that has no other source (moments, observations and goal reviews are written where they belong and only READ there). Same sensitivity class as a goal: read on Internal notes, written on the Development grant AND notes; never shown to families; never read by the season recap.';
comment on column public.rep_player_notes.noted_on is 'When the coach noticed it (coach-chosen, defaults to today). A date, not a timestamp.';
comment on column public.rep_player_notes.goal_id is 'The goal this note is about, when it is about one (composite FK with team_id, SET NULL on delete).';
comment on column public.rep_player_notes.event_id is 'The game or practice it was noticed at, when it was (SET NULL on delete).';

-- ═══ RLS — reads as mig 189, writes as mig 292 ══════════════════════════════════════════════════
alter table public.rep_player_notes enable row level security;

drop policy if exists "org members can read rep_player_notes" on public.rep_player_notes;
create policy "org members can read rep_player_notes"
  on public.rep_player_notes for select
  using (org_id in (select organization_id from public.organization_members where user_id = auth.uid()));
drop policy if exists "coaches can read assigned team player notes" on public.rep_player_notes;
create policy "coaches can read assigned team player notes"
  on public.rep_player_notes for select
  using (team_id in (select team_id from public.rep_team_coaches where user_id = auth.uid()));
drop policy if exists "development writers can insert rep_player_notes" on public.rep_player_notes;
create policy "development writers can insert rep_player_notes"
  on public.rep_player_notes for insert
  with check (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));
drop policy if exists "development writers can update rep_player_notes" on public.rep_player_notes;
create policy "development writers can update rep_player_notes"
  on public.rep_player_notes for update
  using (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')))
  with check (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));
drop policy if exists "development writers can delete rep_player_notes" on public.rep_player_notes;
create policy "development writers can delete rep_player_notes"
  on public.rep_player_notes for delete
  using (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));

commit;

-- Verify (dev and, later, prod — the gates see the table, columns, CHECK and indexes; they cannot
-- see the policies):
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'rep_player_notes' order by cmd, policyname;
--   -- expect 5 rows: DELETE ×1, INSERT ×1, SELECT ×2, UPDATE ×1
