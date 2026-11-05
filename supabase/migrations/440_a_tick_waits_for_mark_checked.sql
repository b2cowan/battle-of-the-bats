-- ---------------------------------------------------------------
-- Migration 440 — Bank reconciliation R2b-2: a tick can't land on a checked statement
-- (build prompt docs/projects/active/BANK_RECONCILIATION_R2_BUILD_PROMPT.md chunk R2b-2; plan
-- BANK_RECONCILIATION_PLAN.md §7 R2; owner yes 2026-11-04 after R2b's review).
--
-- WHY: a tick, an untick, a "Didn't go through the bank" or a "Put it back" sent a moment after someone else's Mark checked
-- commits could still land on the statement that is now checked: the routes wrote `bank_check_marks` /
-- `bank_line_exclusions` as plain rows, deciding "is this statement open?" from a read taken before the write, with no
-- lock. The statement then quietly stopped summing to $0.00. Now each of those writes is a step that takes the SAME lock
-- `bank_check_mark` and `bank_check_undo` take (the account row, then the check, FOR UPDATE), so a tick and a Mark checked
-- run one after the other, and the tick is refused `not_open` once the statement is checked.
--
-- THE STEPS (all `RETURNS jsonb` {ok, code?}; a refusal is a code, never prose):
--   · bank_check_tick       — the club's: tick / untick, the rows `tickPlan` decided (a payout with its members, rule 3).
--   · bank_check_keep_out   — the club's: "Didn't go through the bank" (insert) / "Put it back" (delete).
--   · bank_tick_rows        — the owner-agnostic half of a tick: lock, `open`, write. The caller has already proved the
--                             account is the caller's (the club step: the org's live CLUB account). The coach portal's
--                             team step (R4+) is one more wrapper over this, never a copy.
--   · bank_keep_out_rows    — the owner-agnostic half of a keep-out, the same way.
--
-- A unique clash on a tick (`bank_check_marks` is unique per account + line): decided INSIDE the step, under the lock —
-- a row ticked on ANOTHER statement of the account is `changed`, checked before anything is written; past that, a row
-- that clashes is a double tap racing its own twin on THIS statement (`ON CONFLICT DO NOTHING`, a success). A tick and a
-- keep-out refuse each other the same way: a line kept out since the route read it is not ticked (`changed`), and a line
-- ticked since is not kept out (`changed`), so no line is ever both.
--
-- NOT CLOSED HERE (pre-existing, recorded in the plan): `bank_book_move` (mig 439) moves a book's exclusions and opening
-- items holding only the BOOK's lock, so a keep-out or a tick racing a book move can land on the old account. Mark checked's own seen-set is unchanged: a keep-out cannot move the
-- $0.00 it rests on (the Difference counts ticks only; a kept-out line is never a ticked one), recorded in the plan.
--
-- WHAT CHANGES: four new functions, no table, column or row change. Service role only (revoked from PUBLIC, anon and
-- authenticated). Re-runnable. Needs 436 (the tables) and 439 (the lock order it shares). Prod order: with 436, 437 and
-- 439, before the promote that ships R2.
-- ---------------------------------------------------------------

BEGIN;

-- ── the owner-agnostic halves ────────────────────────────────────────────────────────────────────

-- p_remove: line keys to untick on THIS statement. p_insert: [{key, date, direction, amountCents, payoutKey?}] to tick.
CREATE OR REPLACE FUNCTION public.bank_tick_rows(
  p_account uuid, p_check uuid, p_remove text[], p_insert jsonb, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_check bank_checks%ROWTYPE;
  v_keys  text[];
  v_n     integer;
BEGIN
  IF p_insert IS NULL OR jsonb_typeof(p_insert) <> 'array' THEN RAISE EXCEPTION 'bank_tick_rows: insert is an array'; END IF;
  -- The lock Mark checked and Undo take, in their order: the account, then the check.
  PERFORM 1 FROM bank_accounts WHERE id = p_account AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
  SELECT * INTO v_check FROM bank_checks WHERE id = p_check AND bank_account_id = p_account FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'check_not_found'); END IF;
  IF v_check.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_open'); END IF;

  SELECT coalesce(array_agg(DISTINCT e->>'key'), ARRAY[]::text[]) INTO v_keys FROM jsonb_array_elements(p_insert) e;
  v_n := cardinality(v_keys);
  -- A row ticked on another statement of this account a moment ago: the plan was read before it, so it is not this
  -- statement's to take. Nothing is written. (Every writer of bank_check_marks holds this account's lock, so this holds.)
  IF v_n > 0 AND EXISTS (SELECT 1 FROM bank_check_marks
      WHERE bank_account_id = p_account AND line_key = ANY (v_keys) AND check_id <> p_check) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'changed');
  END IF;
  -- A line kept out ("Didn't go through the bank") since the route read it: a kept-out line is never a ticked one, so it
  -- is not this tick's to take either (review 2026-11-04: otherwise it was ticked AND kept out, and unticking it later
  -- dropped it into "kept out" instead of back to the list). A payout's member rides its payout whatever an exclusion
  -- from a Stripe outage says (the engine), so only a plain line — no payout on its row — is asked.
  IF v_n > 0 AND EXISTS (SELECT 1 FROM jsonb_array_elements(p_insert) e
      JOIN bank_line_exclusions x ON x.bank_account_id = p_account AND x.line_key = e->>'key'
     WHERE nullif(e->>'payoutKey', '') IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'changed');
  END IF;

  IF cardinality(coalesce(p_remove, ARRAY[]::text[])) > 0 THEN
    DELETE FROM bank_check_marks WHERE bank_account_id = p_account AND check_id = p_check AND line_key = ANY (p_remove);
  END IF;
  IF v_n > 0 THEN
    INSERT INTO bank_check_marks (bank_account_id, check_id, line_key, line_date, direction, amount_cents, payout_key, marked_by)
    SELECT p_account, p_check, e->>'key', (e->>'date')::date, e->>'direction', (e->>'amountCents')::bigint,
           nullif(e->>'payoutKey', ''), p_actor
      FROM jsonb_array_elements(p_insert) e
    -- Past the check above, a row that clashes can only be ticked on THIS statement: a double tap's twin, a success.
    ON CONFLICT (bank_account_id, line_key) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.bank_keep_out_rows(
  p_account uuid, p_check uuid, p_key text, p_kept_out boolean, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_check bank_checks%ROWTYPE;
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
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ── the club's steps ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.bank_check_tick(
  p_org uuid, p_account uuid, p_check uuid, p_remove text[], p_insert jsonb, p_actor uuid
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- The club's own live account, locked (the same row and lock `bank_check_mark` takes); then the shared half.
  PERFORM 1 FROM bank_accounts
   WHERE id = p_account AND org_id = p_org AND owner_kind = 'club' AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'account_not_found'); END IF;
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
  RETURN bank_keep_out_rows(p_account, p_check, p_key, p_kept_out, p_actor);
END $$;

-- ── access: the server only ──────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.bank_tick_rows(uuid, uuid, text[], jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_keep_out_rows(uuid, uuid, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_tick(uuid, uuid, uuid, text[], jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_check_keep_out(uuid, uuid, uuid, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_tick_rows(uuid, uuid, text[], jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_keep_out_rows(uuid, uuid, text, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_tick(uuid, uuid, uuid, text[], jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_check_keep_out(uuid, uuid, uuid, text, boolean, uuid) TO service_role;

COMMIT;
