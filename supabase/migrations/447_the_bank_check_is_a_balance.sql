-- ---------------------------------------------------------------
-- Migration 447 — Bank balance check BC1: a bank check is a BALANCE, not a tick-off
-- (build prompt docs/projects/active/BANK_BALANCE_CHECK_BC1_BUILD_PROMPT.md; plan BANK_RECONCILIATION_PLAN.md §4, §7,
-- §9 BC1; owner rulings 1 and 3 + drawing asks 1–10, 2026-11-05; owner asks Q1–Q3 ruled A 2026-11-05).
--
-- WHY: the owner replaced the tick-off (Appendix A) with the balance check. A treasurer types a statement's DATE and
-- BALANCE; every book line on or before that date counts by itself; the screen shows The bank says · Should be in the
-- bank · Difference, and the check SAVES whether it matches or not (ruling 3). Nobody ticks a line. The arithmetic lives
-- in lib/bank-check.ts (pure); these tables hold what a person typed, what the books said then, and who and when.
--
-- ONE END SHAPE, whatever ran before: dev has 436, 437, 439, 440 and 442; prod has 436, 437 and 439 only (440 and 442
-- are `held` in MANUAL_PROD_STEPS.json from this commit on: never apply them). Every drop is `IF EXISTS` by signature,
-- every kept function is `CREATE OR REPLACE`, so both reach the same shape. Prod held 0 rows in every bank table
-- (counted 2026-11-05 before this file was written).
--
-- THE SHAPE AFTER:
--   · bank_accounts       — unchanged but for its starting point: `opening_date`, `opening_balance_cents`, `set_up_by`,
--                           `set_up_at` and `bank_accounts_opening_pair` go (the start is a check of kind `start` now).
--                           An account set up under the tick-off keeps its starting point as that `start` row (dev only).
--                           437's team move is untouched (it moves the account; everything below hangs off it).
--   · bank_account_books  — unchanged (+ its guard trigger).
--   · bank_checks         — one saved check: the statement date and the bank's balance (the two columns it always had),
--                           `kind` start|check, the books figure on that date, the Stripe "on its way" figure (NULL = not
--                           counted: Stripe didn't answer, or a payout listed no lines), the optional cash figure, the
--                           books it counted (`book_ids`, club; Q3), who and when (created_*), and a SOFT delete
--                           (`deleted_by/at`, ask 5). One LIVE check per date; at most one live `start` per account.
--                           `status`, `checked_by/at`, `outstanding_snapshot` and the two tick constraints go.
--   · bank_check_waiting  — new: a check's "Not in the bank yet" items (ask 2), the line as it was then. `at_start` marks an
--                           item of the starting statement (Q2: "Waiting at the start").
--   · DROPPED: bank_check_marks, bank_check_added_lines, bank_check_changes, bank_line_exclusions, bank_saved_lines,
--     bank_check_events (who/when lives on the check), and every tick-era step function.
--
-- THE STEPS (all `RETURNS jsonb` {ok, code?}; a refusal is a code, never prose; service role only):
--   · bank_first_club_account, bank_club_account_of_book  — kept as they were (the second is 442's, re-made here so prod
--                                                            gets it).
--   · bank_book_move    — re-made without the tick work (the saved / kept-out rows it carried are gone), keeping R2b-3's
--                         lock order: read where the book sits (unlocked) → both accounts in id order → the book → read
--                         again (moved meanwhile = `changed`). A saved check keeps its own `book_ids` (Q3), so a move
--                         changes nothing earlier.
--   · bank_account_add  — 442's (its own advisory lock, every live club account in id order, then the insert stamped
--                         clock_timestamp(), then the moves), re-made so prod gets it.
--   · bank_check_save   — ONE step: under the account's lock, soft-delete a live check of the same date ("Check this
--                         statement again" replaces it, the old row and its who/when kept), insert the check and its
--                         waiting items. Refuses a date after the club's today, a `check` on or before the live start
--                         (O2: the start owns its date), a club check with no start, a second start on another date, a
--                         start on or after a live check, and a books list that is not the account's books now
--                         (`changed`: a book moved since the route read it). NO $0.00 gate (ruling 3).
--   · bank_check_delete — soft delete, under the account's lock; the starting statement can't go while a later check
--                         lives (ask 5).
--   · bank_books_through(p_ledgers, p_dates) — posted in − posted out, all-time through each date, in ONE pass over the
--                         books' posted lines (the status / type rule of `club_book_totals`, mig 317): the club's "Your
--                         books on D" is the start's books + through(D) − through(start date).
--
-- ⚖ NOTHING HERE WRITES MONEY (ask 1, architectural decision 1): no step touches accounting_entries or a rep money table;
--   the cash figure is a number on the check. tests/unit/bank-r2-server-guard.test.ts pins it.
--
-- Re-runnable (every step guarded). Prod order: before the promote that ships BC1's code (the Bank routes read the new
-- columns). Applied to dev 2026-11-05.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. the tick-era steps go (by signature; IF EXISTS covers prod, which never had 440's or 442's) ─────────────────
DROP FUNCTION IF EXISTS public.bank_account_set_up(uuid, uuid, date, bigint, jsonb, jsonb, uuid);
DROP FUNCTION IF EXISTS public.bank_check_start(uuid, uuid, date, bigint, uuid);
DROP FUNCTION IF EXISTS public.bank_check_refigure(uuid, uuid, uuid, date, bigint);
DROP FUNCTION IF EXISTS public.bank_check_mark(uuid, uuid, uuid, text, text[], jsonb, jsonb, uuid);
DROP FUNCTION IF EXISTS public.bank_check_undo(uuid, uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.bank_check_add_line(uuid, uuid, uuid, uuid, text, text, date, text, bigint, uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.bank_check_add_line(uuid, uuid, uuid, uuid, text, text, date, text, bigint, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.bank_check_tick(uuid, uuid, uuid, text[], jsonb, uuid);
DROP FUNCTION IF EXISTS public.bank_check_keep_out(uuid, uuid, uuid, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.bank_tick_rows(uuid, uuid, text[], jsonb, uuid);
DROP FUNCTION IF EXISTS public.bank_keep_out_rows(uuid, uuid, text, boolean, uuid);
DROP FUNCTION IF EXISTS public.bank_club_line_left(uuid, uuid, text);

-- ── 2. the tick tables go (the marks first: they hold the composite FK onto bank_checks_id_account) ─────────────────
DROP TABLE IF EXISTS public.bank_check_marks;
DROP TABLE IF EXISTS public.bank_check_added_lines;
DROP TABLE IF EXISTS public.bank_check_changes;
DROP TABLE IF EXISTS public.bank_line_exclusions;
DROP TABLE IF EXISTS public.bank_saved_lines;
DROP TABLE IF EXISTS public.bank_check_events;

-- ── 3. which account holds a book (442's, re-made so prod has it; step 4 needs it) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bank_first_club_account(p_org uuid) RETURNS uuid
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM bank_accounts
   WHERE org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL
   ORDER BY created_at, id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.bank_club_account_of_book(p_org uuid, p_ledger uuid) RETURNS uuid
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(
           (SELECT b.bank_account_id FROM bank_account_books b
              JOIN bank_accounts a ON a.id = b.bank_account_id AND a.owner_kind = 'club' AND a.archived_at IS NULL
             WHERE b.ledger_id = l.id),
           bank_first_club_account(p_org))
    FROM accounting_ledgers l
   WHERE l.id = p_ledger AND l.org_id = p_org AND l.entity_type IS DISTINCT FROM 'team'
$$;

-- ── 4. bank_checks becomes a saved balance check ────────────────────────────────────────────────────────────────────
ALTER TABLE public.bank_checks
  ADD COLUMN IF NOT EXISTS kind                      text,
  ADD COLUMN IF NOT EXISTS books_cents               bigint,
  ADD COLUMN IF NOT EXISTS on_its_way_cents          bigint,
  ADD COLUMN IF NOT EXISTS cash_not_deposited_cents  bigint,
  ADD COLUMN IF NOT EXISTS book_ids                  uuid[],
  ADD COLUMN IF NOT EXISTS deleted_by                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at                timestamptz;

-- A tick-era statement has no books figure and its ticks are gone with the tables above, so it can't be read as a balance
-- check: it goes (prod: none; dev: the stopped walk's one statement). Only while the old shape is still here (re-runnable).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'bank_checks' AND column_name = 'status') THEN
    DELETE FROM public.bank_checks WHERE books_cents IS NULL;
  END IF;
END $$;

-- An account's tick-era starting point becomes its `start` check (books = the bank then: no item, no Stripe line was
-- ever recorded with it). Only while the old columns are still here.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'opening_date') THEN
    EXECUTE $q$
      INSERT INTO public.bank_checks (bank_account_id, statement_end_date, statement_ending_balance_cents, kind,
        books_cents, on_its_way_cents, book_ids, created_by, created_at)
      SELECT a.id, a.opening_date, a.opening_balance_cents, 'start', a.opening_balance_cents, 0,
             CASE WHEN a.owner_kind = 'club' THEN
               (SELECT coalesce(array_agg(l.id ORDER BY l.id), ARRAY[]::uuid[]) FROM public.accounting_ledgers l
                 WHERE l.org_id = a.org_id AND l.entity_type IN ('org', 'tournament', 'league_season')
                   AND public.bank_club_account_of_book(a.org_id, l.id) = a.id)
             END,
             a.set_up_by, coalesce(a.set_up_at, now())
        FROM public.bank_accounts a
       WHERE a.opening_date IS NOT NULL AND a.opening_balance_cents IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.bank_checks c WHERE c.bank_account_id = a.id AND c.books_cents IS NOT NULL)
    $q$;
  END IF;
END $$;

ALTER TABLE public.bank_checks
  DROP CONSTRAINT IF EXISTS bank_checks_checked_has_when,
  DROP CONSTRAINT IF EXISTS bank_checks_id_account,
  DROP CONSTRAINT IF EXISTS bank_checks_one_per_end_date;
DROP INDEX IF EXISTS public.bank_checks_checked_by_idx;
ALTER TABLE public.bank_checks
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS checked_by,
  DROP COLUMN IF EXISTS checked_at,
  DROP COLUMN IF EXISTS outstanding_snapshot;

ALTER TABLE public.bank_checks
  ALTER COLUMN kind SET DEFAULT 'check',
  ALTER COLUMN kind SET NOT NULL,
  ALTER COLUMN books_cents SET NOT NULL;

ALTER TABLE public.bank_checks DROP CONSTRAINT IF EXISTS bank_checks_kind;
ALTER TABLE public.bank_checks ADD CONSTRAINT bank_checks_kind CHECK (kind IN ('start', 'check'));
-- Cash is a check's figure only (ask 1); the start is a date and a balance (ask 7). A typed 0 is stored as no figure.
ALTER TABLE public.bank_checks DROP CONSTRAINT IF EXISTS bank_checks_cash_shape;
ALTER TABLE public.bank_checks ADD CONSTRAINT bank_checks_cash_shape
  CHECK (cash_not_deposited_cents IS NULL OR (kind = 'check' AND cash_not_deposited_cents > 0));
-- Who deleted it is kept with when; the person may later be removed (SET NULL), the when never.
ALTER TABLE public.bank_checks DROP CONSTRAINT IF EXISTS bank_checks_deleted_shape;
ALTER TABLE public.bank_checks ADD CONSTRAINT bank_checks_deleted_shape CHECK (deleted_by IS NULL OR deleted_at IS NOT NULL);

-- One LIVE check per statement date (re-checking a date soft-deletes the old one in the same step), one live start.
CREATE UNIQUE INDEX IF NOT EXISTS bank_checks_one_live_per_date ON public.bank_checks (bank_account_id, statement_end_date)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bank_checks_one_live_start ON public.bank_checks (bank_account_id)
  WHERE kind = 'start' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bank_checks_deleted_by_idx ON public.bank_checks (deleted_by) WHERE deleted_by IS NOT NULL;
-- The non-partial cover of the FK (dba 2026-11-05): the cascade from bank_accounts and a history read that includes
-- deleted rows can't use the partial unique above (the dropped bank_checks_one_per_end_date used to be this cover).
CREATE INDEX IF NOT EXISTS bank_checks_account_idx ON public.bank_checks (bank_account_id, statement_end_date);

COMMENT ON TABLE public.bank_checks IS 'Bank balance check (mig 436, reshaped by mig 447): one saved check of a bank account against a statement — the bank''s balance on a date, the books then, Stripe on its way (NULL = not counted), the cash figure, the books counted (club). kind start = the club account''s starting statement. Saved whether it matches or not; figures never change; soft delete. Service role only.';
COMMENT ON COLUMN public.bank_checks.statement_ending_balance_cents IS 'The bank says: the balance the statement prints on statement_end_date (may be negative: overdrawn).';
COMMENT ON COLUMN public.bank_checks.books_cents IS 'Your books on the date, as figured when saved (club: the start''s books + posted movement of book_ids after the start through the date; start: the bank balance solved through its waiting items and on-its-way; coach: the season opening + settled cash-moving rows through the date). Never re-written: "Books now say" is derived on read.';
COMMENT ON COLUMN public.bank_checks.on_its_way_cents IS 'Club online-payment book lines on or before the date that had not been paid out by then (signed net, processing lines included). NULL = not counted (Stripe did not answer, or a payout listed no lines). 0 = none (or no Stripe line at all).';
COMMENT ON COLUMN public.bank_checks.book_ids IS 'Club: the books this check counted, as placed when saved (Q3: a later book move changes nothing earlier). NULL for a team account.';

-- ── 5. a check's "Not in the bank yet" items (ask 2; Q2's "Waiting at the start") ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_check_waiting (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id      uuid NOT NULL REFERENCES public.bank_checks(id) ON DELETE CASCADE,
  line_key      text NOT NULL CHECK (char_length(line_key) BETWEEN 3 AND 200),
  line_date     date NOT NULL,
  label         text CHECK (label IS NULL OR (label = btrim(label) AND char_length(label) BETWEEN 1 AND 200)),
  amount_cents  bigint NOT NULL CHECK (amount_cents > 0),
  direction     text NOT NULL CHECK (direction IN ('in', 'out')),
  at_start      boolean NOT NULL DEFAULT false,
  CONSTRAINT bank_check_waiting_once UNIQUE (check_id, line_key)
);
COMMENT ON TABLE public.bank_check_waiting IS 'Bank balance check (mig 447): a saved check''s "Not in the bank yet" items, the line as it was then (a money-out line adds to Should be in the bank, a money-in line subtracts). They belong to that check only; the next check asks "Still waiting?" from the latest earlier check''s items. Service role only.';
COMMENT ON COLUMN public.bank_check_waiting.line_key IS 'entry:{accounting_entries.id} (club) | a settled coach register row id (coach, BC6).';
COMMENT ON COLUMN public.bank_check_waiting.at_start IS 'An item of the starting statement (Q2, "Waiting at the start": written before the start and cashed after it). Always true on a start check''s items, never on a check''s (bank_check_save).';

-- ── 6. the account's starting point goes (it is the `start` check now) ─────────────────────────────────────────────
ALTER TABLE public.bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_opening_pair;
DROP INDEX IF EXISTS public.bank_accounts_set_up_by_idx;
ALTER TABLE public.bank_accounts
  DROP COLUMN IF EXISTS opening_date,
  DROP COLUMN IF EXISTS opening_balance_cents,
  DROP COLUMN IF EXISTS set_up_by,
  DROP COLUMN IF EXISTS set_up_at;
COMMENT ON TABLE public.bank_accounts IS 'Bank balance check (mig 436; mig 447 moved its starting point to a start check): a bank account a club or a team checks statements against. A NAME, never a number. Team: exactly one, belongs to the team (not a season). Service role only.';

-- ── 7. a book moves (R2b-3's lock order, the tick work gone) ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bank_book_move(p_org uuid, p_ledger uuid, p_to uuid, p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_ledger accounting_ledgers%ROWTYPE;
  v_from   uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = p_to AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_found');
  END IF;
  SELECT * INTO v_ledger FROM accounting_ledgers WHERE id = p_ledger AND org_id = p_org;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'book_not_found'); END IF;
  IF v_ledger.entity_type = 'team' THEN RETURN jsonb_build_object('ok', false, 'code', 'team_book'); END IF;

  -- 1. Where the book sits now, read without a lock: it only names the accounts to lock.
  v_from := bank_club_account_of_book(p_org, p_ledger);
  IF v_from IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'changed'); END IF;
  IF v_from = p_to THEN RETURN jsonb_build_object('ok', true, 'unchanged', true); END IF;

  -- 2. Both accounts, in id order (the lock bank_check_save and bank_check_delete take), THEN the book. Never the book
  --    before an account (R2b-3).
  PERFORM 1 FROM bank_accounts WHERE id IN (v_from, p_to) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM bank_accounts WHERE id = p_to AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  PERFORM 1 FROM accounting_ledgers WHERE id = p_ledger FOR UPDATE;

  -- 3. Read again under the locks: moved meanwhile (a second tab, a second person) → the route reads again.
  IF bank_club_account_of_book(p_org, p_ledger) IS DISTINCT FROM v_from THEN
    RETURN jsonb_build_object('ok', false, 'code', 'changed');
  END IF;

  -- The guard trigger (mig 436) raises bank_book_not_club_account / bank_book_is_team_book / bank_book_other_club.
  -- Nothing else moves: a saved check keeps the books it counted (Q3), and its waiting items are its own.
  INSERT INTO bank_account_books (ledger_id, bank_account_id, moved_by, moved_at)
  VALUES (p_ledger, p_to, p_actor, now())
  ON CONFLICT (ledger_id) DO UPDATE SET bank_account_id = EXCLUDED.bank_account_id, moved_by = EXCLUDED.moved_by,
    moved_at = EXCLUDED.moved_at;
  RETURN jsonb_build_object('ok', true, 'from', v_from);
END $$;

CREATE OR REPLACE FUNCTION public.bank_account_add(p_org uuid, p_name text, p_ledgers uuid[], p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_name  text := btrim(coalesce(p_name, ''));
  v_id    uuid;
  v_first boolean;
  v_l     uuid;
  v_r     jsonb;
BEGIN
  IF char_length(v_name) NOT BETWEEN 1 AND 80 THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_name'); END IF;
  -- One account added at a time per club, so two "first" accounts can't race into being. Its own lock, NOT the club row
  -- (R2b-3 review 2026-11-05): changing the club's first fiscal month holds the books' lock and then the club row, so
  -- holding the club row while waiting for an account below would close a three-way deadlock.
  PERFORM pg_advisory_xact_lock(hashtextextended('bank_accounts_add:' || p_org::text, 0));
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'org_not_found');
  END IF;
  -- Every account a move below can name, in id order, BEFORE any book and before the insert (which key-shares the club
  -- row): each move's own pair lock is then one already held, so this step takes accounts → books once.
  IF cardinality(coalesce(p_ledgers, ARRAY[]::uuid[])) > 0 THEN
    PERFORM 1 FROM bank_accounts WHERE org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL ORDER BY id FOR UPDATE;
  END IF;
  IF EXISTS (SELECT 1 FROM bank_accounts WHERE org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL
              AND lower(name) = lower(v_name)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'name_taken');
  END IF;
  v_first := bank_first_club_account(p_org) IS NULL;
  -- Stamped when it is written, not when its transaction began: the club's first account is the one ADDED first.
  INSERT INTO bank_accounts (org_id, owner_kind, name, created_by, created_at)
  VALUES (p_org, 'club', v_name, p_actor, clock_timestamp())
  RETURNING id INTO v_id;
  -- The first account holds every club book by default (no mapping rows); a later one takes the books it names.
  IF NOT v_first AND cardinality(coalesce(p_ledgers, ARRAY[]::uuid[])) > 0 THEN
    FOREACH v_l IN ARRAY p_ledgers LOOP
      v_r := bank_book_move(p_org, v_l, v_id, p_actor);
      IF NOT (v_r->>'ok')::boolean THEN
        RAISE EXCEPTION 'bank_step_refused:%', v_r->>'code';
      END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'first', v_first);
END $$;

-- ── 8. the books through a set of dates, in one pass ────────────────────────────────────────────────────────────────
-- Posted in − posted out, ALL-TIME through each date, in integer cents (club_book_totals' rule, mig 317: income and
-- transfer_in in, expense and transfer_out out; pending and void move nothing). A transfer between two of the books nets
-- to nothing by itself. The caller figures "movement after the start through D" as through(D) − through(start date).
CREATE OR REPLACE FUNCTION public.bank_books_through(p_ledgers uuid[], p_dates date[])
RETURNS TABLE (through_date date, net_cents bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  -- MATERIALIZED (dba 2026-11-05): referenced once each, these CTEs would otherwise be inlined into the per-date lookup
  -- below and the window re-run over every posted line once per asked date. Materialized, the lines are read ONCE.
  WITH asked AS (
    SELECT DISTINCT d FROM unnest(coalesce(p_dates, ARRAY[]::date[])) AS d WHERE d IS NOT NULL
  ), daily AS MATERIALIZED (
    SELECT e.entry_date,
           sum(CASE WHEN e.entry_type IN ('income', 'transfer_in') THEN e.amount ELSE -e.amount END) AS net
      FROM accounting_entries e
     WHERE e.ledger_id = ANY (coalesce(p_ledgers, ARRAY[]::uuid[])) AND e.status = 'posted'
       AND e.entry_date <= (SELECT max(d) FROM asked)
     GROUP BY e.entry_date
  ), run AS MATERIALIZED (
    SELECT entry_date, sum(net) OVER (ORDER BY entry_date) AS cum FROM daily
  )
  SELECT a.d,
         coalesce(round(100 * (SELECT r.cum FROM run r WHERE r.entry_date <= a.d ORDER BY r.entry_date DESC LIMIT 1))::bigint, 0)
    FROM asked a
$$;

-- ── 9. save a check, delete a check ─────────────────────────────────────────────────────────────────────────────────
-- The route has figured everything (lib/bank-check.ts, on the server's own read: rule 6) and read every waiting item's
-- figures from the books; this writes them in one step under the account's lock and re-checks the facts a race could
-- change. p_waiting: [{key, date, label?, amountCents, direction}]. p_book_ids: club, the books the figure counted (must
-- be the account's books now); team, NULL.
CREATE OR REPLACE FUNCTION public.bank_check_save(
  p_org uuid, p_account uuid, p_kind text, p_date date, p_bank_cents bigint, p_books_cents bigint,
  p_on_its_way_cents bigint, p_cash_cents bigint, p_book_ids uuid[], p_waiting jsonb, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_acct   bank_accounts%ROWTYPE;
  v_start  bank_checks%ROWTYPE;
  v_old    uuid;
  v_id     uuid;
  v_books  uuid[];
  v_today  date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_item   jsonb;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('start', 'check') THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_kind'); END IF;
  IF p_date IS NULL OR p_bank_cents IS NULL OR p_books_cents IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_figures');
  END IF;
  IF p_waiting IS NOT NULL AND jsonb_typeof(p_waiting) <> 'array' THEN RAISE EXCEPTION 'bank_step_refused:bad_item'; END IF;
  IF p_cash_cents IS NOT NULL AND (p_kind <> 'check' OR p_cash_cents <= 0) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_amount');
  END IF;

  SELECT * INTO v_acct FROM bank_accounts WHERE id = p_account AND org_id = p_org AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  -- A bank can't have printed a statement dated after today (the club's day, lib/timezone.ts ORG_TIME_ZONE).
  IF p_date > v_today THEN RETURN jsonb_build_object('ok', false, 'code', 'ends_in_future'); END IF;

  IF v_acct.owner_kind = 'club' THEN
    -- The books the route figured over must be the account's books NOW. Under this account's lock that holds until the
    -- step ends: a book move locks this account before it moves anything.
    SELECT coalesce(array_agg(l.id ORDER BY l.id), ARRAY[]::uuid[]) INTO v_books FROM accounting_ledgers l
     WHERE l.org_id = p_org AND l.entity_type IN ('org', 'tournament', 'league_season')
       AND bank_club_account_of_book(p_org, l.id) = p_account;
    IF (SELECT coalesce(array_agg(DISTINCT b ORDER BY b), ARRAY[]::uuid[]) FROM unnest(coalesce(p_book_ids, ARRAY[]::uuid[])) b)
       IS DISTINCT FROM v_books THEN
      RETURN jsonb_build_object('ok', false, 'code', 'changed');
    END IF;
  ELSE
    -- A team account counts the season's register, never a club book; it has no starting statement (the season's
    -- opening balance is its start, ask 7).
    IF p_book_ids IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_figures'); END IF;
    IF p_kind = 'start' THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_kind'); END IF;
    v_books := NULL;
  END IF;

  SELECT * INTO v_start FROM bank_checks WHERE bank_account_id = p_account AND kind = 'start' AND deleted_at IS NULL;
  IF p_kind = 'start' THEN
    -- One starting statement: re-saving it on its own date replaces it; another date is refused (no "move the start").
    IF v_start.id IS NOT NULL AND v_start.statement_end_date <> p_date THEN
      RETURN jsonb_build_object('ok', false, 'code', 'start_exists');
    END IF;
    IF EXISTS (SELECT 1 FROM bank_checks WHERE bank_account_id = p_account AND kind = 'check' AND deleted_at IS NULL
                AND statement_end_date <= p_date) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'start_after_checks');
    END IF;
  ELSIF v_acct.owner_kind = 'club' THEN
    IF v_start.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'no_start'); END IF;
    -- O2: the start owns its date; a check is after it.
    IF p_date <= v_start.statement_end_date THEN RETURN jsonb_build_object('ok', false, 'code', 'before_start'); END IF;
  END IF;

  -- "Check this statement again": the live check of this date goes (soft: its figures and who/when are kept).
  UPDATE bank_checks SET deleted_at = now(), deleted_by = p_actor
   WHERE bank_account_id = p_account AND statement_end_date = p_date AND deleted_at IS NULL
   RETURNING id INTO v_old;

  INSERT INTO bank_checks (bank_account_id, statement_end_date, statement_ending_balance_cents, kind, books_cents,
    on_its_way_cents, cash_not_deposited_cents, book_ids, created_by)
  VALUES (p_account, p_date, p_bank_cents, p_kind, p_books_cents, p_on_its_way_cents, p_cash_cents, v_books, p_actor)
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_waiting, '[]'::jsonb)) LOOP
    -- A waiting item is a line in the books on the statement's date: never dated after it.
    -- A key the item's own CHECK would refuse is a coded refusal here, never a raw 23502/23514 (dba 2026-11-05). A key
    -- given twice is refused by bank_check_waiting_once (23505), which refusalOfDbError reads as bad_item.
    IF coalesce(char_length(v_item->>'key'), 0) NOT BETWEEN 3 AND 200
       OR (v_item->>'date') IS NULL OR (v_item->>'date')::date > p_date
       OR coalesce(v_item->>'direction', '') NOT IN ('in', 'out')
       OR coalesce((v_item->>'amountCents')::bigint, 0) <= 0 THEN
      RAISE EXCEPTION 'bank_step_refused:bad_item';
    END IF;
    INSERT INTO bank_check_waiting (check_id, line_key, line_date, label, amount_cents, direction, at_start)
    VALUES (v_id, v_item->>'key', (v_item->>'date')::date,
            nullif(btrim(left(coalesce(v_item->>'label', ''), 200)), ''),
            (v_item->>'amountCents')::bigint, v_item->>'direction', p_kind = 'start');
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'replaced', v_old);
END $$;

CREATE OR REPLACE FUNCTION public.bank_check_delete(p_org uuid, p_account uuid, p_check uuid, p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_check bank_checks%ROWTYPE;
BEGIN
  PERFORM 1 FROM bank_accounts WHERE id = p_account AND org_id = p_org AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  SELECT * INTO v_check FROM bank_checks WHERE id = p_check AND bank_account_id = p_account AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'check_not_found'); END IF;
  -- Ask 5: the starting statement can't go while a later check stands on it.
  IF v_check.kind = 'start' AND EXISTS (SELECT 1 FROM bank_checks WHERE bank_account_id = p_account AND kind = 'check'
                                         AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'start_has_checks');
  END IF;
  UPDATE bank_checks SET deleted_at = now(), deleted_by = p_actor WHERE id = p_check;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ── 10. access: the server only (DATA_DICTIONARY maintenance rule 7) ────────────────────────────────────────────────
ALTER TABLE public.bank_check_waiting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bank_check_waiting FROM anon, authenticated;
-- The server's own access (Supabase stopped auto-granting new tables 2026-10-30; tests/unit/migration-table-grants-guard.test.ts).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_check_waiting TO service_role;

REVOKE ALL ON FUNCTION public.bank_first_club_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_club_account_of_book(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_book_move(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_account_add(uuid, text, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_books_through(uuid[], date[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_save(uuid, uuid, text, date, bigint, bigint, bigint, bigint, uuid[], jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_delete(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_first_club_account(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_club_account_of_book(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_book_move(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_account_add(uuid, text, uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_books_through(uuid[], date[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_save(uuid, uuid, text, date, bigint, bigint, bigint, bigint, uuid[], jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_delete(uuid, uuid, uuid, uuid) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'bank\_%';      -- 4
--   SELECT string_agg(proname, ',' ORDER BY proname) FROM pg_proc WHERE proname LIKE 'bank\_%';
--     -- bank_account_add,bank_account_books_guard,bank_book_move,bank_books_through,bank_check_delete,bank_check_save,
--     -- bank_club_account_of_book,bank_first_club_account
--   SELECT count(*) FROM information_schema.columns WHERE table_name = 'bank_accounts' AND column_name LIKE 'opening%'; -- 0
--   SELECT count(*) FROM information_schema.columns WHERE table_name = 'bank_checks'
--      AND column_name IN ('kind','books_cents','on_its_way_cents','cash_not_deposited_cents','book_ids','deleted_by','deleted_at'); -- 7
