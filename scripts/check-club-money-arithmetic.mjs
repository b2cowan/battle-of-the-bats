/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S MONEY FIGURES, RECOMPUTED FROM ROWS (Club Tier Stage 3a — `check:club-money-arithmetic`).
 *
 * The club side had no arithmetic gate (plan §4C: "Nothing tests ledger summaries, hub totals, …");
 * the coach side has two (`check:money-report`, `check:register`). This is the club's, in the same
 * spirit: lib/club-money-figures.ts is the ONE definition every club surface reads, and this script
 * holds it to an INDEPENDENT walk of the same rows — written here, deliberately naive, sharing no
 * code with the module — and to the identities the screens rely on:
 *
 *   1. per allocation, per team and for the club: Collected, Outstanding, Overdue, Sent, Due soon and
 *      Next due agree with the naive walk, to the cent;
 *   2. Collected + Outstanding = Billed, at every level, and the levels add up (Σ teams = club);
 *   3. every installment is in exactly one state, and Coming due's three bands are the figures';
 *   4. a team's account closes on its Outstanding, and its rows add up to it;
 *   5. a book: Starting balance + the window's posted movements = Ending balance; the all-time Balance
 *      is the walk's; past 1,000 rows (the silent cap the module replaced); the export's totals are the
 *      posted lines only.
 *
 * ⚠ WHY OFFLINE, WHEN THE COACH'S GATES READ A LIVE SERVER. The coach's gates exist to prove two ROUTES
 * hand their feeds the same money; that needs the server. The club's surfaces are held to ONE module by
 * `club-money-one-definition-guard.test.ts`, so what is left to prove is that the module is RIGHT — and
 * that can run anywhere, which is what lets it sit in `verify:changed`. The live, database-level proof
 * that a money move is one step is `check:club-money-atomicity` (needs the dev database).
 *
 * ⚠ THE FIXTURE MUST BE ABLE TO DISAGREE. Every shape that could split two readings is built here and
 * named on every run; a missing shape exits 2 rather than passing a thin fixture.
 *
 * Usage:  npm run check:club-money-arithmetic
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import {
  clubBillFigures, clubInstallmentState, comingDueBand, teamAccount, bookWindow, bookBalance, COMING_DUE_DAYS,
} from '../lib/club-money-figures.ts';
import { ledgerExportRows } from '../lib/club-ledger.ts';
import {
  buildBoardSummary, buildClubPlan, buildClubReport, withPeriodViews, FROM_THE_TEAMS_ID, TEAM_SUPPORT_WORD_IDS,
} from '../lib/club-budget-report.ts';
import { fiscalYearOf, fiscalYearMonths, fiscalQuarters, nextFiscalYear, previousFiscalYear } from '../lib/club-fiscal-year.ts';
import { buildAgainstLastYear, buildYearEndReport, compareSpans, statementOrder } from '../lib/club-year-compare.ts';
import { EARLIER_BILLS_PREFIX } from '../lib/club-budget-report.ts';
import { carriedOpening } from '../lib/club-money-figures.ts';

const TODAY = '2026-09-30';
const failures = [];
const check = (label, a, b) => {
  if (Math.round(Number(a) * 100) !== Math.round(Number(b) * 100) && JSON.stringify(a) !== JSON.stringify(b)) {
    failures.push(`${label}: module ${JSON.stringify(a)} ≠ walk ${JSON.stringify(b)}`);
  }
};

// ── The naive walk (shares no code with the module) ─────────────────────────────────────────────
const day = s => s;                                   // dates are YYYY-MM-DD strings throughout
const plusDays = (d, n) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);
function walkState(i) {
  if (i.paidAt) return 'received';
  if (i.sentAt) return 'sent';
  return day(i.dueDate) < TODAY ? 'overdue' : 'upcoming';
}
function walkFigures(list) {
  const edge = plusDays(TODAY, COMING_DUE_DAYS);
  const f = { billed: 0, collected: 0, overdueN: 0, overdueC: 0, sentN: 0, sentC: 0, soonN: 0, soonC: 0, next: null };
  for (const i of list) {
    const c = Math.round(i.amount * 100);
    f.billed += c;
    const s = walkState(i);
    if (s === 'received') f.collected += c;
    else if (s === 'sent') { f.sentN++; f.sentC += c; }
    else if (s === 'overdue') { f.overdueN++; f.overdueC += c; }
    else {
      if (i.dueDate <= edge) { f.soonN++; f.soonC += c; }
      if (!f.next || i.dueDate < f.next.d) f.next = { d: i.dueDate, c };
      else if (i.dueDate === f.next.d) f.next.c += c;
    }
  }
  return f;
}
function compareFigures(label, mod, list) {
  const w = walkFigures(list);
  check(`${label} billed`, mod.billed, w.billed / 100);
  check(`${label} collected`, mod.collected, w.collected / 100);
  check(`${label} outstanding`, mod.outstanding, (w.billed - w.collected) / 100);
  check(`${label} collected + outstanding = billed`, mod.collected + mod.outstanding, mod.billed);
  check(`${label} overdue count`, mod.overdue.count, w.overdueN);
  check(`${label} overdue amount`, mod.overdue.amount, w.overdueC / 100);
  check(`${label} sent count`, mod.sent.count, w.sentN);
  check(`${label} sent amount`, mod.sent.amount, w.sentC / 100);
  check(`${label} due soon count`, mod.dueSoon.count, w.soonN);
  check(`${label} due soon amount`, mod.dueSoon.amount, w.soonC / 100);
  check(`${label} next due`, JSON.stringify(mod.nextDue), JSON.stringify(w.next ? { dueDate: w.next.d, amount: w.next.c / 100 } : null));
}

// ── The fixture: every shape that could split two readings ──────────────────────────────────────
const shapes = new Set();
const I = (team, alloc, n, amount, dueDate, extra = {}) => ({ team, alloc, id: `${alloc}-${team}-${n}`, installmentNumber: n, amount, dueDate, paidAt: null, sentAt: null, sentOn: null, paidOn: null, ...extra });
const installments = [
  // Diamond fees: three installments, three teams, every state
  I('11U', 'diamond', 1, 450, '2026-08-15', { paidAt: '2026-08-14T15:00:00Z', paidOn: '2026-08-14' }),
  I('11U', 'diamond', 2, 450, '2026-09-15', { paidAt: '2026-09-28T15:00:00Z', paidOn: '2026-09-28' }),   // received late
  I('11U', 'diamond', 3, 450, '2026-10-15'),                                                            // day 15: outside the window
  I('10U', 'diamond', 1, 450, '2026-08-15', { paidAt: '2026-08-15T03:30:00Z' }),                        // pre-3a stamp, evening of Aug 14 in the club's day
  I('10U', 'diamond', 2, 450, '2026-09-15'),                                                            // overdue
  I('10U', 'diamond', 3, 450, '2026-10-15'),
  I('16G', 'diamond', 1, 450, '2026-08-15', { paidAt: '2026-08-20T15:00:00Z', sentAt: '2026-08-13T15:00:00Z', sentOn: '2026-08-13' }), // sent then confirmed
  I('16G', 'diamond', 2, 450, '2026-09-15', { sentAt: '2026-09-29T15:00:00Z', sentOn: '2026-09-29' }), // sent late: waiting, never overdue
  I('16G', 'diamond', 3, 450, '2026-10-15'),
  // Insurance: one installment each, due inside the window, and one due TODAY (not overdue)
  I('11U', 'insurance', 1, 360, '2026-10-01'),
  I('10U', 'insurance', 1, 360, TODAY),
  I('16G', 'insurance', 1, 360.33, '2026-10-14'),                                                       // day 14: inside the window; cents
  // Two installments of one team due the same day (Next due sums them)
  I('14G', 'float', 1, 100.10, '2026-10-05'),
  I('14G', 'float', 2, 49.95, '2026-10-05'),
  // Undone then due again: unpaid, with an undo record, already late
  I('14G', 'insurance', 1, 360, '2026-09-20', { undoneAt: '2026-09-25T12:00:00Z', undoneReason: 'Cheque returned' }),
];
for (const i of installments) shapes.add(`installment:${walkState(i)}`);
if (installments.some(i => i.dueDate === TODAY && !i.paidAt)) shapes.add('due-today');
if (installments.some(i => i.dueDate === plusDays(TODAY, COMING_DUE_DAYS))) shapes.add('window-edge-inside');
if (installments.some(i => i.dueDate === plusDays(TODAY, COMING_DUE_DAYS + 1))) shapes.add('window-edge-outside');
if (installments.some(i => i.sentAt && i.dueDate < TODAY && !i.paidAt)) shapes.add('sent-after-due');
if (installments.some(i => i.sentAt && i.paidAt)) shapes.add('sent-then-confirmed');
if (installments.some(i => i.undoneAt && !i.paidAt)) shapes.add('undone');
if (installments.some(i => Math.round(i.amount * 100) % 100 !== 0)) shapes.add('cents');

// 1. Per allocation, per team, club.
const by = key => installments.reduce((m, i) => m.set(i[key], [...(m.get(i[key]) ?? []), i]), new Map());
const club = clubBillFigures(installments, TODAY);
compareFigures('club', club, installments);
let sumBilled = 0, sumCollected = 0;
for (const [team, list] of by('team')) {
  const f = clubBillFigures(list, TODAY);
  compareFigures(`team ${team}`, f, list);
  sumBilled += f.billed; sumCollected += f.collected;
}
check('Σ teams billed = club billed', sumBilled, club.billed);
check('Σ teams collected = club collected', sumCollected, club.collected);
for (const [alloc, list] of by('alloc')) compareFigures(`allocation ${alloc}`, clubBillFigures(list, TODAY), list);

// 3. One state each; Coming due's bands are the figures'.
for (const i of installments) check(`state of ${i.id}`, clubInstallmentState(i, TODAY), walkState(i));
const bands = { overdue: 0, sent: 0, due_soon: 0 };
for (const i of installments) { const b = comingDueBand(i, TODAY); if (b) bands[b]++; }
check('Coming due · overdue = Overdue', bands.overdue, club.overdue.count);
check('Coming due · sent = Sent', bands.sent, club.sent.count);
check('Coming due · due soon = Due soon', bands.due_soon, club.dueSoon.count);

// 4. A team's account closes on its Outstanding, and its rows add up.
for (const [team, list] of by('team')) {
  const bills = [...by('alloc').keys()].map(alloc => {
    const own = list.filter(i => i.alloc === alloc);
    return own.length ? {
      splitId: `${alloc}-${team}`, allocationId: alloc, allocationDescription: alloc, programYearId: 'py',
      billedOn: '2026-08-01', amount: own.reduce((a, i) => a + i.amount, 0), installments: own,
    } : null;
  }).filter(Boolean);
  const acct = teamAccount(bills, [
    { id: `r-${team}`, programYearId: 'py', requestType: 'charge_to_org', status: 'approved', amount: 120, description: 'support', decidedOn: '2026-09-05' },
    { id: `x-${team}`, programYearId: 'py', requestType: 'charge_to_org', status: 'reversed', amount: 500, description: 'reversed', decidedOn: '2026-09-04' },
  ], ['py'], TODAY);
  const rows = acct.seasons.flatMap(s => s.rows);
  const walkOut = rows.reduce((a, r) => a + Math.round(r.billed * 100) - Math.round(r.collected * 100), 0) / 100;
  check(`team ${team} account closes on Outstanding`, acct.outstanding, acct.figures.outstanding);
  check(`team ${team} account rows add up`, walkOut, acct.outstanding);
  check(`team ${team} paying the team never moves Outstanding`, acct.paidToTeam, 120);
}
shapes.add('request:approved'); shapes.add('request:reversed');

// 5. A book, past the 1,000-row cap.
const lines = [];
for (let n = 0; n < 2500; n++) {
  const month = String(1 + Math.floor(n / 300)).padStart(2, '0');
  const d = `2026-${month}-${String(1 + (n % 28)).padStart(2, '0')}`;
  const type = ['income', 'expense', 'transfer_in', 'transfer_out'][n % 4];
  const status = n % 37 === 0 ? 'void' : n % 41 === 0 ? 'pending' : 'posted';
  lines.push({ id: `l${String(n).padStart(5, '0')}`, entryDate: d, createdAt: `${d}T12:00:00Z`, amount: ((n * 7) % 500) + 0.25, entryType: type, status });
}
shapes.add('book:>1000 rows'); shapes.add('book:pending'); shapes.add('book:void'); shapes.add('book:transfers');
const signed = l => (l.entryType === 'income' || l.entryType === 'transfer_in' ? 1 : -1) * Math.round(l.amount * 100);
const walkBalance = lines.filter(l => l.status === 'posted').reduce((a, l) => a + signed(l), 0) / 100;
check('book all-time Balance', bookBalance(lines), walkBalance);
const win = bookWindow(lines, { from: '2026-04-01', to: '2026-06-30' });
const before = lines.filter(l => l.entryDate < '2026-04-01' && l.status === 'posted').reduce((a, l) => a + signed(l), 0) / 100;
const inside = lines.filter(l => l.entryDate >= '2026-04-01' && l.entryDate <= '2026-06-30');
check('book Starting balance', win.startingBalance, before);
check('book Starting + window = Ending', win.startingBalance + inside.filter(l => l.status === 'posted').reduce((a, l) => a + signed(l), 0) / 100, win.endingBalance);
check('book window rows (every status)', win.rows.length, inside.length);
check('book status counts', JSON.stringify(win.counts), JSON.stringify({
  posted: inside.filter(l => l.status === 'posted').length,
  pending: inside.filter(l => l.status === 'pending').length,
  void: inside.filter(l => l.status === 'void').length,
}));
// The export takes the book's own split (money in OR money out, never both); the sign is re-derived here.
const exp = ledgerExportRows(inside.map(l => ({
  date: l.entryDate, what: l.id, detail: null, category: null, type: 'income',
  moneyIn: signed(l) > 0 ? l.amount : null, moneyOut: signed(l) > 0 ? null : l.amount,
  status: l.status, recordedBy: null, voidReason: null,
})));
check('export net = posted window movement', exp.totals.net, inside.filter(l => l.status === 'posted').reduce((a, l) => a + signed(l), 0) / 100);
check('export rows = every window line', exp.rows.length, inside.length);

// ══ 6–9. CLUB TIER STAGE 3b — the plan, Budget vs. Actual, Months and the summary ═══════════════
// The same discipline: the module (lib/club-budget-report.ts over lib/club-money-figures.ts) against a
// naive walk written here. The fixture is the club's year with every shape that could split two readings.
const Y = 2026;
// A January club with no fiscal-year rows: every year is the calendar year, exactly as before Stage 3c.
const JAN = { firstMonth: 1, rows: [] };
const YEAR = fiscalYearOf(`${Y}-06-01`, JAN);
const inYEAR = d => d >= YEAR.firstDay && d <= YEAR.lastDay;
const W = {
  diamond: { categoryId: 'c-fields', categoryName: 'Field & facilities', itemId: 'w-diamond', itemName: 'Diamond permits' },
  insurance: { categoryId: 'c-ins', categoryName: 'Insurance', itemId: 'w-ins', itemName: 'Club insurance' },
  equipment: { categoryId: 'c-gear', categoryName: 'Uniforms & equipment', itemId: 'w-equip', itemName: 'Club equipment' },
  uniforms: { categoryId: 'c-gear', categoryName: 'Uniforms & equipment', itemId: 'w-unif', itemName: 'Girls uniforms' },
  support: { categoryId: TEAM_SUPPORT_WORD_IDS.categoryId, categoryName: 'Team support', itemId: TEAM_SUPPORT_WORD_IDS.itemId, itemName: 'Paid to teams on request' },
  sponsors: { categoryId: 'c-spon', categoryName: 'Sponsorship', itemId: 'w-spon', itemName: 'Club sponsors' },
  banquet: { categoryId: 'c-events', categoryName: 'Events', itemId: 'w-banquet', itemName: 'Year-end banquet deposit' },
  umpires: { categoryId: 'c-off', categoryName: 'Officials', itemId: 'w-ump', itemName: 'Umpires association fees' },
};
const PL = (id, w, total, direction, periods = []) => ({
  id, categoryId: w?.categoryId ?? 'c-admin', categoryName: w?.categoryName ?? 'Administration',
  itemId: w?.itemId ?? null, itemName: w?.itemName ?? null, direction, totalAmount: total, description: w?.itemName ?? 'Office (typed before 3b)',
  notes: null, sortOrder: 0, updatedAt: '2026-01-05T12:00:00Z', periods: periods.map((p, i) => ({ label: p[0], date: p[0], amount: p[1], sortOrder: i })),
});
const planLines = [
  PL('L-diamond', W.diamond, 14000, 'out', [['2026-04-15', 7000], ['2026-06-15', 7000]]),
  PL('L-ins', W.insurance, 3240, 'out', [['2026-09-01', 3240]]),
  PL('L-equip', W.equipment, 3000, 'out'),
  PL('L-support', W.support, 2000, 'out'),
  PL('L-sponsors', W.sponsors, 5000, 'in', [['2026-03-15', 2500], ['2026-06-15', 2500]]),
  PL('L-unif', W.uniforms, 6000, 'out'),             // billed ABOVE its total before the floor existed
  PL('L-wordless', null, 900, 'out', [['2026-01-31', 450], ['2026-07-31', 450]]),
];
const SPL = (alloc, team, amount, inst) => ({ id: `${alloc}-${team}`, teamId: team, teamName: team, amount, installments: inst.map((x, n) => ({
  id: `${alloc}-${team}-${n + 1}`, installmentNumber: n + 1, amount: x.amount ?? amount, dueDate: x.due, paidAt: x.paidOn ? `${x.paidOn}T15:00:00Z` : null,
  paidOn: x.paidOn ?? null, sentAt: x.sentOn ? `${x.sentOn}T15:00:00Z` : null, sentOn: x.sentOn ?? null, accountingEntryId: x.entry ?? null,
})) });
const allocations = [
  { id: 'A1', description: 'Diamond fees 2026', createdOn: '2026-03-01', sourceBudgetLineId: 'L-diamond', lineYearKey: YEAR.key, splits: [
    SPL('A1', 'T-11U', 6075, [{ due: '2026-05-15', paidOn: '2026-05-10' }]),
    SPL('A1', 'T-10U', 6075, [{ due: '2026-05-15' }]) ] },                                         // overdue
  { id: 'A2', description: 'Diamond permits, fall top-up', createdOn: '2026-09-20', sourceBudgetLineId: 'L-diamond', lineYearKey: YEAR.key, splits: [
    SPL('A2', 'T-11U', 925, [{ due: '2026-10-15', sentOn: '2026-09-29' }]),                         // sent, not received
    SPL('A2', 'T-10U', 925, [{ due: '2026-10-15' }]) ] },
  { id: 'A3', description: 'Uniform order, Girls', createdOn: '2026-04-01', sourceBudgetLineId: 'L-unif', lineYearKey: YEAR.key, splits: [
    SPL('A3', 'T-16G', 3375, [{ due: '2026-06-01', paidOn: '2026-06-01' }]),
    SPL('A3', 'T-14G', 3375, [{ due: '2026-11-01' }]) ] },
  { id: 'A4', description: 'Bus to provincials', createdOn: '2026-06-20', sourceBudgetLineId: null, lineYearKey: null, splits: [
    SPL('A4', 'T-14G', 500, [{ due: '2026-07-01', paidOn: '2026-07-05', entry: 'A4-team-half' }]) ] },  // no line: the year of its first due
  { id: 'A5', description: 'Spring training 2025', createdOn: '2025-11-01', sourceBudgetLineId: 'L-2025', lineYearKey: '2025-01-01', splits: [
    SPL('A5', 'T-11U', 200, [{ due: '2026-02-01', paidOn: '2026-02-03' }]),                       // last year's bill, paid this year
    SPL('A5', 'T-10U', 150, [{ due: '2026-04-01' }]) ] },                                          // last year's bill, still owed this spring
];
const REQ = (id, team, type, status, amount, entry = null) => ({ id, teamId: team, teamName: team, requestType: type, status, amount, description: id, createdOn: '2026-09-01', accountingEntryId: entry });
const requests = [
  REQ('R-to-club', 'T-10U', 'payment_to_org', 'approved', 430),
  REQ('R-paid-team', 'T-16G', 'charge_to_org', 'approved', 420, 'ln-r2'),
  REQ('R-wait-out', 'T-13AA', 'charge_to_org', 'pending', 455),
  REQ('R-wait-in', 'T-9A', 'payment_to_org', 'pending', 100),
  REQ('R-reversed', 'T-12AA', 'charge_to_org', 'reversed', 300),
];
let ln = 0;
const BL = (o) => ({ id: o.id ?? `ln-${++ln}`, ledgerId: o.book ?? 'general', bookKind: o.kind ?? 'org', bookName: o.book ?? 'General', entryDate: o.date,
  description: o.id ?? 'line', amount: o.amount, entryType: o.type, status: o.status ?? 'posted', category: o.cat ?? null, sourceModule: o.src ?? null,
  sourceEntityId: o.srcId ?? null, linkedEntryId: o.link ?? null, partnerKind: o.partner ?? null,
  budgetCategoryId: o.w?.categoryId ?? null, budgetCategoryName: o.w?.categoryName ?? null, budgetItemId: o.w?.itemId ?? null, budgetItemName: o.w?.itemName ?? null });
const bookLines = [
  BL({ date: '2026-04-14', amount: 5300, type: 'expense', w: W.diamond }),
  BL({ date: '2026-06-12', amount: 5250, type: 'expense', w: W.diamond }),
  BL({ date: '2026-09-29', amount: 1850, type: 'expense', w: W.diamond }),
  BL({ date: '2026-09-02', amount: 3200, type: 'expense', w: W.insurance }),
  BL({ date: '2026-09-10', amount: 500, type: 'expense', w: W.banquet }),                                   // off-plan word
  BL({ date: '2026-01-15', amount: 120, type: 'expense', cat: 'Office' }),                                  // Not filed (typed before 3b)
  BL({ date: '2026-02-15', amount: 60, type: 'expense', cat: 'Office' }),
  BL({ date: '2026-09-30', amount: 640, type: 'expense', status: 'pending', w: W.umpires }),               // a cheque not yet cleared
  BL({ date: '2026-05-05', amount: 99, type: 'expense', status: 'void', w: W.diamond }),
  BL({ date: '2026-03-20', amount: 2500, type: 'income', w: W.sponsors, book: 'sponsorships' }),            // a book the club opened by name
  BL({ date: '2026-06-20', amount: 1500, type: 'income', w: W.sponsors, book: 'sponsorships' }),
  BL({ date: '2026-05-10', amount: 6075, type: 'transfer_in', cat: 'rep_allocation', src: 'rep_allocation_installment', srcId: 'A1-T-11U-1', partner: 'team', w: W.diamond }), // a word rode along: ignored
  BL({ date: '2026-06-01', amount: 3375, type: 'transfer_in', cat: 'rep_allocation', src: 'rep_allocation_installment', srcId: 'A3-T-16G-1', partner: 'team' }),
  BL({ date: '2026-07-05', amount: 500, type: 'transfer_in', cat: 'rep_allocation', link: 'A4-team-half', partner: 'team' }),               // before 3a: no source column
  BL({ date: '2026-02-03', amount: 200, type: 'transfer_in', cat: 'rep_allocation', src: 'rep_allocation_installment', srcId: 'A5-T-11U-1', partner: 'team' }),
  BL({ date: '2026-06-05', amount: 430, type: 'transfer_in', cat: 'team_payment_to_org', src: 'rep_payment_request', srcId: 'R-to-club', partner: 'team' }),
  BL({ id: 'ln-r2', date: '2026-09-15', amount: 420, type: 'transfer_out', cat: 'team_charge_to_org', partner: 'team' }),                // before 3a
  BL({ date: '2026-08-12', amount: 300, type: 'transfer_out', status: 'void', cat: 'team_charge_to_org', src: 'rep_payment_request', srcId: 'R-reversed', partner: 'team' }),
  BL({ date: '2026-08-21', amount: 200, type: 'transfer_out', partner: 'tournament' }),                     // between the club's own books
  BL({ date: '2026-08-21', amount: 200, type: 'transfer_in', partner: 'org', book: 'harvest', kind: 'tournament' }),
  BL({ date: '2026-07-07', amount: 30, type: 'transfer_out', status: 'pending', partner: 'tournament' }),     // a pending move between the club's own books
  BL({ date: '2026-07-07', amount: 30, type: 'transfer_in', status: 'pending', partner: 'org', book: 'harvest', kind: 'tournament' }),
  BL({ date: '2026-03-01', amount: 250, type: 'transfer_out', partner: 'team' }),                          // by hand to a team, before 3a refused it
  BL({ date: '2026-08-20', amount: 1440, type: 'income', book: 'harvest', kind: 'tournament' }),
  BL({ date: '2026-08-25', amount: 100, type: 'expense', book: 'harvest', kind: 'tournament' }),
  BL({ date: '2026-04-10', amount: 800, type: 'income', src: 'league_registration', book: 'league', kind: 'league_season' }),
];
const openingByBook = { general: 21000, harvest: 762, league: 0, sponsorships: 0 };
const kindOf = { general: 'org', sponsorships: 'org', harvest: 'tournament', league: 'league_season' };
const walkSigned = l => (l.entryType === 'income' || l.entryType === 'transfer_in' ? 1 : -1) * Math.round(l.amount * 100);
const books3b = Object.keys(openingByBook).map(id => ({ id, kind: kindOf[id], name: id,
  balance: (Math.round(openingByBook[id] * 100) + bookLines.filter(l => l.ledgerId === id && l.status === 'posted').reduce((a, l) => a + walkSigned(l), 0)) / 100 }));
const opening3b = Object.values(openingByBook).reduce((a, b) => a + b, 0);
const order = { 'c-fields': 2, 'c-off': 3, 'c-gear': 4, 'c-events': 6, 'c-admin': 7, 'c-ins': 8, 'c-spon': 10, [TEAM_SUPPORT_WORD_IDS.categoryId]: 11 };

const plan = buildClubPlan({ year: YEAR, today: TODAY, lines: planLines, allocations, categoryOrder: order, openingBalance: opening3b });
// Cash on hand's caption is today's: every pending line on the Club books, whatever its date — last year's
// uncleared cheque included (it is not in the year's lines).
const priorPending = [BL({ date: '2025-12-20', amount: 75, type: 'expense', status: 'pending', w: W.umpires })];
const pendingLines = [...bookLines, ...priorPending].filter(l => l.status === 'pending' && l.bookKind === 'org');
const rep = buildClubReport({ year: YEAR, setting: JAN, today: TODAY, lines: planLines, allocations, requests, bookLines, pendingLines, books: books3b, openingBalance: opening3b, categoryOrder: order });

// Each shape is READ OFF the fixture (never declared), so an edit that loses one exits 2.
const isTransfer3b = l => l.entryType === 'transfer_in' || l.entryType === 'transfer_out';
const loopKeys = new Set(['rep_allocation', 'team_payment_to_org', 'team_charge_to_org']);
const allocCount = id => allocations.filter(a => a.sourceBudgetLineId === id).length;
const shapeIf = (name, test) => { if (test) shapes.add(`3b ${name}`); };
shapeIf('plan:many allocations per line', planLines.some(l => allocCount(l.id) > 1));
shapeIf('plan:billed above its total', planLines.some(l => allocations.filter(a => a.sourceBudgetLineId === l.id).flatMap(a => a.splits).reduce((x, s) => x + s.amount, 0) > l.totalAmount));
shapeIf('plan:revenue line', planLines.some(l => l.direction === 'in'));
shapeIf('plan:word-less line', planLines.some(l => !l.itemId));
shapeIf('plan:undated line', planLines.some(l => l.periods.length === 0));
shapeIf('loop:sourced', bookLines.some(l => l.sourceModule === 'rep_allocation_installment'));
shapeIf('loop:before-3a link', bookLines.some(l => !l.sourceModule && l.linkedEntryId && loopKeys.has(l.category)));
shapeIf('loop:a word rode along', bookLines.some(l => l.sourceModule && l.budgetItemId));
shapeIf('loop:last year bill paid this year', allocations.some(a => a.lineYearKey != null && a.lineYearKey < YEAR.key && a.splits.some(s => s.installments.some(i => i.paidAt))));
shapeIf('loop:no line', allocations.some(a => !a.sourceBudgetLineId));
shapeIf('request:on request', requests.some(r => r.requestType === 'payment_to_org' && r.status === 'approved'));
shapeIf('request:paid to a team', requests.some(r => r.requestType === 'charge_to_org' && r.status === 'approved'));
shapeIf('request:waiting both ways', ['payment_to_org', 'charge_to_org'].every(t => requests.some(r => r.requestType === t && r.status === 'pending')));
shapeIf('request:reversed (void)', bookLines.some(l => l.status === 'void' && loopKeys.has(l.category)));
shapeIf('book:pending', bookLines.some(l => l.status === 'pending'));
shapeIf('book:pending own transfer', bookLines.some(l => l.status === 'pending' && isTransfer3b(l) && l.bookKind === 'org' && ['org', 'tournament', 'league_season'].includes(l.partnerKind)));
shapeIf('book:pending from last year', pendingLines.some(l => l.entryDate < YEAR.firstDay));
shapeIf('installment:last year\'s bill still owed', allocations.some(a => a.lineYearKey != null && a.lineYearKey < YEAR.key && a.splits.some(s => s.installments.some(i => !i.paidAt && inYEAR(i.dueDate)))));
shapeIf('book:void', bookLines.some(l => l.status === 'void' && !loopKeys.has(l.category)));
shapeIf('book:own transfer', bookLines.some(l => isTransfer3b(l) && ['org', 'tournament', 'league_season'].includes(l.partnerKind)));
shapeIf('book:by hand to a team', bookLines.some(l => isTransfer3b(l) && l.partnerKind === 'team' && !loopKeys.has(l.category)));
shapeIf('book:named club book', bookLines.some(l => l.bookKind === 'org' && l.ledgerId !== 'general'));
shapeIf('book:other books', bookLines.some(l => l.bookKind !== 'org' && l.status === 'posted' && !isTransfer3b(l)));
shapeIf('book:house league fee', bookLines.some(l => l.sourceModule === 'league_registration'));
shapeIf('word:off-plan', bookLines.some(l => l.budgetItemId && !l.sourceModule && !planLines.some(p => p.itemId === l.budgetItemId)));
shapeIf('word:not filed', bookLines.some(l => !l.budgetItemId && !isTransfer3b(l) && !l.sourceModule && l.bookKind === 'org'));
shapeIf('installment:overdue', allocations.some(a => a.splits.some(s => s.installments.some(i => !i.paidAt && !i.sentAt && i.dueDate < TODAY))));
shapeIf('installment:sent', allocations.some(a => a.splits.some(s => s.installments.some(i => i.sentAt && !i.paidAt))));

// 6. The plan. Every line's Allocated is the sum of its allocations; Not allocated never below zero.
const naiveAllocated = id => allocations.filter(a => a.sourceBudgetLineId === id).flatMap(a => a.splits).reduce((x, s) => x + Math.round(s.amount * 100), 0) / 100;
const planRows = [...plan.revenue.categories, ...plan.expenses.categories].flatMap(c => c.lines);
for (const l of planLines.filter(x => x.direction === 'out')) {
  const row = planRows.find(r => r.id === l.id);
  check(`plan ${l.id} Allocated`, row.allocated, naiveAllocated(l.id));
  check(`plan ${l.id} Not allocated = max(0, planned − allocated)`, row.notAllocated, Math.max(0, Math.round(l.totalAmount * 100) - Math.round(naiveAllocated(l.id) * 100)) / 100);
  if (row.notAllocated < 0) failures.push(`plan ${l.id} Not allocated is below zero`);
}
const fromTeamsPlanned = planLines.filter(l => l.direction === 'out').reduce((x, l) => x + Math.round(naiveAllocated(l.id) * 100), 0) / 100;
check('plan From the teams = Σ Allocated over the year\'s lines', plan.revenue.fromTheTeams.planned, fromTeamsPlanned);
const naivePlannedIn = planLines.filter(l => l.direction === 'in').reduce((x, l) => x + Math.round(l.totalAmount * 100), 0) / 100 + fromTeamsPlanned;
const naivePlannedOut = planLines.filter(l => l.direction === 'out').reduce((x, l) => x + Math.round(l.totalAmount * 100), 0) / 100;
check('plan Total revenue', plan.revenue.total, naivePlannedIn);
check('plan Total expenses', plan.expenses.total, naivePlannedOut);
check('plan closes on opening + revenue − expenses', plan.closingBalance, opening3b + naivePlannedIn - naivePlannedOut);
// Periods: the By period grid places every planned dollar once — a line's periods sum to its total, the rest is undated.
// The view on screen is the coach's own period view (session 2) — proved at BOTH granularities, the shape
// the screen formats: totals, each dated column's opening + net = closing, and the year's close.
for (const [g, view] of Object.entries(withPeriodViews(plan, planLines, order).periodView)) {
  check(`By period (${g}) revenue = the plan's revenue`, view.revenueTotals?.total ?? 0, naivePlannedIn);
  check(`By period (${g}) expenses = the plan's expenses`, view.expenseTotals.total, naivePlannedOut);
  check(`By period (${g}) From the teams = the plan's`, view.installments?.total ?? 0, fromTeamsPlanned);
  check(`By period (${g}) closes where the List closes`, view.balance.seasonClosing, plan.closingBalance);
  check(`By period (${g}) opens on the year's worked-out opening`, view.balance.seasonOpening, opening3b);
  for (const c of view.columns.filter(x => !x.unscheduled)) {
    check(`By period (${g}) ${c.key}: opening + net = closing`, view.balance.opening[c.key] + view.balance.net[c.key], view.balance.closing[c.key]);
  }
}
for (const l of planLines.filter(x => x.periods.length)) check(`plan ${l.id} periods sum to the total`, l.periods.reduce((x, p) => x + p.amount, 0), l.totalAmount);

// 7. Budget vs. Actual. The naive filing: the loop by source; a typed line by its word; else Not filed.
const own = new Set(['org', 'tournament', 'league_season']);
const counted = bookLines.filter(l => l.status === 'posted' && l.bookKind === 'org'
  && !((l.entryType === 'transfer_in' || l.entryType === 'transfer_out') && own.has(l.partnerKind)));
const isIn = l => l.entryType === 'income' || l.entryType === 'transfer_in';
const naiveIn = counted.filter(isIn).reduce((x, l) => x + Math.round(l.amount * 100), 0) / 100;
const naiveOut = counted.filter(l => !isIn(l)).reduce((x, l) => x + Math.round(l.amount * 100), 0) / 100;
check('Total revenue Actual = every posted money-in line on the Club books', rep.statement.revenue.actual, naiveIn);
check('Total expenses Actual = every posted money-out line on the Club books', rep.statement.expenses.actual, naiveOut);
check('the band\'s Collected = Total revenue\'s Actual', rep.band.collected.amount, rep.statement.revenue.actual);
check('Spent = Total expenses\' Actual', rep.band.spent.amount, rep.statement.expenses.actual);
for (const side of ['revenue', 'expenses']) {
  const s = rep.statement[side];
  check(`${side}: categories add up (Actual)`, s.categories.reduce((x, c) => x + Math.round(c.actual * 100), 0) / 100, s.actual);
  check(`${side}: categories add up (Budgeted)`, s.categories.reduce((x, c) => x + Math.round(c.budgeted * 100), 0) / 100, s.budgeted);
  for (const c of s.categories) check(`${side} ${c.categoryName}: lines add up`, c.items.reduce((x, i) => x + Math.round(i.actual * 100), 0) / 100, c.actual);
}
const plannedItems = new Set(planLines.map(l => l.itemId).filter(Boolean));
const naiveItemOf = l => (l.category === 'team_charge_to_org') ? TEAM_SUPPORT_WORD_IDS.itemId : (l.budgetItemId ?? null);
const naiveOffPlan = counted.filter(l => !isIn(l)).filter(l => { const it = naiveItemOf(l); return !it || !plannedItems.has(it); })
  .reduce((x, l) => x + Math.round(l.amount * 100), 0) / 100;
check('Off-plan = spending on a word with no line + Not filed', rep.band.offPlan, naiveOffPlan);
check('the year\'s Net', rep.statement.net.actual, (Math.round(naiveIn * 100) - Math.round(naiveOut * 100)) / 100);

// 8. Months: every column opens + nets = closes; the Cash lens closes this month on Cash on hand.
const naiveCash = books3b.reduce((x, b) => x + Math.round(b.balance * 100), 0) / 100;
check('Cash on hand = every book the club owns', rep.band.cashOnHand, naiveCash);
for (const lens of ['budget', 'scheduled', 'actual']) {
  const rows = rep.months.balances[lens].rows;
  rows.forEach((r, i) => {
    check(`Months ${lens} ${r.month}: opening + net = closing`, (Math.round(r.opening * 100) + Math.round(r.net * 100)) / 100, r.running);
    if (i > 0) check(`Months ${lens} ${r.month} opens on the last close`, r.opening, rows[i - 1].running);
  });
}
const thisMonth = TODAY.slice(0, 7);
check('Months · Cash: this month closes on Cash on hand', rep.months.balances.actual.rows.find(r => r.month === thisMonth).running, naiveCash);
check('Months · Cash revenue = the band\'s Collected', rep.months.revenueGrid.totals.total.actual, rep.band.collected.amount);
check('Months · Cash expenses = Spent', rep.months.monthGrid.totals.total.actual, rep.band.spent.amount);
// Scheduled is by DUE DATE in the year, whichever year's line the allocation was drawn from.
const naiveScheduledIn = (allocations
  .flatMap(a => a.splits.flatMap(s => s.installments)).filter(i => !i.paidAt && inYEAR(i.dueDate)).reduce((x, i) => x + Math.round(i.amount * 100), 0)
  + requests.filter(r => r.status === 'pending' && r.requestType === 'payment_to_org').reduce((x, r) => x + Math.round(r.amount * 100), 0)) / 100;
const movesMoney = l => !(isTransfer3b(l) && own.has(l.partnerKind));
const naiveScheduledOut = (bookLines.filter(l => l.status === 'pending' && l.bookKind === 'org' && !isIn(l) && movesMoney(l)).reduce((x, l) => x + Math.round(l.amount * 100), 0)
  + requests.filter(r => r.status === 'pending' && r.requestType === 'charge_to_org').reduce((x, r) => x + Math.round(r.amount * 100), 0)) / 100;
check('Months · Scheduled money in: unreceived installments due in the year + waiting To-club requests', rep.months.revenueGrid.totals.total.scheduled, naiveScheduledIn);
const naiveWaiting = pendingLines.filter(movesMoney);
check('Cash on hand\'s caption: every pending Club-book line that moves money, ANY date (count)', rep.pending.count, naiveWaiting.length);
check('Cash on hand\'s caption: money out waiting', rep.pending.moneyOut, naiveWaiting.filter(l => !isIn(l)).reduce((x, l) => x + Math.round(l.amount * 100), 0) / 100);
check('Months · Scheduled money out: pending lines + waiting requests to pay a team', rep.months.monthGrid.totals.total.scheduled, naiveScheduledOut);
const otherNet = bookLines.filter(l => l.status === 'posted' && l.bookKind !== 'org'
  && !((l.entryType === 'transfer_in' || l.entryType === 'transfer_out') && own.has(l.partnerKind))).reduce((x, l) => x + walkSigned(l), 0) / 100;
check('Months · the club\'s other books (transfers left out)', rep.months.otherBooks.actual.reduce((x, m) => x + Math.round(m.net * 100), 0) / 100, otherNet);
check('Months · Cash: the year closes on opening + every book\'s movement', rep.months.balances.actual.ending, naiveCash);

// 9. The summary's figures are the report's.
const summary = buildBoardSummary({
  report: rep, setting: JAN, allocations, requests: requests.map(r => ({ ...r, holdingPayout: r.id === 'R-wait-out' })), books: books3b,
  teams: ['T-11U', 'T-10U', 'T-16G', 'T-14G'].map(t => ({ teamId: t, teamName: t, groupName: null, isArchived: false })),
  teamCash: [{ teamId: 'T-11U', cash: 4100.5, season: null }, { teamId: 'T-10U', cash: -80, season: null }],
});
check('summary Revenue = the report\'s', summary.againstBudget.revenue.actual, rep.statement.revenue.actual);
check('summary Expenses = the report\'s', summary.againstBudget.expenses.actual, rep.statement.expenses.actual);
check('summary Headroom = planned expenses − Spent', summary.againstBudget.headroom, (Math.round(rep.statement.expenses.budgeted * 100) - Math.round(rep.band.spent.amount * 100)) / 100);
check('summary Off-plan = the report\'s', summary.againstBudget.offPlan, rep.band.offPlan);
check('summary Cash on hand = the report\'s', summary.position.cashOnHand, rep.band.cashOnHand);
const naiveOwed = allocations.flatMap(a => a.splits.flatMap(s => s.installments)).filter(i => !i.paidAt).reduce((x, i) => x + Math.round(i.amount * 100), 0) / 100;
check('summary Owed by the teams = every unreceived installment', summary.position.owedByTheTeams.amount, naiveOwed);
check('summary Waiting on you = every waiting request, both directions', summary.position.waitingOnYou.amount, 555);
check('summary the teams\' cash is its own total', summary.teamsCash.total, 4020.5);
check('summary From the teams = allocations + on request', (Math.round(summary.againstBudget.fromTheTeams.allocations * 100) + Math.round(summary.againstBudget.fromTheTeams.onRequest * 100)) / 100,
  rep.statement.revenue.categories.find(c => c.categoryId === FROM_THE_TEAMS_ID).actual);
// The summary's two planned sub-rows (session 2) are READ from the statement: From the teams' plan is the
// allocations drawn from the year's cost lines, the plan's own figure.
check('summary From the teams planned = the plan\'s From the teams', summary.againstBudget.fromTheTeams.planned, plan.revenue.fromTheTeams.planned);

// ══ 10. CLUB TIER STAGE 3c — a SEPTEMBER club, its last year CLOSED ═══════════════════════════
// The same discipline on the fiscal year (owner rulings 2026-10-07): a year that crosses a New Year, its
// months and quarters from September; a CLOSED predecessor whose stored closing the next year opens on
// (opening = closing, to the cent) and which nothing after it can move; last year's bills paid this year
// (one row); a bill that straddles the close; Against last year to the same day; the year-end report; and
// the SHORT year a change of first month makes. Every figure against a naive walk written here.
const shapeIf3c = (name, test) => { if (test) shapes.add(`3c ${name}`); };
const TODAY_S = '2027-02-15';
const sOpeningByBook = { general: 10000, savings: 2000, harvest: 500 };          // before 2025-09-01
const sKind = { general: 'org', savings: 'org', harvest: 'tournament' };
const SBL = o => BL({ ...o, kind: sKind[o.book ?? 'general'] });
const sLines = [
  // 2025–26 (September 2025 – August 2026)
  SBL({ date: '2025-09-01', amount: 1200, type: 'expense', w: W.diamond }),                                   // the year's first day
  SBL({ date: '2025-12-01', amount: 3000, type: 'income', w: W.sponsors, book: 'savings' }),
  SBL({ date: '2026-01-15', amount: 400, type: 'expense', w: W.insurance }),                                  // after the New Year, same year
  SBL({ date: '2026-03-05', amount: 600, type: 'transfer_in', cat: 'rep_allocation', src: 'rep_allocation_installment', srcId: 'S1-T-11U-1', partner: 'team' }),
  SBL({ date: '2026-04-01', amount: 500, type: 'transfer_out', partner: 'org' }),                             // between the club's own books
  SBL({ date: '2026-04-01', amount: 500, type: 'transfer_in', partner: 'org', book: 'savings' }),
  SBL({ date: '2026-06-01', amount: 80, type: 'expense', status: 'pending', w: W.insurance }),               // a cheque still uncleared at the close
  SBL({ date: '2026-08-20', amount: 900, type: 'income', book: 'harvest' }),
  SBL({ date: '2026-08-21', amount: 250, type: 'expense', book: 'harvest' }),
  SBL({ date: '2026-08-28', amount: 300, type: 'transfer_in', cat: 'rep_allocation', src: 'rep_allocation_installment', srcId: 'S3-T-14G-1', partner: 'team' }),
  SBL({ date: '2026-08-31', amount: 100, type: 'expense', w: W.diamond }),                                    // the year's last day
  // 2026–27 (September 2026 – August 2027), to today
  SBL({ date: '2026-09-01', amount: 700, type: 'expense', w: W.diamond }),
  SBL({ date: '2026-10-02', amount: 300, type: 'transfer_in', cat: 'rep_allocation', src: 'rep_allocation_installment', srcId: 'S3-T-14G-2', partner: 'team' }), // the straddling bill, after the close
  SBL({ date: '2026-10-10', amount: 1500, type: 'income', w: W.sponsors, book: 'savings' }),
  SBL({ date: '2026-11-20', amount: 600, type: 'transfer_in', cat: 'rep_allocation', src: 'rep_allocation_installment', srcId: 'S1-T-10U-1', partner: 'team' }), // last year's bill, paid this year
  SBL({ date: '2027-01-05', amount: 300.45, type: 'expense', w: W.insurance }),
  SBL({ date: '2027-01-20', amount: 450, type: 'transfer_in', cat: 'rep_allocation', src: 'rep_allocation_installment', srcId: 'S2-T-11U-1', partner: 'team' }),
  SBL({ date: '2027-02-10', amount: 120, type: 'income', book: 'harvest' }),
  SBL({ date: '2027-02-14', amount: 60, type: 'expense', status: 'pending', w: W.diamond }),
];
const sAllocations = [
  { id: 'S1', description: 'Diamond fees 2025–26', createdOn: '2025-10-01', sourceBudgetLineId: 'S-diamond-25', lineYearKey: '2025-09-01', splits: [
    SPL('S1', 'T-11U', 600, [{ due: '2026-03-01', paidOn: '2026-03-05' }]),
    SPL('S1', 'T-10U', 600, [{ due: '2026-06-01', paidOn: '2026-11-20' }]) ] },                               // paid after the close
  { id: 'S2', description: 'Diamond fees 2026–27', createdOn: '2026-10-01', sourceBudgetLineId: 'S-diamond', lineYearKey: '2026-09-01', splits: [
    SPL('S2', 'T-11U', 450, [{ due: '2027-01-15', paidOn: '2027-01-20' }]),
    SPL('S2', 'T-10U', 450, [{ due: '2027-03-15' }]),
    SPL('S2', 'T-16G', 450, [{ due: '2027-02-01' }]) ] },                                                      // overdue
  { id: 'S3', description: 'Bus to provincials', createdOn: '2026-08-10', sourceBudgetLineId: null, lineYearKey: null, splits: [
    SPL('S3', 'T-14G', 600, [{ due: '2026-08-25', paidOn: '2026-08-28', amount: 300 }, { due: '2026-09-25', paidOn: '2026-10-02', amount: 300 }]) ] }, // off-plan: the year of its first due
];
const sPlan25 = [PL('S-diamond-25', W.diamond, 2000, 'out', [['2025-10-15', 2000]]), PL('S-spon-25', W.sponsors, 3000, 'in', [['2025-12-01', 3000]])];
const sPlan26 = [
  PL('S-diamond', W.diamond, 9000, 'out', [['2026-10-15', 4500], ['2027-04-15', 4500]]),
  PL('S-ins', W.insurance, 2000, 'out', [['2026-12-01', 2000]]),
  PL('S-spon', W.sponsors, 4000, 'in', [['2026-10-01', 2000], ['2027-03-01', 2000]]),
  PL('S-equip', W.equipment, 1000, 'out'),
];

// The naive walk: every book the club owns, posted, by day.
const sPostedC = (from, to, pred = () => true) => sLines.filter(l => l.status === 'posted' && l.entryDate >= from && l.entryDate <= to && pred(l))
  .reduce((x, l) => x + walkSigned(l), 0);
const sOpening25 = Object.values(sOpeningByBook).reduce((a, b) => a + b, 0);
const sClosing25 = (Math.round(sOpening25 * 100) + sPostedC('0000-01-01', '2026-08-31')) / 100;
const sBooks = (extra = []) => Object.keys(sOpeningByBook).map(id => ({ id, kind: sKind[id], name: id,
  balance: (Math.round(sOpeningByBook[id] * 100) + [...sLines, ...extra].filter(l => l.ledgerId === id && l.status === 'posted').reduce((a, l) => a + walkSigned(l), 0)) / 100 }));
const sCash = sBooks().reduce((x, b) => x + Math.round(b.balance * 100), 0) / 100;
const SEP = { firstMonth: 9, rows: [{ id: 'fy-25', name: '2025–26', firstDay: '2025-09-01', lastDay: '2026-08-31',
  closedAt: '2026-10-07T12:00:00Z', closedBy: 'u-treasurer', closingBalance: sClosing25 }] };
const Y25 = fiscalYearOf('2026-03-01', SEP), Y26 = fiscalYearOf(TODAY_S, SEP);
const inY = y => d => d >= y.firstDay && d <= y.lastDay;
const sYearLines = y => sLines.filter(l => inY(y)(l.entryDate));
const sPending = sLines.filter(l => l.status === 'pending' && l.bookKind === 'org');
const sCounted = l => l.status === 'posted' && l.bookKind === 'org' && !(isTransfer3b(l) && own.has(l.partnerKind));
const sSum = (from, to, side) => sLines.filter(l => sCounted(l) && l.entryDate >= from && l.entryDate <= to && (side === 'in' ? isIn(l) : !isIn(l)))
  .reduce((x, l) => x + Math.round(l.amount * 100), 0) / 100;
const naiveMonths = (first, n) => Array.from({ length: n }, (_, k) => { const t = +first.slice(0, 4) * 12 + (+first.slice(5, 7) - 1) + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; });

shapeIf3c('year crosses a New Year', Y26.firstDay.slice(0, 4) !== Y26.lastDay.slice(0, 4));
shapeIf3c('closed predecessor', !!Y25.closed && previousFiscalYear(Y26, SEP).key === Y25.key);
shapeIf3c('line on the first day', sLines.some(l => l.entryDate === Y25.firstDay || l.entryDate === Y26.firstDay));
shapeIf3c('line on the last day', sLines.some(l => l.entryDate === Y25.lastDay));
shapeIf3c('last year bill paid this year', sAllocations.some(a => a.lineYearKey === Y25.key && a.splits.some(s => s.installments.some(i => i.paidOn && inY(Y26)(i.paidOn)))));
shapeIf3c('off-plan bill straddles the close', sAllocations.some(a => !a.sourceBudgetLineId && a.splits.some(s => s.installments.some(i => inY(Y25)(i.paidOn ?? '')) && s.installments.some(i => inY(Y26)(i.paidOn ?? '')))));
shapeIf3c('own transfer in the closed year', sYearLines(Y25).some(l => isTransfer3b(l) && own.has(l.partnerKind)));
shapeIf3c('other books in both years', sYearLines(Y25).some(l => l.bookKind !== 'org') && sYearLines(Y26).some(l => l.bookKind !== 'org'));
shapeIf3c('pending across the close', sPending.some(l => inY(Y25)(l.entryDate)));

// 10a. THE CARRY: the open year opens on the closed year's stored closing — what its books say on its first day.
const fromBooks26 = (Math.round(sOpening25 * 100) + sPostedC('0000-01-01', '2026-08-31')) / 100;
const sOpen26 = carriedOpening(Y25.closed.closingBalance, fromBooks26);
check('3c carry: opening(2026–27) = closing(2025–26)', sOpen26, sClosing25);
check('3c carry: the closing is what every book the club owns held on its last day', sClosing25, fromBooks26);
check('3c carry: a line backdated into the closed year cannot move the opening', carriedOpening(Y25.closed.closingBalance, fromBooks26 + 999), sClosing25);

// 10b. The open year, September to August.
const rep26 = buildClubReport({ year: Y26, setting: SEP, today: TODAY_S, lines: sPlan26, allocations: sAllocations, requests: [],
  bookLines: sYearLines(Y26), pendingLines: sPending, books: sBooks(), openingBalance: sOpen26, categoryOrder: order });
check('3c the year\'s months run September to August', JSON.stringify(rep26.months.months), JSON.stringify(naiveMonths('2026-09-01', 12)));
check('3c Total revenue Actual (the year to today)', rep26.statement.revenue.actual, sSum(Y26.firstDay, Y26.lastDay, 'in'));
check('3c Total expenses Actual', rep26.statement.expenses.actual, sSum(Y26.firstDay, Y26.lastDay, 'out'));
const earlierRow = rep26.statement.revenue.categories.flatMap(c => c.items).find(i => i.itemId === `${EARLIER_BILLS_PREFIX}${Y25.key}`);
check('3c last year\'s bills paid this year: one row, both of them (the straddle\'s second payment too)', earlierRow?.actual ?? null, 900);
check('3c last year\'s bills row is planned in its own year', earlierRow?.plannedIn ?? null, '2025–26');
for (const lens of ['budget', 'scheduled', 'actual']) {
  const rows = rep26.months.balances[lens].rows;
  rows.forEach((r, i) => {
    check(`3c Months ${lens} ${r.month}: opening + net = closing`, (Math.round(r.opening * 100) + Math.round(r.net * 100)) / 100, r.running);
    if (i > 0) check(`3c Months ${lens} ${r.month} opens on the last close`, r.opening, rows[i - 1].running);
  });
}
check('3c Months · Cash opens September on the carried opening', rep26.months.balances.actual.rows[0].opening, sClosing25);
check('3c Months · Cash: this month (February) closes on Cash on hand', rep26.months.balances.actual.rows.find(r => r.month === '2027-02').running, sCash);
check('3c Cash on hand = every book the club owns, today', rep26.band.cashOnHand, sCash);

// 10c. Quarters from September, named by their months; both views close where the List closes.
const plan26 = buildClubPlan({ year: Y26, today: TODAY_S, lines: sPlan26, allocations: sAllocations, categoryOrder: order, openingBalance: sOpen26 });
const sPlannedIn = sPlan26.filter(l => l.direction === 'in').reduce((x, l) => x + Math.round(l.totalAmount * 100), 0) / 100 + plan26.revenue.fromTheTeams.planned;
const sPlannedOut = sPlan26.filter(l => l.direction === 'out').reduce((x, l) => x + Math.round(l.totalAmount * 100), 0) / 100;
check('3c the plan closes on the carried opening + revenue − expenses', plan26.closingBalance, (Math.round(sClosing25 * 100) + Math.round(sPlannedIn * 100) - Math.round(sPlannedOut * 100)) / 100);
const views26 = withPeriodViews(plan26, sPlan26, order).periodView;
check('3c quarters start in September, named by their months', JSON.stringify(views26.quarters.columns.filter(c => !c.unscheduled).map(c => c.label)), JSON.stringify(['Sep–Nov', 'Dec–Feb', 'Mar–May', 'Jun–Aug']));
check('3c months view: twelve dated columns', views26.months.columns.filter(c => !c.unscheduled).length, 12);
for (const [g, view] of Object.entries(views26)) {
  check(`3c By period (${g}) revenue = the plan's`, view.revenueTotals?.total ?? 0, sPlannedIn);
  check(`3c By period (${g}) expenses = the plan's`, view.expenseTotals.total, sPlannedOut);
  check(`3c By period (${g}) closes where the List closes`, view.balance.seasonClosing, plan26.closingBalance);
  check(`3c By period (${g}) opens on the carried opening`, view.balance.seasonOpening, sClosing25);
  for (const c of view.columns.filter(x => !x.unscheduled)) {
    check(`3c By period (${g}) ${c.key}: opening + net = closing`, view.balance.opening[c.key] + view.balance.net[c.key], view.balance.closing[c.key]);
  }
}

// 10d. The CLOSED year is immovable: its Cash on hand is its stored closing, whatever happens after it.
const rep25 = (extra = []) => buildClubReport({ year: Y25, setting: SEP, today: TODAY_S, lines: sPlan25, allocations: sAllocations, requests: [],
  bookLines: sYearLines(Y25), pendingLines: sPending, books: sBooks(extra), openingBalance: sOpening25, categoryOrder: order });
const later = [SBL({ date: '2027-02-15', amount: 5000, type: 'income', w: W.sponsors })];
check('3c closed year: Cash on hand is its stored closing', rep25().band.cashOnHand, sClosing25);
check('3c closed year: money after it never moves it', rep25(later).band.cashOnHand, sClosing25);
check('3c closed year: Months · Cash ends on its closing', rep25().months.balances.actual.ending, sClosing25);
check('3c closed year: its own bill paid after the close is NOT its money (it counts where it arrived)', rep25().statement.revenue.actual, sSum(Y25.firstDay, Y25.lastDay, 'in'));

// 10e. Against last year: to today, against last year to the same day; last year's bills one row.
const spans26 = compareSpans(Y26, Y25, TODAY_S);
check('3c compare: this year to today', JSON.stringify(spans26.thisSpan), JSON.stringify({ from: '2026-09-01', to: TODAY_S }));
check('3c compare: last year to the same day', JSON.stringify(spans26.lastSpan), JSON.stringify({ from: '2025-09-01', to: '2026-02-15' }));
const alyr = buildAgainstLastYear({ year: Y26, before: Y25, spans: spans26, thisLines: sYearLines(Y26), lastLines: sYearLines(Y25),
  allocations: sAllocations, requests: [], setting: SEP, statementOrder: statementOrder(rep26) });
for (const [side, key] of [['in', 'revenue'], ['out', 'expenses']]) {
  const t = sSum(spans26.thisSpan.from, spans26.thisSpan.to, side), l = sSum(spans26.lastSpan.from, spans26.lastSpan.to, side);
  check(`3c compare ${key}: this year`, alyr[key].thisYear, t);
  check(`3c compare ${key}: last year`, alyr[key].lastYear, l);
  check(`3c compare ${key}: change = this − last`, alyr[key].change, (Math.round(t * 100) - Math.round(l * 100)) / 100);
  check(`3c compare ${key}: categories add up`, alyr[key].categories.reduce((x, c) => x + Math.round(c.thisYear * 100), 0) / 100, alyr[key].thisYear);
}
check('3c compare: earlier years\' bills one row', alyr.revenue.categories.flatMap(c => c.items).find(i => i.itemId === EARLIER_BILLS_PREFIX)?.thisYear ?? null, 900);
check('3c compare: net change', alyr.net.change, (Math.round(alyr.net.thisYear * 100) - Math.round(alyr.net.lastYear * 100)) / 100);

// 10f. The year-end report: read only from locked figures; the club's books at both ends.
const booksAt = Object.keys(sOpeningByBook).map(id => ({ id, name: id, kind: sKind[id],
  atStart: sOpeningByBook[id],
  atEnd: (Math.round(sOpeningByBook[id] * 100) + sLines.filter(l => l.ledgerId === id && l.status === 'posted' && l.entryDate <= Y25.lastDay).reduce((a, l) => a + walkSigned(l), 0)) / 100 }));
const ye = buildYearEndReport({ year: Y25, closedByName: 'Treasurer', opening: sOpening25, report: rep25(), againstLastYear: null, books: booksAt,
  snapshot: { installments: { count: 0, amount: 0, overdue: 0, sent: 0, upcoming: 0 }, requests: { count: 0, amount: 0 }, unfiled: { count: 0, amount: 0 },
    pending: { count: 1, amount: 80 }, teams: [], totals: { billed: 0, collected: 0, owed: 0 } },
  nextYear: nextFiscalYear(Y25, SEP) });
const otherNet25 = sPostedC(Y25.firstDay, Y25.lastDay, l => l.bookKind !== 'org' && !(isTransfer3b(l) && own.has(l.partnerKind))) / 100;
check('3c year-end: closes on the stored closing', ye.atAGlance.closing, sClosing25);
check('3c year-end: the books at the start add to the opening', ye.booksTotal.atStart, sOpening25);
check('3c year-end: the books at the end add to the closing', ye.booksTotal.atEnd, sClosing25);
check('3c year-end: closing − opening = the net + the other books\' movement',
  (Math.round(ye.atAGlance.closing * 100) - Math.round(ye.atAGlance.opening * 100)) / 100, (Math.round(ye.atAGlance.net * 100) + Math.round(otherNet25 * 100)) / 100);
check('3c year-end: what carried names the next year', ye.carried.nextYear.name, '2026–27');

// 10g. The SHORT year a change of first month makes (January → September from 2027): eight months, three quarters.
const SHORT = { firstMonth: 9, rows: [
  { id: 'fy-26', name: '2026', firstDay: '2026-01-01', lastDay: '2026-12-31', closedAt: null, closedBy: null, closingBalance: null },
  { id: 'fy-27', name: '2027', firstDay: '2027-01-01', lastDay: '2027-08-31', closedAt: null, closedBy: null, closingBalance: null }] };
const YS = fiscalYearOf('2027-03-01', SHORT);
shapeIf3c('short year', YS.months < 12);
const shortPlan = [PL('X-diamond', W.diamond, 2400, 'out', [['2027-02-15', 1200], ['2027-07-15', 1200]]), PL('X-spon', W.sponsors, 1000, 'in', [['2027-08-31', 1000]])];
const planS = buildClubPlan({ year: YS, today: '2027-03-01', lines: shortPlan, allocations: [], categoryOrder: order, openingBalance: 5000 });
const viewsS = withPeriodViews(planS, shortPlan, order).periodView;
check('3c short year: eight months', JSON.stringify(fiscalYearMonths(YS)), JSON.stringify(naiveMonths('2027-01-01', 8)));
check('3c short year: eight dated month columns', viewsS.months.columns.filter(c => !c.unscheduled).length, 8);
check('3c short year: three quarters, the last one shorter', JSON.stringify(viewsS.quarters.columns.filter(c => !c.unscheduled).map(c => c.label)), JSON.stringify(fiscalQuarters(YS).map(q => q.label)));
check('3c short year: its quarters are Jan–Mar, Apr–Jun, Jul–Aug', JSON.stringify(fiscalQuarters(YS).map(q => q.label)), JSON.stringify(['Jan–Mar', 'Apr–Jun', 'Jul–Aug']));
for (const [g, view] of Object.entries(viewsS)) {
  check(`3c short year By period (${g}) closes where the List closes`, view.balance.seasonClosing, planS.closingBalance);
  check(`3c short year By period (${g}) closes on opening + 1,000 − 2,400`, view.balance.seasonClosing, 3600);
}
const repS = buildClubReport({ year: YS, setting: SHORT, today: '2027-03-01', lines: shortPlan, allocations: [], requests: [], bookLines: [], pendingLines: [],
  books: [{ id: 'general', kind: 'org', name: 'general', balance: 5000 }], openingBalance: 5000, categoryOrder: order });
check('3c short year: Months has eight rows', repS.months.balances.budget.rows.length, 8);
check('3c short year: Months · Budget ends where the plan closes', repS.months.balances.budget.ending, planS.closingBalance);
check('3c short year against the twelve before it: the same months',
  JSON.stringify(compareSpans(YS, fiscalYearOf('2026-03-01', SHORT), '2027-10-01')), JSON.stringify({ thisSpan: { from: '2027-01-01', to: '2027-08-31' }, lastSpan: { from: '2026-01-01', to: '2026-08-31' } }));

// ── Report ──────────────────────────────────────────────────────────────────────────────────────
const REQUIRED = [
  'installment:received', 'installment:sent', 'installment:overdue', 'installment:upcoming', 'due-today',
  'window-edge-inside', 'window-edge-outside', 'sent-after-due', 'sent-then-confirmed', 'undone', 'cents',
  'request:approved', 'request:reversed', 'book:>1000 rows', 'book:pending', 'book:void', 'book:transfers',
  '3b plan:many allocations per line', '3b plan:billed above its total', '3b plan:revenue line', '3b loop:before-3a link',
  '3b book:own transfer', '3b book:other books', '3b word:off-plan', '3b word:not filed', '3b request:waiting both ways',
  '3b book:pending own transfer', '3b book:pending from last year', '3b installment:last year\'s bill still owed',
  '3c year crosses a New Year', '3c closed predecessor', '3c line on the first day', '3c line on the last day',
  '3c last year bill paid this year', '3c off-plan bill straddles the close', '3c own transfer in the closed year',
  '3c other books in both years', '3c pending across the close', '3c short year',
];
const missing = REQUIRED.filter(s => !shapes.has(s));
console.log(`check:club-money-arithmetic — ${installments.length} installments, ${lines.length} ledger lines; shapes: ${[...shapes].sort().join(', ')}`);
if (missing.length) {
  console.error(`✗ The fixture lost shapes that could disagree: ${missing.join(', ')} — a green run over it would prove nothing.`);
  process.exit(2);
}
if (failures.length) {
  console.error(`✗ ${failures.length} club money figure(s) disagree with the independent walk:`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('✓ every club money figure agrees with the independent walk, at every level.');
