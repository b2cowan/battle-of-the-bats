-- Migration 318: the club keeps a fiscal year.
-- (Club Tier Stage 3c, session 1 — the server half. Owner rulings 2026-10-07: "agree with this
--  recommendation and also all recommendations on the mockup" — Asks 1–7, 8a–8d, Ask 9 ("fiscal
--  year"), S3C-11 — and the build session's four calls the same day ("go ahead").
--  Plan: docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md §6 Stage 3c; build prompt
--  CLUB_TIER_STAGE3C_SERVER_PROMPT.md.)
--
-- THE CASE. A club's year was the calendar year, named by its number, and nothing ever closed it:
-- a line could be dated into any year at all, so last year's closing figure moved with every late
-- correction and the board report printed this week could differ from the one the board reads.
-- A plan line keyed on a four-digit year, which a change of first month would make two years share
-- (S3C-08). And on the coach's side, a club bill paid after its season closed landed in the CLOSED
-- season's books (S3C-11), moving a record the coach's own rules say never moves.
--
-- WHAT THIS ADDS
--   1. THE FISCAL YEAR. The club's first month (`organizations.fiscal_first_month`, January by
--      default — every existing club reads exactly as before) and a row per fiscal year
--      (`org_fiscal_years`): its name, first and last day, its close (who, when, the closing balance it
--      locked, and what was still open at the close) and its reopenings (`org_fiscal_year_reopenings`:
--      who, when, why — a history, never one overwritten field). A row is made when something needs it
--      (a plan line, a name, a close); a year with no row is worked out from the rows and the first
--      month, the same way here (`club_fiscal_year_ensure`) and in lib/club-fiscal-year.ts.
--      Invariants, in the database: per club, years never overlap and never leave a gap; whole months,
--      one to twelve; the newest year ends the month before the club's first month (so every year after
--      it starts on that month); two years never share a name; a closed year's name, months and closing
--      never change.
--   2. THE PLAN KEYS ON THE YEAR'S ROW (call 3). `org_budget_lines.fiscal_year_id`, backfilled from
--      `season_year` (every existing club is January, so year N is Jan 1–Dec 31 of N, exactly as it
--      read). One word, one line is now per fiscal year: `org_budget_lines_one_line_per_item` (the year
--      number) is REPLACED by `org_budget_lines_one_word_per_fiscal_year`. ⚠ `season_year` STAYS this
--      stage, kept in step by a trigger from the year's first day; dropping it is its own migration,
--      applied to prod LAST, after the code that stops reading it.
--   3. THE LOCK (Asks 1, 8d; call 2): ONE rule in the database, so every writer is covered. A club's
--      books are CLOSED THROUGH the last day of its newest closed year (years close oldest first, so the
--      closed years are one unbroken stretch). On a book the CLUB owns (its own, a tournament's, the
--      house league's — never a team's), a line dated on or before that day can't be added, changed,
--      voided or removed, and no line can be dated into it. The exceptions, each named:
--        · a PENDING line dated in a closed year may become POSTED re-dated into an open year — it
--          counted nowhere in the closed year; the day it was written is kept (`written_on`);
--        · a RELABEL — a line's payee or budget word moving, which is what a payee merge and a budget
--          word merge do across every year — moves no money, so it is allowed; a person re-filing one
--          closed line is refused by the route, before the database is asked;
--        · a whole club or book being removed (a fixture reset, a platform wipe) takes its lines with it.
--      The plan of a closed year (its lines and their dates) and an allocation counting in a closed year
--      (its amounts, teams and due dates — never its installments' payments, which stay receivable, and
--      never the coach's own filing of the bill) are locked the same way.
--   4. CLOSE, REOPEN, RENAME AND THE FIRST-MONTH CHANGE: one database step each.
--   5. THE SEASON THAT CARRIES A CLUB PAYMENT (S3C-11, call 1). `rep_allocation_installments.
--      carried_by_program_year_id`: the team's season RUNNING when the payment was recorded (the coach's
--      "We've sent it", or the club's received), whatever date is typed. Kept by a trigger on every
--      writer. A payment recorded while the team has no running season waits for the next season to run
--      (a new one, or the closed one reopened), which carries it when it starts. Backfilled with each
--      payment's own bill's season, so NO FIGURE MOVES at migration.
--   6. "EVENLY", a fourth way to split a bill (Ask 6): `rep_allocation_splits.split_method` gains 'even'.
--
-- ⚠ PROD-OWED, and ORDER-CRITICAL: the code that ships with this reads the fiscal-year rows and the
-- plan's new key, writes through the new functions (four of 317's change signature), and keys every
-- coach Cash on hand read on the carrying season. Apply to prod BEFORE promoting that code. The
-- functions and triggers are invisible to `check:migrations`, so MANUAL_PROD_STEPS.json carries this
-- file as `pending`.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, guarded constraints, CREATE OR
-- REPLACE, DROP ... IF EXISTS before each trigger.

BEGIN;

-- ── 1. The first month ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS fiscal_first_month smallint NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_fiscal_first_month_check') THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_fiscal_first_month_check CHECK (fiscal_first_month BETWEEN 1 AND 12);
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.fiscal_first_month IS
  'The month the club''s fiscal year starts (1 = January, the default: every club reads calendar years until it sets one). Club Tier Stage 3c, mig 318. Changed only by club_fiscal_first_month_set (one step, refused after the first close); the newest org_fiscal_years row always ends the month before it.';

-- ── 2. The fiscal years ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_fiscal_years (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  first_day        date NOT NULL,
  last_day         date NOT NULL,
  closed_at        timestamptz,
  closed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closing_balance  numeric(12,2),
  closing_snapshot jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_fiscal_years_name_check CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 40),
  -- Whole months: it starts on a 1st and ends on a month's last day.
  CONSTRAINT org_fiscal_years_whole_months CHECK (
    extract(day FROM first_day) = 1
    AND last_day = (date_trunc('month', last_day) + interval '1 month - 1 day')::date
  ),
  -- One to twelve months (a short year is the one a change of first month makes).
  CONSTRAINT org_fiscal_years_span CHECK (
    last_day >= first_day AND last_day <= (first_day + interval '12 months - 1 day')::date
  ),
  -- A close is its moment and its balance together, or neither.
  CONSTRAINT org_fiscal_years_close_whole CHECK ((closed_at IS NULL) = (closing_balance IS NULL)),
  -- Deferred, so the first-month change can re-span years inside its one step.
  CONSTRAINT org_fiscal_years_one_name  UNIQUE (org_id, name)      DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT org_fiscal_years_one_start UNIQUE (org_id, first_day) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS org_fiscal_years_closed_by_idx ON public.org_fiscal_years (closed_by) WHERE closed_by IS NOT NULL;

ALTER TABLE public.org_fiscal_years ENABLE ROW LEVEL SECURITY;
-- Server-only (mig 311's rule): no policies, nothing to anon/authenticated.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_fiscal_years TO service_role;

COMMENT ON TABLE public.org_fiscal_years IS
  'A club''s fiscal year (Club Tier Stage 3c, mig 318; Ask 9 — the club side''s word, never the coach''s). A row exists once something needs it: a plan line (org_budget_lines.fiscal_year_id), a name, a close. A year with no row is worked out from the rows and organizations.fiscal_first_month (club_fiscal_year_ensure; lib/club-fiscal-year.ts, its pure twin). Per club the rows are contiguous and never overlap, whole months, one to twelve; the newest ends the month before the first month. The club''s books are closed through the last_day of its newest closed row (club_books_closed_through) — years close oldest first, so the closed rows are one unbroken stretch.';
COMMENT ON COLUMN public.org_fiscal_years.name IS
  'Its name: the year''s number for a January–December year ("2026"), "2026–27" (en dash) for one that crosses a New Year — club_fiscal_year_name. An open year''s name can be changed (unique per club); a closed one''s can''t. Every read and export prints this, never a hand-built label.';
COMMENT ON COLUMN public.org_fiscal_years.first_day IS
  'Its first day (a 1st). Also the year''s key in an address (?year=2026-09-01): it survives a rename and is never the name. A year that has begun keeps its months; a change of first month shortens the NEXT year.';
COMMENT ON COLUMN public.org_fiscal_years.last_day IS 'Its last day (a month''s last day), inclusive.';
COMMENT ON COLUMN public.org_fiscal_years.closed_at IS
  'When it was closed; NULL while open (also after a Reopen — the reopenings history keeps the earlier close). Closing locks every line dated in it on every book the club owns, and its plan.';
COMMENT ON COLUMN public.org_fiscal_years.closed_by IS 'Who closed it.';
COMMENT ON COLUMN public.org_fiscal_years.closing_balance IS
  'The closing balance the close locked: every book the club owns (never a team''s), posted lines through last_day (club_book_totals). The next year opens on it, locked. NULL while open.';
COMMENT ON COLUMN public.org_fiscal_years.closing_snapshot IS
  'What was still open at the close, as the close question showed it — installments still owed by the teams, requests waiting on the club, lines not filed under a word, cheques not cleared (each a count and a total) — and each team''s standing with the club at the close (billed · collected · still owed). The year-end report reads these as they were; the live figures keep moving as last year''s bills are paid. NULL while open.';

CREATE TABLE IF NOT EXISTS public.org_fiscal_year_reopenings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id       uuid NOT NULL REFERENCES public.org_fiscal_years(id) ON DELETE CASCADE,
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reopened_at          timestamptz NOT NULL DEFAULT now(),
  reopened_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason               text NOT NULL CHECK (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 500),
  was_closed_at        timestamptz NOT NULL,
  was_closed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  was_closing_balance  numeric(12,2) NOT NULL,
  was_closing_snapshot jsonb
);

CREATE INDEX IF NOT EXISTS org_fiscal_year_reopenings_year_idx ON public.org_fiscal_year_reopenings (fiscal_year_id, reopened_at);
CREATE INDEX IF NOT EXISTS org_fiscal_year_reopenings_org_idx ON public.org_fiscal_year_reopenings (org_id);
CREATE INDEX IF NOT EXISTS org_fiscal_year_reopenings_by_idx ON public.org_fiscal_year_reopenings (reopened_by) WHERE reopened_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_fiscal_year_reopenings_was_by_idx ON public.org_fiscal_year_reopenings (was_closed_by) WHERE was_closed_by IS NOT NULL;

ALTER TABLE public.org_fiscal_year_reopenings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_fiscal_year_reopenings TO service_role;

COMMENT ON TABLE public.org_fiscal_year_reopenings IS
  'Every Reopen of a closed fiscal year (Ask 3, mig 318): who, when, why, and the close it undid (was_*), so a re-close can say what changed since the first close. Only the latest closed year can be reopened; the reason is required.';
COMMENT ON COLUMN public.org_fiscal_year_reopenings.reason IS 'Why it was reopened, as the person wrote it (required, kept with the year).';
COMMENT ON COLUMN public.org_fiscal_year_reopenings.was_closing_balance IS 'The closing balance the reopened close had locked.';
COMMENT ON COLUMN public.org_fiscal_year_reopenings.was_closing_snapshot IS 'The reopened close''s snapshot (org_fiscal_years.closing_snapshot), kept.';

-- The name rule: the year's number for a January–December year, "2026–27" for one that crosses a
-- New Year (en dash, the second year's last two digits). Never collides on its own: two years with one
-- name would overlap.
CREATE OR REPLACE FUNCTION public.club_fiscal_year_name(p_first date, p_last date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN extract(year FROM p_first) = extract(year FROM p_last) THEN extract(year FROM p_first)::int::text
    ELSE extract(year FROM p_first)::int::text || '–' || lpad((extract(year FROM p_last)::int % 100)::text, 2, '0')
  END;
$$;

-- The rule's name, or — when a renamed year already holds it — the same name with a number after it.
CREATE OR REPLACE FUNCTION public.club_fiscal_year_free_name(p_org uuid, p_first date, p_last date, p_except uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_base text := club_fiscal_year_name(p_first, p_last);
  v_name text := v_base;
  v_n    integer := 1;
BEGIN
  WHILE EXISTS (SELECT 1 FROM org_fiscal_years WHERE org_id = p_org AND lower(name) = lower(v_name)
                  AND id IS DISTINCT FROM p_except) LOOP
    v_n := v_n + 1;
    v_name := v_base || ' (' || v_n || ')';
  END LOOP;
  RETURN v_name;
END;
$$;

-- The chain: contiguous, no overlap, the newest ending the month before the club's first month.
CREATE OR REPLACE FUNCTION public.club_fiscal_years_chain_check(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month     smallint;
  r           record;
  v_prev_last date;
  v_last_name text;
BEGIN
  SELECT fiscal_first_month INTO v_month FROM organizations WHERE id = p_org;
  IF NOT FOUND THEN RETURN; END IF;   -- the club is being removed
  FOR r IN SELECT name, first_day, last_day FROM org_fiscal_years WHERE org_id = p_org ORDER BY first_day LOOP
    IF v_prev_last IS NOT NULL AND r.first_day <> v_prev_last + 1 THEN
      RAISE EXCEPTION 'fiscal_years_not_contiguous: % must start the day after the year before it ends (%)', r.name, v_prev_last;
    END IF;
    v_prev_last := r.last_day;
    v_last_name := r.name;
  END LOOP;
  IF v_prev_last IS NOT NULL AND extract(month FROM v_prev_last + 1)::int <> v_month THEN
    RAISE EXCEPTION 'fiscal_years_off_month: the newest year (%) must end the month before the club''s first month (%)', v_last_name, v_month;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_fiscal_years_chain_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    PERFORM club_fiscal_years_chain_check(NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM club_fiscal_years_chain_check(OLD.org_id);
  ELSE
    PERFORM club_fiscal_years_chain_check(NEW.org_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS org_fiscal_years_chain ON public.org_fiscal_years;
CREATE CONSTRAINT TRIGGER org_fiscal_years_chain
  AFTER INSERT OR UPDATE OR DELETE ON public.org_fiscal_years
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.org_fiscal_years_chain_trigger();

DROP TRIGGER IF EXISTS organizations_fiscal_first_month_chain ON public.organizations;
CREATE CONSTRAINT TRIGGER organizations_fiscal_first_month_chain
  AFTER UPDATE OF fiscal_first_month ON public.organizations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.fiscal_first_month IS DISTINCT FROM NEW.fiscal_first_month)
  EXECUTE FUNCTION public.org_fiscal_years_chain_trigger();

-- A closed year's name, months and closing never change, and it is never removed (only its club is). A year is
-- CLOSED and REOPENED only by its own step (club_fiscal_year_close / _reopen, which say so for the one write):
-- its close (closed_at, closed_by, closing_balance, closing_snapshot) is written nowhere else, by any writer.
CREATE OR REPLACE FUNCTION public.org_fiscal_years_closed_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.closed_at IS NOT NULL AND EXISTS (SELECT 1 FROM organizations WHERE id = OLD.org_id) THEN
      RAISE EXCEPTION 'year_closed: % is closed and can''t be removed', OLD.name;
    END IF;
    RETURN OLD;
  END IF;
  IF current_setting('club.fiscal_step', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' AND (NEW.closed_at, NEW.closed_by, NEW.closing_balance, NEW.closing_snapshot) IS DISTINCT FROM (NULL::timestamptz, NULL::uuid, NULL::numeric, NULL::jsonb) THEN
      RAISE EXCEPTION 'year_closed: a fiscal year is closed only by its own step';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.closed_at, NEW.closed_by, NEW.closing_balance, NEW.closing_snapshot)
       IS DISTINCT FROM (OLD.closed_at, OLD.closed_by, OLD.closing_balance, OLD.closing_snapshot) THEN
      RAISE EXCEPTION 'year_closed: % is closed and reopened only by its own step', OLD.name;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF OLD.closed_at IS NOT NULL AND NEW.closed_at IS NOT NULL
     AND (NEW.org_id, NEW.name, NEW.first_day, NEW.last_day, NEW.closing_balance, NEW.closed_at)
         IS DISTINCT FROM (OLD.org_id, OLD.name, OLD.first_day, OLD.last_day, OLD.closing_balance, OLD.closed_at) THEN
    RAISE EXCEPTION 'year_closed: % is closed; its name, months and closing can''t change', OLD.name;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_fiscal_years_closed_guard ON public.org_fiscal_years;
CREATE TRIGGER org_fiscal_years_closed_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.org_fiscal_years
  FOR EACH ROW EXECUTE FUNCTION public.org_fiscal_years_closed_guard();

-- THE ONE WAY TO FIND A YEAR'S ROW: the fiscal year p_day falls in, made (with every year between it and
-- the rows) when it has none. No rows: the year from the club's first month. After the newest row: twelve-
-- month years from the day after it. Before the oldest: twelve-month years ending the day before it.
-- lib/club-fiscal-year.ts `fiscalYearOf` is its pure twin; check:club-money-atomicity holds the two equal.
CREATE OR REPLACE FUNCTION public.club_fiscal_year_ensure(p_org uuid, p_day date)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id     uuid;
  v_month  smallint;
  v_oldest date;
  v_newest date;
  v_first  date;
  v_last   date;
  v_steps  integer := 0;
BEGIN
  IF p_day IS NULL OR p_day < DATE '1990-01-01' OR p_day > DATE '2199-12-31' THEN
    RAISE EXCEPTION 'club_fiscal_year_ensure: % is outside the years a club keeps', p_day;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('club_fiscal_years:' || p_org::text, 0));

  SELECT id INTO v_id FROM org_fiscal_years WHERE org_id = p_org AND p_day BETWEEN first_day AND last_day;
  IF FOUND THEN RETURN v_id; END IF;

  SELECT fiscal_first_month INTO v_month FROM organizations WHERE id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'club_fiscal_year_ensure: no club %', p_org; END IF;
  SELECT min(first_day), max(last_day) INTO v_oldest, v_newest FROM org_fiscal_years WHERE org_id = p_org;

  IF v_oldest IS NULL THEN
    v_first := make_date(extract(year FROM p_day)::int - CASE WHEN extract(month FROM p_day) < v_month THEN 1 ELSE 0 END, v_month, 1);
    v_last  := (v_first + interval '12 months - 1 day')::date;
    INSERT INTO org_fiscal_years (org_id, name, first_day, last_day)
    VALUES (p_org, club_fiscal_year_free_name(p_org, v_first, v_last), v_first, v_last)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  IF p_day > v_newest THEN
    v_first := v_newest + 1;
    LOOP
      v_steps := v_steps + 1;
      v_last := (v_first + interval '12 months - 1 day')::date;
      INSERT INTO org_fiscal_years (org_id, name, first_day, last_day)
      VALUES (p_org, club_fiscal_year_free_name(p_org, v_first, v_last), v_first, v_last)
      RETURNING id INTO v_id;
      EXIT WHEN p_day <= v_last OR v_steps > 220;
      v_first := v_last + 1;
    END LOOP;
  ELSE
    v_last := v_oldest - 1;
    LOOP
      v_steps := v_steps + 1;
      v_first := (v_last + 1 - interval '12 months')::date;
      INSERT INTO org_fiscal_years (org_id, name, first_day, last_day)
      VALUES (p_org, club_fiscal_year_free_name(p_org, v_first, v_last), v_first, v_last)
      RETURNING id INTO v_id;
      EXIT WHEN p_day >= v_first OR v_steps > 220;
      v_last := v_first - 1;
    END LOOP;
  END IF;
  RETURN v_id;
END;
$$;

-- The row itself (made when needed). ⚠ Read a year through THIS in a FROM, never `WHERE id =
-- club_fiscal_year_ensure(...)`: a volatile call in a WHERE runs once per row scanned.
CREATE OR REPLACE FUNCTION public.club_fiscal_year_row(p_org uuid, p_day date)
RETURNS public.org_fiscal_years
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id  uuid;
  v_row org_fiscal_years%ROWTYPE;
BEGIN
  v_id := club_fiscal_year_ensure(p_org, p_day);
  SELECT * INTO v_row FROM org_fiscal_years WHERE id = v_id;
  RETURN v_row;
END;
$$;

-- The club's books are closed through this day: the last day of its newest closed year (NULL: none).
CREATE OR REPLACE FUNCTION public.club_books_closed_through(p_org uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT max(last_day) FROM org_fiscal_years WHERE org_id = p_org AND closed_at IS NOT NULL;
$$;

-- Is this year's row locked (inside the closed stretch)?
CREATE OR REPLACE FUNCTION public.club_fiscal_year_locked(p_year uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT y.last_day <= club_books_closed_through(y.org_id) FROM org_fiscal_years y WHERE y.id = p_year), false);
$$;

-- ── 3. The plan keys on the year's row (call 3) ─────────────────────────────────────────────────

ALTER TABLE public.org_budget_lines
  ADD COLUMN IF NOT EXISTS fiscal_year_id uuid REFERENCES public.org_fiscal_years(id);

-- Backfill: every club today is a January club, so a line's season_year N is the year Jan 1–Dec 31 N. The
-- chain must be unbroken, so every year between a club's first and last plan year gets its row.
DO $$
DECLARE
  g record;
  y integer;
BEGIN
  FOR g IN SELECT org_id, min(season_year) AS lo, max(season_year) AS hi
             FROM org_budget_lines WHERE fiscal_year_id IS NULL GROUP BY org_id LOOP
    FOR y IN g.lo .. g.hi LOOP
      INSERT INTO org_fiscal_years (org_id, name, first_day, last_day)
      SELECT g.org_id, y::text, make_date(y, 1, 1), make_date(y, 12, 31)
       WHERE NOT EXISTS (SELECT 1 FROM org_fiscal_years WHERE org_id = g.org_id AND first_day = make_date(y, 1, 1));
    END LOOP;
  END LOOP;
  UPDATE org_budget_lines b SET fiscal_year_id = f.id
    FROM org_fiscal_years f
   WHERE b.fiscal_year_id IS NULL AND f.org_id = b.org_id AND f.first_day = make_date(b.season_year, 1, 1);
END $$;

ALTER TABLE public.org_budget_lines ALTER COLUMN fiscal_year_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS org_budget_lines_fiscal_year_idx ON public.org_budget_lines (fiscal_year_id);

-- One word, one line, per FISCAL YEAR (the year number can't stay unique: S3C-08).
DROP INDEX IF EXISTS public.org_budget_lines_one_line_per_item;
CREATE UNIQUE INDEX IF NOT EXISTS org_budget_lines_one_word_per_fiscal_year
  ON public.org_budget_lines (fiscal_year_id, item_id)
  WHERE item_id IS NOT NULL;

COMMENT ON INDEX public.org_budget_lines_one_word_per_fiscal_year IS
  'One word, one line on a club''s fiscal-year plan (mig 318; replaces mig 317''s org_budget_lines_one_line_per_item on the year NUMBER, which a change of first month would make two years share — S3C-08). Planning a word already on the year adds to its line. Partial: a word-less line (written before the plan asked for a word) is not joined.';
COMMENT ON COLUMN public.org_budget_lines.fiscal_year_id IS
  'The fiscal year this line plans (org_fiscal_years; mig 318, call 3). The plan''s key: it survives a rename and a change of first month. Locked with its year: a closed year''s lines and their dates can''t change (only a word merge may relabel them).';
COMMENT ON COLUMN public.org_budget_lines.season_year IS
  '⚠ SUPERSEDED by fiscal_year_id (mig 318) and kept in step from the year''s first day by a trigger until the migration that drops it (applied to prod LAST, after the code that stops reading it). Read nothing from it.';

-- ── 4. Ledger lines: the day a cleared cheque was written ───────────────────────────────────────

ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS written_on date;

COMMENT ON COLUMN public.accounting_entries.written_on IS
  'The day a PENDING line was first dated, kept when it clears into an open fiscal year from a closed one (mig 318, call 2): it counted nowhere in the closed year, so it posts dated the day it cleared and keeps the day it was written here. NULL on every other line.';

-- ── 5. The season that carries a club payment (S3C-11, call 1) ──────────────────────────────────

-- One-shot: the column and its backfill are written together, only when the column is new — re-applying this file
-- never stamps a payment recorded since, between seasons, with its bill's season.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                  AND table_name = 'rep_allocation_installments' AND column_name = 'carried_by_program_year_id') THEN
    ALTER TABLE public.rep_allocation_installments
      ADD COLUMN carried_by_program_year_id uuid REFERENCES public.rep_program_years(id) ON DELETE SET NULL;
    -- Backfill: every payment already recorded is carried by its own bill's season — what every reader
    -- counted until now — so no figure moves at migration (check:register and check:money-report hold it).
    UPDATE public.rep_allocation_installments i
       SET carried_by_program_year_id = s.program_year_id
      FROM public.rep_allocation_splits s
     WHERE s.id = i.split_id
       AND (i.paid_at IS NOT NULL OR i.sent_at IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rep_allocation_installments_carried_by_idx
  ON public.rep_allocation_installments (carried_by_program_year_id)
  WHERE carried_by_program_year_id IS NOT NULL;

COMMENT ON COLUMN public.rep_allocation_installments.carried_by_program_year_id IS
  'The team''s season whose books carry this payment (S3C-11, owner 2026-10-07, mig 318): the season RUNNING when the money left the team — the coach''s "We''ve sent it", or the club''s received when nobody said sent — whatever date was typed (the typed date stays the line''s date inside that season). Kept by a trigger on every writer: set when the money leaves, kept from sent to received, cleared when it is taken back or undone. NULL while the money is still the team''s, and on a payment recorded while the team had NO running season — the next season to run carries it when it starts (rep_program_years trigger). The bill itself stays on its own season (rep_allocation_splits.program_year_id). Backfilled with the bill''s season, so no figure moved at migration.';

-- The team's running season: the newest-created draft or active one (lib/season-live.ts liveSeasonOf).
CREATE OR REPLACE FUNCTION public.rep_team_live_season(p_team uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM rep_program_years
   WHERE team_id = p_team AND status IN ('draft', 'active')
   ORDER BY created_at DESC, id DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.rep_allocation_installments_carrier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team uuid;
BEGIN
  IF NEW.paid_at IS NULL AND NEW.sent_at IS NULL THEN
    -- Still the team's money (never left, taken back, or undone): no season carries it.
    NEW.carried_by_program_year_id := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    -- A row written already paid (a seed, an import) may state its history; otherwise the running season.
    IF NEW.carried_by_program_year_id IS NULL THEN
      v_team := coalesce(NEW.team_id, (SELECT team_id FROM rep_allocation_splits WHERE id = NEW.split_id));
      -- Shared with every payment, exclusive to a change of which season runs (rep_program_years_carry_waiting):
      -- a season starting or closing waits for a payment in flight, and a payment waits for it, then reads it.
      PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_team_seasons:' || v_team::text, 0));
      NEW.carried_by_program_year_id := rep_team_live_season(v_team);
    END IF;
  ELSIF OLD.paid_at IS NULL AND OLD.sent_at IS NULL THEN
    -- The money just left the team: the season running NOW carries it, whatever day was typed.
    v_team := coalesce(NEW.team_id, (SELECT team_id FROM rep_allocation_splits WHERE id = NEW.split_id));
    PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_team_seasons:' || v_team::text, 0));
    NEW.carried_by_program_year_id := rep_team_live_season(v_team);
  ELSE
    -- Sent, then received: the money left when it was sent, so the season that carried it then keeps it.
    NEW.carried_by_program_year_id := OLD.carried_by_program_year_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rep_allocation_installments_carrier ON public.rep_allocation_installments;
CREATE TRIGGER rep_allocation_installments_carrier
  BEFORE INSERT OR UPDATE OF paid_at, sent_at ON public.rep_allocation_installments
  FOR EACH ROW EXECUTE FUNCTION public.rep_allocation_installments_carrier();

-- A season that starts running (made, or reopened) carries every payment its team recorded while it had
-- no running season (call 1's between-seasons edge: the closed season and the club's "at close" figure
-- never move).
CREATE OR REPLACE FUNCTION public.rep_program_years_carry_waiting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    -- Exclusive: a change of which season runs waits for every payment being recorded for the team, and they
    -- for it (the carrier takes it shared) — so no payment is stamped with a season that just stopped running,
    -- or left unstamped beside one that just started.
    PERFORM pg_advisory_xact_lock(hashtextextended('club_team_seasons:' || NEW.team_id::text, 0));
  END IF;
  IF NEW.status IN ('draft', 'active') AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('draft', 'active')) THEN
    UPDATE rep_allocation_installments i
       SET carried_by_program_year_id = NEW.id
      FROM rep_allocation_splits s
     WHERE s.id = i.split_id AND s.team_id = NEW.team_id
       AND i.carried_by_program_year_id IS NULL
       AND (i.paid_at IS NOT NULL OR i.sent_at IS NOT NULL);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rep_program_years_carry_waiting ON public.rep_program_years;
CREATE TRIGGER rep_program_years_carry_waiting
  AFTER INSERT OR UPDATE OF status ON public.rep_program_years
  FOR EACH ROW EXECUTE FUNCTION public.rep_program_years_carry_waiting();

-- ── 6. "Evenly" ─────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.rep_allocation_splits DROP CONSTRAINT IF EXISTS rep_allocation_splits_split_method_check;
ALTER TABLE public.rep_allocation_splits
  ADD CONSTRAINT rep_allocation_splits_split_method_check
  CHECK (split_method IN ('even', 'percentage', 'sessions', 'fixed'));

COMMENT ON COLUMN public.rep_allocation_splits.split_method IS
  'How the bill''s amount was divided among its teams (chosen once per bill since Stage 3c, Ask 6): even (Evenly — the cents shared out, any remainder to the first teams), fixed (By amount), percentage (By percentage), sessions (By sessions). The stored amount is always the team''s final share.';

-- A bill's own note (Ask 6: "Notes · for the club's own reference; teams don't see it").
ALTER TABLE public.rep_cost_allocations
  ADD COLUMN IF NOT EXISTS notes text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rep_cost_allocations_notes_length_check') THEN
    ALTER TABLE public.rep_cost_allocations
      ADD CONSTRAINT rep_cost_allocations_notes_length_check CHECK (notes IS NULL OR char_length(notes) <= 2000);
  END IF;
END $$;
COMMENT ON COLUMN public.rep_cost_allocations.notes IS
  'The club''s own note on a bill (Stage 3c, Ask 6 — New allocation''s Notes): for the club''s reference; never shown to a team. NULL = none. Mig 318.';

-- ── 7. THE LOCK (call 2) ────────────────────────────────────────────────────────────────────────
-- Every trigger below refuses with a message that STARTS `year_closed` (lib/club-fiscal-year-server.ts `isClosedYearError` maps it to
-- the one refusal). Routes check first and refuse in words; these are the floor.

CREATE OR REPLACE FUNCTION public.accounting_entries_fiscal_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_org    uuid;
  v_new_org    uuid;
  v_through    date;
  v_old_locked boolean := false;
  v_new_locked boolean := false;
  -- A relabel moves no money: a payee merge and a budget word merge reach every year.
  c_labels     text[] := ARRAY['payee_id', 'budget_category_id', 'budget_item_id', 'linked_entry_id', 'updated_at'];
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT l.org_id INTO v_old_org FROM accounting_ledgers l
     WHERE l.id = OLD.ledger_id AND l.entity_type IN ('org', 'tournament', 'league_season');
    IF v_old_org IS NOT NULL THEN
      -- Shared with every other writer, exclusive to a close or a reopen: a close waits for writes in
      -- flight, and a write waits for a close, then reads it.
      PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_books:' || v_old_org::text, 0));
      v_through := club_books_closed_through(v_old_org);
      v_old_locked := v_through IS NOT NULL AND OLD.entry_date <= v_through;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- A club or a book being removed takes its lines with it; nothing else removes a closed year's line.
    IF v_old_locked AND EXISTS (SELECT 1 FROM organizations WHERE id = v_old_org) THEN
      RAISE EXCEPTION 'year_closed: a line dated % is in a closed fiscal year', OLD.entry_date;
    END IF;
    RETURN OLD;
  END IF;

  SELECT l.org_id INTO v_new_org FROM accounting_ledgers l
   WHERE l.id = NEW.ledger_id AND l.entity_type IN ('org', 'tournament', 'league_season');
  IF v_new_org IS NOT NULL THEN
    IF v_new_org IS DISTINCT FROM v_old_org THEN
      PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_books:' || v_new_org::text, 0));
    END IF;
    v_through := club_books_closed_through(v_new_org);
    v_new_locked := v_through IS NOT NULL AND NEW.entry_date <= v_through;
  END IF;

  IF NOT v_old_locked AND NOT v_new_locked THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'year_closed: a line dated % is in a closed fiscal year', NEW.entry_date;
  END IF;

  -- A relabel (a payee or word merge).
  IF (to_jsonb(NEW) - c_labels) = (to_jsonb(OLD) - c_labels) THEN
    RETURN NEW;
  END IF;

  -- A pending line from a closed year clears into an open one: it counted nowhere in the closed year.
  IF OLD.status = 'pending' AND NEW.status = 'posted' AND v_old_locked AND NOT v_new_locked
     AND (to_jsonb(NEW) - (c_labels || ARRAY['status', 'entry_date', 'written_on']))
       = (to_jsonb(OLD) - (c_labels || ARRAY['status', 'entry_date', 'written_on'])) THEN
    NEW.written_on := coalesce(OLD.written_on, OLD.entry_date);
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'year_closed: a line dated % is in a closed fiscal year',
    CASE WHEN v_old_locked THEN OLD.entry_date ELSE NEW.entry_date END;
END;
$$;

DROP TRIGGER IF EXISTS accounting_entries_fiscal_lock ON public.accounting_entries;
CREATE TRIGGER accounting_entries_fiscal_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.accounting_entries
  FOR EACH ROW EXECUTE FUNCTION public.accounting_entries_fiscal_lock();

-- The plan's lines: keyed on a year; season_year kept in step; a closed year's lines are locked.
CREATE OR REPLACE FUNCTION public.org_budget_lines_fiscal_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org    uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END;
  c_labels text[] := ARRAY['item_id', 'category_id', 'updated_at'];
BEGIN
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_books:' || v_org::text, 0));

  IF TG_OP = 'DELETE' THEN
    IF club_fiscal_year_locked(OLD.fiscal_year_id) AND EXISTS (SELECT 1 FROM organizations WHERE id = OLD.org_id) THEN
      RAISE EXCEPTION 'year_closed: the plan line "%" is on a closed fiscal year', OLD.description;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.fiscal_year_id IS NULL THEN
    RAISE EXCEPTION 'org_budget_lines: a plan line needs its fiscal year (fiscal_year_id)';
  END IF;
  NEW.season_year := (SELECT extract(year FROM first_day)::int FROM org_fiscal_years
                       WHERE id = NEW.fiscal_year_id AND org_id = NEW.org_id);
  IF NEW.season_year IS NULL THEN
    RAISE EXCEPTION 'org_budget_lines: fiscal year % is not this club''s', NEW.fiscal_year_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF club_fiscal_year_locked(NEW.fiscal_year_id) THEN
      RAISE EXCEPTION 'year_closed: the plan line "%" is on a closed fiscal year', NEW.description;
    END IF;
    RETURN NEW;
  END IF;

  IF (club_fiscal_year_locked(OLD.fiscal_year_id) OR club_fiscal_year_locked(NEW.fiscal_year_id))
     AND (to_jsonb(NEW) - (c_labels || ARRAY['season_year'])) <> (to_jsonb(OLD) - (c_labels || ARRAY['season_year'])) THEN
    RAISE EXCEPTION 'year_closed: the plan line "%" is on a closed fiscal year', OLD.description;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_budget_lines_fiscal_lock ON public.org_budget_lines;
CREATE TRIGGER org_budget_lines_fiscal_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.org_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.org_budget_lines_fiscal_lock();

CREATE OR REPLACE FUNCTION public.org_budget_periods_fiscal_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year uuid;
  v_org  uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT fiscal_year_id, org_id INTO v_year, v_org FROM org_budget_lines WHERE id = OLD.budget_line_id;
    IF v_org IS NOT NULL THEN PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_books:' || v_org::text, 0)); END IF;
    -- A line being removed takes its dates (its own removal was checked).
    IF v_year IS NOT NULL AND club_fiscal_year_locked(v_year) THEN
      RAISE EXCEPTION 'year_closed: a plan line''s dates are on a closed fiscal year';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT fiscal_year_id, org_id INTO v_year, v_org FROM org_budget_lines WHERE id = NEW.budget_line_id;
  IF v_org IS NOT NULL THEN PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_books:' || v_org::text, 0)); END IF;
  IF v_year IS NOT NULL AND club_fiscal_year_locked(v_year) THEN
    RAISE EXCEPTION 'year_closed: a plan line''s dates are on a closed fiscal year';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_budget_periods_fiscal_lock ON public.org_budget_periods;
CREATE TRIGGER org_budget_periods_fiscal_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.org_budget_periods
  FOR EACH ROW EXECUTE FUNCTION public.org_budget_periods_fiscal_lock();

-- Would an allocation count in a closed fiscal year, drawn from p_line (or from no line)? The line's year; without
-- a line, the year its first installment falls due (lib/club-money-figures.ts allocationYear — the year rule).
CREATE OR REPLACE FUNCTION public.club_allocation_locked_as(p_alloc uuid, p_line uuid, p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(CASE
    WHEN p_line IS NOT NULL
      THEN (SELECT club_fiscal_year_locked(l.fiscal_year_id) FROM org_budget_lines l WHERE l.id = p_line)
    ELSE (SELECT min(i.due_date) FROM rep_allocation_splits s JOIN rep_allocation_installments i ON i.split_id = s.id
           WHERE s.allocation_id = p_alloc) <= club_books_closed_through(p_org)
  END, false);
$$;

-- Does an allocation count in a closed fiscal year, as it stands?
CREATE OR REPLACE FUNCTION public.club_allocation_locked(p_alloc uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT club_allocation_locked_as(a.id, a.source_budget_line_id, a.org_id)
                     FROM rep_cost_allocations a WHERE a.id = p_alloc), false);
$$;

CREATE OR REPLACE FUNCTION public.rep_cost_allocations_fiscal_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_books:' || (CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END)::text, 0));
  IF TG_OP = 'INSERT' THEN
    IF NEW.source_budget_line_id IS NOT NULL
       AND (SELECT club_fiscal_year_locked(fiscal_year_id) FROM org_budget_lines WHERE id = NEW.source_budget_line_id) THEN
      RAISE EXCEPTION 'year_closed: allocating from a closed fiscal year''s line';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF club_allocation_locked(OLD.id) AND EXISTS (SELECT 1 FROM organizations WHERE id = OLD.org_id) THEN
      RAISE EXCEPTION 'year_closed: "%" counts in a closed fiscal year', OLD.description;
    END IF;
    RETURN OLD;
  END IF;
  -- Locked as it stands, or as it would stand (a bill unlinked from its line counts in the year its first payment
  -- falls due — which may be closed). The retired pasted entry (source_entry_id) is a label: a removed entry
  -- clearing it moves no money.
  IF (to_jsonb(NEW) - 'source_entry_id') <> (to_jsonb(OLD) - 'source_entry_id') AND (
       club_allocation_locked(OLD.id)
       OR club_allocation_locked_as(NEW.id, NEW.source_budget_line_id, NEW.org_id)
     ) THEN
    RAISE EXCEPTION 'year_closed: "%" counts in a closed fiscal year', OLD.description;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rep_cost_allocations_fiscal_lock ON public.rep_cost_allocations;
CREATE TRIGGER rep_cost_allocations_fiscal_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.rep_cost_allocations
  FOR EACH ROW EXECUTE FUNCTION public.rep_cost_allocations_fiscal_lock();

-- A team's share. The coach's own filing of the bill (its budget word) is the coach's and never locked.
CREATE OR REPLACE FUNCTION public.rep_allocation_splits_fiscal_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_coach text[] := ARRAY['budget_category_id', 'budget_item_id'];
BEGIN
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_books:' || (CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END)::text, 0));
  IF TG_OP = 'DELETE' THEN
    IF club_allocation_locked(OLD.allocation_id) AND EXISTS (SELECT 1 FROM organizations WHERE id = OLD.org_id) THEN
      RAISE EXCEPTION 'year_closed: a team''s share of a bill that counts in a closed fiscal year';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - c_coach) = (to_jsonb(OLD) - c_coach) THEN RETURN NEW; END IF;
  IF club_allocation_locked(NEW.allocation_id)
     OR (TG_OP = 'UPDATE' AND club_allocation_locked(OLD.allocation_id)) THEN
    RAISE EXCEPTION 'year_closed: a team''s share of a bill that counts in a closed fiscal year';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rep_allocation_splits_fiscal_lock ON public.rep_allocation_splits;
CREATE TRIGGER rep_allocation_splits_fiscal_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.rep_allocation_splits
  FOR EACH ROW EXECUTE FUNCTION public.rep_allocation_splits_fiscal_lock();

-- An installment's BILL (amount, due date, number, split) — never its payment, which stays receivable.
CREATE OR REPLACE FUNCTION public.rep_allocation_installments_fiscal_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alloc   uuid;
  v_line    uuid;
  v_org     uuid;
  v_through date;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_books:' || (CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END)::text, 0));
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT s.allocation_id, s.org_id INTO v_alloc, v_org FROM rep_allocation_splits s WHERE s.id = OLD.split_id;
    IF v_alloc IS NOT NULL AND club_allocation_locked(v_alloc)
       AND (TG_OP = 'UPDATE' OR EXISTS (SELECT 1 FROM organizations WHERE id = v_org)) THEN
      RAISE EXCEPTION 'year_closed: an installment of a bill that counts in a closed fiscal year';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  SELECT s.allocation_id, a.source_budget_line_id, a.org_id INTO v_alloc, v_line, v_org
    FROM rep_allocation_splits s JOIN rep_cost_allocations a ON a.id = s.allocation_id
   WHERE s.id = NEW.split_id;
  IF v_alloc IS NULL THEN RETURN NEW; END IF;
  IF club_allocation_locked(v_alloc) THEN
    RAISE EXCEPTION 'year_closed: an installment of a bill that counts in a closed fiscal year';
  END IF;
  -- A bill with no line counts in the year its first installment falls due: an installment due in a
  -- closed year would carry it there.
  IF v_line IS NULL THEN
    v_through := club_books_closed_through(v_org);
    IF v_through IS NOT NULL AND NEW.due_date <= v_through THEN
      RAISE EXCEPTION 'year_closed: an installment due % falls in a closed fiscal year', NEW.due_date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rep_allocation_installments_fiscal_lock ON public.rep_allocation_installments;
CREATE TRIGGER rep_allocation_installments_fiscal_lock
  BEFORE INSERT OR DELETE OR UPDATE OF amount, due_date, installment_number, split_id
  ON public.rep_allocation_installments
  FOR EACH ROW EXECUTE FUNCTION public.rep_allocation_installments_fiscal_lock();

-- A book's kind and club decide whether its lines are the club's (and so locked): a book holding a line in a
-- closed stretch never leaves the club's books, never joins another club's, and a team's book never becomes the
-- club's over lines its closed years never saw. (Removing a book takes its lines — the lock's one other way out.)
CREATE OR REPLACE FUNCTION public.accounting_ledgers_fiscal_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was  boolean := OLD.entity_type IN ('org', 'tournament', 'league_season');
  v_is   boolean := NEW.entity_type IN ('org', 'tournament', 'league_season');
  v_org  uuid;
BEGIN
  IF (OLD.org_id, v_was) IS NOT DISTINCT FROM (NEW.org_id, v_is) THEN RETURN NEW; END IF;
  FOREACH v_org IN ARRAY ARRAY[CASE WHEN v_was THEN OLD.org_id END, CASE WHEN v_is THEN NEW.org_id END] LOOP
    CONTINUE WHEN v_org IS NULL;
    PERFORM pg_advisory_xact_lock_shared(hashtextextended('club_books:' || v_org::text, 0));
    IF EXISTS (SELECT 1 FROM accounting_entries e WHERE e.ledger_id = OLD.id
                AND e.entry_date <= club_books_closed_through(v_org)) THEN
      RAISE EXCEPTION 'year_closed: the book "%" holds lines in a closed fiscal year', OLD.name;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounting_ledgers_fiscal_lock ON public.accounting_ledgers;
CREATE TRIGGER accounting_ledgers_fiscal_lock
  BEFORE UPDATE OF entity_type, org_id ON public.accounting_ledgers
  FOR EACH ROW EXECUTE FUNCTION public.accounting_ledgers_fiscal_lock();

-- ── 8. Close, Reopen, Rename (Asks 2, 3, 5) ─────────────────────────────────────────────────────

-- The earliest day the club holds anything: a line on one of its own books (void ones never count), its
-- first plan year, or a bill with no line's first due date. The close order starts there.
CREATE OR REPLACE FUNCTION public.club_fiscal_first_held_day(p_org uuid)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT min(d) FROM (
    SELECT min(e.entry_date) AS d
      FROM accounting_entries e JOIN accounting_ledgers l ON l.id = e.ledger_id
     WHERE l.org_id = p_org AND l.entity_type IN ('org', 'tournament', 'league_season') AND e.status <> 'void'
    UNION ALL
    SELECT min(y.first_day) FROM org_budget_lines b JOIN org_fiscal_years y ON y.id = b.fiscal_year_id WHERE b.org_id = p_org
    UNION ALL
    SELECT min(i.due_date)
      FROM rep_cost_allocations a
      JOIN rep_allocation_splits s ON s.allocation_id = a.id
      JOIN rep_allocation_installments i ON i.split_id = s.id
     WHERE a.org_id = p_org AND a.source_budget_line_id IS NULL
  ) x;
$$;

-- The closing balance of every book the club owns, posted through p_last (club_book_totals' sums).
CREATE OR REPLACE FUNCTION public.club_closing_balance(p_org uuid, p_last date)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(sum(t.posted_in - t.posted_out), 0)
    FROM club_book_totals(
      ARRAY(SELECT id FROM accounting_ledgers WHERE org_id = p_org AND entity_type IN ('org', 'tournament', 'league_season')),
      NULL, p_last) t;
$$;

-- Close a fiscal year: refused unless it has ended (the club's day is after its last day), refused if it is
-- already closed, oldest first. Locks it by recording who, when, the closing balance and what was still open
-- (p_snapshot: the close question's figures, read by the route just before this step).
-- Codes: not_found · not_ended · already_closed · close_order (+ firstDay, name of the year to close first).
CREATE OR REPLACE FUNCTION public.club_fiscal_year_close(
  p_org      uuid,
  p_first    date,
  p_actor    uuid,
  p_today    date,
  p_snapshot jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year    org_fiscal_years%ROWTYPE;
  v_through date;
  v_held    date;
  v_first   org_fiscal_years%ROWTYPE;
  v_balance numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('club_fiscal_years:' || p_org::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('club_books:' || p_org::text, 0));

  SELECT * INTO v_year FROM club_fiscal_year_row(p_org, p_first);
  IF v_year.first_day <> p_first THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  PERFORM 1 FROM org_fiscal_years WHERE id = v_year.id FOR UPDATE;

  v_through := club_books_closed_through(p_org);
  IF v_year.closed_at IS NOT NULL OR (v_through IS NOT NULL AND v_year.last_day <= v_through) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_closed');
  END IF;
  IF p_today <= v_year.last_day THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_ended', 'lastDay', v_year.last_day);
  END IF;

  -- Oldest first: after the newest closed year comes the year right after it; before the first close, the
  -- oldest year the club holds anything in.
  IF v_through IS NOT NULL THEN
    IF v_year.first_day <> v_through + 1 THEN
      SELECT * INTO v_first FROM club_fiscal_year_row(p_org, v_through + 1);
      RETURN jsonb_build_object('ok', false, 'code', 'close_order', 'firstDay', v_first.first_day, 'name', v_first.name);
    END IF;
  ELSE
    v_held := club_fiscal_first_held_day(p_org);
    IF v_held IS NOT NULL AND v_held < v_year.first_day THEN
      SELECT * INTO v_first FROM club_fiscal_year_row(p_org, v_held);
      RETURN jsonb_build_object('ok', false, 'code', 'close_order', 'firstDay', v_first.first_day, 'name', v_first.name);
    END IF;
    -- The years before the club's first closed year hold nothing; their rows (if any) go, so no open row
    -- ever sits inside the closed stretch.
    DELETE FROM org_fiscal_years WHERE org_id = p_org AND last_day < v_year.first_day AND closed_at IS NULL;
  END IF;

  v_balance := club_closing_balance(p_org, v_year.last_day);
  PERFORM set_config('club.fiscal_step', 'on', true);
  UPDATE org_fiscal_years
     SET closed_at = now(), closed_by = p_actor, closing_balance = v_balance,
         closing_snapshot = coalesce(p_snapshot, '{}'::jsonb)
   WHERE id = v_year.id;
  PERFORM set_config('club.fiscal_step', 'off', true);

  -- Re-checked after the write (3a's habit): the books are now closed through this year's last day, and the
  -- figure locked is the books' own.
  IF club_books_closed_through(p_org) IS DISTINCT FROM v_year.last_day
     OR club_closing_balance(p_org, v_year.last_day) <> v_balance THEN
    RAISE EXCEPTION 'club_fiscal_year_close: the close did not hold for %', v_year.name;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_year.id, 'name', v_year.name, 'firstDay', v_year.first_day,
    'lastDay', v_year.last_day, 'closingBalance', v_balance, 'closedAt', now());
END;
$$;

-- Reopen the LATEST closed year, with a reason that is kept. Its stored closing stops being authoritative
-- (the next year's opening follows the books again) until it is closed again.
-- Codes: not_found · not_closed · not_latest (+ firstDay, name) · reason_required · bad_reason.
CREATE OR REPLACE FUNCTION public.club_fiscal_year_reopen(p_org uuid, p_first date, p_actor uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year    org_fiscal_years%ROWTYPE;
  v_latest  org_fiscal_years%ROWTYPE;
  v_reason  text := btrim(coalesce(p_reason, ''));
BEGIN
  IF v_reason = '' THEN RETURN jsonb_build_object('ok', false, 'code', 'reason_required'); END IF;
  IF char_length(v_reason) > 500 THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_reason'); END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('club_fiscal_years:' || p_org::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('club_books:' || p_org::text, 0));

  SELECT * INTO v_year FROM org_fiscal_years WHERE org_id = p_org AND first_day = p_first FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF v_year.closed_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'not_closed'); END IF;

  SELECT * INTO v_latest FROM org_fiscal_years
   WHERE org_id = p_org AND closed_at IS NOT NULL ORDER BY last_day DESC LIMIT 1;
  IF v_latest.id <> v_year.id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_latest', 'firstDay', v_latest.first_day, 'name', v_latest.name);
  END IF;

  INSERT INTO org_fiscal_year_reopenings
    (fiscal_year_id, org_id, reopened_by, reason, was_closed_at, was_closed_by, was_closing_balance, was_closing_snapshot)
  VALUES
    (v_year.id, p_org, p_actor, v_reason, v_year.closed_at, v_year.closed_by, v_year.closing_balance, v_year.closing_snapshot);

  PERFORM set_config('club.fiscal_step', 'on', true);
  UPDATE org_fiscal_years
     SET closed_at = NULL, closed_by = NULL, closing_balance = NULL, closing_snapshot = NULL
   WHERE id = v_year.id;
  PERFORM set_config('club.fiscal_step', 'off', true);

  -- Re-checked after the write: the books are closed through the year before it, or not at all.
  IF club_books_closed_through(p_org) >= v_year.first_day THEN
    RAISE EXCEPTION 'club_fiscal_year_reopen: the reopen did not hold for %', v_year.name;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_year.id, 'name', v_year.name, 'firstDay', v_year.first_day);
END;
$$;

-- Rename an OPEN year. Codes: not_found · year_closed · bad_name · name_taken.
CREATE OR REPLACE FUNCTION public.club_fiscal_year_rename(p_org uuid, p_first date, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year org_fiscal_years%ROWTYPE;
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF v_name = '' OR char_length(v_name) > 40 THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_name'); END IF;
  SELECT * INTO v_year FROM club_fiscal_year_row(p_org, p_first);
  IF v_year.first_day <> p_first THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF v_year.closed_at IS NOT NULL OR club_fiscal_year_locked(v_year.id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'year_closed');
  END IF;
  IF EXISTS (SELECT 1 FROM org_fiscal_years WHERE org_id = p_org AND lower(name) = lower(v_name) AND id <> v_year.id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'name_taken');
  END IF;
  UPDATE org_fiscal_years SET name = v_name WHERE id = v_year.id;
  RETURN jsonb_build_object('ok', true, 'id', v_year.id, 'name', v_name, 'firstDay', v_year.first_day);
END;
$$;

-- ── 9. The first-month change (Ask 5) ───────────────────────────────────────────────────────────

-- Where a day lands once the change is made: in the next year (p_next_first … p_next_last), or in the
-- twelve-month year after it that holds it.
CREATE OR REPLACE FUNCTION public.club_fiscal_new_start(p_day date, p_next_first date, p_next_last date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_day <= p_next_last THEN p_next_first
    ELSE ((p_next_last + 1) + make_interval(months => 12 * floor((
           (extract(year FROM p_day) - extract(year FROM p_next_last + 1)) * 12
           + extract(month FROM p_day) - extract(month FROM p_next_last + 1)) / 12)::int))::date
  END;
$$;

-- Join line p_loser into p_keeper (same year, same word): every reference re-pointed BEFORE the delete
-- (mig 317's rule: periods CASCADE, allocations and requests SET NULL), the amounts and notes added.
CREATE OR REPLACE FUNCTION public.club_budget_line_join(p_keeper uuid, p_loser uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_loser org_budget_lines%ROWTYPE;
BEGIN
  SELECT * INTO v_loser FROM org_budget_lines WHERE id = p_loser;
  UPDATE org_budget_periods SET budget_line_id = p_keeper WHERE budget_line_id = p_loser;
  UPDATE rep_cost_allocations SET source_budget_line_id = p_keeper WHERE source_budget_line_id = p_loser;
  UPDATE rep_team_payment_requests SET budget_line_id = p_keeper WHERE budget_line_id = p_loser;
  DELETE FROM org_budget_lines WHERE id = p_loser;
  UPDATE org_budget_lines
     SET total_amount = total_amount + v_loser.total_amount,
         notes = nullif(concat_ws('; ', nullif(btrim(coalesce(notes, '')), ''), nullif(btrim(coalesce(v_loser.notes, '')), '')), ''),
         updated_at = clock_timestamp()
   WHERE id = p_keeper;
END;
$$;

-- The change itself. Refused after the first close. A club that holds nothing (no plan line, no line on
-- any of its books) just starts on the new month. Otherwise the year today falls in keeps its months and
-- the NEXT year is the short one (never a long one), ending the month before the new first month; every
-- year after it runs the new twelve months. Plan lines on the years after this one are placed by their
-- dates: a line whose dates cross the new end is split by its dates into one line per year under the same
-- word (one word, one line, per year — joining a line already there); an undated line stays with the year
-- its old year started in; allocations keep their line. Ledger lines never move.
-- Returns the counts the window shows before the save; refusals: bad_month · first_close_done ·
-- split_below_allocated (+ line, allocated, staying).
CREATE OR REPLACE FUNCTION public.club_fiscal_first_month_apply(p_org uuid, p_month integer, p_today date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old_month  smallint;
  v_cur        org_fiscal_years%ROWTYPE;
  v_next_first date;
  v_next_last  date;
  v_next_id    uuid;
  v_grid_first date;
  v_lines      uuid[];
  v_line       org_budget_lines%ROWTYPE;
  v_line_first date;
  v_home       date;
  v_keep       date;
  v_keep_year  uuid;
  v_into       uuid;
  v_total      numeric;
  v_moved_out  numeric;
  v_alloc      numeric;
  g            record;
  v_moved      integer := 0;
  v_split      integer := 0;
  v_joined     integer := 0;
  v_from       date;
  v_to         date;
  v_touched    uuid[] := '{}';
  v_t          date;
  v_tl         uuid;
  v_y          uuid;
  v_newest     date;
  r            record;
  v_mode       text;
  v_next       org_fiscal_years%ROWTYPE;
  v_groups     jsonb;
BEGIN
  IF p_month IS NULL OR p_month NOT BETWEEN 1 AND 12 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_month');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('club_fiscal_years:' || p_org::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('club_books:' || p_org::text, 0));

  SELECT fiscal_first_month INTO v_old_month FROM organizations WHERE id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF EXISTS (SELECT 1 FROM org_fiscal_years WHERE org_id = p_org AND closed_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM org_fiscal_year_reopenings WHERE org_id = p_org) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'first_close_done');
  END IF;
  IF v_old_month = p_month THEN
    RETURN jsonb_build_object('ok', true, 'mode', 'unchanged', 'moved', 0, 'split', 0, 'joined', 0);
  END IF;

  -- A club that holds nothing starts on the new month: no short year, every year from the new month.
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines WHERE org_id = p_org)
     AND NOT EXISTS (SELECT 1 FROM accounting_entries e JOIN accounting_ledgers l ON l.id = e.ledger_id
                      WHERE l.org_id = p_org AND l.entity_type IN ('org', 'tournament', 'league_season')) THEN
    DELETE FROM org_fiscal_years WHERE org_id = p_org;
    UPDATE organizations SET fiscal_first_month = p_month WHERE id = p_org;
    SELECT * INTO v_cur FROM club_fiscal_year_row(p_org, p_today);
    RETURN jsonb_build_object('ok', true, 'mode', 'fresh', 'moved', 0, 'split', 0, 'joined', 0,
      'current', jsonb_build_object('name', v_cur.name, 'firstDay', v_cur.first_day, 'lastDay', v_cur.last_day));
  END IF;

  -- The year today falls in keeps its months.
  SELECT * INTO v_cur FROM club_fiscal_year_row(p_org, p_today);
  v_next_first := v_cur.last_day + 1;
  v_grid_first := make_date(extract(year FROM v_next_first)::int, p_month, 1);
  IF v_grid_first < v_next_first THEN v_grid_first := (v_grid_first + interval '1 year')::date; END IF;
  IF v_grid_first = v_next_first THEN
    v_next_last := (v_next_first + interval '12 months - 1 day')::date;   -- the next year is whole
    v_mode := 'whole_next';
  ELSE
    v_next_last := v_grid_first - 1;                                      -- the next year is the short one
    v_mode := 'short_next';
  END IF;

  -- The plan lines after this year, captured before any row moves.
  v_lines := ARRAY(
    SELECT l.id FROM org_budget_lines l JOIN org_fiscal_years y ON y.id = l.fiscal_year_id
     WHERE l.org_id = p_org AND y.first_day > v_cur.last_day
     ORDER BY y.first_day, l.sort_order, l.created_at, l.id);

  -- The next year: its row re-spanned (or made), with a placeholder name settled at the end.
  SELECT id INTO v_next_id FROM org_fiscal_years WHERE org_id = p_org AND first_day = v_next_first;
  IF FOUND THEN
    UPDATE org_fiscal_years SET last_day = v_next_last WHERE id = v_next_id;
  ELSE
    INSERT INTO org_fiscal_years (org_id, name, first_day, last_day)
    VALUES (p_org, 'pending ' || v_next_first, v_next_first, v_next_last) RETURNING id INTO v_next_id;
  END IF;

  FOREACH v_into IN ARRAY v_lines LOOP
    SELECT * INTO v_line FROM org_budget_lines WHERE id = v_into;
    SELECT first_day INTO v_line_first FROM org_fiscal_years WHERE id = v_line.fiscal_year_id;
    v_home := club_fiscal_new_start(v_line_first, v_next_first, v_next_last);

    -- Where its money lands: by each date; an undated part (or a line with no dates) stays with the year
    -- its old year started in. Read ONCE, before any of the line's dates move.
    IF EXISTS (SELECT 1 FROM org_budget_periods WHERE budget_line_id = v_line.id) THEN
      SELECT jsonb_agg(jsonb_build_object('target', t.target, 'amount', t.amount, 'periods', t.periods,
                                          'first', t.first_date, 'last', t.last_date) ORDER BY t.target)
        INTO v_groups
        FROM (SELECT club_fiscal_new_start(coalesce(p.period_date, v_line_first), v_next_first, v_next_last) AS target,
                     sum(p.amount) AS amount, array_agg(p.id) AS periods, min(p.period_date) AS first_date,
                     max(p.period_date) AS last_date
                FROM org_budget_periods p WHERE p.budget_line_id = v_line.id GROUP BY 1) t;
    ELSE
      v_groups := jsonb_build_array(jsonb_build_object('target', v_home, 'amount', v_line.total_amount,
                                                       'periods', '[]'::jsonb, 'first', NULL, 'last', NULL));
    END IF;

    SELECT CASE WHEN bool_or((e->>'target')::date = v_home) THEN v_home ELSE min((e->>'target')::date) END
      INTO v_keep FROM jsonb_array_elements(v_groups) e;

    -- Every year a part lands in has its row.
    FOR g IN SELECT DISTINCT (e->>'target')::date AS target FROM jsonb_array_elements(v_groups) e LOOP
      IF NOT EXISTS (SELECT 1 FROM org_fiscal_years WHERE org_id = p_org AND first_day = g.target) THEN
        INSERT INTO org_fiscal_years (org_id, name, first_day, last_day)
        VALUES (p_org, 'pending ' || g.target, g.target,
                CASE WHEN g.target = v_next_first THEN v_next_last ELSE (g.target + interval '12 months - 1 day')::date END);
      ELSE
        UPDATE org_fiscal_years
           SET last_day = CASE WHEN g.target = v_next_first THEN v_next_last ELSE (g.target + interval '12 months - 1 day')::date END
         WHERE org_id = p_org AND first_day = g.target;
      END IF;
    END LOOP;

    -- The parts that leave: each lands on its year's line of the same word, or on a new line there.
    v_moved_out := 0;
    FOR g IN SELECT (e->>'target')::date AS target, (e->>'amount')::numeric AS amount,
                    ARRAY(SELECT jsonb_array_elements_text(e->'periods'))::uuid[] AS periods,
                    (e->>'first')::date AS first_date, (e->>'last')::date AS last_date
               FROM jsonb_array_elements(v_groups) e
              WHERE (e->>'target')::date <> v_keep
              ORDER BY 1 LOOP
      SELECT id INTO v_y FROM org_fiscal_years WHERE org_id = p_org AND first_day = g.target;
      v_tl := NULL;
      IF v_line.item_id IS NOT NULL THEN
        SELECT id INTO v_tl FROM org_budget_lines
         WHERE fiscal_year_id = v_y AND item_id = v_line.item_id AND id <> v_line.id;
      END IF;
      IF v_tl IS NULL THEN
        INSERT INTO org_budget_lines (org_id, fiscal_year_id, category_id, item_id, description, total_amount, notes, sort_order)
        VALUES (p_org, v_y, v_line.category_id, v_line.item_id, v_line.description, g.amount, v_line.notes, v_line.sort_order)
        RETURNING id INTO v_tl;
      ELSE
        UPDATE org_budget_lines SET total_amount = total_amount + g.amount, updated_at = clock_timestamp() WHERE id = v_tl;
        v_joined := v_joined + 1;
      END IF;
      UPDATE org_budget_periods SET budget_line_id = v_tl WHERE id = ANY (g.periods);
      v_touched := v_touched || v_tl;
      v_moved_out := v_moved_out + g.amount;
      v_from := least(v_from, g.first_date);
      v_to := greatest(v_to, g.last_date);
    END LOOP;

    -- The part that stays with the line (and its allocations).
    v_total := v_line.total_amount - v_moved_out;
    IF v_moved_out > 0 THEN
      v_split := v_split + 1;
      v_alloc := club_line_allocated(v_line.id);
      IF v_alloc > v_total + 0.005 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'split_below_allocated', 'line', v_line.description,
          'allocated', v_alloc, 'staying', v_total);
      END IF;
    END IF;
    SELECT id INTO v_keep_year FROM org_fiscal_years WHERE org_id = p_org AND first_day = v_keep;
    IF v_keep_year <> v_line.fiscal_year_id OR v_moved_out > 0 THEN
      v_tl := NULL;
      IF v_keep_year <> v_line.fiscal_year_id AND v_line.item_id IS NOT NULL THEN
        SELECT id INTO v_tl FROM org_budget_lines
         WHERE fiscal_year_id = v_keep_year AND item_id = v_line.item_id AND id <> v_line.id;
      END IF;
      UPDATE org_budget_lines SET total_amount = v_total, updated_at = clock_timestamp() WHERE id = v_line.id;
      IF v_tl IS NOT NULL THEN
        -- It moves AND lands on its new year's line of the same word.
        SELECT least(v_from, min(period_date)), greatest(v_to, max(period_date)) INTO v_from, v_to
          FROM org_budget_periods WHERE budget_line_id = v_line.id;
        PERFORM club_budget_line_join(v_tl, v_line.id);
        v_moved := v_moved + 1;
        v_joined := v_joined + 1;
        v_touched := v_touched || v_tl;
      ELSIF v_keep_year <> v_line.fiscal_year_id THEN
        UPDATE org_budget_lines SET fiscal_year_id = v_keep_year WHERE id = v_line.id;
        v_moved := v_moved + 1;
        v_touched := v_touched || v_line.id;
        SELECT least(v_from, min(period_date)), greatest(v_to, max(period_date)) INTO v_from, v_to
          FROM org_budget_periods WHERE budget_line_id = v_line.id;
      ELSE
        v_touched := v_touched || v_line.id;
      END IF;
    END IF;
  END LOOP;

  -- A joined schedule reads in date order, undated last.
  WITH ordered AS (
    SELECT id, row_number() OVER (PARTITION BY budget_line_id ORDER BY period_date NULLS LAST, sort_order, id) - 1 AS rn
      FROM org_budget_periods WHERE budget_line_id = ANY (v_touched)
  )
  UPDATE org_budget_periods p SET sort_order = ordered.rn FROM ordered WHERE ordered.id = p.id;

  -- The rows after the next year: off the new grid (the old years, now empty) go; trailing empty years go;
  -- a gap between the next year and a year a line moved into is filled with its year.
  DELETE FROM org_fiscal_years y
   WHERE y.org_id = p_org AND y.first_day > v_next_first
     AND NOT EXISTS (SELECT 1 FROM org_budget_lines b WHERE b.fiscal_year_id = y.id)
     AND (club_fiscal_new_start(y.first_day, v_next_first, v_next_last) <> y.first_day
          OR y.first_day > coalesce((SELECT max(y2.first_day) FROM org_fiscal_years y2
                                     WHERE y2.org_id = p_org AND EXISTS (SELECT 1 FROM org_budget_lines b2 WHERE b2.fiscal_year_id = y2.id)),
                                    v_next_first));
  -- Every year kept after the next one runs the new twelve months.
  UPDATE org_fiscal_years SET last_day = (first_day + interval '12 months - 1 day')::date
   WHERE org_id = p_org AND first_day > v_next_first
     AND last_day <> (first_day + interval '12 months - 1 day')::date;
  SELECT max(last_day) INTO v_newest FROM org_fiscal_years WHERE org_id = p_org;
  v_t := v_next_last + 1;
  WHILE v_t < v_newest LOOP
    IF NOT EXISTS (SELECT 1 FROM org_fiscal_years WHERE org_id = p_org AND first_day = v_t) THEN
      INSERT INTO org_fiscal_years (org_id, name, first_day, last_day)
      VALUES (p_org, 'pending ' || v_t, v_t, (v_t + interval '12 months - 1 day')::date);
    END IF;
    v_t := (v_t + interval '12 months')::date;
  END LOOP;

  -- Names: a year still wearing the rule's name for its OLD span, or a placeholder, takes the rule's name
  -- for its new span; a name the club chose stays.
  FOR r IN SELECT * FROM org_fiscal_years WHERE org_id = p_org AND first_day >= v_next_first ORDER BY first_day LOOP
    IF r.name LIKE 'pending %' OR r.name ~ '^[0-9]{4}(–[0-9]{2})?( \([0-9]+\))?$' THEN
      UPDATE org_fiscal_years SET name = 'pending ' || r.first_day WHERE id = r.id;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM org_fiscal_years WHERE org_id = p_org AND name LIKE 'pending %' ORDER BY first_day LOOP
    UPDATE org_fiscal_years SET name = club_fiscal_year_free_name(p_org, r.first_day, r.last_day, r.id) WHERE id = r.id;
  END LOOP;

  UPDATE organizations SET fiscal_first_month = p_month WHERE id = p_org;

  SELECT * INTO v_next FROM org_fiscal_years WHERE id = v_next_id;
  RETURN jsonb_build_object('ok', true, 'mode', v_mode,
    'current', jsonb_build_object('name', v_cur.name, 'firstDay', v_cur.first_day, 'lastDay', v_cur.last_day),
    'next', jsonb_build_object('name', v_next.name, 'firstDay', v_next.first_day, 'lastDay', v_next.last_day),
    'thenFrom', v_next_last + 1,
    'moved', v_moved, 'split', v_split, 'joined', v_joined, 'movedFrom', v_from, 'movedTo', v_to);
END;
$$;

-- The window's one step, and its preview: the SAME work, rolled back when previewing (or refused), so the
-- counts the window shows before the save are the counts the save makes.
CREATE OR REPLACE FUNCTION public.club_fiscal_first_month_set(p_org uuid, p_month integer, p_today date, p_preview boolean)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  BEGIN
    v_result := club_fiscal_first_month_apply(p_org, p_month, p_today);
    IF p_preview OR NOT coalesce((v_result->>'ok')::boolean, false) THEN
      RAISE EXCEPTION USING ERRCODE = 'FYRBK', MESSAGE = 'club_fiscal_first_month_set: rolled back';
    END IF;
  EXCEPTION WHEN SQLSTATE 'FYRBK' THEN
    NULL;   -- the work is undone; its answer is kept
  END;
  RETURN v_result || jsonb_build_object('preview', p_preview);
END;
$$;

-- ── 10. 317's budget steps, on the fiscal year ──────────────────────────────────────────────────

-- Plan a word on a fiscal year (p_year = the year's first day): the line and its dates in ONE step, under
-- the year's lock. Codes: bad_total · bad_description · bad_year · year_closed · word_on_plan · the dates'.
DROP FUNCTION IF EXISTS public.club_budget_line_add(uuid, integer, uuid, text, numeric, text, integer, jsonb);
CREATE OR REPLACE FUNCTION public.club_budget_line_add(
  p_org         uuid,
  p_year        date,
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
  v_year     org_fiscal_years%ROWTYPE;
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

  SELECT * INTO v_year FROM club_fiscal_year_row(p_org, p_year);
  IF v_year.first_day <> p_year THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_year'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('club_budget_year:' || p_org::text || ':' || v_year.id::text, 0));
  IF club_fiscal_year_locked(v_year.id) THEN RETURN jsonb_build_object('ok', false, 'code', 'year_closed'); END IF;

  SELECT id INTO v_holder FROM org_budget_lines WHERE fiscal_year_id = v_year.id AND item_id = p_item;
  IF FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'word_on_plan', 'existingLineId', v_holder); END IF;

  INSERT INTO org_budget_lines (id, org_id, fiscal_year_id, category_id, item_id, description, total_amount, notes, sort_order)
  VALUES (v_line, p_org, v_year.id, v_category, p_item, btrim(p_description), v_total,
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

-- A line, saved in ONE step (317's contract; every argument NULL keeps what is there). Now: a closed year's
-- line is refused (`year_closed`) before anything is checked, and "a word already on the year" reads the
-- line's FISCAL YEAR.
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
  IF club_fiscal_year_locked(v_line.fiscal_year_id) THEN RETURN jsonb_build_object('ok', false, 'code', 'year_closed'); END IF;

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
     WHERE fiscal_year_id = v_line.fiscal_year_id AND item_id = p_item AND id <> p_line;
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
    SELECT id INTO v_holder FROM org_budget_lines
     WHERE fiscal_year_id = v_line.fiscal_year_id AND item_id = p_item AND id <> p_line;
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

-- Remove a line: refused on a closed year, and while an allocation is drawn from it.
CREATE OR REPLACE FUNCTION public.club_budget_line_delete(p_org uuid, p_line uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year uuid;
BEGIN
  SELECT fiscal_year_id INTO v_year FROM org_budget_lines WHERE id = p_line AND org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF club_fiscal_year_locked(v_year) THEN RETURN jsonb_build_object('ok', false, 'code', 'year_closed'); END IF;
  IF EXISTS (SELECT 1 FROM rep_cost_allocations WHERE source_budget_line_id = p_line) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'has_allocations');
  END IF;
  DELETE FROM org_budget_lines WHERE id = p_line;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Start a fiscal year from another's plan (p_from / p_to = the years' first days): every line and its dates,
-- moved on by the whole years between them. Both years must run the same months (a year shortened by a
-- change of first month has no year to copy month for month). A one-month date's stored label ("September
-- 2026") is written again from its moved date. Refused when the target already has lines, or is closed.
-- Codes: bad_year · different_months · year_closed · year_has_lines · nothing_to_copy.
DROP FUNCTION IF EXISTS public.club_budget_roll_year(uuid, integer, integer);
CREATE OR REPLACE FUNCTION public.club_budget_roll_year(p_org uuid, p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_from  org_fiscal_years%ROWTYPE;
  v_to    org_fiscal_years%ROWTYPE;
  v_years integer;
  v_count integer := 0;
  r       record;
  v_new   uuid;
BEGIN
  SELECT * INTO v_from FROM club_fiscal_year_row(p_org, p_from);
  SELECT * INTO v_to   FROM club_fiscal_year_row(p_org, p_to);
  IF v_from.first_day <> p_from OR v_to.first_day <> p_to OR p_to <= p_from THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_year');
  END IF;
  IF extract(month FROM v_from.first_day) <> extract(month FROM v_to.first_day)
     OR extract(month FROM v_from.last_day) <> extract(month FROM v_to.last_day) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'different_months');
  END IF;
  v_years := extract(year FROM v_to.first_day)::int - extract(year FROM v_from.first_day)::int;

  PERFORM pg_advisory_xact_lock(hashtextextended('club_budget_year:' || p_org::text || ':' || v_to.id::text, 0));
  IF club_fiscal_year_locked(v_to.id) THEN RETURN jsonb_build_object('ok', false, 'code', 'year_closed'); END IF;
  IF EXISTS (SELECT 1 FROM org_budget_lines WHERE fiscal_year_id = v_to.id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'year_has_lines');
  END IF;

  BEGIN
    FOR r IN
      SELECT * FROM org_budget_lines WHERE fiscal_year_id = v_from.id ORDER BY sort_order, created_at, id
    LOOP
      v_new := gen_random_uuid();
      INSERT INTO org_budget_lines (id, org_id, fiscal_year_id, category_id, item_id, description, total_amount, notes, sort_order)
      VALUES (v_new, p_org, v_to.id, r.category_id, r.item_id, r.description, r.total_amount, r.notes, r.sort_order);
      INSERT INTO org_budget_periods (budget_line_id, period_label, period_date, amount, sort_order)
      SELECT v_new,
             CASE WHEN period_date IS NOT NULL AND period_label = trim(to_char(period_date, 'FMMonth YYYY'))
                  THEN trim(to_char((period_date + make_interval(years => v_years))::date, 'FMMonth YYYY'))
                  ELSE period_label END,
             (period_date + make_interval(years => v_years))::date, amount, sort_order
        FROM org_budget_periods WHERE budget_line_id = r.id;
      v_count := v_count + 1;
    END LOOP;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'year_has_lines');
  END;

  IF v_count = 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'nothing_to_copy'); END IF;
  RETURN jsonb_build_object('ok', true, 'lines', v_count, 'id', v_to.id, 'name', v_to.name, 'firstDay', v_to.first_day);
END;
$$;

-- An allocation, its splits, installments and line link: one step (317's contract), now WITHOUT a pasted
-- ledger entry (C17: no screen reads it; old rows keep theirs). New refusals, before anything is written:
--   year_closed   — the line's fiscal year is closed, or (no line) the first installment falls due in a
--                   closed year;
--   season_closed — a team's season is not running (+ teamId): only an open season can be billed (S3C-09).
DROP FUNCTION IF EXISTS public.club_allocation_create(uuid, uuid, text, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.club_allocation_create(uuid, uuid, text, uuid, text, jsonb);
CREATE OR REPLACE FUNCTION public.club_allocation_create(
  p_org          uuid,
  p_actor        uuid,
  p_description  text,
  p_source_line  uuid,
  p_split_method text,
  p_splits       jsonb,
  p_notes        text DEFAULT NULL
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
  v_status    text;
  v_through   date;
  v_first_due date;
BEGIN
  IF p_splits IS NULL OR jsonb_typeof(p_splits) <> 'array' OR jsonb_array_length(p_splits) = 0 THEN
    RAISE EXCEPTION 'club_allocation_create: at least one split';
  END IF;
  IF p_split_method NOT IN ('even', 'percentage', 'sessions', 'fixed') THEN
    RAISE EXCEPTION 'club_allocation_create: no split method %', p_split_method;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_splits) s WHERE coalesce((s->>'amount')::numeric, 0) <= 0) THEN
    RAISE EXCEPTION 'club_allocation_create: every share above zero';
  END IF;
  SELECT sum((s->>'amount')::numeric) INTO v_shares FROM jsonb_array_elements(p_splits) s;

  -- Only an open season is billed (S3C-09): checked for every team before anything is written.
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    v_team := (v_split->>'teamId')::uuid;
    v_year := (v_split->>'programYearId')::uuid;
    SELECT y.status INTO v_status FROM rep_program_years y JOIN rep_teams t ON t.id = y.team_id
     WHERE y.id = v_year AND t.id = v_team AND t.org_id = p_org;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'club_allocation_create: team % and season % are not this club''s', v_team, v_year;
    END IF;
    -- The team's RUNNING season (rep_team_live_season — the newest draft or active one, the season its payments
    -- are carried by); an older season still marked open is not it.
    IF v_status NOT IN ('draft', 'active') OR v_year IS DISTINCT FROM rep_team_live_season(v_team) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'season_closed', 'teamId', v_team);
    END IF;
  END LOOP;

  IF p_source_line IS NOT NULL THEN
    SELECT * INTO v_line FROM org_budget_lines
     WHERE id = p_source_line AND org_id = p_org
     FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'line_not_found'); END IF;
    IF club_fiscal_year_locked(v_line.fiscal_year_id) THEN RETURN jsonb_build_object('ok', false, 'code', 'year_closed'); END IF;

    SELECT direction INTO v_direction FROM budget_items WHERE id = v_line.item_id;
    IF v_direction = 'in' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_a_cost_line'); END IF;

    v_allocated := club_line_allocated(p_source_line);
    IF v_shares > v_line.total_amount - v_allocated + 0.005 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'over_line',
        'planned', v_line.total_amount, 'allocated', v_allocated,
        'left', greatest(v_line.total_amount - v_allocated, 0));
    END IF;
  ELSE
    -- An off-plan bill counts in the year its first installment falls due.
    SELECT min((i->>'dueDate')::date) INTO v_first_due
      FROM jsonb_array_elements(p_splits) s, jsonb_array_elements(s->'installments') i;
    v_through := club_books_closed_through(p_org);
    IF v_through IS NOT NULL AND v_first_due <= v_through THEN
      RETURN jsonb_build_object('ok', false, 'code', 'year_closed');
    END IF;
  END IF;

  INSERT INTO rep_cost_allocations
    (id, org_id, description, total_amount, source_entry_id, source_budget_line_id, created_by, notes)
  VALUES
    (v_alloc, p_org, p_description, v_shares, NULL, p_source_line, p_actor, nullif(btrim(coalesce(p_notes, '')), ''));

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    v_team := (v_split->>'teamId')::uuid;
    v_year := (v_split->>'programYearId')::uuid;
    INSERT INTO rep_allocation_splits
      (allocation_id, team_id, program_year_id, org_id, amount, split_method, split_value, payment_schedule, notes)
    VALUES
      (v_alloc, v_team, v_year, p_org, (v_split->>'amount')::numeric, p_split_method,
       coalesce((v_split->>'splitValue')::numeric, 0), coalesce(v_split->>'paymentSchedule', 'standard'),
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

-- ── Grants: server-only (mig 311's rule) ────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION
  public.club_fiscal_year_name(date, date),
  public.club_fiscal_year_free_name(uuid, date, date, uuid),
  public.club_fiscal_years_chain_check(uuid),
  public.org_fiscal_years_chain_trigger(),
  public.org_fiscal_years_closed_guard(),
  public.club_fiscal_year_ensure(uuid, date),
  public.club_fiscal_year_row(uuid, date),
  public.club_books_closed_through(uuid),
  public.club_fiscal_year_locked(uuid),
  public.rep_team_live_season(uuid),
  public.rep_allocation_installments_carrier(),
  public.rep_program_years_carry_waiting(),
  public.accounting_entries_fiscal_lock(),
  public.org_budget_lines_fiscal_lock(),
  public.org_budget_periods_fiscal_lock(),
  public.club_allocation_locked(uuid),
  public.club_allocation_locked_as(uuid, uuid, uuid),
  public.accounting_ledgers_fiscal_lock(),
  public.rep_cost_allocations_fiscal_lock(),
  public.rep_allocation_splits_fiscal_lock(),
  public.rep_allocation_installments_fiscal_lock(),
  public.club_fiscal_first_held_day(uuid),
  public.club_closing_balance(uuid, date),
  public.club_fiscal_year_close(uuid, date, uuid, date, jsonb),
  public.club_fiscal_year_reopen(uuid, date, uuid, text),
  public.club_fiscal_year_rename(uuid, date, text),
  public.club_fiscal_new_start(date, date, date),
  public.club_budget_line_join(uuid, uuid),
  public.club_fiscal_first_month_apply(uuid, integer, date),
  public.club_fiscal_first_month_set(uuid, integer, date, boolean),
  public.club_budget_line_add(uuid, date, uuid, text, numeric, text, integer, jsonb),
  public.club_budget_line_save(uuid, uuid, numeric, jsonb, timestamptz, uuid, jsonb),
  public.club_budget_line_delete(uuid, uuid),
  public.club_budget_roll_year(uuid, date, date),
  public.club_allocation_create(uuid, uuid, text, uuid, text, jsonb, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.club_fiscal_year_name(date, date),
  public.club_fiscal_year_ensure(uuid, date),
  public.club_books_closed_through(uuid),
  public.club_fiscal_year_locked(uuid),
  public.club_allocation_locked(uuid),
  public.club_fiscal_first_held_day(uuid),
  public.club_closing_balance(uuid, date),
  public.club_fiscal_year_close(uuid, date, uuid, date, jsonb),
  public.club_fiscal_year_reopen(uuid, date, uuid, text),
  public.club_fiscal_year_rename(uuid, date, text),
  public.club_fiscal_first_month_set(uuid, integer, date, boolean),
  public.club_budget_line_add(uuid, date, uuid, text, numeric, text, integer, jsonb),
  public.club_budget_line_save(uuid, uuid, numeric, jsonb, timestamptz, uuid, jsonb),
  public.club_budget_line_delete(uuid, uuid),
  public.club_budget_roll_year(uuid, date, date),
  public.club_allocation_create(uuid, uuid, text, uuid, text, jsonb, text)
  TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
--      AND ((table_name = 'organizations' AND column_name = 'fiscal_first_month')
--        OR (table_name = 'org_budget_lines' AND column_name = 'fiscal_year_id')
--        OR (table_name = 'accounting_entries' AND column_name = 'written_on')
--        OR (table_name = 'rep_allocation_installments' AND column_name = 'carried_by_program_year_id'));   -- 4 rows
--   SELECT to_regclass('public.org_fiscal_years'), to_regclass('public.org_fiscal_year_reopenings'),
--          to_regclass('public.org_budget_lines_one_word_per_fiscal_year'),
--          to_regclass('public.org_budget_lines_one_line_per_item');                     -- 3 not null, the last NULL
--   SELECT count(*) FROM org_budget_lines WHERE fiscal_year_id IS NULL;                   -- 0
--   SELECT count(*) FROM rep_allocation_installments
--    WHERE (paid_at IS NOT NULL OR sent_at IS NOT NULL) AND carried_by_program_year_id IS NULL;   -- 0 at migration
--   SELECT tgname FROM pg_trigger WHERE tgname IN ('org_fiscal_years_chain', 'organizations_fiscal_first_month_chain', 'accounting_ledgers_fiscal_lock',
--     'org_fiscal_years_closed_guard', 'rep_allocation_installments_carrier', 'rep_program_years_carry_waiting',
--     'accounting_entries_fiscal_lock', 'org_budget_lines_fiscal_lock', 'org_budget_periods_fiscal_lock',
--     'rep_cost_allocations_fiscal_lock', 'rep_allocation_splits_fiscal_lock',
--     'rep_allocation_installments_fiscal_lock') ORDER BY 1;                                 -- 12 rows
--   SELECT proname, pronargs FROM pg_proc WHERE proname IN ('club_allocation_create', 'club_budget_line_add',
--     'club_budget_roll_year') ORDER BY 1;          -- one row each: 7, 8, 3 arguments (the old signatures dropped)
