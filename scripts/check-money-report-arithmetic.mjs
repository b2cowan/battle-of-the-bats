/**
 * THE MONEY REPORT'S BUILD-BLOCKING CLAIMS: **its three feeds describe ONE season** — and, since
 * 2026-08-23, **its Actual cash strip IS the register bucketed by month** (claim 5 below; the
 * owner's whole-cash ruling, `memory/design_decisions.md` 2026-08-23). The strip and the register
 * derive the season's cash independently from the same records, which is the same
 * derive-twice-plus-checker license `check-register-balance.mjs` runs on register↔money-summary.
 *
 * Budget vs. Actual answers "what did we actually spend?" in three places a coach reads together —
 * the statement, the Months grid, and the cumulative chart rendered directly above the statement.
 * Until 2026-08-17 each one walked the raw records itself, and nothing connected them:
 *
 *   · the chart never netted money back, so a $500 hire with $200 refunded read $500 there and
 *     $300 six inches below it;
 *   · a commitment paid in two instalments arrived as ONE payment dated by the earlier one, so the
 *     chart and the statement's own payment schedule put a July balance in April;
 *   · club money reached two of the three and was silently absent from the third.
 *
 * ⚠ WHY THIS IS A SCRIPT AND NOT A UNIT TEST. The arithmetic is unit-tested twice over
 * (`tests/unit/coach-budget-rollup.test.ts`, `tests/unit/coach-budget-months.test.ts`). What no unit
 * test can check is that ONE ROUTE, assembling one payload from one database, hands its three feeds
 * the same money. A kind of money added to two of the three produces no error and no failing test —
 * just a screen that reads low. Same reason, same shape as `scripts/check-register-balance.mjs`.
 *
 * ⚠⚠ AND IT MUST RUN AGAINST A FIXTURE THAT COULD ACTUALLY DISAGREE. A team with no refund and no
 * commitment paid across two months cannot fail this check — the identity was already true for those
 * rows before any of this — so a green run over one proves nothing. The three shapes that broke it
 * are required, they are named on every run, and their absence exits non-zero. The UAT fixture's
 * split-month payable exists for this and nothing else (see `seed-uat-coach-fixture.mjs`).
 *
 * ⚠ IT READS THE DRILL-IN's ROW IDS to find a split commitment (`<expenseId>-payment-<paymentId>`
 * since the Payables Rebuild, `<expenseId>-deposit`/`-balance` before it — both are recognised, so a
 * run against a database still on the old payload does not read as a fixture problem). That id shape
 * is part of the payload contract the Months grid's cell panels already depend on, not a private
 * detail — but it is a coupling, and it is stated here rather than discovered later.
 *
 * ⚠⚠⚠ WHAT THIS SCRIPT DOES **NOT** PROVE, AND WHY THAT MATTERS MORE THAN WHAT IT DOES
 * (`/review`, verification-integrity lens, 2026-08-17 — a **Critical** finding against this file).
 *
 * When it was written, the statement, the grid and the chart were three INDEPENDENT walks of the
 * database, so their agreeing was real evidence. The consolidation this release shipped made them
 * three readings of **one list**. So this script now proves the three feeds are CONSISTENT — it
 * cannot prove they are CORRECT. Mis-date a movement at the root and all three agree on the wrong
 * answer: a July balance charted in May would pass every claim below, green.
 *
 * **The root is guarded elsewhere, and it has to be:** `tests/unit/coach-expense-movements.test.ts`
 * asserts directly that a movement carries the right amount on the right day. That is why
 * `paidMovements` was moved out of the report route into `lib/coach-expense-movements.ts` — a helper
 * inside a route handler is an untestable one.
 *
 * So: this script guards the PLUMBING (a kind of money that reaches only two of the three feeds —
 * which has happened three times), and that unit test guards the ROOT. **Neither is evidence for the
 * other's claim.** A safeguard that quietly got weaker as the code improved is the exact failure this
 * whole project exists to remove, so it is written down here rather than assumed.
 *
 * Needs the dev server running and the UAT coach session present:
 *   npx playwright test --config playwright.config.ts --project=auth-setup
 *
 * Usage:
 *   node scripts/check-money-report-arithmetic.mjs                     the UAT coach fixture's team
 *   node scripts/check-money-report-arithmetic.mjs <orgSlug> <teamId>  any team that session can reach
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
const cents = n => Math.round(Number(n ?? 0) * 100);
const fmt = n => `$${Number(n ?? 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Every figure compared below is held in CENTS; this is the only way one gets printed. */
const money = c => fmt(Number(c ?? 0) / 100);

/**
 * ⚠⚠ THIS SCRIPT IS FOR A LOCAL DEV SERVER, AND IT ENFORCES THAT ITSELF (`/review`, security lens,
 * 2026-08-17).
 *
 * The prod refusal it inherits lives in `resolveUatContext()` — which is only reached when NO org and
 * team are given on the command line. Pass them (the file's own documented usage) and that guard is
 * never called at all, leaving `BASE_URL` free to point anywhere with no check of any kind. The blast
 * radius is small — a GET, with a dev session cookie that would not authenticate elsewhere — but
 * "a dev script refuses production on **every** path" is a standing rule here, and this hole was
 * inherited by copying `check-register-balance.mjs` rather than improving on it.
 *
 * ⚠ IT REQUIRES A LOCAL HOST RATHER THAN BLOCKLISTING A KNOWN PRODUCTION ONE. A blocklist has to be
 * kept current and is wrong the day a hostname changes; "this only ever talks to a dev server" is the
 * actual rule, so it is the one enforced.
 */
function refuseNonLocalTarget(base) {
  let host;
  try {
    host = new URL(base).hostname;
  } catch {
    console.error(`✗ BASE_URL is not a URL: ${base}`);
    process.exit(1);
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') return;
  console.error(`✗ Refusing to run against a non-local server: ${host}`);
  console.error('  This check reads a coach money report with a dev session and is only meaningful');
  console.error('  against a local dev server. Unset BASE_URL, or point it at localhost.');
  process.exit(1);
}

async function main() {
  refuseNonLocalTarget(BASE);

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
  /* ⚠ THE REGISTER RIDES ALONG (2026-08-23, the whole-cash strip). The report's cash strip and the
     register derive the season's cash INDEPENDENTLY from the same records — the exact
     derive-twice-plus-checker pattern `check-register-balance.mjs` runs on register↔money-summary —
     and this script is where the two derivations are held equal, month by month. */
  const api = `${BASE}/api/coaches/${orgSlug}/teams/${teamId}`;
  const [res, regRes] = await Promise.all([
    context.request.get(`${api}/budget-vs-actual`),
    context.request.get(`${api}/register`),
  ]);
  if (!res.ok() || !regRes.ok()) {
    console.error(`✗ Could not read both endpoints (report ${res.status()}, register ${regRes.status()}).`);
    console.error('  Is the dev server up, and is the session stale?');
    await browser.close();
    process.exit(1);
  }
  const data = await res.json();
  const register = await regRes.json();
  await browser.close();

  const grid = data.monthGrid ?? { months: [], categories: [], totals: { cells: [], total: {} } };
  const chart = data.monthlyChart ?? [];
  const details = data.cellDetails ?? {};

  // ── The three claims, as three numbers ─────────────────────────────────────────────────────────
  //
  // ⚠ THE GRID'S CLAIM IS ITS TOTAL, NOT THE SUM OF ITS MONTH CELLS. The grid caps its columns
  // (MAX_MONTH_COLUMNS) and anything dated outside the window lands in a bucket that is inside the
  // row total and inside no cell. Summing cells would make a truncated season look light and blame
  // the wrong feed; the difference is reported separately below.
  const statement = cents(data.totalActual);
  const gridTotal = cents(grid.totals?.total?.actual);
  const gridCells = (grid.totals?.cells ?? []).reduce((s, c) => s + cents(c.actual), 0);
  const chartFinal = chart.length > 0 ? cents(chart[chart.length - 1].cumActual) : 0;

  // ── What the fixture actually contains. A pass over a team without these proves nothing. ───────
  const actualDetails = Object.entries(details)
    .filter(([key]) => key.startsWith('actual|'))
    .flatMap(([key, items]) => items.map(i => ({ ...i, month: key.split('|')[2] })));

  const refundCount = (data.report?.expenses?.categories ?? [])
    .flatMap(c => c.items ?? [])
    .reduce((n, i) => n + (i.refunds?.length ?? 0), 0);

  // A commitment paid across two calendar months: one expense whose halves landed in different
  // months. Grouped by the record BEHIND the halves, so the pair is what is detected, not the words.
  const monthsByRecord = new Map();
  for (const d of actualDetails) {
    const base = String(d.id).replace(/-(deposit|balance|payment-.+)$/, '');
    if (!monthsByRecord.has(base)) monthsByRecord.set(base, new Set());
    monthsByRecord.get(base).add(d.month);
  }
  const splitCommitments = [...monthsByRecord.values()].filter(m => m.size > 1).length;
  const clubRows = actualDetails.filter(d => String(d.id).startsWith('club-')).length;

  console.log(`\nMoney report arithmetic — ${orgSlug} / ${teamId}`);
  console.log(`  months            : ${grid.months?.length ?? 0} grid columns, ${chart.length} charted${grid.truncated ? ' (grid TRUNCATED)' : ''}`);
  console.log(`  money back        : ${refundCount} refund row(s) netting into a cost`);
  console.log(`  split commitments : ${splitCommitments} paid across more than one month`);
  console.log(`  club money        : ${clubRows} row(s) reaching this report`);

  const problems = [];

  // ── 1. The route does not contradict itself ────────────────────────────────────────────────────
  if (cents(data.report?.expenses?.actual) !== statement) {
    problems.push(`the statement's own two totals disagree — section ${fmt(data.report?.expenses?.actual)} vs headline ${fmt(data.totalActual)}`);
  }

  // ── 2. The identity: one season, three feeds ───────────────────────────────────────────────────
  if (gridTotal !== statement) {
    problems.push(
      `THE STATEMENT AND THE MONTHS GRID DISAGREE — ${money(statement)} vs ${money(gridTotal)}`
      + ` (out by ${money(statement - gridTotal)})`);
  }
  if (chartFinal !== statement) {
    problems.push(
      `THE STATEMENT AND THE CHART DISAGREE — ${money(statement)} vs ${money(chartFinal)} at the last point`
      + ` (out by ${money(statement - chartFinal)})`
      + '\n      ⚠ The chart is rendered ABOVE the statement. A coach reads both totals at once.');
  }

  // ── 3. And month by month, not only at the end ─────────────────────────────────────────────────
  // Two wrong months that cancel each other out would pass claim 2 and still put a coach's spending
  // in a month they did not spend it — which is exactly how the split-commitment defect looked.
  const gridByMonth = new Map((grid.months ?? []).map((m, i) => [m, cents(grid.totals?.cells?.[i]?.actual)]));
  const chartByMonth = new Map(chart.map(p => [p.month, cents(p.actualForMonth)]));
  const outsideWindow = [];
  for (const month of [...new Set([...gridByMonth.keys(), ...chartByMonth.keys()])].sort()) {
    if (!gridByMonth.has(month)) { outsideWindow.push(month); continue; }
    const g = gridByMonth.get(month) ?? 0;
    const c = chartByMonth.get(month) ?? 0;
    if (g !== c) {
      problems.push(`${month}: the grid says ${money(g)} and the chart says ${money(c)}`);
    }
  }

  /* ── 4. And category by category, which is what a coach actually reads ──────────────────────────
     A season total can be right while the breakdown under it is wrong, and that is not a hypothesis:
     spending with no category at all used to appear TWICE on the Months grid — the statement called
     the bucket "No category", the grid filed money into "Uncategorized", and a cost and the refund
     netting against it sat under two different headings that never met. The totals still reconciled.

     ⚠ SUMMED BY THE NAME ON SCREEN, not by a key this script re-derives. Two categories may share a
     name (`budget_categories.name` carries no unique index), a coach reading the two views has only
     the name to match them on, and a check that re-implemented the identity rule would be one more
     private copy of the thing this project exists to consolidate. */
  const byName = new Map();
  const bump = (name, side, c) => {
    const key = (name ?? '').trim() || '(no name)';
    if (!byName.has(key)) byName.set(key, { statement: 0, grid: 0 });
    byName.get(key)[side] += c;
  };
  for (const cat of data.report?.expenses?.categories ?? []) bump(cat.categoryName, 'statement', cents(cat.actual));
  for (const cat of grid.categories ?? []) bump(cat.categoryName, 'grid', cents(cat.total?.actual));
  for (const [name, sides] of byName) {
    if (sides.statement !== sides.grid) {
      problems.push(
        `${name}: the statement says ${money(sides.statement)} and Months says ${money(sides.grid)}`
        + ' — one category, two answers, on one screen');
    }
  }

  if (gridCells !== gridTotal) {
    console.log(`  ⚠ ${money(gridTotal - gridCells)} of spending sits outside the grid's month`
      + ' columns (dated beyond the window). In the row totals, in no cell.');
  }

  /* ── 5. THE CASH STRIP IS THE REGISTER, BUCKETED BY MONTH (owner ruling 2026-08-23) ─────────────
     The Actual strip's two maps are assembled from the primitive records inside the report route;
     the register assembles the same season from the same records in its own route. If a source is
     added to one and not the other — which is exactly how payouts and drive money went missing from
     the strip for weeks — the two disagree here, by month and by direction, to the cent.
     ⚠ The register's settled cash rows are the reference: `!scheduled && movesCash` is the set
     whose sum `check:register` already proves IS Cash on hand, so strip = register transitively
     pins the strip's running balance to Cash on hand too. */
  const stripIn = data.moneyIn?.actual ?? {};
  const stripOut = data.moneyOut?.actual ?? {};
  const regRows = (register.book ?? []).filter(r => !r.scheduled && r.movesCash);
  const regIn = new Map();
  const regOut = new Map();
  const undatedSettled = [];
  for (const r of regRows) {
    const m = typeof r.date === 'string' ? r.date.slice(0, 7) : null;
    if (!m) { undatedSettled.push(r.description); continue; }
    if (cents(r.moneyIn) !== 0) regIn.set(m, (regIn.get(m) ?? 0) + cents(r.moneyIn));
    if (cents(r.moneyOut) !== 0) regOut.set(m, (regOut.get(m) ?? 0) + cents(r.moneyOut));
  }
  if (undatedSettled.length > 0) {
    problems.push(`${undatedSettled.length} settled cash row(s) on the register carry no date and can reach no month: ${undatedSettled.slice(0, 3).join(', ')}`);
  }
  for (const [label, strip, reg] of [['Money in', stripIn, regIn], ['Money out', stripOut, regOut]]) {
    const months = [...new Set([...Object.keys(strip), ...reg.keys()])].sort();
    for (const m of months) {
      const s = cents(strip[m]);
      const g = reg.get(m) ?? 0;
      if (s !== g) {
        problems.push(`${m} ${label}: THE STRIP AND THE REGISTER DISAGREE — strip ${money(s)} vs register ${money(g)} (out by ${money(s - g)})`);
      }
      // The Exhibit C ruling, asserted: a month where cash moved has a grid column to land on.
      if (g !== 0 && !gridByMonth.has(m) && !grid.truncated) {
        problems.push(`${m}: cash moved (${label} ${money(g)}) but the grid grew no column for it — the strip is silently dropping it`);
      }
    }
  }
  const stripNet = Object.values(stripIn).reduce((s, v) => s + cents(v), 0)
    - Object.values(stripOut).reduce((s, v) => s + cents(v), 0);
  if (stripNet !== cents(register.cashOnHand)) {
    problems.push(`the strip's season net ${money(stripNet)} is not Cash on hand ${money(cents(register.cashOnHand))} — the running balance ends on the wrong number`);
  }

  if (problems.length > 0) {
    console.error('\n✗ The report tells more than one story about one season:\n');
    for (const p of problems) console.error(`  · ${p}`);
    console.error('\n  ⚠ The statement, the Months grid and the cumulative chart are ONE arithmetic.');
    console.error('    Read the header on lib/coach-budget-rollup.ts before feeding any of them by hand.\n');
    process.exit(1);
  }

  console.log(`\n  statement = Months grid = chart = ${money(statement)}  ✓`);
  console.log(`  and equal in every one of the ${gridByMonth.size} months they share  ✓`);
  console.log(`  and in every one of the ${byName.size} categories a coach can read  ✓`);
  console.log(`  cash strip = register in every month, both directions; net = Cash on hand ${money(cents(register.cashOnHand))}  ✓`);

  /* ══ The two "this run is not evidence" gates. Both exit NON-ZERO. ═════════════════════════════
     ⚠ A SKIPPED CLAIM MUST NEVER READ AS A PASS. These used to be `console.log` notes above a green
     exit (`/review`, 2026-08-17) — which is the precise failure mode this repo has been bitten by
     before: a probe that skipped itself when its fixture was missing, and a skip reports green. */

  // 1. Months the grid never had a column for. The chart has no column cap; the grid does, so a
  //    single mis-typed year can push the range past it and truncate the tail. The per-month claim
  //    genuinely cannot be made for those months — so it is not made, out loud.
  if (outsideWindow.length > 0) {
    console.error(`\n⚠ THE PER-MONTH CLAIM IS UNPROVEN for ${outsideWindow.length} month(s) the chart`
      + ` shows and the grid has no column for: ${outsideWindow.join(', ')}`);
    console.error('\n  The grid caps its columns; the chart does not. A divergence inside those months');
    console.error('  would be invisible to this run, and the season totals can still reconcile around it.');
    console.error(`  Grid columns: ${grid.months?.length ?? 0}${grid.truncated ? ' (TRUNCATED)' : ''}.`);
    console.error('  Usually this means a record carries a mis-typed year — find it rather than widening');
    console.error('  the cap.\n');
    process.exit(2);
  }

  // 2. A fixture that cannot disagree. An identity that cannot fail here has not been tested.
  const missing = [];
  if (refundCount === 0) missing.push('money back netting into a cost (the chart used not to net it)');
  if (splitCommitments === 0) missing.push('a commitment paid across two months (the chart and the statement put both halves in the earlier one)');
  if (clubRows === 0) missing.push('club money on the report (it reached two feeds of three)');
  /* The strip↔register identity (claim 5) has its own breaking shapes — each is a source that WAS
     missing from the strip, or a spend the strip must exclude. A fixture without them cannot fail
     the claim, so a green run over one is not evidence. Detected on the REGISTER's rows: caveat 4's
     lesson applies — if a detector reads empty, the code may have stopped emitting the row. */
  if (!regRows.some(r => String(r.id).startsWith('dues-payout-'))) {
    missing.push('a dues payout (cash back to a family — absent from the strip until 2026-08-23)');
  }
  if (!regRows.some(r => r.kind === 'fundraising')) {
    missing.push('realised fundraising cash (drive/sponsor money — absent from the strip until 2026-08-23)');
  }
  if (!(register.book ?? []).some(r => !r.scheduled && !r.movesCash)) {
    missing.push('a family-paid-direct cost (spending that moves no cash — the strip must EXCLUDE it)');
  }
  if (missing.length > 0) {
    console.error('\n⚠ THIS RUN PROVES LESS THAN IT LOOKS LIKE. This report shows no:');
    for (const m of missing) console.error(`  · ${m}`);
    console.error('\n  Those three shapes are the only ways this identity has ever broken. Without them the');
    console.error('  three feeds cannot disagree and a pass is not evidence.');
    /* ⚠⚠ TWO CAUSES, AND THE SECOND ONE IS THE DANGEROUS READ (`/review`, 2026-08-17). These
       detectors read the payload the code under test produced, so a REGRESSION can erase its own
       evidence: if `paidMovements` went back to merging a commitment's payments, the per-payment
       rows would vanish and this would report "no commitment paid across two months" — which reads
       like a fixture problem. Reseeding would not help, because the same record would be merged
       again. Said here so nobody spends an afternoon on the wrong half. */
    console.error('\n  TWO possible causes, and they need opposite fixes:');
    console.error('   a) the fixture genuinely lacks the shape  → node scripts/seed-uat-coach-fixture.mjs');
    console.error('   b) the CODE stopped producing it, so the evidence disappeared with the behaviour.');
    console.error('      Check tests/unit/coach-expense-movements.test.ts first: if a commitment');
    console.error('      stopped splitting into one dated movement per payment, (a) can never succeed.\n');
    process.exit(2);
  }
  console.log('\n✓ All three breaking shapes present — the identity holds where it can actually fail.');
  console.log('  ⚠ This proves the three feeds AGREE. That a movement is dated correctly in the first');
  console.log('    place is a different claim — tests/unit/coach-expense-movements.test.ts owns it.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
