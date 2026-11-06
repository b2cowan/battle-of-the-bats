-- ---------------------------------------------------------------
-- Migration 449 — Bank balance check BC3b: the starting statement can be corrected ("Waiting at the start"), and a save
-- holds the start it was figured from
-- (build prompt docs/projects/active/BANK_BALANCE_CHECK_BC3_BUILD_PROMPT.md, BC3b steps 2–3; plan BANK_RECONCILIATION_PLAN.md
-- §0 Q2, "Q2 + ask 6", "Q2 look-back" (owner 2026-11-05/06), §9 BC2's review finding, §9 BC1 review M2).
--
-- WHY: a cheque written before a club's starting statement and cashed after it leaves every later check "Off by" its
-- amount for good: the start's bank balance still held it, so the start's books were figured too high (plan §1, Q2). The
-- owner ruled Q2 = A: Find names such a line and "Waiting at the start" attaches it to the starting statement, which moves
-- the start's books by its amount (the §4 formula solved for the books: a money-out line subtracts, a money-in line adds,
-- `startBooks` in lib/bank-check.ts — the ONE home of that sign). Saved later checks keep their figures and read "Books now
-- say $X" (ruling "Q2 + ask 6"); the next check figures from the corrected start.
--
-- THE SHAPE AFTER (on top of 447):
--   · bank_check_waiting gains `added_by` / `added_at`: who attached an item to the start AFTER the start was saved, and
--     when (NULL on every item saved with its own check). Only a start's item can carry them.
--   · bank_start_waiting — new step: under the account's lock, attach ONE line to the live starting statement or take ONE
--     off, and set the start's books to the figure the route worked out (`startBooks` over the start's items as they will
--     be). Compare-and-swap: the route names the start it read and that start's books; anything else is `changed`.
--   · bank_check_save — re-made with `p_start` / `p_start_books`, the start the route figured from (BC2 review: a check
--     saved in the instant its start is re-saved or corrected carried the old start's books, because the route reads the
--     books outside the lock). A check: the live start must be that id with those books, else `changed`. A start: the
--     live start must be `p_start` (NULL = none expected), so two treasurers starting at once can't replace each other.
--
-- ⚖ SAVED FIGURES NEVER CHANGE (ask 6) — with ONE deliberate exception the owner ruled: the starting statement's books
--   move when a line is attached to it or taken off (Q2: "attaches it to the starting statement"). A CHECK's figures are
--   never re-written by any step; "Books now say" is derived on read from the start's books as they are now (M2).
-- ⚖ NOTHING HERE WRITES MONEY (ask 1): no step touches accounting_entries or a rep money table.
--
-- Re-runnable (every step guarded). Prod order: with 447, before the promote that ships BC3b's code (the save route calls
-- the new bank_check_save signature). Applied to dev 2026-11-06.
-- ---------------------------------------------------------------

-- ── 1. who attached an item to the start, and when ─────────────────────────────────────────────────────────────────
ALTER TABLE public.bank_check_waiting
  ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS added_at timestamptz;
-- Only a start's item is attached after its check was saved; who is kept with when (the person may later be removed).
ALTER TABLE public.bank_check_waiting DROP CONSTRAINT IF EXISTS bank_check_waiting_added_shape;
ALTER TABLE public.bank_check_waiting ADD CONSTRAINT bank_check_waiting_added_shape
  CHECK ((added_at IS NULL AND added_by IS NULL) OR (at_start AND added_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS bank_check_waiting_added_by_idx ON public.bank_check_waiting (added_by) WHERE added_by IS NOT NULL;
COMMENT ON COLUMN public.bank_check_waiting.at_start IS 'An item of the starting statement (Q2, "Waiting at the start": written before the start and cashed after it). Always true on a start check''s items, never on a check''s (bank_check_save, bank_start_waiting).';
COMMENT ON COLUMN public.bank_check_waiting.added_by IS 'Who attached this line to the starting statement after the start was saved ("Waiting at the start", mig 449). NULL for an item saved with its own check.';
COMMENT ON COLUMN public.bank_check_waiting.added_at IS 'When this line was attached to the starting statement after the start was saved (mig 449). NULL for an item saved with its own check. Set only with at_start.';
COMMENT ON COLUMN public.bank_checks.books_cents IS 'Your books on the date, as figured when saved (club: the start''s books + posted movement of book_ids after the start through the date; start: the bank balance solved through its waiting items and on-its-way; coach: the season opening + settled cash-moving rows through the date). A CHECK''s is never re-written: "Books now say" is derived on read. A START''s moves when a line is attached to it or taken off (bank_start_waiting, Q2), and only then.';

-- ── 2. a save holds the start it was figured from ───────────────────────────────────────────────────────────────────
-- The 447 signature goes (replaced, two parameters longer): nothing but lib/bank-club-steps.ts calls it, and the BC3b code
-- that calls the new one ships in the same promote as 447 + 449 (on dev, saves fail between this apply and that code).
DROP FUNCTION IF EXISTS public.bank_check_save(uuid, uuid, text, date, bigint, bigint, bigint, bigint, uuid[], jsonb, uuid);

-- p_waiting: [{key, date, label?, amountCents, direction}]. p_book_ids: club, the books the figure counted (must be the
-- account's books now); team, NULL. p_start / p_start_books: the live start the route read (club; NULL for a first start).
CREATE OR REPLACE FUNCTION public.bank_check_save(
  p_org uuid, p_account uuid, p_kind text, p_date date, p_bank_cents bigint, p_books_cents bigint,
  p_on_its_way_cents bigint, p_cash_cents bigint, p_book_ids uuid[], p_waiting jsonb, p_start uuid, p_start_books bigint,
  p_actor uuid
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
    IF p_book_ids IS NOT NULL OR p_start IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_figures'); END IF;
    IF p_kind = 'start' THEN RETURN jsonb_build_object('ok', false, 'code', 'bad_kind'); END IF;
    v_books := NULL;
  END IF;

  SELECT * INTO v_start FROM bank_checks WHERE bank_account_id = p_account AND kind = 'start' AND deleted_at IS NULL;
  IF p_kind = 'start' THEN
    -- One starting statement: re-saving it on its own date replaces it; another date is refused (no "move the start").
    IF v_start.id IS NOT NULL AND v_start.statement_end_date <> p_date THEN
      RETURN jsonb_build_object('ok', false, 'code', 'start_exists');
    END IF;
    -- The start the route read (NULL: none): a start saved or replaced meanwhile is read again, never replaced unseen.
    IF v_start.id IS DISTINCT FROM p_start THEN RETURN jsonb_build_object('ok', false, 'code', 'changed'); END IF;
    IF EXISTS (SELECT 1 FROM bank_checks WHERE bank_account_id = p_account AND kind = 'check' AND deleted_at IS NULL
                AND statement_end_date <= p_date) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'start_after_checks');
    END IF;
  ELSIF v_acct.owner_kind = 'club' THEN
    IF v_start.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'no_start'); END IF;
    -- The books were figured from this start's books (BC2 review): a start replaced or corrected since is read again.
    IF v_start.id IS DISTINCT FROM p_start OR v_start.books_cents IS DISTINCT FROM p_start_books THEN
      RETURN jsonb_build_object('ok', false, 'code', 'changed');
    END IF;
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

-- ── 3. "Waiting at the start": attach one line to the starting statement, or take one off ───────────────────────────
-- The route has read the line from the books by id (rule 6), checked it is a posted line of the account's books dated on
-- or before the start and not an online payment, and figured the start's books with the item list as it will be
-- (`startBooks`). This writes it under the account's lock, compare-and-swap on the start it read. Exactly one of p_add
-- ({key, date, label?, amountCents, direction}) or p_remove (a line key already on the start).
CREATE OR REPLACE FUNCTION public.bank_start_waiting(
  p_org uuid, p_account uuid, p_start uuid, p_books_before bigint, p_books_after bigint, p_add jsonb, p_remove text,
  p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_start     bank_checks%ROWTYPE;
  v_amount    bigint;
  v_direction text;
  v_delta     bigint;
BEGIN
  IF (p_add IS NULL) = (p_remove IS NULL) OR (p_add IS NOT NULL AND jsonb_typeof(p_add) <> 'object') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_item');
  END IF;
  IF p_start IS NULL OR p_books_before IS NULL OR p_books_after IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_figures');
  END IF;

  -- The account FIRST (the lock bank_check_save, bank_check_delete and bank_book_move take); never a book or the club row.
  PERFORM 1 FROM bank_accounts WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;

  SELECT * INTO v_start FROM bank_checks WHERE bank_account_id = p_account AND kind = 'start' AND deleted_at IS NULL;
  IF v_start.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'no_start'); END IF;
  -- The start the route figured from, with the books it read: anything else was changed meanwhile.
  IF v_start.id <> p_start OR v_start.books_cents <> p_books_before THEN
    RETURN jsonb_build_object('ok', false, 'code', 'changed');
  END IF;

  -- ⚠ Every refusal below comes BEFORE the write it guards: a plain RETURN commits what was already written.
  IF p_add IS NOT NULL THEN
    -- A line waiting at the start is in the books on the start's date: never dated after it.
    IF coalesce(char_length(p_add->>'key'), 0) NOT BETWEEN 3 AND 200
       OR (p_add->>'date') IS NULL OR (p_add->>'date')::date > v_start.statement_end_date
       OR coalesce(p_add->>'direction', '') NOT IN ('in', 'out')
       OR coalesce((p_add->>'amountCents')::bigint, 0) <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'bad_item');
    END IF;
    -- The start's books move by exactly this item (startBooks: a money-out line comes off, a money-in line goes on). The
    -- route figures it; this re-checks it (dba 2026-11-06, Finding #48: the one figure a step re-writes).
    v_amount := (p_add->>'amountCents')::bigint;
    -- (A CASE inside an IF's condition ends at its first THEN in plpgsql, so the move is figured first.)
    v_delta := CASE WHEN p_add->>'direction' = 'out' THEN -v_amount ELSE v_amount END;
    IF p_books_after <> p_books_before + v_delta THEN
      RETURN jsonb_build_object('ok', false, 'code', 'bad_figures');
    END IF;
    -- A line already on the start is refused by bank_check_waiting_once (23505 → bad_item, refusalOfDbError).
    INSERT INTO bank_check_waiting (check_id, line_key, line_date, label, amount_cents, direction, at_start, added_by, added_at)
    VALUES (v_start.id, p_add->>'key', (p_add->>'date')::date,
            nullif(btrim(left(coalesce(p_add->>'label', ''), 200)), ''),
            v_amount, p_add->>'direction', true, p_actor, now());
  ELSE
    SELECT amount_cents, direction INTO v_amount, v_direction FROM bank_check_waiting
     WHERE check_id = v_start.id AND line_key = p_remove;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'changed'); END IF;
    -- Taking it off moves the books back by exactly its amount.
    v_delta := CASE WHEN v_direction = 'out' THEN v_amount ELSE -v_amount END;
    IF p_books_after <> p_books_before + v_delta THEN
      RETURN jsonb_build_object('ok', false, 'code', 'bad_figures');
    END IF;
    DELETE FROM bank_check_waiting WHERE check_id = v_start.id AND line_key = p_remove;
  END IF;

  -- Q2: the start's books move with its items (the route's `startBooks`); a check's figures never do.
  UPDATE bank_checks SET books_cents = p_books_after WHERE id = v_start.id;
  RETURN jsonb_build_object('ok', true, 'id', v_start.id);
END $$;

-- ── 4. access: the server only (DATA_DICTIONARY maintenance rule 7) ────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.bank_check_save(uuid, uuid, text, date, bigint, bigint, bigint, bigint, uuid[], jsonb, uuid, bigint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_start_waiting(uuid, uuid, uuid, bigint, bigint, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_check_save(uuid, uuid, text, date, bigint, bigint, bigint, bigint, uuid[], jsonb, uuid, bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_start_waiting(uuid, uuid, uuid, bigint, bigint, jsonb, text, uuid) TO service_role;
