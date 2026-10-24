/**
 * CLUB TIER 4e, PART 2: connect, check now, try again, stop; the host's answers read into our words. Fakes for the
 * stored row, the host and DNS, so the rules (refusals, no orphaned association, Check now never says "live") are pinned.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAITING_GIVE_UP_MS,
  checkClubDomainNow,
  connectClubDomain,
  retryClubDomain,
  stopClubDomain,
  toDomainView,
  type DomainRow,
  type DomainStore,
  type NewDomainRow,
  type ServiceDeps,
} from '../../lib/club-domain-service.ts';
import type { DomainHost, HostRecords } from '../../lib/amplify-domains.ts';
import { classifyHostError, mapHostStatus, parseDnsRecord, relativeRecordName } from '../../lib/amplify-domain-map.ts';
import { OWN_ADDRESS_REFUSALS, OWN_ADDRESS_REFUSAL_STATUS } from '../../lib/own-address-words.ts';

const NOW = new Date('2026-10-24T14:14:00.000Z');

function fakeStore(initial: DomainRow[] = []) {
  const rows = new Map<string, DomainRow>(initial.map((r) => [r.org_id, r]));
  const store: DomainStore = {
    async getByOrg(orgId) { return rows.get(orgId) ?? null; },
    async listAll() { return [...rows.values()]; },
    async getByFullName(n) { return [...rows.values()].find((r) => r.full_name === n) ?? null; },
    async getByDomain(d) { return [...rows.values()].find((r) => r.domain === d) ?? null; },
    async insert(row: NewDomainRow) {
      if ([...rows.values()].some((r) => r.full_name === row.full_name) || rows.has(row.org_id)) throw { code: '23505' };
      const created: DomainRow = {
        ...row, id: 'id-' + rows.size, status: 'waiting', last_checked_at: null, last_check: null,
        waiting_since: NOW.toISOString(), connected_at: null, needs_attention_since: null, not_working_since: null,
        padlock_expires_at: null, live_email_sent_at: null, padlock_email_sent_at: null, padlock_reminder_sent_at: null, gave_up_email_sent_at: null, not_working_email_sent_at: null, created_at: NOW.toISOString(),
      };
      rows.set(row.org_id, created);
      return created;
    },
    async update(orgId, patch) {
      const next = { ...rows.get(orgId)!, ...patch };
      rows.set(orgId, next);
      return next;
    },
    async remove(orgId) { rows.delete(orgId); },
  };
  return { store, rows };
}

const RECORDS: HostRecords = {
  hostStatus: 'PENDING_VERIFICATION',
  state: 'pending',
  record1: { name: '_c3e2d2', value: '_6f1b9a.xlfgrmvvlj.acm-validations.aws' },
  record2HostTarget: 'd20q9j9hp0ol2g.cloudfront.net',
};

function fakeHost(over: Partial<DomainHost> = {}) {
  const calls: string[] = [];
  const host: DomainHost = {
    async create({ domain, prefix }) { calls.push(`create ${prefix}.${domain}`); return RECORDS; },
    async read() { calls.push('read'); return RECORDS; },
    async remove(domain) { calls.push(`remove ${domain}`); },
    ...over,
  };
  return { host, calls };
}

function deps(over: Partial<ServiceDeps> & { rows?: DomainRow[]; hostOver?: Partial<DomainHost>; cnames?: Record<string, string[]> } = {}) {
  const { store, rows } = fakeStore(over.rows);
  const { host, calls } = fakeHost(over.hostOver);
  const d: ServiceDeps = {
    store, host,
    dns: { async cnames(name) { return over.cnames?.[name] ?? []; } },
    siteTarget: 'sites.fieldlogichq.ca',
    branch: 'dev',
    isDemoOrg: async () => false,
    now: () => NOW,
    ...over,
  };
  return { d, rows, calls };
}

const ME = { orgId: 'org-1', userId: 'user-1' };

describe('connecting an address', () => {
  it('creates the association, stores the two records and hands out our own name for record 2', async () => {
    const { d, calls, rows } = deps();
    const r = await connectClubDomain(d, { ...ME, raw: 'https://WWW.LakeshoreLynx.ca/home', mode: 'www' });
    assert.ok(r.ok);
    assert.deepEqual(calls, ['create www.lakeshorelynx.ca']);
    const row = rows.get('org-1')!;
    assert.equal(row.full_name, 'www.lakeshorelynx.ca');
    assert.equal(row.record1_name, '_c3e2d2');
    assert.equal(row.record2_name, 'www');
    assert.equal(row.record2_value, 'sites.fieldlogichq.ca');
    assert.equal(row.record2_host_target, 'd20q9j9hp0ol2g.cloudfront.net');
    assert.equal(row.host_branch, 'dev');
  });

  it('hands out the host\'s own target when no name of ours is configured', async () => {
    const { d, rows } = deps({ siteTarget: null });
    await connectClubDomain(d, { ...ME, raw: 'lakeshorelynx.ca', mode: 'www' });
    assert.equal(rows.get('org-1')!.record2_value, 'd20q9j9hp0ol2g.cloudfront.net');
  });

  it('refuses bad input before touching the host', async () => {
    const { d, calls } = deps();
    assert.deepEqual(await connectClubDomain(d, { ...ME, raw: 'fieldlogichq.ca', mode: 'www' }), { ok: false, reason: 'ours' });
    assert.deepEqual(await connectClubDomain(d, { ...ME, raw: 'not a domain', mode: 'www' }), { ok: false, reason: 'not_a_domain' });
    assert.deepEqual(await connectClubDomain(d, { ...ME, raw: 'lynx.ca', mode: 'other' }), { ok: false, reason: 'needs_a_name' });
    assert.deepEqual(calls, []);
  });

  it('refuses the demo club, and fails closed when the demo list cannot load', async () => {
    const demo = deps({ isDemoOrg: async () => true });
    assert.deepEqual(await connectClubDomain(demo.d, { ...ME, raw: 'lynx.ca', mode: 'www' }), { ok: false, reason: 'demo' });
    assert.deepEqual(demo.calls, []);
    const broken = deps({ isDemoOrg: async () => { throw new Error('list unavailable'); } });
    assert.deepEqual(await connectClubDomain(broken.d, { ...ME, raw: 'lynx.ca', mode: 'www' }), { ok: false, reason: 'failed' });
    assert.deepEqual(broken.calls, []);
  });

  it('refuses a name another club holds, and a club that already has one', async () => {
    const first = deps();
    await connectClubDomain(first.d, { ...ME, raw: 'lynx.ca', mode: 'www' });
    const other = { ...first.d, store: first.d.store };
    assert.deepEqual(await connectClubDomain(other, { orgId: 'org-2', userId: 'u2', raw: 'lynx.ca', mode: 'www' }), { ok: false, reason: 'taken' });
    assert.deepEqual(await connectClubDomain(other, { ...ME, raw: 'other.ca', mode: 'www' }), { ok: false, reason: 'already_connected' });
  });

  describe('a hold that never went live gives way (owner ruling 2026-10-24)', () => {
    const held = (patch: Partial<DomainRow>): DomainRow => ({
      id: 'id-x', org_id: 'org-9', full_name: 'www.lynx.ca', domain: 'lynx.ca', prefix: 'www', status: 'waiting', host_status: null,
      host_branch: 'dev', record1_name: '_a', record1_value: '_b.acm-validations.aws', record2_name: 'www', record2_value: 'sites.fieldlogichq.ca',
      record2_host_target: null, last_checked_at: null, last_check: null, waiting_since: NOW.toISOString(), connected_at: null,
      needs_attention_since: null, not_working_since: null, padlock_expires_at: null, live_email_sent_at: null, padlock_email_sent_at: null,
      padlock_reminder_sent_at: null, gave_up_email_sent_at: null, not_working_email_sent_at: null, created_by_user_id: null,
      created_at: NOW.toISOString(), ...patch,
    });
    const ask = (d: ServiceDeps) => connectClubDomain(d, { ...ME, raw: 'www.lynx.ca', mode: 'www' });

    it('hands a gave-up name to the next club, releasing the old association first', async () => {
      const { d, rows, calls } = deps({ rows: [held({ status: 'not_connected' })] });
      const r = await ask(d);
      assert.ok(r.ok);
      assert.deepEqual(calls, ['remove lynx.ca', 'create www.lynx.ca']);
      assert.equal(rows.has('org-9'), false);
      assert.equal(rows.get('org-1')!.full_name, 'www.lynx.ca');
    });

    it('hands over a waiting name only once its two days are up, even before the status check has marked it', async () => {
      const young = deps({ rows: [held({ waiting_since: new Date(NOW.getTime() - WAITING_GIVE_UP_MS + 60_000).toISOString() })] });
      assert.deepEqual(await ask(young.d), { ok: false, reason: 'taken' });
      assert.deepEqual(young.calls, []);
      const old = deps({ rows: [held({ waiting_since: new Date(NOW.getTime() - WAITING_GIVE_UP_MS).toISOString() })] });
      assert.ok((await ask(old.d)).ok);
    });

    it('never takes a name that has been live, whatever state it is in now', async () => {
      for (const status of ['connected', 'needs_attention', 'not_working'] as const) {
        const live = deps({ rows: [held({ status, connected_at: NOW.toISOString() })] });
        assert.deepEqual(await ask(live.d), { ok: false, reason: 'taken' });
        assert.deepEqual(live.calls, []);
      }
      // Even a row whose status says it gave up keeps its name if it was ever live.
      const was = deps({ rows: [held({ status: 'not_connected', connected_at: NOW.toISOString() })] });
      assert.deepEqual(await ask(was.d), { ok: false, reason: 'taken' });
    });

    it('leaves the hold alone when the host cannot be told', async () => {
      const { d, rows } = deps({ rows: [held({ status: 'not_connected' })], hostOver: { remove: async () => { throw new Error('host down'); } } });
      assert.deepEqual(await ask(d), { ok: false, reason: 'failed' });
      assert.equal(rows.has('org-9'), true);
    });
  });

  it('maps the host\'s refusals, and leaves nothing behind', async () => {
    const limit = deps({ hostOver: { create: async () => { throw Object.assign(new Error('x'), { name: 'LimitExceededException' }); } } });
    assert.deepEqual(await connectClubDomain(limit.d, { ...ME, raw: 'lynx.ca', mode: 'www' }), { ok: false, reason: 'limit' });
    const held = deps({ hostOver: { create: async () => { throw Object.assign(new Error('x'), { name: 'CNAMEAlreadyExistsException' }); } } });
    assert.deepEqual(await connectClubDomain(held.d, { ...ME, raw: 'lynx.ca', mode: 'www' }), { ok: false, reason: 'held_elsewhere' });
    assert.equal(held.rows.size, 0);
  });

  it('removes the association when the host never gave the records', async () => {
    const { d, calls, rows } = deps({ hostOver: { create: async () => ({ ...RECORDS, record1: null }) } });
    assert.deepEqual(await connectClubDomain(d, { ...ME, raw: 'lynx.ca', mode: 'www' }), { ok: false, reason: 'failed' });
    assert.ok(calls.includes('remove lynx.ca'));
    assert.equal(rows.size, 0);
  });

  it('removes the association when the row cannot be saved (a race for the same name)', async () => {
    const { d, calls } = deps();
    d.store.insert = async () => { throw { code: '23505' }; };
    assert.deepEqual(await connectClubDomain(d, { ...ME, raw: 'lynx.ca', mode: 'www' }), { ok: false, reason: 'taken' });
    assert.ok(calls.includes('remove lynx.ca'));
  });
});

describe('check now', () => {
  async function connected(cnames: Record<string, string[]>) {
    const ctx = deps({ cnames });
    await connectClubDomain(ctx.d, { ...ME, raw: 'lynx.ca', mode: 'www' });
    return ctx;
  }

  it('reports what it sees, writes it, and never moves the connection to connected', async () => {
    const ctx = await connected({
      '_c3e2d2.lynx.ca': ['_6f1b9a.xlfgrmvvlj.acm-validations.aws.'],
      'www.lynx.ca': ['ghs.googlehosted.com'],
    });
    const r = await checkClubDomainNow(ctx.d, 'org-1');
    assert.ok(r.ok);
    assert.deepEqual(r.record1, { state: 'found' });
    assert.deepEqual(r.record2, { state: 'points_elsewhere', sees: 'ghs.googlehosted.com' });
    assert.equal(r.row.status, 'waiting');
    assert.equal(r.row.last_checked_at, NOW.toISOString());
  });

  it('is Found for both when record 2 names ours or the host\'s own target', async () => {
    const ours = await connected({ 'www.lynx.ca': ['sites.fieldlogichq.ca'] });
    const a = await checkClubDomainNow(ours.d, 'org-1');
    assert.ok(a.ok && a.record2.state === 'found');
    const theirs = await connected({ 'www.lynx.ca': ['d20q9j9hp0ol2g.cloudfront.net'] });
    const b = await checkClubDomainNow(theirs.d, 'org-1');
    assert.ok(b.ok && b.record2.state === 'found');
  });

  it('says not seen yet when neither is there, and says none when there is no connection', async () => {
    const ctx = await connected({});
    const r = await checkClubDomainNow(ctx.d, 'org-1');
    assert.ok(r.ok && r.record1.state === 'not_seen' && r.record2.state === 'not_seen');
    assert.deepEqual(await checkClubDomainNow(ctx.d, 'nobody'), { ok: false, reason: 'none' });
  });

  it('reports a lookup that could not be made, and writes nothing', async () => {
    const ctx = await connected({});
    ctx.d.dns = { async cnames() { throw new Error('timeout'); } };
    assert.deepEqual(await checkClubDomainNow(ctx.d, 'org-1'), { ok: false, reason: 'lookup_failed' });
    assert.equal(ctx.rows.get('org-1')!.last_checked_at, null);
  });
});

describe('try again', () => {
  it('starts a gave-up connection over with the same records', async () => {
    const ctx = deps();
    await connectClubDomain(ctx.d, { ...ME, raw: 'lynx.ca', mode: 'www' });
    ctx.rows.set('org-1', { ...ctx.rows.get('org-1')!, status: 'not_connected', waiting_since: '2026-10-20T00:00:00.000Z' });
    const r = await retryClubDomain(ctx.d, 'org-1');
    assert.ok(r.ok);
    assert.equal(r.row.status, 'waiting');
    assert.equal(r.row.waiting_since, NOW.toISOString());
    assert.equal(r.row.record1_value, RECORDS.record1!.value);
  });

  it('recreates the association if the host lost it', async () => {
    const ctx = deps({ hostOver: { read: async () => null } });
    await connectClubDomain(ctx.d, { ...ME, raw: 'lynx.ca', mode: 'www' });
    ctx.rows.set('org-1', { ...ctx.rows.get('org-1')!, status: 'not_connected' });
    await retryClubDomain(ctx.d, 'org-1');
    assert.equal(ctx.calls.filter((c) => c === 'create www.lynx.ca').length, 2);
  });

  it('only a connection that gave up can be started again', async () => {
    const ctx = deps();
    await connectClubDomain(ctx.d, { ...ME, raw: 'lynx.ca', mode: 'www' });
    assert.deepEqual(await retryClubDomain(ctx.d, 'org-1'), { ok: false, reason: 'not_retryable' });
    assert.deepEqual(await retryClubDomain(ctx.d, 'nobody'), { ok: false, reason: 'none' });
  });
});

describe('stopping', () => {
  it('tells the host first, then forgets the row', async () => {
    const ctx = deps();
    await connectClubDomain(ctx.d, { ...ME, raw: 'lynx.ca', mode: 'www' });
    assert.deepEqual(await stopClubDomain(ctx.d, 'org-1'), { ok: true });
    assert.ok(ctx.calls.includes('remove lynx.ca'));
    assert.equal(ctx.rows.size, 0);
  });

  it('keeps the row when the host cannot be told, so the name is never orphaned', async () => {
    const ctx = deps();
    await connectClubDomain(ctx.d, { ...ME, raw: 'lynx.ca', mode: 'www' });
    ctx.d.host.remove = async () => { throw new Error('service down'); };
    assert.deepEqual(await stopClubDomain(ctx.d, 'org-1'), { ok: false, reason: 'failed' });
    assert.equal(ctx.rows.size, 1);
    assert.deepEqual(await stopClubDomain(ctx.d, 'nobody'), { ok: false, reason: 'none' });
  });
});

describe('what the screen is told', () => {
  it('carries the records and the give-up time, and none of the internals', async () => {
    const ctx = deps();
    const r = await connectClubDomain(ctx.d, { ...ME, raw: 'lynx.ca', mode: 'www' });
    assert.ok(r.ok);
    const view = toDomainView(r.row);
    assert.equal(view.records.padlock.name, '_c3e2d2');
    assert.equal(view.records.site.value, 'sites.fieldlogichq.ca');
    assert.equal(new Date(view.giveUpAt).getTime() - new Date(view.waitingSince).getTime(), WAITING_GIVE_UP_MS);
    const keys = Object.keys(view).join(',');
    for (const secret of ['id', 'org_id', 'record2_host_target', 'created_by_user_id', 'email']) {
      assert.ok(!keys.includes(secret), secret);
    }
  });
});

describe('the host\'s answers, in our words', () => {
  it('reads a record string, with or without its trailing dots', () => {
    assert.deepEqual(parseDnsRecord('_c3e2d2.lynx.ca. CNAME _6f1b9a.x.acm-validations.aws.'), {
      name: '_c3e2d2.lynx.ca', type: 'CNAME', value: '_6f1b9a.x.acm-validations.aws',
    });
    assert.deepEqual(parseDnsRecord('www CNAME d20q9j9hp0ol2g.cloudfront.net'), {
      name: 'www', type: 'CNAME', value: 'd20q9j9hp0ol2g.cloudfront.net',
    });
    assert.equal(parseDnsRecord(''), null);
    assert.equal(parseDnsRecord(undefined), null);
  });
  it('shows a record name the way a club types it', () => {
    assert.equal(relativeRecordName('_c3e2d2.lynx.ca.', 'lynx.ca'), '_c3e2d2');
    assert.equal(relativeRecordName('_c3e2d2.other.com', 'lynx.ca'), '_c3e2d2.other.com');
  });
  it('maps the host\'s statuses to live, pending and failed', () => {
    assert.equal(mapHostStatus('AVAILABLE'), 'live');
    assert.equal(mapHostStatus('FAILED'), 'failed');
    for (const s of ['CREATING', 'PENDING_VERIFICATION', 'IN_PROGRESS', 'AWAITING_APP_CNAME', 'REQUESTING_CERTIFICATE', '', undefined])
      assert.equal(mapHostStatus(s), 'pending', String(s));
  });
  it('classifies the host\'s errors', () => {
    assert.equal(classifyHostError({ name: 'LimitExceededException' }), 'limit');
    assert.equal(classifyHostError({ name: 'CNAMEAlreadyExistsException' }), 'held_elsewhere');
    assert.equal(classifyHostError(new Error('One or more of the CNAMEs you provided are already associated')), 'held_elsewhere');
    assert.equal(classifyHostError(new Error('boom')), 'failed');
    assert.equal(classifyHostError(null), 'failed');
  });
});

describe('every refusal has words and a status', () => {
  it('no refusal is left unspoken', () => {
    const reasons = ['ours', 'not_a_domain', 'needs_a_name', 'demo', 'taken', 'already_connected', 'held_elsewhere', 'limit', 'failed'] as const;
    for (const reason of reasons) {
      assert.ok(OWN_ADDRESS_REFUSALS[reason].length > 10, reason);
      assert.ok(OWN_ADDRESS_REFUSAL_STATUS[reason] >= 400, reason);
    }
    assert.equal(Object.keys(OWN_ADDRESS_REFUSALS).length, reasons.length);
  });
});
