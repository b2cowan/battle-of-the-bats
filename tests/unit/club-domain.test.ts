/**
 * CLUB TIER 4e, PART 2: typing a club's own address and reading the two records. Pure rules; the routes and the
 * screen call these, so the refusals and the "Points elsewhere" wording cannot drift apart.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanAddressInput,
  cleanAddressWhileTyping,
  judgePadlockRecord,
  judgeSiteRecord,
  parseAddress,
  usesOwnAddress,
} from '../../lib/club-domain.ts';

describe('cleaning what was typed or pasted', () => {
  it('turns a pasted link into the bare name, without a word', () => {
    assert.equal(cleanAddressInput('https://WWW.LakeshoreLynx.ca/home'), 'lakeshorelynx.ca');
    assert.equal(cleanAddressInput('  http://www.lynx.ca:8080/a?b=1#c '), 'lynx.ca');
    assert.equal(cleanAddressInput('lakeshorelynx.ca.'), 'lakeshorelynx.ca');
  });
  it('keeps a trailing dot while it is being typed, because `lakeshorelynx.` is on its way to `.ca`', () => {
    assert.equal(cleanAddressWhileTyping('lakeshorelynx.'), 'lakeshorelynx.');
    assert.equal(cleanAddressWhileTyping('https://www.lakeshorelynx.'), 'lakeshorelynx.');
    assert.equal(cleanAddressWhileTyping('Teams.Lynx.ca/x', 'other'), 'teams.lynx.ca');
    assert.equal(cleanAddressInput('lakeshorelynx.'), 'lakeshorelynx');
  });
  it('never leaves www.www. in the fixed-prefix mode', () => {
    assert.equal(cleanAddressInput('www.www.lynx.ca'), 'lynx.ca');
  });
  it('keeps a typed front name in the other-name mode', () => {
    assert.equal(cleanAddressInput('https://Teams.Lynx.ca/x', 'other'), 'teams.lynx.ca');
    assert.equal(cleanAddressInput('www.lynx.ca', 'other'), 'www.lynx.ca');
  });
});

describe('parsing the address into the connection to create', () => {
  it('www mode: the club types the rest', () => {
    const r = parseAddress('lakeshorelynx.ca');
    assert.ok(r.ok);
    assert.deepEqual(r.address, { fullName: 'www.lakeshorelynx.ca', domain: 'lakeshorelynx.ca', prefix: 'www' });
  });
  it('keeps a multi-part ending whole (.on.ca)', () => {
    const r = parseAddress('lynx.on.ca');
    assert.ok(r.ok);
    assert.equal(r.address.domain, 'lynx.on.ca');
  });
  it('other-name mode: a name in front of a name the club owns', () => {
    const r = parseAddress('teams.lakeshorelynx.ca', 'other');
    assert.ok(r.ok);
    assert.deepEqual(r.address, { fullName: 'teams.lakeshorelynx.ca', domain: 'lakeshorelynx.ca', prefix: 'teams' });
  });
  it('refuses a bare name in the other-name mode, which can only forward', () => {
    assert.deepEqual(parseAddress('lakeshorelynx.ca', 'other'), { ok: false, reason: 'needs_a_name' });
  });
  it('refuses what is not a web address', () => {
    for (const bad of ['lakeshore lynx', 'lynx', '', '.ca', 'ly_nx.ca', '-lynx.ca', 'lynx.123', '192.168.1.1', 'a..b.ca'])
      assert.deepEqual(parseAddress(bad), { ok: false, reason: 'not_a_domain' }, bad);
  });
  it('refuses every address of ours', () => {
    for (const ours of ['fieldlogichq.ca', 'dev.fieldlogichq.ca', 'fieldlogichq.com', 'x.amplifyapp.com'])
      assert.deepEqual(parseAddress(ours), { ok: false, reason: 'ours' }, ours);
    assert.deepEqual(parseAddress('sites.fieldlogichq.ca', 'other'), { ok: false, reason: 'ours' });
  });
  it('does not treat a look-alike as ours', () => {
    assert.ok(parseAddress('fieldlogichq.ca.evil.com').ok);
    assert.ok(parseAddress('notfieldlogichq.ca').ok);
  });
});

describe('reading the two records', () => {
  const PADLOCK = '_6f1b9a2e.xlfgrmvvlj.acm-validations.aws';
  it('record 1: found only on an exact value, case-blind, trailing dot ignored', () => {
    assert.deepEqual(judgePadlockRecord([PADLOCK.toUpperCase() + '.'], PADLOCK), { state: 'found' });
    assert.deepEqual(judgePadlockRecord([], PADLOCK), { state: 'not_seen' });
    assert.deepEqual(judgePadlockRecord(null, PADLOCK), { state: 'not_seen' });
    assert.deepEqual(judgePadlockRecord(['other.example.com'], PADLOCK), { state: 'points_elsewhere', sees: 'other.example.com' });
  });
  it('record 2: our name or the host\'s own target are both right; the old website is "Points elsewhere"', () => {
    const accepted = ['sites.fieldlogichq.ca', 'd20q9j9hp0ol2g.cloudfront.net'];
    assert.deepEqual(judgeSiteRecord(['sites.fieldlogichq.ca.'], accepted), { state: 'found' });
    assert.deepEqual(judgeSiteRecord(['D20Q9J9HP0OL2G.cloudfront.net'], accepted), { state: 'found' });
    assert.deepEqual(judgeSiteRecord(['ghs.googlehosted.com'], accepted), { state: 'points_elsewhere', sees: 'ghs.googlehosted.com' });
    assert.deepEqual(judgeSiteRecord(undefined, accepted), { state: 'not_seen' });
  });
});

describe('which statuses hand out the club\'s own address', () => {
  it('only connected and needs attention (the drawings\' rules table)', () => {
    assert.equal(usesOwnAddress('connected'), true);
    assert.equal(usesOwnAddress('needs_attention'), true);
    for (const s of ['waiting', 'not_connected', 'not_working'] as const) assert.equal(usesOwnAddress(s), false, s);
    assert.equal(usesOwnAddress(null), false);
  });
});
