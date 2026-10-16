/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY CLUB MONEY MOVE IS ONE STEP — PROVED ON THE DATABASE (Club Tier Stage 3a,
 * `check:club-money-atomicity`).
 *
 * Runs scripts/club-money-atomicity.sql against the DEV database: every move of mig 315 for real —
 * a double submit leaves ONE pair of lines; a step that fails part-way leaves NONE; undo, reverse and
 * a transfer void take both halves with the reason; a team's book and a line from a source are
 * refused; the General ledger is made once; payees merge in one step. Since mig 316 (Ledger Parity) it
 * also proves the payee sharing rule and a team's own merge (`team_payee_merge`). Since mig 317 (Club
 * Tier Stage 3b) it proves the Budget's steps — an allocation from a line, a line's save (its money, word
 * and words) and its delete, a year's roll, the book totals — and the one-word join. Since mig 318 (Club Tier
 * Stage 3c) it proves the fiscal year on clubs it makes and throws away: the year a day falls in and the
 * name rule, the chain's invariants, Close (refused until the year ends, oldest first, the closing the books'),
 * THE LOCK on every club-owned book and every writer (the cleared cheque and a relabel its only exceptions;
 * a team's own book never locked), the plan and the bills locked with their year, Reopen (latest only, a
 * reason kept), the first-month change and its preview (the next year short, lines placed by their dates,
 * ledger lines unmoved), only an open season billed, the season that carries a club payment (S3C-11), and a
 * club's removal never blocked by its closed years. Since mig 328 (Club Tier Stage 11d) it proves a hand-back's ask for
 * money back on a schedule club it makes: the ask (nothing handed back yet), a Sunday asked twice and an ask above the
 * room refused, the request it carries closed to every hand, Accept (a started Sunday drops out; the credit latest
 * first, a SENT payment never credited; the rest an accepted request Record paying settles), Decline, Withdraw, the
 * daily sweep, a received payment writing what is DUE, and Send the changes crediting a lost Sunday in its own step.
 * Since migs 330–331 (Stage 11d part C) it proves a hand-back the coach can change: every practice kept, Take it back
 * (only what can come back, as it was), the late ask over a landed hand-back (one at a time, Accept moving money only and
 * opening nothing), and the daily sweep leaving a late ask alone.
 * The block always ends in an exception, so nothing it writes survives (its success word is the exception).
 *
 * `--mutate` then runs it again once per MUTATION — each removes one refusal from a copy of a
 * function, inside the same rolled-back block — and passes only if every mutation is CAUGHT. A test
 * that cannot fail proves nothing; this is how it shows it can.
 *
 * ⚠ DEV ONLY, and NOT in `verify:changed`: it needs the network and the dev database (like
 * `check:register`). Run it after any change to mig 315's, 316's or 317's functions, and in /release before
 * any of them is applied to prod. It never touches prod (`db-query.mjs` refuses a write there anyway).
 *
 * Usage:  npm run check:club-money-atomicity            the real run
 *         npm run check:club-money-atomicity -- --mutate  the real run, then every mutation
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST = readFileSync(path.join(ROOT, 'scripts/club-money-atomicity.sql'), 'utf8');
// Newest first: a function a later migration REPLACES is mutated in its live shape (mig 316 replaces 315's
// club_payee_merge, and mig 325 replaces 316's), never the superseded one.
const MIGS = [
  'supabase/migrations/331_the_daily_sweep_leaves_a_late_ask.sql',
  'supabase/migrations/330_a_hand_back_the_coach_can_change.sql',
  'supabase/migrations/328_a_hand_back_may_ask_for_money_back.sql',
  'supabase/migrations/325_a_payee_merge_carries_its_permits.sql',
  'supabase/migrations/318_the_club_keeps_a_fiscal_year.sql',
  'supabase/migrations/317_the_club_plan_meets_its_books.sql',
  'supabase/migrations/316_a_club_shares_payees_with_its_teams.sql',
  'supabase/migrations/315_a_club_money_move_is_one_step.sql',
].map(f => readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'));
const PASSED = 'CLUB_MONEY_ATOMICITY_PASSED';

// Case-blind: 315–318 write their steps in capitals, 328's own steps are lowercase (the four it replaces keep 315's and
// 317's casing, so the mutations below read them unchanged).
function fn(name) {
  const head = `create or replace function public.${name}(`;
  const mig = MIGS.find(m => m.toLowerCase().includes(head));
  if (!mig) throw new Error(`${name} is not in migs 315–318, 325, 328, 330 or 331`);
  const lower = mig.toLowerCase();
  const start = lower.indexOf(head);
  return mig.slice(start, mig.indexOf('$$;', lower.indexOf('as $$', start) + 5) + 3);
}

/* Mig 317's one-word-one-line JOIN is a DO block, not a function: T23 runs the migration's OWN block on real
   twins (it is lifted from the file, never copied), and a '@join' mutation edits that block. */
const JOIN = (() => {
  const mig = MIGS.find(m => m.startsWith('-- Migration 317')) ?? '';
  const start = mig.indexOf('DO $$\nDECLARE\n  g            record;');
  if (start < 0) throw new Error('mig 317\'s join block is gone — T23 reads it');
  return mig.slice(start, mig.indexOf('END $$;', start) + 'END $$'.length);
})();
const withJoin = (sql, join = JOIN) => sql.replace('{{JOIN}}', () => `EXECUTE $join$${join}$join$;`);

/** Each mutation removes ONE refusal; the test must catch every one. */
const MUTATIONS = [
  ['receive: the received guard', 'club_installment_receive',
    /IF v_inst\.paid_at IS NOT NULL THEN\n\s+RETURN jsonb_build_object\('ok', false, 'code', 'state_changed', 'state', 'received'\);\n\s+END IF;/, ''],
  ['receive: the sent guard on "record received"', 'club_installment_receive',
    /IF p_expect = 'unpaid' AND v_inst\.sent_at IS NOT NULL THEN\n\s+RETURN[^\n]*\n\s+END IF;/, ''],
  ['receive: one step (the stamp swallows its own failure)', 'club_installment_receive',
    /UPDATE rep_allocation_installments\n([\s\S]*?)WHERE id = p_installment;/,
    'BEGIN UPDATE rep_allocation_installments\n$1WHERE id = p_installment; EXCEPTION WHEN OTHERS THEN NULL; END;'],
  ['undo: both halves (the partner is left posted)', 'club_installment_undo',
    /v_ids := club_void_entry_pair\(v_inst\.accounting_entry_id, p_reason, p_actor\);/,
    "UPDATE accounting_entries SET status = 'void', void_reason = p_reason, voided_by = p_actor WHERE id = v_inst.accounting_entry_id;"],
  ['undo: the unlinked refusal', 'club_installment_undo',
    /IF v_inst\.accounting_entry_id IS NULL THEN\n\s+RETURN jsonb_build_object\('ok', false, 'code', 'unlinked'\);\n\s+END IF;/, ''],
  ['approve: the still-waiting guard', 'club_request_approve',
    /IF v_req\.status NOT IN \('pending', 'accepted'\) THEN\n\s+RETURN[^\n]*\n\s+END IF;/, ''],
  ['reverse: the approved-only guard', 'club_request_reverse',
    /IF v_req\.status <> 'approved' THEN\n\s+RETURN[^\n]*\n\s+END IF;/, ''],
  ['transfer void: the team-book refusal', 'club_transfer_void',
    /IF v_bad > 0 THEN RETURN jsonb_build_object\('ok', false, 'code', 'team_book'\); END IF;/, ''],
  ['transfer void: the from-a-source refusal', 'club_transfer_void',
    /IF v_e\.source_module IS NOT NULL[\s\S]*?'code', 'from_a_source'\);\n\s+END IF;/, ''],
  ['reminders: the just-sent refusal (a double submit emails twice)', 'club_reminder_wave_claim',
    /IF v_last IS NOT NULL AND v_last > now\(\) - interval '60 seconds' THEN\n\s+RETURN jsonb_build_object\('ok', false, 'code', 'just_sent'\);\n\s+END IF;/, ''],
  ['reminders: the single-team claim reads only its own team\'s waves', 'club_reminder_wave_claim',
    /\(p_team IS NULL OR p_team = ANY \(team_ids\)\)/, '(p_team IS NULL)'],
  // Ledger Parity (mig 316): sharing and a team's own merge.
  ['team merge: the own-payee check (a club payee read as the team\'s own)', 'team_payee_merge',
    /IF NOT v_from_own THEN\n[\s\S]*?RETURN jsonb_build_object\('ok', false, 'code', 'not_found'\);\n\s+END IF;\n/, ''],
  ['team merge: into is the team\'s own or a SHARED club payee', 'team_payee_merge',
    /IF NOT v_into_own AND NOT coalesce\([\s\S]*?END IF;\n/, ''],
  ['team merge: a record outside the team refuses it', 'team_payee_merge',
    /IF EXISTS \(SELECT 1 FROM rep_team_expenses WHERE payee_id = p_from[\s\S]*?'named_elsewhere'\);\n\s+END IF;/, ''],
  ['club merge: the payee kept takes the sharing it absorbs', 'club_payee_merge',
    /IF v_from\.shared_with_teams OR v_into\.shared_with_teams THEN\n[\s\S]*?END IF;\n/, ''],
  ['club merge: the LATER stamp, never the earlier', 'club_payee_merge',
    /GREATEST\(v_from\.shared_at, v_into\.shared_at\)/, 'LEAST(v_from.shared_at, v_into.shared_at)'],
  // Mig 325: a permit's issuer follows the merge (before it, the delete's SET NULL dropped the link).
  ['club merge: a permit naming the payee follows it to the one kept', 'club_payee_merge',
    /UPDATE org_permits SET issuer_payee_id = p_into, issuer_name = v_into\.name\n\s+WHERE issuer_payee_id = p_from AND org_id = p_org;/,
    ''],
  // Club Tier Stage 3b (mig 317): the Budget's steps.
  ['allocation: refused above what is left on the line', 'club_allocation_create',
    /IF v_shares > v_line\.total_amount - v_allocated \+ 0\.005 THEN\n[\s\S]*?END IF;\n/, ''],
  ['allocation: a money-in line bills nobody', 'club_allocation_create',
    /IF v_direction = 'in' THEN RETURN jsonb_build_object\('ok', false, 'code', 'not_a_cost_line'\); END IF;/, ''],
  ['allocation: only this club\'s teams and seasons', 'club_allocation_create',
    /WHERE y\.id = v_year AND t\.id = v_team AND t\.org_id = p_org;/, 'WHERE y.id = v_year;'],
  ['allocation: only this club\'s line', 'club_allocation_create',
    /WHERE id = p_source_line AND org_id = p_org/, 'WHERE id = p_source_line'],
  ['line save: a changed total below what is allocated', 'club_budget_line_save',
    /IF v_total < v_allocated - 0\.005 THEN\n[\s\S]*?END IF;\n/, ''],
  ['line save: an UNCHANGED total is never refused', 'club_budget_line_save',
    /p_total IS NOT NULL AND v_total <> v_line\.total_amount/, 'p_total IS NOT NULL'],
  ['line save: the dates must add up to the total', 'club_budget_line_save',
    /IF v_count > 0 AND abs\(v_sum - v_total\) > 0\.02 THEN\n[\s\S]*?END IF;\n/, ''],
  ['dates: an amount above zero', 'club_budget_periods_refusal',
    /IF EXISTS \(SELECT 1 FROM jsonb_array_elements\(p_periods\) p\n\s+WHERE coalesce\(\(p->>'amount'\)::numeric, 0\) <= 0\) THEN\n[\s\S]*?END IF;\n/, ''],
  ['line save: a save from a stale read', 'club_budget_line_save',
    /IF p_expect IS NOT NULL AND v_line\.updated_at <> p_expect THEN\n[\s\S]*?END IF;\n/, ''],
  ['dates: the set adds up to the total', 'club_budget_periods_refusal',
    /IF v_count > 0 AND abs\(v_sum - p_total\) > 0\.02 THEN\n[\s\S]*?END IF;\n/, ''],
  ['line save: kept dates are re-checked only against a CHANGED total', 'club_budget_line_save',
    /ELSIF p_total IS NOT NULL AND v_total <> v_line\.total_amount THEN/, 'ELSE'],
  ['add: the dates come in the same step', 'club_budget_line_add',
    /  IF p_periods IS NOT NULL THEN\n    INSERT INTO org_budget_periods[\s\S]*?END IF;\n/, ''],
  ['add: dates that don\'t add up make nothing', 'club_budget_line_add',
    /  IF p_periods IS NOT NULL THEN\n    v_refusal := club_budget_periods_refusal\(p_periods, v_total\);\n    IF v_refusal IS NOT NULL THEN RETURN v_refusal; END IF;\n  END IF;\n/, ''],
  ['add: the category is the word\'s', 'club_budget_line_add',
    /VALUES \(v_line, p_org, v_year\.id, v_category,/, 'VALUES (v_line, p_org, v_year.id, NULL,'],
  ['line save: the word brings its OWN category', 'club_budget_line_save',
    /category_id  = coalesce\(v_category, category_id\)/, 'category_id  = category_id'],
  ['line save: a billed line stays a cost', 'club_budget_line_save',
    /IF v_direction = 'in' AND EXISTS \(SELECT 1 FROM rep_cost_allocations WHERE source_budget_line_id = p_line\) THEN\n[\s\S]*?END IF;\n/, ''],
  ['line save: a blank description is refused', 'club_budget_line_save',
    /IF v_fields \? 'description' AND [\s\S]*?END IF;\n/, ''],
  ['line save: a refused word leaves nothing behind (the words wait for every check)', 'club_budget_line_save',
    /(  IF p_item IS NOT NULL AND p_item IS DISTINCT FROM v_line\.item_id THEN\n)/,
    "  UPDATE org_budget_lines SET description = coalesce(v_fields->>'description', description) WHERE id = p_line;\n$1"],
  ['delete: refused while an allocation is drawn from the line', 'club_budget_line_delete',
    /IF EXISTS \(SELECT 1 FROM rep_cost_allocations WHERE source_budget_line_id = p_line\) THEN\n[\s\S]*?END IF;\n/, ''],
  ['delete: only this club\'s line', 'club_budget_line_delete',
    /WHERE id = p_line AND org_id = p_org FOR UPDATE/, 'WHERE id = p_line FOR UPDATE'],
  ['roll: never into a year that has a plan', 'club_budget_roll_year',
    /IF EXISTS \(SELECT 1 FROM org_budget_lines WHERE fiscal_year_id = v_to\.id\) THEN\n[\s\S]*?END IF;\n/, ''],
  ['roll: a moved month\'s label is written from its moved date', 'club_budget_roll_year',
    /CASE WHEN period_date IS NOT NULL AND period_label = [\s\S]*?ELSE period_label END,/, 'period_label,'],
  ['book totals: only posted moves a balance', 'club_book_totals',
    /FILTER \(WHERE e\.status = 'posted'\), 0\)\n\s+FROM unnest/, "FILTER (WHERE e.status <> 'void'), 0)\n    FROM unnest"],
  ['join: the allocations are re-pointed before the twins go', '@join',
    /UPDATE rep_cost_allocations SET source_budget_line_id = keeper WHERE source_budget_line_id = ANY \(losers\);\n/, ''],
  ['join: the requests are re-pointed before the twins go', '@join',
    /UPDATE rep_team_payment_requests SET budget_line_id = keeper WHERE budget_line_id = ANY \(losers\);\n/, ''],
  ['join: the EARLIEST line survives', '@join',
    /keeper := ids\[1\];\n    losers := ids\[2:\];/, 'keeper := ids[array_length(ids, 1)];\n    losers := ids[1:array_length(ids, 1) - 1];'],
  ['join: an undated remainder becomes a real period', '@join',
    /IF scheduled > 0 AND \(merged_total - scheduled\) > 0\.02 THEN\n[\s\S]*?END IF;\n/, ''],
  // Club Tier Stage 3c (mig 318): the fiscal year, its close, its lock, the carrying season.
  ['year: every year between a day and the rows is made', 'club_fiscal_year_ensure',
    /EXIT WHEN p_day <= v_last OR v_steps > 220;/, 'EXIT;'],
  ['chain: no gap between two years', 'club_fiscal_years_chain_check',
    /IF v_prev_last IS NOT NULL AND r\.first_day <> v_prev_last \+ 1 THEN\n[\s\S]*?END IF;\n/, ''],
  ['chain: the newest year ends before the club\'s first month', 'club_fiscal_years_chain_check',
    /IF v_prev_last IS NOT NULL AND extract\(month FROM v_prev_last \+ 1\)::int <> v_month THEN\n[\s\S]*?END IF;\n/, ''],
  ['close: refused until the year has ended', 'club_fiscal_year_close',
    /IF p_today <= v_year\.last_day THEN\n[\s\S]*?END IF;\n/, ''],
  ['close: oldest first, after a close', 'club_fiscal_year_close',
    /IF v_year\.first_day <> v_through \+ 1 THEN\n[\s\S]*?END IF;\n  ELSE/, 'NULL;\n  ELSE'],
  ['close: oldest first, before the first close', 'club_fiscal_year_close',
    /IF v_held IS NOT NULL AND v_held < v_year\.first_day THEN\n[\s\S]*?END IF;\n/, ''],
  ['close: the closing is posted lines THROUGH the last day', 'club_closing_balance',
    /NULL, p_last\) t;/, 'NULL, NULL) t;'],
  ['reopen: the latest closed year only', 'club_fiscal_year_reopen',
    /IF v_latest\.id <> v_year\.id THEN\n[\s\S]*?END IF;\n/, ''],
  ['reopen: a reason is required', 'club_fiscal_year_reopen',
    /IF v_reason = '' THEN RETURN jsonb_build_object\('ok', false, 'code', 'reason_required'\); END IF;/, ''],
  ['lock: nothing is dated INTO a closed year', 'accounting_entries_fiscal_lock',
    /v_new_locked := v_through IS NOT NULL AND NEW\.entry_date <= v_through;/, 'v_new_locked := false;'],
  ['lock: a closed year\'s line is never removed', 'accounting_entries_fiscal_lock',
    /IF v_old_locked AND EXISTS \(SELECT 1 FROM organizations WHERE id = v_old_org\) THEN\n[\s\S]*?END IF;\n/, ''],
  ['lock: a cleared cheque leaves the closed year', 'accounting_entries_fiscal_lock',
    /IF OLD\.status = 'pending' AND NEW\.status = 'posted' AND v_old_locked AND NOT v_new_locked/, "IF OLD.status = 'pending' AND NEW.status = 'posted' AND v_old_locked"],
  ['lock: a cleared cheque changes nothing else', 'accounting_entries_fiscal_lock',
    /\n\s+AND \(to_jsonb\(NEW\) - \(c_labels \|\| ARRAY\['status', 'entry_date', 'written_on'\]\)\)\n\s+= \(to_jsonb\(OLD\) - \(c_labels \|\| ARRAY\['status', 'entry_date', 'written_on'\]\)\) THEN/, ' THEN'],
  ['lock: a cleared cheque keeps the day it was written', 'accounting_entries_fiscal_lock',
    /NEW\.written_on := coalesce\(OLD\.written_on, OLD\.entry_date\);/, ''],
  ['lock: a closed year\'s plan line', 'org_budget_lines_fiscal_lock',
    /IF \(club_fiscal_year_locked\(OLD\.fiscal_year_id\) OR club_fiscal_year_locked\(NEW\.fiscal_year_id\)\)[\s\S]*?END IF;\n  RETURN NEW;/, 'RETURN NEW;'],
  ['lock: a closed year\'s plan dates', 'org_budget_periods_fiscal_lock',
    /\n  IF v_year IS NOT NULL AND club_fiscal_year_locked\(v_year\) THEN\n[\s\S]*?END IF;\n  RETURN NEW;/, '\n  RETURN NEW;'],
  ['lock: a team\'s share of a closed year\'s bill', 'rep_allocation_splits_fiscal_lock',
    /IF club_allocation_locked\(NEW\.allocation_id\)\n[\s\S]*?END IF;\n  RETURN NEW;/, 'RETURN NEW;'],
  ['lock: a closed year\'s bill keeps its due dates', 'rep_allocation_installments_fiscal_lock',
    /IF v_alloc IS NOT NULL AND club_allocation_locked\(v_alloc\)\n[\s\S]*?END IF;\n  END IF;\n  IF TG_OP = 'DELETE'/, "END IF;\n  IF TG_OP = 'DELETE'"],
  ['line save: a closed year answers in words', 'club_budget_line_save',
    /IF club_fiscal_year_locked\(v_line\.fiscal_year_id\) THEN RETURN jsonb_build_object\('ok', false, 'code', 'year_closed'\); END IF;/, ''],
  ['line add: a closed year answers in words', 'club_budget_line_add',
    /IF club_fiscal_year_locked\(v_year\.id\) THEN RETURN jsonb_build_object\('ok', false, 'code', 'year_closed'\); END IF;/, ''],
  ['allocation: a closed year\'s line answers in words', 'club_allocation_create',
    /IF club_fiscal_year_locked\(v_line\.fiscal_year_id\) THEN RETURN jsonb_build_object\('ok', false, 'code', 'year_closed'\); END IF;/, ''],
  ['allocation: a bill with no line can\'t fall due in a closed year', 'club_allocation_create',
    /IF v_through IS NOT NULL AND v_first_due <= v_through THEN\n[\s\S]*?END IF;\n/, ''],
  ['allocation: only an open season is billed', 'club_allocation_create',
    /IF v_status NOT IN \('draft', 'active'\) OR v_year IS DISTINCT FROM rep_team_live_season\(v_team\) THEN\n[\s\S]*?END IF;\n/, ''],
  ['year row: a closed year never changes', 'org_fiscal_years_closed_guard',
    /IF OLD\.closed_at IS NOT NULL AND NEW\.closed_at IS NOT NULL\n[\s\S]*?END IF;\n/, ''],
  ['rename: two years never share a name', 'club_fiscal_year_rename',
    /IF EXISTS \(SELECT 1 FROM org_fiscal_years WHERE org_id = p_org AND lower\(name\) = lower\(v_name\) AND id <> v_year\.id\) THEN\n[\s\S]*?END IF;\n/, ''],
  ['first month: refused after the first close', 'club_fiscal_first_month_apply',
    /IF EXISTS \(SELECT 1 FROM org_fiscal_years WHERE org_id = p_org AND closed_at IS NOT NULL\)\n\s+OR EXISTS \(SELECT 1 FROM org_fiscal_year_reopenings WHERE org_id = p_org\) THEN\n[\s\S]*?END IF;\n/, ''],
  ['first month: a close since reopened still fixes the month', 'club_fiscal_first_month_apply',
    /\n\s+OR EXISTS \(SELECT 1 FROM org_fiscal_year_reopenings WHERE org_id = p_org\)/, ''],
  ['close state: written only by its own step', 'org_fiscal_years_closed_guard',
    /RAISE EXCEPTION 'year_closed: % is closed and reopened only by its own step', OLD\.name;/, 'NULL;'],
  ['bills: an unlink is judged by the year it would land in', 'rep_cost_allocations_fiscal_lock',
    /\n\s+OR club_allocation_locked_as\(NEW\.id, NEW\.source_budget_line_id, NEW\.org_id\)/, ''],
  ['books: a book holding closed lines keeps its kind', 'accounting_ledgers_fiscal_lock',
    /RAISE EXCEPTION 'year_closed: the book "%" holds lines in a closed fiscal year', OLD\.name;/, 'NULL;'],
  ['bill: only the team\'s RUNNING season', 'club_allocation_create',
    / OR v_year IS DISTINCT FROM rep_team_live_season\(v_team\)/, ''],
  ['ledger: a partner link is a label, nothing more', 'accounting_entries_fiscal_lock',
    /'linked_entry_id', /, ''],
  ['first month: a split never leaves a line below what it bills', 'club_fiscal_first_month_apply',
    /IF v_alloc > v_total \+ 0\.005 THEN\n[\s\S]*?END IF;\n/, ''],
  ['first month: a club that holds nothing just starts', 'club_fiscal_first_month_apply',
    /  IF NOT EXISTS \(SELECT 1 FROM org_budget_lines WHERE org_id = p_org\)\n[\s\S]*?  END IF;\n\n  -- The year today falls in keeps its months\./, '  -- The year today falls in keeps its months.'],
  ['first month: the preview writes nothing', 'club_fiscal_first_month_set',
    /IF p_preview OR NOT coalesce/, 'IF NOT coalesce'],
  ['carry: sent then received keeps the season that ran when it was sent', 'rep_allocation_installments_carrier',
    /NEW\.carried_by_program_year_id := OLD\.carried_by_program_year_id;/, 'NEW.carried_by_program_year_id := rep_team_live_season(coalesce(NEW.team_id, (SELECT team_id FROM rep_allocation_splits WHERE id = NEW.split_id)));'],
  ['carry: money back with the team is carried by nobody', 'rep_allocation_installments_carrier',
    /IF NEW\.paid_at IS NULL AND NEW\.sent_at IS NULL THEN\n[^\n]*\n\s+NEW\.carried_by_program_year_id := NULL;/, 'IF NEW.paid_at IS NULL AND NEW.sent_at IS NULL THEN\n    NULL;'],
  ['carry: the next season to run carries a between-seasons payment', 'rep_program_years_carry_waiting',
    /    UPDATE rep_allocation_installments i\n[\s\S]*?AND \(i\.paid_at IS NOT NULL OR i\.sent_at IS NOT NULL\);\n/, ''],
  // Club Tier Stage 11d (mig 328): a hand-back's ask for money back, its answer, its credit, and Send the changes.
  ['ask: a Sunday already in a waiting ask is refused', 'club_hand_back_ask',
    /\n\s+or exists \(select 1 from club_schedule_hand_back_slots w where w\.slot_id = \(v_row->>'slotId'\)::uuid and w\.waiting\)/, ''],
  ['ask: never more than the team can still ask back', 'club_hand_back_ask',
    /if v_cents > v_room then return jsonb_build_object\('ok', false, 'code', 'over_room', 'room', v_room\); end if;/, ''],
  ['request floor: an ask\'s request is removed only with its ask', 'rep_team_payment_requests_club_guard',
    /raise exception 'club_request: a request a hand-back or a schedule send carries is removed only with its ask';/, 'null;'],
  ['request floor: an ask\'s request changes only with it', 'rep_team_payment_requests_club_guard',
    /raise exception 'club_request: a request a hand-back or a schedule send carries changes only with it';/, 'null;'],
  ['request floor: only a step makes an accepted request', 'rep_team_payment_requests_club_guard',
    /raise exception 'club_request: only a hand-back or a schedule send raises this request';/, 'null;'],
  ['approve: a waiting ask\'s request is answered by the ask', 'club_request_approve',
    /IF v_req\.status = 'pending' AND v_req\.club_hand_back_id IS NOT NULL THEN\n\s+RETURN[^\n]*\n\s+END IF;/, ''],
  ['accept: answered once', 'club_hand_back_accept',
    /if v_hb\.state <> 'waiting' then return jsonb_build_object\('ok', false, 'code', 'answered', 'state', v_hb\.state\); end if;/, ''],
  ['accept: a Sunday that started drops out (Ask 7)', 'club_hand_back_accept',
    /where hs\.hand_back_id = p_hand_back and sl\.starts_at > now\(\)/, 'where hs.hand_back_id = p_hand_back'],
  ['credit: never a payment the team already SENT', 'club_credit_apply',
    /and i\.paid_at is null and i\.sent_at is null/, 'and i.paid_at is null'],
  ['credit: latest due first', 'club_credit_apply',
    /order by i\.due_date desc, i\.installment_number desc, i\.id desc/, 'order by i.due_date, i.installment_number, i.id'],
  ['receive: a received payment writes what is DUE on it', 'club_installment_receive',
    /v_due := v_inst\.amount - v_inst\.credited_amount;/, 'v_due := v_inst.amount;'],
  ['receive: a payment credited whole has nothing to receive', 'club_installment_receive',
    /IF v_due <= 0 THEN\n\s+RETURN[^\n]*\n\s+END IF;/, ''],
  ['decline: the request is denied with its ask', 'club_hand_back_decline',
    /update rep_team_payment_requests set status = 'denied'[\s\S]*?where club_hand_back_id = p_hand_back;/, ''],
  ['withdraw: the request goes with its ask', 'club_hand_back_withdraw',
    /delete from rep_team_payment_requests where club_hand_back_id = p_hand_back;/, ''],
  ['sweep: a lapsed ask takes its request with it', 'club_hand_back_sweep',
    /delete from rep_team_payment_requests where club_hand_back_id = v_hb\.id;/, ''],
  ['sweep: a Sunday that started leaves the ask\'s figure', 'club_hand_back_sweep',
    /update rep_team_payment_requests set amount = v_cents \/ 100\.0, updated_at = now\(\)\n[^\n]*\n/, ''],
  ['send the changes: a lost Sunday is credited in the step (Ask 8)', 'club_schedule_apply_changes',
    /v_credit := club_credit_apply\(p_org, \(v_loss->>'teamId'\)::uuid,[\s\S]*?null, p_send\);/, 'v_credit := 0;'],
  // The high-risk review's fixes (2026-10-13).
  ['accept: a Sunday the club removed never writes a NULL into handed_back', 'club_hand_back_accept',
    /coalesce\(slot_id = any \(select jsonb_array_elements_text\(v_res->'slots'\)::uuid\), false\)/,
    "slot_id = any (select jsonb_array_elements_text(v_res->'slots')::uuid)"],
  ['reverse: Record paying taken back leaves the club owing it (accepted, never reversed)', 'club_request_reverse',
    /SET status = CASE WHEN[\s\S]*?reversed_reason = CASE[^\n]*\n/,
    "SET status = 'reversed', reversed_at = now(), reversed_by = p_actor, reversed_reason = p_reason,\n"],
  ['request floor: a linked request is removed only with its step, whatever its state', 'rep_team_payment_requests_club_guard',
    /\n(\s+)and exists \(select 1 from organizations where id = old\.org_id\)/,
    "\n$1and old.status in ('pending', 'accepted', 'credited')\n$1and exists (select 1 from organizations where id = old.org_id)"],
  ['request floor: a paid request\'s record is the step\'s', 'rep_team_payment_requests_club_guard',
    /\n\s+or new\.paid_on is distinct from old\.paid_on or new\.paid_method is distinct from old\.paid_method/, ''],
  ['ask: the request lands on the team\'s own season', 'club_hand_back_ask',
    /  if not exists \(select 1 from rep_program_years where id = nullif\(p_request->>'programYearId', ''\)::uuid\n[^\n]*\n\s+return jsonb_build_object\('ok', false, 'code', 'changed'\);\n\s+end if;\n/, ''],
  ['sweep: a Sunday is still to come by its slot as it stands (moved later: not lapsed)', 'club_hand_back_sweep',
    /count\(\*\) filter \(where sl\.id is not null and sl\.removed_at is null and sl\.starts_at > now\(\)\),/,
    'count(*) filter (where hs.starts_at > now()),'],
  // Club Tier Stage 11d part C (migs 330–331): a hand-back the coach can change.
  ['hand-back: every practice is kept, never deleted (Ask 10)', 'club_hand_back_events',
    /update rep_team_events set status = 'cancelled', updated_at = now\(\) where id = v_event;/, 'perform club_practice_retire(v_event);'],
  ['take back: a Sunday the club gave to another team stays theirs', 'club_hand_back_take_back',
    /\n\s+or exists \(select 1 from club_schedule_slot_teams st where st\.slot_id = v_slot\)/, ''],
  ['take back: a Sunday that started stays handed back', 'club_hand_back_take_back',
    / and sl\.starts_at > now\(\)\)/, ')'],
  ['take back: a Sunday an ask waits on stays handed back', 'club_hand_back_take_back',
    /    if exists \(select 1 from club_schedule_hand_back_slots w where w\.slot_id = v_slot and w\.waiting\) then\n\s+continue;\n\s+end if;\n/, ''],
  ['take back: a Sunday whose money was settled stays handed back', 'club_hand_back_take_back',
    /where l\.late_for = p_hand_back and l\.state = 'accepted' and ls\.slot_id = v_slot\) then/, 'where false) then'],
  ['ask later: one ask over a hand-back, none after an answer', 'club_hand_back_ask_later',
    /if exists \(select 1 from club_schedule_hand_backs l where l\.late_for = p_hand_back and l\.state in \('waiting', 'accepted', 'declined'\)\)\n\s+or /, 'if '],
  // (A late ask OPENING nothing is pinned by club-hand-back-change-guard.test.ts: since the /review fix it counts only
  // Sundays the team doesn't hold, so the opening step would find nothing to open and a mutation could not be caught.)
  ['accept: a late ask never pays for a Sunday the club gave back to the team', 'club_hand_back_accept',
    /\n\s+and not exists \(select 1 from club_schedule_slot_teams st where st\.slot_id = hs\.slot_id and st\.team_id = v_hb\.team_id\);\n/, ';\n'],
  ['ask later: never asks for a Sunday the club gave back to the team', 'club_hand_back_ask_later',
    /\n\s+-- A Sunday the club has given back to the team is the team's again: never asked for \(\/review 2026-10-16\)\.\n\s+and not exists \(select 1 from club_schedule_slot_teams st where st\.slot_id = hs\.slot_id and st\.team_id = p_team\)/, ''],
  ['sweep: a late ask is never lapsed or trued (mig 331)', 'club_hand_back_sweep',
    / and h\.late_for is null/, ''],
  // ⚠ NOT HERE: 'the General ledger is made once'. Its ON CONFLICT path is reached only when two
  // transactions race, which one rolled-back block cannot stage; club-stage3a-server-guard.test.ts
  // pins the clause instead, and T9 checks the function returns one ledger.
];

function run(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), 'club-atomicity-'));
  const file = path.join(dir, 'probe.sql');
  writeFileSync(file, sql);
  const out = spawnSync(process.execPath, [path.join(ROOT, 'scripts/db-query.mjs'), '--dev', '-f', file], { cwd: ROOT, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  const text = `${out.stdout ?? ''}${out.stderr ?? ''}`;
  if (text.includes(PASSED)) return { outcome: 'passed', text };
  // ⚠ A KILL IS ONE OF THE TEST'S OWN ASSERTIONS FIRING ("FAIL T…"), never any error at all: a
  // mutation that breaks the SQL's syntax "fails" too, and counting that as caught is how a mutation
  // run reports ten kills while proving nothing (it did, on its first run).
  const assertion = text.match(/FAIL T\d+[^\\"]*/)?.[0];
  if (assertion) return { outcome: 'caught', text: assertion };
  return { outcome: 'error', text: text.slice(0, 400) };
}

// A function replacer, never a string: a replacement STRING reads `$` as "one dollar sign", which
// silently broke every dollar-quoted function body spliced in.
const real = run(withJoin(TEST.replace('{{MUTATIONS}}', () => '')));
if (real.outcome !== 'passed') {
  console.error(`✗ check:club-money-atomicity — a money move is not one step:\n  ${real.text}`);
  process.exit(1);
}
console.log('✓ check:club-money-atomicity — every move is one step: a double submit leaves one pair, a failed step leaves none, both halves go together (dev, rolled back).');

if (process.argv.includes('--mutate')) {
  let survived = 0;
  for (const [label, name, pattern, replacement] of MUTATIONS) {
    const original = name === '@join' ? JOIN : fn(name);
    if (!pattern.test(original)) { console.error(`  ✗ mutation "${label}" no longer matches ${name} — update the mutation`); survived++; continue; }
    const mutated = original.replace(pattern, replacement);
    const sql = name === '@join'
      ? withJoin(TEST.replace('{{MUTATIONS}}', () => ''), mutated)
      : withJoin(TEST.replace('{{MUTATIONS}}', () => 'EXECUTE $mut$' + mutated + '$mut$;'));
    const r = run(sql);
    if (r.outcome === 'passed') { console.error(`  ✗ SURVIVED: ${label} — the test did not notice`); survived++; }
    else if (r.outcome === 'error') { console.error(`  ✗ BROKEN MUTATION: ${label} — it failed for the wrong reason: ${r.text.slice(0, 200)}`); survived++; }
    else console.log(`  ✓ killed: ${label} — ${r.text.slice(0, 110)}`);
  }
  if (survived) { console.error(`✗ ${survived} mutation(s) survived.`); process.exit(1); }
  console.log(`✓ all ${MUTATIONS.length} mutations killed.`);
}
