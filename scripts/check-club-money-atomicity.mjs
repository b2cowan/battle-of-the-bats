/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY CLUB MONEY MOVE IS ONE STEP — PROVED ON THE DATABASE (Club Tier Stage 3a,
 * `check:club-money-atomicity`).
 *
 * Runs scripts/club-money-atomicity.sql against the DEV database: every move of mig 315 for real —
 * a double submit leaves ONE pair of lines; a step that fails part-way leaves NONE; undo, reverse and
 * a transfer void take both halves with the reason; a team's book and a line from a source are
 * refused; the General ledger is made once; payees merge in one step. Since mig 316 (Ledger Parity) it
 * also proves the payee sharing rule and a team's own merge (`team_payee_merge`). The block always ends
 * in an exception, so nothing it writes survives (its success word is the exception).
 *
 * `--mutate` then runs it again once per MUTATION — each removes one refusal from a copy of a
 * function, inside the same rolled-back block — and passes only if every mutation is CAUGHT. A test
 * that cannot fail proves nothing; this is how it shows it can.
 *
 * ⚠ DEV ONLY, and NOT in `verify:changed`: it needs the network and the dev database (like
 * `check:register`). Run it after any change to mig 315's or 316's functions, and in /release before
 * either migration is applied to prod. It never touches prod (`db-query.mjs` refuses a write there anyway).
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
// club_payee_merge), never the superseded one.
const MIGS = [
  'supabase/migrations/316_a_club_shares_payees_with_its_teams.sql',
  'supabase/migrations/315_a_club_money_move_is_one_step.sql',
].map(f => readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'));
const PASSED = 'CLUB_MONEY_ATOMICITY_PASSED';

function fn(name) {
  const head = `CREATE OR REPLACE FUNCTION public.${name}(`;
  const mig = MIGS.find(m => m.includes(head));
  if (!mig) throw new Error(`${name} is not in migs 315/316`);
  const start = mig.indexOf(head);
  return mig.slice(start, mig.indexOf('$$;', mig.indexOf('AS $$', start) + 5) + 3);
}

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
    /IF v_req\.status <> 'pending' THEN\n\s+RETURN[^\n]*\n\s+END IF;/, ''],
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
const real = run(TEST.replace('{{MUTATIONS}}', () => ''));
if (real.outcome !== 'passed') {
  console.error(`✗ check:club-money-atomicity — a money move is not one step:\n  ${real.text}`);
  process.exit(1);
}
console.log('✓ check:club-money-atomicity — every move is one step: a double submit leaves one pair, a failed step leaves none, both halves go together (dev, rolled back).');

if (process.argv.includes('--mutate')) {
  let survived = 0;
  for (const [label, name, pattern, replacement] of MUTATIONS) {
    const original = fn(name);
    if (!pattern.test(original)) { console.error(`  ✗ mutation "${label}" no longer matches ${name} — update the mutation`); survived++; continue; }
    const mutated = original.replace(pattern, replacement);
    const sql = TEST.replace('{{MUTATIONS}}', () => 'EXECUTE $mut$' + mutated + '$mut$;');
    const r = run(sql);
    if (r.outcome === 'passed') { console.error(`  ✗ SURVIVED: ${label} — the test did not notice`); survived++; }
    else if (r.outcome === 'error') { console.error(`  ✗ BROKEN MUTATION: ${label} — it failed for the wrong reason: ${r.text.slice(0, 200)}`); survived++; }
    else console.log(`  ✓ killed: ${label} — ${r.text.slice(0, 110)}`);
  }
  if (survived) { console.error(`✗ ${survived} mutation(s) survived.`); process.exit(1); }
  console.log(`✓ all ${MUTATIONS.length} mutations killed.`);
}
