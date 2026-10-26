/**
 * Free time on the Story (Support console Stage 4): the entries, and where Put it back may sit. Put it back is offered
 * only on the newest entry of a grant still running; never on Founding Season; never on a grant that ended (T10).
 * The change route is a compare-and-set (T11), asserted by scan below.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { freeTimeStoryEntries, type FreeTimeStoryRow } from '../../lib/free-time-story';
import type { AuditRow } from '../../lib/platform-story-view';

const NOW = new Date('2026-10-25T16:00:00.000Z');
const ORG = { name: 'UAT Plus Org', plan_id: 'tournament_plus' };
const MAR31 = '2027-04-01T04:00:00.000Z';
const APR30 = '2027-05-01T04:00:00.000Z';

function grant(extra: Partial<FreeTimeStoryRow> = {}): FreeTimeStoryRow {
  return {
    id: 'g1', type: 'plan_tier', value: null, target: { plan: 'club' }, starts_at: '2026-10-25T14:00:00.000Z', expires_at: MAR31,
    reason: 'Trying Club', created_by: 'billing@fieldlogichq.ca', created_at: '2026-10-25T14:12:00.000Z', revoked_at: null, revoked_by: null,
    ...extra,
  };
}
const change: AuditRow = {
  id: 77, actor_email: 'billing@fieldlogichq.ca', action: 'change_override_end', field: 'expires_at', old_value: MAR31,
  new_value: { override_id: 'g1', expires_at: APR30, last_day: '2027-04-30', reason: 'Their spring draft moved to April' },
  created_at: '2026-10-25T15:02:00.000Z',
};
const story = (overrides: FreeTimeStoryRow[], audit: AuditRow[] = [], now = NOW) =>
  freeTimeStoryEntries({ org: ORG, overrides, audit, putBackAt: new Map(), now });

describe('free time on the Story', () => {
  it('given: the plan, its last day, and what it goes back to', () => {
    const [given] = story([grant()]);
    assert.equal(given.title, 'Free time given: Club through Mar 31, 2027');
    assert.equal(given.sub, 'Then back to Tournament Plus by itself');
    assert.equal(given.who, 'billing@fieldlogichq.ca');
    assert.equal(given.why, 'Trying Club');
    assert.equal(given.putBack?.kind, 'override');
  });

  it('changed: from what to what, and Put it back moves to the newest entry', () => {
    const entries = story([grant({ expires_at: APR30 })], [change]);
    const given = entries.find(e => e.key === 'override:g1')!;
    const changed = entries.find(e => e.key === 'audit:77')!;
    assert.equal(given.title, 'Free time given: Club through Mar 31, 2027', 'the given entry keeps the day it was given');
    assert.equal(given.putBack, undefined);
    assert.equal(changed.title, 'Free time changed: Club now free through Apr 30, 2027');
    assert.equal(changed.sub, 'Was through Mar 31, 2027');
    assert.equal(changed.why, 'Their spring draft moved to April');
    assert.equal(changed.putBack?.kind, 'override_end');
    assert.ok(changed.putBack?.kind === 'override_end' && changed.putBack.lastDay === '2027-03-31' && changed.putBack.expectedExpiresAt === APR30);
  });

  it('ended by itself (The product), with no Put it back anywhere', () => {
    const entries = story([grant()], [], new Date('2027-04-01T16:00:00.000Z'));
    const ran = entries.find(e => e.key === 'override-ran-out:g1')!;
    assert.equal(ran.title, 'Free time ended by itself: Club');
    assert.equal(ran.sub, 'Back to Tournament Plus');
    assert.equal(ran.who, 'The product');
    assert.ok(entries.every(e => !e.putBack));
  });

  it('ended early, with its reason, and no Put it back anywhere', () => {
    const revoke: AuditRow = { id: 78, actor_email: 'billing@fieldlogichq.ca', action: 'revoke_override', field: 'id', old_value: 'g1', new_value: { reason: 'They bought it' }, created_at: '2026-10-25T15:30:00.000Z' };
    const entries = story([grant({ revoked_at: '2026-10-25T15:30:00.000Z', revoked_by: 'billing@fieldlogichq.ca' })], [revoke]);
    const ended = entries.find(e => e.key === 'override-ended:g1')!;
    assert.equal(ended.title, 'Free time ended early: Club');
    assert.equal(ended.why, 'They bought it');
    assert.ok(entries.every(e => !e.putBack));
  });

  it('Founding Season: its own entry, the last free day, never Put it back', () => {
    const [f] = story([grant({ id: 'f1', type: 'comp_period', value: 'granted', target: null, expires_at: '2027-10-01T04:00:00.000Z', created_by: 'system', reason: 'Founding' })]);
    assert.equal(f.title, 'Founding Season: Tournament Plus free through Sep 30, 2027');
    assert.equal(f.sub, 'Given at sign-up');
    assert.equal(f.who, 'The product');
    assert.equal(f.putBack, undefined);
  });

  it('a section grant and a billing-status grant read the same way', () => {
    const [s] = story([grant({ id: 's1', type: 'module_addon', target: { addons: ['module_accounting'] }, expires_at: '2026-10-01T04:00:00.000Z' })], [], new Date('2026-09-02T19:18:00.000Z'));
    assert.equal(s.title, 'Free time given: Accounting through Sep 30, 2026');
    assert.equal(s.sub, undefined);
    const [b] = story([grant({ id: 'b1', type: 'subscription_status', value: 'active', target: null })]);
    assert.equal(b.title, 'Free time given: Billing status: Active through Mar 31, 2027');
  });

  it('an entry already put back says when, and offers nothing', () => {
    const entries = freeTimeStoryEntries({ org: ORG, overrides: [grant()], audit: [], putBackAt: new Map([['override:g1', '2026-10-25T15:40:00.000Z']]), now: NOW });
    assert.equal(entries[0].putBack, undefined);
    assert.equal(entries[0].putBackAt, '2026-10-25T15:40:00.000Z');
  });
});

describe('changing the end is a compare-and-set (T11)', () => {
  const src = readFileSync('lib/free-time-writes.ts', 'utf8');
  const fn = src.slice(src.indexOf('export async function changeFreeTimeEnd'), src.indexOf('async function staleSentence'));
  it('refuses a stale end before writing, and the write itself carries the end it read', () => {
    const stale = fn.indexOf('!== new Date(input.expectedExpiresAt).getTime()');
    const write = fn.indexOf('.update({ expires_at: expiresAt })');
    assert.ok(stale > 0 && write > 0 && stale < write, 'the stale check comes before the write');
    assert.ok(/\.update\(\{ expires_at: expiresAt \}\)[\s\S]{0,200}\.eq\('expires_at', row\.expires_at\)/.test(fn), 'the update is conditioned on the end it read');
  });
});
