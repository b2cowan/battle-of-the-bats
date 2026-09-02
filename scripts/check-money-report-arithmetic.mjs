/**
 * THE MONEY REPORT'S BUILD-BLOCKING CLAIMS — and, since the Option D merge (owner ruling
 * 2026-08-23), **there are now TWO reports on this screen and they answer to two different
 * authorities.** That split is the most important thing in this file, so it is first.
 *
 *   · the **STATEMENT** and the **CUMULATIVE CHART** are the season's SPENDING, report-basis:
 *     money back nets into the cost it repaid, and a cost a family paid a vendor directly counts,
 *     because the season really did spend it. They must agree with each other. (Claims 1–2.)
 *
 *   · the **MONTHS GRID** — two bands now, REVENUE and EXPENSES — is the season's **CASH**: gross
 *     both directions, team-cash only, and it must agree with the **REGISTER**, which is the book
 *     `check:register` already proves IS Cash on hand. (Claims 3–6.)
 *
 * ⚠⚠ THE GRID USED TO BE HELD EQUAL TO THE STATEMENT, AND THAT CLAIM IS DELIBERATELY GONE. It was
 * true while Months was a spending grid. The owner's ruling made it a cash statement, which means a
 * per-category figure here can legitimately differ from the statement's — by refunds, by payouts,
 * by family-paid costs. **Two labelled truths, one guard each.** Re-adding "statement = grid" would
 * not catch a defect; it would fail on every team that has ever been refunded a dollar. What
 * replaces it is stronger, because the register is an independent walk of the same records rather
 * than a second reading of one list (see the note on claim 3).
 *
 * Budget vs. Actual answers "what did we actually spend?" in two places a coach reads together —
 * the statement and the cumulative chart rendered directly above it. Until 2026-08-17 each one
 * walked the raw records itself, and nothing connected them:
 *
 *   · the chart never netted money back, so a $500 hire with $200 refunded read $500 there and
 *     $300 six inches below it;
 *   · a commitment paid in two instalments arrived as ONE payment dated by the earlier one, so the
 *     chart and the statement's own payment schedule put a July balance in April;
 *   · club money reached two of the three and was silently absent from the third.
 *
 * ⚠ WHY THIS IS A SCRIPT AND NOT A UNIT TEST. The arithmetic is unit-tested several times over
 * (`tests/unit/coach-budget-rollup.test.ts`, `coach-budget-months.test.ts`, `coach-cash-strip.test.ts`).
 * What no unit test can check is that ONE ROUTE, assembling one payload from one database, hands
 * its feeds the same money. A kind of money added to one and not another produces no error and no
 * failing test — just a screen that reads low. Same reason, same shape as
 * `scripts/check-register-balance.mjs`.
 *
 * ⚠⚠ AND IT MUST RUN AGAINST A FIXTURE THAT COULD ACTUALLY DISAGREE. A team with no refund and no
 * commitment paid across two months cannot fail the report claims — the identity was already true
 * for those rows — so a green run over one proves nothing. Every shape that has ever broken one of
 * these claims is required, named on every run, and its absence exits non-zero.
 *
 * ⚠ IT READS THE DRILL-IN's ROW IDS to find a split commitment (`<expenseId>-payment-<paymentId>`
 * since the Payables Rebuild, `<expenseId>-deposit`/`-balance` before it — both are recognised, so a
 * run against a database still on the old payload does not read as a fixture problem). That id shape
 * is part of the payload contract the Months grid's cell panels already depend on, not a private
 * detail — but it is a coupling, and it is stated here rather than discovered later.
 *
 * ⚠⚠⚠ WHAT THIS SCRIPT DOES **NOT** PROVE, AND WHY THAT MATTERS MORE THAN WHAT IT DOES
 * (`/review`, verification-integrity lens, 2026-08-17 — a **Critical** finding against this file;
 * re-stated for the two-report split below, because the answer is now different for each half).
 *
 * **The statement and the chart are two readings of ONE list** (`actualMovements`). Their agreeing
 * proves the plumbing — that a kind of money reaches both feeds — and cannot prove either is
 * CORRECT. Mis-date a movement at the root and both agree on the wrong answer.
 * ⚠ AND THE MONTH-BY-MONTH CROSS-CHECK ON THAT PAIR IS GONE, because the grid — the only other
 * report-basis feed with months in it — became cash. The chart's per-month figures are now guarded
 * ONLY by `tests/unit/coach-expense-movements.test.ts`, which asserts directly that a movement
 * carries the right amount on the right day. That is a real reduction in coverage and it is written
 * here rather than left to be discovered.
 *
 * **The grid and the register are two INDEPENDENT walks of the same records**, in two routes, and
 * that is why claims 3–6 are worth more than the ones they replaced. But they still cannot prove a
 * dating RULE is right — both routes read `lib/coach-cash-strip.ts`'s rules and the register's own
 * assembly, and if the two apply the same wrong rule they agree. The roots are guarded separately:
 * `tests/unit/coach-cash-strip.test.ts` pins every inclusion and dating rule individually, and
 * `coach-expense-movements.test.ts` pins the payment dates underneath them.
 *
 * **Neither is evidence for the other's claim.** A safeguard that quietly got weaker as the code
 * improved is the exact failure this whole project exists to remove, so it is written down here
 * rather than assumed.
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
/**
 * ⚠⚠ THE BAND VOCABULARY IS IMPORTED, NOT RETYPED (`/simplify`, 2026-08-23). This script had a
 * hand-copied `'Paid back to families'` and its own regex for reading a revenue group off a
 * category key — and the regex only understood ONE of the two spellings that key legitimately has,
 * so a group arriving in the other form would have been silently classified as a nonsense group and
 * the run would still have gone green. A guard that can quietly stop checking the thing it names is
 * worse than no guard.
 *
 * ⚠ THE LINE THIS DOES NOT CROSS: vocabulary and identity may be shared; ARITHMETIC never is. The
 * whole worth of this script is that the report and the register derive the season's cash
 * independently, so importing either one's summing would make it check itself.
 */
import { PAYOUT_CATEGORY_NAME, revenueGroupOf } from '../lib/coach-budget-months.ts';
// Each name from the module that OWNS it — the rollup decides what a nameless category is called.
import { NO_CATEGORY_LABEL } from '../lib/coach-budget-rollup.ts';

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
  /* ⚠ THE REGISTER IS NOW THE GRID'S ANCHOR, not a passenger (Option D, 2026-08-23). The Months
     bands and the register derive the season's cash INDEPENDENTLY from the same records, in two
     routes — the exact derive-twice-plus-checker pattern `check-register-balance.mjs` runs on
     register↔money-summary — and this script is where the two derivations are held equal. */
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

  const blank = { months: [], categories: [], totals: { cells: [], total: {}, undated: {} } };
  const grid = data.monthGrid ?? blank;      // the EXPENSES band — cash paid to VENDORS
  const revenue = data.revenueGrid ?? blank; // the REVENUE band
  /* ⚠⚠ THE RETURNED BAND — money handed back to families (owner ruling 2026-09-02). It left
     `monthGrid` for a band of its own, so **every claim below that means "cash out" now reads BOTH**.
     Miss one and the check does not fail: it passes, understated by exactly the cheques a team wrote
     to its families, which is the shape of bug this file exists to catch.

     ⚠⚠ AND AN ABSENT BAND IS A FAILURE, NOT AN EMPTY ONE. This is the `openingBalance` lesson
     applied before it can be learned twice (see claim 6): `?? blank` here would turn "the route
     stopped emitting the band" into "the team returned nothing", and every claim would go green
     while the money it forgot sat in the register. A season that returned nothing still ships the
     band with no categories in it. */
  /* ⚠ THE TEST IS FOR A USABLE BAND, NOT MERELY A PRESENT KEY (review, 2026-09-02). `undefined`
     alone was the obvious check and it is the narrower one: every read below is optional-chained,
     so a route emitting `{}` — or any object that lost its `totals` — would clear an
     absence-only guard and then resolve to a silent zero at each site. That is the same failure
     this guard exists to stop, arriving through a different door. (`null` already throws on the
     direct `returned.totals` reads and exits non-zero, so it needs no case of its own.) */
  if (data.returnedGrid === undefined || data.returnedGrid?.totals?.total === undefined) {
    console.error('\n✗ THE REPORT NO LONGER SAYS WHAT THE SEASON HANDED BACK TO FAMILIES.');
    console.error('  returnedGrid is absent from the payload (owner ruling 2026-09-02). A season that');
    console.error('  returned nothing still ships an empty band — absent means the route stopped');
    console.error('  emitting it, and every cash claim below would silently assume zero.\n');
    process.exit(1);
  }
  const returned = data.returnedGrid;
  /** Cash out is the two bands together — the identity every claim below depends on. */
  const cashOutCell = i => cents(grid.totals?.cells?.[i]?.actual) + cents(returned.totals?.cells?.[i]?.actual);
  const cashOutTotal = () => cents(grid.totals?.total?.actual) + cents(returned.totals?.total?.actual);
  const chart = data.monthlyChart ?? [];
  const details = data.cellDetails ?? {};

  const statement = cents(data.totalActual);
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
  /* ⚠ THE RETURNED BAND IS NAMED ON EVERY RUN, not only when it has something in it. This file's own
     principle is that a claim nobody can see reads like one that did not happen — and this band is
     the newest place a cash claim can silently lose money, so "0 row(s)" is information. */
  console.log(`  bands             : ${revenue.categories?.length ?? 0} revenue group(s), ${grid.categories?.length ?? 0} expense category(ies), ${returned.categories?.length ?? 0} returned-to-families group(s)`);
  console.log(`  money back        : ${refundCount} refund row(s) netting into a cost`);
  console.log(`  split commitments : ${splitCommitments} paid across more than one month`);
  console.log(`  club money        : ${clubRows} row(s) reaching this report`);

  const problems = [];

  // ══ THE REPORT SIDE — statement and chart, one basis ═══════════════════════════════════════════

  // ── 1. The route does not contradict itself ────────────────────────────────────────────────────
  if (cents(data.report?.expenses?.actual) !== statement) {
    problems.push(`the statement's own two totals disagree — section ${fmt(data.report?.expenses?.actual)} vs headline ${fmt(data.totalActual)}`);
  }

  // ── 2. The statement and the chart are one season ──────────────────────────────────────────────
  if (chartFinal !== statement) {
    problems.push(
      `THE STATEMENT AND THE CHART DISAGREE — ${money(statement)} vs ${money(chartFinal)} at the last point`
      + ` (out by ${money(statement - chartFinal)})`
      + '\n      ⚠ The chart is rendered ABOVE the statement. A coach reads both totals at once.');
  }
  /* And the chart's own months sum to its last point — a cheap internal check that survived the
     loss of the grid as its per-month partner. It catches a point added to the cumulative series
     without its monthly figure, which is the shape a new kind of money takes here. */
  const chartMonthSum = chart.reduce((s, p) => s + cents(p.actualForMonth), 0);
  if (chart.length > 0 && chartMonthSum !== chartFinal) {
    problems.push(`the chart's months add to ${money(chartMonthSum)} and its last cumulative point is ${money(chartFinal)}`);
  }

  // ══ THE CASH SIDE — both bands against the register ════════════════════════════════════════════
  /* ⚠ The register's settled cash rows are the reference: `!scheduled && movesCash` is the set whose
     sum `check:register` already proves IS Cash on hand, so band = register transitively pins the
     running balance to Cash on hand too. */
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

  /* ── 3. EVERY BAND CELL, MONTH BY MONTH, IS THE REGISTER'S SETTLED CASH ────────────────────────
     The load-bearing claim. Two wrong months that cancel out would pass a season total and still
     put a coach's money in a month it did not move — which is exactly how the split-commitment
     defect looked. ⚠ Compared on the band's own `Total revenue` / `Total expenses` cells, because
     that is the row a coach reads and the row `Net for the month` is computed from. */
  /* ⚠ THE OUT SIDE IS BOTH BANDS (2026-09-02). `Total expenses` is cash paid to vendors and
     `Total returned` is cash paid to families; the register knows only that money left. Comparing
     the expenses band alone would fail on any season with a payout — and worse, comparing it alone
     with the payout still inside would have been the silent version of the same mistake. */
  const bandByMonth = (g, i) => (g === 'out' ? cashOutCell(i) : cents(g.totals?.cells?.[i]?.actual));
  const gridMonthIndex = new Map((grid.months ?? []).map((m, i) => [m, i]));
  const outsideWindow = [];
  for (const [label, band, reg] of [['Total revenue', revenue, regIn], ['Total expenses + Total returned', 'out', regOut]]) {
    for (const m of [...new Set([...gridMonthIndex.keys(), ...reg.keys()])].sort()) {
      const i = gridMonthIndex.get(m);
      if (i === undefined) {
        // The Exhibit C ruling, asserted: a month where cash moved has a grid column to land on.
        if ((reg.get(m) ?? 0) !== 0 && !grid.truncated) {
          problems.push(`${m}: cash moved (${label} ${money(reg.get(m))}) but the grid grew no column for it — the band is silently dropping it`);
        } else if (!outsideWindow.includes(m)) outsideWindow.push(m);
        continue;
      }
      const b = bandByMonth(band, i);
      const g = reg.get(m) ?? 0;
      if (b !== g) {
        problems.push(`${m} ${label}: THE BAND AND THE REGISTER DISAGREE — grid ${money(b)} vs register ${money(g)} (out by ${money(b - g)})`);
      }
    }
  }

  /* ── 4. AND CATEGORY BY CATEGORY, which is what a coach actually reads ─────────────────────────
     A season total can be right while the breakdown under it is wrong, and that is not a
     hypothesis: spending with no category at all used to appear TWICE on the Months grid, under two
     headings that never met, with the totals still reconciling.

     ⚠ SUMMED BY THE NAME ON SCREEN, not by a key this script re-derives. Two categories may share a
     name (`budget_categories.name` carries no unique index), a coach reading two views has only the
     name to match them on, and a check that re-implemented the identity rule would be one more
     private copy of the thing this project exists to consolidate.

     ⚠ THE REGISTER SIDE MAPS ITS KINDS ONTO THE BANDS. A dues PAYOUT carries no category and is the
     grid's own "Paid back to families" group; everything else that moved cash out is filed by name. */
  const expenseByName = new Map();
  const bumpExpense = (name, side, c) => {
    const key = (name ?? '').trim() || NO_CATEGORY_LABEL;
    if (!expenseByName.has(key)) expenseByName.set(key, { grid: 0, register: 0 });
    expenseByName.get(key)[side] += c;
  };
  /* ⚠ BOTH OUT-BANDS (2026-09-02). The register files a dues payout under the payouts group's own
     name; that group now lives in the returned band, so reading only `grid.categories` would leave
     it with a register figure and no grid figure — a real failure reported as a missing category. */
  for (const cat of [...(grid.categories ?? []), ...(returned.categories ?? [])]) {
    bumpExpense(cat.categoryName, 'grid', cents(cat.total?.actual));
  }
  for (const r of regRows) {
    const out = cents(r.moneyOut);
    if (out === 0) continue;
    bumpExpense(r.kind === 'dues' ? PAYOUT_CATEGORY_NAME : r.categoryName, 'register', out);
  }
  for (const [name, sides] of expenseByName) {
    if (sides.grid !== sides.register) {
      problems.push(
        `${name}: the Months grid says ${money(sides.grid)} of cash out and the register says ${money(sides.register)}`
        + ' — one category, two answers');
    }
  }

  /* ── 5. AND THE REVENUE BAND, GROUP BY GROUP ───────────────────────────────────────────────────
     ⚠ DRIVES AND SPONSORS ARE CHECKED TOGETHER, and that is a stated limit rather than an oversight:
     the register's fundraising rows carry the drive's NAME and not its kind, so this script cannot
     tell a bottle drive from a sponsor cheque without re-deriving the split it is meant to be
     checking. The two groups are summed on the grid side to match. Which of the two a dollar lands
     in is pinned by `tests/unit/coach-cash-strip.test.ts` instead. */
  const REV_GROUP_OF_KIND = { dues: 'dues', fundraising: 'fundraising+sponsorship', income: 'other', refund: 'moneyback', club: 'moneyback' };
  const GRID_GROUP_MERGE = { fundraising: 'fundraising+sponsorship', sponsorship: 'fundraising+sponsorship' };
  const revByGroup = new Map();
  const bumpRev = (group, side, c) => {
    if (!revByGroup.has(group)) revByGroup.set(group, { grid: 0, register: 0 });
    revByGroup.get(group)[side] += c;
  };
  for (const cat of revenue.categories ?? []) {
    /* ⚠ THROUGH THE LIB'S OWN READER. A hand-rolled prefix strip here understood only one of the
       two spellings a revenue key legitimately has, so the other would have been filed under a
       group name that matches nothing on the register side — and the loop below compares only the
       groups it FINDS, so the run would have passed while checking nothing. */
    const group = revenueGroupOf(cat.categoryKey);
    if (!group) {
      problems.push(`a revenue band row (${cat.categoryName}) carries no recognisable group key — the guard cannot classify it`);
      continue;
    }
    bumpRev(GRID_GROUP_MERGE[group] ?? group, 'grid', cents(cat.total?.actual));
  }
  for (const r of regRows) {
    const inc = cents(r.moneyIn);
    if (inc === 0) continue;
    bumpRev(REV_GROUP_OF_KIND[r.kind] ?? r.kind, 'register', inc);
  }
  for (const [group, sides] of revByGroup) {
    if (sides.grid !== sides.register) {
      problems.push(
        `revenue · ${group}: the Months grid says ${money(sides.grid)} and the register says ${money(sides.register)}`
        + ' — one source of money, two answers');
    }
  }

  /* ── 6. THE THREE BOTTOM ROWS PROVE EACH OTHER (owner ruling 2026-08-23) ───────────────────────
     Opening + the season's net = the ending balance = Cash on hand. The screen shows the same
     number three ways on purpose; if they can differ, the report cannot prove itself. */
  const bandTotal = g => cents(g.totals?.total?.actual);
  /* ⚠⚠ AND THE OPENING BALANCE IS NOW READ BY NAME, WITH NO `?? 0` HABIT ANYWHERE NEAR IT (mig 262,
     2026-08-25). This is the change the comment that stood here demanded, and its history is kept
     because the trap is an easy one to walk back into.

     It used to be `const opening = 0`. A draft before THAT wrote `cents(data.openingBalance ?? 0)`
     against a route that emitted no such field — which reads like evidence and is not: the `??`
     silently made it a hardcoded zero wearing a live check's clothes (`/review`,
     verification-integrity + correctness lenses, 2026-08-23, found independently by both). Zero was
     CORRECT while no season could carry a balance, so the claim was true — and would have stayed
     "true" the day carry-forward shipped under any other field name, passing quietly while off by
     exactly the carried amount.

     ⚠⚠ SO A MISSING FIELD IS A FAILURE, NOT A ZERO. `undefined` means the route stopped emitting it,
     and this run stops rather than proving an identity about a season it can no longer see the
     opening balance of. `null` is a real answer and means "nothing was carried". */
  if (data.openingBalance === undefined) {
    console.error('\n✗ THE REPORT NO LONGER SAYS WHAT THE SEASON OPENED WITH.');
    console.error('  openingBalance is absent from the payload (mig 262). It is null when nothing was');
    console.error('  carried and a number when something was — absent means the route stopped emitting');
    console.error('  it, and every claim below would silently assume zero.\n');
    process.exit(1);
  }
  const opening = cents(data.openingBalance ?? 0);
  /* ⚠ CASH OUT IS BOTH OUT-BANDS. The returned band left `Total expenses` and did not leave the
     season: a cheque to a family is money out of the account exactly as a cheque to a vendor is. */
  const seasonNet = bandTotal(revenue) - cashOutTotal();
  const ending = opening + seasonNet;
  if (ending !== cents(register.cashOnHand)) {
    problems.push(
      `the bands end on ${money(ending)} and Cash on hand is ${money(cents(register.cashOnHand))}`
      + ` — opening ${money(opening)} + net ${money(seasonNet)} is where the Running balance's Total cell lands`);
  }
  if (cents(data.cashOnHand) !== cents(register.cashOnHand)) {
    problems.push(
      `the report's own Cash on hand (${money(cents(data.cashOnHand))}) is not the register's`
      + ` (${money(cents(register.cashOnHand))}) — the Scheduled lens projects from the wrong starting money`);
  }

  /* ── 6a. A GROUP IS WHAT ITS ROWS ADD UP TO, IN EVERY MONTH (D-2, owner ruling 2026-08-24) ────
     Every revenue figure now OPENS: a group's chevron shows the families, drives, sponsors and
     requests behind it, and tapping a figure lists the records. Those rows are a second grain of the
     same money — so if they can disagree with the total above them, the drill-in is a screen that
     contradicts the report it is part of, and every claim above would still pass.

     ⚠ THE MONTH IS THE UNIT, not the season. Season totals reconcile around a dollar filed in the
     wrong month, which is the exact defect this whole file exists to catch elsewhere.

     ⚠ ORPHANS ARE THE ONE HONEST GAP AND IT IS ONE-DIRECTIONAL. Money whose subject has no row —
     unattributable arrivals, a family removed from the roster mid-season — is added at the CATEGORY
     level by the builder rather than dropped, so rows may legitimately sum to LESS than their group.
     They may never sum to more: that is money counted twice. */
  for (const [bandName, g] of [['revenue', revenue], ['expenses', grid], ['returned', returned]]) {
    for (const cat of g.categories ?? []) {
      const rows = cat.lines ?? [];
      if (rows.length === 0) continue;
      (g.months ?? []).forEach((m, i) => {
        const group = cents(cat.cells?.[i]?.actual);
        const summed = rows.reduce((s, r) => s + cents(r.cells?.[i]?.actual), 0);
        if (summed > group) {
          problems.push(
            `${bandName} · ${cat.categoryName} in ${m}: its rows add up to ${money(summed)} but the`
            + ` group says ${money(group)} — a drill-in that counts money the total above it does not`);
        }
      });
      const totalRows = rows.reduce((s, r) => s + cents(r.total?.actual), 0);
      if (totalRows > cents(cat.total?.actual)) {
        problems.push(
          `${bandName} · ${cat.categoryName}: its rows total ${money(totalRows)} against a group total`
          + ` of ${money(cents(cat.total?.actual))}`);
      }
    }
  }

  /* ── 6b. THE BRIDGE BETWEEN THE TWO TOTALS ACTUALLY BRIDGES THEM ──────────────────────────────
     The Statement now explains its own gap to Months (owner ruling 2026-08-24): what the season
     spent, plus money back, less costs a family paid the vendor, plus money paid back to families,
     equals the cash that left. That is arithmetic shown to a board — so it is checked, not trusted.

     ⚠ THIS IS THE CLAIM THE SCREEN MAKES, NOT A RESTATEMENT OF ONE ABOVE. Claims 3–5 hold each view
     against the register separately; neither notices if the SENTENCE joining them is wrong. A
     bridge that does not add up is worse than no bridge: it looks like a proof. */
  const familyPaid = (data.familyPaidCosts ?? []).reduce((s, c) => s + cents(c.amount), 0);
  const moneyBackNetted = (data.report?.expenses?.categories ?? [])
    .flatMap(c => c.items ?? []).reduce((s, i) => s + cents(i.refundTotal), 0);
  /* ⚠ THE RETURNED BAND'S OWN TOTAL (2026-09-02). This filtered the EXPENSES band for the payouts
     group until that group became a band — a filter that now matches nothing, so the bridge would
     have balanced only for teams that never handed a family money back, and been wrong by exactly
     the amount it exists to explain for every team that did. */
  /* ⚠⚠ AND STATE WHAT THIS CLAIM DOES *NOT* PROVE, because a reader will assume it does.
     `payoutsOut` appears on BOTH sides of the comparison below — it is added to the statement here
     and is one of the two summands of `cashOutTotal()` — so it cancels, and this identity says
     nothing about whether the returned band's own figure is right. **That was equally true before
     the band existed** (it read the payouts group out of the very grid it was checking), so the
     split changed nothing here; it is written down now because payouts became a first-class band
     and the omission would otherwise look like one this change introduced.
     What DOES constrain that figure: claims 3 and 4, which hold the returned band against the
     REGISTER — assembled by lib/coach-register-book.ts, which does not go through the cash strip.
     Two derivations, one comparison. Do not "fix" this claim by removing the cancelling term:
     the identity it states is the one the Statement prints, and that sentence is what it guards. */
  const payoutsOut = cents(returned.totals?.total?.actual);
  const bridged = statement + moneyBackNetted - familyPaid + payoutsOut;
  if (bridged !== cashOutTotal()) {
    problems.push(
      `THE STATEMENT'S BRIDGE TO MONTHS DOES NOT ADD UP — ${money(statement)} spent`
      + ` + ${money(moneyBackNetted)} money back − ${money(familyPaid)} family-paid`
      + ` + ${money(payoutsOut)} paid back = ${money(bridged)}, but Months says`
      + ` ${money(cashOutTotal())} (out by ${money(bridged - cashOutTotal())})`);
  }

  /* ── 7. AND THE STRIP'S OWN MONTH MAPS, WHICH ARE A SECOND CLAIM RATHER THAN A DUPLICATE ───────
     Claim 3 compares what the grid PLACED; this compares what the cash arithmetic DATED, before the
     grid touched it. A single claim could not tell a mis-dated dollar from a dropped one. */
  const stripIn = data.cash?.in ?? {};
  const stripOut = data.cash?.out ?? {};
  for (const [label, strip, reg] of [['Money in', stripIn, regIn], ['Money out', stripOut, regOut]]) {
    for (const m of [...new Set([...Object.keys(strip), ...reg.keys()])].sort()) {
      const s = cents(strip[m]);
      const g = reg.get(m) ?? 0;
      if (s !== g) {
        problems.push(`${m} ${label}: THE CASH ARITHMETIC AND THE REGISTER DISAGREE — ${money(s)} vs ${money(g)} (out by ${money(s - g)})`);
      }
    }
  }

  if (problems.length > 0) {
    console.error('\n✗ The report tells more than one story about one season:\n');
    for (const p of problems) console.error(`  · ${p}`);
    console.error('\n  ⚠ TWO REPORTS, TWO AUTHORITIES: the statement and the chart are the season’s');
    console.error('    SPENDING and answer to each other; the Months bands are its CASH and answer to');
    console.error('    the register. Read the header on this file before "fixing" one with the other.\n');
    process.exit(1);
  }

  console.log(`\n  statement = chart = ${money(statement)}  ✓`);
  console.log(`  both bands = the register in every one of the ${gridMonthIndex.size} months they share  ✓`);
  console.log(`  and in every one of the ${expenseByName.size} expense categories and ${revByGroup.size} revenue group(s)  ✓`);
  console.log(`  opening ${money(opening)} + net ${money(seasonNet)} = Cash on hand ${money(cents(register.cashOnHand))}  ✓`);
  /* ⚠ CLAIM 7 GETS ITS OWN LINE. It runs, and it fails loudly — but it printed nothing on a green
     run, and on this file's own stated principle a claim nobody can see reads like one that did not
     happen. Every claim that executes says so. */
  console.log(`  and the cash arithmetic dated every dollar the way the register did  ✓`);
  console.log('  every group equals the rows a coach can open behind it, month by month  ✓');
  console.log(`  the Statement's bridge to Months adds up: ${money(statement)} spent → ${money(cashOutTotal())} in cash  ✓`);

  /* ══ The two "this run is not evidence" gates. Both exit NON-ZERO. ═════════════════════════════
     ⚠ A SKIPPED CLAIM MUST NEVER READ AS A PASS. These used to be `console.log` notes above a green
     exit (`/review`, 2026-08-17) — which is the precise failure mode this repo has been bitten by
     before: a probe that skipped itself when its fixture was missing, and a skip reports green. */

  // 1. Months the grid never had a column for. The chart has no column cap; the grid does, so a
  //    single mis-typed year can push the range past it and truncate the tail. The per-month claim
  //    genuinely cannot be made for those months — so it is not made, out loud.
  if (outsideWindow.length > 0) {
    console.error(`\n⚠ THE PER-MONTH CLAIM IS UNPROVEN for ${outsideWindow.length} month(s) the register`
      + ` shows and the grid has no column for: ${outsideWindow.join(', ')}`);
    console.error('\n  The grid caps its columns; the register does not. A divergence inside those months');
    console.error('  would be invisible to this run, and the season totals can still reconcile around it.');
    console.error(`  Grid columns: ${grid.months?.length ?? 0}${grid.truncated ? ' (TRUNCATED)' : ''}.`);
    console.error('  Usually this means a record carries a mis-typed year — find it rather than widening');
    console.error('  the cap.\n');
    process.exit(2);
  }

  // 2. A fixture that cannot disagree. An identity that cannot fail here has not been tested.
  const missing = [];
  if (refundCount === 0) missing.push('money back netting into a cost (the chart used not to net it; the cash bands now show it as REVENUE, so it is the clearest two-truths shape there is)');
  if (splitCommitments === 0) missing.push('a commitment paid across two months (the chart and the statement put both halves in the earlier one)');
  if (clubRows === 0) missing.push('club money on the report (it reached two feeds of three)');
  /* The cash claims have their own breaking shapes — each is a source that WAS missing from the
     bands, or a spend they must exclude. A fixture without them cannot fail the claim, so a green
     run over one is not evidence. Detected on the REGISTER's rows: caveat 4's lesson applies — if a
     detector reads empty, the code may have stopped emitting the row. */
  if (!regRows.some(r => String(r.id).startsWith('dues-payout-'))) {
    missing.push('a dues payout (cash back to a family — its own BAND, below Expenses)');
  }
  if (!regRows.some(r => r.kind === 'fundraising')) {
    missing.push('realised fundraising cash (drive/sponsor money — a REVENUE group)');
  }
  if (!(register.book ?? []).some(r => !r.scheduled && !r.movesCash)) {
    missing.push('a family-paid-direct cost (spending that moves no cash — the bands must EXCLUDE it)');
  }
  /* ⚠⚠ THE FORWARD VIEW'S OWN SHAPES (Option D, 2026-08-23). The Scheduled lens puts a sponsor
     PLEDGE and a club request awaiting an answer in the "No date yet" column — in the Total and in
     no month. Neither reaches a settled figure, so nothing above can fail on their account; that is
     exactly why their absence has to be said out loud rather than passing quietly. */
  const forward = (register.book ?? []).filter(r => r.scheduled);
  if (!forward.some(r => r.kind === 'fundraising' && r.date === null)) {
    missing.push('a sponsor PLEDGE (undated forward money — the Scheduled lens cannot be read without one)');
  }
  /* ⚠ MATCHED ON THE ROW'S ID, NOT ON "undated club row" (`/review`, 2026-08-23). An unpaid
     ALLOCATION INSTALMENT with no due date wears the identical shape — scheduled, kind `club`, no
     date — and reaches this report through a completely different path that never touches the
     revenue band. The loose test would have reported the pending-request shape as PRESENT while the
     thing it names was absent or regressed, which is the fixture-vs-code ambiguity this whole
     block exists to keep out. */
  if (!forward.some(r => r.kind === 'club' && r.date === null && String(r.id).startsWith('request-'))) {
    missing.push('a club request awaiting an answer (the other undated forward row)');
  }
  /* ⚠⚠ AND A SEASON THAT CARRIED MONEY FORWARD (mig 262). Claim 6 reads the real opening balance
     now — but over a season that opened at nothing, `opening` is zero and the claim is arithmetically
     identical to the one it replaced. It CANNOT FAIL on such a fixture, so a green run over one is
     not evidence that the carry reaches Cash on hand, the register and this report together. That is
     precisely the pair the ruling warned would argue.
     ⚠ THIS IS A REAL COVERAGE GAP UNTIL THE FIXTURE CARRIES ONE — said out loud, exiting non-zero,
     rather than noted above a green exit. A skipped claim must never read as a pass. */
  if (!(cents(data.openingBalance ?? 0) !== 0)) {
    missing.push(
      'an OPENING BALANCE carried from a previous season (mig 262) — with none, claim 6 adds zero and'
      + ' cannot tell whether the carry reaches the register and Cash on hand at all');
  }
  /* ⚠ AND ROWS BEHIND THE REVENUE FIGURES (D-2). Claim 6a is a comparison between two grains; a
     season whose groups have no rows compares a figure against nothing and passes every time. */
  if (!(revenue.categories ?? []).some(c => (c.lines ?? []).length > 0)) {
    missing.push(
      'a revenue group with ROWS behind it (the families, drives or sponsors D-2 opens to) — without'
      + ' one, the group-equals-its-rows claim compares a figure against an empty list');
  }

  if (missing.length > 0) {
    console.error('\n⚠ THIS RUN PROVES LESS THAN IT LOOKS LIKE. This report shows no:');
    for (const m of missing) console.error(`  · ${m}`);
    console.error('\n  Those are the only ways these identities have ever broken. Without them the');
    console.error('  feeds cannot disagree and a pass is not evidence.');
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
  console.log('\n✓ Every breaking shape present — the identities hold where they can actually fail.');
  console.log('  ⚠ This proves the feeds AGREE. That a movement is dated correctly in the first place');
  console.log('    is a different claim — tests/unit/coach-cash-strip.test.ts and');
  console.log('    coach-expense-movements.test.ts own it.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
