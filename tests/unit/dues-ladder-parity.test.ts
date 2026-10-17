/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * A FAMILY'S MONEY IS THE TEAM'S MONEY — ONE DERIVATION, TWO READERS (Club Tier Stage 5a, E03)
 *
 * The coach's Player dues table and the club's Families record both read a child's Dues · Paid · Balance through
 * `seasonDuesFigures` (lib/dues-ladder.ts). Before Stage 5a the table's ladder and Balance were assembled inside the
 * coach's dues route, and Families read the installment paid STAMP instead — the walk found Families at $750.00 paid
 * where the team's Money hub read $0.00 (the fixture recorded stamps and no payments).
 *
 * Three things are held here:
 *   1. THE EXTRACTION MOVED NOTHING. `seasonDuesFigures` equals the route's own pre-Stage-5a arithmetic — copied
 *      below, deliberately, in the order the route ran it — on every case: a part payment, a credit of EACH kind, a
 *      payout, an overpayment, a forgiven balance, no schedule at all.
 *   2. THE LADDER CLOSES: Dues − Fundraising − Other credits − Paid + Handed back = Balance, where the family's own
 *      money stands behind its overpayment credits.
 *   3. BOTH READERS CALL IT, and neither reassembles the ladder itself (a third copy is how the two part company).
 * The database-level half — every rep player on the test club and on UAT Rep Club, Families' Balance against the
 * coach's — is the read-only probe in the Stage 5a record (it needs the dev server and two sign-ins).
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { seasonDuesFigures, type SeasonDuesRows } from '../../lib/dues-ladder.ts';
import { duesPaidAmount, splitDuesLadder } from '../../lib/dues-payments.ts';
import { outstandingForSchedule } from '../../lib/dues-status.ts';
import { creditsTotal, amountsTotal, deriveDuesPosition } from '../../lib/dues-credits.ts';
import { buildFamilyDuesInputs, duesActual, type DuesCreditKind } from '../../lib/coach-dues-actual.ts';

type Credit = SeasonDuesRows['credits'][number];
const credit = (id: string, playerId: string, kind: DuesCreditKind, amount: number, creditDate: string, extra: Partial<Credit> = {}): Credit =>
  ({ id, playerId, kind, amount, creditDate, createdAt: `${creditDate}T12:00:00Z`, traced: kind === 'fundraiser' || kind === 'reimbursement', ...extra });

/** The coach's dues route, as it computed one player before Stage 5a (route.ts, git history) — independent of the module. */
function routeBefore(rows: SeasonDuesRows, playerId: string) {
  const schedule = rows.schedules.find(s => s.playerId === playerId);
  const payments = rows.payments.filter(p => p.playerId === playerId);
  const payouts = rows.payouts.filter(p => p.playerId === playerId);
  const credits = rows.credits.filter(c => c.playerId === playerId);
  const duesActualByPlayer = buildFamilyDuesInputs({
    schedules: rows.schedules, payments: rows.payments, payouts: rows.payouts,
    credits: [...rows.credits]
      .sort((a, b) => String(a.creditDate).localeCompare(String(b.creditDate)) || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))
      .map(c => ({ playerId: c.playerId, kind: c.kind, amount: c.amount, traced: c.traced, paidBack: c.paidBack })),
  });
  const paymentsTotal = payments.reduce((s, pay) => s + pay.amount, 0);
  const cappedPaid = schedule ? duesPaidAmount(paymentsTotal, schedule.total) : 0;
  const outstanding = outstandingForSchedule(schedule ? { totalAmount: schedule.total } : null, cappedPaid);
  const creditsIssuedTotal = creditsTotal(credits);
  const { position } = deriveDuesPosition({
    installments: [], payments: [],
    credits: credits.map(c => ({ id: c.id, amount: c.amount, creditType: c.kind, creditDate: c.creditDate ?? '', createdAt: c.createdAt })),
    paidOut: amountsTotal(payouts), mode: rows.mode,
  });
  const netCredits = Math.max(0, Math.round((creditsIssuedTotal - position.paidOut) * 100) / 100);
  const contribution = duesActualByPlayer.has(playerId) ? duesActual(duesActualByPlayer.get(playerId)!) : null;
  const ladder = splitDuesLadder({
    dues: schedule?.total ?? 0,
    grossPayments: amountsTotal(payments),
    cappedPaid,
    creditsIssued: creditsIssuedTotal,
    fundraiserIssued: creditsTotal(credits.filter(c => c.kind === 'fundraiser')),
    overpaymentIssued: creditsTotal(credits.filter(c => c.kind === 'overpayment')),
    paidOut: position.paidOut,
    billLowered: contribution?.billLowered.total ?? 0,
  });
  return { ladder, balance: Math.round((outstanding - netCredits) * 100) / 100 };
}

const ROWS: SeasonDuesRows = {
  mode: 'next_first',
  schedules: [
    { playerId: 'riley', total: 450 },      // part-paid: $300 + $50 of the third $150
    { playerId: 'morgan', total: 450 },     // paid in full
    { playerId: 'sasha', total: 450 },      // a credit of every kind
    { playerId: 'tatum', total: 450 },      // nothing paid
    { playerId: 'casey', total: 300 },      // overpaid, its own money held as an overpayment credit
    { playerId: 'blake', total: 400 },      // a fundraiser rebate, half handed back
    { playerId: 'drew', total: 500 },       // a forgiven balance (the bill lowered)
  ],
  payments: [
    { playerId: 'riley', amount: 150 }, { playerId: 'riley', amount: 150 }, { playerId: 'riley', amount: 50 },
    { playerId: 'morgan', amount: 450 },
    { playerId: 'sasha', amount: 100 },
    { playerId: 'casey', amount: 350 },
    { playerId: 'blake', amount: 400 },
    { playerId: 'drew', amount: 200 },
  ],
  payouts: [{ playerId: 'blake', amount: 75 }],
  credits: [
    credit('c1', 'sasha', 'fundraiser', 40, '2026-05-01'),
    credit('c2', 'sasha', 'sponsorship', 25, '2026-05-02'),
    credit('c3', 'sasha', 'reimbursement', 30, '2026-05-03'),
    credit('c4', 'sasha', 'contribution', 15, '2026-05-04'),
    credit('c5', 'sasha', 'overpayment', 10, '2026-05-05'),
    credit('c6', 'sasha', 'forgiven', 20, '2026-05-06'),
    credit('c7', 'sasha', 'other', 5, '2026-05-07'),
    credit('c8', 'casey', 'overpayment', 50, '2026-06-01'),
    credit('c9', 'blake', 'fundraiser', 150, '2026-06-10', { paidBack: 75 }),
    credit('c10', 'drew', 'forgiven', 100, '2026-07-01'),
  ],
};
const PLAYERS = [...ROWS.schedules.map(s => s.playerId), 'nobody'];

describe('E03 — the extraction moved nothing: seasonDuesFigures equals the route’s own arithmetic', () => {
  const figures = seasonDuesFigures(ROWS, PLAYERS);
  for (const id of PLAYERS) {
    it(`${id}: the same ladder and the same Balance`, () => {
      const before = routeBefore(ROWS, id);
      const f = figures.get(id)!;
      assert.deepEqual(f.ladder, before.ladder, `${id}'s ladder moved`);
      assert.equal(f.balance, before.balance, `${id}'s Balance moved`);
    });
  }

  it('a part payment reads as what was PAID, not as a whole installment stamp', () => {
    const riley = figures.get('riley')!;
    assert.equal(riley.ladder.paid, 350);
    assert.equal(riley.balance, 100);
  });

  it('no schedule and no rows reads all zeros (never a missing entry)', () => {
    const n = figures.get('nobody')!;
    assert.equal(n.balance, 0);
    assert.equal(n.ladder.dues, 0);
    assert.equal(n.ladder.paid, 0);
  });
});

describe('E03 — the ladder closes on the Balance', () => {
  const figures = seasonDuesFigures(ROWS, PLAYERS);
  for (const id of ['riley', 'morgan', 'sasha', 'tatum', 'casey', 'blake', 'drew']) {
    it(`${id}: Dues − Fundraising − Other credits − Paid + Handed back = Balance`, () => {
      const { ladder: l, balance } = figures.get(id)!;
      const c = (n: number) => Math.round(n * 100);
      assert.equal(c(l.dues) - c(l.fundraising) - c(l.otherCredits) - c(l.paid) + c(l.handedBack), c(balance));
    });
  }
});

describe('E03 — both readers call the one derivation, and neither reassembles the ladder', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const route = strip(readFileSync('app/api/coaches/[orgSlug]/teams/[teamId]/dues/route.ts', 'utf8'));
  const families = strip(readFileSync('lib/families-read.ts', 'utf8'));
  it('the coach’s dues route calls seasonDuesFigures', () => assert.match(route, /seasonDuesFigures\(/));
  it('the Families read calls seasonDuesFigures', () => assert.match(families, /seasonDuesFigures\(/));
  for (const [name, src] of [['the coach’s dues route', route], ['the Families read', families]] as const) {
    it(`${name} never calls splitDuesLadder or duesPaidAmount itself`, () => {
      assert.doesNotMatch(src, /splitDuesLadder\(|duesPaidAmount\(/, `${name} reassembles the ladder — a third copy`);
    });
  }
  it('Families no longer reads the installment paid stamp as money', () => {
    assert.doesNotMatch(families, /paid_at\)[\s\S]{0,80}toCents\(i\.amount\)/);
  });
});
