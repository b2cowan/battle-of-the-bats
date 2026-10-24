/**
 * CLUB TIER 4e, PART 6: the status check for a club's own web address. Every transition, every clock (15 minutes waiting, record 2
 * hourly, the rest daily), a miss confirmed before anyone is emailed, and no email repeating within a stretch.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PADLOCK_REMINDER_BEFORE_MS, decideTick, planTick, runClubDomainTick, type TickDeps } from '../../lib/club-domain-tick.ts';
import { WAITING_GIVE_UP_MS, type DomainRow } from '../../lib/club-domain-service.ts';
import type { RecordSighting } from '../../lib/club-domain.ts';

const T0 = new Date('2026-11-01T12:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const FOUND: RecordSighting = { state: 'found' };
const GONE: RecordSighting = { state: 'not_seen' };

function row(over: Partial<DomainRow> = {}): DomainRow {
  return {
    id: 'r1', org_id: 'org-1', full_name: 'www.lynx.ca', domain: 'lynx.ca', prefix: 'www', status: 'connected',
    host_status: 'AVAILABLE', host_branch: 'dev', record1_name: '_c3e2d2', record1_value: '_6f1b.acm-validations.aws',
    record2_name: 'www', record2_value: 'sites.fieldlogichq.ca', record2_host_target: 'd1z2.cloudfront.net',
    last_checked_at: null, last_check: null, waiting_since: at(-10 * DAY).toISOString(), connected_at: at(-9 * DAY).toISOString(),
    needs_attention_since: null, not_working_since: null, padlock_expires_at: at(100 * DAY).toISOString(),
    live_email_sent_at: at(-9 * DAY).toISOString(), padlock_email_sent_at: null, padlock_reminder_sent_at: null,
    gave_up_email_sent_at: null, not_working_email_sent_at: null, created_by_user_id: 'u', created_at: at(-10 * DAY).toISOString(),
    ...over,
  };
}
const withLast = (r: DomainRow, last: Record<string, unknown>): DomainRow =>
  ({ ...r, last_check: { record1: FOUND, record2: FOUND, bare_forwards: true, ...last } as DomainRow['last_check'] });

describe('what to look at, and when', () => {
  it('a waiting connection is looked at every wake: the host and both records', () => {
    assert.deepEqual(planTick(row({ status: 'waiting' }), T0), { host: true, record1: true, record2: true, extras: false });
  });
  it('a connected club: record 2 hourly, the rest daily', () => {
    const fresh = withLast(row(), { record2_checked_at: at(-20 * MIN).toISOString(), daily_at: at(-2 * HOUR).toISOString() });
    assert.deepEqual(planTick(fresh, T0), { host: false, record1: false, record2: false, extras: false });
    const hourDue = withLast(row(), { record2_checked_at: at(-61 * MIN).toISOString(), daily_at: at(-2 * HOUR).toISOString() });
    assert.deepEqual(planTick(hourDue, T0), { host: false, record1: false, record2: true, extras: false });
    const dayDue = withLast(row(), { record2_checked_at: at(-20 * MIN).toISOString(), daily_at: at(-25 * HOUR).toISOString() });
    assert.deepEqual(planTick(dayDue, T0), { host: true, record1: true, record2: false, extras: true });
    assert.equal(planTick(row(), T0).record2, true, 'a row never looked at is due at once');
  });
  it('a first miss is looked at again on the very next wake, not an hour later', () => {
    const r = withLast(row(), { record2_checked_at: at(-15 * MIN).toISOString(), record2_first_miss_at: at(-15 * MIN).toISOString(), daily_at: at(-HOUR).toISOString() });
    assert.equal(planTick(r, T0).record2, true);
  });
  it('not working is looked at every wake; gave up never', () => {
    assert.equal(planTick(withLast(row({ status: 'not_working' }), { record2_checked_at: at(-5 * MIN).toISOString(), daily_at: at(-HOUR).toISOString() }), T0).record2, true);
    assert.deepEqual(planTick(row({ status: 'not_connected' }), T0), { host: false, record1: false, record2: false, extras: false });
  });
});

describe('waiting', () => {
  const waiting = (over: Partial<DomainRow> = {}) => row({ status: 'waiting', waiting_since: at(-1 * HOUR).toISOString(), connected_at: null, live_email_sent_at: null, ...over });
  it('goes live when the host says so, and tells the owner once', () => {
    const d = decideTick(waiting(), { host: { state: 'live', hostStatus: 'AVAILABLE' }, record1: FOUND, record2: FOUND, padlockExpiresAt: at(190 * DAY).toISOString() }, T0);
    assert.equal(d.patch.status, 'connected');
    assert.equal(d.patch.connected_at, T0.toISOString());
    assert.equal(d.patch.padlock_expires_at, at(190 * DAY).toISOString());
    assert.deepEqual(d.emails, ['live']);
    const again = decideTick(waiting({ live_email_sent_at: T0.toISOString() }), { host: { state: 'live', hostStatus: 'AVAILABLE' } }, at(15 * MIN));
    assert.deepEqual(again.emails, [], 'never twice');
  });
  it('records seen but the host not live yet stays waiting, with what we saw written down', () => {
    const d = decideTick(waiting(), { host: { state: 'pending', hostStatus: 'PENDING_VERIFICATION' }, record1: FOUND, record2: { state: 'points_elsewhere', sees: 'ghs.googlehosted.com' } }, T0);
    assert.equal(d.patch.status, undefined);
    assert.deepEqual(d.emails, []);
    assert.deepEqual(d.patch.last_check?.record2, { state: 'points_elsewhere', sees: 'ghs.googlehosted.com' });
  });
  it('gives up after two days and tells the owner once', () => {
    const w = waiting({ waiting_since: at(-WAITING_GIVE_UP_MS - MIN).toISOString() });
    const d = decideTick(w, { host: { state: 'pending', hostStatus: 'PENDING_VERIFICATION' }, record1: FOUND, record2: GONE }, T0);
    assert.equal(d.patch.status, 'not_connected');
    assert.deepEqual(d.emails, ['gave_up']);
    assert.deepEqual(decideTick({ ...w, gave_up_email_sent_at: T0.toISOString() }, { host: { state: 'pending', hostStatus: 'x' } }, at(MIN)).emails, []);
    // Just inside two days: still looking.
    assert.equal(decideTick(waiting({ waiting_since: at(-WAITING_GIVE_UP_MS + MIN).toISOString() }), { host: { state: 'pending', hostStatus: 'x' } }, T0).patch.status, undefined);
  });
});

describe('record 2: a miss is confirmed before anyone is emailed', () => {
  it('the first miss is written down and nothing else happens', () => {
    const d = decideTick(row(), { record2: GONE }, T0);
    assert.equal(d.patch.status, undefined);
    assert.deepEqual(d.emails, []);
    assert.equal(d.patch.last_check?.record2_first_miss_at, T0.toISOString());
  });
  it('the second miss in a row makes it not working, and the owner is emailed once', () => {
    const first = withLast(row(), { record2_first_miss_at: at(-15 * MIN).toISOString() });
    const d = decideTick(first, { record2: GONE }, T0);
    assert.equal(d.patch.status, 'not_working');
    assert.equal(d.patch.not_working_since, T0.toISOString());
    assert.deepEqual(d.emails, ['not_working']);
    const later = { ...first, status: 'not_working' as const, not_working_email_sent_at: T0.toISOString() };
    assert.deepEqual(decideTick(later, { record2: GONE }, at(15 * MIN)).emails, [], 'a stretch of trouble is one email');
  });
  it('a miss followed by a find is forgotten: no verdict, no email', () => {
    const first = withLast(row(), { record2_first_miss_at: at(-15 * MIN).toISOString() });
    const d = decideTick(first, { record2: FOUND }, T0);
    assert.equal(d.patch.status, undefined);
    assert.deepEqual(d.emails, []);
    assert.equal(d.patch.last_check?.record2_first_miss_at, null);
  });
  it('a lookup that could not be made changes nothing about record 2', () => {
    const first = withLast(row(), { record2_first_miss_at: at(-15 * MIN).toISOString() });
    const d = decideTick(first, {}, T0);
    assert.equal(d.patch.status, undefined);
    assert.equal(d.patch.last_check?.record2_first_miss_at, at(-15 * MIN).toISOString());
  });
  it('it clears by itself once record 2 is back, and the next stretch is told again', () => {
    const down = row({ status: 'not_working', not_working_since: at(-HOUR).toISOString(), not_working_email_sent_at: at(-HOUR).toISOString() });
    const back = decideTick(down, { record2: FOUND }, T0);
    assert.equal(back.patch.status, 'connected');
    assert.equal(back.patch.not_working_since, null);
    assert.equal(back.patch.not_working_email_sent_at, null);
    const backWithPadlockGone = decideTick({ ...down, needs_attention_since: at(-3 * DAY).toISOString() }, { record2: FOUND }, T0);
    assert.equal(backWithPadlockGone.patch.status, 'needs_attention', 'the padlock record was already gone before: back to needs attention, not to all well');
  });
  it('the host no longer serving the name is the same trouble', () => {
    const d = decideTick(row(), { host: { state: 'missing', hostStatus: null }, record1: FOUND }, T0);
    assert.equal(d.patch.status, 'not_working');
    assert.deepEqual(d.emails, ['not_working']);
    assert.equal(decideTick(row(), { host: { state: 'failed', hostStatus: 'FAILED' } }, T0).patch.status, 'not_working');
  });
});

describe('record 1, the padlock check: the daily look', () => {
  it('gone: needs attention, the owner told the same day, and the reminder only inside two weeks of the date', () => {
    const far = decideTick(row(), { record1: GONE, host: { state: 'live', hostStatus: 'AVAILABLE' } }, T0);
    assert.equal(far.patch.status, 'needs_attention');
    assert.equal(far.patch.needs_attention_since, T0.toISOString());
    assert.deepEqual(far.emails, ['padlock_missing']);

    const near = row({ padlock_expires_at: at(10 * DAY).toISOString() });
    const d = decideTick(near, { record1: GONE }, T0);
    assert.deepEqual(d.emails, ['padlock_missing', 'padlock_reminder'], 'inside the window at once: both go, once each');

    const edge = row({ status: 'needs_attention', needs_attention_since: at(-30 * DAY).toISOString(), padlock_email_sent_at: at(-30 * DAY).toISOString(), padlock_expires_at: at(PADLOCK_REMINDER_BEFORE_MS - DAY).toISOString() });
    assert.deepEqual(decideTick(edge, { record1: GONE }, at(DAY)).emails, ['padlock_reminder'], 'two weeks out: the reminder, and only the reminder');
    const stamped = { ...edge, padlock_reminder_sent_at: at(DAY).toISOString() };
    assert.deepEqual(decideTick(stamped, { record1: GONE }, at(2 * DAY)).emails, [], 'never twice');
  });
  it('back: all well again, and the stretch\'s stamps are cleared', () => {
    const attn = row({ status: 'needs_attention', needs_attention_since: at(-3 * DAY).toISOString(), padlock_email_sent_at: at(-3 * DAY).toISOString(), padlock_reminder_sent_at: at(-1 * DAY).toISOString() });
    const d = decideTick(attn, { record1: FOUND }, T0);
    assert.equal(d.patch.status, 'connected');
    assert.equal(d.patch.needs_attention_since, null);
    assert.equal(d.patch.padlock_email_sent_at, null);
    assert.equal(d.patch.padlock_reminder_sent_at, null);
  });
  it('the live certificate\'s date and whether the bare name forwards are kept', () => {
    const d = decideTick(row(), { record1: FOUND, padlockExpiresAt: at(150 * DAY).toISOString(), bareForwards: false }, T0);
    assert.equal(d.patch.padlock_expires_at, at(150 * DAY).toISOString());
    assert.equal(d.patch.last_check?.bare_forwards, false);
    assert.equal(d.patch.last_check?.daily_at, T0.toISOString());
  });
});

describe('the runner', () => {
  function world(rows: DomainRow[], over: Partial<TickDeps> = {}) {
    const updates: { orgId: string; patch: Record<string, unknown> }[] = [];
    const sent: string[] = [];
    const deps: TickDeps = {
      listAll: async () => rows,
      update: async (orgId, patch) => { updates.push({ orgId, patch: patch as Record<string, unknown> }); },
      hostRead: async () => ({ hostStatus: 'AVAILABLE', state: 'live', record1: null, record2HostTarget: null }),
      cnames: async name => (name.startsWith('_c3e2d2') ? ['_6f1b.acm-validations.aws'] : ['sites.fieldlogichq.ca']),
      certificateExpiry: async () => at(120 * DAY).toISOString(),
      bareForwards: async () => true,
      email: async (r, which) => { sent.push(`${r.org_id}:${which}`); return true; },
      now: () => T0,
      ...over,
    };
    return { deps, updates, sent };
  }

  it('does nothing, and writes nothing, for a club with nothing due or one that gave up', async () => {
    const quiet = withLast(row({ org_id: 'a' }), { record2_checked_at: at(-10 * MIN).toISOString(), daily_at: at(-HOUR).toISOString() });
    const w = world([quiet, row({ org_id: 'b', status: 'not_connected' })]);
    const s = await runClubDomainTick(w.deps);
    assert.equal(s.looked, 0);
    assert.equal(w.updates.length, 0);
  });

  it('a waiting club that is live goes connected and its owner is told once', async () => {
    const w = world([row({ org_id: 'a', status: 'waiting', waiting_since: at(-HOUR).toISOString(), connected_at: null, live_email_sent_at: null })]);
    const s = await runClubDomainTick(w.deps);
    assert.deepEqual(w.sent, ['a:live']);
    assert.equal(w.updates[0].patch.status, 'connected');
    assert.equal(s.changed, 1);
  });

  it('a failed lookup is not a miss: the club is left as it was', async () => {
    const w = world([row({ org_id: 'a' })], { cnames: async () => { throw new Error('timeout'); }, certificateExpiry: async () => { throw new Error('x'); }, bareForwards: async () => { throw new Error('x'); } });
    await runClubDomainTick(w.deps);
    assert.notEqual(w.updates[0]?.patch.status, 'not_working');
    assert.notEqual(w.updates[0]?.patch.status, 'needs_attention');
    assert.deepEqual(w.sent, []);
  });

  it('an email that did not go is not stamped, so the next wake sends it again', async () => {
    const down = withLast(row({ org_id: 'a' }), { record2_first_miss_at: at(-15 * MIN).toISOString(), record2_checked_at: at(-15 * MIN).toISOString() });
    const w = world([down], { cnames: async () => [], email: async () => false });
    await runClubDomainTick(w.deps);
    assert.equal(w.updates[0].patch.status, 'not_working');
    assert.equal(w.updates[0].patch.not_working_email_sent_at, null, 'unstamped: it is owed');
  });

  it('one club failing does not stop the others', async () => {
    const rows = [row({ org_id: 'bad', status: 'waiting', waiting_since: at(-HOUR).toISOString(), connected_at: null, live_email_sent_at: null }), row({ org_id: 'good', status: 'waiting', waiting_since: at(-HOUR).toISOString(), connected_at: null, live_email_sent_at: null })];
    const w = world(rows, { update: async (orgId, patch) => { if (orgId === 'bad') throw new Error('db'); w2.push(orgId); void patch; } });
    const w2: string[] = [];
    const s = await runClubDomainTick(w.deps);
    assert.equal(s.failed, 1);
    assert.deepEqual(w2, ['good']);
  });
});
