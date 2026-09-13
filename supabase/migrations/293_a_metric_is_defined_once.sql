-- 293 — A metric is defined once: kind · aim · range · method · attempts · headline · descriptors,
-- and a replaced definition points at its successor
-- (COACH_DEVELOPMENT_LIFECYCLE_PLAN.md §7 definition contracts + §16 owner rulings 2026-09-11;
-- mockup screen 2 "Define"; built 2026-09-12 as Phase 1 — find and define.)
--
-- WHAT A DEFINITION WAS: a name and a unit (mig 189). A number only means what its recorded
-- method and unit support (plan §7), and the product could say nothing honest about "0.35 seconds
-- lower" without knowing whether lower was the aim. This migration gives `rep_team_measurable_types`
-- the rest of the definition, ADDITIVELY, and admits the second kind of metric the owner asked for:
--
--   kind                 'test' (a measured number) | 'skill' (an observed behaviour — descriptors,
--                        no unit; recording an OBSERVATION against it is Phase 2)
--   unit                 now NULLABLE — a skill has none. A test still requires one (CHECK below).
--   aim                  'lower' | 'higher' | 'range' | 'record' — what a better result looks like;
--                        'record' = record only, no direction claimed
--   range_from/range_to  the band, in the unit, when aim = 'range' (owner: kept and drawn properly)
--   method               how the test is run, written once so results are comparable (nullable)
--   attempts_per_session 1–5 — every attempt is recorded (owner ruling); Phase 2 records them
--   headline             which attempt rows/charts lead with: 'best' (in the aim's direction —
--                        the default) | 'average' | 'last' | 'in_range' (range tests only, since a
--                        range test has no "best")
--   descriptors          a skill's coach-written words for what they saw, in their order (text[])
--   replaced_by_id       set on a RETIRED definition when a unit or method change on a test that
--                        already had readings started a NEW definition (ruling 3: rename keeps
--                        the series; a unit/method change starts a successor and retires this one)
--
-- ⚠ NO MEANING IS BACKFILLED AS FACT (plan §10). Every existing row becomes kind = 'test',
-- aim = 'record', attempts = 1, headline = 'last', method NULL, descriptors {} — the product then
-- reads "record only · method not recorded" for a legacy test, which is the truth. The column
-- default for `headline` is then moved to 'best' (ruling 6: headline defaults to best) so a
-- definition created from here on lands on the ruled default while the legacy rows keep 'last'.
-- That two-step (ADD … DEFAULT 'last' → SET DEFAULT 'best') is deliberately schema-only — an
-- UPDATE would be a data-only step invisible to every drift gate.
--
-- ⚠ CHECKs are NAMED and cross-column, so a nonsense definition cannot be stored by any path:
--   · a test has a unit and a skill has none
--   · a range test carries both edges and from < to; a non-range test carries neither
--   · a range test's headline is never 'best'; a non-range test's headline is never 'in_range'
--   · descriptors belong to skills (a test carries none) and number at most 10
--   · a replaced definition is a retired one
-- Per-element descriptor length (≤ 60) is the reader's rule (lib/development-input.ts); an array
-- element CHECK is awkward in SQL and the reader is the only writer.
--
-- ⚠ The name/unit uniqueness index (`rep_team_measurable_types_name_uniq`, partial on is_active)
-- is UNCHANGED and is what makes the successor rule safe: the predecessor is retired before the
-- successor is inserted under the same name, in that order (lib/db.ts `replaceRepTeamMeasurableType`).
--
-- Additive, IF NOT EXISTS throughout, re-runnable. Dictionary + snapshots refreshed in the same
-- commit; `check:dictionary` and the parity gate see every column and CHECK here — ⚠ ORDER-CRITICAL
-- on release: the master build's parity gate is red until this is on prod (the mig-286 lesson).

begin;

alter table public.rep_team_measurable_types
  add column if not exists kind text not null default 'test',
  add column if not exists aim text not null default 'record',
  add column if not exists range_from numeric(8,3),
  add column if not exists range_to numeric(8,3),
  add column if not exists method text,
  add column if not exists attempts_per_session smallint not null default 1,
  add column if not exists headline text not null default 'last',
  add column if not exists descriptors text[] not null default '{}',
  add column if not exists replaced_by_id uuid references public.rep_team_measurable_types(id) on delete set null;

-- A skill has no unit. The inline length CHECK from mig 189 passes NULL (NULL BETWEEN … is NULL).
alter table public.rep_team_measurable_types alter column unit drop not null;

-- From here on a definition lands on the ruled default; the legacy rows above keep 'last'.
alter table public.rep_team_measurable_types alter column headline set default 'best';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_kind_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_kind_check check (kind in ('test', 'skill'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_aim_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_aim_check check (aim in ('lower', 'higher', 'range', 'record'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_headline_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_headline_check check (headline in ('best', 'average', 'last', 'in_range'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_attempts_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_attempts_check check (attempts_per_session between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_unit_by_kind_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_unit_by_kind_check
      check ((kind = 'test' and unit is not null) or (kind = 'skill' and unit is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_range_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_range_check
      check (
        (aim = 'range' and range_from is not null and range_to is not null and range_from < range_to)
        or (aim <> 'range' and range_from is null and range_to is null)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_headline_by_aim_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_headline_by_aim_check
      check ((aim = 'range' and headline <> 'best') or (aim <> 'range' and headline <> 'in_range'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_descriptors_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_descriptors_check
      check ((kind = 'skill' or cardinality(descriptors) = 0) and cardinality(descriptors) <= 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_method_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_method_check check (method is null or char_length(method) <= 600);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rep_team_measurable_types_replaced_is_retired_check' and conrelid = 'public.rep_team_measurable_types'::regclass) then
    alter table public.rep_team_measurable_types
      add constraint rep_team_measurable_types_replaced_is_retired_check
      check (replaced_by_id is null or is_active = false);
  end if;
end $$;

-- The successor link is walked from the retired side ("replaced by …") and, on the Metrics tab,
-- back from the successor ("continues …") over the team's own list — a per-team list is a
-- handful of rows, but the FK column still gets its index per this repo's standing rule.
create index if not exists rep_team_measurable_types_replaced_by_idx
  on public.rep_team_measurable_types(replaced_by_id) where replaced_by_id is not null;

comment on column public.rep_team_measurable_types.kind is
  'test = a measured number (has a unit); skill = an observed behaviour (descriptors, no unit). Fixed at creation.';
comment on column public.rep_team_measurable_types.aim is
  'What a better result looks like: lower | higher | range (between range_from and range_to) | record (record only — no direction claimed). Legacy rows read record.';
comment on column public.rep_team_measurable_types.method is
  'How the test is run, in the coach''s words, so results are comparable. NULL = not recorded (legacy rows; the product says so). Changing a WRITTEN method on a test with readings starts a successor definition.';
comment on column public.rep_team_measurable_types.attempts_per_session is
  'How many attempts one session records per player (1–5). Every attempt is kept (owner ruling 2026-09-11); Phase 2 records them.';
comment on column public.rep_team_measurable_types.headline is
  'Which attempt rows and charts lead with: best (in the aim''s direction; default for new rows) | average | last (legacy rows) | in_range (range tests only). Computed from attempts, never stored.';
comment on column public.rep_team_measurable_types.descriptors is
  'A skill''s coach-written descriptors, in the coach''s order (≤10, each ≤60 chars — the reader''s rule). Never a scale, never averaged. Empty on a test.';
comment on column public.rep_team_measurable_types.replaced_by_id is
  'Set on a RETIRED definition that a unit/method change replaced (ruling 3): the successor it points at carries the same name; readings stay under the unit they were recorded in. NULL otherwise.';

commit;
