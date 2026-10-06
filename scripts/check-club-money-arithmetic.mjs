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
  id, seasonYear: Y, categoryId: w?.categoryId ?? 'c-admin', categoryName: w?.categoryName ?? 'Administration',
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
  { id: 'A1', description: 'Diamond fees 2026', createdOn: '2026-03-01', sourceBudgetLineId: 'L-diamond', lineYear: Y, splits: [
    SPL('A1', 'T-11U', 6075, [{ due: '2026-05-15', paidOn: '2026-05-10' }]),
    SPL('A1', 'T-10U', 6075, [{ due: '2026-05-15' }]) ] },                                         // overdue
  { id: 'A2', description: 'Diamond permits, fall top-up', createdOn: '2026-09-20', sourceBudgetLineId: 'L-diamond', lineYear: Y, splits: [
    SPL('A2', 'T-11U', 925, [{ due: '2026-10-15', sentOn: '2026-09-29' }]),                         // sent, not received
    SPL('A2', 'T-10U', 925, [{ due: '2026-10-15' }]) ] },
  { id: 'A3', description: 'Uniform order, Girls', createdOn: '2026-04-01', sourceBudgetLineId: 'L-unif', lineYear: Y, splits: [
    SPL('A3', 'T-16G', 3375, [{ due: '2026-06-01', paidOn: '2026-06-01' }]),
    SPL('A3', 'T-14G', 3375, [{ due: '2026-11-01' }]) ] },
  { id: 'A4', description: 'Bus to provincials', createdOn: '2026-06-20', sourceBudgetLineId: null, lineYear: null, splits: [
    SPL('A4', 'T-14G', 500, [{ due: '2026-07-01', paidOn: '2026-07-05', entry: 'A4-team-half' }]) ] },  // no line: the year of its first due
  { id: 'A5', description: 'Spring training 2025', createdOn: '2025-11-01', sourceBudgetLineId: 'L-2025', lineYear: 2025, splits: [
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

const plan = buildClubPlan({ year: Y, today: TODAY, lines: planLines, allocations, categoryOrder: order, openingBalance: opening3b });
// Cash on hand's caption is today's: every pending line on the Club books, whatever its date — last year's
// uncleared cheque included (it is not in the year's lines).
const priorPending = [BL({ date: '2025-12-20', amount: 75, type: 'expense', status: 'pending', w: W.umpires })];
const pendingLines = [...bookLines, ...priorPending].filter(l => l.status === 'pending' && l.bookKind === 'org');
const rep = buildClubReport({ year: Y, today: TODAY, lines: planLines, allocations, requests, bookLines, pendingLines, books: books3b, openingBalance: opening3b, categoryOrder: order });

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
shapeIf('loop:last year bill paid this year', allocations.some(a => a.lineYear != null && a.lineYear < Y && a.splits.some(s => s.installments.some(i => i.paidAt))));
shapeIf('loop:no line', allocations.some(a => !a.sourceBudgetLineId));
shapeIf('request:on request', requests.some(r => r.requestType === 'payment_to_org' && r.status === 'approved'));
shapeIf('request:paid to a team', requests.some(r => r.requestType === 'charge_to_org' && r.status === 'approved'));
shapeIf('request:waiting both ways', ['payment_to_org', 'charge_to_org'].every(t => requests.some(r => r.requestType === t && r.status === 'pending')));
shapeIf('request:reversed (void)', bookLines.some(l => l.status === 'void' && loopKeys.has(l.category)));
shapeIf('book:pending', bookLines.some(l => l.status === 'pending'));
shapeIf('book:pending own transfer', bookLines.some(l => l.status === 'pending' && isTransfer3b(l) && l.bookKind === 'org' && ['org', 'tournament', 'league_season'].includes(l.partnerKind)));
shapeIf('book:pending from last year', pendingLines.some(l => l.entryDate < `${Y}-01-01`));
shapeIf('installment:last year\'s bill still owed', allocations.some(a => a.lineYear != null && a.lineYear < Y && a.splits.some(s => s.installments.some(i => !i.paidAt && i.dueDate.startsWith(`${Y}-`)))));
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
  .flatMap(a => a.splits.flatMap(s => s.installments)).filter(i => !i.paidAt && i.dueDate.startsWith(`${Y}-`)).reduce((x, i) => x + Math.round(i.amount * 100), 0)
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
  report: rep, allocations, requests: requests.map(r => ({ ...r, holdingPayout: r.id === 'R-wait-out' })), books: books3b,
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

// ── Report ──────────────────────────────────────────────────────────────────────────────────────
const REQUIRED = [
  'installment:received', 'installment:sent', 'installment:overdue', 'installment:upcoming', 'due-today',
  'window-edge-inside', 'window-edge-outside', 'sent-after-due', 'sent-then-confirmed', 'undone', 'cents',
  'request:approved', 'request:reversed', 'book:>1000 rows', 'book:pending', 'book:void', 'book:transfers',
  '3b plan:many allocations per line', '3b plan:billed above its total', '3b plan:revenue line', '3b loop:before-3a link',
  '3b book:own transfer', '3b book:other books', '3b word:off-plan', '3b word:not filed', '3b request:waiting both ways',
  '3b book:pending own transfer', '3b book:pending from last year', '3b installment:last year\'s bill still owed',
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
