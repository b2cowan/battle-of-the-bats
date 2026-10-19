/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE FAMILY RECORD IS TRUE — PROVED ON THE DATABASE (Club Tier Stage 5a, `check:families-record`).
 *
 * Runs scripts/families-record.sql against the DEV database, inside one block that always ends in an exception, so
 * nothing it writes survives: a merge holds (E01: no ghost, nothing proposed again), an edited guardian email moves the
 * child to the new address and is recorded once (E02; a re-run changes nothing), a person who keeps a row is not
 * proposed, an address already owned mints no one, the claim alias still files one person, the three-a-day cap
 * (family_message_claim), and a merge carrying a family's message dates.
 *
 * The functions under test are INSTALLED inside the block from the migrations' own text (never a copy), so the check
 * runs the same before and after the migrations reach dev:
 *   (default)  migs 333 + 334 + 338 — must PASS.
 *   --old      the same, then 252's attach and 254's merge over them — must FAIL T1 and T2 (and T7): the proof
 *              that the E01 / E02 tests bite on the code they replace.
 *   --before-338  the same, then 334's merge over 338's (Club Tier Stage 5c) — must FAIL T11: the proof that "a merge
 *              carries the family's notes and hand-offs" bites on the function it replaces.
 *   --mutate   the real run, then once per MUTATION (each removes one rule from a copy) — every one must be CAUGHT.
 *
 * ⚠ DEV ONLY, and NOT in `verify:changed`: it needs the network and the dev database. It never touches prod.
 * ⚠ NOT HERE: the cap's RACE (two presses at two-of-three, in parallel). One rolled-back block is one transaction and
 *   cannot stage two; `scripts/check-family-message-race.mjs` runs that one, on two connections.
 *
 * Usage:  npm run check:families-record [-- --old | -- --mutate]
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const TEST = read('scripts/families-record.sql');
const PASSED = 'FAMILIES_RECORD_PASSED';

/** A migration's statements, without its own BEGIN / COMMIT, ready for one EXECUTE. */
const body = f => read(`supabase/migrations/${f}`).replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
const M333 = body('333_a_merge_holds_and_an_edited_email_follows_the_child.sql');
const M334 = body('334_a_family_message_keeps_its_date_and_sender.sql');
const M338 = body('338_the_club_hands_a_payment_to_the_coach_and_keeps_notes.sql');

/** One CREATE OR REPLACE FUNCTION, as a migration writes it. */
function fn(sql, name) {
  const head = `CREATE OR REPLACE FUNCTION ${name}(`;
  const start = sql.indexOf(head);
  if (start < 0) throw new Error(`${name} is not where this check reads it`);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('AS $$', start) + 5) + 3);
}
const OLD_ATTACH = fn(read('supabase/migrations/252_league_waiver_acceptance_is_recorded.sql'), 'families_attach_people');
const OLD_MERGE = fn(read('supabase/migrations/254_a_merge_is_one_transaction.sql'), 'families_merge_people');
const exec = sql => `EXECUTE $inst$${sql}$inst$;`;

/** Each mutation removes ONE rule; the test must catch every one. */
const MUTATIONS = [
  ['E01: mint an address the book already owns (the ghost)', M333, 'families_attach_people',
    /\n\s+AND NOT EXISTS \(SELECT 1 FROM org_person_emails owned\n[^\n]*\n/, '\n'],
  ['E02: never re-attach an attached row', M333, 'families_attach_people',
    /WHERE h\.movable AND pe\.person_id <> h\.from_person/, 'WHERE false'],
  ['E02: record a move whether or not the person was emptied', M333, 'families_attach_people',
    /\n\s+WHERE NOT EXISTS \(\n\s+SELECT 1 FROM held k[\s\S]*?\n\s+\)\n\s+ON CONFLICT/, '\n  ON CONFLICT'],
  ['E02: re-point an unapproved link', M333, 'families_attach_people',
    /\n\s+WHERE h\.movable AND pe\.person_id <> h\.from_person/, '\n     WHERE pe.person_id <> h.from_person'],
  ['merge: lose a proposal to a third person', M338, 'families_merge_people',
    /\n\s+UPDATE org_person_reattachments SET to_person_id = p_keep_id[\s\S]*?source_id\);\n/, '\n'],
  ['alias: a declined claim aliases', M333, 'families_attach_people',
    /\n\s+AND f\.status = 'verified'   -- \(mig 333\) a pending, declined or revoked claim never aliases/, ''],
  ['cap: four a day', M334, 'family_message_claim', /IF v_count >= v_cap THEN/, 'IF v_count > v_cap THEN'],
  ['cap: another club\'s person', M334, 'family_message_claim',
    /IF NOT EXISTS \(SELECT 1 FROM org_people WHERE id = p_person_id AND org_id = p_org_id\) THEN/,
    'IF NOT EXISTS (SELECT 1 FROM org_people WHERE id = p_person_id) THEN'],
  ['merge: lose the message dates', M338, 'families_merge_people',
    /\n\s+UPDATE family_messages\s+SET person_id = p_keep_id[^\n]*\n/, '\n'],
  ['merge: lose the family\'s notes', M338, 'families_merge_people',
    /\n\s+UPDATE family_notes\s+SET person_id = p_keep_id[^\n]*\n/, '\n'],
  ['merge: lose the payments handed to a coach', M338, 'families_merge_people',
    /\n\s+UPDATE family_payment_handoffs\s+SET person_id = p_keep_id[^\n]*\n/, '\n'],
];

function run(install, mutations = '') {
  const dir = mkdtempSync(path.join(tmpdir(), 'families-record-'));
  const file = path.join(dir, 'probe.sql');
  // Function replacers: a replacement STRING reads `$` specially, and every body here is dollar-quoted.
  writeFileSync(file, TEST.replace('{{INSTALL}}', () => install).replace('{{MUTATIONS}}', () => mutations));
  const out = spawnSync(process.execPath, [path.join(ROOT, 'scripts/db-query.mjs'), '--dev', '-f', file], { cwd: ROOT, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  const text = `${out.stdout ?? ''}${out.stderr ?? ''}`;
  if (text.includes(PASSED)) return { outcome: 'passed', text };
  // A kill is one of the test's own assertions firing, never any error (a broken mutation "fails" too).
  const fails = text.match(/FAIL T\d+[^\\"]*/)?.[0];
  if (fails) return { outcome: 'caught', text: fails };
  return { outcome: 'error', text: text.slice(0, 600) };
}

const NEW = exec(M333) + '\n  ' + exec(M334) + '\n  ' + exec(M338);

if (process.argv.includes('--before-338')) {
  const r = run(NEW + '\n  ' + exec(fn(M334, 'families_merge_people')));
  if (!(r.outcome === 'caught' && /FAIL T11/.test(r.text))) {
    console.error(`✗ check:families-record --before-338 — the notes test did NOT fail on mig 334's merge (${r.outcome}):\n  ${r.text}`);
    process.exit(1);
  }
  console.log('✓ check:families-record --before-338 — on the merge it replaces, the notes test fails as it should:');
  for (const f of r.text.split(' | ')) console.log(`  · ${f}`);
  process.exit(0);
}

if (process.argv.includes('--old')) {
  const r = run(NEW + '\n  ' + exec(OLD_ATTACH) + '\n  ' + exec(OLD_MERGE));
  const bites = r.outcome === 'caught' && /FAIL T1/.test(r.text) && /FAIL T2/.test(r.text);
  if (!bites) {
    console.error(`✗ check:families-record --old — the E01/E02 tests did NOT fail on migs 252/254 (${r.outcome}):\n  ${r.text}`);
    process.exit(1);
  }
  console.log('✓ check:families-record --old — on the code it replaces, the tests fail as they should:');
  for (const f of r.text.split(' | ')) console.log(`  · ${f}`);
  process.exit(0);
}

const real = run(NEW);
if (real.outcome !== 'passed') {
  console.error(`✗ check:families-record — the family record is not true:\n  ${real.text}`);
  process.exit(1);
}
console.log('✓ check:families-record — a merge holds, an edited email follows the child (recorded once), the cap holds at three, a merge keeps the message dates, the notes and the hand-offs (dev, rolled back).');

if (process.argv.includes('--mutate')) {
  let survived = 0;
  for (const [label, mig, name, pattern, replacement] of MUTATIONS) {
    const original = fn(mig, name);
    if (!pattern.test(original)) { console.error(`  ✗ mutation "${label}" no longer matches ${name} — update the mutation`); survived++; continue; }
    const r = run(NEW, exec(original.replace(pattern, () => replacement)));
    if (r.outcome === 'passed') { console.error(`  ✗ SURVIVED: ${label} — the test did not notice`); survived++; }
    else if (r.outcome === 'error') { console.error(`  ✗ BROKEN MUTATION: ${label} — it failed for the wrong reason: ${r.text.slice(0, 300)}`); survived++; }
    else console.log(`  ✓ killed: ${label} — ${r.text.slice(0, 120)}`);
  }
  if (survived) { console.error(`✗ ${survived} mutation(s) survived.`); process.exit(1); }
  console.log(`✓ all ${MUTATIONS.length} mutations killed.`);
}
