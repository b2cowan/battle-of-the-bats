-- 298 · Attempts are planned on the SESSION, per test (development lifecycle re-evaluation,
-- stage 2 · Session — owner ruling C1, 2026-09-15, drawing the B9 ruling of 2026-09-14:
-- "the coach may have time to run a test 3 times in a practice and only twice in another;
-- this should be defined in the session instead").
--
-- ORDER-CRITICAL after 297 (the tail at author time). Apply to dev with
-- `node scripts/apply-migration-api.mjs supabase/migrations/298_attempts_are_planned_on_the_session.sql`,
-- then `npm run refresh:snapshots`. PROD-OWED: apply BEFORE promoting the code that reads it.
--
-- WHAT CHANGES
--   rep_team_evaluation_sessions.scope_attempts   jsonb, nullable — a map of metric id → the number
--                                                  of attempts the coach PLANNED for that test in this
--                                                  session ({"<uuid>": 2, ...}, values 1..5). One more
--                                                  fact of the scope snapshot beside scope_metric_ids /
--                                                  scope_player_ids (/dba Finding #41 item 3: a scope is
--                                                  a snapshot of intent read only by its own session,
--                                                  never queried by member — so a map, not a join
--                                                  table). NULL on every session created before this
--                                                  migration = no count was ever claimed: the grid
--                                                  shows as many boxes as a row holds, the review never
--                                                  says "fewer than planned". A skill has no count (its
--                                                  key is absent or 1 — an observation is one thing).
--
-- WHAT DOES NOT CHANGE
--   rep_team_measurable_types.attempts_per_session stays. It is no longer written by the definition
--   sheet (C1: the definition keeps the HEADLINE — how a result is read — and loses the count); it is
--   read only as the seed for a session's pre-fill when no session has run that test yet
--   (last session's count → else this column → else 1). A new test writes 1.
--
-- RULES THE ROUTE HOLDS (not the database — a CHECK over jsonb values would need a function, and the
-- id lists beside it are proved the same way): every key names a metric in scope_metric_ids; every
-- value is an integer 1..5 (the same ceiling rep_player_measurables.attempt_no carries through the
-- reader). The plan is a FLOOR, never a ceiling (C2): a row may hold MORE attempts than planned (the
-- "+" on the row, up to five), and a lowered count never hides a saved attempt.
--
-- No index (never filtered on), no RLS change (a column on a table whose policies are mig 292's), no
-- data step. Visible to the parity gate whole.

alter table public.rep_team_evaluation_sessions
  add column if not exists scope_attempts jsonb;

do $$
begin
  -- A map, or nothing.
  if not exists (select 1 from pg_constraint where conname = 'rep_team_evaluation_sessions_scope_attempts_object_check' and conrelid = 'public.rep_team_evaluation_sessions'::regclass) then
    alter table public.rep_team_evaluation_sessions
      add constraint rep_team_evaluation_sessions_scope_attempts_object_check
      check (scope_attempts is null or jsonb_typeof(scope_attempts) = 'object');
  end if;
  -- A count belongs to a stated scope: no scope, no counts (extends mig 295's whole-or-neither).
  if not exists (select 1 from pg_constraint where conname = 'rep_team_evaluation_sessions_scope_attempts_needs_scope_check' and conrelid = 'public.rep_team_evaluation_sessions'::regclass) then
    alter table public.rep_team_evaluation_sessions
      add constraint rep_team_evaluation_sessions_scope_attempts_needs_scope_check
      check (scope_attempts is null or scope_metric_ids is not null);
  end if;
end $$;

comment on column public.rep_team_evaluation_sessions.scope_attempts is
  'How many attempts the coach PLANNED per test in this session — {"<metric uuid>": 1..5}, keys a subset of scope_metric_ids (proved by the route). NULL = no count claimed (every session before 2026-09-15). A floor, never a ceiling: a row may hold more attempts than planned.';
