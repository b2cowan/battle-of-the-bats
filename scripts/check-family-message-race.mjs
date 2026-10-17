/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TWO PRESSES AT TWO OF THREE — ONE SENDS (Club Tier Stage 5a, Ask 9; mig 334's family_message_claim).
 *
 * `check:families-record` proves the cap inside one rolled-back block, which is one transaction and so cannot stage
 * two presses at once. This does, on two connections: a throwaway person in the given club with two messages already
 * today, then two claims fired in parallel (two Management API requests — two transactions). The claim's per-person
 * lock makes the second wait and count the first, so EXACTLY ONE may succeed. Then the throwaway person is deleted
 * (its message rows go with it, ON DELETE CASCADE).
 *
 * ⚠ DEV ONLY, and it WRITES (one person, two to four message rows, then removes them): ask before running it.
 * ⚠ NOT in `verify:changed` — it needs the network and the dev database.
 *
 * Usage:  node scripts/check-family-message-race.mjs [org-slug]     (default: qa-families-fixture)
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2] ?? 'qa-families-fixture';

function query(sql) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts/db-query.mjs'), '--dev', '-q', sql], { cwd: ROOT });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', () => resolve(out));
  });
}
const json = (text) => { const m = text.match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : null; };

const email = `race-${Date.now()}@race.invalid`;
const setup = json(await query(`
  with o as (select id from organizations where slug = '${slug}'),
  p as (insert into org_people (org_id, email_normalized, first_name, last_name) select id, '${email}', 'Race', 'Check' from o returning id, org_id),
  m as (insert into family_messages (org_id, person_id, sent_at) select org_id, id, now() - interval '1 hour' from p
        union all select org_id, id, now() - interval '2 hours' from p returning id)
  select p.id as person_id, p.org_id from p`));
if (!setup?.[0]) { console.error(`✗ check-family-message-race — no club "${slug}" on dev (or the setup failed).`); process.exit(1); }
const { person_id: personId, org_id: orgId } = setup[0];

let exit = 0;
try {
  const claim = `select family_message_claim('${orgId}', '${personId}', null) as r`;
  const [a, b] = await Promise.all([query(claim), query(claim)]);
  const results = [json(a)?.[0]?.r, json(b)?.[0]?.r];
  const ok = results.filter(r => r?.ok === true).length;
  const capped = results.filter(r => r?.ok === false && r?.code === 'cap').length;
  const rows = json(await query(`select count(*)::int as n from family_messages where person_id = '${personId}'`))?.[0]?.n;
  if (ok === 1 && capped === 1 && rows === 3) {
    console.log(`✓ check-family-message-race — two presses at two of three: one sent, one refused "cap" (next at ${results.find(r => r?.code === 'cap')?.nextAt}); 3 rows, never 4.`);
  } else {
    console.error(`✗ check-family-message-race — ${ok} succeeded, ${capped} refused, ${rows} rows (want 1, 1, 3): ${JSON.stringify(results)}`);
    exit = 1;
  }
} finally {
  await query(`delete from org_people where id = '${personId}' and email_normalized = '${email}'`);
}
process.exit(exit);
