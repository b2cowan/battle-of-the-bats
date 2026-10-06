-- Migration 317: the club's plan meets its books.
-- (Club Tier Stage 3b, session 1 — the server half. Owner rulings 2026-10-06, Asks 1–5: "I agree with
--  your recommendations, including the 2 fixes", and the build session's three calls the same day.
--  Plan: docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md §4C C05 C09 C10 C11 C14, §6
--  Stage 3b; build prompt CLUB_TIER_STAGE3B_SERVER_PROMPT.md.)
--
-- THE CASE. The club's Budget had no Actual for any line (C09): its ledger lines carried a free-text
-- category that matched nothing on the plan. One allocation per line was the rule, the line's total
-- could drop under what was already billed from it, an allocation recorded the LINE's total even when
-- its teams' shares added to less, the allocation and its link to the line were two writes, and a
-- line's payment periods were set once and never checked again (C11).
--
-- WHAT THIS ADDS
--   1. A club ledger line carries a BUDGET WORD — a category and an item from the one budget library,
--      the two columns a coach's cost already has (Ask 4a: spending meets the plan by WORD, the
--      coach's rule — not by line, which supersedes the plan's old J4-024 "entries carry a budget
--      line"). ⚠ NO BACKFILL: every existing line keeps its free-text `category` and reads "Not filed".
--   2. ONE STANDARD WORD the money loop files a request paid to a team under: "Team support ›
--      Paid to teams on request" (owner, 2026-10-06, the build session's call 1). Money out, CLUB-ONLY
--      (`scope = 'org'`: a coach's picker never lists a club-only heading, exactly as with today's
--      Admin and Coaching), and standard so no club can rename it out from under the report. Fixed
--      ids, the same on every database, because the code names them.
--   3. ONE WORD, ONE LINE on a club's year plan (the coach's mig-286 rule): twins are joined, then a
--      partial unique index makes it true.
--   4. ONE DATABASE STEP for each budget write that money depends on:
--        club_allocation_create  — an allocation, its splits, its installments and its link to the
--                                  line, together; refused above what is left on the line, worked out
--                                  inside the transaction under the line's lock. Many per line.
--        club_budget_line_add    — a new line and its dates, together, under the year's lock a roll
--                                  takes; a word already on the year is refused naming its line (the
--                                  app then adds to that line).
--        club_budget_line_save   — a line's total, its periods, its word and its words, together; a
--                                  total is refused below what is allocated, the periods must add up
--                                  to the total (±$0.02, the coach's rep_budget_periods rule), a full
--                                  replace; a word already on the year is refused, and a line teams
--                                  are billed from never takes a money-in word.
--        club_budget_line_delete — a line, refused while an allocation is drawn from it, under the
--                                  same lock an allocation takes.
--        club_budget_roll_year   — start a year from another year's plan: lines and periods, dates
--                                  moved on; refused when the target year already has lines.
--        club_book_totals        — a set of books' sums in ONE SQL aggregate (C14: replaces the
--                                  page-by-page walk 3a kept on purpose for 3b). Posted only moves a
--                                  balance; pending is reported beside it.
--
-- ⚠ PROD-OWED, and ORDER-CRITICAL: the code that ships with this calls six of its eight functions, reads and
-- writes the two new columns, and names the standard word's ids. Apply to prod BEFORE promoting that
-- code. The functions and the word are invisible to `check:migrations`, so MANUAL_PROD_STEPS.json
-- carries this file as `pending`. Counted 2026-10-06 before writing (read-only, owner's go): prod has
-- NO club budget lines at all and no line on a club's own books; dev has 8 lines on 2 plans, 4 with no
-- word, and NO twins — so part 3's join changes nothing on either database today. It stays, ahead of
-- the index, so the index can never fail to build on data written in between.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING, CREATE OR REPLACE, IF NOT EXISTS.

BEGIN;

-- ── 1. A club ledger line carries a budget word ────────────────────────────────────────────────

ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS budget_category_id uuid REFERENCES public.budget_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget_item_id     uuid REFERENCES public.budget_items(id)      ON DELETE SET NULL;

-- The reverse lookups a word's usage count and a word merge make (mig 249's reason, for the other
-- tables that name a word).
CREATE INDEX IF NOT EXISTS accounting_entries_budget_category_id_idx
  ON public.accounting_entries (budget_category_id) WHERE budget_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS accounting_entries_budget_item_id_idx
  ON public.accounting_entries (budget_item_id) WHERE budget_item_id IS NOT NULL;

COMMENT ON COLUMN public.accounting_entries.budget_item_id IS
  'The budget WORD a club ledger line is filed under (mig 317, Club Tier Stage 3b, Ask 4a): its Actual on Budget vs. Actual is matched to the year plan by this word (category + item), the coach''s rule. Written by the club''s add/edit entry on a club book (never a team''s book — a team''s book is the coaches'', D1); the direction matches the line (money in → an "in" word). NULL = not filed: every line written before 3b (no backfill — they read "Not filed") and every line the money loop writes, which is classified by its SOURCE and never by a word. The free-text `category` stops being written for new typed lines.';
COMMENT ON COLUMN public.accounting_entries.budget_category_id IS
  'The category of `budget_item_id`, derived from the item at save time and never taken from the request (an item belongs to exactly one category). Mig 317.';

-- ── 2. The standard word a request paid to a team files under ──────────────────────────────────
-- ⚠ Fixed ids, named in lib/club-budget-report.ts (TEAM_SUPPORT_WORD_IDS). Never change them.

INSERT INTO public.budget_categories (id, org_id, team_id, name, scope, sort_order, is_default, income_source)
VALUES ('3b5e7a00-0317-4c1b-8a50-7ea0507c0001', NULL, NULL, 'Team support', 'org', 11, true, 'typed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.budget_items
  (id, category_id, org_id, team_id, name, sort_order, is_default, is_misc, direction, actual_source)
VALUES
  ('3b5e7a00-0317-4c1b-8a50-7ea0507c0002', '3b5e7a00-0317-4c1b-8a50-7ea0507c0001', NULL, NULL,
   'Paid to teams on request', 0, true, false, 'out', 'typed')
ON CONFLICT (id) DO NOTHING;

-- ── 3. One word, one line on a club's year plan ────────────────────────────────────────────────
-- ⚠⚠ THREE FOREIGN KEYS POINT AT A LINE, AND THEY POINT TWO WAYS (read from both snapshots first):
--   · org_budget_periods.budget_line_id          → ON DELETE CASCADE  (a loser's dates would go with it)
--   · rep_cost_allocations.source_budget_line_id → ON DELETE SET NULL (an allocation would lose its line)
--   · rep_team_payment_requests.budget_line_id   → ON DELETE SET NULL (a request would lose its line)
-- All three are re-pointed at the keeper BEFORE any delete. Do not reorder the statements below.
-- The table is held against writes until COMMIT, so no twin can land between the join and the index.

LOCK TABLE public.org_budget_lines IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  g            record;
  ids          uuid[];
  keeper       uuid;
  losers       uuid[];
  merged_total numeric;
  merged_notes text;
  scheduled    numeric;
BEGIN
  FOR g IN
    SELECT org_id, season_year, item_id
      FROM org_budget_lines
     WHERE item_id IS NOT NULL
     GROUP BY 1, 2, 3
    HAVING count(*) > 1
  LOOP
    -- The twins, earliest first: the EARLIEST survives, so an allocation or a bookmark already pointing at it
    -- stays alive. The sum, and the notes joined in the order they were written.
    SELECT array_agg(id ORDER BY created_at, id), sum(total_amount),
           nullif(string_agg(nullif(btrim(coalesce(notes, '')), ''), '; ' ORDER BY created_at, id), '')
      INTO ids, merged_total, merged_notes
      FROM org_budget_lines
     WHERE org_id = g.org_id AND season_year = g.season_year AND item_id = g.item_id;
    keeper := ids[1];
    losers := ids[2:];

    UPDATE org_budget_periods SET budget_line_id = keeper WHERE budget_line_id = ANY (losers);
    UPDATE rep_cost_allocations SET source_budget_line_id = keeper WHERE source_budget_line_id = ANY (losers);
    UPDATE rep_team_payment_requests SET budget_line_id = keeper WHERE budget_line_id = ANY (losers);

    DELETE FROM org_budget_lines WHERE id = ANY (losers);

    UPDATE org_budget_lines
       SET total_amount = merged_total, notes = merged_notes, updated_at = now()
     WHERE id = keeper;

    -- The joined schedule reads in date order, undated last.
    WITH ordered AS (
      SELECT id, row_number() OVER (ORDER BY period_date NULLS LAST, sort_order, id) - 1 AS rn
        FROM org_budget_periods WHERE budget_line_id = keeper
    )
    UPDATE org_budget_periods p SET sort_order = ordered.rn FROM ordered WHERE ordered.id = p.id;

    -- ⚠ The unscheduled remainder becomes a real undated period (the coach's Q4 rule): join a dated
    -- line onto a lump sum and every later save would be refused for not adding up.
    SELECT coalesce(sum(amount), 0) INTO scheduled FROM org_budget_periods WHERE budget_line_id = keeper;
    IF scheduled > 0 AND (merged_total - scheduled) > 0.02 THEN
      INSERT INTO org_budget_periods (budget_line_id, period_label, period_date, amount, sort_order)
      VALUES (keeper, 'No date yet', NULL, round(merged_total - scheduled, 2),
              (SELECT coalesce(max(sort_order), -1) + 1 FROM org_budget_periods WHERE budget_line_id = keeper));
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS org_budget_lines_one_line_per_item
  ON public.org_budget_lines (org_id, season_year, item_id)
  WHERE item_id IS NOT NULL;

COMMENT ON INDEX public.org_budget_lines_one_line_per_item IS
  'One word, one line on a club''s year plan (mig 317, Ask 4a — the coach''s mig-286 rule, rep_budget_lines_one_line_per_item). Planning a word already on the year adds to its line. Partial: a word-less line (written before the plan asked for a word) is not joined.';

-- ── 4. One database step per budget write ──────────────────────────────────────────────────────

-- Allocated, for one line: the teams' shares of EVERY allocation drawn from it (the one definition,
-- lib/club-money-figures.ts `lineAllocated`). Used inside the two steps that must see it under the
-- line's lock; never by a reader.
CREATE OR REPLACE FUNCTION public.club_line_allocated(p_line uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(sum(s.amount), 0)
    FROM rep_allocation_splits s
    JOIN rep_cost_allocations a ON a.id = s.allocation_id
   WHERE a.source_budget_line_id = p_line;
$$;

-- An allocation, its splits, its installments and its link to the line: one step (C11). Refused above
-- what is left on the line, worked out after the line is locked so two allocations a breath apart are
-- counted one after the other. The allocation's total is its teams' shares, never the line's.
-- p_splits: [{ teamId, programYearId, amount, splitMethod, splitValue, paymentSchedule, notes,
--              installments: [{ installmentNumber, amount, dueDate }] }] — validated by the app first;
-- the checks here are the floor, not the form.
CREATE OR REPLACE FUNCTION public.club_allocation_create(
  p_org          uuid,
  p_actor        uuid,
  p_description  text,
  p_source_line  uuid,
  p_source_entry uuid,
  p_splits       jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_line      org_budget_lines%ROWTYPE;
  v_direction text;
  v_allocated numeric;
  v_shares    numeric;
  v_alloc     uuid := gen_random_uuid();
  v_split     jsonb;
  v_inst      jsonb;
  v_split_id  uuid;
  v_team      uuid;
  v_year      uuid;
BEGIN
  IF p_splits IS NULL OR jsonb_typeof(p_splits) <> 'array' OR jsonb_array_length(p_splits) = 0 THEN
    RAISE EXCEPTION 'club_allocation_create: at least one split';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_splits) s WHERE coalesce((s->>'amount')::numeric, 0) <= 0) THEN
    RAISE EXCEPTION 'club_allocation_create: every share above zero';
  END IF;
  SELECT sum((s->>'amount')::numeric) INTO v_shares FROM jsonb_array_elements(p_splits) s;
  IF p_source_line IS NOT NULL AND p_source_entry IS NOT NULL THEN
    RAISE EXCEPTION 'club_allocation_create: a line or an entry, not both';
  END IF;

  -- A general allocation's source: a live line on one of the club's OWN books (3a, C17), held until this
  -- step commits so it cannot be voided underneath it.
  IF p_source_entry IS NOT NULL THEN
    PERFORM 1 FROM accounting_entries e JOIN accounting_ledgers l ON l.id = e.ledger_id
     WHERE e.id = p_source_entry AND l.org_id = p_org
       AND l.entity_type IN ('org', 'tournament', 'league_season') AND e.status <> 'void'
       FOR SHARE OF e;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_source_entry'); END IF;
  END IF;

  IF p_source_line IS NOT NULL THEN
    SELECT * INTO v_line FROM org_budget_lines
     WHERE id = p_source_line AND org_id = p_org
     FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'line_not_found'); END IF;

    -- Only a cost line bills teams. A money-in line (a sponsorship, a grant) has nothing to bill.
    SELECT direction INTO v_direction FROM budget_items WHERE id = v_line.item_id;
    IF v_direction = 'in' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_a_cost_line'); END IF;

    -- A fresh statement after the lock: it sees every allocation committed before this one.
    v_allocated := club_line_allocated(p_source_line);
    IF v_shares > v_line.total_amount - v_allocated + 0.005 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'over_line',
        'planned', v_line.total_amount, 'allocated', v_allocated,
        'left', greatest(v_line.total_amount - v_allocated, 0));
    END IF;
  END IF;

  INSERT INTO rep_cost_allocations
    (id, org_id, description, total_amount, source_entry_id, source_budget_line_id, created_by)
  VALUES
    (v_alloc, p_org, p_description, v_shares, p_source_entry, p_source_line, p_actor);

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    v_team := (v_split->>'teamId')::uuid;
    v_year := (v_split->>'programYearId')::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM rep_program_years y JOIN rep_teams t ON t.id = y.team_id
       WHERE y.id = v_year AND t.id = v_team AND t.org_id = p_org
    ) THEN
      RAISE EXCEPTION 'club_allocation_create: team % and season % are not this club''s', v_team, v_year;
    END IF;

    INSERT INTO rep_allocation_splits
      (allocation_id, team_id, program_year_id, org_id, amount, split_method, split_value, payment_schedule, notes)
    VALUES
      (v_alloc, v_team, v_year, p_org, (v_split->>'amount')::numeric, v_split->>'splitMethod',
       coalesce((v_split->>'splitValue')::numeric, 0), v_split->>'paymentSchedule',
       nullif(btrim(coalesce(v_split->>'notes', '')), ''))
    RETURNING id INTO v_split_id;

    FOR v_inst IN SELECT * FROM jsonb_array_elements(v_split->'installments') LOOP
      INSERT INTO rep_allocation_installments (split_id, installment_number, amount, due_date, org_id, team_id)
      VALUES (v_split_id, (v_inst->>'installmentNumber')::integer, (v_inst->>'amount')::numeric,
              (v_inst->>'dueDate')::date, p_org, v_team);
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'allocationId', v_alloc, 'total', v_shares);
END;
$$;

-- A line's dates, checked (C11; the coach's rep_budget_periods rule): each amount above zero, each with a
-- name, the set adding up to the line's total within $0.02. NULL = they pass. One rule for the add and the
-- save, so the two can never check a line's dates two ways.
CREATE OR REPLACE FUNCTION public.club_budget_periods_refusal(p_periods jsonb, p_total numeric)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_sum   numeric;
BEGIN
  IF jsonb_typeof(p_periods) <> 'array' THEN
    RAISE EXCEPTION 'club_budget_periods_refusal: the dates must be an array';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_periods) p
              WHERE coalesce((p->>'amount')::numeric, 0) <= 0) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_period_amount');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_periods) p
              WHERE nullif(btrim(coalesce(p->>'label', '')), '') IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_period_label');
  END IF;
  SELECT count(*), coalesce(sum((p->>'amount')::numeric), 0) INTO v_count, v_sum
    FROM jsonb_array_elements(p_periods) p;
  IF v_count > 0 AND abs(v_sum - p_total) > 0.02 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'periods_dont_add_up', 'periodsTotal', v_sum, 'lineTotal', p_total);
  END IF;
  RETURN NULL;
END;
$$;

-- A line, saved in ONE step and checked together (C11): its money, its word and its words. Every argument
-- NULL keeps what is there, so an edit of any part goes through the same lock and the same checks.
--   p_total   NULL keeps the total. A CHANGED total below what is allocated is refused, with the figure
--             (an unchanged total is never refused: a line already under its allocations — billed
--             before this rule — can still have its dates or notes saved, and can only go up).
--   p_periods NULL keeps the periods; [] makes the line a lump sum; otherwise a FULL REPLACE, checked
--             by `club_budget_periods_refusal`. Kept dates are checked against a CHANGED total only: a
--             line whose dates stopped adding up before this rule can still have its notes or word saved.
--   p_expect  the updated_at the caller read, or NULL. A line that changed since is refused, so a
--             joined word (two adds a breath apart) is never lost to a stale read.
--   p_item    NULL keeps the word. Another word brings its own category (never the caller's). A word
--             already on the line's year is refused, naming that line (`word_on_plan`: re-filing never
--             silently joins two lines). A line teams are billed from stays a COST: under a money-in
--             word, what the teams owe would count as planned revenue twice (`allocated_line_is_a_cost`).
--   p_fields  { description?, notes?, sortOrder? }: a key that is present is written ('' clears the
--             notes). The app checks the lengths; the floor here is a description that is not blank.
DROP FUNCTION IF EXISTS public.club_budget_line_save(uuid, uuid, numeric, jsonb, timestamptz);

CREATE OR REPLACE FUNCTION public.club_budget_line_save(
  p_org     uuid,
  p_line    uuid,
  p_total   numeric,
  p_periods jsonb,
  p_expect  timestamptz,
  p_item    uuid,
  p_fields  jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_line      org_budget_lines%ROWTYPE;
  v_fields    jsonb := coalesce(p_fields, '{}'::jsonb);
  v_total     numeric;
  v_allocated numeric;
  v_count     integer;
  v_sum       numeric;
  v_refusal   jsonb;
  v_category  uuid;
  v_direction text;
  v_holder    uuid;
  v_now       timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_line FROM org_budget_lines
   WHERE id = p_line AND org_id = p_org
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;

  IF p_expect IS NOT NULL AND v_line.updated_at <> p_expect THEN
    RETURN jsonb_build_object('ok', false, 'code', 'line_changed');
  END IF;

  v_total := round(coalesce(p_total, v_line.total_amount), 2);
  IF v_total <= 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_total'); END IF;

  IF p_total IS NOT NULL AND v_total <> v_line.total_amount THEN
    v_allocated := club_line_allocated(p_line);
    IF v_total < v_allocated - 0.005 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'below_allocated', 'allocated', v_allocated);
    END IF;
  END IF;

  IF p_item IS NOT NULL AND p_item IS DISTINCT FROM v_line.item_id THEN
    SELECT category_id, direction INTO v_category, v_direction FROM budget_items WHERE id = p_item;
    IF NOT FOUND THEN RAISE EXCEPTION 'club_budget_line_save: no word %', p_item; END IF;
    SELECT id INTO v_holder FROM org_budget_lines
     WHERE org_id = p_org AND season_year = v_line.season_year AND item_id = p_item AND id <> p_line;
    IF FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'word_on_plan', 'existingLineId', v_holder); END IF;
    IF v_direction = 'in' AND EXISTS (SELECT 1 FROM rep_cost_allocations WHERE source_budget_line_id = p_line) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'allocated_line_is_a_cost');
    END IF;
  END IF;

  IF v_fields ? 'description' AND nullif(btrim(coalesce(v_fields->>'description', '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_description');
  END IF;

  IF p_periods IS NOT NULL THEN
    v_refusal := club_budget_periods_refusal(p_periods, v_total);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;
  ELSIF p_total IS NOT NULL AND v_total <> v_line.total_amount THEN
    -- The dates stay; a changed total must still be what they add up to.
    SELECT count(*), coalesce(sum(amount), 0) INTO v_count, v_sum
      FROM org_budget_periods WHERE budget_line_id = p_line;
    IF v_count > 0 AND abs(v_sum - v_total) > 0.02 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'periods_dont_add_up',
        'periodsTotal', v_sum, 'lineTotal', v_total);
    END IF;
  END IF;

  BEGIN
    UPDATE org_budget_lines SET
      total_amount = v_total,
      item_id      = coalesce(p_item, item_id),
      category_id  = coalesce(v_category, category_id),
      description  = CASE WHEN v_fields ? 'description' THEN btrim(v_fields->>'description') ELSE description END,
      notes        = CASE WHEN v_fields ? 'notes' THEN nullif(btrim(coalesce(v_fields->>'notes', '')), '') ELSE notes END,
      sort_order   = CASE WHEN v_fields ? 'sortOrder' THEN coalesce((v_fields->>'sortOrder')::integer, 0) ELSE sort_order END,
      updated_at   = v_now
     WHERE id = p_line;
  EXCEPTION WHEN unique_violation THEN
    -- The word was planned on this year in the same instant: the line that holds it now.
    SELECT id INTO v_holder FROM org_budget_lines
     WHERE org_id = p_org AND season_year = v_line.season_year AND item_id = p_item AND id <> p_line;
    RETURN jsonb_build_object('ok', false, 'code', 'word_on_plan', 'existingLineId', v_holder);
  END;

  IF p_periods IS NOT NULL THEN
    DELETE FROM org_budget_periods WHERE budget_line_id = p_line;
    INSERT INTO org_budget_periods (budget_line_id, period_label, period_date, amount, sort_order)
    SELECT p_line, btrim(t.p->>'label'), nullif(t.p->>'date', '')::date, round((t.p->>'amount')::numeric, 2),
           (t.ord - 1)::integer
      FROM jsonb_array_elements(p_periods) WITH ORDINALITY AS t(p, ord);
  END IF;

  RETURN jsonb_build_object('ok', true, 'updatedAt', v_now, 'total', v_total);
END;
$$;

-- Remove a line. Refused while an allocation is drawn from it (the teams' bills name it). Under the line's
-- lock, the same lock an allocation takes: one made a breath before is seen here, and one made a breath
-- after finds no line.
CREATE OR REPLACE FUNCTION public.club_budget_line_delete(p_org uuid, p_line uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM org_budget_lines WHERE id = p_line AND org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF EXISTS (SELECT 1 FROM rep_cost_allocations WHERE source_budget_line_id = p_line) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'has_allocations');
  END IF;
  DELETE FROM org_budget_lines WHERE id = p_line;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Plan a word on a year: the line and its dates in ONE step, so no line is ever made without the dates it
-- was asked with (and nothing has to be taken back out). Under the YEAR's lock — the one a roll takes — so
-- a roll can never land on a year a line was added to in the same instant. A word already on the year is
-- refused with the line that holds it (`word_on_plan`); the app then ADDS to that line (one word, one line).
CREATE OR REPLACE FUNCTION public.club_budget_line_add(
  p_org         uuid,
  p_year        integer,
  p_item        uuid,
  p_description text,
  p_total       numeric,
  p_notes       text,
  p_sort        integer,
  p_periods     jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_line     uuid := gen_random_uuid();
  v_total    numeric := round(p_total, 2);
  v_category uuid;
  v_holder   uuid;
  v_refusal  jsonb;
BEGIN
  IF v_total IS NULL OR v_total <= 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_total'); END IF;
  IF nullif(btrim(coalesce(p_description, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_description');
  END IF;
  SELECT category_id INTO v_category FROM budget_items WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'club_budget_line_add: no word %', p_item; END IF;
  IF p_periods IS NOT NULL THEN
    v_refusal := club_budget_periods_refusal(p_periods, v_total);
    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('club_budget_year:' || p_org::text || ':' || p_year::text, 0));

  SELECT id INTO v_holder FROM org_budget_lines WHERE org_id = p_org AND season_year = p_year AND item_id = p_item;
  IF FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'word_on_plan', 'existingLineId', v_holder); END IF;

  INSERT INTO org_budget_lines (id, org_id, season_year, category_id, item_id, description, total_amount, notes, sort_order)
  VALUES (v_line, p_org, p_year, v_category, p_item, btrim(p_description), v_total,
          nullif(btrim(coalesce(p_notes, '')), ''), coalesce(p_sort, 0));

  IF p_periods IS NOT NULL THEN
    INSERT INTO org_budget_periods (budget_line_id, period_label, period_date, amount, sort_order)
    SELECT v_line, btrim(t.p->>'label'), nullif(t.p->>'date', '')::date, round((t.p->>'amount')::numeric, 2),
           (t.ord - 1)::integer
      FROM jsonb_array_elements(p_periods) WITH ORDINALITY AS t(p, ord);
  END IF;

  RETURN jsonb_build_object('ok', true, 'lineId', v_line);
END;
$$;

-- Start a year from another year's plan (C10's planning half): every line and its periods, the dates
-- moved on by the years between; nothing billed or collected comes with it (allocations stay on the
-- year they were drawn from). Refused when the target year already has a line — a plan is started
-- once, never merged into by a roll.
CREATE OR REPLACE FUNCTION public.club_budget_roll_year(p_org uuid, p_from integer, p_to integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_years integer := p_to - p_from;
  v_count integer := 0;
  r       record;
  v_new   uuid;
BEGIN
  IF v_years < 1 THEN RAISE EXCEPTION 'club_budget_roll_year: the target year must follow the source'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('club_budget_year:' || p_org::text || ':' || p_to::text, 0));

  IF EXISTS (SELECT 1 FROM org_budget_lines WHERE org_id = p_org AND season_year = p_to) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'year_has_lines');
  END IF;

  BEGIN
    FOR r IN
      SELECT * FROM org_budget_lines
       WHERE org_id = p_org AND season_year = p_from
       ORDER BY sort_order, created_at, id
    LOOP
      v_new := gen_random_uuid();
      INSERT INTO org_budget_lines (id, org_id, season_year, category_id, item_id, description, total_amount, notes, sort_order)
      VALUES (v_new, p_org, p_to, r.category_id, r.item_id, r.description, r.total_amount, r.notes, r.sort_order);
      INSERT INTO org_budget_periods (budget_line_id, period_label, period_date, amount, sort_order)
      SELECT v_new, period_label, (period_date + make_interval(years => v_years))::date, amount, sort_order
        FROM org_budget_periods WHERE budget_line_id = r.id;
      v_count := v_count + 1;
    END LOOP;
  EXCEPTION WHEN unique_violation THEN
    -- A line added to the target year in the same instant: that year is no longer empty.
    RETURN jsonb_build_object('ok', false, 'code', 'year_has_lines');
  END;

  IF v_count = 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'nothing_to_copy'); END IF;
  RETURN jsonb_build_object('ok', true, 'lines', v_count);
END;
$$;

-- A set of books' sums in ONE SQL aggregate (C14). The window (p_from / p_to, inclusive, either may be
-- NULL) bounds the posted and pending sums; `balance` is ALL-TIME, posted in − posted out — the one
-- balance scope (lib/club-money-figures.ts `bookBalance`). Void moves nothing; pending moves no balance.
CREATE OR REPLACE FUNCTION public.club_book_totals(p_ledgers uuid[], p_from date, p_to date)
RETURNS TABLE (
  ledger_id   uuid,
  posted_in   numeric,
  posted_out  numeric,
  income      numeric,
  expense     numeric,
  pending_in  numeric,
  pending_out numeric,
  balance     numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT l.id,
         coalesce(sum(e.amount) FILTER (WHERE e.status = 'posted'  AND w.in_window AND e.entry_type IN ('income', 'transfer_in')), 0),
         coalesce(sum(e.amount) FILTER (WHERE e.status = 'posted'  AND w.in_window AND e.entry_type IN ('expense', 'transfer_out')), 0),
         coalesce(sum(e.amount) FILTER (WHERE e.status = 'posted'  AND w.in_window AND e.entry_type = 'income'), 0),
         coalesce(sum(e.amount) FILTER (WHERE e.status = 'posted'  AND w.in_window AND e.entry_type = 'expense'), 0),
         coalesce(sum(e.amount) FILTER (WHERE e.status = 'pending' AND w.in_window AND e.entry_type = 'income'), 0),
         coalesce(sum(e.amount) FILTER (WHERE e.status = 'pending' AND w.in_window AND e.entry_type = 'expense'), 0),
         coalesce(sum(CASE WHEN e.entry_type IN ('income', 'transfer_in') THEN e.amount ELSE -e.amount END)
                    FILTER (WHERE e.status = 'posted'), 0)
    FROM unnest(p_ledgers) AS l(id)
    LEFT JOIN accounting_entries e ON e.ledger_id = l.id
   CROSS JOIN LATERAL (SELECT (p_from IS NULL OR e.entry_date >= p_from)
                          AND (p_to IS NULL OR e.entry_date <= p_to)) AS w(in_window)
   GROUP BY l.id;
$$;

-- Server-only (mig 311's rule): the service role calls these; the browser key cannot.
REVOKE ALL ON FUNCTION
  public.club_line_allocated(uuid),
  public.club_allocation_create(uuid, uuid, text, uuid, uuid, jsonb),
  public.club_budget_periods_refusal(jsonb, numeric),
  public.club_budget_line_add(uuid, integer, uuid, text, numeric, text, integer, jsonb),
  public.club_budget_line_save(uuid, uuid, numeric, jsonb, timestamptz, uuid, jsonb),
  public.club_budget_line_delete(uuid, uuid),
  public.club_budget_roll_year(uuid, integer, integer),
  public.club_book_totals(uuid[], date, date)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.club_line_allocated(uuid),
  public.club_allocation_create(uuid, uuid, text, uuid, uuid, jsonb),
  public.club_budget_periods_refusal(jsonb, numeric),
  public.club_budget_line_add(uuid, integer, uuid, text, numeric, text, integer, jsonb),
  public.club_budget_line_save(uuid, uuid, numeric, jsonb, timestamptz, uuid, jsonb),
  public.club_budget_line_delete(uuid, uuid),
  public.club_budget_roll_year(uuid, integer, integer),
  public.club_book_totals(uuid[], date, date)
  TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'accounting_entries'
--      AND column_name IN ('budget_category_id', 'budget_item_id');                               -- 2 rows
--   SELECT c.name, i.name, c.scope, i.direction FROM budget_items i JOIN budget_categories c ON c.id = i.category_id
--    WHERE i.id = '3b5e7a00-0317-4c1b-8a50-7ea0507c0002';          -- Team support | Paid to teams on request | org | out
--   SELECT to_regclass('public.org_budget_lines_one_line_per_item');                                -- not null
--   SELECT proname, pronargs FROM pg_proc WHERE proname IN ('club_line_allocated', 'club_allocation_create',
--     'club_budget_periods_refusal', 'club_budget_line_add', 'club_budget_line_save', 'club_budget_line_delete',
--     'club_budget_roll_year', 'club_book_totals') ORDER BY 1;   -- 8 rows; club_budget_line_save has 7 arguments
--   SELECT grantee FROM information_schema.routine_privileges
--    WHERE routine_name = 'club_allocation_create' ORDER BY 1;                         -- postgres, service_role
