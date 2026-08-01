-- 213: Practice Plans slice 1a — the plan on the practice, and the evaluation-session ⇄ practice link.
--
-- Two additive nullable columns, one per direction of the SAME seam. They ship together because
-- the project designed both ends at once rather than twice (plan §10.1): a practice gains "what we
-- intend to do", and an evaluation session gains "which practice this was measured at".
--
-- ── 1. rep_team_events.practice_plan (jsonb) ────────────────────────────────────────────────────
-- The structured practice plan: a practice-level goal + kit line, then ordered BLOCKS, each either
-- one activity or a station ROTATION with block-level groups and a computed group×round grid.
--
-- WHY A COLUMN AND NOT A TABLE
-- Exact precedent: mig 162 added rep_team_events.resources the same way. A plan is read and written
-- whole, always through its own event, is never queried across events by its internals, and belongs
-- to exactly ONE practice (plan D7 — a plan is deliberately NOT series-scoped, so the recurrence
-- edit-scope machinery must never touch it). A child table would buy nothing and would invite a
-- "this & future" bulk write that could wipe eleven weeks of a coach's thinking in one tap.
--
-- WHY NOT REUSE AN EXISTING COLUMN
-- `description` is a text box — it cannot drive a rotation grid, attach players, or print a
-- station sheet; shipping that would be a Google Doc with extra steps. `resources` is a typed
-- link list with its own sanitiser and a reserved 'file' type; overloading it would corrupt a
-- shipped contract to save one nullable column.
--
-- VALIDATION IS APP-LAYER, DELIBERATELY (same stance as `resources`)
-- Shape, caps and the structural invariants (at most one "rest of practice" block; a rotation's
-- people live in its groups, never per-station; every player id must be on the CURRENT roster)
-- are enforced by sanitizePracticePlan() in lib/rep-practice-plan.ts on every write path. A DB
-- CHECK over jsonb could not express them and would be a second, drifting answer.
--
-- ── 2. rep_team_evaluation_sessions.event_id (uuid FK) ──────────────────────────────────────────
-- Which scheduled event an evaluation session's readings were collected at ("coaches write things
-- down during a practice and type them in later").
--
-- ON DELETE SET NULL, deliberately: deleting the practice must leave the session alive as an
-- ordinary dated session — the SAME rule that already governs deleting a session itself (its
-- readings degrade to singles rather than being erased). The measurements happened; the calendar
-- artifact they were grouped under is not the record.
--
-- ⚠ THE LINK AND THE DATE STAY TWO SEPARATE FACTS (plan §10.2 ruling 1). Picking a practice
-- PRE-FILLS the session date; it does not derive it. A rescheduled practice must NOT move the
-- session's date, and therefore must not re-stamp its readings — the measurements happened when
-- they happened, and rewriting history to keep a foreign key tidy is exactly the dishonesty the
-- re-stamp rule exists to prevent.
--
-- NOT constrained to practices only: a coach who tested at a Saturday scrimmage warm-up must be
-- able to say so (ruling 2). The link is descriptive, not structural.
--
-- Both columns are additive and nullable — reads degrade safely on an un-migrated database.

alter table public.rep_team_events
  add column if not exists practice_plan jsonb;

comment on column public.rep_team_events.practice_plan is
  'Practice Plans 1a (mig 213): the structured plan for THIS practice — {version, goal?, kit?, blocks:[{id, shape:activity|rotation, title, description?, goal?, duration:{minutes|toMinutes|restOfPractice}, staff?[], playerIds?[], coachingPoints?[], stations?[], rotation?{totalMinutes,intervalMinutes,groups[],groupSource}}]}. App-validated/capped in lib/rep-practice-plan.ts, NOT by DB constraints (same stance as `resources`, mig 162). NULL when there is no plan. ⚠ OCCURRENCE-SCOPED (plan D7) — never written by the recurrence series update; a series-wide write would destroy a season of per-practice thinking. Staff entries are LABELS, never grants. See DATA_DICTIONARY.md.';

alter table public.rep_team_evaluation_sessions
  add column if not exists event_id uuid
  references public.rep_team_events(id) on delete set null;

create index if not exists rep_team_eval_sessions_event_idx
  on public.rep_team_evaluation_sessions (event_id)
  where event_id is not null;

comment on column public.rep_team_evaluation_sessions.event_id is
  'Practice Plans 1a / D10 (mig 213): the scheduled event these readings were collected at (any event type — a coach may test at a scrimmage warm-up). ON DELETE SET NULL so deleting the practice leaves the session alive as an ordinary dated session. ⚠ PRE-FILLS the session date, never derives it: a rescheduled practice must NOT move session_date and must NOT re-stamp readings (plan §10.2 ruling 1). NULL = an unlinked session. See DATA_DICTIONARY.md.';
