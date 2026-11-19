/**
 * Board Ready leftover call 17 (owner 2026-11-19, "fix it"): a failed activity-record line is still swallowed (the change
 * stands, the person's answer is unchanged) but it now opens an issue in the platform's feed, naming the action and the
 * club and NOTHING from the row — the payload holds emails and access maps, and an error's message can quote the row.
 */
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { billingTestLoader } from './_billing-test-loader.ts';

const REPO = resolve(import.meta.dirname, '../..');

type Captured = { err: Error; opts: Record<string, unknown> };
type InsertResult = { error: { message: string; code?: string } | null };

const PAYLOAD = { email: 'invitee@example.com', access: { money: true, roster: 'read' } };
const DB_MESSAGE = 'insert violates foreign key: Key (org_id)=(x) quoted invitee@example.com';
const THROWN_MESSAGE = 'socket hang up while sending invitee@example.com';

function load(insert: () => Promise<InsertResult>, capture: (err: Error, opts: Record<string, unknown>) => Promise<void>) {
  const inserted: unknown[] = [];
  const mod = billingTestLoader({
    './supabase-admin': {
      supabaseAdmin: { from: (table: string) => ({ insert: (row: unknown) => { inserted.push({ table, row }); return insert(); } }) },
    },
    './capture': { captureError: capture },
  })('lib/org-audit.ts') as {
    writeOrgAudit: (orgId: string, actorId: string | null, targetId: string | null, action: string, payload: Record<string, unknown>) => Promise<void>;
  };
  return { writeOrgAudit: mod.writeOrgAudit, inserted };
}

function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  return fn().finally(() => { console.error = original; });
}

function assertNothingFromTheRow(c: Captured) {
  const sent = JSON.stringify({ message: c.err.message, stack: c.err.stack, name: c.err.name, opts: c.opts });
  assert.doesNotMatch(sent, /invitee@example\.com/, 'no email from the payload or the error');
  assert.doesNotMatch(sent, /roster|access/, 'no access map');
  assert.doesNotMatch(sent, /foreign key|socket hang up/, 'no error message or body');
}

describe('a failed activity-record line opens an issue (leftover call 17)', () => {
  it('a refused insert is swallowed and reported with the action and the club only', async () => {
    const captured: Captured[] = [];
    const { writeOrgAudit } = load(
      async () => ({ error: { message: DB_MESSAGE, code: '23503' } }),
      async (err, opts) => { captured.push({ err, opts }); },
    );
    await quiet(() => writeOrgAudit('org-1', 'actor-1', null, 'member_invited', PAYLOAD));
    assert.equal(captured.length, 1);
    const [c] = captured;
    assert.equal(c.opts.title, 'Activity record line not written: member_invited');
    assert.equal(c.opts.org, undefined, 'the line’s club rides in the context: as the issue’s org, a gone club sinks the report');
    assert.deepEqual(c.opts.requestContext, { record: 'org_audit_log', action: 'member_invited', orgId: 'org-1', cause: '23503' });
    assert.equal(c.opts.severity, 'error', 'an issue that alerts, never routed to critical by the page it ran on');
    assert.equal(c.opts.marksRequestCaptured, false, 'a side issue: the request’s own returned 5xx still gets its issue');
    assertNothingFromTheRow(c);
  });

  it('a thrown insert is swallowed and reported without the thrown message', async () => {
    const captured: Captured[] = [];
    const { writeOrgAudit } = load(
      async () => { throw new Error(THROWN_MESSAGE); },
      async (err, opts) => { captured.push({ err, opts }); },
    );
    await quiet(() => writeOrgAudit('org-2', null, null, 'pay_link_stopped', PAYLOAD));
    assert.equal(captured.length, 1);
    assert.equal((captured[0].opts.requestContext as { cause: string }).cause, 'thrown');
    assertNothingFromTheRow(captured[0]);
  });

  it('one action groups as one issue: the stack is the same whoever calls it', async () => {
    const captured: Captured[] = [];
    const { writeOrgAudit } = load(
      async () => ({ error: { message: DB_MESSAGE } }),
      async (err, opts) => { captured.push({ err, opts }); },
    );
    await quiet(() => writeOrgAudit('org-1', null, null, 'role_changed', PAYLOAD));
    await quiet(() => writeOrgAudit('org-1', null, null, 'role_changed', {}));
    await quiet(() => writeOrgAudit('org-1', null, null, 'member_removed', {}));
    assert.equal(captured[0].err.stack, captured[1].err.stack);
    assert.notEqual(captured[0].err.stack, captured[2].err.stack);
    assert.equal((captured[0].opts.requestContext as { cause: unknown }).cause, 'unknown', 'no code on the error: a word, not the message');
  });

  it('a written line reports nothing', async () => {
    let calls = 0;
    const { writeOrgAudit, inserted } = load(async () => ({ error: null }), async () => { calls++; });
    await writeOrgAudit('org-1', 'actor-1', 'target-1', 'member_invited', PAYLOAD);
    assert.equal(calls, 0);
    assert.equal(inserted.length, 1);
  });

  it('a report that hangs never holds the person’s save past the bound', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const { writeOrgAudit } = load(async () => ({ error: { message: DB_MESSAGE } }), () => new Promise<void>(() => {}));
      let settled = false;
      const done = quiet(() => writeOrgAudit('org-1', null, null, 'member_invited', PAYLOAD)).then(() => { settled = true; });
      await new Promise(r => setImmediate(r));
      assert.equal(settled, false, 'still waiting inside the bound');
      mock.timers.tick(2000);
      await done;
      assert.equal(settled, true);
      // In an outage a request can write many lines (a sign-in, a merge): after one report hits the bound, the
      // next ones don't wait at all, so the request pays the bound once, not once a line.
      let second = false;
      const next = quiet(() => writeOrgAudit('org-1', null, null, 'member_removed', PAYLOAD)).then(() => { second = true; });
      await new Promise(r => setImmediate(r));
      assert.equal(second, true, 'the second line did not wait');
      await next;
    } finally {
      mock.timers.reset();
    }
  });
});

describe('every product writer of the record tables reports a failed line (leftover calls 17 and 18 census, 2026-11-19)', () => {
  // A new direct write would read its own answer, or (as seven did) none at all. Write through the table's writer.
  const WRITERS: Record<string, string> = {
    org_audit_log: 'lib/org-audit.ts',
    platform_audit_log: 'lib/platform-audit.ts',
    platform_events: 'lib/platform-events.ts',
    // Leftover call 18 (a)–(c).
    platform_record_opens: 'lib/platform-record-opens.ts',
    platform_sent_email_searches: 'lib/sent-log.ts',
    stripe_connect_events: 'lib/connect-event-log.ts',
  };

  const sources = (dir: string) => readdirSync(join(REPO, dir), { withFileTypes: true, recursive: true })
    .filter(e => e.isFile() && /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name))
    .map(e => relative(REPO, join(e.parentPath, e.name)).replace(/\\/g, '/'));
  const texts = [...sources('app'), ...sources('lib')].map(f => ({ f, text: readFileSync(join(REPO, f), 'utf8') }));

  for (const [table, writer] of Object.entries(WRITERS)) {
    it(`${table} is inserted, upserted or updated only by ${writer}`, () => {
      const write = new RegExp(`from\\(\\s*['"]${table}['"]\\s*\\)\\s*\\.(insert|upsert|update)\\(`);
      assert.deepEqual(texts.filter(t => write.test(t.text)).map(t => t.f), [writer]);
    });
  }

  it('the platform audit and event writers report a failed line the same way, without the row', async () => {
    const captured: Captured[] = [];
    const loader = billingTestLoader({
      './supabase-admin': {
        supabaseAdmin: { from: () => ({ insert: async () => ({ error: { message: DB_MESSAGE, code: '23514' } }) }) },
      },
      './capture': { captureError: async (err: Error, opts: Record<string, unknown>) => { captured.push({ err, opts }); } },
    });
    const { writePlatformAuditLog } = loader('lib/platform-audit.ts') as {
      writePlatformAuditLog: (a: string, o: string | null, action: string, f?: string, oldV?: unknown, newV?: unknown) => Promise<void>;
    };
    const { writePlatformEvent } = loader('lib/platform-events.ts') as {
      writePlatformEvent: (i: Record<string, unknown>) => Promise<void>;
    };
    await quiet(() => writePlatformAuditLog('staff@example.com', 'org-3', 'update_plan', 'plan', PAYLOAD, PAYLOAD));
    await quiet(() => writePlatformEvent({ eventType: 'plan_changed', source: 'app', orgId: 'org-3', actorEmail: 'invitee@example.com', metadata: PAYLOAD }));
    assert.deepEqual(captured.map(c => c.opts.title), ['Platform audit line not written: update_plan', 'Platform event not written: plan_changed']);
    assert.deepEqual(captured.map(c => (c.opts.requestContext as { record: string }).record), ['platform_audit_log', 'platform_events']);
    for (const c of captured) assertNothingFromTheRow(c);
    assert.doesNotMatch(JSON.stringify(captured.map(c => c.opts)), /staff@example\.com/);
  });
});

/**
 * Leftover call 18 (owner 2026-11-19, "fix (a)–(c), accept (d)"): three more writers never read their write's answer.
 * (a) staff's records-opened trail, (b) the Sent emails search count (whose failure let a search through uncounted, the
 * daily brake failing OPEN), (c) the Stripe Connect event log, written by both Connect webhooks.
 */
describe('the other records report a failed line too (leftover call 18)', () => {
  type Answer = { error: { message: string; code?: string } | null; count?: number; data?: unknown };
  type Db = ReturnType<typeof fakeDb>;

  /** A fake database: every call answers from `answer(op)`, and every call (with its arguments) is noted. */
  function fakeDb(answer: (op: string) => Answer | 'throw') {
    const calls: string[] = [];
    const args: Record<string, unknown[]> = {};
    const chain = (op: string): unknown => {
      const settle = () => {
        const a = answer(op);
        return a === 'throw' ? Promise.reject(new Error(THROWN_MESSAGE)) : Promise.resolve(a);
      };
      const link: Record<string, unknown> = {};
      for (const m of ['eq', 'gte', 'lt', 'limit']) link[m] = () => link;
      link.maybeSingle = () => settle();
      link.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => settle().then(ok, bad);
      return link;
    };
    const op = (table: string, name: string) => (...a: unknown[]) => { calls.push(`${table}.${name}`); args[name] = a; return chain(name); };
    const supabaseAdmin = {
      from: (table: string) => Object.fromEntries(['select', 'insert', 'upsert', 'update', 'delete'].map(n => [n, op(table, n)])),
    };
    return { supabaseAdmin, calls, args };
  }

  function loaderWith(db: Db, captured: Captured[]) {
    return billingTestLoader({
      './supabase-admin': { supabaseAdmin: db.supabaseAdmin },
      './capture': { captureError: async (err: Error, opts: Record<string, unknown>) => { captured.push({ err, opts }); } },
      './platform-auth': { getBootstrapAdminEmails: () => [] },
    });
  }

  const ok: Answer = { error: null, data: [] };
  const refused: Answer = { error: { message: DB_MESSAGE, code: '23503' } };
  const ctx = (c: Captured) => c.opts.requestContext as { record: string; action: string; orgId: unknown; cause: string };

  describe('(a) the records-opened trail', () => {
    type Opened = (o: { actorUserId: string; actorEmail: string | null; kind: 'club' | 'person' | 'email'; recordId: string; viaFind: boolean }) => Promise<void>;
    const open = (db: Db, captured: Captured[]) => (loaderWith(db, captured)('lib/platform-record-opens.ts') as { recordOpened: Opened }).recordOpened;
    const args = { actorUserId: 'staff-1', actorEmail: 'staff@example.com', kind: 'person' as const, recordId: 'person-1', viaFind: true };

    it('a refused line opens one issue with nothing from the row, and the record still opens', async () => {
      const captured: Captured[] = [];
      await quiet(() => open(fakeDb(o => (o === 'insert' ? refused : ok)), captured)(args));
      assert.equal(captured.length, 1);
      assert.equal(captured[0].opts.title, 'Records-opened line not written: record_opened');
      assert.deepEqual(ctx(captured[0]), { record: 'platform_record_opens', action: 'record_opened', orgId: null, cause: '23503' });
      assertNothingFromTheRow(captured[0]);
      assert.doesNotMatch(JSON.stringify(captured[0].opts), /staff@example\.com|person-1/);
    });

    it('a thrown line is reported too; a failed prune after a saved line is not a lost line', async () => {
      const thrown: Captured[] = [];
      await quiet(() => open(fakeDb(o => (o === 'insert' ? 'throw' : ok)), thrown)(args));
      assert.equal(thrown.length, 1);
      assert.equal(ctx(thrown[0]).cause, 'thrown');
      const pruned: Captured[] = [];
      await quiet(() => open(fakeDb(o => (o === 'delete' ? 'throw' : ok)), pruned)(args));
      assert.equal(pruned.length, 0);
    });
  });

  describe('(b) the Sent emails search count fails CLOSED', () => {
    type Take = (actor: string) => Promise<'taken' | 'limit' | 'unwritten'>;
    const take = (db: Db, captured: Captured[]) => (loaderWith(db, captured)('lib/sent-log.ts') as { takeSentEmailSearch: Take }).takeSentEmailSearch;
    const counted = (n: number): Answer => ({ error: null, count: n });

    it('a count that cannot be written refuses the search and opens an issue', async () => {
      const captured: Captured[] = [];
      assert.equal(await quiet(() => take(fakeDb(o => (o === 'select' ? counted(3) : o === 'insert' ? refused : ok)), captured)('staff-1')), 'unwritten');
      assert.equal(captured.length, 1);
      assert.equal(captured[0].opts.title, 'Sent emails search count not written: sent_email_search');
      assertNothingFromTheRow(captured[0]);
      const thrown: Captured[] = [];
      assert.equal(await quiet(() => take(fakeDb(o => (o === 'select' ? counted(3) : o === 'insert' ? 'throw' : ok)), thrown)('staff-1')), 'unwritten');
      assert.equal(thrown.length, 1);
    });

    it('a count that cannot be read refuses the search (it throws to the route’s one sentence), never the limit line', async () => {
      const db = fakeDb(o => (o === 'select' ? refused : ok));
      await assert.rejects(take(db, [])('staff-1'));
      assert.ok(!db.calls.includes('platform_sent_email_searches.insert'), 'nothing counted');
      // A blank count with no error is unreadable too, never zero.
      const blank = fakeDb(o => (o === 'select' ? { error: null } : ok));
      await assert.rejects(take(blank, [])('staff-1'));
      assert.ok(!blank.calls.includes('platform_sent_email_searches.insert'));
    });

    it('a failed prune after a counted search never refuses it', async () => {
      assert.equal(await take(fakeDb(o => (o === 'select' ? counted(3) : o === 'delete' ? 'throw' : ok)), [])('staff-1'), 'taken');
    });

    it('under the limit is taken and counted; at the limit is refused without a count', async () => {
      const under = fakeDb(o => (o === 'select' ? counted(199) : ok));
      assert.equal(await take(under, [])('staff-1'), 'taken');
      assert.ok(under.calls.includes('platform_sent_email_searches.insert'));
      const at = fakeDb(o => (o === 'select' ? counted(200) : ok));
      assert.equal(await take(at, [])('staff-1'), 'limit');
      assert.ok(!at.calls.includes('platform_sent_email_searches.insert'));
    });
  });

  describe('(c) the Stripe Connect event log', () => {
    type Log = {
      openConnectEvent: (e: { id: string; type: string; livemode: boolean }, account: string) => Promise<'processed' | 'open'>;
      markConnectEventProcessed: (id: string) => Promise<void>;
      markConnectEventFailed: (id: string, err: unknown) => Promise<void>;
      stampConnectEventOrg: (id: string, orgId: string) => Promise<void>;
    };
    const log = (db: Db, captured: Captured[]) => loaderWith(db, captured)('lib/connect-event-log.ts') as Log;
    const EVENT = { id: 'evt_made_up', type: 'checkout.session.completed', livemode: false };
    const unseen: Answer = { error: null, data: null };

    it('a refused first line is reported and the event still runs (the log is not what makes handling correct)', async () => {
      const captured: Captured[] = [];
      assert.equal(await quiet(() => log(fakeDb(o => (o === 'select' ? unseen : refused)), captured).openConnectEvent(EVENT, 'acct_1')), 'open');
      assert.equal(captured.length, 1);
      assert.equal(captured[0].opts.title, 'Stripe Connect event log line not written: event_open');
      assertNothingFromTheRow(captured[0]);
      assert.doesNotMatch(JSON.stringify(captured[0].opts), /evt_made_up|acct_1/);
    });

    it('the first line is written ON CONFLICT DO NOTHING: a concurrent delivery writing it is not a failure', async () => {
      const db = fakeDb(o => (o === 'select' ? unseen : ok));
      assert.equal(await log(db, []).openConnectEvent(EVENT, 'acct_1'), 'open');
      assert.deepEqual(db.calls, ['stripe_connect_events.select', 'stripe_connect_events.upsert']);
      assert.deepEqual(db.args.upsert[1], { onConflict: 'id', ignoreDuplicates: true });
    });

    it('an already-processed event is skipped; every stamp that fails is reported, with the club where known', async () => {
      const seen = fakeDb(() => ({ error: null, data: { processed_at: '2026-11-19T00:00:00Z', attempts: 1 } }));
      assert.equal(await log(seen, []).openConnectEvent(EVENT, 'acct_1'), 'processed');
      assert.deepEqual(seen.calls, ['stripe_connect_events.select']);

      const captured: Captured[] = [];
      const l = log(fakeDb(o => (o === 'select' ? { error: null, data: { processed_at: null, attempts: 1 } } : refused)), captured);
      await quiet(async () => {
        await l.openConnectEvent(EVENT, 'acct_1');
        await l.markConnectEventFailed(EVENT.id, new Error(THROWN_MESSAGE));
        await l.stampConnectEventOrg(EVENT.id, 'org-9');
        await l.markConnectEventProcessed(EVENT.id);
      });
      assert.deepEqual(captured.map(c => ctx(c).action), ['event_attempt', 'event_failed', 'event_org', 'event_processed']);
      assert.deepEqual(captured.map(c => ctx(c).orgId), [null, null, 'org-9', null]);
      for (const c of captured) assertNothingFromTheRow(c);
    });

    it('no write throws: a thrown write is reported, and the webhook’s answer stays its own', async () => {
      const captured: Captured[] = [];
      await quiet(() => log(fakeDb(() => 'throw'), captured).markConnectEventProcessed(EVENT.id));
      assert.equal(captured.length, 1);
    });
  });
});
