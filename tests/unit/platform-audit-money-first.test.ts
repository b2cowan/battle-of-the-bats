/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CHANGE LOG IS WRITTEN FIRST WHERE MONEY MOVES (Plans & pricing Stage 0, Part 9, fix 4).
 *
 * Every staff action that changes what a customer is charged writes its row, with its reason, BEFORE the change and
 * strictly (`writeAuditBeforeChange`): when the row cannot be written, the change is not made (the refund pattern). A
 * change that then fails gets a second row, `<action>_failed`, naming the first, and the Story leaves the first out.
 *
 *   1. MONEY_FIRST: each listed action is written by `writeAuditBeforeChange`, before the change it records, and never
 *      again by the best-effort writer (EXCEPTIONS says why the one that cannot be first is not).
 *   2. The helper: a refused row throws and nothing else runs; a failed change names the row it cancels.
 *   3. The readers: the Story and the "someone changed it" sentence leave out a change that did not happen.
 *
 * Not on the list, on purpose (they change what a club can use, not what it is charged): sections and add-ons (one club
 * or Bulk changes), plan availability and plan settings in the catalog, the feature matrix. The Stripe-fee retry re-runs
 * the product's own billing (a work tool on NO_REASON_FILES). An organization's delete already writes first.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode } from './_source-code.ts';
import { supabaseAdmin } from '../../lib/supabase-admin.ts';
import {
  AUDIT_FIRST_REFUSAL, AuditFirstError, auditFirst, baseAction, failedAuditIds, withoutFailedChanges, writeAuditBeforeChange,
} from '../../lib/platform-audit.ts';
import { HttpError } from '../../lib/http-error.ts';

type Site = { file: string; fn?: string; action: string; change: RegExp };

const MONEY_FIRST: Site[] = [
  { file: 'lib/operator-plan-change.ts', fn: 'applyOperatorPlanChange', action: 'input.audit.action', change: /\.update\(updatePayload\)/ },
  { file: 'app/api/platform-admin/bulk-operations/route.ts', action: "'run_bulk_operation'", change: /const results: BulkResult\[\] = \[\]/ },
  { file: 'app/api/platform-admin/bulk-operations/route.ts', action: "'bulk_create_override'", change: /\.from\('org_overrides'\)\s*\.insert/ },
  { file: 'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts', action: "'cancel_subscription'", change: /\.from\('billing_retention_intents'\)\s*\.insert/ },
  { file: 'app/api/platform-admin/product-catalog/change-requests/route.ts', fn: 'applyStripePriceUpdateProposal', action: "'update_stripe_price_id'", change: /\.from\('stripe_prices'\)\s*\.update/ },
  { file: 'lib/free-time-writes.ts', fn: 'giveFreeTime', action: "'create_override'", change: /\.from\('org_overrides'\)\s*\.insert/ },
  { file: 'lib/free-time-writes.ts', fn: 'changeFreeTimeEnd', action: "'change_override_end'", change: /\.update\(\{ expires_at: expiresAt \}\)/ },
  { file: 'lib/club-record-changes.ts', fn: 'endClubOverride', action: "'revoke_override'", change: /\.update\(\{ revoked_at:/ },
  { file: 'lib/portal-free-time-give.ts', fn: 'giveAgain', action: "'give_portal_free_time'", change: /\.from\('org_overrides'\)\.insert/ },
  { file: 'lib/portal-free-time-give.ts', fn: 'changePortalFreeTimeEnd', action: "'change_override_end'", change: /\.update\(\{ expires_at: expiresAt \}\)/ },
  { file: 'app/api/platform-admin/retention/[recordId]/extend/route.ts', action: "'extend_billing_retention'", change: /\.from\('billing_retained_records'\)\s*\.update/ },
];

/** Best-effort rows that keep a listed action, with why (field, or the function that writes it). */
const EXCEPTIONS: Array<{ file: string; action: string; marker: RegExp; why: string }> = [
  { file: 'lib/portal-free-time-give.ts', action: 'give_portal_free_time', marker: /mode: 'first'/,
    why: 'the first give makes the portal organization its row belongs on: it cannot exist before the give' },
  { file: 'lib/portal-keep-premium.ts', action: 'revoke_override', marker: /subscribed: true/,
    why: 'the coach\'s own checkout ends the free time it now pays for: the product acting for the customer, not a staff change' },
  { file: 'lib/portal-free-time-give.ts', action: 'give_portal_free_time', marker: /finished_half_made: true/,
    why: 'a detail row after a give whose own row was written first' },
];

const ACTIONS = new Set(MONEY_FIRST.map(s => s.action.replace(/'/g, '')).filter(a => /^[a-z_]+$/.test(a)));

describe('1 · each money action writes its row first, strictly', () => {
  for (const site of MONEY_FIRST) {
    it(`${site.file}${site.fn ? ` · ${site.fn}` : ''} · ${site.action}`, () => {
      const code = site.fn ? functionBody(readCode(site.file), site.fn) : readCode(site.file);
      const first = code.search(new RegExp(`(?:writeAuditBeforeChange|auditFirst)\\([^;]*?,\\s*${site.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`, 's'));
      assert.ok(first >= 0, `${site.action} is no longer written by writeAuditBeforeChange here`);
      const change = code.search(site.change);
      assert.ok(change >= 0, 'the change this guard orders against is still where it looks');
      assert.ok(first < change, `${site.action}: the row must be written before the change`);
    });
  }

  it('no listed action goes back to the best-effort writer (outside the named exceptions)', () => {
    const offenders: string[] = [];
    for (const file of [...filesUnder('app', '.ts'), ...filesUnder('lib', '.ts')]) {
      const code = readCode(file);
      for (const m of code.matchAll(/writePlatformAuditLog(?:Strict)?\(([\s\S]*?)\);/g)) {
        const action = /^[^,]+,[^,]+,\s*'([a-z_]+)'/.exec(m[1])?.[1];
        if (!action || !ACTIONS.has(action)) continue;
        if (EXCEPTIONS.some(e => e.file === file && e.action === action && e.marker.test(m[1]))) continue;
        offenders.push(`${file} · ${action}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('the refusal is an HttpError, so the route wrapper answers it in words (503) wherever it is thrown', () => {
    const err = new AuditFirstError();
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 503);
    assert.deepEqual(err.body(), { error: AUDIT_FIRST_REFUSAL });
  });

  it('every route that can meet it passes through the wrapper, and a route that catches everything lets it through', () => {
    for (const f of ['app/api/platform-admin/orgs/[id]/plan/route.ts', 'app/api/platform-admin/orgs/[id]/record/route.ts',
      'app/api/platform-admin/orgs/[id]/put-back/route.ts', 'app/api/platform-admin/bulk-operations/route.ts',
      'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts', 'app/api/platform-admin/retention/[recordId]/extend/route.ts',
      'app/api/platform-admin/product-catalog/change-requests/route.ts']) {
      assert.match(readCode(f), /withObservability\(/, f);
    }
    assert.match(readCode('app/api/platform-admin/orgs/[id]/put-back/route.ts'), /if \(isHttpError\(err\)\) throw err;/);
    // The record's save answers it itself, so "Already saved: name and web name" survives a refused plan.
    assert.match(readCode('app/api/platform-admin/orgs/[id]/record/route.ts'), /if \(err instanceof AuditFirstError\) return fail\(err\.status, AUDIT_FIRST_REFUSAL\);/);
  });

  it('a cancel that stops after archiving is told as unfinished, never as not made', () => {
    const code = readCode('app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts');
    const update = code.indexOf("subscription_status: 'canceled',");
    const after = code.slice(update, code.indexOf('closePagesIfPaymentsEnded', update));
    assert.match(after, /'cancel_subscription_incomplete'/);
    assert.doesNotMatch(after, /changeFailed\(/);
    assert.match(readCode('lib/platform-story.ts'), /r\.action === 'cancel_subscription_incomplete'/);
  });
});

// ── The helper, against a stand-in database ─────────────────────────────────────────────────────

function withInserts(answer: (row: Record<string, unknown>) => { data: unknown; error: unknown }) {
  const rows: Array<Record<string, unknown>> = [];
  const original = supabaseAdmin.from;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (supabaseAdmin as any).from = () => ({
    insert(row: Record<string, unknown>) {
      rows.push(row);
      const res = answer(row);
      return { select: () => ({ single: async () => res }), then: (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok) };
    },
  });
  return { rows, restore: () => { (supabaseAdmin as { from: typeof original }).from = original; } };
}

describe('2 · the helper', () => {
  it('a row that cannot be written throws the refusal, and the caller never reaches its change', async () => {
    const db = withInserts(() => ({ data: null, error: { code: '57P01' } }));
    let changed = false;
    try {
      await assert.rejects(async () => {
        await writeAuditBeforeChange('a@x.ca', 'org_1', 'cancel_subscription', 'subscription_status', 'active', { status: 'canceled' }, { reason: 'asked' });
        changed = true;
      }, (err: unknown) => err instanceof AuditFirstError && err.message === AUDIT_FIRST_REFUSAL);
    } finally { db.restore(); }
    assert.equal(changed, false);
    assert.equal(db.rows[0].reason, 'asked');
  });

  it('a change that then fails writes `<action>_failed` naming the first row, with the same reason', async () => {
    const db = withInserts(() => ({ data: { id: 'row_1' }, error: null }));
    try {
      const failed = await writeAuditBeforeChange('a@x.ca', 'org_1', 'extend_billing_retention', 'retention_until', null, { days: 30 }, { reason: 'grace' });
      await failed({ message: 'connection reset' });
    } finally { db.restore(); }
    assert.equal(db.rows.length, 2);
    assert.equal(db.rows[1].action, 'extend_billing_retention_failed');
    assert.deepEqual(db.rows[1].new_value, { failedEntryId: 'row_1', error: 'connection reset' });
    assert.equal(db.rows[1].reason, 'grace');
  });

  it('auditFirst turns the refusal into the answer a { ok, status, error } write returns', async () => {
    const refusing = withInserts(() => ({ data: null, error: { code: '57P01' } }));
    try {
      assert.deepEqual(await auditFirst('a@x.ca', 'org_1', 'revoke_override', 'id', 'ov_1', null, { reason: 'r' }),
        { ok: false, status: 503, error: AUDIT_FIRST_REFUSAL });
    } finally { refusing.restore(); }
    const writing = withInserts(() => ({ data: { id: 'row_1' }, error: null }));
    try {
      assert.equal((await auditFirst('a@x.ca', 'org_1', 'revoke_override', 'id', 'ov_1', null, { reason: 'r' })).ok, true);
    } finally { writing.restore(); }
  });

  it('withoutFailedChanges drops a failed change and its failure row, and keeps a Stripe-failure row (it names no row)', () => {
    const rows = [
      { id: 'a1', action: 'cancel_subscription', new_value: { status: 'canceled' } },
      { id: 'a2', action: 'cancel_subscription_failed', new_value: { failedEntryId: 'a1', error: 'x' } },
      { id: 'a3', action: 'cancel_subscription', new_value: { status: 'canceled' } },
      { id: 'a4', action: 'cancel_subscription_stripe_failed', new_value: { error: 'Stripe said no' } },
    ];
    assert.deepEqual(withoutFailedChanges(rows).map(r => r.id), ['a3', 'a4']);
    assert.equal(baseAction('update_stripe_price_id_failed'), 'update_stripe_price_id');
    assert.equal(baseAction('update_stripe_price_id'), 'update_stripe_price_id');
  });

  it('failedAuditIds names only rows a failure row points at', () => {
    const ids = failedAuditIds([
      { action: 'cancel_subscription', new_value: { status: 'canceled' } },
      { action: 'cancel_subscription_failed', new_value: { failedEntryId: 'a1', error: 'x' } },
      { action: 'cancel_subscription_stripe_failed', new_value: { error: 'Stripe said no' } },
    ]);
    assert.deepEqual([...ids], ['a1']);
  });
});

describe('3 · readers leave out a change that did not happen', () => {
  it('the club Story tells its staff rows through withoutFailedChanges', () => {
    const body = functionBody(readCode('lib/platform-story.ts'), 'buildClubStory');
    assert.match(body, /const audit = withoutFailedChanges\(\(auditRes\.data \?\? \[\]\) as AuditRow\[\]\);/);
  });
  it('the audit page keeps both rows and marks them, pairing across pages and filters, and only rows that name another', () => {
    const page = readCode('app/platform-admin/audit/page.tsx');
    assert.match(page, /\$\{label\}: not made/);
    assert.match(page, /\$\{label\} \(not made\)/);
    // Read by the ids shown, not from the page's own rows (an action filter or a page break splits the pair).
    assert.match(page, /\.in\('new_value->>failedEntryId', ids\)/);
    // A Stripe-failure row ends in `_failed` but names no row: it is not "not made", and keeps its own doors.
    assert.match(page, /failedEntryOf\(\{ action: r\.action, new_value: r\.newValue \}\) \? 'failure_row'/);
    assert.match(page, /action: markOf\(raw\) === 'failure_row' \? baseAction\(row\.action\) : row\.action/);
  });
  it('"someone changed this free time" never names a refused change, the reader\'s own included', () => {
    const body = functionBody(readCode('lib/free-time-writes.ts'), 'staleSentence');
    assert.match(body, /withoutFailedChanges\(/);
  });
});
