-- ---------------------------------------------------------------
-- Migration 442 — Bank reconciliation R2b-3: a book move can't race a tick, a keep-out or a bank fee
-- (build prompt docs/projects/active/BANK_RECONCILIATION_R2_BUILD_PROMPT.md chunk R2b-3; plan
-- BANK_RECONCILIATION_PLAN.md §7 R2; owner yes 2026-11-05 after R2b-2's review).
--
-- WHY: `bank_book_move` (mig 439) moved a book's "didn't go through the bank" rows and picked opening items holding only
-- the BOOK's lock, never the accounts'. Every other bank step holds the ACCOUNT's lock (mig 439, 440). So with two people
-- at once: a keep-out could stay behind on the old account (lost on the new one), a "Put it back" could miss (the move had
-- already carried the row) and still answer ok, a tick planned before the move could land on the old account's statement
-- for a line whose book just left, and a bank fee could pass "is this book the account's?" just before the move and book
-- into a book that is no longer its. R2c's Move a book window makes the move reachable; this closes it first.
--
-- THE ONE LOCK ORDER (every bank step, after this migration): the club's "add an account" lock (an advisory lock, only
-- `bank_account_add`) → the account(s), in id order → the statement → the book. ⚠ The move used to take the book FIRST;
-- adding the account locks AFTER it would deadlock against `bank_check_add_line`, which holds the account and then needs
-- the book (its book-line insert takes a key-share on the ledger). So the move now reads where the book sits (unlocked),
-- locks both accounts in id order, then the book, then reads again: moved meanwhile → `changed` (the route reads again).
--   Checked for this migration (recorded in the plan): nothing else writes bank_saved_lines, bank_line_exclusions or
--   bank_check_marks (the only writers are mig 439's and 440's steps, all under the account lock; lib/ and app/ only read
--   them, guard §5); the mig 436 guard trigger on bank_account_books only SELECTs (no lock).
--   ⚠ No bank step holds the club ROW while it waits for an account (review 2026-11-05): the fee step holds an account and
--   its book-line insert then waits on the fiscal-year lock's SHARED advisory lock on the club's books (mig 318's
--   trigger), and changing the club's first fiscal month holds that lock EXCLUSIVE and then locks the club row. So
--   `bank_account_add`, which used to serialize on the club row, now serializes on its own advisory lock, locks every live
--   club account it may move from in id order (else its moves took (A, new) → book 1 → (B, new), a book before an
--   account), and only then inserts (the insert key-shares the club row, after the accounts, never before).
--
-- THE CHANGES (functions only, `CREATE OR REPLACE` with the SAME signatures, so no route changes):
--   · bank_club_account_of_book (new) — the ONE home of "which club account holds this book": its mapping row to a live
--                                        club account, else the club's first account; NULL for a team book or another
--                                        club's. Replaces the copies inline in bank_book_move and bank_check_add_line.
--   · bank_club_line_left (new)       — an `entry:` line that LEFT this account: it exists and its book is not this
--                                        account's. Any other key, or a line the books no longer have (a saved copy stands
--                                        in for it), has not left.
--   · bank_book_move       — accounts (id order) → book → read again (above).
--   · bank_account_add     — its own advisory lock (not the club row), every live club account in id order, then the
--                            insert (stamped `clock_timestamp()`, so "the first account" is the one added first), then the moves.
--   · bank_account_set_up  — a picked starting-point item that left with its book is `changed` (the route reads again).
--   · bank_check_add_line  — asks bank_club_account_of_book (same behaviour, same `book_not_in_account`).
--   · bank_check_tick      — the club's: no line it would tick (a plain line, each payout member) may have left this
--                            account (`bank_club_line_left`), asked under the account lock before anything is written;
--                            else `changed`. A `payout:` key is the payout's own (its members carry the check); a
--                            `typed:` key is the account's own saved line. An untick is never refused for this.
--   · bank_check_keep_out  — the club's: the same for the one line kept out or put back.
--   · bank_keep_out_rows   — the owner-agnostic half: a "Put it back" that removes nothing is `changed`, not ok (the route
--                            read the row, so a book move or a second tab moved it).
-- The two club wrappers carry the "this account's line" rule, not the owner-agnostic halves: a coach account's keys are
-- register rows, and R4's team wrapper will have its own rule.
--
-- No new refusal code (`changed`, `book_not_in_account` exist with words and statuses). No table, column or row change.
-- Service role only (revoked from PUBLIC, anon and authenticated). Re-runnable. Needs 436, 439 and 440. Prod order: with
-- 436, 437, 439 and 440, before the promote that ships R2.
-- ---------------------------------------------------------------

BEGIN;

-- ── which account holds a book: ONE home ─────────────────────────────────────────────────────────

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

-- Has this `entry:{uuid}` line LEFT the account? Only when the line exists and its book is not this account's (another
-- account's, a team's, another club's). A key of any other kind has not, and nor has a line the books no longer have: a
-- saved copy (a checked statement's outstanding list, the carried list, a starting-point item) stands in for it and it
-- stays this account's to tick, keep out or put back (review 2026-11-05: refusing it looped `changed` for ever). The
-- key's shape is checked before the cast, so a stray key is "not left", never an error.
CREATE OR REPLACE FUNCTION public.bank_club_line_left(p_org uuid, p_account uuid, p_key text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounting_entries e
     WHERE e.id = (CASE WHEN p_key ~* '^entry:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                        THEN substr(p_key, 7)::uuid END)
       AND bank_club_account_of_book(p_org, e.ledger_id) IS DISTINCT FROM p_account)
$$;

-- ── a book moves: the accounts first ─────────────────────────────────────────────────────────────

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

  -- 2. Both accounts, in id order (the lock every tick, keep-out, Mark checked, Undo and fee step takes), THEN the book.
  PERFORM 1 FROM bank_accounts WHERE id IN (v_from, p_to) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM bank_accounts WHERE id = p_to AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  PERFORM 1 FROM accounting_ledgers WHERE id = p_ledger FOR UPDATE;

  -- 3. Read again under the locks: moved meanwhile (a second tab, a second person) → the route reads again.
  IF bank_club_account_of_book(p_org, p_ledger) IS DISTINCT FROM v_from THEN
    RETURN jsonb_build_object('ok', false, 'code', 'changed');
  END IF;

  -- The guard trigger (mig 436) raises bank_book_not_club_account / bank_book_is_team_book / bank_book_other_club.
  INSERT INTO bank_account_books (ledger_id, bank_account_id, moved_by, moved_at)
  VALUES (p_ledger, p_to, p_actor, now())
  ON CONFLICT (ledger_id) DO UPDATE SET bank_account_id = EXCLUDED.bank_account_id, moved_by = EXCLUDED.moved_by,
    moved_at = EXCLUDED.moved_at;

  -- Ask 13: its lines not yet ticked move with it — and so does what the old account decided about them (an item
  -- picked as outstanding at the start, a "didn't go through the bank"). A ticked line stays on the old account's
  -- checks, and so do its decisions. A row the new account already holds for the same line is kept, the old dropped.
  -- Both accounts are locked, so no tick or keep-out lands on either while these rows move.
  UPDATE bank_saved_lines s SET bank_account_id = p_to
   WHERE s.bank_account_id = v_from AND s.kind = 'opening_picked'
     AND s.line_key IN (SELECT 'entry:' || e.id::text FROM accounting_entries e WHERE e.ledger_id = p_ledger)
     AND NOT EXISTS (SELECT 1 FROM bank_check_marks m WHERE m.bank_account_id = v_from AND m.line_key = s.line_key)
     AND NOT EXISTS (SELECT 1 FROM bank_saved_lines t WHERE t.bank_account_id = p_to AND t.line_key = s.line_key);
  UPDATE bank_line_exclusions x SET bank_account_id = p_to
   WHERE x.bank_account_id = v_from
     AND x.line_key IN (SELECT 'entry:' || e.id::text FROM accounting_entries e WHERE e.ledger_id = p_ledger)
     AND NOT EXISTS (SELECT 1 FROM bank_check_marks m WHERE m.bank_account_id = v_from AND m.line_key = x.line_key)
     AND NOT EXISTS (SELECT 1 FROM bank_line_exclusions t WHERE t.bank_account_id = p_to AND t.line_key = x.line_key);
  -- What the new account already held for the same line wins; the old account's copy goes.
  DELETE FROM bank_saved_lines s
   WHERE s.bank_account_id = v_from AND s.kind = 'opening_picked'
     AND s.line_key IN (SELECT 'entry:' || e.id::text FROM accounting_entries e WHERE e.ledger_id = p_ledger)
     AND NOT EXISTS (SELECT 1 FROM bank_check_marks m WHERE m.bank_account_id = v_from AND m.line_key = s.line_key);
  DELETE FROM bank_line_exclusions x
   WHERE x.bank_account_id = v_from
     AND x.line_key IN (SELECT 'entry:' || e.id::text FROM accounting_entries e WHERE e.ledger_id = p_ledger)
     AND NOT EXISTS (SELECT 1 FROM bank_check_marks m WHERE m.bank_account_id = v_from AND m.line_key = x.line_key);

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
  -- (review 2026-11-05): changing the club's first fiscal month holds the books' lock and then the club row, and the fee
  -- step holds an account and then waits on the books' lock, so holding the club row while waiting for an account below
  -- closed a three-way deadlock.
  PERFORM pg_advisory_xact_lock(hashtextextended('bank_accounts_add:' || p_org::text, 0));
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'org_not_found');
  END IF;
  -- Every account a move below can name, in id order, BEFORE any book and before the insert (which key-shares the club
  -- row): each move's own pair lock is then one already held, so this step takes accounts → books once. No account can
  -- appear after this lock (only this step adds one, under the lock above).
  IF cardinality(coalesce(p_ledgers, ARRAY[]::uuid[])) > 0 THEN
    PERFORM 1 FROM bank_accounts WHERE org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL ORDER BY id FOR UPDATE;
  END IF;
  IF EXISTS (SELECT 1 FROM bank_accounts WHERE org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL
              AND lower(name) = lower(v_name)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'name_taken');
  END IF;
  v_first := bank_first_club_account(p_org) IS NULL;
  -- Stamped when it is written, not when its transaction began: the club's first account is the one ADDED first, so a
  -- slower add that started earlier can't become "first" after the fact (review 2026-11-05).
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

-- ── the starting point: a picked item must still be this account's (mig 439, one check added) ────

CREATE OR REPLACE FUNCTION public.bank_account_set_up(
  p_org uuid, p_account uuid, p_opening_date date, p_opening_balance_cents bigint, p_picked jsonb, p_typed jsonb,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_acct bank_accounts%ROWTYPE;
  v_item jsonb;
  v_id   uuid;
BEGIN
  SELECT * INTO v_acct FROM bank_accounts
   WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  -- Rule 2: the starting point is fixed once a statement starts from it.
  IF EXISTS (SELECT 1 FROM bank_checks WHERE bank_account_id = p_account) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'statements_exist');
  END IF;
  IF p_opening_date IS NULL OR p_opening_balance_cents IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_start');
  END IF;
  -- R2b-3 (review 2026-11-05): the route read the account's books before this step; a picked item whose book has moved
  -- to another account since is not this account's to start from (it would sit here and never on the account that holds
  -- it). Under this account's lock the answer holds: a book move takes this lock first.
  IF jsonb_typeof(p_picked) = 'array' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_picked) i WHERE bank_club_line_left(p_org, p_account, i->>'key')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'changed');
  END IF;

  UPDATE bank_accounts SET opening_date = p_opening_date, opening_balance_cents = p_opening_balance_cents,
    set_up_by = p_actor, set_up_at = now()
   WHERE id = p_account;
  -- The list is the WHOLE list each time it is saved (a setting-up account can be saved again until it has a statement).
  DELETE FROM bank_saved_lines WHERE bank_account_id = p_account AND kind IN ('opening_picked', 'opening_typed');

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_picked, '[]'::jsonb)) LOOP
    IF coalesce(v_item->>'key', '') NOT LIKE 'entry:%' THEN RAISE EXCEPTION 'bank_step_refused:bad_item'; END IF;
    INSERT INTO bank_saved_lines (bank_account_id, kind, line_key, line_date, direction, amount_cents, description, saved_by)
    VALUES (p_account, 'opening_picked', v_item->>'key', (v_item->>'date')::date, v_item->>'direction',
      (v_item->>'amountCents')::bigint, nullif(btrim(left(coalesce(v_item->>'description', ''), 200)), ''), p_actor)
    ON CONFLICT (bank_account_id, line_key) DO NOTHING;
  END LOOP;
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_typed, '[]'::jsonb)) LOOP
    -- Rule 5: the uuid first, and the key IS it.
    v_id := gen_random_uuid();
    INSERT INTO bank_saved_lines (id, bank_account_id, kind, line_key, line_date, direction, amount_cents, description, saved_by)
    VALUES (v_id, p_account, 'opening_typed', 'typed:' || v_id::text, (v_item->>'date')::date, v_item->>'direction',
      (v_item->>'amountCents')::bigint, btrim(v_item->>'description'), p_actor);
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ── a line added from a statement: the one home of "this account's book" ─────────────────────────

CREATE OR REPLACE FUNCTION public.bank_check_add_line(
  p_org uuid, p_account uuid, p_check uuid, p_ledger uuid, p_kind text, p_entry_type text, p_day date,
  p_description text, p_amount_cents bigint, p_category uuid, p_item uuid, p_actor uuid, p_payout_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_check  bank_checks%ROWTYPE;
  v_ledger accounting_ledgers%ROWTYPE;
  v_entry  uuid;
  v_key    text;
BEGIN
  IF p_kind NOT IN ('bank_fee', 'interest', 'payment_processing') THEN RAISE EXCEPTION 'bank_check_add_line: kind %', p_kind; END IF;
  IF p_entry_type NOT IN ('income', 'expense') THEN RAISE EXCEPTION 'bank_check_add_line: entry type %', p_entry_type; END IF;
  IF p_payout_key IS NOT NULL AND (p_kind <> 'payment_processing' OR p_payout_key NOT LIKE 'payout:%') THEN
    RAISE EXCEPTION 'bank_check_add_line: payout key % for kind %', p_payout_key, p_kind;
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 OR p_day IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_amount');
  END IF;
  PERFORM 1 FROM bank_accounts
   WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  SELECT * INTO v_check FROM bank_checks WHERE id = p_check AND bank_account_id = p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'check_not_found'); END IF;
  IF v_check.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_open'); END IF;
  -- One payment-processing line per payout per statement (a double tap, or a second tab, books nothing twice).
  IF p_payout_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM bank_check_added_lines a JOIN bank_check_marks m ON m.check_id = a.check_id AND m.line_key = a.line_key
     WHERE a.check_id = p_check AND a.kind = 'payment_processing' AND m.payout_key = p_payout_key
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_processing_gap');
  END IF;
  SELECT * INTO v_ledger FROM accounting_ledgers WHERE id = p_ledger AND org_id = p_org;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'book_not_found'); END IF;
  IF v_ledger.entity_type = 'team' THEN RETURN jsonb_build_object('ok', false, 'code', 'team_book'); END IF;
  -- The book must be THIS account's. Under this account's lock that answer holds until the step ends: a book move takes
  -- this lock before it moves anything (R2b-3).
  IF bank_club_account_of_book(p_org, p_ledger) IS DISTINCT FROM p_account THEN
    RETURN jsonb_build_object('ok', false, 'code', 'book_not_in_account');
  END IF;

  -- The fiscal-year lock (mig 318) raises year_closed here for a closed day: the whole step rolls back.
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, category,
    budget_category_id, budget_item_id, created_by)
  VALUES (p_ledger, p_day, left(btrim(p_description), 500), round(p_amount_cents / 100.0, 2), p_entry_type, 'posted', NULL,
    p_category, p_item, p_actor)
  RETURNING id INTO v_entry;
  v_key := 'entry:' || v_entry::text;
  INSERT INTO bank_check_added_lines (check_id, line_key, kind, added_by) VALUES (p_check, v_key, p_kind, p_actor);
  INSERT INTO bank_check_marks (bank_account_id, check_id, line_key, line_date, direction, amount_cents, payout_key, marked_by)
  VALUES (p_account, p_check, v_key, p_day, CASE p_entry_type WHEN 'income' THEN 'in' ELSE 'out' END, p_amount_cents, p_payout_key, p_actor);
  RETURN jsonb_build_object('ok', true, 'entryId', v_entry, 'key', v_key);
END $$;

-- ── a tick and a keep-out: the line must still be this account's ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.bank_check_tick(
  p_org uuid, p_account uuid, p_check uuid, p_remove text[], p_insert jsonb, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- The club's own live account, locked (the same row and lock `bank_check_mark` and a book move take).
  PERFORM 1 FROM bank_accounts
   WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  -- R2b-3: every line this tick would write is still this account's. A plan read before a book move names lines that
  -- left with their book; nothing is written, and the route reads again.
  IF jsonb_typeof(p_insert) = 'array' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_insert) i WHERE bank_club_line_left(p_org, p_account, i->>'key')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'changed');
  END IF;
  RETURN bank_tick_rows(p_account, p_check, p_remove, p_insert, p_actor);
END $$;

CREATE OR REPLACE FUNCTION public.bank_check_keep_out(
  p_org uuid, p_account uuid, p_check uuid, p_key text, p_kept_out boolean, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM bank_accounts
   WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  -- R2b-3: the line is still this account's (a book move takes this lock before it carries a keep-out away).
  IF bank_club_line_left(p_org, p_account, p_key) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'changed');
  END IF;
  RETURN bank_keep_out_rows(p_account, p_check, p_key, p_kept_out, p_actor);
END $$;

-- The owner-agnostic half (mig 440), with one change: a put-back that removes nothing is `changed`.
CREATE OR REPLACE FUNCTION public.bank_keep_out_rows(
  p_account uuid, p_check uuid, p_key text, p_kept_out boolean, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_check bank_checks%ROWTYPE;
  v_n     integer;
BEGIN
  IF p_key IS NULL OR p_key = '' OR p_kept_out IS NULL THEN RAISE EXCEPTION 'bank_keep_out_rows: key and kept_out'; END IF;
  -- A Stripe payout goes through the bank: never kept out (the route refuses first; this is the floor).
  IF p_key LIKE 'payout:%' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_a_line'); END IF;
  PERFORM 1 FROM bank_accounts WHERE id = p_account AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  SELECT * INTO v_check FROM bank_checks WHERE id = p_check AND bank_account_id = p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'check_not_found'); END IF;
  IF v_check.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_open'); END IF;

  IF p_kept_out THEN
    -- Ticked since the route read it: a ticked line went through the bank, so it isn't kept out.
    IF EXISTS (SELECT 1 FROM bank_check_marks WHERE bank_account_id = p_account AND line_key = p_key) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'changed');
    END IF;
    INSERT INTO bank_line_exclusions (bank_account_id, line_key, excluded_by) VALUES (p_account, p_key, p_actor)
    ON CONFLICT (bank_account_id, line_key) DO NOTHING;
  ELSE
    DELETE FROM bank_line_exclusions WHERE bank_account_id = p_account AND line_key = p_key;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    -- R2b-3: the route only asks when its read saw the row, so removing nothing means something moved it since (a book
    -- move carried it to another account, or a second tab put it back): the screen reads again, never a silent ok.
    IF v_n = 0 THEN RETURN jsonb_build_object('ok', false, 'code', 'changed'); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ── access: the server only ──────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.bank_club_account_of_book(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_club_line_left(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_account_set_up(uuid, uuid, date, bigint, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_book_move(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_account_add(uuid, text, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_add_line(uuid, uuid, uuid, uuid, text, text, date, text, bigint, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_tick(uuid, uuid, uuid, text[], jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_keep_out(uuid, uuid, uuid, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_keep_out_rows(uuid, uuid, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_club_account_of_book(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_club_line_left(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_account_set_up(uuid, uuid, date, bigint, jsonb, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_book_move(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_account_add(uuid, text, uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_add_line(uuid, uuid, uuid, uuid, text, text, date, text, bigint, uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_tick(uuid, uuid, uuid, text[], jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_keep_out(uuid, uuid, uuid, text, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_keep_out_rows(uuid, uuid, text, boolean, uuid) TO service_role;

COMMIT;
