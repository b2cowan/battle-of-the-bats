-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- THE CLUB MONEY MOVES, RUN FOR REAL AND ROLLED BACK (Club Tier Stage 3a — check:club-money-atomicity).
-- Run by scripts/check-club-money-atomicity.mjs against DEV only. The whole block ALWAYS ends in an
-- exception — 'CLUB_MONEY_ATOMICITY_PASSED' when every assertion held — so nothing it writes survives.
-- The MUTATIONS placeholder below is replaced by the runner: empty for the real run, or one EXECUTE that swaps a function
-- for a mutated copy (rolled back with everything else) to prove the test catches it.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
DO $test$
DECLARE
  v_user uuid; v_org uuid; v_team uuid; v_py uuid; v_alloc uuid; v_split uuid;
  v_i1 uuid; v_i2 uuid; v_i3 uuid; v_i4 uuid; v_r1 uuid; v_r2 uuid;
  v_general uuid; v_book2 uuid; v_team_ledger uuid; v_p1 uuid; v_p2 uuid;
  r jsonb; n integer; t uuid; t2 uuid;
BEGIN
  {{MUTATIONS}}

  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT t0.id, t0.org_id, py.id INTO v_team, v_org, v_py
    FROM rep_teams t0 JOIN rep_program_years py ON py.team_id = t0.id
   ORDER BY t0.created_at LIMIT 1;
  IF v_team IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'FAIL: dev has no team with a season to test on'; END IF;

  INSERT INTO rep_cost_allocations (org_id, description, total_amount, created_by)
  VALUES (v_org, 'ATOMICITY PROBE', 1350, v_user) RETURNING id INTO v_alloc;
  INSERT INTO rep_allocation_splits (allocation_id, team_id, program_year_id, org_id, amount, split_method, split_value, payment_schedule)
  VALUES (v_alloc, v_team, v_py, v_org, 1350, 'fixed', 0, 'standard') RETURNING id INTO v_split;
  INSERT INTO rep_allocation_installments (split_id, installment_number, amount, due_date, org_id, team_id)
  VALUES (v_split, 1, 450, '2026-08-15', v_org, v_team) RETURNING id INTO v_i1;
  INSERT INTO rep_allocation_installments (split_id, installment_number, amount, due_date, org_id, team_id)
  VALUES (v_split, 2, 450, '2026-09-15', v_org, v_team) RETURNING id INTO v_i2;
  INSERT INTO rep_allocation_installments (split_id, installment_number, amount, due_date, org_id, team_id)
  VALUES (v_split, 3, 450, '2026-10-15', v_org, v_team) RETURNING id INTO v_i3;

  -- ── T1 · record received, twice: one pair of lines, the second refused ──
  r := club_installment_receive(v_i1, v_org, v_user, 'unpaid', '2026-09-28', 'etransfer', 'E-Transfer', '4471', 'club words', 'team words', 'Team allocations');
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T1: first receive refused: %', r; END IF;
  r := club_installment_receive(v_i1, v_org, v_user, 'unpaid', '2026-09-28', 'etransfer', 'E-Transfer', '4471', 'club words', 'team words', 'Team allocations');
  IF (r->>'ok')::boolean OR r->>'state' IS DISTINCT FROM 'received' THEN RAISE EXCEPTION 'FAIL T1: a second receive was not refused: %', r; END IF;
  SELECT count(*) INTO n FROM accounting_entries WHERE source_entity_id = v_i1 AND status = 'posted';
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T1: a double submit left % lines, not one pair', n; END IF;
  SELECT count(*) INTO n FROM rep_allocation_installments i JOIN accounting_entries e ON e.id = i.accounting_entry_id
   WHERE i.id = v_i1 AND i.paid_at IS NOT NULL AND e.entry_type = 'transfer_out' AND e.linked_entry_id IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL T1: the installment does not keep its payer-side line'; END IF;

  -- ── T2 · a step that fails leaves NOTHING (the stamp fails after the lines were inserted) ──
  BEGIN
    r := club_installment_receive(v_i2, v_org, v_user, 'unpaid', '2026-09-28', 'bogus', 'Bogus', NULL, 'c', 't', 'Team allocations');
    RAISE EXCEPTION 'FAIL T2: a receive with an impossible method succeeded: %', r;
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SELECT count(*) INTO n FROM accounting_entries WHERE source_entity_id = v_i2;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T2: a failed receive left % orphaned line(s)', n; END IF;
  IF EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_i2 AND paid_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL T2: a failed receive stamped the installment'; END IF;

  -- ── T3 · sent, then confirm: "record received" refuses a sent one; "confirm" writes the pair ──
  UPDATE rep_allocation_installments SET sent_at = now(), sent_on = '2026-09-29', sent_by = v_user, sent_method = 'cheque' WHERE id = v_i3;
  r := club_installment_receive(v_i3, v_org, v_user, 'unpaid', '2026-09-30', 'cheque', 'Cheque', '2210', 'c', 't', 'Team allocations');
  IF (r->>'ok')::boolean OR r->>'state' IS DISTINCT FROM 'sent' THEN RAISE EXCEPTION 'FAIL T3: receive did not see the coach''s sent: %', r; END IF;
  r := club_installment_receive(v_i3, v_org, v_user, 'sent', '2026-09-30', 'cheque', 'Cheque', '2210', 'c', 't', 'Team allocations');
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T3: confirm refused: %', r; END IF;
  SELECT count(*) INTO n FROM accounting_entries WHERE source_entity_id = v_i3 AND status = 'posted';
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T3: confirm wrote % lines', n; END IF;
  r := club_installment_receive(v_i2, v_org, v_user, 'sent', '2026-09-30', NULL, NULL, NULL, 'c', 't', 'Team allocations');
  IF (r->>'ok')::boolean OR r->>'state' IS DISTINCT FROM 'unpaid' THEN RAISE EXCEPTION 'FAIL T3: confirm accepted an unsent installment: %', r; END IF;

  -- ── T4 · undo: both lines voided with the reason; unpaid again; a second undo refused ──
  r := club_installment_undo(v_i1, v_org, v_user, 'Cheque returned');
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T4: undo refused: %', r; END IF;
  SELECT count(*) INTO n FROM accounting_entries WHERE source_entity_id = v_i1 AND status = 'void' AND void_reason = 'Cheque returned' AND voided_by = v_user;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T4: undo voided % of the two lines', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_i1 AND paid_at IS NULL AND accounting_entry_id IS NULL AND undone_reason = 'Cheque returned') THEN
    RAISE EXCEPTION 'FAIL T4: the installment is not unpaid with the club''s reason'; END IF;
  r := club_installment_undo(v_i1, v_org, v_user, 'again');
  IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T4: a second undo was not refused'; END IF;

  -- ── T5 · a payment recorded before links could be kept is refused, never guessed ──
  INSERT INTO rep_allocation_installments (split_id, installment_number, amount, due_date, org_id, team_id, paid_at, paid_by)
  VALUES (v_split, 4, 10, '2026-07-01', v_org, v_team, now(), v_user) RETURNING id INTO v_i4;
  BEGIN
    r := club_installment_undo(v_i4, v_org, v_user, 'x');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL T5: an unlinked undo errored instead of refusing in words: %', SQLERRM;
  END;
  IF (r->>'ok')::boolean OR r->>'code' IS DISTINCT FROM 'unlinked' THEN RAISE EXCEPTION 'FAIL T5: an unlinked undo was not refused: %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_i4 AND paid_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL T5: an unlinked undo cleared the stamp anyway'; END IF;

  -- ── T6 · approve, twice: one transfer, the second refused, the link kept ──
  INSERT INTO rep_team_payment_requests (org_id, team_id, program_year_id, request_type, amount, description, created_by, money_in_meaning)
  VALUES (v_org, v_team, v_py, 'charge_to_org', 120, 'ATOMICITY PROBE', v_user, 'funding') RETURNING id INTO v_r1;
  r := club_request_approve(v_r1, v_org, v_user, '2026-09-05', 'etransfer', 'E-Transfer', NULL, 'Paid to team', 'From club', 'Team support');
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T6: approve refused: %', r; END IF;
  r := club_request_approve(v_r1, v_org, v_user, '2026-09-05', 'etransfer', 'E-Transfer', NULL, 'Paid to team', 'From club', 'Team support');
  IF (r->>'ok')::boolean OR r->>'state' IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'FAIL T6: a double approval was not refused: %', r; END IF;
  SELECT count(*) INTO n FROM accounting_entries WHERE source_entity_id = v_r1 AND status = 'posted';
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T6: a double approval left % lines', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_team_payment_requests WHERE id = v_r1 AND status = 'approved' AND accounting_entry_id IS NOT NULL AND paid_on = '2026-09-05') THEN
    RAISE EXCEPTION 'FAIL T6: the approval lost its link or its day'; END IF;

  -- ── T7 · a failed approval leaves nothing, and the request still waits ──
  INSERT INTO rep_team_payment_requests (org_id, team_id, program_year_id, request_type, amount, description, created_by)
  VALUES (v_org, v_team, v_py, 'payment_to_org', 80, 'ATOMICITY PROBE 2', v_user) RETURNING id INTO v_r2;
  BEGIN
    r := club_request_approve(v_r2, v_org, v_user, '2026-09-05', 'bogus', 'Bogus', NULL, 'c', 't', 'Team support');
    RAISE EXCEPTION 'FAIL T7: an approval with an impossible method succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SELECT count(*) INTO n FROM accounting_entries WHERE source_entity_id = v_r2;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T7: a failed approval left % line(s)', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_team_payment_requests WHERE id = v_r2 AND status = 'pending') THEN
    RAISE EXCEPTION 'FAIL T7: a failed approval moved the request'; END IF;

  -- ── T8 · reverse: both lines voided, the request closed as reversed; a second reverse refused ──
  r := club_request_reverse(v_r1, v_org, v_user, 'Wrong team');
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T8: reverse refused: %', r; END IF;
  SELECT count(*) INTO n FROM accounting_entries WHERE source_entity_id = v_r1 AND status = 'void' AND void_reason = 'Wrong team';
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T8: reverse voided % of the two lines', n; END IF;
  r := club_request_reverse(v_r1, v_org, v_user, 'again');
  IF (r->>'ok')::boolean OR r->>'state' IS DISTINCT FROM 'reversed' THEN RAISE EXCEPTION 'FAIL T8: a second reverse was not refused: %', r; END IF;
  r := club_request_reverse(v_r2, v_org, v_user, 'x');
  IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T8: a waiting request was reversed'; END IF;

  -- ── T9 · a transfer voids both halves; a team's book and a sourced line are refused ──
  v_general := club_general_ledger(v_org);
  IF club_general_ledger(v_org) <> v_general THEN RAISE EXCEPTION 'FAIL T9: the General ledger was made twice'; END IF;
  SELECT count(*) INTO n FROM accounting_ledgers WHERE org_id = v_org AND entity_type = 'org' AND entity_id IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL T9: % General ledgers', n; END IF;
  INSERT INTO accounting_ledgers (org_id, entity_type, entity_id, name) VALUES (v_org, 'org', gen_random_uuid(), 'ATOMICITY PROBE book') RETURNING id INTO v_book2;
  t := create_accounting_transfer(v_general, v_book2, 500, '2026-09-22', 'float', 'Float', v_user);
  r := club_transfer_void(t, v_org, v_user, 'Wrong tournament');
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T9: a club transfer void refused: %', r; END IF;
  SELECT count(*) INTO n FROM accounting_entries WHERE id IN (t, (SELECT linked_entry_id FROM accounting_entries WHERE id = t)) AND status = 'void' AND void_reason = 'Wrong tournament';
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T9: the transfer void took % of two halves', n; END IF;
  r := club_transfer_void(t, v_org, v_user, 'again');
  IF r->>'code' IS DISTINCT FROM 'already_void' THEN RAISE EXCEPTION 'FAIL T9: a second void was not refused: %', r; END IF;
  v_team_ledger := club_team_ledger(v_org, v_team);
  t := create_accounting_transfer(v_team_ledger, v_general, 50, '2026-09-22', 'into the team book', NULL, v_user);
  r := club_transfer_void(t, v_org, v_user, 'x');
  IF r->>'code' IS DISTINCT FROM 'team_book' THEN RAISE EXCEPTION 'FAIL T9: a transfer touching a team''s book was voided: %', r; END IF;
  t2 := create_accounting_transfer(v_general, v_book2, 30, '2026-09-22', 'sourced', NULL, v_user);
  UPDATE accounting_entries SET source_module = 'rep_payment_request' WHERE id = t2;
  r := club_transfer_void(t2, v_org, v_user, 'x');
  IF r->>'code' IS DISTINCT FROM 'from_a_source' THEN RAISE EXCEPTION 'FAIL T9: a sourced line was voided on the ledger: %', r; END IF;

  -- ── T10 · payees merge in one step ──
  INSERT INTO org_payees (org_id, name) VALUES (v_org, 'ATOMICITY Mizuno Canada') RETURNING id INTO v_p1;
  INSERT INTO org_payees (org_id, name) VALUES (v_org, 'ATOMICITY Mizuno Canada Ltd.') RETURNING id INTO v_p2;
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, payee_id, created_by)
  VALUES (v_general, '2026-09-10', 'Gloves', 300, 'expense', 'posted', v_p1, v_user);
  r := club_payee_merge(v_org, v_p1, v_p2);
  IF NOT (r->>'ok')::boolean OR (r->>'moved')::int <> 1 THEN RAISE EXCEPTION 'FAIL T10: merge: %', r; END IF;
  IF EXISTS (SELECT 1 FROM org_payees WHERE id = v_p1) THEN RAISE EXCEPTION 'FAIL T10: the merged payee is still there'; END IF;
  IF EXISTS (SELECT 1 FROM accounting_entries WHERE payee_id = v_p1) THEN RAISE EXCEPTION 'FAIL T10: a line still names the merged payee'; END IF;
  r := club_payee_merge(v_org, v_p2, v_p2);
  IF r->>'code' IS DISTINCT FROM 'same_payee' THEN RAISE EXCEPTION 'FAIL T10: a payee merged into itself: %', r; END IF;

  -- ── T11 · a reminder wave is claimed once: a double submit sends one wave (/review 2026-10-01) ──
  DELETE FROM rep_allocation_reminder_waves WHERE org_id = v_org;   -- rolled back with the rest
  r := club_reminder_wave_claim(v_org, v_user, NULL, ARRAY[v_team], 2, 900);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL T11: the first claim was refused: %', r; END IF;
  r := club_reminder_wave_claim(v_org, v_user, NULL, ARRAY[v_team], 2, 900);
  IF r->>'code' IS DISTINCT FROM 'just_sent' THEN RAISE EXCEPTION 'FAIL T11: a second claim inside a minute was not refused: %', r; END IF;
  r := club_reminder_wave_claim(v_org, v_user, v_team, ARRAY[v_team], 1, 450);
  IF r->>'code' IS DISTINCT FROM 'just_sent' THEN RAISE EXCEPTION 'FAIL T11: the single-team claim ignored a wave that reached the team: %', r; END IF;
  SELECT count(*) INTO n FROM rep_allocation_reminder_waves WHERE org_id = v_org;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL T11: % waves claimed for one send', n; END IF;

  RAISE EXCEPTION 'CLUB_MONEY_ATOMICITY_PASSED';
END
$test$;
