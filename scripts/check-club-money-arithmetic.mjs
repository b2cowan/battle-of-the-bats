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

// ── Report ──────────────────────────────────────────────────────────────────────────────────────
const REQUIRED = [
  'installment:received', 'installment:sent', 'installment:overdue', 'installment:upcoming', 'due-today',
  'window-edge-inside', 'window-edge-outside', 'sent-after-due', 'sent-then-confirmed', 'undone', 'cents',
  'request:approved', 'request:reversed', 'book:>1000 rows', 'book:pending', 'book:void', 'book:transfers',
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
