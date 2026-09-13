-- 295 — Record and review both kinds of development: every attempt, a session's scope, "not
-- assessed", observations, goal reviews, and a correction that keeps the original
-- (COACH_DEVELOPMENT_LIFECYCLE_PLAN.md §7 recording contracts + §9 corrections + §16 owner
-- rulings 2026-09-11; mockup screens 3 "Record" and 4 "Player & goals"; built 2026-09-13 as
-- Phase 2 — record and review both kinds of development.)
--
-- WHAT A READING WAS: one row per player per test per session (mig 190's partial unique). The
-- owner ruled that EVERY attempt is recorded — a player who runs the sprint three times gets three
-- numbers, kept individually, so best / average / spread can be computed later and never stored.
-- This migration is ADDITIVE throughout and, like 293, backfills NO meaning as fact:
--
--   rep_player_measurables.attempt_no        1..5 — which attempt within its session. Every existing
--                                            row becomes attempt 1 (the default), which is the truth:
--                                            one reading was taken. The unique becomes one per
--                                            (session, player, type, ATTEMPT). A single reading
--                                            ("Record a result", session_id NULL) stays one row.
--   rep_player_measurables.corrected_from/_at/_by
--                                            plan §9: editing a saved reading keeps the ORIGINAL value
--                                            on the row and never shows two active readings. The first
--                                            original is kept (never overwritten by a second edit);
--                                            who/when record the LAST correction. No history table —
--                                            the smallest honest shape (build call, hub Decisions).
--   rep_team_evaluation_sessions.scope_metric_ids / scope_player_ids
--                                            what the session was FOR — the metrics and the players
--                                            the coach chose at "Start session". NULL on every existing
--                                            session = no scope was ever stated, and the screen counts
--                                            "N of M entered" against the roster as Phase 0 made it.
--                                            id LISTS rather than join tables: a scope is a snapshot of
--                                            intent, and a player who later leaves the team stays in the
--                                            scope that named them (the screen resolves ids it knows).
--   rep_evaluation_not_assessed a per-(session, player, metric) STATE with a neutral
--                                            reason — "not assessed" is never a value and never a zero.
--   rep_player_observations                  the second kind of development record (plan §7 Observation):
--                                            a dated note of what the coach SAW against an observed
--                                            SKILL, with an optional descriptor (one of the skill's own
--                                            words), an optional goal it is evidence for, and the
--                                            session it was recorded in. Read on Internal notes, written
--                                            on the grant AND notes — the goals predicate. "Not observed"
--                                            is an absence of rows, never a rung.
--   rep_development_goal_reviews      APPEND-ONLY dated events (plan §7 Goal review, F08): the
--                                            status chosen (required — F19), an optional note, the next
--                                            review date and evidence references. A review NEVER
--                                            overwrites the previous one; the goal's `status` is the
--                                            latest review's status, written in the same step by the
--                                            route. No UPDATE or DELETE policy exists on purpose.
--   rep_player_development_goals.success / review_on / origin
--                                            "what success looks like", the next review date, and where
--                                            the goal came from — coach (set with the player), carried
--                                            (from a prior season), tryout (seeded from the scorecard).
--                                            origin is NULL on every existing goal: nothing was recorded,
--                                            so nothing is claimed; the screen shows no origin line.
--
-- ⚠ CROSS-TABLE RULES ARE ENFORCED BY COMPOSITE FOREIGN KEYS, not triggers or route rules alone:
--   · an observation can only name THIS TEAM's SKILL — (measurable_type_id, team_id, metric_kind)
--     references the definition's (id, team_id, kind), and metric_kind is CHECKed to 'skill'. A test cannot take an
--     observation by any path, and the definition's kind is fixed at creation (the reader refuses
--     a kind patch), so the FK can never be stranded by an edit.
--   · every player, goal, session and definition reference on the three new tables carries the
--     team in the FK (the mig 190/191 lesson; /dba Finding #41) — a row can never be attached
--     across teams by a well-formed id from another one. Table names were kept short so that no
--     derived policy name reaches Postgres's 63-byte identifier limit (the same finding).
--
-- ⚠ RLS copies mig 292's predicate exactly ("the head coach, OR an assistant whose stored grants
-- carry development: true") for every write, and mig 189's two read policies. The APP additionally
-- requires Internal notes for observations and reviews (`canWriteDevelopmentGoals`) — a READ grant
-- folded into a write policy would be the looser/stricter mismatch mig 292 refused; the compound is
-- enforced where it is decided, the route. ⚠ Policies are SCHEMA-INVISIBLE to the drift gates —
-- registered in MANUAL_PROD_STEPS.json; verify on prod with the query at the foot of this file.
--
-- Re-runnable: IF NOT EXISTS / DROP POLICY IF EXISTS throughout. Dictionary + snapshots refreshed in
-- the same commit. ⚠ ORDER-CRITICAL on release: the master build's parity gate is red until this is
-- on prod (the mig-286 lesson), and 293/294 must land before it (the composite FK below needs
-- `kind`).

begin;

-- ═══ 1. Every attempt is recorded ═══════════════════════════════════════════════════════════════
alter table public.rep_player_measurables
  add column if not exists attempt_no smallint not null default 1,
  add column if not exists corrected_from numeric(8,3),
  add column if not exists corrected_at timestamptz,
  add column if not exists corrected_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rep_player_measurables_attempt_no_check' and conrelid = 'public.rep_player_measurables'::regclass) then
    alter table public.rep_player_measurables
      add constraint rep_player_measurables_attempt_no_check check (attempt_no between 1 and 5);
  end if;
  -- A correction is whole: the original value, when and who — or none of them.
  if not exists (select 1 from pg_constraint where conname = 'rep_player_measurables_correction_whole_check' and conrelid = 'public.rep_player_measurables'::regclass) then
    alter table public.rep_player_measurables
      add constraint rep_player_measurables_correction_whole_check
      check ((corrected_from is null and corrected_at is null) or (corrected_from is not null and corrected_at is not null));
  end if;
end $$;

-- One reading per player per test per session becomes one per ATTEMPT (owner ruling 2026-09-11).
drop index if exists public.rep_player_measurables_session_entry_uniq;
create unique index if not exists rep_player_measurables_session_attempt_uniq
  on public.rep_player_measurables(session_id, player_id, measurable_type_id, attempt_no)
  where session_id is not null;

comment on column public.rep_player_measurables.attempt_no is
  'Which attempt within its session (1–5; the definition says how many a session takes). Legacy rows are attempt 1 of 1. A single reading (session_id NULL) is always 1. Best / average / spread are computed from the attempts, never stored.';
comment on column public.rep_player_measurables.corrected_from is
  'The ORIGINAL value when this reading was corrected after saving (plan §9). Set once — a second correction keeps the first original. NULL = never corrected.';
comment on column public.rep_player_measurables.corrected_at is 'When the reading was LAST corrected. Whole with corrected_from (CHECK).';
comment on column public.rep_player_measurables.corrected_by is 'Who LAST corrected the reading.';

-- ═══ 2. A session's scope ═══════════════════════════════════════════════════════════════════════
alter table public.rep_team_evaluation_sessions
  add column if not exists scope_metric_ids uuid[],
  add column if not exists scope_player_ids uuid[];

do $$
begin
  -- A scope is stated whole or not at all: both lists, or neither.
  if not exists (select 1 from pg_constraint where conname = 'rep_team_evaluation_sessions_scope_whole_check' and conrelid = 'public.rep_team_evaluation_sessions'::regclass) then
    alter table public.rep_team_evaluation_sessions
      add constraint rep_team_evaluation_sessions_scope_whole_check
      check ((scope_metric_ids is null and scope_player_ids is null) or (scope_metric_ids is not null and scope_player_ids is not null));
  end if;
end $$;

comment on column public.rep_team_evaluation_sessions.scope_metric_ids is
  'What the session was FOR — the metric definitions (tests and skills) chosen at Start session. NULL = no scope was stated (every session before 2026-09-13); counts then run against the active roster and the recorded rows only.';
comment on column public.rep_team_evaluation_sessions.scope_player_ids is
  'Who was there — the roster rows chosen at Start session. NULL = no scope (see scope_metric_ids). A snapshot of intent: a player who later leaves stays in the scope that named them.';

-- The composite FK targets the three new tables point at (/dba Finding #41, item 2): "this
-- team's definition", "this team's skill" (team + kind in one FK) and "this team's goal".
-- Created BEFORE the first table that references them.
create unique index if not exists rep_team_measurable_types_id_team_uniq
  on public.rep_team_measurable_types(id, team_id);
create unique index if not exists rep_team_measurable_types_id_team_kind_uniq
  on public.rep_team_measurable_types(id, team_id, kind);
create unique index if not exists rep_player_development_goals_id_team_uniq
  on public.rep_player_development_goals(id, team_id);

create table if not exists public.rep_evaluation_not_assessed (
  id                  uuid          primary key default gen_random_uuid(),
  org_id              uuid          not null references public.organizations(id) on delete cascade,
  team_id             uuid          not null references public.rep_teams(id) on delete cascade,
  session_id          uuid          not null,
  player_id           uuid          not null,
  measurable_type_id  uuid          not null,
  -- Neutral, optional: "absent", "injured", "left early". Never a value.
  reason              text          check (reason is null or char_length(reason) <= 120),
  created_by          uuid          references auth.users(id) on delete set null,
  created_at          timestamptz   not null default now(),
  -- The session, the player and the definition must all be THIS team's — composite FKs onto the
  -- (id, team_id) uniques (mig 190's on sessions, mig 191's on roster rows, this file's on
  -- definitions), the mig 190/191 lesson: a well-formed id from another team can never attach here.
  constraint rep_evaluation_not_assessed_session_team_fkey
    foreign key (session_id, team_id) references public.rep_team_evaluation_sessions(id, team_id) on delete cascade,
  constraint rep_evaluation_not_assessed_player_team_fkey
    foreign key (player_id, team_id) references public.rep_roster_players(id, team_id) on delete cascade,
  constraint rep_evaluation_not_assessed_type_team_fkey
    foreign key (measurable_type_id, team_id) references public.rep_team_measurable_types(id, team_id) on delete restrict
);
create unique index if not exists rep_evaluation_not_assessed_uniq
  on public.rep_evaluation_not_assessed(session_id, player_id, measurable_type_id);
create index if not exists rep_evaluation_not_assessed_org_idx
  on public.rep_evaluation_not_assessed(org_id);
create index if not exists rep_evaluation_not_assessed_team_idx
  on public.rep_evaluation_not_assessed(team_id);
create index if not exists rep_evaluation_not_assessed_player_idx
  on public.rep_evaluation_not_assessed(player_id);
create index if not exists rep_evaluation_not_assessed_type_idx
  on public.rep_evaluation_not_assessed(measurable_type_id);

comment on table public.rep_evaluation_not_assessed is
  'A per-(session, player, metric) STATE: the coach chose not to assess this player on this metric in this session, with a neutral optional reason. Never a value, never a zero; "not observed" for a skill is the same row. Removing the row returns the cell to "not recorded".';

-- ═══ 3. Observations ════════════════════════════════════════════════════════════════════════════

create table if not exists public.rep_player_observations (
  id                  uuid          primary key default gen_random_uuid(),
  org_id              uuid          not null references public.organizations(id) on delete cascade,
  team_id             uuid          not null references public.rep_teams(id) on delete cascade,
  player_id           uuid          not null,
  measurable_type_id  uuid          not null,
  metric_kind         text          not null default 'skill' check (metric_kind = 'skill'),
  observed_on         date          not null,
  -- What the coach saw, in their words. Optional ONLY when a descriptor was chosen (CHECK below):
  -- "With a reminder" is itself what was seen (build call, hub Decisions).
  note                text          check (note is null or char_length(note) <= 600),
  -- One of the skill's descriptors, as written on the definition at the time — snapshotted text,
  -- never an index, so a later edit to the descriptor list never rewrites what was seen.
  descriptor          text          check (descriptor is null or char_length(descriptor) <= 60),
  goal_id             uuid,
  session_id          uuid,
  created_by          uuid          references auth.users(id) on delete set null,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  constraint rep_player_observations_has_content_check check (note is not null or descriptor is not null),
  constraint rep_player_observations_player_team_fkey
    foreign key (player_id, team_id) references public.rep_roster_players(id, team_id) on delete cascade,
  constraint rep_player_observations_skill_fkey
    foreign key (measurable_type_id, team_id, metric_kind) references public.rep_team_measurable_types(id, team_id, kind) on delete restrict,
  constraint rep_player_observations_goal_team_fkey
    foreign key (goal_id, team_id) references public.rep_player_development_goals(id, team_id) on delete set null,
  constraint rep_player_observations_session_team_fkey
    foreign key (session_id, team_id) references public.rep_team_evaluation_sessions(id, team_id) on delete set null
);
create index if not exists rep_player_observations_player_idx
  on public.rep_player_observations(player_id, measurable_type_id, observed_on desc);
create index if not exists rep_player_observations_team_idx
  on public.rep_player_observations(team_id, observed_on desc);
create index if not exists rep_player_observations_org_idx on public.rep_player_observations(org_id);
create index if not exists rep_player_observations_type_idx on public.rep_player_observations(measurable_type_id);
create index if not exists rep_player_observations_goal_idx on public.rep_player_observations(goal_id) where goal_id is not null;
create index if not exists rep_player_observations_session_idx on public.rep_player_observations(session_id) where session_id is not null;
-- The evidence and the not-assessed rows are read alongside a goal / a session; those FK columns
-- are indexed above per the repo's standing rule.

comment on table public.rep_player_observations is
  'A dated record of what a coach SAW against an observed SKILL (plan §7 Observation): the note and/or one of the skill''s descriptors, an optional goal it is evidence for, and the session it was taken in. Read on Internal notes; written on the Development grant AND notes (the goals predicate). Never averaged, never a score.';
comment on column public.rep_player_observations.metric_kind is
  'Always ''skill'' (CHECK) — with the composite FK onto (id, team_id, kind) it makes "an observation names this team''s skill" a database rule, not a route rule.';
comment on column public.rep_player_observations.descriptor is
  'One of the skill''s descriptors as written at the time (snapshotted text). Optional; when present the note may be empty.';

-- ═══ 4. Goal reviews (append-only) and the goal''s new fields ═══════════════════════════════════
alter table public.rep_player_development_goals
  add column if not exists success text,
  add column if not exists review_on date,
  add column if not exists origin text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rep_player_development_goals_success_check' and conrelid = 'public.rep_player_development_goals'::regclass) then
    alter table public.rep_player_development_goals
      add constraint rep_player_development_goals_success_check check (success is null or char_length(success) <= 280);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_player_development_goals_origin_check' and conrelid = 'public.rep_player_development_goals'::regclass) then
    alter table public.rep_player_development_goals
      add constraint rep_player_development_goals_origin_check check (origin is null or origin in ('coach', 'carried', 'tryout'));
  end if;
end $$;

comment on column public.rep_player_development_goals.success is 'What success looks like, in the coach''s words (optional, ≤280).';
comment on column public.rep_player_development_goals.review_on is 'The next review date the coach chose (optional). Moved by each review that names a next date.';
comment on column public.rep_player_development_goals.origin is
  'Where the goal came from: coach (set with the player) | carried (from a prior season''s record) | tryout (seeded from the scorecard). NULL on goals written before 2026-09-13 — not recorded, so not claimed.';

create table if not exists public.rep_development_goal_reviews (
  id                        uuid          primary key default gen_random_uuid(),
  org_id                    uuid          not null references public.organizations(id) on delete cascade,
  team_id                   uuid          not null references public.rep_teams(id) on delete cascade,
  player_id                 uuid          not null,
  goal_id                   uuid          not null,
  reviewed_on               date          not null,
  status                    text          not null check (status in ('working', 'achieved', 'parked')),
  note                      text          check (note is null or char_length(note) <= 600),
  next_review_on            date,
  -- Evidence references: ids of readings / observations the coach pointed at. Lists, not FKs — a
  -- deleted reading leaves a dangling id the screen simply does not resolve, which is honest
  -- ("evidence that was removed"), where a cascade would silently rewrite a past review.
  evidence_measurable_ids   uuid[]        not null default '{}',
  evidence_observation_ids  uuid[]        not null default '{}',
  created_by                uuid          references auth.users(id) on delete set null,
  created_at                timestamptz   not null default now(),
  constraint rep_development_goal_reviews_player_team_fkey
    foreign key (player_id, team_id) references public.rep_roster_players(id, team_id) on delete cascade,
  constraint rep_development_goal_reviews_goal_team_fkey
    foreign key (goal_id, team_id) references public.rep_player_development_goals(id, team_id) on delete cascade
);
create index if not exists rep_development_goal_reviews_goal_idx
  on public.rep_development_goal_reviews(goal_id, reviewed_on desc, created_at desc);
create index if not exists rep_development_goal_reviews_player_idx
  on public.rep_development_goal_reviews(player_id);
create index if not exists rep_development_goal_reviews_org_idx on public.rep_development_goal_reviews(org_id);
create index if not exists rep_development_goal_reviews_team_idx on public.rep_development_goal_reviews(team_id);

comment on table public.rep_development_goal_reviews is
  'APPEND-ONLY dated review events on a goal (plan §7 Goal review; F08): the status chosen (required), an optional note, the next review date and evidence references. A review never overwrites the previous one; the goal''s status is the latest review''s, written in the same step. No UPDATE/DELETE policy on purpose.';

-- ═══ 5. RLS — reads as mig 189, writes as mig 292 ═══════════════════════════════════════════════
alter table public.rep_evaluation_not_assessed enable row level security;
alter table public.rep_player_observations enable row level security;
alter table public.rep_development_goal_reviews enable row level security;

-- not assessed
drop policy if exists "org members can read rep_evaluation_not_assessed" on public.rep_evaluation_not_assessed;
create policy "org members can read rep_evaluation_not_assessed"
  on public.rep_evaluation_not_assessed for select
  using (org_id in (select organization_id from public.organization_members where user_id = auth.uid()));
drop policy if exists "coaches can read assigned team session not assessed" on public.rep_evaluation_not_assessed;
create policy "coaches can read assigned team session not assessed"
  on public.rep_evaluation_not_assessed for select
  using (team_id in (select team_id from public.rep_team_coaches where user_id = auth.uid()));
drop policy if exists "development writers can insert rep_evaluation_not_assessed" on public.rep_evaluation_not_assessed;
create policy "development writers can insert rep_evaluation_not_assessed"
  on public.rep_evaluation_not_assessed for insert
  with check (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));
drop policy if exists "development writers can delete rep_evaluation_not_assessed" on public.rep_evaluation_not_assessed;
create policy "development writers can delete rep_evaluation_not_assessed"
  on public.rep_evaluation_not_assessed for delete
  using (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));

-- observations
drop policy if exists "org members can read rep_player_observations" on public.rep_player_observations;
create policy "org members can read rep_player_observations"
  on public.rep_player_observations for select
  using (org_id in (select organization_id from public.organization_members where user_id = auth.uid()));
drop policy if exists "coaches can read assigned team observations" on public.rep_player_observations;
create policy "coaches can read assigned team observations"
  on public.rep_player_observations for select
  using (team_id in (select team_id from public.rep_team_coaches where user_id = auth.uid()));
drop policy if exists "development writers can insert rep_player_observations" on public.rep_player_observations;
create policy "development writers can insert rep_player_observations"
  on public.rep_player_observations for insert
  with check (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));
drop policy if exists "development writers can update rep_player_observations" on public.rep_player_observations;
create policy "development writers can update rep_player_observations"
  on public.rep_player_observations for update
  using (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')))
  with check (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));
drop policy if exists "development writers can delete rep_player_observations" on public.rep_player_observations;
create policy "development writers can delete rep_player_observations"
  on public.rep_player_observations for delete
  using (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));

-- goal reviews — INSERT only. No update, no delete: a review is a dated event that stands.
drop policy if exists "org members can read rep_development_goal_reviews" on public.rep_development_goal_reviews;
create policy "org members can read rep_development_goal_reviews"
  on public.rep_development_goal_reviews for select
  using (org_id in (select organization_id from public.organization_members where user_id = auth.uid()));
drop policy if exists "coaches can read assigned team goal reviews" on public.rep_development_goal_reviews;
create policy "coaches can read assigned team goal reviews"
  on public.rep_development_goal_reviews for select
  using (team_id in (select team_id from public.rep_team_coaches where user_id = auth.uid()));
drop policy if exists "development writers can insert rep_development_goal_reviews" on public.rep_development_goal_reviews;
create policy "development writers can insert rep_development_goal_reviews"
  on public.rep_development_goal_reviews for insert
  with check (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));

commit;

-- Verify (dev and, later, prod — the gates see the tables, columns, CHECKs and indexes; they cannot
-- see the policies):
--   select tablename, policyname, cmd from pg_policies
--    where schemaname = 'public'
--      and tablename in ('rep_evaluation_not_assessed','rep_player_observations',
--                        'rep_development_goal_reviews')
--    order by tablename, cmd;
--   → 12 rows: 2 SELECT + INSERT + DELETE on not_assessed; 2 SELECT + INSERT + UPDATE + DELETE on
--     observations; 2 SELECT + INSERT (and NOTHING else) on goal_reviews.
--   select count(*) from public.rep_player_measurables where attempt_no <> 1;  → 0 right after apply.
