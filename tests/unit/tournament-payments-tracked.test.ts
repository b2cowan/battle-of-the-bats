/**
 * "NOT TRACKED HERE" MEANS NO PAYMENTS ANYWHERE (owner 2026-10-13). The Fee model's fourth choice (stored
 * `fee_scope: 'free'`) means the organizer is not tracking payments on the platform, so no surface shows a fee,
 * an amount owed, "Paid", "Unpaid", a payment filter, a payment email or a payment column for that event —
 * whatever fee or how-to-pay text was typed before the switch (it stays stored; switching back brings it back).
 *
 * The finding that started it: Teams showed an amber "Unpaid" on every accepted team of a "Not tracked here"
 * event, under a Registration health that said "nothing missing" — the row fell back to a manual paid flag that
 * starts off for every team, and no payment surface read the setting at all.
 *
 * This file holds the shared pieces (the answer, the attention buckets, the health score, the coach's status,
 * the payment email) and the census: every file that reads an event's fee set-up either reads the answer or is
 * listed below with why it doesn't need to — so a new payment surface can't forget it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tournamentTracksPayments } from '../../lib/tournament-payments-tracked';
import { buildRegistrationAttentionSummary, type RegistrationAttentionContext } from '../../lib/registration-attention';
import { buildRegistrationHealth } from '../../lib/registration-health';
import { buildCoachTournamentStatus } from '../../lib/coach-status-model';
import { coachEmailBlock, coachEmailEnabled } from '../../lib/coach-email-rules';

describe('the answer', () => {
  it('"Not tracked here" (stored `free`) is the only setting that turns payments off', () => {
    assert.equal(tournamentTracksPayments({ fee_scope: 'free' }), false);
    for (const scope of ['tournament', 'allow_override', 'per_division', null, undefined]) {
      assert.equal(tournamentTracksPayments({ fee_scope: scope }), true, `fee_scope ${String(scope)}`);
    }
    assert.equal(tournamentTracksPayments({}), true, 'no fee model chosen yet still tracks');
    assert.equal(tournamentTracksPayments(null), true);
    assert.equal(tournamentTracksPayments(undefined), true);
  });
});

// A $450 fee typed before the switch, due long ago: tracked, both teams are owed money and one is past due.
const TODAY = '2026-07-01';
const teams = [
  { id: 'a', divisionId: 'u13', status: 'accepted', paymentStatus: 'pending', depositPaid: 0, totalPaid: 0, email: 'a@x.ca' },
  { id: 'b', divisionId: 'u13', status: 'accepted', paymentStatus: 'paid', depositPaid: 0, totalPaid: 0, email: 'b@x.ca' },
];
const context = (tracksPayments?: boolean): RegistrationAttentionContext => ({
  divisions: [{ id: 'u13', name: 'U13' }],
  feeMode: 'tournament',
  feeSchedule: { depositAmount: null, depositDueDate: null, totalFeeAmount: 450, totalFeeDueDate: '2026-06-01' },
  tracksPayments,
  today: TODAY,
});
const count = (summary: ReturnType<typeof buildRegistrationAttentionSummary>, key: string) =>
  summary.buckets.find(b => b.key === key)?.count ?? 0;

describe('the attention buckets and the health score', () => {
  it('tracked, the stored fee makes both teams past due', () => {
    assert.equal(count(buildRegistrationAttentionSummary(teams, context()), 'past_due'), 2);
  });

  it('not tracked, nobody is Unpaid or Past due — whatever fee was typed before', () => {
    const summary = buildRegistrationAttentionSummary(teams, context(false));
    assert.equal(count(summary, 'unpaid'), 0);
    assert.equal(count(summary, 'past_due'), 0);
  });

  it('not tracked, the health score has no Payments figure and scores nothing against payments', () => {
    const attention = buildRegistrationAttentionSummary(teams, context());
    const health = buildRegistrationHealth({ attention, teamsTotal: 2, accepted: 2, paymentsTracked: true, eventTracksPayments: false, capacityGaps: [] });
    assert.equal(health.eventTracksPayments, false);
    assert.equal(health.pastDue, 0);
    assert.equal(health.unpaid, 0);
    assert.equal(health.score, 100);
    assert.ok(!health.issues.some(i => i.key === 'past_due' || i.key === 'unpaid'));
  });

  it('an event that tracks payments keeps its figure (the flag defaults to tracked)', () => {
    const attention = buildRegistrationAttentionSummary(teams, context());
    const health = buildRegistrationHealth({ attention, teamsTotal: 2, accepted: 2, paymentsTracked: true, capacityGaps: [] });
    assert.equal(health.eventTracksPayments, true);
    assert.equal(health.pastDue, 2);
  });
});

describe("the coach's status", () => {
  const input = (tracksPayments?: boolean, paymentStatus = 'pending') => ({
    team: {
      divisionId: 'u13', paymentStatus, depositPaid: 0, totalPaid: 0, checkInStatus: null, checkedInAt: null,
      rosterSubmittedAt: null, rosterConfirmedAt: null, paymentCollectedAt: '2026-06-02T15:00:00Z',
    },
    tournament: { feeMode: 'tournament', tracksPayments, depositAmount: null, depositDueDate: null, totalFeeAmount: 450, totalFeeDueDate: '2026-08-01' },
    division: null,
    today: TODAY,
  });

  it('tracked: the coach sees what they owe', () => {
    const { fee } = buildCoachTournamentStatus(input());
    assert.equal(fee.hasSchedule, true);
    assert.equal(fee.amountDue, 450);
  });

  it('not tracked: no fee, no amount, no due date — and never "Paid", even for a team marked paid', () => {
    for (const paymentStatus of ['pending', 'paid']) {
      const { fee } = buildCoachTournamentStatus(input(false, paymentStatus));
      assert.equal(fee.hasSchedule, false);
      assert.equal(fee.amountDue, null);
      assert.equal(fee.dueDate, null);
      assert.equal(fee.isPaid, false);
      assert.equal(fee.collectedAt, null);
    }
  });
});

describe('the payment email', () => {
  const team = { email: 'coach@x.ca' };
  it('never sends for an event that does not track payments, whatever its switch says', () => {
    assert.equal(coachEmailEnabled({ fee_scope: 'free', coach_email_payment: true }, 'payment'), false);
    assert.equal(coachEmailBlock({ fee_scope: 'free' }, 'payment', team), 'off');
  });

  it('leaves every other email, and a tracked event, as they were', () => {
    assert.equal(coachEmailEnabled({ fee_scope: 'free' }, 'acceptance'), true);
    assert.equal(coachEmailEnabled({ fee_scope: 'tournament' }, 'payment'), true);
    assert.equal(coachEmailEnabled({}, 'payment'), true);
    assert.equal(coachEmailEnabled({ fee_scope: 'tournament', coach_email_payment: false }, 'payment'), false);
  });
});

// ── The census ──────────────────────────────────────────────────────────────────────────────────────────────────

const ROOT = join(import.meta.dirname, '..', '..');
const FEE_READ = /fee_schedule_mode|feeScheduleMode|total_fee_amount|totalFeeAmount/;

/** Files that read an event's fee set-up WITHOUT reading the answer themselves, and why that is right. A new file
 *  that reads fees fails here until it reads `tournamentTracksPayments` or is added with its reason. */
const EXEMPT: Record<string, string> = {
  'app/[orgSlug]/admin/tournaments/settings/event/page.tsx': 'the setting\'s own home — it reads `free` as the Fee model\'s choice',
  'app/[orgSlug]/admin/tournaments/divisions/DivisionRecord.tsx': 'a set-up screen that reads `free` itself (no fee line under it)',
  'app/api/admin/divisions/route.ts': 'saves a division\'s fee set-up; shows no payment',
  'app/api/admin/tournaments/route.ts': 'saves the event\'s settings and fee set-up',
  'app/dev/email-preview/page.tsx': 'dev-only template preview',
  'lib/coach-status-model.ts': 'takes `tracksPayments` from its callers, which read the answer',
  'lib/registration-attention.ts': 'takes `tracksPayments` in its context from its callers, which read the answer',
  'lib/email.ts': 'templates take `paymentsTracked` from the routes that send them, which read the answer',
  'lib/tournament-teams.ts': 'pure fee arithmetic; the Teams screen reads the answer before calling it',
  'lib/registration-amount-due.ts': 'pure fee arithmetic; the payment-reminders route and lib/needs-attention.ts read the answer before calling it',
  'lib/mark-paid.ts': 'the paid-in-full stamp, reached only from Mark paid, which an untracked event never offers',
  'lib/event-recap-read.ts': 'loads the rows; lib/event-recap.ts reads the answer',
  'lib/tournament-board-words.ts': 'the dashboard\'s fee words read `free` as "Not tracked here" themselves',
  'lib/tournament-setup-copy.ts': 'copies an event\'s set-up into next year\'s',
  'lib/db.ts': 'data access and copying an event; shows no payment',
  'lib/demo-moments.ts': 'the demo sandbox\'s seeded events (both track payments)',
  'lib/types.ts': 'types',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

describe('every surface that reads a fee reads the answer (the census)', () => {
  const files = ['app', 'components', 'lib'].flatMap(d => walk(join(ROOT, d)))
    .map(p => ({ rel: relative(ROOT, p).split(sep).join('/'), src: readFileSync(p, 'utf8') }))
    .filter(f => FEE_READ.test(f.src));

  it('finds the fee readers it expects (the census is not reading an empty tree)', () => {
    assert.ok(files.length >= 20, `only ${files.length} files read a fee`);
  });

  // The plan-aware answer (`eventPayments` / `eventAreas`, lib/invite-only-event — the free tournament tier, 2026-10-16)
  // reads `tournamentTracksPayments` itself and adds the plan: a screen that reads it reads the answer.
  it('each reads `tournamentTracksPayments` (or the plan-aware answer) or is exempt with a reason', () => {
    const readsAnswer = (src: string) => /tournamentTracksPayments|eventPayments\(|eventAreas\(/.test(src);
    const missing = files.filter(f => !readsAnswer(f.src) && !(f.rel in EXEMPT)).map(f => f.rel);
    assert.deepEqual(missing, [], 'a file reads an event\'s fee set-up but not whether the event tracks payments');
  });

  it('every exemption still reads a fee (a stale entry is removed, not left to hide a file)', () => {
    const readers = new Set(files.map(f => f.rel));
    assert.deepEqual(Object.keys(EXEMPT).filter(rel => !readers.has(rel)), []);
  });
});
