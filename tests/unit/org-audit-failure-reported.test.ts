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

describe('every product writer of the record tables reports a failed line (leftover call 17 census, 2026-11-19)', () => {
  // A new direct insert would read its own answer, or (as four did) none at all. Write through the table's writer.
  const WRITERS: Record<string, string[]> = {
    org_audit_log: ['lib/org-audit.ts'],
    platform_audit_log: ['lib/platform-audit.ts'],
    platform_events: ['lib/platform-events.ts'],
  };

  function sources(dir: string): string[] {
    return readdirSync(join(REPO, dir), { withFileTypes: true, recursive: true })
      .filter(e => e.isFile() && /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name))
      .map(e => relative(REPO, join(e.parentPath, e.name)).replace(/\\/g, '/'));
  }
  const files = [...sources('app'), ...sources('lib')];

  for (const [table, allowed] of Object.entries(WRITERS)) {
    it(`${table} is inserted only by its writer`, () => {
      const insert = new RegExp(`from\\(\\s*['"]${table}['"]\\s*\\)\\s*\\.(insert|upsert)\\(`);
      const found = files.filter(f => insert.test(readFileSync(join(REPO, f), 'utf8')));
      assert.deepEqual(found.sort(), [...allowed].sort());
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
