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
  -- Club Tier Stage 3c (mig 318): the fiscal year's keys, and two throwaway clubs made inside the block.
  v_y91 uuid; v_y93 uuid; v_y94 uuid; v_y95 uuid; v_y96 uuid; v_y97 uuid; v_y99 uuid;
  v_k91 date; v_k93 date; v_k94 date; v_k95 date; v_k97 date; v_k98 date;
  v_forg uuid; v_fteam uuid; v_fs1 uuid; v_fs2 uuid; v_fgen uuid; v_fbook uuid; v_ftour uuid;
  v_fe1 uuid; v_fe2 uuid; v_fcheque uuid; v_fline uuid; v_fline26 uuid; v_falloc uuid; v_fsplit uuid; v_fi1 uuid; v_fi2 uuid; v_fi3 uuid; v_fi4 uuid;
  v_fs3 uuid; v_hline uuid; v_halloc uuid; v_hentry uuid; v_horg uuid; v_hgen uuid; v_hline2 uuid;
  v_gorg uuid; v_gA uuid; v_gB uuid; v_gC uuid; v_gD uuid; v_gE uuid; v_gteam uuid; v_gpy uuid; v_galloc uuid;
  v_row org_fiscal_years%ROWTYPE; v_d date;
  r jsonb; n integer; t uuid; t2 uuid;
BEGIN
  {{MUTATIONS}}

  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  -- A team with a RUNNING season: since mig 318 only an open season can be billed (S3C-09).
  SELECT t0.id, t0.org_id, py.id INTO v_team, v_org, v_py
    FROM rep_teams t0 JOIN rep_program_years py ON py.team_id = t0.id
   WHERE py.status IN ('draft', 'active')
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

  -- ══ Club Tier Stage 3b (mig 317, keyed on the fiscal year since mig 318): the Budget's steps. Years 2091+
  -- so no real plan is touched; each year's key is read from the club's own fiscal years. ══
  SELECT id INTO v_word FROM budget_items WHERE org_id IS NULL AND direction = 'out' ORDER BY id LIMIT 1;
  SELECT id INTO v_inword FROM budget_items WHERE org_id IS NULL AND direction = 'in' ORDER BY id LIMIT 1;
  SELECT t0.org_id, t0.id, py.id INTO v_oorg, v_oteam, v_opy
    FROM rep_teams t0 JOIN rep_program_years py ON py.team_id = t0.id WHERE t0.org_id <> v_org ORDER BY t0.created_at LIMIT 1;
  IF v_word IS NULL OR v_inword IS NULL OR v_oteam IS NULL THEN RAISE EXCEPTION 'FAIL: dev lacks the words or a second club to test 3b on'; END IF;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_org, '2091-06-15'); v_y91 := v_row.id; v_k91 := v_row.first_day;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_org, '2093-06-15'); v_y93 := v_row.id; v_k93 := v_row.first_day;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_org, '2094-06-15'); v_y94 := v_row.id; v_k94 := v_row.first_day;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_org, '2095-06-15'); v_y95 := v_row.id; v_k95 := v_row.first_day;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_org, '2096-06-15'); v_y96 := v_row.id;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_org, '2097-06-15'); v_y97 := v_row.id; v_k97 := v_row.first_day;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_org, '2098-06-15'); v_k98 := v_row.first_day;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_org, '2099-06-15'); v_y99 := v_row.id;

  -- ── T19 · an allocation from a line: ONE step, many per line, refused above what is left, its total its shares ──
  INSERT INTO org_budget_lines (org_id, fiscal_year_id, description, total_amount, item_id)
  VALUES (v_org, v_y91, 'ATOMICITY line', 1000, v_word) RETURNING id INTO v_line;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY first', v_line, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 600, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 600, 'dueDate', '2091-05-01')))));
  IF NOT coalesce((r->>'ok')::boolean, false) OR (r->>'total')::numeric <> 600 THEN RAISE EXCEPTION 'FAIL T19: first allocation: %', r; END IF;
  SELECT count(*) INTO n FROM rep_cost_allocations WHERE id = (r->>'allocationId')::uuid AND source_budget_line_id = v_line AND total_amount = 600 AND source_entry_id IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL T19: the allocation does not carry its line and its shares'' total'; END IF;
  SELECT count(*) INTO n FROM rep_allocation_installments i JOIN rep_allocation_splits s ON s.id = i.split_id WHERE s.allocation_id = (r->>'allocationId')::uuid;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL T19: the installments were not written in the same step'; END IF;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY top-up', v_line, 'even', jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 300, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 300, 'dueDate', '2091-09-01')))));
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T19: a second allocation from the line was refused: %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_allocation_splits WHERE allocation_id = (r->>'allocationId')::uuid AND split_method = 'even') THEN
    RAISE EXCEPTION 'FAIL T19: an Evenly bill did not keep its method'; END IF;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY too much', v_line, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 200, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 200, 'dueDate', '2091-10-01')))));
  IF r->>'code' IS DISTINCT FROM 'over_line' OR (r->>'left')::numeric <> 100 THEN RAISE EXCEPTION 'FAIL T19: more than is left on the line was allocated: %', r; END IF;
  SELECT count(*) INTO n FROM rep_cost_allocations WHERE source_budget_line_id = v_line;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T19: % allocations on the line, not 2', n; END IF;
  -- a team of ANOTHER club: refused, and the step leaves nothing behind
  BEGIN
    r := club_allocation_create(v_org, v_user, 'ATOMICITY elsewhere', v_line, 'fixed', jsonb_build_array(jsonb_build_object(
      'teamId', v_oteam, 'programYearId', v_opy, 'amount', 50, 'splitValue', 0, 'paymentSchedule', 'standard',
      'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2091-10-01')))));
    n := -1;
  EXCEPTION WHEN raise_exception THEN n := 0;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T19: another club''s team was billed from this club''s line'; END IF;
  SELECT count(*) INTO n FROM rep_cost_allocations WHERE description = 'ATOMICITY elsewhere';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T19: a refused allocation left a half-made one'; END IF;
  -- a money-in line bills nobody; another club's line is not this club's
  INSERT INTO org_budget_lines (org_id, fiscal_year_id, description, total_amount, item_id)
  VALUES (v_org, v_y91, 'ATOMICITY revenue', 500, v_inword) RETURNING id INTO v_inline;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY in', v_inline, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 50, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2091-10-01')))));
  IF r->>'code' IS DISTINCT FROM 'not_a_cost_line' THEN RAISE EXCEPTION 'FAIL T19: a money-in line billed teams: %', r; END IF;
  INSERT INTO org_budget_lines (org_id, fiscal_year_id, description, total_amount)
  VALUES (v_oorg, (SELECT id FROM club_fiscal_year_row(v_oorg, '2091-06-15')), 'ATOMICITY theirs', 999) RETURNING id INTO v_oline;
  r := club_allocation_create(v_org, v_user, 'ATOMICITY theirs', v_oline, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 50, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2091-10-01')))));
  IF r->>'code' IS DISTINCT FROM 'line_not_found' THEN RAISE EXCEPTION 'FAIL T19: billed from another club''s line: %', r; END IF;
  -- a negative share can never offset a positive one (the step's floor; the table's CHECK behind it)
  BEGIN
    r := club_allocation_create(v_org, v_user, 'ATOMICITY offset', NULL, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', 100, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 100, 'dueDate', '2091-10-01')))) || jsonb_build_array(jsonb_build_object(
    'teamId', v_team, 'programYearId', v_py, 'amount', -50, 'splitValue', 0, 'paymentSchedule', 'standard',
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
  INSERT INTO org_budget_lines (org_id, fiscal_year_id, description, total_amount) VALUES (v_org, v_y99, 'ATOMICITY spare', 10) RETURNING id INTO v_spare;
  r := club_budget_line_delete(v_org, v_spare);
  IF NOT coalesce((r->>'ok')::boolean, false) OR EXISTS (SELECT 1 FROM org_budget_lines WHERE id = v_spare) THEN
    RAISE EXCEPTION 'FAIL T20: a free line was not removed: %', r; END IF;

  -- ── T24 · a line is ADDED in one step with its dates; the dates rule is one function ──
  r := club_budget_line_add(v_org, v_k94, v_word, 'ATOMICITY added', 300, 'n', 0,
    '[{"label":"Spring","date":"2094-04-01","amount":100},{"label":"Fall","date":"2094-09-01","amount":200}]'::jsonb);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T24: an add was refused: %', r; END IF;
  v_spare := (r->>'lineId')::uuid;
  SELECT count(*), sum(amount) INTO n, v_num FROM org_budget_periods WHERE budget_line_id = v_spare;
  IF n <> 2 OR v_num <> 300 THEN RAISE EXCEPTION 'FAIL T24: the line came without its dates (% worth %)', n, v_num; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines l JOIN budget_items i ON i.id = v_word
                  WHERE l.id = v_spare AND l.category_id = i.category_id AND l.fiscal_year_id = v_y94) THEN
    RAISE EXCEPTION 'FAIL T24: the line''s category is not its word''s, or it is not on its year'; END IF;
  r := club_budget_line_add(v_org, v_k94, v_word2, 'ATOMICITY bad dates', 300, NULL, 0, '[{"label":"Spring","date":null,"amount":100}]'::jsonb);
  SELECT count(*) INTO n FROM org_budget_lines WHERE fiscal_year_id = v_y94 AND item_id = v_word2;
  IF r->>'code' IS DISTINCT FROM 'periods_dont_add_up' OR n <> 0 THEN RAISE EXCEPTION 'FAIL T24: dates that don''t add up made a line (% lines): %', n, r; END IF;
  r := club_budget_line_add(v_org, v_k94, v_word, 'ATOMICITY again', 50, NULL, 0, NULL);
  SELECT count(*) INTO n FROM org_budget_lines WHERE fiscal_year_id = v_y94 AND item_id = v_word;
  IF r->>'code' IS DISTINCT FROM 'word_on_plan' OR (r->>'existingLineId')::uuid IS DISTINCT FROM v_spare OR n <> 1 THEN
    RAISE EXCEPTION 'FAIL T24: a word was planned twice on a year (% lines): %', n, r; END IF;
  r := club_budget_line_add(v_org, v_k94 + 1, v_word2, 'ATOMICITY not a year', 50, NULL, 0, NULL);
  IF r->>'code' IS DISTINCT FROM 'bad_year' THEN RAISE EXCEPTION 'FAIL T24: a day that starts no year took a line: %', r; END IF;
  -- kept dates are re-checked only against a CHANGED total (dates that stopped adding up before the rule)
  UPDATE org_budget_lines SET total_amount = 999 WHERE id = v_spare;
  r := club_budget_line_save(v_org, v_spare, NULL, NULL, NULL, NULL, '{"notes":"still mine"}'::jsonb);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T24: a notes-only save was refused over dates written before the rule: %', r; END IF;
  r := club_budget_line_save(v_org, v_spare, 1000, NULL, NULL, NULL, NULL);
  IF r->>'code' IS DISTINCT FROM 'periods_dont_add_up' THEN RAISE EXCEPTION 'FAIL T24: a CHANGED total left its dates behind: %', r; END IF;

  -- ── T21 · start a year from another: lines and dates moved on; never into a year that has a plan ──
  r := club_budget_roll_year(v_org, v_k91, v_k93);
  IF NOT coalesce((r->>'ok')::boolean, false) OR (r->>'lines')::int <> 2 THEN RAISE EXCEPTION 'FAIL T21: roll: %', r; END IF;
  SELECT count(*) INTO n FROM org_budget_periods p JOIN org_budget_lines l ON l.id = p.budget_line_id
   WHERE l.fiscal_year_id = v_y93 AND p.period_date IN ('2093-04-15', '2093-09-15');
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL T21: the dates did not move on two years (% of 2)', n; END IF;
  SELECT count(*) INTO n FROM rep_cost_allocations a JOIN org_budget_lines l ON l.id = a.source_budget_line_id WHERE l.fiscal_year_id = v_y93;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T21: something billed came with the plan'; END IF;
  r := club_budget_roll_year(v_org, v_k91, v_k93);
  IF r->>'code' IS DISTINCT FROM 'year_has_lines' THEN RAISE EXCEPTION 'FAIL T21: a roll merged into a year that has a plan: %', r; END IF;
  -- ⚠ and a plan whose lines share NO word with the source: the one-word index cannot catch that, only the rule can
  INSERT INTO org_budget_lines (org_id, fiscal_year_id, description, total_amount) VALUES (v_org, v_y95, 'ATOMICITY word-less', 10);
  r := club_budget_roll_year(v_org, v_k91, v_k95);
  SELECT count(*) INTO n FROM org_budget_lines WHERE fiscal_year_id = v_y95;
  IF r->>'code' IS DISTINCT FROM 'year_has_lines' OR n <> 1 THEN RAISE EXCEPTION 'FAIL T21: a roll merged into a year with a plan of other words (% lines now): %', n, r; END IF;
  r := club_budget_roll_year(v_org, v_k97, v_k98);
  IF r->>'code' IS DISTINCT FROM 'nothing_to_copy' THEN RAISE EXCEPTION 'FAIL T21: an empty year rolled: %', r; END IF;
  -- a one-month date's stored label is written again from its moved date (3c's fix to Start from)
  INSERT INTO org_budget_lines (org_id, fiscal_year_id, description, total_amount, item_id)
  VALUES (v_org, v_y97, 'ATOMICITY one month', 40, v_word) RETURNING id INTO v_spare;
  INSERT INTO org_budget_periods (budget_line_id, period_label, period_date, amount)
  VALUES (v_spare, trim(to_char(v_k97 + 31, 'FMMonth YYYY')), v_k97 + 31, 40);
  r := club_budget_roll_year(v_org, v_k97, v_k98);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T21: a one-month line did not roll: %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_periods p JOIN org_budget_lines l ON l.id = p.budget_line_id
                  WHERE l.fiscal_year_id = (SELECT id FROM club_fiscal_year_row(v_org, v_k98))
                    AND p.period_label = trim(to_char((v_k97 + 31 + interval '1 year')::date, 'FMMonth YYYY'))) THEN
    RAISE EXCEPTION 'FAIL T21: the moved month kept last year''s label'; END IF;

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

  -- ── T23 · one word, one line: mig 317's own join, on real twins (318's index dropped and rolled back) ──
  DROP INDEX org_budget_lines_one_word_per_fiscal_year;
  INSERT INTO org_budget_lines (org_id, fiscal_year_id, description, total_amount, item_id, notes, created_at)
  VALUES (v_org, v_y96, 'ATOMICITY keeper', 500, v_word, 'first', now() - interval '2 days') RETURNING id INTO v_keeper;
  INSERT INTO org_budget_lines (org_id, fiscal_year_id, description, total_amount, item_id, notes, created_at)
  VALUES (v_org, v_y96, 'ATOMICITY twin', 300, v_word, 'second', now() - interval '1 day') RETURNING id INTO v_loser;
  INSERT INTO org_budget_periods (budget_line_id, period_label, period_date, amount) VALUES (v_keeper, 'Apr', '2096-04-01', 500);
  INSERT INTO rep_cost_allocations (org_id, description, total_amount, created_by, source_budget_line_id)
  VALUES (v_org, 'ATOMICITY on the twin', 100, v_user, v_loser) RETURNING id INTO v_a;
  INSERT INTO rep_team_payment_requests (org_id, team_id, program_year_id, request_type, amount, description, created_by, budget_line_id)
  VALUES (v_org, v_team, v_py, 'payment_to_org', 10, 'ATOMICITY on the twin', v_user, v_loser) RETURNING id INTO v_req;
  {{JOIN}}
  SELECT count(*), sum(total_amount) INTO n, v_num FROM org_budget_lines WHERE fiscal_year_id = v_y96 AND item_id = v_word;
  IF n <> 1 OR v_num <> 800 THEN RAISE EXCEPTION 'FAIL T23: the join left % line(s) worth %', n, v_num; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines WHERE id = v_keeper AND notes = 'first; second') THEN RAISE EXCEPTION 'FAIL T23: the earliest line did not survive with both notes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_cost_allocations WHERE id = v_a AND source_budget_line_id = v_keeper) THEN RAISE EXCEPTION 'FAIL T23: the allocation lost its line'; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_team_payment_requests WHERE id = v_req AND budget_line_id = v_keeper) THEN RAISE EXCEPTION 'FAIL T23: the request lost its line'; END IF;
  SELECT count(*), sum(amount) INTO n, v_num FROM org_budget_periods WHERE budget_line_id = v_keeper;
  IF n <> 2 OR v_num <> 800 THEN RAISE EXCEPTION 'FAIL T23: the joined line''s dates (% worth %) don''t add up to it', n, v_num; END IF;
  CREATE UNIQUE INDEX org_budget_lines_one_word_per_fiscal_year ON org_budget_lines (fiscal_year_id, item_id) WHERE item_id IS NOT NULL;
  BEGIN
    INSERT INTO org_budget_lines (org_id, fiscal_year_id, description, total_amount, item_id) VALUES (v_org, v_y96, 'ATOMICITY again', 5, v_word);
    n := -1;
  EXCEPTION WHEN unique_violation THEN n := 0;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T23: a second line on one word was let in'; END IF;

  -- ══ Club Tier Stage 3c (mig 318): the fiscal year, its close, its lock, the carrying season. Two throwaway
  -- clubs made here (a January club, F; a club whose first month changes, G), so no real club is touched and
  -- the dev clubs' own years can't bend a result. ══
  INSERT INTO organizations (name, slug) VALUES ('ATOMICITY fiscal club', 'atomicity-fiscal-' || substr(md5(random()::text), 1, 10)) RETURNING id INTO v_forg;
  INSERT INTO rep_teams (org_id, name, slug) VALUES (v_forg, 'ATOMICITY 13U', 'atomicity-13u-' || substr(md5(random()::text), 1, 8)) RETURNING id INTO v_fteam;
  INSERT INTO rep_program_years (org_id, team_id, name, year, status, created_at)
  VALUES (v_forg, v_fteam, '2025 Season', 2025, 'active', now() - interval '400 days') RETURNING id INTO v_fs1;
  v_fgen  := club_general_ledger(v_forg);
  v_fbook := club_team_ledger(v_forg, v_fteam);
  INSERT INTO accounting_ledgers (org_id, entity_type, entity_id, name) VALUES (v_forg, 'tournament', gen_random_uuid(), 'ATOMICITY Classic') RETURNING id INTO v_ftour;

  -- ── T25 · the fiscal year a day falls in, and the name rule ──
  IF club_fiscal_year_name('2026-01-01', '2026-12-31') <> '2026' OR club_fiscal_year_name('2025-09-01', '2026-08-31') <> '2025–26'
     OR club_fiscal_year_name('2099-09-01', '2100-08-31') <> '2099–00' OR club_fiscal_year_name('2027-01-01', '2027-08-31') <> '2027' THEN
    RAISE EXCEPTION 'FAIL T25: the name rule'; END IF;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_forg, '2026-03-04');
  IF v_row.first_day <> '2026-01-01' OR v_row.last_day <> '2026-12-31' OR v_row.name <> '2026' THEN
    RAISE EXCEPTION 'FAIL T25: a January club''s year is not the calendar year: % % %', v_row.first_day, v_row.last_day, v_row.name; END IF;
  SELECT * INTO v_row FROM club_fiscal_year_row(v_forg, '2028-05-01');
  SELECT * INTO v_row FROM club_fiscal_year_row(v_forg, '2024-02-02');
  SELECT count(*) INTO n FROM org_fiscal_years WHERE org_id = v_forg;
  IF n <> 5 THEN RAISE EXCEPTION 'FAIL T25: a year was made without every year between it and the rows (% rows, not 5)', n; END IF;
  SET CONSTRAINTS org_fiscal_years_chain IMMEDIATE;
  SET CONSTRAINTS org_fiscal_years_chain DEFERRED;
  IF club_fiscal_year_ensure(v_forg, '2026-12-31') <> club_fiscal_year_ensure(v_forg, '2026-01-01')
     OR club_fiscal_year_ensure(v_forg, '2027-01-01') = club_fiscal_year_ensure(v_forg, '2026-12-31') THEN
    RAISE EXCEPTION 'FAIL T25: a boundary day landed in the wrong year'; END IF;
  DELETE FROM org_fiscal_years WHERE org_id = v_forg AND first_day IN ('2024-01-01', '2028-01-01');

  -- ── T26 · the chain holds: no gap, no overlap, whole months, at most twelve, the newest ends before the first month ──
  BEGIN
    INSERT INTO org_fiscal_years (org_id, name, first_day, last_day) VALUES (v_forg, 'gap', '2029-01-01', '2029-12-31');
    SET CONSTRAINTS org_fiscal_years_chain IMMEDIATE;
    n := -1;
  EXCEPTION WHEN raise_exception THEN n := 0;
  END;
  SET CONSTRAINTS org_fiscal_years_chain DEFERRED;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T26: a year was let in after a gap'; END IF;
  BEGIN
    UPDATE organizations SET fiscal_first_month = 9 WHERE id = v_forg;
    SET CONSTRAINTS organizations_fiscal_first_month_chain IMMEDIATE;
    n := -1;
  EXCEPTION WHEN raise_exception THEN n := 0;
  END;
  SET CONSTRAINTS organizations_fiscal_first_month_chain DEFERRED;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T26: the first month moved under the years by hand'; END IF;
  BEGIN
    INSERT INTO org_fiscal_years (org_id, name, first_day, last_day) VALUES (v_forg, 'mid', '2028-01-15', '2028-12-31');
    n := -1;
  EXCEPTION WHEN check_violation THEN n := 0;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T26: a year began mid-month'; END IF;
  BEGIN
    INSERT INTO org_fiscal_years (org_id, name, first_day, last_day) VALUES (v_forg, 'long', '2028-01-01', '2029-01-31');
    n := -1;
  EXCEPTION WHEN check_violation THEN n := 0;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T26: a year ran longer than twelve months'; END IF;

  -- ── Books for the close: 2025 (+1,000 −200 posted, a 640 cheque still pending), 2026 (+50) ──
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_fgen, '2025-03-01', 'ATOMICITY 2025 in', 1000, 'income', 'posted', v_user) RETURNING id INTO v_fe1;
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_fgen, '2025-11-20', 'ATOMICITY 2025 out', 200, 'expense', 'posted', v_user) RETURNING id INTO v_fe2;
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_fgen, '2025-12-28', 'ATOMICITY the cheque', 640, 'expense', 'pending', v_user) RETURNING id INTO v_fcheque;
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_fgen, '2026-02-01', 'ATOMICITY 2026 in', 50, 'income', 'posted', v_user);
  -- a 2025 plan line, billed; a bill with no line due in 2025
  r := club_budget_line_add(v_forg, '2025-01-01', v_word, 'ATOMICITY 2025 line', 900, NULL, 0, NULL);
  v_fline := (r->>'lineId')::uuid;
  IF v_fline IS NULL THEN RAISE EXCEPTION 'FAIL T27: the 2025 line was refused: %', r; END IF;
  r := club_allocation_create(v_forg, v_user, 'ATOMICITY 2025 bill', v_fline, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_fteam, 'programYearId', v_fs1, 'amount', 600, 'splitValue', 0, 'paymentSchedule', 'custom',
    'installments', jsonb_build_array(
      jsonb_build_object('installmentNumber', 1, 'amount', 200, 'dueDate', '2025-05-01'),
      jsonb_build_object('installmentNumber', 2, 'amount', 200, 'dueDate', '2025-08-01'),
      jsonb_build_object('installmentNumber', 3, 'amount', 200, 'dueDate', '2025-10-01')))));
  v_falloc := (r->>'allocationId')::uuid;
  IF v_falloc IS NULL THEN RAISE EXCEPTION 'FAIL T27: the 2025 bill was refused: %', r; END IF;
  SELECT s.id INTO v_fsplit FROM rep_allocation_splits s WHERE s.allocation_id = v_falloc;
  SELECT id INTO v_fi1 FROM rep_allocation_installments WHERE split_id = v_fsplit AND installment_number = 1;
  SELECT id INTO v_fi2 FROM rep_allocation_installments WHERE split_id = v_fsplit AND installment_number = 2;
  SELECT id INTO v_fi3 FROM rep_allocation_installments WHERE split_id = v_fsplit AND installment_number = 3;

  -- ── T27 · close: refused until the year has ended, oldest first; the closing balance is the books' ──
  r := club_fiscal_year_close(v_forg, '2025-01-01', v_user, '2025-12-31', '{}'::jsonb);
  IF r->>'code' IS DISTINCT FROM 'not_ended' THEN RAISE EXCEPTION 'FAIL T27: a year closed on its own last day: %', r; END IF;
  BEGIN
    r := club_fiscal_year_close(v_forg, '2026-01-01', v_user, '2027-01-02', '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN r := jsonb_build_object('raised', SQLERRM);
  END;
  IF r->>'code' IS DISTINCT FROM 'close_order' OR r->>'firstDay' IS DISTINCT FROM '2025-01-01' THEN
    RAISE EXCEPTION 'FAIL T27: a year closed before the older year that holds money: %', r; END IF;
  r := club_fiscal_year_close(v_forg, '2025-01-01', v_user, '2026-03-01', '{"installments":{"count":3,"amount":600}}'::jsonb);
  IF NOT coalesce((r->>'ok')::boolean, false) OR (r->>'closingBalance')::numeric <> 800 THEN
    RAISE EXCEPTION 'FAIL T27: the close (closing % — posted through Dec 31 is 800): %', r->>'closingBalance', r; END IF;
  IF club_books_closed_through(v_forg) <> '2025-12-31' THEN RAISE EXCEPTION 'FAIL T27: the books are not closed through Dec 31'; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_fiscal_years WHERE org_id = v_forg AND first_day = '2025-01-01'
                  AND closed_by = v_user AND closing_snapshot->'installments'->>'count' = '3') THEN
    RAISE EXCEPTION 'FAIL T27: the close did not keep who closed it and what was still open'; END IF;
  r := club_fiscal_year_close(v_forg, '2025-01-01', v_user, '2026-03-01', '{}'::jsonb);
  IF r->>'code' IS DISTINCT FROM 'already_closed' THEN RAISE EXCEPTION 'FAIL T27: a year closed twice: %', r; END IF;

  -- ── T28 · the lock, on every club-owned book; a team's own book is never locked ──
  BEGIN
    INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
    VALUES (v_fgen, '2025-06-01', 'ATOMICITY backdated', 5, 'expense', 'posted', v_user);
    n := -1;
  EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T28: a line was dated into a closed year (%)', n; END IF;
  BEGIN
    INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
    VALUES (v_ftour, '2025-06-01', 'ATOMICITY tournament backdated', 5, 'income', 'posted', v_user);
    n := -1;
  EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T28: a tournament''s book took a line in a closed year'; END IF;
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_fbook, '2025-06-01', 'ATOMICITY team book', 5, 'expense', 'posted', v_user);
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_fgen, '2026-01-05', 'ATOMICITY open year', 5, 'expense', 'posted', v_user) RETURNING id INTO t;
  BEGIN UPDATE accounting_entries SET amount = 999 WHERE id = v_fe1; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T28: a closed year''s line was changed'; END IF;
  BEGIN UPDATE accounting_entries SET status = 'void', void_reason = 'x' WHERE id = v_fe2; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T28: a closed year''s line was voided'; END IF;
  BEGIN DELETE FROM accounting_entries WHERE id = v_fe2; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T28: a closed year''s line was removed'; END IF;
  BEGIN UPDATE accounting_entries SET entry_date = '2025-12-01' WHERE id = t; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T28: an open year''s line was moved into a closed year'; END IF;
  -- a relabel (a payee or word merge) moves no money, so it reaches a closed year
  INSERT INTO org_payees (org_id, name) VALUES (v_forg, 'ATOMICITY payee') RETURNING id INTO v_p1;
  UPDATE accounting_entries SET payee_id = v_p1, budget_item_id = v_word WHERE id = v_fe1;
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE id = v_fe1 AND payee_id = v_p1) THEN RAISE EXCEPTION 'FAIL T28: a relabel was refused'; END IF;
  -- the cheque from the closed year clears in the open one, and keeps the day it was written
  BEGIN UPDATE accounting_entries SET status = 'posted' WHERE id = v_fcheque; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T28: a closed year''s cheque posted into the closed year'; END IF;
  BEGIN UPDATE accounting_entries SET status = 'posted', entry_date = '2026-01-10', amount = 641 WHERE id = v_fcheque; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T28: a cheque changed its amount on the way out of a closed year'; END IF;
  UPDATE accounting_entries SET status = 'posted', entry_date = '2026-01-10' WHERE id = v_fcheque;
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE id = v_fcheque AND status = 'posted' AND entry_date = '2026-01-10' AND written_on = '2025-12-28') THEN
    RAISE EXCEPTION 'FAIL T28: the cleared cheque lost the day it was written'; END IF;
  IF club_closing_balance(v_forg, '2025-12-31') <> 800 OR (SELECT closing_balance FROM org_fiscal_years WHERE org_id = v_forg AND first_day = '2025-01-01') <> 800 THEN
    RAISE EXCEPTION 'FAIL T28: the closed year''s figure moved'; END IF;

  -- ── T29 · the closed year's plan and bills are locked with it; its installments stay receivable ──
  -- (each step answers a closed year in words: a raw error from the floor beneath it is a failure)
  BEGIN
    r := club_budget_line_save(v_forg, v_fline, 950, NULL, NULL, NULL, NULL);
  EXCEPTION WHEN raise_exception THEN r := jsonb_build_object('raised', SQLERRM);
  END;
  IF r->>'code' IS DISTINCT FROM 'year_closed' THEN RAISE EXCEPTION 'FAIL T29: a closed year''s line saved: %', r; END IF;
  BEGIN
    r := club_budget_line_delete(v_forg, v_fline);
  EXCEPTION WHEN raise_exception THEN r := jsonb_build_object('raised', SQLERRM);
  END;
  IF r->>'code' IS DISTINCT FROM 'year_closed' THEN RAISE EXCEPTION 'FAIL T29: a closed year''s line was removed: %', r; END IF;
  BEGIN
    r := club_budget_line_add(v_forg, '2025-01-01', v_word2, 'ATOMICITY late line', 10, NULL, 0, NULL);
  EXCEPTION WHEN raise_exception THEN r := jsonb_build_object('raised', SQLERRM);
  END;
  IF r->>'code' IS DISTINCT FROM 'year_closed' THEN RAISE EXCEPTION 'FAIL T29: a line was added to a closed year: %', r; END IF;
  BEGIN UPDATE org_budget_lines SET total_amount = 1 WHERE id = v_fline; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T29: a closed year''s line changed under the step'; END IF;
  BEGIN INSERT INTO org_budget_periods (budget_line_id, period_label, period_date, amount) VALUES (v_fline, 'x', '2025-02-01', 1); n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T29: a closed year''s line took a date'; END IF;
  UPDATE org_budget_lines SET item_id = v_word2 WHERE id = v_fline;   -- a word merge relabels; never refused
  BEGIN
    r := club_allocation_create(v_forg, v_user, 'ATOMICITY late bill', v_fline, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_fteam, 'programYearId', v_fs1, 'amount', 50, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2026-05-01')))));
  EXCEPTION WHEN raise_exception THEN r := jsonb_build_object('raised', SQLERRM);
  END;
  IF r->>'code' IS DISTINCT FROM 'year_closed' THEN RAISE EXCEPTION 'FAIL T29: a closed year''s line was billed: %', r; END IF;
  BEGIN
    r := club_allocation_create(v_forg, v_user, 'ATOMICITY off-plan late', NULL, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_fteam, 'programYearId', v_fs1, 'amount', 50, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2025-11-01')))));
  EXCEPTION WHEN raise_exception THEN r := jsonb_build_object('raised', SQLERRM);
  END;
  IF r->>'code' IS DISTINCT FROM 'year_closed' THEN RAISE EXCEPTION 'FAIL T29: a bill was made to fall due in a closed year: %', r; END IF;
  BEGIN UPDATE rep_allocation_splits SET amount = 601 WHERE id = v_fsplit; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T29: a closed year''s bill changed a team''s share'; END IF;
  BEGIN UPDATE rep_allocation_installments SET due_date = '2026-03-01' WHERE id = v_fi3; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T29: a closed year''s bill changed a due date'; END IF;
  BEGIN DELETE FROM rep_allocation_installments WHERE id = v_fi3; n := -1; EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T29: an installment was removed from a closed year''s bill'; END IF;
  UPDATE rep_allocation_splits SET budget_item_id = v_word WHERE id = v_fsplit;   -- the coach's own filing stays the coach's
  r := club_installment_receive(v_fi1, v_forg, v_user, 'unpaid', '2026-02-15', 'cheque', 'Cheque', '7', 'club words', 'team words', 'Team allocations');
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T29: a closed year''s installment could not be received in the open year: %', r; END IF;
  BEGIN
    r := club_installment_receive(v_fi2, v_forg, v_user, 'unpaid', '2025-12-15', 'cheque', 'Cheque', '8', 'club words', 'team words', 'Team allocations');
    n := -1;
  EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T29: a receipt was dated into a closed year'; END IF;

  -- ── T30 · Reopen: the latest closed year only, with a reason kept; the lock lifts; it closes again ──
  r := club_fiscal_year_close(v_forg, '2027-01-01', v_user, '2028-01-05', '{}'::jsonb);
  IF r->>'code' IS DISTINCT FROM 'close_order' OR r->>'firstDay' IS DISTINCT FROM '2026-01-01' THEN
    RAISE EXCEPTION 'FAIL T30: a year closed with an open year between it and the last close: %', r; END IF;
  r := club_fiscal_year_close(v_forg, '2026-01-01', v_user, '2027-01-05', '{}'::jsonb);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T30: 2026 did not close after 2025: %', r; END IF;
  IF (r->>'closingBalance')::numeric <> club_closing_balance(v_forg, '2026-12-31') THEN RAISE EXCEPTION 'FAIL T30: 2026''s closing is not its books'''; END IF;
  BEGIN
    r := club_fiscal_year_reopen(v_forg, '2025-01-01', v_user, 'a bounced cheque');
  EXCEPTION WHEN OTHERS THEN r := jsonb_build_object('raised', SQLERRM);
  END;
  IF r->>'code' IS DISTINCT FROM 'not_latest' OR r->>'firstDay' IS DISTINCT FROM '2026-01-01' THEN RAISE EXCEPTION 'FAIL T30: an older closed year reopened: %', r; END IF;
  BEGIN
    r := club_fiscal_year_reopen(v_forg, '2026-01-01', v_user, '   ');
  EXCEPTION WHEN OTHERS THEN r := jsonb_build_object('raised', SQLERRM);
  END;
  IF r->>'code' IS DISTINCT FROM 'reason_required' THEN RAISE EXCEPTION 'FAIL T30: a reopen without a reason: %', r; END IF;
  v_num := (SELECT closing_balance FROM org_fiscal_years WHERE org_id = v_forg AND first_day = '2026-01-01');
  r := club_fiscal_year_reopen(v_forg, '2026-01-01', v_user, 'A bounced cheque from 10U A');
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T30: reopen: %', r; END IF;
  IF club_books_closed_through(v_forg) <> '2025-12-31' THEN RAISE EXCEPTION 'FAIL T30: the lock did not lift from 2026'; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_fiscal_year_reopenings WHERE org_id = v_forg AND reason = 'A bounced cheque from 10U A'
                  AND was_closing_balance = v_num AND reopened_by = v_user) THEN
    RAISE EXCEPTION 'FAIL T30: the reopen kept no history'; END IF;
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_fgen, '2026-08-30', 'ATOMICITY bounced', 25, 'expense', 'posted', v_user);
  r := club_fiscal_year_close(v_forg, '2026-01-01', v_user, '2027-01-06', '{}'::jsonb);
  IF NOT coalesce((r->>'ok')::boolean, false) OR (r->>'closingBalance')::numeric <> v_num - 25 THEN
    RAISE EXCEPTION 'FAIL T30: the re-close did not lock the corrected books: %', r; END IF;

  -- ── T31 · a closed year's name, months and closing never change; renaming an open one ──
  BEGIN UPDATE org_fiscal_years SET name = 'X' WHERE org_id = v_forg AND first_day = '2025-01-01'; n := -1; EXCEPTION WHEN raise_exception THEN n := 0; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T31: a closed year was renamed by hand'; END IF;
  BEGIN DELETE FROM org_fiscal_years WHERE org_id = v_forg AND first_day = '2025-01-01'; n := -1; EXCEPTION WHEN raise_exception THEN n := 0; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T31: a closed year was removed'; END IF;
  r := club_fiscal_year_rename(v_forg, '2025-01-01', 'Old');
  IF r->>'code' IS DISTINCT FROM 'year_closed' THEN RAISE EXCEPTION 'FAIL T31: a closed year was renamed: %', r; END IF;
  r := club_fiscal_year_rename(v_forg, '2027-01-01', '  Centennial  ');
  IF NOT coalesce((r->>'ok')::boolean, false) OR r->>'name' <> 'Centennial' THEN RAISE EXCEPTION 'FAIL T31: an open year''s rename: %', r; END IF;
  r := club_fiscal_year_rename(v_forg, '2027-01-01', '2026');
  IF r->>'code' IS DISTINCT FROM 'name_taken' THEN RAISE EXCEPTION 'FAIL T31: two years took one name: %', r; END IF;
  BEGIN
    r := club_fiscal_first_month_set(v_forg, 9, '2027-03-01', false);
  EXCEPTION WHEN raise_exception THEN r := jsonb_build_object('raised', SQLERRM);
  END;
  IF r->>'code' IS DISTINCT FROM 'first_close_done' THEN RAISE EXCEPTION 'FAIL T31: the first month changed after a close: %', r; END IF;

  -- ── T32 · the season that carries a club payment (S3C-11, call 1) ──
  -- i1 was received in T29 while 2025 Season ran: 2025 Season carries it.
  IF NOT EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_fi1 AND carried_by_program_year_id = v_fs1) THEN
    RAISE EXCEPTION 'FAIL T32: a payment made while its own season ran is not carried by it'; END IF;
  -- the coach says i2 was SENT while 2025 Season runs; then the season closes and 2026 Season starts
  UPDATE rep_allocation_installments SET sent_at = now(), sent_on = '2025-12-20', sent_by = v_user, sent_method = 'cheque' WHERE id = v_fi2;
  UPDATE rep_program_years SET status = 'completed' WHERE id = v_fs1;
  INSERT INTO rep_program_years (org_id, team_id, name, year, status) VALUES (v_forg, v_fteam, '2026 Season', 2026, 'active') RETURNING id INTO v_fs2;
  -- the club confirms i2 under 2026 Season: it stays with the season that ran when the money LEFT
  r := club_installment_receive(v_fi2, v_forg, v_user, 'sent', '2027-02-20', 'cheque', 'Cheque', '8', 'club words', 'team words', 'Team allocations');
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T32: confirm: %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_fi2 AND carried_by_program_year_id = v_fs1) THEN
    RAISE EXCEPTION 'FAIL T32: a sent payment moved seasons when the club confirmed it'; END IF;
  -- i3, a 2025 Season bill, is sent under 2026 Season with a BACKDATED day: 2026 Season carries it
  UPDATE rep_allocation_installments SET sent_at = now(), sent_on = '2025-09-30', sent_by = v_user WHERE id = v_fi3;
  IF NOT EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_fi3 AND carried_by_program_year_id = v_fs2) THEN
    RAISE EXCEPTION 'FAIL T32: a late payment counted in its CLOSED season (or the typed day chose the season)'; END IF;
  -- taken back: no season carries it
  UPDATE rep_allocation_installments SET sent_at = NULL, sent_on = NULL, sent_by = NULL WHERE id = v_fi3;
  IF EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_fi3 AND carried_by_program_year_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL T32: a taken-back payment is still carried'; END IF;
  -- between seasons: the club records i3 received while the team has NO running season — nothing carries it
  UPDATE rep_program_years SET status = 'completed' WHERE id = v_fs2;
  r := club_installment_receive(v_fi3, v_forg, v_user, 'unpaid', '2027-02-01', 'cheque', 'Cheque', '9', 'club words', 'team words', 'Team allocations');
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T32: a between-seasons receipt: %', r; END IF;
  IF EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_fi3 AND carried_by_program_year_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL T32: a between-seasons payment landed in a closed season'; END IF;
  -- the next season to run carries it (here the closed one, reopened)
  UPDATE rep_program_years SET status = 'active' WHERE id = v_fs2;
  IF NOT EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_fi3 AND carried_by_program_year_id = v_fs2) THEN
    RAISE EXCEPTION 'FAIL T32: the season that started running did not carry the waiting payment'; END IF;
  -- an undo hands the money back to the team: no season carries it
  r := club_installment_undo(v_fi3, v_forg, v_user, 'bounced');
  IF EXISTS (SELECT 1 FROM rep_allocation_installments WHERE id = v_fi3 AND carried_by_program_year_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL T32: an undone payment is still carried'; END IF;

  -- ── T33 · only an OPEN season is billed (S3C-09) ──
  r := club_allocation_create(v_forg, v_user, 'ATOMICITY closed season', NULL, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_fteam, 'programYearId', v_fs1, 'amount', 50, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2027-11-01')))));
  IF r->>'code' IS DISTINCT FROM 'season_closed' OR (r->>'teamId')::uuid IS DISTINCT FROM v_fteam THEN
    RAISE EXCEPTION 'FAIL T33: a closed season was billed: %', r; END IF;
  r := club_allocation_create(v_forg, v_user, 'ATOMICITY open season', NULL, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_fteam, 'programYearId', v_fs2, 'amount', 50, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2027-11-01')))));
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T33: an open season''s bill was refused: %', r; END IF;

  -- ── T34 · the first-month change: the year that has begun keeps its months, the NEXT is the short one ──
  INSERT INTO organizations (name, slug) VALUES ('ATOMICITY moving club', 'atomicity-moving-' || substr(md5(random()::text), 1, 10)) RETURNING id INTO v_gorg;
  INSERT INTO rep_teams (org_id, name, slug) VALUES (v_gorg, 'ATOMICITY 11U', 'atomicity-11u-' || substr(md5(random()::text), 1, 8)) RETURNING id INTO v_gteam;
  INSERT INTO rep_program_years (org_id, team_id, name, year, status) VALUES (v_gorg, v_gteam, '2026 Season', 2026, 'active') RETURNING id INTO v_gpy;
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (club_general_ledger(v_gorg), '2027-10-05', 'ATOMICITY a dated line', 70, 'expense', 'posted', v_user);
  r := club_budget_line_add(v_gorg, '2026-01-01', v_word, 'A 2026', 100, NULL, 0, '[{"label":"Apr","date":"2026-04-01","amount":100}]'::jsonb); v_gA := (r->>'lineId')::uuid;
  r := club_budget_line_add(v_gorg, '2027-01-01', v_word, 'B crosses', 300, NULL, 0,
    '[{"label":"Mar","date":"2027-03-01","amount":100},{"label":"Oct","date":"2027-10-01","amount":200}]'::jsonb); v_gB := (r->>'lineId')::uuid;
  r := club_budget_line_add(v_gorg, '2027-01-01', v_word2, 'C undated', 300, NULL, 0, NULL); v_gC := (r->>'lineId')::uuid;
  r := club_budget_line_add(v_gorg, '2027-01-01', v_inword, 'D moves whole', 50, NULL, 0, '[{"label":"Nov","date":"2027-11-01","amount":50}]'::jsonb); v_gD := (r->>'lineId')::uuid;
  r := club_budget_line_add(v_gorg, '2028-01-01', v_word, 'E next-next', 40, NULL, 0, '[{"label":"Feb","date":"2028-02-01","amount":40}]'::jsonb); v_gE := (r->>'lineId')::uuid;
  IF v_gA IS NULL OR v_gB IS NULL OR v_gC IS NULL OR v_gD IS NULL OR v_gE IS NULL THEN RAISE EXCEPTION 'FAIL T34: the plan for the move was refused'; END IF;
  -- a bill on B above the part that stays (100 in March) refuses the change, and nothing moves
  r := club_allocation_create(v_gorg, v_user, 'ATOMICITY on B', v_gB, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_gteam, 'programYearId', v_gpy, 'amount', 150, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 150, 'dueDate', '2027-05-01')))));
  v_galloc := (r->>'allocationId')::uuid;
  r := club_fiscal_first_month_set(v_gorg, 9, '2026-10-07', false);
  IF r->>'code' IS DISTINCT FROM 'split_below_allocated' OR (r->>'staying')::numeric <> 100 THEN
    RAISE EXCEPTION 'FAIL T34: a split left a line below what it bills: %', r; END IF;
  IF (SELECT fiscal_first_month FROM organizations WHERE id = v_gorg) <> 1 OR NOT EXISTS (SELECT 1 FROM org_budget_lines WHERE id = v_gB AND total_amount = 300) THEN
    RAISE EXCEPTION 'FAIL T34: a refused change left part of itself behind'; END IF;
  DELETE FROM rep_cost_allocations WHERE id = v_galloc;
  -- the preview answers the same counts and writes nothing
  r := club_fiscal_first_month_set(v_gorg, 9, '2026-10-07', true);
  IF NOT coalesce((r->>'ok')::boolean, false) OR r->>'mode' <> 'short_next' OR (r->>'split')::int <> 1 OR (r->>'moved')::int <> 2
     OR r->'next'->>'lastDay' <> '2027-08-31' OR r->>'thenFrom' <> '2027-09-01' THEN
    RAISE EXCEPTION 'FAIL T34: the preview: %', r; END IF;
  IF (SELECT fiscal_first_month FROM organizations WHERE id = v_gorg) <> 1
     OR NOT EXISTS (SELECT 1 FROM org_fiscal_years WHERE org_id = v_gorg AND first_day = '2027-01-01' AND last_day = '2027-12-31') THEN
    RAISE EXCEPTION 'FAIL T34: the preview wrote'; END IF;
  r := club_fiscal_first_month_set(v_gorg, 9, '2026-10-07', false);
  IF NOT coalesce((r->>'ok')::boolean, false) OR (r->>'split')::int <> 1 OR (r->>'moved')::int <> 2 THEN RAISE EXCEPTION 'FAIL T34: the change: %', r; END IF;
  SET CONSTRAINTS org_fiscal_years_chain, organizations_fiscal_first_month_chain IMMEDIATE;
  SET CONSTRAINTS org_fiscal_years_chain, organizations_fiscal_first_month_chain DEFERRED;
  IF (SELECT string_agg(name || ':' || first_day || '..' || last_day, ' ' ORDER BY first_day) FROM org_fiscal_years WHERE org_id = v_gorg)
     <> '2026:2026-01-01..2026-12-31 2027:2027-01-01..2027-08-31 2027–28:2027-09-01..2028-08-31' THEN
    RAISE EXCEPTION 'FAIL T34: the years after the change: %', (SELECT string_agg(name || ':' || first_day || '..' || last_day, ' ' ORDER BY first_day) FROM org_fiscal_years WHERE org_id = v_gorg); END IF;
  SELECT * INTO v_row FROM org_fiscal_years WHERE org_id = v_gorg AND first_day = '2027-09-01';
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines l JOIN org_fiscal_years y ON y.id = l.fiscal_year_id WHERE l.id = v_gA AND y.first_day = '2026-01-01') THEN
    RAISE EXCEPTION 'FAIL T34: a line on the year that had begun moved'; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines WHERE id = v_gB AND total_amount = 100 AND fiscal_year_id = (SELECT id FROM org_fiscal_years WHERE org_id = v_gorg AND first_day = '2027-01-01')) THEN
    RAISE EXCEPTION 'FAIL T34: the crossing line did not keep its short-year part'; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines WHERE id = v_gC AND fiscal_year_id = (SELECT id FROM org_fiscal_years WHERE org_id = v_gorg AND first_day = '2027-01-01')) THEN
    RAISE EXCEPTION 'FAIL T34: an undated line left its year'; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_budget_lines WHERE id = v_gD AND fiscal_year_id = v_row.id) THEN
    RAISE EXCEPTION 'FAIL T34: a line dated past the short year''s end did not move to the next plan'; END IF;
  -- B's October part and E (same word) are one line on 2027–28: one word, one line
  SELECT count(*), sum(total_amount) INTO n, v_num FROM org_budget_lines WHERE fiscal_year_id = v_row.id AND item_id = v_word;
  IF n <> 1 OR v_num <> 240 THEN RAISE EXCEPTION 'FAIL T34: one word made % line(s) worth % on the next plan', n, v_num; END IF;
  SELECT sum(amount) INTO v_num FROM org_budget_periods p JOIN org_budget_lines l ON l.id = p.budget_line_id WHERE l.org_id = v_gorg;
  IF v_num <> 490 THEN RAISE EXCEPTION 'FAIL T34: the plan''s dated money changed in the move (% of 490)', v_num; END IF;
  IF NOT EXISTS (SELECT 1 FROM accounting_entries e JOIN accounting_ledgers l ON l.id = e.ledger_id WHERE l.org_id = v_gorg AND e.entry_date = '2027-10-05' AND e.amount = 70) THEN
    RAISE EXCEPTION 'FAIL T34: a ledger line moved'; END IF;
  -- a club that holds nothing just starts on its month: no short year
  INSERT INTO organizations (name, slug) VALUES ('ATOMICITY new club', 'atomicity-new-' || substr(md5(random()::text), 1, 10)) RETURNING id INTO t;
  r := club_fiscal_first_month_set(t, 9, '2026-10-07', false);
  IF r->>'mode' IS DISTINCT FROM 'fresh' OR r->'current'->>'name' <> '2026–27' OR r->'current'->>'firstDay' <> '2026-09-01' THEN
    RAISE EXCEPTION 'FAIL T34: a club with nothing did not just start on its month: %', r; END IF;

  -- ── T36 · the lock's gaps closed by the high-risk review (2026-10-07) ──
  -- (a) a year's close is its own step's to write: never set or cleared by hand, even by the service role
  BEGIN UPDATE org_fiscal_years SET closed_at = NULL, closing_balance = NULL WHERE org_id = v_forg AND first_day = '2026-01-01'; n := -1;
  EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T36: a closed year was reopened by hand (%)', n; END IF;
  BEGIN UPDATE org_fiscal_years SET closed_by = NULL WHERE org_id = v_forg AND first_day = '2026-01-01'; n := -1;
  EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T36: who closed a year was changed by hand (%)', n; END IF;
  BEGIN UPDATE org_fiscal_years SET closed_at = now(), closing_balance = 0 WHERE org_id = v_forg AND first_day = '2027-01-01'; n := -1;
  EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T36: an open year was closed by hand (%)', n; END IF;
  -- (b) a bill drawn from an OPEN year's line, its payment due in the closed stretch, can't be unlinked into it
  r := club_budget_line_add(v_forg, '2027-01-01', v_word, 'ATOMICITY open line', 500, NULL, 0, NULL);
  v_hline := (r->>'lineId')::uuid;
  IF v_hline IS NULL THEN RAISE EXCEPTION 'FAIL T36: an open year''s line: %', r; END IF;
  r := club_allocation_create(v_forg, v_user, 'ATOMICITY unlink me', v_hline, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_fteam, 'programYearId', v_fs2, 'amount', 40, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 40, 'dueDate', '2026-06-01')))));
  v_halloc := (r->>'allocationId')::uuid;
  IF v_halloc IS NULL THEN RAISE EXCEPTION 'FAIL T36: a bill on an open year''s line: %', r; END IF;
  BEGIN UPDATE rep_cost_allocations SET source_budget_line_id = NULL WHERE id = v_halloc; n := -1;
  EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T36: a bill was unlinked into a closed year (%)', n; END IF;
  -- (c) a club book holding a closed year's lines is never retyped out of the club's books
  BEGIN UPDATE accounting_ledgers SET entity_type = 'team' WHERE id = v_fgen; n := -1;
  EXCEPTION WHEN raise_exception THEN n := CASE WHEN SQLERRM LIKE 'year_closed%' THEN 0 ELSE -2 END; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T36: a book holding closed lines left the club''s books (%)', n; END IF;
  -- (d) a closed line's partner link is a label: its partner gone moves no money on it
  SELECT id INTO v_hentry FROM accounting_entries WHERE ledger_id = v_fgen AND linked_entry_id IS NOT NULL
     AND entry_date <= club_books_closed_through(v_forg) LIMIT 1;
  IF v_hentry IS NULL THEN RAISE EXCEPTION 'FAIL T36: no closed line with a partner to test'; END IF;
  BEGIN UPDATE accounting_entries SET linked_entry_id = NULL WHERE id = v_hentry; n := 0;
  EXCEPTION WHEN raise_exception THEN n := -1; END;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL T36: a closed line''s partner link could not be cleared (its partner removed)'; END IF;
  -- (e) a team's older season still marked open is not its RUNNING season: never billed
  -- (one transaction stamps every row with one now(): the new season is made later, as it would be)
  INSERT INTO rep_program_years (org_id, team_id, name, year, status, created_at) VALUES (v_forg, v_fteam, '2027 Season', 2027, 'draft', now() + interval '1 minute') RETURNING id INTO v_fs3;
  r := club_allocation_create(v_forg, v_user, 'ATOMICITY older season', NULL, 'fixed', jsonb_build_array(jsonb_build_object(
    'teamId', v_fteam, 'programYearId', v_fs2, 'amount', 50, 'splitValue', 0, 'paymentSchedule', 'standard',
    'installments', jsonb_build_array(jsonb_build_object('installmentNumber', 1, 'amount', 50, 'dueDate', '2027-11-01')))));
  IF r->>'code' IS DISTINCT FROM 'season_closed' THEN RAISE EXCEPTION 'FAIL T36: an older open season was billed: %', r; END IF;
  -- (f) the first month is fixed after the first close — a close since reopened included
  INSERT INTO organizations (name, slug) VALUES ('ATOMICITY reopened club', 'atomicity-reopened-' || substr(md5(random()::text), 1, 10)) RETURNING id INTO v_horg;
  v_hgen := club_general_ledger(v_horg);
  INSERT INTO accounting_entries (ledger_id, entry_date, description, amount, entry_type, status, created_by)
  VALUES (v_hgen, '2025-03-01', 'ATOMICITY once', 10, 'expense', 'posted', v_user) RETURNING id INTO v_hline2;
  r := club_fiscal_year_close(v_horg, '2025-01-01', v_user, '2026-02-01', '{}'::jsonb);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T36: close: %', r; END IF;
  r := club_fiscal_year_reopen(v_horg, '2025-01-01', v_user, 'entered by mistake');
  IF NOT coalesce((r->>'ok')::boolean, false) THEN RAISE EXCEPTION 'FAIL T36: reopen: %', r; END IF;
  DELETE FROM accounting_entries WHERE id = v_hline2;
  r := club_fiscal_first_month_set(v_horg, 9, '2026-02-01', false);
  IF r->>'code' IS DISTINCT FROM 'first_close_done' THEN RAISE EXCEPTION 'FAIL T36: the first month changed after a close that was reopened: %', r; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_fiscal_year_reopenings WHERE org_id = v_horg) THEN RAISE EXCEPTION 'FAIL T36: a reopen''s history was lost'; END IF;

  -- ── T35 · the fiscal lock never stops a club (or a book) from being removed ──
  DELETE FROM organizations WHERE id = v_forg;
  IF EXISTS (SELECT 1 FROM org_fiscal_years WHERE org_id = v_forg) THEN RAISE EXCEPTION 'FAIL T35: a removed club left its years'; END IF;

  RAISE EXCEPTION 'CLUB_MONEY_ATOMICITY_PASSED';
END
$test$;
