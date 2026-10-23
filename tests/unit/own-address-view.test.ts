/**
 * CLUB TIER 4e, PART 3: what the Web address row says in each state. Pure decisions; the screen only draws them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bareState, gaveUpWhich, headerAddress, ownAddressInUse, recordChip, registrarMessage, rowChip, rowSummary, waitingLine,
} from '../../lib/own-address-view.ts';
import { OWN_ADDRESS_WORDS as W } from '../../lib/own-address-screen-words.ts';
import type { DomainView } from '../../lib/club-domain-service.ts';

const base: DomainView = {
  fullName: 'www.lakeshorelynx.ca', domain: 'lakeshorelynx.ca', prefix: 'www', status: 'waiting',
  records: {
    padlock: { type: 'CNAME', name: '_c3e2d2', value: '_6f1b9a.xlfgrmvvlj.acm-validations.aws' },
    site: { type: 'CNAME', name: 'www', value: 'sites.fieldlogichq.ca' },
  },
  lastCheckedAt: null, lastCheck: null, waitingSince: '2026-10-23T12:00:00.000Z',
  giveUpAt: '2026-10-25T12:00:00.000Z', connectedAt: null, needsAttentionSince: null, notWorkingSince: null, padlockExpiresAt: null,
};
const view = (over: Partial<DomainView>): DomainView => ({ ...base, ...over });
const OLD = 'fieldlogichq.ca/lakeshore-lynx';

describe('the closed row', () => {
  it('says the state once, by a chip, and a plain connection says nothing', () => {
    assert.equal(rowChip('waiting')?.label, 'Waiting');
    assert.deepEqual(rowChip('needs_attention'), { tone: 'warn', label: 'Needs attention' });
    assert.deepEqual(rowChip('not_connected'), { tone: 'warn', label: 'Not connected' });
    assert.deepEqual(rowChip('not_working'), { tone: 'bad', label: 'Not working' });
    assert.equal(rowChip('connected'), null);
    assert.equal(rowChip(null), null);
  });
  it('red is only for the club\'s address having stopped working', () => {
    for (const s of ['waiting', 'needs_attention', 'not_connected'] as const) assert.notEqual(rowChip(s)?.tone, 'bad', s);
  });
  it('the summary is only ever an address', () => {
    assert.equal(rowSummary(null, OLD), OLD);
    assert.equal(rowSummary(base, OLD), 'www.lakeshorelynx.ca');
  });
});

describe('which address the page says families use', () => {
  it('the club\'s own while connected or needs attention, else the old one', () => {
    assert.equal(headerAddress(view({ status: 'connected' }), OLD), 'www.lakeshorelynx.ca');
    assert.equal(headerAddress(view({ status: 'needs_attention' }), OLD), 'www.lakeshorelynx.ca');
    for (const s of ['waiting', 'not_connected', 'not_working'] as const) assert.equal(headerAddress(view({ status: s }), OLD), OLD, s);
    assert.equal(headerAddress(null, OLD), OLD);
    assert.equal(ownAddressInUse(view({ status: 'connected' })), true);
    assert.equal(ownAddressInUse(view({ status: 'not_working' })), false);
  });
});

describe('the records\' chips', () => {
  it('nothing seen is "Not seen yet" while waiting and "Missing" once live', () => {
    assert.equal(recordChip(null, false).label, 'Not seen yet');
    assert.equal(recordChip({ state: 'not_seen' }, false).label, 'Not seen yet');
    assert.deepEqual(recordChip({ state: 'not_seen' }, true), { tone: 'bad', label: 'Missing' });
    assert.deepEqual(recordChip({ state: 'found' }, false), { tone: 'good', label: 'Found' });
    assert.deepEqual(recordChip({ state: 'points_elsewhere', sees: 'x' }, false), { tone: 'warn', label: 'Points elsewhere' });
  });
});

describe('the waiting line', () => {
  const at = (h: number) => new Date(new Date(base.waitingSince).getTime() + h * 3600_000);
  it('says the start line, then names a record 2 on the old website at once, then "still waiting" after a day', () => {
    assert.equal(waitingLine(base, at(1)), 'start');
    assert.equal(waitingLine(base, at(25)), 'still_waiting');
    const old = view({ lastCheck: { record1: { state: 'found' }, record2: { state: 'points_elsewhere', sees: 'ghs.googlehosted.com' }, bare_forwards: null } });
    assert.equal(waitingLine(old, at(1)), 'record2_old');
    assert.equal(waitingLine(old, at(30)), 'record2_old');
  });
});

describe('what gave-up names', () => {
  const lc = (record1: 'found' | 'not_seen', record2: 'found' | 'not_seen') =>
    view({ lastCheck: { record1: { state: record1 }, record2: { state: record2 }, bare_forwards: null } });
  it('names the record that was never found', () => {
    assert.equal(gaveUpWhich(lc('found', 'not_seen')), 'record2');
    assert.equal(gaveUpWhich(lc('not_seen', 'found')), 'record1');
    assert.equal(gaveUpWhich(lc('not_seen', 'not_seen')), 'both');
    assert.equal(gaveUpWhich(base), 'record2');
    assert.equal(gaveUpWhich(view({ lastCheck: { record1: { state: 'found' }, record2: { state: 'points_elsewhere', sees: 'x' }, bare_forwards: null } })), 'elsewhere');
  });
});

describe('the bare name\'s line', () => {
  it('only for www, and unknown until the status job has looked', () => {
    assert.equal(bareState(base), 'unknown');
    assert.equal(bareState(view({ lastCheck: { record1: { state: 'found' }, record2: { state: 'found' }, bare_forwards: true } })), 'forwards');
    assert.equal(bareState(view({ lastCheck: { record1: { state: 'found' }, record2: { state: 'found' }, bare_forwards: false } })), 'not_forwarding');
    assert.equal(bareState(view({ prefix: 'teams', fullName: 'teams.lakeshorelynx.ca' })), null);
  });
});

describe('the message for whoever holds the sign-in', () => {
  it('is plain text with both records, the forwarding step and the help link', () => {
    const m = registrarMessage({ clubName: 'Lakeshore Lynx', ownerName: 'Pat Doyle', view: base, helpLink: 'fieldlogichq.ca/help/own-address' });
    assert.match(m, /^Hi, could you add two records to lakeshorelynx\.ca where it is registered\?/);
    assert.match(m, /Name  _c3e2d2\n/);
    assert.match(m, /Value sites\.fieldlogichq\.ca\n/);
    assert.match(m, /Then set lakeshorelynx\.ca \(without www\) to forward to https:\/\/www\.lakeshorelynx\.ca\./);
    assert.match(m, /How-to: fieldlogichq\.ca\/help\/own-address\n\nThanks!\nPat Doyle$/);
    assert.ok(!/[’‘“”]/.test(m), 'straight quotes only, so it survives any mail program');
  });
  it('leaves out the forwarding step for a name other than www, and the sign-off name when there is none', () => {
    const teams = view({ fullName: 'teams.lakeshorelynx.ca', prefix: 'teams', records: { ...base.records, site: { type: 'CNAME', name: 'teams', value: 'sites.fieldlogichq.ca' } } });
    const m = registrarMessage({ clubName: 'Lakeshore Lynx', ownerName: null, view: teams, helpLink: 'x' });
    assert.ok(!m.includes('without www'));
    assert.match(m, /If teams already has a record/);
    assert.match(m, /Thanks!$/);
  });
});

describe('the words keep the house style', () => {
  const sample = [
    W.recordsLead('lakeshorelynx.ca'), W.checkingStart, W.stillWaitingBody('Saturday at 2:14 p.m.'), W.stopBody('www.a.ca', 'fieldlogichq.ca/a'),
    W.padlockGoneBody('a.ca', 'May 9, 2027', 'March 30, 2027', 'Pat Doyle'), W.notWorkingBody('a.ca', 'fieldlogichq.ca/a', 'Pat Doyle', '9:14 a.m.'),
    W.gaveUpBody('record2', 'a.ca'), W.keepRecords('a.ca'), W.lastChecked('2:14 p.m.'),
  ];
  it('never says "DNS" without where, never "a.m." in capitals, never promises faster than the copy allows', () => {
    for (const s of sample) {
      assert.ok(!/\b[AP]\.?M\b/.test(s.replace(/\ba\.m\.|p\.m\./g, '')), s);
      if (/DNS/.test(s)) assert.match(s, /where you bought/);
      assert.ok(!/within minutes|instantly|right away/i.test(s), s);
    }
  });
  it('the timing line is exactly the allowed promise', () => {
    assert.match(W.checkingStart, /Often that is minutes after both records are in\. It can take up to two days\./);
  });
});
