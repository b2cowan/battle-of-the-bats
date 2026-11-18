/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * FREE TIME ON AN ENDED CLUB (owner ruling 2026-11-18; prompt docs/projects/active/FREE_TIME_ENDED_CLUB_BUILD_PROMPT.md).
 *
 *   1 · the give: billing-status free time on an ended club carries the mark (and reopens it); on a club still running, or
 *       a plan or sections, it does not
 *   2 · the end: closed again only when the reopening free time is over and the club still hasn't paid; once
 *   3 · the daily job: a date-ended club closed again, a running one left alone, a failure reported, never stopping the next
 *   4 · the countdown pauses while the club is let in (a cancellation's records only)
 *   5 · the wiring: the one restore, the one ending (a fresh 90 days, the owners told, not a second churn), every end path
 *   6 · the Story and the windows say what happens
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideGive, isReopeningGrant, REOPENED_ENDED_CLUB, type ClubFacts, type GiveContext } from '../../lib/free-time.ts';
import {
  CLOSE_AGAIN_FAILED_WARNING, REOPEN_FAILED_WARNING, closeAgainExpiredFreeTime, closeAgainIfFreeTimeOver, countdownPaused,
  reopenOnGive, shouldCloseAgain, type CloseAgainFacts, type GrantFacts, type ReopenDeps,
} from '../../lib/free-time-reclose.ts';
import { freeTimeStoryEntries, CLOSES_AGAIN_WORDS } from '../../lib/free-time-story.ts';
import { functionBody, readCode, readSource } from './_source-code.ts';

const NOW = new Date('2026-11-18T16:00:00.000Z');
const OPEN: GiveContext = { switchOn: true, staffIsMember: false, isDemo: false };
const CLUB: ClubFacts = { id: 'c1', name: 'Riverside', planId: 'tournament', accountKind: 'organization', payingThroughStripe: false, runningPlanGrant: null };
const ENDED: ClubFacts = { ...CLUB, planEnded: true };
const STATUS = { kind: 'subscription_status', lastDay: '2026-12-15', reason: 'A favour', role: 'billing' };

const MARK = { [REOPENED_ENDED_CLUB]: true };
const grant = (over: Partial<GrantFacts> = {}): GrantFacts => ({
  type: 'subscription_status', target: MARK, starts_at: '2026-11-01T00:00:00.000Z', expires_at: '2026-11-10T05:00:00.000Z', revoked_at: null, ...over,
});
const facts = (over: Partial<CloseAgainFacts> = {}): CloseAgainFacts => ({
  storedStatus: 'canceled', suspended: false, isCoachesPortal: false, doorStatus: 'canceled', grants: [grant()], ...over,
});

describe('1 · the give', () => {
  it('billing-status free time on an ended club carries the mark', () => {
    const r = decideGive(STATUS, ENDED, OPEN, NOW);
    assert.ok(r.ok);
    assert.deepEqual(r.row.target, MARK);
    assert.equal(isReopeningGrant(r.row), true);
  });

  it('on a club whose plan is running: no mark (it reads as active, nothing to bring back)', () => {
    const r = decideGive(STATUS, CLUB, OPEN, NOW);
    assert.ok(r.ok);
    assert.equal(r.row.target, null);
    assert.equal(isReopeningGrant(r.row), false);
  });

  it('a plan or sections on an ended club: no mark (they do not let it in)', () => {
    const plan = decideGive({ ...STATUS, kind: 'plan_tier', plan: 'club' }, ENDED, OPEN, NOW);
    const sections = decideGive({ ...STATUS, kind: 'module_addon', addons: ['module_accounting'] }, ENDED, OPEN, NOW);
    assert.ok(plan.ok && sections.ok);
    assert.equal(isReopeningGrant(plan.row), false);
    assert.equal(isReopeningGrant(sections.row), false);
  });

  it('the give restores; a failed restore is a warning, never a failed give', async () => {
    const restored: string[] = [];
    assert.equal(await reopenOnGive('c1', { restore: async id => { restored.push(id); } }), null);
    assert.deepEqual(restored, ['c1']);
    assert.equal(await reopenOnGive('c1', { restore: async () => { throw new Error('db down'); } }), REOPEN_FAILED_WARNING);
  });

  it('giveFreeTime runs the restore after the row and the grant, only for a reopening grant', () => {
    const body = functionBody(readCode('lib/free-time-writes.ts'), 'giveFreeTime');
    assert.match(body, /isReopeningGrant\(decision\.row\) \? await reopenEndedClub\(club\.id\) : null/);
    assert.ok(body.indexOf('reopenEndedClub') > body.indexOf(".from('org_overrides')"), 'the restore runs after the grant is saved');
    assert.match(readCode('lib/free-time-writes.ts'), /planEnded: club\.subscription_status === 'canceled'/);
  });
});

describe('2 · the end', () => {
  it('closes again when the reopening free time is over and the club has not paid', () => {
    assert.equal(shouldCloseAgain(facts(), NOW), true);
    assert.equal(shouldCloseAgain(facts({ grants: [grant({ expires_at: '2026-12-16T05:00:00.000Z', revoked_at: '2026-11-18T15:00:00.000Z' })] }), NOW), true, 'ended early');
  });

  it('never while billing-status free time still runs (this grant or another)', () => {
    assert.equal(shouldCloseAgain(facts({ doorStatus: 'active', grants: [grant({ expires_at: '2026-12-16T05:00:00.000Z' })] }), NOW), false);
    assert.equal(shouldCloseAgain(facts({ grants: [grant(), grant({ target: null, expires_at: null })] }), NOW), false);
  });

  it('never a club that paid, one already closed again, a Coaches Portal, or one free time never reopened', () => {
    assert.equal(shouldCloseAgain(facts({ storedStatus: 'active', doorStatus: 'active' }), NOW), false, 'paid meanwhile');
    assert.equal(shouldCloseAgain(facts({ suspended: true }), NOW), false, 'already closed');
    assert.equal(shouldCloseAgain(facts({ isCoachesPortal: true }), NOW), false, 'a portal');
    assert.equal(shouldCloseAgain(facts({ grants: [grant({ target: null })] }), NOW), false, 'unmarked: the club was running when it was given');
    assert.equal(shouldCloseAgain(facts({ grants: [] }), NOW), false, 'cancelled before the suspension stamp existed, never given free time');
  });

  it('gives the first ending’s kept records the fresh 90 days FIRST, then closes through the one ending', async () => {
    const w = world({ 'c1': facts() });
    const r = await closeAgainIfFreeTimeOver('c1', { door: 'operator', userId: null, email: 'staff@example.com' }, w.deps);
    assert.deepEqual(r, { closed: true, retentionUntil: '2027-02-16T16:00:00.000Z', keptExtended: 1 });
    // First (/review 2026-11-18): the ending suspends part-way, and a suspended club is never retried.
    assert.deepEqual(w.calls, ['extendKept:c1:2027-02-16T16:00:00.000Z', 'endAgain:c1:operator']);
    // Once: the club is suspended now.
    assert.equal((await closeAgainIfFreeTimeOver('c1', { door: 'operator', userId: null, email: null }, w.deps)).closed, false);
    assert.equal(w.calls.length, 2);
  });

  it('every way staff end it closes it again (endClubOverride, which End it now and Put it back both use)', () => {
    const body = functionBody(readCode('lib/club-record-changes.ts'), 'endClubOverride');
    assert.match(body, /isReopeningGrant\(live\) \? await closeAgainAfterEnd\(opts\.orgId, opts\.actorEmail\) : null/);
    assert.match(functionBody(readCode('lib/free-time-writes.ts'), 'endFreeTimeNow'), /endClubOverride\(/);
    const putBack = readCode('app/api/platform-admin/orgs/[id]/put-back/route.ts');
    assert.equal((putBack.match(/endClubOverride\(/g) ?? []).length, 2);
    assert.equal((putBack.match(/warnings: r\.warnings \?\? \[\]/g) ?? []).length, 2, 'both say a failed close');
    assert.match(readCode('lib/free-time-reclose-server.ts'), /return CLOSE_AGAIN_FAILED_WARNING;/);
    assert.ok(CLOSE_AGAIN_FAILED_WARNING.includes('the daily job retries a club left open'));
  });
});

describe('3 · the daily job', () => {
  it('closes a club whose reopening free time ran out by date; a second run does nothing', async () => {
    const w = world({ 'c1': facts() });
    assert.deepEqual(await closeAgainExpiredFreeTime(w.deps), { checked: 1, closed: 1 });
    assert.deepEqual(await closeAgainExpiredFreeTime(w.deps), { checked: 0, closed: 0 });
  });

  it('leaves alone a club whose free time still runs', async () => {
    const w = world({ 'c2': facts({ doorStatus: 'active', grants: [grant({ expires_at: '2026-12-16T05:00:00.000Z' })] }) });
    assert.deepEqual(await closeAgainExpiredFreeTime(w.deps), { checked: 1, closed: 0 });
    assert.deepEqual(w.calls, []);
  });

  it('one failure never stops the next, and the job record says so; the failed club is tried again', async () => {
    const w = world({ 'bad': facts(), 'c1': facts() }, { failEnd: 'bad' });
    await assert.rejects(closeAgainExpiredFreeTime(w.deps), /Closed 1 of 2; 1 failed: bad/);
    assert.ok(w.calls.includes('endAgain:c1:system'));
    assert.deepEqual(await closeAgainExpiredFreeTime(w.deps.withEnd()), { checked: 1, closed: 1 }, 'a failure before the suspension leaves it a candidate');
  });

  it('runs as its own step of the daily job, and its candidates are marked grants only', () => {
    assert.match(readCode('app/api/platform-admin/stripe-fees-daily/route.ts'), /await run\('free_time_close_again', \(\) => closeAgainEndedFreeTime\(\)\);/);
    const candidates = readCode('lib/free-time-reclose-server.ts');
    assert.match(candidates, /\.eq\(`target->>\$\{REOPENED_ENDED_CLUB\}`, 'true'\)/);
    assert.match(candidates, /\.eq\('organizations\.subscription_status', 'canceled'\)\s*\.is\('organizations\.billing_suspended_at', null\)/);
  });
});

describe('4 · the countdown pauses while the club is let in', () => {
  it("a cancellation's record pauses while free time lets the ended club in", () => {
    assert.equal(countdownPaused('account_cancellation', 'canceled', 'active'), true);
    assert.equal(countdownPaused('stripe_subscription_deleted', 'canceled', 'active'), true);
    assert.equal(countdownPaused('account_cancellation', 'canceled', 'canceled'), false, 'still ended: the countdown runs');
    assert.equal(countdownPaused('account_cancellation', 'canceled', undefined), false, 'unread: never skipped on a guess');
  });

  it('a club that paid again keeps the countdown on what its reactivation left kept (as a downgrade remainder does)', () => {
    assert.equal(countdownPaused('account_cancellation', 'active', 'active'), false);
  });

  it('a move to a lower plan and a Coaches Portal keep their countdown', () => {
    assert.equal(countdownPaused('downgrade', 'canceled', 'active'), false);
    assert.equal(countdownPaused(undefined, 'canceled', 'active'), false);
    assert.equal(countdownPaused('coaches_portal_cancellation', 'canceled', 'active'), false);
  });

  it('the sweep filters both the warnings and the pending purge through the door', () => {
    const body = functionBody(readCode('lib/billing-retention.ts'), 'processBillingRetentionExpiry');
    assert.equal((body.match(/await withoutPausedCountdowns\(/g) ?? []).length, 2);
    assert.match(functionBody(readCode('lib/billing-retention.ts'), 'withoutPausedCountdowns'), /effectiveOrgFactsById\(/);
  });
});

describe('5 · the wiring reuses what exists', () => {
  const server = readCode('lib/free-time-reclose-server.ts');

  it('the give runs the restore an operator plan change runs', () => {
    assert.match(server, /await restoreAfterReactivation\(orgId, facts\?\.tournamentLimit \?\? 1\)/);
  });

  it('the end runs THE ending: a fresh 90 days, the owners told, marked so churn counts the club once', () => {
    assert.match(server, /applyEnding\(account, \{[\s\S]*notifyOwner: true,[\s\S]*freeTimeEnded: true,[\s\S]*\}, endingDeps\)/);
    assert.doesNotMatch(server, /subscription_status: 'canceled'|is_public: false|status: 'archived'/, 'no second cancellation path');
    const ending = functionBody(readCode('lib/plan-ending.ts'), 'applyEnding');
    assert.match(ending, /const retentionUntil = retentionUntilFrom\(endedAt, deps\.retentionDays\(account\)\)/);
    assert.match(ending, /\.\.\.\(p\.freeTimeEnded \? \{ freeTimeEnded: true \} : \{\}\)/);
    assert.match(readCode('lib/plan-ending-server.ts'), /\.\.\.\(e\.freeTimeEnded \? \{ freeTimeEnded: true \} : \{\}\)/);
    assert.match(readCode('lib/platform-metrics.ts'), /!\(e\.event_type === 'subscription_canceled' && e\.metadata\?\.freeTimeEnded === true\)/);
  });

  it('the kept records only ever move LATER, and only a cancellation’s', () => {
    const extend = between(server, 'async extendKept', 'async candidates');
    assert.match(extend, /\.in\('metadata->>retentionReason', CANCELLATION_REASONS\)/);
    assert.match(extend, /\.lt\('retention_until', retentionUntil\)/);
  });
});

describe('6 · what staff read', () => {
  const story = (status: string | null, target: unknown) => freeTimeStoryEntries({
    org: { name: 'Riverside', plan_id: 'tournament', subscription_status: status },
    overrides: [{
      id: 'g1', type: 'subscription_status', value: 'active', target: target as { reopenedEndedClub?: boolean } | null,
      starts_at: '2026-11-18T15:00:00.000Z', expires_at: '2026-12-16T05:00:00.000Z',
      reason: 'A favour', created_by: 'staff@example.com', created_at: '2026-11-18T15:00:00.000Z', revoked_at: null, revoked_by: null,
    }],
    audit: [], putBackAt: new Map(), now: NOW,
  });

  it('the Story names a reopening grant, and its End it now says the club closes again', () => {
    const given = story('canceled', MARK).find(e => e.key === 'override:g1')!;
    assert.match(given.sub ?? '', /^Reopened the ended club/);
    assert.ok(given.putBack?.sentence.endsWith(CLOSES_AGAIN_WORDS));
  });

  it('a club that paid meanwhile, or an unmarked grant, reads as before', () => {
    assert.doesNotMatch(story('active', MARK).find(e => e.key === 'override:g1')!.putBack!.sentence, /closed again/);
    const plain = story('canceled', null).find(e => e.key === 'override:g1')!;
    assert.equal(plain.sub, undefined);
    assert.match(plain.putBack!.sentence, /Nothing is deleted\.$/);
  });

  it('the give window: billing status first on an ended club, its one line, and a plan or sections said to leave it locked out', () => {
    const src = readSource('app/platform-admin/orgs/[id]/FreeTimeWindows.tsx');
    assert.match(src, /useState<GiveKind \| null>\(ended \? 'subscription_status' : planBlock \? null : 'plan_tier'\)/);
    assert.match(src, /plan has ended\. Free time lets it back in/);
    assert.match(src, /'a whole plan' : 'sections'\} alone won’t let it back\s+in\. It stays locked out\. Give Billing status to bring it back\./);
    assert.match(src, /const closesAgain = row\.reopenedEndedClub && org\.status === 'canceled';/);
  });
});

// ── An in-memory world for the end and the daily job ──────────────────────────────────────────────

function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `${from} … ${to}`);
  return src.slice(a, b);
}

function world(clubs: Record<string, CloseAgainFacts>, opts: { failEnd?: string } = {}) {
  const calls: string[] = [];
  const deps: ReopenDeps & { withEnd(): ReopenDeps } = {
    withEnd() { opts.failEnd = undefined; return deps; },
    now: () => NOW,
    async readFacts(orgId) { return clubs[orgId] ?? null; },
    async restore(orgId) { calls.push(`restore:${orgId}`); },
    async endAgain(orgId, actor) {
      if (opts.failEnd === orgId) throw new Error('crash');
      calls.push(`endAgain:${orgId}:${actor.door}`);
      clubs[orgId] = { ...clubs[orgId], suspended: true };
      return { applied: true, retentionUntil: '2027-02-16T16:00:00.000Z' };
    },
    async extendKept(orgId, until) { calls.push(`extendKept:${orgId}:${until}`); return 1; },
    async candidates() {
      return Object.entries(clubs).filter(([, f]) => f.storedStatus === 'canceled' && !f.suspended).map(([id]) => id);
    },
  };
  return { deps, calls };
}
