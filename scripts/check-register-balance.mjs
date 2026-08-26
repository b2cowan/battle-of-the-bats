/**
 * THE REGISTER'S ONE BUILD-BLOCKING CLAIM: **the running balance at Today IS Cash on hand.**
 *
 * ⚠ WHY THIS IS A SCRIPT AND NOT A UNIT TEST. The arithmetic is already unit-tested
 * (`tests/unit/coach-register.test.ts` — balances accumulate forwards, an out-of-pocket cost does
 * not move them, a projection never reaches the settled close). What no unit test can check is that
 * TWO ROUTES, reading the same database, agree: `/register` decomposes the movements and
 * `/money-summary` totals them, and the register's whole design rests on those landing on the same
 * number. A source added to one and not the other breaks it silently — both figures still look
 * perfectly plausible on their own.
 *
 * ⚠ AND IT MUST RUN AGAINST A TEAM WITH DERIVED ROWS FROM ALL THREE SOURCES (dues, fundraising,
 * club). A team whose money is only what the coach typed proves nothing: the identity was ALREADY
 * true for those rows before this release, and it was the derived ones — plus recorded income and
 * refunds, which reached no cash figure at all — that broke it. The script says out loud which
 * sources it actually saw, so a green run over a thin fixture cannot be mistaken for a pass.
 *
 * Needs the dev server running and the UAT coach session present:
 *   npx playwright test --config playwright.config.ts --project=auth-setup
 *
 * Usage:
 *   node scripts/check-register-balance.mjs                     the UAT coach fixture's team
 *   node scripts/check-register-balance.mjs <orgSlug> <teamId>  any team that session can reach
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveUatContext } from './uat-fixture-context.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SESSION = path.join(ROOT, 'tests/uat/.auth/coach.json');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

/** Dollars compared the way money is compared everywhere else in this repo: to the cent. */
const cents = n => Math.round(Number(n) * 100);
const fmt = n => `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  if (!existsSync(SESSION)) {
    console.error(`✗ No coach session at ${path.relative(ROOT, SESSION)}`);
    console.error('  Repair: npx playwright test --config playwright.config.ts --project=auth-setup');
    process.exit(1);
  }

  let [orgSlug, teamId] = process.argv.slice(2);
  if (!orgSlug || !teamId) {
    const ctx = await resolveUatContext();
    orgSlug = ctx.orgSlug;
    teamId = ctx.teamId;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    storageState: JSON.parse(readFileSync(SESSION, 'utf8')),
    baseURL: BASE,
  });

  const api = `/api/coaches/${orgSlug}/teams/${teamId}`;
  const [bookRes, sumRes] = await Promise.all([
    context.request.get(`${BASE}${api}/register`),
    context.request.get(`${BASE}${api}/money-summary`),
  ]);

  if (!bookRes.ok() || !sumRes.ok()) {
    console.error(`✗ Could not read both endpoints (register ${bookRes.status()}, summary ${sumRes.status()}).`);
    console.error('  Is the dev server up, and is the session stale?');
    await browser.close();
    process.exit(1);
  }

  const book = await bookRes.json();
  const summary = await sumRes.json();
  await browser.close();

  /* ⚠⚠ ONE CHRONOLOGICAL ARRAY NOW, NOT TWO (reading-order ruling, follow-up to P3) — `book.book`,
     oldest to newest, with `book.todayIndex` naming where Today sits. "Settled" and "scheduled"
     are no longer separate blocks; they're every row split by its own `scheduled` flag, and an
     overdue row can sit ANYWHERE before Today, interleaved at its true date. */
  const rows = book.book ?? [];
  const settled = rows.filter(r => !r.scheduled);
  const scheduled = rows.filter(r => r.scheduled);
  const overdue = scheduled.filter(r => r.overdueDays != null);

  // ── What the fixture actually contains. A pass over a team with none of this proves nothing. ──
  const kinds = new Set(rows.map(r => r.kind));
  const derived = ['dues', 'fundraising', 'club'].filter(k => kinds.has(k));
  const recorded = ['expense', 'income', 'refund'].filter(k => kinds.has(k));
  const nonCash = settled.filter(r => !r.movesCash);

  console.log(`\nRegister balance check — ${orgSlug} / ${teamId}`);
  console.log(`  rows            : ${settled.length} settled, ${scheduled.length} scheduled (${overdue.length} overdue)`);
  console.log(`  recorded kinds  : ${recorded.join(', ') || '(none)'}`);
  console.log(`  derived sources : ${derived.join(', ') || '(none)'}`);
  console.log(`  no-cash rows    : ${nonCash.length} (out-of-pocket costs — on the book, not in the balance)`);

  const problems = [];

  // ── 1. The identity ────────────────────────────────────────────────────────────────────────
  // Oldest to newest now, so the closing balance is the LAST settled row, not the first — and it
  // has to be found by `!scheduled`, because an overdue row can sit after it in array order while
  // never being part of the real close.
  /* ⚠⚠ AND THE BOOK MAY OPEN ON MONEY THIS SEASON DID NOT MOVE (mig 262). A season carried
     forward starts its walk from the balance the one before it closed at — so an EMPTY book's close
     is the carry rather than zero, and every identity below has to start from the same place.
     Absent on a payload from before this shipped, which reads as zero and is right for it. */
  const opening = cents(book.opening ?? 0);
  const closing = settled.length > 0 ? settled[settled.length - 1].balance : book.opening ?? 0;
  if (cents(closing) !== cents(book.cashOnHand)) {
    problems.push(`the last settled row's balance ${fmt(closing)} is not the book's own close ${fmt(book.cashOnHand)}`);
  }
  if (cents(book.cashOnHand) !== cents(summary.onHand)) {
    problems.push(
      `THE BALANCE AND CASH ON HAND DISAGREE — register ${fmt(book.cashOnHand)} vs summary ${fmt(summary.onHand)}`
      + ` (out by ${fmt(book.cashOnHand - summary.onHand)})`);
  }

  // ── 2. Every row is a movement of it ───────────────────────────────────────────────────────
  const summed = opening + settled.reduce((c, r) => c + (r.movesCash ? cents(r.moneyIn) - cents(r.moneyOut) : 0), 0);
  if (summed !== cents(book.cashOnHand)) {
    problems.push(
      `the opening balance ${fmt(opening / 100)} plus the settled rows comes to ${fmt(summed / 100)},`
      + ` which is not the close ${fmt(book.cashOnHand)}`);
  }

  // ── 3. An overdue row never moves the real close, wherever it's interleaved ───────────────
  const overdueMoved = overdue.some((r, idx, arr) => {
    // Compare each overdue row's balance to the nearest settled row immediately before it in the
    // FULL array — it must be carried, never its own accumulation.
    const posInBook = rows.indexOf(r);
    const priorSettled = [...rows.slice(0, posInBook)].reverse().find(x => !x.scheduled);
    /* ⚠ WITH NOTHING SETTLED BEFORE IT, THE REAL CASH IS THE CARRY, NOT ZERO (mig 262) — an overdue
       bill dated before a carried season's first payment sits on top of the money it opened with. */
    const expected = priorSettled ? priorSettled.balance : (book.opening ?? 0);
    return cents(r.balance) !== cents(expected);
  });
  if (overdueMoved) {
    problems.push('an overdue row\'s balance does not match the real cash that existed immediately before it — it moved money that never moved');
  }

  // ── 4. A projection never leaks into the settled close ─────────────────────────────────────
  const beforeToday = rows.slice(0, book.todayIndex ?? rows.length);
  const afterToday = rows.slice(book.todayIndex ?? rows.length);
  if (afterToday.some(r => !r.scheduled) || beforeToday.some(r => r.scheduled && r.overdueDays == null)) {
    problems.push('a row is on the wrong side of Today — a projection has leaked into the past, or an overdue row into the future');
  }

  // ── 5. Never both columns, never signed ────────────────────────────────────────────────────
  const bad = rows.filter(r =>
    (r.moneyIn > 0 && r.moneyOut > 0) || r.moneyIn < 0 || r.moneyOut < 0);
  if (bad.length > 0) {
    problems.push(`${bad.length} row(s) carry both directions or a negative amount: ${bad.slice(0, 3).map(r => r.description).join(', ')}`);
  }

  if (problems.length > 0) {
    console.error('\n✗ The register is wrong by construction:\n');
    for (const p of problems) console.error(`  · ${p}`);
    console.error('\n  ⚠ /register and /money-summary are a matched pair. Read the header on either.\n');
    process.exit(1);
  }

  console.log(`\n  balance at Today = cash on hand = ${fmt(book.cashOnHand)}  ✓`);
  if (opening !== 0) {
    console.log(`  (opening ${fmt(opening / 100)} carried in — and it reached the book AND the summary)`);
  }
  if (book.projectedBalance !== null && book.projectedBalance !== undefined) {
    console.log(`  once everything scheduled lands: ${fmt(book.projectedBalance)}`);
  }

  if (derived.length < 3) {
    console.error(`\n⚠ THIS RUN PROVES LESS THAN IT LOOKS LIKE. Only ${derived.length} of the three derived`);
    console.error('  sources (dues, fundraising, club) are on this team\'s book, and the derived rows are');
    console.error('  exactly what the identity used to break on. Run it against a team that has all three.');
    process.exit(2);
  }
  console.log('\n✓ All three derived sources present — the identity holds where it can actually fail.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
