/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TWO PRESSES OF "EMAIL FAMILIES" AT ONCE — ONE SENDS (Club Tier Stage 7c; mig 347's family_email_claim).
 *
 * `check:families-record` (T12) proves the club claim inside one rolled-back block, which is one transaction and so
 * cannot stage two presses at once. This does, on two connections: a throwaway club, then two claims fired in parallel
 * (two Management API requests — two transactions: one admin's double press, or two admins at once). The claim's
 * per-club lock makes the second wait and see the first, so EXACTLY ONE may succeed and the other is refused
 * 'just_sent'. Then a third press with the club already at two of three in the day (the first one aged past the
 * minute) races a fourth: one takes the third place, the other is refused 'cap'. The throwaway club is then deleted
 * (its send rows go with it, ON DELETE CASCADE). No email is sent — this calls the claim only.
 *
 * ⚠ DEV ONLY, and it WRITES (one throwaway organization and up to four send rows, then removes them).
 * ⚠ NOT in `verify:changed` — it needs the network and the dev database.
 *
 * Usage:  node scripts/check-family-email-race.mjs
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const slug = `race-email-${Date.now()}`;
const setup = json(await query(`insert into organizations (name, slug) values ('Email race check', '${slug}') returning id`));
if (!setup?.[0]) { console.error('✗ check-family-email-race — the throwaway club could not be made on dev.'); process.exit(1); }
const orgId = setup[0].id;

const claim = (subject) => `select family_email_claim('${orgId}', null, '${subject}', 'Body', 'every', 'Every family', '{}', null, 10, 0) as r`;
const outcome = (text) => json(text)?.[0]?.r;
let exit = 0;
try {
  // 1 · a double press: two claims at once, nothing sent yet today.
  const [a, b] = await Promise.all([query(claim('Press A')), query(claim('Press B'))]);
  const first = [outcome(a), outcome(b)];
  const okOnce = first.filter(r => r?.ok === true).length === 1 && first.filter(r => r?.code === 'just_sent').length === 1;

  // 2 · two of three already sent today (aged past the minute), then two presses at once for the third place.
  await query(`update family_email_sends set sent_at = now() - interval '10 minutes' where org_id = '${orgId}'`);
  await query(`insert into family_email_sends (org_id, subject, body, audience_kind, audience_label, sent_at, status)
               values ('${orgId}', 'Earlier', 'Body', 'every', 'Every family', now() - interval '20 minutes', 'done')`);
  const [c, d] = await Promise.all([query(claim('Press C')), query(claim('Press D'))]);
  const second = [outcome(c), outcome(d)];
  const third = second.filter(r => r?.ok === true).length === 1 && second.filter(r => r?.code === 'just_sent' || r?.code === 'cap').length === 1;
  const rows = json(await query(`select count(*)::int as n from family_email_sends where org_id = '${orgId}'`))?.[0]?.n;

  if (okOnce && third && rows === 3) {
    console.log('✓ check-family-email-race — two presses at once send once (the other refused just sent); at two of three, two presses take the third place once; 3 rows (dev, removed).');
  } else {
    console.error(`✗ check-family-email-race — the claim let a race through:\n  double press: ${JSON.stringify(first)}\n  third place: ${JSON.stringify(second)}\n  rows: ${rows} (want 3)`);
    exit = 1;
  }
} finally {
  await query(`delete from organizations where id = '${orgId}' and slug = '${slug}'`);
}
process.exit(exit);
