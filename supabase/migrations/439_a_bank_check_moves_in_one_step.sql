-- ---------------------------------------------------------------
-- Migration 439 — Bank reconciliation R2b: every bank-check step that writes more than one row is ONE database step
-- (build prompt docs/projects/active/BANK_RECONCILIATION_R2_BUILD_PROMPT.md chunk R2b; plan
-- BANK_RECONCILIATION_PLAN.md §7 R2; owner rulings 2026-11-04: B1–B12 and drawing asks 1–14, all A).
--
-- WHY: marking a statement checked changes its status, its saved outstanding list, its ticks, its history and its open
-- "changed since" stamps together; a half-written check (status `checked`, last month's ticks) would be a lie the next
-- statement starts from. The routes under app/api/admin/accounting/bank/** decide everything (the engine
-- lib/bank-check.ts re-evaluates on the server, rule 6) and hand these functions only rows to write; each function
-- re-checks, under a lock, the one fact a race could change, and writes all of its rows or none.
--
-- THE STEPS (all `RETURNS jsonb` {ok, code?}; a refusal is a code, never prose):
--   · bank_account_add       — a club account (name), and the books that move into it (C10, Ask 13).
--   · bank_book_move         — one club book into an account: its unticked lines' decisions (picked opening items,
--                              "didn't go through the bank") move with it; ticked lines stay on the old account's checks.
--   · bank_account_set_up    — the starting date, the bank balance then, and the items still outstanding then (C1, Ask 3).
--                              Refused once any statement exists (R1 review rule 2). A typed line's key is its own id
--                              (rule 5, mig 436 CHECK `bank_saved_lines_typed_shape`).
--   · bank_check_start       — a statement (end date + ending balance), in order (`canStartCheck`, rule 2).
--   · bank_check_refigure    — correct an OPEN statement's figures while nothing after it is checked ("Undo, then
--                              re-enter"): a checked statement's figures are never changed.
--   · bank_check_mark        — Mark checked / Mark checked again: status, snapshot, the COMPLETE set of ticks (rule 4),
--                              the event, and the open "changed since" stamps cleared.
--   · bank_check_undo        — the latest checked statement only, with a reason; it reopens with its ticks (Ask 9).
--   · bank_check_add_line    — a bank fee, interest or payment-processing line from a statement's helper: the book line,
--                              the added-line row and its tick on THIS statement (Ask 8), together, so no line is ever
--                              left in a book without its tick.
--
-- WHAT CHANGES: nine new functions, no table, column or row change. Service role only (revoked from PUBLIC, anon and
-- authenticated). The fiscal-year lock (mig 318) still guards the one book line `bank_check_add_line` writes: a closed
-- day raises `year_closed`, which the route answers in words (`isClosedYearError`).
--
-- Re-runnable. Needs 436. Prod order: with 436 and 437, before the promote that ships R2.
-- ---------------------------------------------------------------

BEGIN;

-- ── accounts and books ───────────────────────────────────────────────────────────────────────────

-- The club's FIRST account: its oldest live CLUB account (R1 review rule 1: never a team account moved in by mig 437).
CREATE OR REPLACE FUNCTION public.bank_first_club_account(p_org uuid) RETURNS uuid
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM bank_accounts
   WHERE org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL
   ORDER BY created_at, id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.bank_book_move(p_org uuid, p_ledger uuid, p_to uuid, p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_ledger accounting_ledgers%ROWTYPE;
  v_from   uuid;
  v_first  uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = p_to AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_found');
  END IF;
  SELECT * INTO v_ledger FROM accounting_ledgers WHERE id = p_ledger AND org_id = p_org;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'book_not_found'); END IF;
  IF v_ledger.entity_type = 'team' THEN RETURN jsonb_build_object('ok', false, 'code', 'team_book'); END IF;

  -- One move of a book at a time (its mapping row may not exist yet, so the book's own row is the lock).
  PERFORM 1 FROM accounting_ledgers WHERE id = p_ledger FOR UPDATE;
  v_first := bank_first_club_account(p_org);
  SELECT b.bank_account_id INTO v_from FROM bank_account_books b
    JOIN bank_accounts a ON a.id = b.bank_account_id AND a.owner_kind = 'club' AND a.archived_at IS NULL
   WHERE b.ledger_id = p_ledger;
  v_from := coalesce(v_from, v_first);
  IF v_from = p_to THEN RETURN jsonb_build_object('ok', true, 'unchanged', true); END IF;

  -- The guard trigger (mig 436) raises bank_book_not_club_account / bank_book_is_team_book / bank_book_other_club.
  INSERT INTO bank_account_books (ledger_id, bank_account_id, moved_by, moved_at)
  VALUES (p_ledger, p_to, p_actor, now())
  ON CONFLICT (ledger_id) DO UPDATE SET bank_account_id = EXCLUDED.bank_account_id, moved_by = EXCLUDED.moved_by,
    moved_at = EXCLUDED.moved_at;

  -- Ask 13: its lines not yet ticked move with it — and so does what the old account decided about them (an item
  -- picked as outstanding at the start, a "didn't go through the bank"). A ticked line stays on the old account's
  -- checks, and so do its decisions. A row the new account already holds for the same line is kept, the old dropped.
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
  -- One account added at a time per club, so two "first" accounts can't race into being.
  PERFORM 1 FROM organizations WHERE id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'org_not_found'); END IF;
  IF EXISTS (SELECT 1 FROM bank_accounts WHERE org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL
              AND lower(name) = lower(v_name)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'name_taken');
  END IF;
  v_first := bank_first_club_account(p_org) IS NULL;
  INSERT INTO bank_accounts (org_id, owner_kind, name, created_by) VALUES (p_org, 'club', v_name, p_actor)
  RETURNING id INTO v_id;
  -- The first account holds every club book by default (no mapping rows); a later one takes the books it names.
  IF NOT v_first THEN
    FOREACH v_l IN ARRAY coalesce(p_ledgers, ARRAY[]::uuid[]) LOOP
      v_r := bank_book_move(p_org, v_l, v_id, p_actor);
      IF NOT (v_r->>'ok')::boolean THEN
        RAISE EXCEPTION 'bank_step_refused:%', v_r->>'code';
      END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'first', v_first);
END $$;

-- ── the starting point (C1, Ask 3) ───────────────────────────────────────────────────────────────

-- p_picked: [{key: 'entry:{uuid}', date, direction, amountCents, description}] — read from the book by the route.
-- p_typed:  [{date, direction, amountCents, description}] — a line the books don't have; its key is minted here.
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

-- ── a statement ──────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.bank_check_start(
  p_org uuid, p_account uuid, p_end date, p_balance_cents bigint, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_acct  bank_accounts%ROWTYPE;
  v_floor date;
  v_id    uuid;
BEGIN
  SELECT * INTO v_acct FROM bank_accounts
   WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  -- `canStartCheck` (lib/bank-check.ts), held under the account's lock.
  IF v_acct.opening_date IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'not_set_up'); END IF;
  IF EXISTS (SELECT 1 FROM bank_checks WHERE bank_account_id = p_account AND status = 'open') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'one_is_open');
  END IF;
  SELECT coalesce(max(statement_end_date), v_acct.opening_date) INTO v_floor FROM bank_checks WHERE bank_account_id = p_account;
  IF v_floor < v_acct.opening_date THEN v_floor := v_acct.opening_date; END IF;
  IF p_end IS NULL OR p_end <= v_floor THEN RETURN jsonb_build_object('ok', false, 'code', 'ends_too_early'); END IF;
  INSERT INTO bank_checks (bank_account_id, statement_end_date, statement_ending_balance_cents, created_by)
  VALUES (p_account, p_end, p_balance_cents, p_actor) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

-- "Undo, then re-enter" (rule 2): an OPEN statement's figures, while every later statement is open too. The new end date
-- stays strictly between its neighbours (or after the starting date). A checked statement's figures never change here.
CREATE OR REPLACE FUNCTION public.bank_check_refigure(
  p_org uuid, p_account uuid, p_check uuid, p_end date, p_balance_cents bigint
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_acct  bank_accounts%ROWTYPE;
  v_check bank_checks%ROWTYPE;
  v_prev  date;
  v_next  date;
BEGIN
  SELECT * INTO v_acct FROM bank_accounts
   WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  SELECT * INTO v_check FROM bank_checks WHERE id = p_check AND bank_account_id = p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'check_not_found'); END IF;
  IF v_check.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'code', 'checked_figures_fixed'); END IF;
  IF EXISTS (SELECT 1 FROM bank_checks WHERE bank_account_id = p_account AND statement_end_date > v_check.statement_end_date
              AND status = 'checked') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'later_checked');
  END IF;
  SELECT max(statement_end_date) INTO v_prev FROM bank_checks
   WHERE bank_account_id = p_account AND statement_end_date < v_check.statement_end_date;
  SELECT min(statement_end_date) INTO v_next FROM bank_checks
   WHERE bank_account_id = p_account AND statement_end_date > v_check.statement_end_date;
  IF p_end IS NULL OR p_end <= greatest(coalesce(v_prev, v_acct.opening_date), v_acct.opening_date)
     OR (v_next IS NOT NULL AND p_end >= v_next) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ends_out_of_order');
  END IF;
  UPDATE bank_checks SET statement_end_date = p_end, statement_ending_balance_cents = p_balance_cents WHERE id = p_check;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Mark checked (p_kind 'checked', expects 'open') / Mark checked again (p_kind 'checked_again', expects 'checked').
-- p_seen: the keys ticked on this statement when the route evaluated it — if a tick landed or left since, the $0.00 the
-- route computed is not this statement's any more, and the step is refused `changed` (the screen reads again).
-- p_marks: the COMPLETE set of ticks it keeps (rule 4, `snapshotForMarking`): [{key, date, direction, amountCents, payoutKey?}].
CREATE OR REPLACE FUNCTION public.bank_check_mark(
  p_org uuid, p_account uuid, p_check uuid, p_kind text, p_seen text[], p_snapshot jsonb, p_marks jsonb, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_check bank_checks%ROWTYPE;
  v_want  text;
  v_keys  text[];
  v_n     integer;
  v_done  integer;
BEGIN
  IF p_kind NOT IN ('checked', 'checked_again') THEN RAISE EXCEPTION 'bank_check_mark: kind %', p_kind; END IF;
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'array' OR p_marks IS NULL OR jsonb_typeof(p_marks) <> 'array' THEN
    RAISE EXCEPTION 'bank_check_mark: snapshot and marks are arrays';
  END IF;
  PERFORM 1 FROM bank_accounts
   WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  SELECT * INTO v_check FROM bank_checks WHERE id = p_check AND bank_account_id = p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'check_not_found'); END IF;
  v_want := CASE p_kind WHEN 'checked' THEN 'open' ELSE 'checked' END;
  IF v_check.status <> v_want THEN RETURN jsonb_build_object('ok', false, 'code', 'changed'); END IF;
  -- Every earlier statement is checked (after stepping back they re-check oldest first, `canMarkChecked`).
  IF p_kind = 'checked' AND EXISTS (SELECT 1 FROM bank_checks WHERE bank_account_id = p_account
      AND statement_end_date < v_check.statement_end_date AND status <> 'checked') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'earlier_open');
  END IF;
  IF (SELECT coalesce(array_agg(line_key ORDER BY line_key), ARRAY[]::text[]) FROM bank_check_marks WHERE check_id = p_check)
     IS DISTINCT FROM (SELECT coalesce(array_agg(k ORDER BY k), ARRAY[]::text[]) FROM unnest(coalesce(p_seen, ARRAY[]::text[])) k) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'changed');
  END IF;

  SELECT coalesce(array_agg(e->>'key'), ARRAY[]::text[]), count(*) INTO v_keys, v_n FROM jsonb_array_elements(p_marks) e;
  DELETE FROM bank_check_marks WHERE check_id = p_check AND NOT (line_key = ANY (v_keys));
  INSERT INTO bank_check_marks (bank_account_id, check_id, line_key, line_date, direction, amount_cents, payout_key, marked_by)
  SELECT p_account, p_check, e->>'key', (e->>'date')::date, e->>'direction', (e->>'amountCents')::bigint,
         nullif(e->>'payoutKey', ''), p_actor
    FROM jsonb_array_elements(p_marks) e
  ON CONFLICT (bank_account_id, line_key) DO UPDATE
    SET line_date = EXCLUDED.line_date, direction = EXCLUDED.direction, amount_cents = EXCLUDED.amount_cents,
        payout_key = EXCLUDED.payout_key
    WHERE bank_check_marks.check_id = EXCLUDED.check_id;
  GET DIAGNOSTICS v_done = ROW_COUNT;
  -- A key ticked on ANOTHER statement of this account can't be taken over by this one.
  IF v_done <> v_n THEN RAISE EXCEPTION 'bank_step_refused:ticked_elsewhere'; END IF;

  UPDATE bank_checks SET status = 'checked', checked_by = p_actor, checked_at = now(), outstanding_snapshot = p_snapshot
   WHERE id = p_check;
  INSERT INTO bank_check_events (check_id, kind, by_user) VALUES (p_check, p_kind, p_actor);
  -- Ask 11: only Mark checked (again) clears the amber.
  UPDATE bank_check_changes SET cleared_by = p_actor, cleared_at = now() WHERE check_id = p_check AND cleared_at IS NULL;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.bank_check_undo(
  p_org uuid, p_account uuid, p_check uuid, p_reason text, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_check  bank_checks%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF char_length(v_reason) NOT BETWEEN 1 AND 500 THEN RETURN jsonb_build_object('ok', false, 'code', 'reason_required'); END IF;
  PERFORM 1 FROM bank_accounts
   WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  SELECT * INTO v_check FROM bank_checks WHERE id = p_check AND bank_account_id = p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'check_not_found'); END IF;
  IF v_check.status <> 'checked' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_latest'); END IF;
  -- The latest CHECKED statement only (B4, Ask 9; `canUndo`).
  IF EXISTS (SELECT 1 FROM bank_checks WHERE bank_account_id = p_account AND status = 'checked'
              AND statement_end_date > v_check.statement_end_date) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_latest');
  END IF;
  -- It reopens with its ticks kept; its snapshot stays behind, unread while it is open (dictionary gotcha 6).
  UPDATE bank_checks SET status = 'open' WHERE id = p_check;
  INSERT INTO bank_check_events (check_id, kind, reason, by_user) VALUES (p_check, 'undone', v_reason, p_actor);
  RETURN jsonb_build_object('ok', true);
END $$;

-- ── a line added from a statement (B5, Asks 1, 7, 8) ─────────────────────────────────────────────

-- The route has decided the book (the account's own, never a team's), the word, the day (`bankFeeDate`, then the year
-- lock in words) and the amount. This writes the book line, records it as added from the statement, and ticks it there.
-- `p_payout_key` (payment processing only): the payout whose gap this line closes. It is written on the line's TICK, so
-- the line rides that payout's book side (lib/bank-club-read.ts overlays it) and the payout's gap closes instead of
-- being counted twice; a second payment-processing line for the same payout on the same statement is refused.
-- (Review fix, 2026-11-04: the first version ticked the line on its own, so the gap stayed and the Difference moved off $0.00.)
DROP FUNCTION IF EXISTS public.bank_check_add_line(uuid, uuid, uuid, uuid, text, text, date, text, bigint, uuid, uuid, uuid);
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
  -- The book must be THIS account's (its mapping row, or no row and this is the club's first account).
  IF NOT (
    EXISTS (SELECT 1 FROM bank_account_books b JOIN bank_accounts a ON a.id = b.bank_account_id
             WHERE b.ledger_id = p_ledger AND b.bank_account_id = p_account AND a.archived_at IS NULL)
    OR (bank_first_club_account(p_org) = p_account AND NOT EXISTS (
          SELECT 1 FROM bank_account_books b JOIN bank_accounts a ON a.id = b.bank_account_id
           WHERE b.ledger_id = p_ledger AND a.owner_kind = 'club' AND a.archived_at IS NULL))
  ) THEN
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

-- ── access: the server only ──────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.bank_first_club_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_book_move(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_account_add(uuid, text, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_account_set_up(uuid, uuid, date, bigint, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_start(uuid, uuid, date, bigint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_refigure(uuid, uuid, uuid, date, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_mark(uuid, uuid, uuid, text, text[], jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_undo(uuid, uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_add_line(uuid, uuid, uuid, uuid, text, text, date, text, bigint, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_first_club_account(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_book_move(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_account_add(uuid, text, uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_account_set_up(uuid, uuid, date, bigint, jsonb, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_start(uuid, uuid, date, bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_refigure(uuid, uuid, uuid, date, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_mark(uuid, uuid, uuid, text, text[], jsonb, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_undo(uuid, uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_add_line(uuid, uuid, uuid, uuid, text, text, date, text, bigint, uuid, uuid, uuid, text) TO service_role;

COMMIT;
