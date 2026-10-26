-- DEV only. Club Tier Stage 9b-2 Part 1 (mig 368): the one house-league money writer, proved on the database.
-- T19-T28: Stage 12b (mig 374) — a card payment lands through that writer, once, per child.
-- Run: node scripts/db-query.mjs --dev -f scripts/house-league-money-check.sql
-- The final exception rolls back every fixture row; the run passes only when it ends in HOUSE_LEAGUE_MONEY_PASSED.
DO $hlmoney$
DECLARE
  v_org uuid; v_season uuid; v_free uuid; v_div uuid; v_div2 uuid;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_w uuid; v_p uuid;
  v_entry uuid; v_refusal text; v_promoted uuid; v_kept boolean; v_day date := DATE '2026-03-01';
  -- 12b (mig 374): card payments.
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid; v_s5 uuid; v_s6 uuid; v_s7 uuid; v_op uuid; v_res jsonb;
  v_sib uuid; v_ref uuid; v_item uuid;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
BEGIN
  INSERT INTO organizations(name, slug, plan_id)
  VALUES ('MONEY CHECK 9b-2', 'money-check-9b2-' || substr(md5(random()::text), 1, 10), 'club') RETURNING id INTO v_org;
  INSERT INTO league_seasons(org_id, name, slug, registration_fee) VALUES (v_org, 'Money check', 'money-check', 150)
    RETURNING id INTO v_season;
  INSERT INTO league_seasons(org_id, name, slug, registration_fee) VALUES (v_org, 'Free check', 'free-check', 0)
    RETURNING id INTO v_free;
  INSERT INTO league_divisions(season_id, name, capacity) VALUES (v_season, 'A', 2) RETURNING id INTO v_div;
  INSERT INTO league_divisions(season_id, name, capacity) VALUES (v_season, 'B', 10) RETURNING id INTO v_div2;

  -- T1 · accepted at: set on the way in, cleared on the way back to the waitlist.
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount)
  VALUES (v_org, v_season, v_div, 'Ava', 'Kim', 'P', 'G', 'a@example.invalid', 'active', 150) RETURNING id INTO v_a;
  IF (SELECT accepted_at FROM league_registrations WHERE id = v_a) IS NULL THEN
    RAISE EXCEPTION 'FAIL T1: an accepted child has no accepted-at'; END IF;
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount)
  VALUES (v_org, v_season, v_div, 'Ben', 'Lee', 'P', 'G', 'b@example.invalid', 'pending_review', 150) RETURNING id INTO v_b;
  IF (SELECT accepted_at FROM league_registrations WHERE id = v_b) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T1: a child in review has an accepted-at'; END IF;

  -- T2 · only an accepted child owes; a child in review is refused, nothing written.
  SELECT m.entry, m.refusal INTO v_entry, v_refusal FROM club_league_money(v_org, v_season, v_b, 'receive', NULL, v_day, 'cash', NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'not_accepted' OR v_entry IS NOT NULL THEN RAISE EXCEPTION 'FAIL T2: review child paid (%)', v_refusal; END IF;

  -- T3 · received: the whole balance, the day given (the club's day, never re-zoned) and the method.
  SELECT m.entry, m.refusal INTO v_entry, v_refusal FROM club_league_money(v_org, v_season, v_a, 'receive', NULL, v_day, 'etransfer', NULL, NULL) m;
  IF v_refusal IS NOT NULL OR (SELECT amount FROM accounting_entries WHERE id = v_entry) <> 150
     OR (SELECT entry_date FROM accounting_entries WHERE id = v_entry) <> v_day
     OR (SELECT payment_method FROM accounting_entries WHERE id = v_entry) <> 'etransfer'
     OR NOT (SELECT registration_fee_paid FROM league_registrations WHERE id = v_a)
     OR (SELECT fee_entry_id FROM league_registrations WHERE id = v_a) <> v_entry THEN
    RAISE EXCEPTION 'FAIL T3: received line wrong (%)', v_refusal; END IF;
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_a, 'receive', NULL, v_day, 'cash', NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'already_received' OR league_reg_received(v_a) <> 150 THEN
    RAISE EXCEPTION 'FAIL T3: a second press wrote again'; END IF;

  -- T4 · a free season: nothing to receive.
  INSERT INTO league_registrations(org_id, season_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount)
  VALUES (v_org, v_free, 'Free', 'Kid', 'P', 'G', 'f@example.invalid', 'active', 0) RETURNING id INTO v_c;
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_free, v_c, 'receive', NULL, v_day, 'cash', NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'already_received' OR league_reg_received(v_c) <> 0 THEN
    RAISE EXCEPTION 'FAIL T4: a free season took money'; END IF;

  -- T5 · correct a PAID price upward: nothing moves, the difference shows owing; then the difference is received.
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_a, 'price', 180, NULL, NULL, NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'reason' THEN RAISE EXCEPTION 'FAIL T5: a correction without a reason was taken'; END IF;
  SELECT m.entry, m.refusal INTO v_entry, v_refusal FROM club_league_money(v_org, v_season, v_a, 'price', 180, NULL, NULL, 'Late add-on', NULL) m;
  IF v_refusal IS NOT NULL OR v_entry IS NOT NULL OR (SELECT fee_amount FROM league_registrations WHERE id = v_a) <> 180
     OR (SELECT registration_fee_paid FROM league_registrations WHERE id = v_a)
     OR (SELECT count(*) FROM league_registration_price_changes WHERE registration_id = v_a AND kind = 'corrected' AND old_amount = 150) <> 1 THEN
    RAISE EXCEPTION 'FAIL T5: a raised price did not leave the difference owing (%)', v_refusal; END IF;
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_a, 'receive', 40, v_day, 'cash', NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'over' THEN RAISE EXCEPTION 'FAIL T5: more than owed was taken'; END IF;
  SELECT m.entry, m.refusal INTO v_entry, v_refusal FROM club_league_money(v_org, v_season, v_a, 'receive', NULL, v_day, 'cash', NULL, NULL) m;
  IF (SELECT amount FROM accounting_entries WHERE id = v_entry) <> 30 OR league_reg_received(v_a) <> 180
     OR NOT (SELECT registration_fee_paid FROM league_registrations WHERE id = v_a) THEN
    RAISE EXCEPTION 'FAIL T5: the difference was not received as its own line'; END IF;

  -- T6 · correct a PAID price downward: the difference goes back as its own line out, linked from the history.
  SELECT m.entry, m.refusal INTO v_entry, v_refusal FROM club_league_money(v_org, v_season, v_a, 'price', 120, v_day, 'cash', 'Club discount', NULL) m;
  IF v_refusal IS NOT NULL OR (SELECT entry_type FROM accounting_entries WHERE id = v_entry) <> 'expense'
     OR (SELECT amount FROM accounting_entries WHERE id = v_entry) <> 60
     OR (SELECT category FROM accounting_entries WHERE id = v_entry) <> 'registration_refund'
     OR league_reg_received(v_a) <> 120
     OR (SELECT refund_entry_id FROM league_registration_price_changes WHERE registration_id = v_a AND new_amount = 120) <> v_entry THEN
    RAISE EXCEPTION 'FAIL T6: a lowered paid price did not refund the difference (%)', v_refusal; END IF;
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_a, 'price', 120, NULL, NULL, 'again', NULL) m;
  IF v_refusal IS DISTINCT FROM 'same' THEN RAISE EXCEPTION 'FAIL T6: the same price was recorded twice'; END IF;

  -- T7 · undo a payment marked by mistake; refused when refunds would leave the figure below zero.
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_a, 'undo', NULL, NULL, NULL, NULL, NULL) m;
  IF v_refusal IS NOT NULL OR league_reg_received(v_a) <> 90 THEN
    RAISE EXCEPTION 'FAIL T7: undo did not void the latest payment (%; %)', v_refusal, league_reg_received(v_a); END IF;
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_a, 'undo', NULL, NULL, NULL, NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'refunded' OR league_reg_received(v_a) <> 90 THEN
    RAISE EXCEPTION 'FAIL T7: undo erased a payment that has a refund beside it'; END IF;

  -- T8 · ending with money asks; kept needs a reason; kept leaves the payment in the book.
  SELECT c.refusal INTO v_refusal FROM league_registration_close(v_org, v_season, v_a, 'declined', NULL, NULL, false, false, NULL, NULL, NULL, NULL) c;
  IF v_refusal IS DISTINCT FROM 'money' OR (SELECT status FROM league_registrations WHERE id = v_a) <> 'active' THEN
    RAISE EXCEPTION 'FAIL T8: a paid registration ended without an answer'; END IF;
  SELECT c.refusal INTO v_refusal FROM league_registration_close(v_org, v_season, v_a, 'declined', NULL, NULL, false, false, 'kept', '  ', NULL, NULL) c;
  IF v_refusal IS DISTINCT FROM 'reason' THEN RAISE EXCEPTION 'FAIL T8: kept without a reason'; END IF;
  SELECT c.refusal INTO v_refusal FROM league_registration_close(v_org, v_season, v_a, 'declined', NULL, NULL, false, false, 'kept', 'After the refund date', NULL, NULL) c;
  IF v_refusal IS NOT NULL OR (SELECT status FROM league_registrations WHERE id = v_a) <> 'declined'
     OR (SELECT end_money FROM league_registrations WHERE id = v_a) <> 'kept' OR league_reg_received(v_a) <> 90
     OR (SELECT ended_at FROM league_registrations WHERE id = v_a) IS NULL
     OR (SELECT accepted_at FROM league_registrations WHERE id = v_a) IS NULL THEN
    RAISE EXCEPTION 'FAIL T8: kept money left the book or the ending was not recorded (%)', v_refusal; END IF;
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_a, 'receive', NULL, v_day, 'cash', NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'ended' THEN RAISE EXCEPTION 'FAIL T8: an ended registration took money'; END IF;

  -- T9 · release the spot: only an accepted child; the waitlist moves up in the same step and is accepted.
  SELECT c.refusal INTO v_refusal FROM league_registration_close(v_org, v_season, v_b, 'withdrawn', NULL, NULL, true, true, NULL, NULL, NULL, NULL) c;
  IF v_refusal IS DISTINCT FROM 'not_accepted' THEN RAISE EXCEPTION 'FAIL T9: a review child''s spot was released'; END IF;
  UPDATE league_registrations SET status = 'active' WHERE id = v_b;  -- Ava ended; Ben accepted fills A with Dan below
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount)
  VALUES (v_org, v_season, v_div, 'Dan', 'Ng', 'P', 'G', 'd@example.invalid', 'active', 150) RETURNING id INTO v_d;
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, waitlist_position, fee_amount)
  VALUES (v_org, v_season, v_div, 'Wes', 'Ito', 'P', 'G', 'w@example.invalid', 'waitlisted', 1, 150) RETURNING id INTO v_w;
  SELECT c.refusal, c.promoted INTO v_refusal, v_promoted
    FROM league_registration_close(v_org, v_season, v_b, 'withdrawn', NULL, NULL, true, true, NULL, NULL, NULL, NULL) c;
  IF v_refusal IS NOT NULL OR v_promoted IS DISTINCT FROM v_w
     OR NOT (SELECT spot_released FROM league_registrations WHERE id = v_b)
     OR (SELECT status FROM league_registrations WHERE id = v_w) <> 'active'
     OR (SELECT accepted_at FROM league_registrations WHERE id = v_w) IS NULL THEN
    RAISE EXCEPTION 'FAIL T9: release did not move the waitlist up (%)', v_refusal; END IF;

  -- T10 · ending refunded: the refund is its own line, the payment stays, the figure is zero.
  PERFORM 1 FROM club_league_money(v_org, v_season, v_d, 'receive', NULL, v_day, 'cheque', NULL, NULL);
  SELECT c.refusal INTO v_refusal FROM league_registration_close(v_org, v_season, v_d, 'withdrawn', NULL, NULL, false, false, 'refunded', 'Moved away', v_day, 'cheque') c;
  IF v_refusal IS NOT NULL OR league_reg_received(v_d) <> 0
     OR (SELECT count(*) FROM accounting_entries WHERE source_entity_id = v_d AND status = 'posted') <> 2
     OR (SELECT end_money FROM league_registrations WHERE id = v_d) <> 'refunded' THEN
    RAISE EXCEPTION 'FAIL T10: a refunded ending did not keep the payment beside its refund (%)', v_refusal; END IF;

  -- T11 · move division with a price: an unpaid child takes it (history 'moved'); a paid child keeps theirs.
  SELECT c.refusal, c.kept_price INTO v_refusal, v_kept
    FROM league_registration_move_division(v_org, v_season, v_w, v_div2, false, 175, NULL) c;
  IF v_refusal IS NOT NULL OR v_kept OR (SELECT fee_amount FROM league_registrations WHERE id = v_w) <> 175
     OR (SELECT count(*) FROM league_registration_price_changes WHERE registration_id = v_w AND kind = 'moved') <> 1 THEN
    RAISE EXCEPTION 'FAIL T11: an unpaid child was not re-priced on a move (%)', v_refusal; END IF;
  PERFORM 1 FROM club_league_money(v_org, v_season, v_w, 'receive', NULL, v_day, 'cash', NULL, NULL);
  SELECT c.refusal, c.kept_price INTO v_refusal, v_kept
    FROM league_registration_move_division(v_org, v_season, v_w, v_div, false, 150, NULL) c;
  IF v_refusal IS NOT NULL OR NOT v_kept OR (SELECT fee_amount FROM league_registrations WHERE id = v_w) <> 175 THEN
    RAISE EXCEPTION 'FAIL T11: a paid child was re-priced on a move (%)', v_refusal; END IF;

  -- T12 · the old call shapes (code before this release) go through the writer and never void silently.
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount)
  VALUES (v_org, v_season, v_div2, 'Pia', 'Old', 'P', 'G', 'p@example.invalid', 'active', 150) RETURNING id INTO v_p;
  PERFORM club_league_fee_set(v_org, v_season, v_p, true, NULL, v_day);
  PERFORM club_league_fee_set(v_org, v_season, v_p, true, NULL, v_day);
  IF league_reg_received(v_p) <> 150 THEN RAISE EXCEPTION 'FAIL T12: the old tick wrote twice'; END IF;
  PERFORM club_league_fee_set(v_org, v_season, v_p, false, NULL, v_day);
  IF league_reg_received(v_p) <> 0 OR (SELECT registration_fee_paid FROM league_registrations WHERE id = v_p) THEN
    RAISE EXCEPTION 'FAIL T12: the old untick left money'; END IF;

  -- T13 · (mig 369) Undo names its payment: a second press, or a stale window, is refused rather than voiding the next one.
  PERFORM 1 FROM club_league_money(v_org, v_season, v_p, 'receive', NULL, v_day, 'cash', NULL, NULL);
  SELECT e.id INTO v_entry FROM accounting_entries e WHERE e.source_entity_id = v_p AND e.status = 'posted' AND e.entry_type = 'income';
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_p, 'undo', NULL, NULL, NULL, NULL, NULL, gen_random_uuid()) m;
  IF v_refusal IS DISTINCT FROM 'changed' OR league_reg_received(v_p) <> 150 THEN
    RAISE EXCEPTION 'FAIL T13: an Undo naming another payment voided this one (%)', v_refusal; END IF;
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_p, 'undo', NULL, NULL, NULL, NULL, NULL, v_entry) m;
  IF v_refusal IS NOT NULL OR league_reg_received(v_p) <> 0 THEN RAISE EXCEPTION 'FAIL T13: the named Undo failed (%)', v_refusal; END IF;
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_p, 'undo', NULL, NULL, NULL, NULL, NULL, v_entry) m;
  IF v_refusal IS DISTINCT FROM 'nothing_received' THEN RAISE EXCEPTION 'FAIL T13: a second Undo press was not refused (%)', v_refusal; END IF;

  -- T14 · (mig 369) Undo is refused on an ended registration; a kept fee stays kept.
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_a, 'undo', NULL, NULL, NULL, NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'ended' OR league_reg_received(v_a) <> 90 THEN RAISE EXCEPTION 'FAIL T14: Undo voided a kept fee (%)', v_refusal; END IF;

  -- T15 · (mig 369) a lowered paid price with no day is a refusal, not an error; a refund ending with no day too.
  PERFORM 1 FROM club_league_money(v_org, v_season, v_p, 'receive', NULL, v_day, 'cash', NULL, NULL);
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_p, 'price', 100, NULL, NULL, 'discount', NULL) m;
  IF v_refusal IS DISTINCT FROM 'date' THEN RAISE EXCEPTION 'FAIL T15: a lowered price with no day was not refused (%)', v_refusal; END IF;
  SELECT c.refusal INTO v_refusal FROM league_registration_close(v_org, v_season, v_p, 'withdrawn', NULL, NULL, false, false, 'refunded', NULL, NULL, 'cash') c;
  IF v_refusal IS DISTINCT FROM 'date' OR (SELECT status FROM league_registrations WHERE id = v_p) <> 'active' THEN
    RAISE EXCEPTION 'FAIL T15: a refund ending with no day was not refused (%)', v_refusal; END IF;

  -- T16 · (mig 369) a revived registration no longer carries how it ended.
  UPDATE league_registrations SET status = 'active' WHERE id = v_a;
  IF (SELECT end_money FROM league_registrations WHERE id = v_a) IS NOT NULL
     OR (SELECT ended_at FROM league_registrations WHERE id = v_a) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T16: a revived registration kept its ending'; END IF;

  -- T17 · (mig 371) every house-league line carries its season's word — the fee in and the refund out — and the club has
  -- ONE "House league registration fees" category for every season.
  IF EXISTS (SELECT 1 FROM accounting_entries e JOIN accounting_ledgers l ON l.id = e.ledger_id
              WHERE l.entity_type = 'league_season' AND l.entity_id = v_season AND e.source_module = 'league_registration'
                AND (e.budget_item_id IS DISTINCT FROM (SELECT w.item_id FROM league_season_fee_words w WHERE w.season_id = v_season)
                  OR e.budget_category_id IS NULL)) THEN
    RAISE EXCEPTION 'FAIL T17: a house-league line is not filed under its season''s word'; END IF;
  PERFORM 1 FROM club_league_fee_word(v_free);
  IF (SELECT count(DISTINCT w.category_id) FROM league_season_fee_words w WHERE w.org_id = v_org) <> 1
     OR (SELECT count(*) FROM league_season_fee_words w WHERE w.org_id = v_org) <> 2 THEN
    RAISE EXCEPTION 'FAIL T17: the club has more than one fees category, or a season has no word'; END IF;

  -- T18 · (mig 371) the starting budget: Σ size × price over sized divisions (A 2 × 150, B 10 × 150), once.
  UPDATE league_seasons SET registration_open_at = '2026-03-01 12:00+00' WHERE id = v_season;
  IF (club_league_fee_budget_seed(v_season)->>'ok')::boolean IS NOT TRUE
     OR (SELECT b.total_amount FROM org_budget_lines b JOIN league_season_fee_words w ON w.item_id = b.item_id WHERE w.season_id = v_season) <> 1800 THEN
    RAISE EXCEPTION 'FAIL T18: the starting budget is not size × price'; END IF;
  IF club_league_fee_budget_seed(v_season)->>'code' IS DISTINCT FROM 'already_planned' THEN
    RAISE EXCEPTION 'FAIL T18: the starting budget was planned twice'; END IF;

  -- ── Stage 12b (mig 374): a family pays by card ──────────────────────────────────────────────
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount, signup_ref)
  VALUES (v_org, v_season, v_div2, 'Sib', 'One', 'P', 'G', 's@example.invalid', 'active', 150, 'aa11bb22') RETURNING id INTO v_s1;
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount, signup_ref)
  VALUES (v_org, v_season, v_div2, 'Sib', 'Two', 'P', 'G', 's@example.invalid', 'active', 150, 'aa11bb22') RETURNING id INTO v_s2;

  -- T19 · a person never writes "Online, card": the hand write is refused, nothing written.
  SELECT m.entry, m.refusal INTO v_entry, v_refusal FROM club_league_money(v_org, v_season, v_s1, 'receive', NULL, v_day, 'online_card', NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'method' OR v_entry IS NOT NULL OR league_reg_received(v_s1) <> 0 THEN
    RAISE EXCEPTION 'FAIL T19: a hand write said online_card (%)', v_refusal; END IF;

  -- T20 · siblings in ONE checkout: one payment, a line per child through the writer, both paid; the fee is no revenue.
  v_op := gen_random_uuid();
  PERFORM online_payment_league_open(v_op, v_org, 'acct_check', v_season, 'aa11bb22', 'Sib One, Sib Two', 's@example.invalid',
    12.00, 'family', 0.0350, 1.50, false, 'cs_check_' || v_op::text,
    jsonb_build_array(
      jsonb_build_object('registrationId', v_s1, 'description', 'Sib One · B', 'amount', 150, 'feeShare', 6.00),
      jsonb_build_object('registrationId', v_s2, 'description', 'Sib Two · B', 'amount', 150, 'feeShare', 6.00)));
  IF (SELECT total_amount FROM online_payments WHERE id = v_op) <> 312.00 OR (SELECT base_amount FROM online_payments WHERE id = v_op) <> 300 THEN
    RAISE EXCEPTION 'FAIL T20: the payment did not open as base + fee'; END IF;
  v_res := online_payment_league_land(v_op, (v_day + 1)::timestamptz + interval '15 hours', 'pi_check_' || v_op::text, 'ch_x', 'visa', '4242');
  IF (v_res->>'already')::boolean OR (v_res->>'landed')::int <> 2 OR jsonb_array_length(v_res->'unrecorded') <> 0
     OR league_reg_received(v_s1) <> 150 OR league_reg_received(v_s2) <> 150
     OR NOT (SELECT registration_fee_paid FROM league_registrations WHERE id = v_s2)
     OR (SELECT status FROM online_payments WHERE id = v_op) <> 'paid'
     OR (SELECT receipt_no FROM online_payments WHERE id = v_op) IS NULL
     OR EXISTS (SELECT 1 FROM online_payment_items i WHERE i.online_payment_id = v_op AND i.entry_id IS NULL)
     OR EXISTS (SELECT 1 FROM online_payment_items i JOIN accounting_entries e ON e.id = i.entry_id
                 WHERE i.online_payment_id = v_op AND (e.payment_method <> 'online_card' OR e.amount <> 150 OR e.created_by IS NOT NULL
                   OR e.entry_date <> v_day + 1 OR e.source_module <> 'league_registration')) THEN
    RAISE EXCEPTION 'FAIL T20: siblings did not land as one line each (%)', v_res; END IF;

  -- T21 · a replayed webhook writes nothing.
  v_res := online_payment_league_land(v_op, (v_day + 1)::timestamptz + interval '15 hours', 'pi_check_' || v_op::text, 'ch_x', 'visa', '4242');
  IF NOT (v_res->>'already')::boolean
     OR (SELECT count(*) FROM accounting_entries WHERE source_module = 'league_registration' AND source_entity_id IN (v_s1, v_s2)
           AND entry_type = 'income' AND status = 'posted') <> 2 THEN
    RAISE EXCEPTION 'FAIL T21: a replay wrote again (%)', v_res; END IF;

  -- T22 · a card payment has no Undo: it really arrived.
  SELECT m.refusal INTO v_refusal FROM club_league_money(v_org, v_season, v_s1, 'undo', NULL, NULL, NULL, NULL, NULL) m;
  IF v_refusal IS DISTINCT FROM 'card' OR league_reg_received(v_s1) <> 150 THEN RAISE EXCEPTION 'FAIL T22: a card payment was undone (%)', v_refusal; END IF;

  -- T23 · declined between Checkout and the webhook: the payment is PAID, that child's share carries 'ended', nothing written.
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount, signup_ref)
  VALUES (v_org, v_season, v_div2, 'Late', 'Decline', 'P', 'G', 'l@example.invalid', 'active', 150, 'cc33dd44') RETURNING id INTO v_s3;
  v_op := gen_random_uuid();
  PERFORM online_payment_league_open(v_op, v_org, 'acct_check', v_season, 'cc33dd44', 'Late Decline', NULL, 6.75, 'family', 0.0350, 1.50,
    false, 'cs_check_' || v_op::text, jsonb_build_array(jsonb_build_object('registrationId', v_s3, 'description', 'Late Decline · B', 'amount', 150, 'feeShare', 6.75)));
  PERFORM 1 FROM league_registration_close(v_org, v_season, v_s3, 'declined', NULL, NULL, false, false, NULL, NULL, NULL, NULL);
  v_res := online_payment_league_land(v_op, now(), 'pi_check_' || v_op::text, NULL, NULL, NULL);
  IF (v_res->'unrecorded'->0->>'refusal') IS DISTINCT FROM 'ended' OR league_reg_received(v_s3) <> 0
     OR (SELECT status FROM online_payments WHERE id = v_op) <> 'paid' OR (SELECT landed_at FROM online_payments WHERE id = v_op) IS NULL
     OR (SELECT land_error FROM online_payment_items WHERE online_payment_id = v_op) <> 'ended' THEN
    RAISE EXCEPTION 'FAIL T23: a late payment after a decline (%)', v_res; END IF;

  -- T24 · marked received by hand meanwhile: the card share is refused, the hand payment stands alone.
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount, signup_ref)
  VALUES (v_org, v_season, v_div2, 'Hand', 'First', 'P', 'G', 'h@example.invalid', 'active', 150, 'ee55ff66') RETURNING id INTO v_s4;
  v_op := gen_random_uuid();
  PERFORM online_payment_league_open(v_op, v_org, 'acct_check', v_season, 'ee55ff66', 'Hand First', NULL, 6.75, 'family', 0.0350, 1.50,
    false, 'cs_check_' || v_op::text, jsonb_build_array(jsonb_build_object('registrationId', v_s4, 'description', 'Hand First · B', 'amount', 150, 'feeShare', 6.75)));
  PERFORM 1 FROM club_league_money(v_org, v_season, v_s4, 'receive', NULL, v_day, 'cash', NULL, NULL);
  v_res := online_payment_league_land(v_op, now(), 'pi_check_' || v_op::text, NULL, NULL, NULL);
  IF (v_res->'unrecorded'->0->>'refusal') IS DISTINCT FROM 'already_received' OR league_reg_received(v_s4) <> 150 THEN
    RAISE EXCEPTION 'FAIL T24: a card payment landed beside a hand one (%)', v_res; END IF;

  -- T25 · the club pays the fee (A14): the family pays the base, the fee is ONE "Payment processing" COST on the season's
  -- book (source online_payment, a money-out word in the house-league category) — never a fee refund.
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount, signup_ref)
  VALUES (v_org, v_season, v_div2, 'Club', 'Pays', 'P', 'G', 'c@example.invalid', 'active', 150, 'aa77bb88') RETURNING id INTO v_s5;
  v_op := gen_random_uuid();
  PERFORM online_payment_league_open(v_op, v_org, 'acct_check', v_season, 'aa77bb88', 'Club Pays', NULL, 6.75, 'club', 0.0350, 1.50,
    false, 'cs_check_' || v_op::text, jsonb_build_array(jsonb_build_object('registrationId', v_s5, 'description', 'Club Pays · B', 'amount', 150, 'feeShare', 6.75)));
  v_res := online_payment_league_land(v_op, now(), 'pi_check_' || v_op::text, NULL, NULL, NULL);
  IF (SELECT total_amount FROM online_payments WHERE id = v_op) <> 150 OR league_reg_received(v_s5) <> 150
     OR NOT EXISTS (SELECT 1 FROM online_payments p JOIN accounting_entries e ON e.id = p.processing_cost_entry_id
                     JOIN budget_items i ON i.id = e.budget_item_id
                     JOIN league_season_fee_words w ON w.category_id = i.category_id AND w.season_id = v_season
                    WHERE p.id = v_op AND e.amount = 6.75 AND e.entry_type = 'expense' AND e.source_module = 'online_payment'
                      AND i.name = 'Payment processing' AND i.direction = 'out') THEN
    RAISE EXCEPTION 'FAIL T25: a club-paid fee did not file as a Payment processing cost (%)', v_res; END IF;

  -- T26 · paid on a day in a closed fiscal year: booked today (the tournament landing's rule), never refused.
  -- A fixture: the close step's own switch, for this rolled-back check only.
  PERFORM set_config('club.fiscal_step', 'on', true);
  INSERT INTO org_fiscal_years(org_id, name, first_day, last_day, closed_at, closed_by, closing_balance, closing_snapshot)
  VALUES (v_org, 'Closed check', DATE '2025-04-01', DATE '2026-03-31', now(), (SELECT u.id FROM auth.users u LIMIT 1), 0, '{}'::jsonb);
  PERFORM set_config('club.fiscal_step', 'off', true);
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount, signup_ref)
  VALUES (v_org, v_season, v_div2, 'Closed', 'Year', 'P', 'G', 'y@example.invalid', 'active', 150, 'cc99dd00') RETURNING id INTO v_s6;
  v_op := gen_random_uuid();
  PERFORM online_payment_league_open(v_op, v_org, 'acct_check', v_season, 'cc99dd00', 'Closed Year', NULL, 6.75, 'family', 0.0350, 1.50,
    false, 'cs_check_' || v_op::text, jsonb_build_array(jsonb_build_object('registrationId', v_s6, 'description', 'Closed Year · B', 'amount', 150, 'feeShare', 6.75)));
  v_res := online_payment_league_land(v_op, TIMESTAMPTZ '2026-03-15 15:00+00', 'pi_check_' || v_op::text, NULL, NULL, NULL);
  IF jsonb_array_length(v_res->'unrecorded') <> 0 OR (v_res->>'day')::date <> v_today
     OR (SELECT e.entry_date FROM online_payment_items i JOIN accounting_entries e ON e.id = i.entry_id WHERE i.online_payment_id = v_op) <> v_today THEN
    RAISE EXCEPTION 'FAIL T26: a payment in a closed year was not booked today (%)', v_res; END IF;

  -- T27 · the guards: nobody marks a payment paid or writes a child row outside the functions.
  BEGIN
    UPDATE online_payments SET status = 'refunded' WHERE id = v_op;
    RAISE EXCEPTION 'FAIL T27: a hand update to a payment went through';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE online_payment_items SET entry_id = NULL WHERE online_payment_id = v_op;
    RAISE EXCEPTION 'FAIL T27: a hand update to a child row went through';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;

  -- ── Stage 12b Part 5 (mig 375): refunds to the card, in full and in part ──────────────────────
  SELECT i.online_payment_id INTO v_sib FROM online_payment_items i WHERE i.registration_id = v_s2;

  -- T29 · a sibling's FULL refund with A2's box: the child's line goes out through the writer (online_card), the fee
  -- share the club gives back is ONE "Payment processing" cost, the other sibling's money stays, the payment is partly refunded.
  SELECT i.id INTO v_item FROM online_payment_items i WHERE i.registration_id = v_s2;
  v_ref := online_payment_refund_open(v_sib, true, 'club_ended', NULL, NULL, 'app', v_item, NULL, NULL);
  IF (SELECT amount FROM online_payment_refunds WHERE id = v_ref) <> 156.00 OR (SELECT fee_refunded FROM online_payment_refunds WHERE id = v_ref) <> 6.00 THEN
    RAISE EXCEPTION 'FAIL T29: the full refund did not take the child''s share and fee'; END IF;
  v_res := online_payment_league_refund_book(v_ref, 're_check_1', true);
  IF league_reg_received(v_s2) <> 0 OR league_reg_received(v_s1) <> 150
     OR (SELECT status FROM online_payments WHERE id = v_sib) <> 'partly_refunded'
     OR (SELECT payment_method FROM accounting_entries WHERE id = (SELECT refund_entry_id FROM online_payment_refunds WHERE id = v_ref)) <> 'online_card'
     OR (SELECT source_module FROM accounting_entries WHERE id = (SELECT processing_cost_entry_id FROM online_payment_refunds WHERE id = v_ref)) <> 'online_payment'
     OR (SELECT status FROM online_payment_refunds WHERE id = v_ref) <> 'succeeded' THEN
    RAISE EXCEPTION 'FAIL T29: a sibling''s card refund booked wrong (%)', v_res; END IF;
  -- A replay books nothing twice.
  PERFORM online_payment_league_refund_book(v_ref, 're_check_1', true);
  IF (SELECT count(*) FROM accounting_entries WHERE source_module = 'league_registration' AND source_entity_id = v_s2 AND entry_type = 'expense') <> 1 THEN
    RAISE EXCEPTION 'FAIL T29: a replayed refund wrote again'; END IF;

  -- T30 · PART of a share: needs a reason, never takes the fee, and never more than is left.
  SELECT i.id INTO v_item FROM online_payment_items i WHERE i.registration_id = v_s1;
  BEGIN
    PERFORM online_payment_refund_open(v_sib, true, 'family_left', NULL, NULL, 'app', v_item, 50, NULL);
    RAISE EXCEPTION 'FAIL T30: a partial refund without a reason went through';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  v_ref := online_payment_refund_open(v_sib, true, 'family_left', NULL, NULL, 'app', v_item, 50, 'Missed the first month');
  IF (SELECT fee_refunded FROM online_payment_refunds WHERE id = v_ref) <> 0 OR (SELECT amount FROM online_payment_refunds WHERE id = v_ref) <> 50 THEN
    RAISE EXCEPTION 'FAIL T30: a partial refund took the fee'; END IF;
  PERFORM online_payment_league_refund_book(v_ref, NULL, false);
  IF league_reg_received(v_s1) <> 100 OR (SELECT booked_at FROM online_payment_refunds WHERE id = v_ref) IS NULL
     OR (SELECT status FROM online_payment_refunds WHERE id = v_ref) <> 'pending' THEN
    RAISE EXCEPTION 'FAIL T30: a pending partial refund was not booked'; END IF;
  BEGIN
    PERFORM online_payment_refund_open(v_sib, false, 'family_left', NULL, NULL, 'app', v_item, 101, 'More than is left');
    RAISE EXCEPTION 'FAIL T30: a refund above what is left went through';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;

  -- T31 · a share that never landed (declined mid-checkout, T23): the refund returns Stripe's money, no line to reverse.
  SELECT i.id, i.online_payment_id INTO v_item, v_op FROM online_payment_items i WHERE i.registration_id = v_s3;
  v_ref := online_payment_refund_open(v_op, true, 'club_ended', NULL, NULL, 'app', v_item, NULL, NULL);
  PERFORM online_payment_league_refund_book(v_ref, 're_check_3', true);
  IF (SELECT refund_entry_id FROM online_payment_refunds WHERE id = v_ref) IS NOT NULL OR league_reg_received(v_s3) <> 0
     OR (SELECT status FROM online_payments WHERE id = v_op) <> 'refunded' THEN
    RAISE EXCEPTION 'FAIL T31: an unrecorded share''s refund wrote a line, or the payment did not read refunded'; END IF;

  -- T32 · nobody books, marks or opens a house-league refund by hand: no child named, or another payment's child.
  BEGIN
    INSERT INTO online_payment_refunds(online_payment_id, org_id, amount) VALUES (v_sib, v_org, 10);
    RAISE EXCEPTION 'FAIL T32: a house-league refund without a child went in';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;

  -- T28 · a child is in at most ONE open payment, whatever key opened it (two payable pages = paying twice).
  INSERT INTO league_registrations(org_id, season_id, division_id, player_first_name, player_last_name,
    guardian_first_name, guardian_last_name, guardian_email, status, fee_amount)
  VALUES (v_org, v_season, v_div2, 'Two', 'Pages', 'P', 'G', 't@example.invalid', 'active', 150) RETURNING id INTO v_s7;
  PERFORM online_payment_league_open(gen_random_uuid(), v_org, 'acct_check', v_season, v_s7::text, 'Two Pages', NULL, 6.75, 'family', 0.0350, 1.50,
    false, 'cs_check_a_' || v_s7::text, jsonb_build_array(jsonb_build_object('registrationId', v_s7, 'description', 'Two Pages · B', 'amount', 150, 'feeShare', 6.75)));
  BEGIN
    PERFORM online_payment_league_open(gen_random_uuid(), v_org, 'acct_check', v_season, 'other-key', 'Two Pages', NULL, 6.75, 'family', 0.0350, 1.50,
      false, 'cs_check_b_' || v_s7::text, jsonb_build_array(jsonb_build_object('registrationId', v_s7, 'description', 'Two Pages · B', 'amount', 150, 'feeShare', 6.75)));
    RAISE EXCEPTION 'FAIL T28: a second open payment for one child went through';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
  END;

  RAISE EXCEPTION 'HOUSE_LEAGUE_MONEY_PASSED';
END $hlmoney$;
