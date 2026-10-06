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
  v_corg uuid; v_ct1 uuid; v_cpy1 uuid; v_ct2 uuid; v_cpy2 uuid; v_worg uuid; v_wteam uuid;
  v_own1 uuid; v_own2 uuid; v_other uuid; v_shared uuid; v_unshared uuid;
  v_line uuid; v_inline uuid; v_keeper uuid; v_loser uuid; v_word uuid; v_inword uuid;
  v_oorg uuid; v_oteam uuid; v_opy uuid; v_oline uuid; v_req uuid; v_a uuid; v_num numeric; v_num2 numeric;
  v_word2 uuid; v_inword2 uuid; v_spare uuid;
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

  -- ════ Ledger Parity (mig 316): shared payees and a team's own merge ════
  SELECT t1.org_id, t1.id, py1.id, t2.id, py2.id INTO v_corg, v_ct1, v_cpy1, v_ct2, v_cpy2
    FROM rep_teams t1 JOIN rep_program_years py1 ON py1.team_id = t1.id
    JOIN rep_teams t2 ON t2.org_id = t1.org_id AND t2.id <> t1.id
    JOIN rep_program_years py2 ON py2.team_id = t2.id
    JOIN organizations o ON o.id = t1.org_id
   WHERE o.account_kind IS DISTINCT FROM 'team_workspace' AND o.plan_id IS DISTINCT FROM 'team'
   ORDER BY t1.created_at, t2.created_at LIMIT 1;
  SELECT t0.org_id, t0.id INTO v_worg, v_wteam
    FROM rep_teams t0 JOIN organizations o ON o.id = t0.org_id
   WHERE o.account_kind = 'team_workspace' OR o.plan_id = 'team'
   ORDER BY t0.created_at LIMIT 1;
  IF v_ct2 IS NULL OR v_wteam IS NULL THEN
    RAISE EXCEPTION 'FAIL: dev needs a club with two teams in season and one standalone team to test payees on'; END IF;

  -- ── T12 · only a club payee is shared, and a shared one always carries its stamp ──
  BEGIN
    INSERT INTO org_payees (org_id, team_id, name, shared_with_teams, shared_at)
    VALUES (v_corg, v_ct1, 'ATOMICITY team shared', true, now());
    RAISE EXCEPTION 'FAIL T12: a team''s own payee was shared';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO org_payees (org_id, name, shared_with_teams) VALUES (v_corg, 'ATOMICITY no stamp', true);
    RAISE EXCEPTION 'FAIL T12: a payee was shared with no shared_at';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO org_payees (org_id, team_id, name) VALUES (v_corg, v_ct1, 'ATOMICITY Ace Pitching') RETURNING id INTO v_own1;
  INSERT INTO org_payees (org_id, team_id, name) VALUES (v_corg, v_ct1, 'ATOMICITY Ace Pitching Inc') RETURNING id INTO v_own2;
  INSERT INTO org_payees (org_id, team_id, name) VALUES (v_corg, v_ct2, 'ATOMICITY Other team''s') RETURNING id INTO v_other;
  INSERT INTO org_payees (org_id, name, shared_with_teams, shared_at)
  VALUES (v_corg, 'ATOMICITY Ace Pitching Academy', true, now() - interval '2 days') RETURNING id INTO v_shared;
  INSERT INTO org_payees (org_id, name) VALUES (v_corg, 'ATOMICITY Club private') RETURNING id INTO v_unshared;
  INSERT INTO rep_team_expenses (program_year_id, team_id, org_id, expense_type, description, amount, payee_id)
  VALUES (v_cpy1, v_ct1, v_corg, 'expense', 'Pitching lesson', 120, v_own2),
         (v_cpy1, v_ct1, v_corg, 'expense', 'Pitching lesson', 120, v_own2);

  -- ── T13 · a team merges its own duplicate into its own: this team's records move, the duplicate goes ──
  r := team_payee_merge(v_corg, v_ct1, v_own2, v_own1);
  IF NOT coalesce((r->>'ok')::boolean, false) OR (r->>'moved')::int <> 2 THEN RAISE EXCEPTION 'FAIL T13: own merge: %', r; END IF;
  IF EXISTS (SELECT 1 FROM org_payees WHERE id = v_own2) THEN RAISE EXCEPTION 'FAIL T13: the merged payee is still there'; END IF;
  SELECT count(*) INTO n FROM rep_team_expenses WHERE payee_id = v_own1 AND team_id = v_ct1;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T13: % of 2 records moved to the payee kept', n; END IF;

  -- ── T14 · what a team may NOT merge: never the club's, never into what it cannot see ──
  r := team_payee_merge(v_corg, v_ct1, v_own1, v_own1);
  IF r->>'code' IS DISTINCT FROM 'same_payee' THEN RAISE EXCEPTION 'FAIL T14: a payee merged into itself: %', r; END IF;
  r := team_payee_merge(v_corg, v_ct1, v_shared, v_own1);
  IF r->>'code' IS DISTINCT FROM 'not_allowed' THEN RAISE EXCEPTION 'FAIL T14: a team merged away a shared club payee: %', r; END IF;
  r := team_payee_merge(v_corg, v_ct1, v_unshared, v_own1);
  IF r->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T14: a team merged away an unshared club payee: %', r; END IF;
  r := team_payee_merge(v_corg, v_ct1, v_other, v_own1);
  IF r->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T14: a team merged away another team''s payee: %', r; END IF;
  r := team_payee_merge(v_corg, v_ct1, v_own1, v_unshared);
  IF r->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T14: a team merged into an unshared club payee: %', r; END IF;
  r := team_payee_merge(v_corg, v_ct1, v_own1, v_other);
  IF r->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T14: a team merged into another team''s payee: %', r; END IF;
  r := team_payee_merge(v_corg, v_ct2, v_own1, v_other);
  IF r->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T14: another team merged this team''s payee: %', r; END IF;
  r := team_payee_merge(v_worg, v_ct1, v_own1, v_shared);
  IF r->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T14: a team was merged from another org: %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_payees WHERE id = v_own1) THEN RAISE EXCEPTION 'FAIL T14: a refused merge removed the payee'; END IF;

  -- ── T15 · a record outside this team naming the payee refuses the merge, and nothing moves ──
  INSERT INTO rep_team_expenses (program_year_id, team_id, org_id, expense_type, description, amount, payee_id)
  VALUES (v_cpy2, v_ct2, v_corg, 'expense', 'Named across teams', 10, v_own1) RETURNING id INTO t;
  BEGIN
    r := team_payee_merge(v_corg, v_ct1, v_own1, v_shared);
  EXCEPTION WHEN foreign_key_violation THEN
    -- Without the check the merge reaches the delete and the FK stops it: a raw error the coach sees as a crash.
    RAISE EXCEPTION 'FAIL T15: the merge reached the delete over another team''s record (FK error, not a refusal)';
  END;
  IF r->>'code' IS DISTINCT FROM 'named_elsewhere' THEN RAISE EXCEPTION 'FAIL T15: merge went ahead over another team''s record: %', r; END IF;
  SELECT count(*) INTO n FROM rep_team_expenses WHERE payee_id = v_own1;
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL T15: a refused merge moved records (% still name it, not 3)', n; END IF;
  DELETE FROM rep_team_expenses WHERE id = t;

  -- ── T16 · a team merges its own into the club's SHARED payee; the club's payee is untouched ──
  r := team_payee_merge(v_corg, v_ct1, v_own1, v_shared);
  IF NOT coalesce((r->>'ok')::boolean, false) OR (r->>'moved')::int <> 2 THEN RAISE EXCEPTION 'FAIL T16: merge into shared: %', r; END IF;
  SELECT count(*) INTO n FROM org_payees WHERE id = v_shared AND team_id IS NULL AND shared_with_teams;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL T16: the shared club payee changed'; END IF;

  -- ── T17 · a standalone team: its org's `team_id IS NULL` payees are its own ──
  INSERT INTO org_payees (org_id, name) VALUES (v_worg, 'ATOMICITY Workspace own') RETURNING id INTO v_p1;
  INSERT INTO org_payees (org_id, team_id, name) VALUES (v_worg, v_wteam, 'ATOMICITY Workspace own 2') RETURNING id INTO v_p2;
  r := team_payee_merge(v_worg, v_wteam, v_p1, v_p2);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T17: a standalone team could not merge its own payee: %', r; END IF;

  -- ── T18 · the club's merge keeps sharing honest: shared if either was, with the LATER stamp ──
  INSERT INTO org_payees (org_id, name, shared_with_teams, shared_at)
  VALUES (v_corg, 'ATOMICITY Diamond A', true, now() - interval '9 days') RETURNING id INTO v_p1;
  INSERT INTO org_payees (org_id, name) VALUES (v_corg, 'ATOMICITY Diamond B') RETURNING id INTO v_p2;
  INSERT INTO rep_team_expenses (program_year_id, team_id, org_id, expense_type, description, amount, payee_id)
  VALUES (v_cpy1, v_ct1, v_corg, 'expense', 'Diamond rental', 80, v_p1);
  r := club_payee_merge(v_corg, v_p1, v_p2);
  IF NOT (r->>'ok')::boolean OR (r->>'entries')::int <> 0 OR (r->>'expenses')::int <> 1 THEN RAISE EXCEPTION 'FAIL T18: club merge: %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_payees WHERE id = v_p2 AND shared_with_teams AND shared_at < now() - interval '8 days') THEN
    RAISE EXCEPTION 'FAIL T18: the payee kept lost the sharing it absorbed'; END IF;
  INSERT INTO org_payees (org_id, name, shared_with_teams, shared_at)
  VALUES (v_corg, 'ATOMICITY Diamond C', true, now() - interval '1 day') RETURNING id INTO v_p1;
  r := club_payee_merge(v_corg, v_p1, v_p2);
  IF NOT EXISTS (SELECT 1 FROM org_payees WHERE id = v_p2 AND shared_with_teams AND shared_at > now() - interval '2 days') THEN
    RAISE EXCEPTION 'FAIL T18: the payee kept did not take the LATER stamp — earlier payments would count'; END IF;

  -- ══ Club Tier Stage 3b (mig 317): the Budget's steps. Years 2091+ so no real plan is touched. ══
  SELECT id INTO v_word FROM budget_items WHERE org_id IS NULL AND direction = 'out' ORDER BY id LIMIT 1;
  SELECT id INTO v_inword FROM budget_items WHERE org_id IS NULL AND direction = 'in' ORDER BY id LIMIT 1;
  SELECT t0.org_id, t0.id, py.id INTO v_oorg, v_oteam, v_opy
    FROM rep_teams t0 JOIN rep_program_years py ON py.team_id = t0.id WHERE t0.org_id <> v_org ORDER BY t0.created_at LIMIT 1;
  IF v_word IS NULL OR v_inword IS NULL OR v_oteam IS NULL THEN RAISE EXCEPTION 'FAIL: dev lacks the words or a second club to test 3b on'; END IF;

  -- ── T19 · an allocation from a line: ONE step, many per line, refused above what is left, its total its shares ──
  INSERT INTO org_budget_lines (org_id, season_year, description, total_amount, item_id)
  VALUES (v_org, 2091, 'ATOMICITY line', 1000, v_word) RETURNING id INTO v_line;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY first', v_line, NULL, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 600, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 600, 'dueDate', '2091-05-01')))));
  IF NOT coalesce((r->>'ok')::boolean, false) OR (r->>'total')::numeric <> 600 THEN RAISE EXCEPTION 'FAIL T19: first allocation: %', r; END IF;
  SELECT count(*) INTO n FROM rep_cost_allocations WHERE id = (r->>'allocationId')::uuid AND source_budget_line_id = v_line AND total_amount = 600;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL T19: the allocation does not carry its line and its shares'' total'; END IF;
  SELECT count(*) INTO n FROM rep_allocation_installments i JOIN rep_allocation_splits s ON s.id = i.split_id WHERE s.allocation_id = (r->>'allocationId')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL T19: the installments were not written in the same step'; END IF;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY top-up', v_line, NULL, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 300, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 300, 'dueDate', '2091-09-01')))));
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T19: a second allocation from the line was refused: %', r; END IF;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY too much', v_line, NULL, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 200, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 200, 'dueDate', '2091-10-01')))));
  IF r->>'code' IS DISTINCT FROM 'over_line' OR (r->>'left')::numeric <> 100 THEN RAISE EXCEPTION 'FAIL T19: more than is left on the line was allocated: %', r; END IF;
  SELECT count(*) INTO n FROM rep_cost_allocations WHERE source_budget_line_id = v_line;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T19: % allocations on the line, not 2', n; END IF;
  -- a team of ANOTHER club: refused, and the step leaves nothing behind
  BEGIN
    r := club_allocation_create(v_org, v_user, 'ATOMICITY elsewhere', v_line, NULL, jsonb_build_array(jsonb_build_object(
      'teamId', v_oteam, 'programYearId', v_opy, 'amount', 50, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
      'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2091-10-01')))));
    n := -1;
  EXCEPTION WHEN raise_exception THEN n := 0;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T19: another club''s team was billed from this club''s line'; END IF;
  SELECT count(*) INTO n FROM rep_cost_allocations WHERE description = 'ATOMICITY elsewhere';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T19: a refused allocation left a half-made one'; END IF;
  -- a money-in line bills nobody; another club's line is not this club's
  INSERT INTO org_budget_lines (org_id, season_year, description, total_amount, item_id)
  VALUES (v_org, 2091, 'ATOMICITY revenue', 500, v_inword) RETURNING id INTO v_inline;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY in', v_inline, NULL, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 50, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2091-10-01')))));
  IF r->>'code' IS DISTINCT FROM 'not_a_cost_line' THEN RAISE EXCEPTION 'FAIL T19: a money-in line billed teams: %', r; END IF;
  INSERT INTO org_budget_lines (org_id, season_year, description, total_amount) VALUES (v_oorg, 2091, 'ATOMICITY theirs', 999) RETURNING id INTO v_oline;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY theirs', v_oline, NULL, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 50, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2091-10-01')))));
  IF r->>'code' IS DISTINCT FROM 'line_not_found' THEN RAISE EXCEPTION 'FAIL T19: billed from another club''s line: %', r; END IF;
  -- a general allocation's source: a LIVE line on one of the club's OWN books, checked inside the step
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_general, '2091-02-01', 'ATOMICITY voided source', 10, 'expense', 'void', v_user) RETURNING id INTO t;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY from a void line', NULL, t, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 10, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 10, 'dueDate', '2091-10-01')))));
  IF r->>'code' IS DISTINCT FROM 'bad_source_entry' THEN RAISE EXCEPTION 'FAIL T19: an allocation drew on a voided line: %', r; END IF;
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_team_ledger, '2091-02-01', 'ATOMICITY team-book source', 10, 'expense', 'posted', v_user) RETURNING id INTO t2;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY from a team book', NULL, t2, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 10, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 10, 'dueDate', '2091-10-01')))));
  IF r->>'code' IS DISTINCT FROM 'bad_source_entry' THEN RAISE EXCEPTION 'FAIL T19: an allocation drew on a team''s book: %', r; END IF;
  -- a negative share can never offset a positive one (the step's floor; the table's CHECK behind it)
  BEGIN
    r := club_allocation_create(v_org, v_user, 'ATOMICITY offset', NULL, NULL, jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 100, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 100, 'dueDate', '2091-10-01')))) || jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', -50, 'splitMethod', 'fixed', 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', -50, 'dueDate', '2091-10-01')))));
    n := -1;
  EXCEPTION WHEN raise_exception OR check_violation THEN n := 0;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T19: a negative share offset a positive one'; END IF;

  -- ── T20 · a line's total and its dates: one step, every save checked (allocated 900 on a 1,000 line) ──
  r := club_budget_line_save(v_org, v_line, 800, NULL, NULL, NULL, NULL);
  IF r->>'code' IS DISTINCT FROM 'below_allocated' OR (r->>'allocated')::numeric <> 900 THEN RAISE EXCEPTION 'FAIL T20: a total below what is allocated saved: %', r; END IF;
  UPDATE org_budget_lines SET total_amount = 850 WHERE id = v_line;   -- billed above its total before the floor
  r := club_budget_line_save(v_org, v_line, 850, '[]'::jsonb, NULL, NULL, NULL);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T20: an UNCHANGED total was refused (a pre-floor line could never be edited): %', r; END IF;
  r := club_budget_line_save(v_org, v_line, 1200, '[{"label":"Spring","date":"2091-04-15","amount":500}]'::jsonb, NULL, NULL, NULL);
  IF r->>'code' IS DISTINCT FROM 'periods_dont_add_up' THEN RAISE EXCEPTION 'FAIL T20: dates that don''t add up saved: %', r; END IF;
  r := club_budget_line_save(v_org, v_line, 1200, '[{"label":"Spring","date":"2091-04-15","amount":600},{"label":"Fall","date":"2091-09-15","amount":600.01}]'::jsonb, NULL, NULL, NULL);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T20: dates within a cent were refused: %', r; END IF;
  SELECT count(*), sum(amount) INTO n, v_num FROM org_budget_periods WHERE budget_line_id = v_line;
  IF n <> 2 OR v_num <> 1200.01 THEN RAISE EXCEPTION 'FAIL T20: the full replace left % dates worth %', n, v_num; END IF;
  r := club_budget_line_save(v_org, v_line, 1300, NULL, NULL, NULL, NULL);
  IF r->>'code' IS DISTINCT FROM 'periods_dont_add_up' THEN RAISE EXCEPTION 'FAIL T20: a total change left its dates behind: %', r; END IF;
  r := club_budget_line_save(v_org, v_line, NULL, '[{"label":"Zero","date":null,"amount":0}]'::jsonb, NULL, NULL, NULL);
  IF r->>'code' IS DISTINCT FROM 'bad_period_amount' THEN RAISE EXCEPTION 'FAIL T20: a zero date amount saved: %', r; END IF;
  r := club_budget_line_save(v_org, v_line, NULL, NULL, '2001-01-01T00:00:00Z', NULL, NULL);
  IF r->>'code' IS DISTINCT FROM 'line_changed' THEN RAISE EXCEPTION 'FAIL T20: a save from a stale read went through: %', r; END IF;
  r := club_budget_line_save(v_oorg, v_line, 1200, NULL, NULL, NULL, NULL);
  IF r->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T20: another club saved this club''s line: %', r; END IF;
  -- the word and the words save in the SAME step: the category is the word's, a key present is written
  SELECT id INTO v_word2 FROM budget_items
   WHERE org_id IS NULL AND direction = 'out' AND category_id <> (SELECT category_id FROM budget_items WHERE id = v_word)
   ORDER BY id LIMIT 1;
  SELECT id INTO v_inword2 FROM budget_items WHERE org_id IS NULL AND direction = 'in' AND id <> v_inword ORDER BY id LIMIT 1;
  IF v_word2 IS NULL OR v_inword2 IS NULL THEN RAISE EXCEPTION 'FAIL: dev lacks the words to test a re-filing on'; END IF;
  r := club_budget_line_save(v_org, v_line, NULL, NULL, NULL, v_word2, '{"description":"ATOMICITY renamed","notes":"","sortOrder":3}'::jsonb);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T20: re-filing under a free word was refused: %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines l JOIN budget_items i ON i.id = v_word2
                  WHERE l.id = v_line AND l.item_id = v_word2 AND l.category_id = i.category_id
                    AND l.description = 'ATOMICITY renamed' AND l.notes IS NULL AND l.sort_order = 3) THEN
    RAISE EXCEPTION 'FAIL T20: the word, its category and the words did not save together'; END IF;
  -- a word already on the year: refused, naming the line that holds it — and NOTHING of the save sticks
  r := club_budget_line_save(v_org, v_line, 1300, NULL, NULL, v_inword, '{"description":"ATOMICITY must not stick"}'::jsonb);
  IF r->>'code' IS DISTINCT FROM 'word_on_plan' OR (r->>'existingLineId')::uuid IS DISTINCT FROM v_inline THEN
    RAISE EXCEPTION 'FAIL T20: a word already on the year was taken twice: %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines WHERE id = v_line AND description = 'ATOMICITY renamed' AND total_amount = 1200) THEN
    RAISE EXCEPTION 'FAIL T20: a refused save left part of itself behind'; END IF;
  -- a line teams are billed from stays a cost (else what they owe counts as revenue twice)
  r := club_budget_line_save(v_org, v_line, NULL, NULL, NULL, v_inword2, NULL);
  IF r->>'code' IS DISTINCT FROM 'allocated_line_is_a_cost' THEN RAISE EXCEPTION 'FAIL T20: a billed line took a money-in word: %', r; END IF;
  r := club_budget_line_save(v_org, v_line, NULL, NULL, NULL, NULL, '{"description":"   "}'::jsonb);
  IF r->>'code' IS DISTINCT FROM 'bad_description' THEN RAISE EXCEPTION 'FAIL T20: a blank description saved: %', r; END IF;
  -- removing a line: one step, refused while it is billed from, only the club's own
  r := club_budget_line_delete(v_org, v_line);
  IF r->>'code' IS DISTINCT FROM 'has_allocations' THEN RAISE EXCEPTION 'FAIL T20: a line teams are billed from was removed: %', r; END IF;
  r := club_budget_line_delete(v_oorg, v_inline);
  IF r->>'code' IS DISTINCT FROM 'not_found' THEN RAISE EXCEPTION 'FAIL T20: another club removed this club''s line: %', r; END IF;
  INSERT INTO org_budget_lines (org_id, season_year, description, total_amount) VALUES (v_org, 2099, 'ATOMICITY spare', 10) RETURNING id INTO v_spare;
  r := club_budget_line_delete(v_org, v_spare);
  IF NOT coalesce((r->>'ok')::boolean, false) OR EXISTS (SELECT 1 FROM org_budget_lines WHERE id = v_spare) THEN
    RAISE EXCEPTION 'FAIL T20: a free line was not removed: %', r; END IF;

  -- ── T24 · a line is ADDED in one step with its dates; the dates rule is one function ──
  r := club_budget_line_add(v_org, 2094, v_word, 'ATOMICITY added', 300, 'n', 0,
    '[{"label":"Spring","date":"2094-04-01","amount":100},{"label":"Fall","date":"2094-09-01","amount":200}]'::jsonb);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T24: an add was refused: %', r; END IF;
  v_spare := (r->>'lineId')::uuid;
  SELECT count(*), sum(amount) INTO n, v_num FROM org_budget_periods WHERE budget_line_id = v_spare;
  IF n <> 2 OR v_num <> 300 THEN RAISE EXCEPTION 'FAIL T24: the line came without its dates (% worth %)', n, v_num; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines l JOIN budget_items i ON i.id = v_word WHERE l.id = v_spare AND l.category_id = i.category_id) THEN
    RAISE EXCEPTION 'FAIL T24: the line''s category is not its word''s'; END IF;
  r := club_budget_line_add(v_org, 2094, v_word2, 'ATOMICITY bad dates', 300, NULL, 0, '[{"label":"Spring","date":null,"amount":100}]'::jsonb);
  SELECT count(*) INTO n FROM org_budget_lines WHERE org_id = v_org AND season_year = 2094 AND item_id = v_word2;
  IF r->>'code' IS DISTINCT FROM 'periods_dont_add_up' OR n <> 0 THEN RAISE EXCEPTION 'FAIL T24: dates that don''t add up made a line (% lines): %', n, r; END IF;
  r := club_budget_line_add(v_org, 2094, v_word, 'ATOMICITY again', 50, NULL, 0, NULL);
  SELECT count(*) INTO n FROM org_budget_lines WHERE org_id = v_org AND season_year = 2094 AND item_id = v_word;
  IF r->>'code' IS DISTINCT FROM 'word_on_plan' OR (r->>'existingLineId')::uuid IS DISTINCT FROM v_spare OR n <> 1 THEN
    RAISE EXCEPTION 'FAIL T24: a word was planned twice on a year (% lines): %', n, r; END IF;
  -- kept dates are re-checked only against a CHANGED total (dates that stopped adding up before the rule)
  UPDATE org_budget_lines SET total_amount = 999 WHERE id = v_spare;
  r := club_budget_line_save(v_org, v_spare, NULL, NULL, NULL, NULL, '{"notes":"still mine"}'::jsonb);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T24: a notes-only save was refused over dates written before the rule: %', r; END IF;
  r := club_budget_line_save(v_org, v_spare, 1000, NULL, NULL, NULL, NULL);
  IF r->>'code' IS DISTINCT FROM 'periods_dont_add_up' THEN RAISE EXCEPTION 'FAIL T24: a CHANGED total left its dates behind: %', r; END IF;

  -- ── T21 · start a year from another: lines and dates moved on; never into a year that has a plan ──
  r := club_budget_roll_year(v_org, 2091, 2093);
  IF NOT coalesce((r->>'ok')::boolean, false) OR (r->>'lines')::int <> 2 THEN RAISE EXCEPTION 'FAIL T21: roll: %', r; END IF;
  SELECT count(*) INTO n FROM org_budget_periods p JOIN org_budget_lines l ON l.id = p.budget_line_id
   WHERE l.org_id = v_org AND l.season_year = 2093 AND p.period_date IN ('2093-04-15', '2093-09-15');
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T21: the dates did not move on two years (% of 2)', n; END IF;
  SELECT count(*) INTO n FROM rep_cost_allocations a JOIN org_budget_lines l ON l.id = a.source_budget_line_id WHERE l.season_year = 2093 AND l.org_id = v_org;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T21: something billed came with the plan'; END IF;
  r := club_budget_roll_year(v_org, 2091, 2093);
  IF r->>'code' IS DISTINCT FROM 'year_has_lines' THEN RAISE EXCEPTION 'FAIL T21: a roll merged into a year that has a plan: %', r; END IF;
  -- ⚠ and a plan whose lines share NO word with the source: the one-word index cannot catch that, only the rule can
  INSERT INTO org_budget_lines (org_id, season_year, description, total_amount) VALUES (v_org, 2095, 'ATOMICITY word-less', 10);
  r := club_budget_roll_year(v_org, 2091, 2095);
  SELECT count(*) INTO n FROM org_budget_lines WHERE org_id = v_org AND season_year = 2095;
  IF r->>'code' IS DISTINCT FROM 'year_has_lines' OR n <> 1 THEN RAISE EXCEPTION 'FAIL T21: a roll merged into a year with a plan of other words (% lines now): %', n, r; END IF;
  r := club_budget_roll_year(v_org, 2097, 2098);
  IF r->>'code' IS DISTINCT FROM 'nothing_to_copy' THEN RAISE EXCEPTION 'FAIL T21: an empty year rolled: %', r; END IF;

  -- ── T22 · a book's sums are ONE SQL aggregate, and posted is the only thing that moves a balance ──
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_general, '2091-01-02', 'ATOMICITY pending', 777, 'expense', 'pending', v_user),
         (v_general, '2091-01-03', 'ATOMICITY void', 555, 'income', 'void', v_user),
         (v_general, '2091-01-04', 'ATOMICITY posted', 12.34, 'income', 'posted', v_user);
  SELECT balance, posted_in, pending_out INTO v_num, v_num2, n FROM club_book_totals(ARRAY[v_general], '2091-01-01', '2091-12-31');
  IF v_num IS DISTINCT FROM (SELECT coalesce(sum(CASE WHEN entry_type IN ('income', 'transfer_in') THEN amount ELSE -amount END), 0)
                               FROM accounting_entries WHERE ledger_id = v_general AND status = 'posted') THEN
    RAISE EXCEPTION 'FAIL T22: the SQL balance (%) is not the posted walk', v_num; END IF;
  IF v_num2 <> 12.34 OR n <> 777 THEN RAISE EXCEPTION 'FAIL T22: the window''s sums are wrong (posted in %, pending out %)', v_num2, n; END IF;

  -- ── T23 · one word, one line: the migration's own join, on real twins (index dropped and rolled back) ──
  DROP INDEX org_budget_lines_one_line_per_item;
  INSERT INTO org_budget_lines (org_id, season_year, description, total_amount, item_id, notes, created_at)
  VALUES (v_org, 2096, 'ATOMICITY keeper', 500, v_word, 'first', now() - interval '2 days') RETURNING id INTO v_keeper;
  INSERT INTO org_budget_lines (org_id, season_year, description, total_amount, item_id, notes, created_at)
  VALUES (v_org, 2096, 'ATOMICITY twin', 300, v_word, 'second', now() - interval '1 day') RETURNING id INTO v_loser;
  INSERT INTO org_budget_periods (budget_line_id, period_label, period_date, amount) VALUES (v_keeper, 'Apr', '2096-04-01', 500);
  INSERT INTO rep_cost_allocations (org_id, description, total_amount, created_by, source_budget_line_id)
  VALUES (v_org, 'ATOMICITY on the twin', 100, v_user, v_loser) RETURNING id INTO v_a;
  INSERT INTO rep_team_payment_requests (org_id, team_id, program_year_id, request_type, amount, description, created_by, budget_line_id)
  VALUES (v_org, v_team, v_py, 'payment_to_org', 10, 'ATOMICITY on the twin', v_user, v_loser) RETURNING id INTO v_req;
  {{JOIN}}
  SELECT count(*), sum(total_amount) INTO n, v_num FROM org_budget_lines WHERE org_id = v_org AND season_year = 2096 AND item_id = v_word;
  IF n <> 1 OR v_num <> 800 THEN RAISE EXCEPTION 'FAIL T23: the join left % line(s) worth %', n, v_num; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines WHERE id = v_keeper AND notes = 'first; second') THEN RAISE EXCEPTION 'FAIL T23: the earliest line did not survive with both notes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_cost_allocations WHERE id = v_a AND source_budget_line_id = v_keeper) THEN RAISE EXCEPTION 'FAIL T23: the allocation lost its line'; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_team_payment_requests WHERE id = v_req AND budget_line_id = v_keeper) THEN RAISE EXCEPTION 'FAIL T23: the request lost its line'; END IF;
  SELECT count(*), sum(amount) INTO n, v_num FROM org_budget_periods WHERE budget_line_id = v_keeper;
  IF n <> 2 OR v_num <> 800 THEN RAISE EXCEPTION 'FAIL T23: the joined line''s dates (% worth %) don''t add up to it', n, v_num; END IF;
  CREATE UNIQUE INDEX org_budget_lines_one_line_per_item ON org_budget_lines (org_id, season_year, item_id) WHERE item_id IS NOT NULL;
  BEGIN
    INSERT INTO org_budget_lines (org_id, season_year, description, total_amount, item_id) VALUES (v_org, 2096, 'ATOMICITY again', 5, v_word);
    n := -1;
  EXCEPTION WHEN unique_violation THEN n := 0;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T23: a second line on one word was let in'; END IF;

  RAISE EXCEPTION 'CLUB_MONEY_ATOMICITY_PASSED';
END
$test$;
