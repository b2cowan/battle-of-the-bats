/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SUPPORT CONSOLE, STAGE 3 — MONEY (owner rulings Q1–Q12, 2026-10-26; build prompt §8; drawings H and G).
 *
 * A refund is a money write: designed, reviewed and tested as one. This suite runs the REAL refund and recovery
 * (`lib/console-money-stripe.ts`) against a fake Stripe and a fake store — no network, no database:
 *   1. one refund per click and per retry; Stripe's no leaves a refused record and no money moved; a lost answer is
 *      recovered by LISTING (zero refund requests); an in-flight start holds, an abandoned one is released;
 *   2. the server's rules (who, which club, which charge, how much, why, Billing's limits), each a fixed sentence;
 *   3. the order: our record first, or Stripe is never asked; the audit entry whether Stripe accepts or refuses;
 *   4. what leaves us (metadata, never the typed reason; never Stripe's own error text);
 *   5. no card data in anything we write;
 *   6. the reads (a role without the Stripe power never calls Stripe; Stripe down shows our record; nothing stored);
 *   6b. a charge that paid an invoice is refunded through ONE credit note (GST/HST Part 6b), never refunds.create;
 *   7. Find (nothing not shaped like a Stripe or invoice number builds a Stripe query);
 *   8. Q9 (a paying club's plan is refused everywhere); 10. Q7 (bulk billing status: an end, a cap, never your club);
 *   11. Q8 (one running plan grant, in the database); 12. the window foot face; 13. the 23 threats, each guarded.
 * (Guard 9, the Reason column, is `platform-audit-reason-guard.test.ts`.)
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Stripe from 'stripe';
import { readCode, readSource, filesUnder } from './_source-code.ts';
import {
  agreeLine, centsFromTyped, compareRecord, decideRefund, findPatterns, holdsCardNumber, REFUND_WORDS,
  type MoneyCharge, type MoneyRead, type RefundFacts,
} from '../../lib/console-money.ts';
import {
  InFlightError, RECOVERY_AFTER_MS, customerSharing, makeRefund, ownsObject, recoverRefunds, stripeErrorFacts,
  type RefundInput, type RefundRecord, type RefundStore,
} from '../../lib/console-money-stripe.ts';
import { MAX_PREVIEWS, creditLines, creditRoom, planCreditNote, type CreditTarget } from '../../lib/console-money-credit.ts';
import { stripeStillBills } from '../../lib/stripe-billing-state.ts';
import { invoiceNumberQuery, runFind, stripeNumberKind, type FindReaders } from '../../lib/platform-find.ts';
import { lastDayRefusal } from '../../lib/free-time.ts';
import { hasPlatformPower } from '../../lib/platform-areas.ts';

const NOW = new Date('2026-10-26T19:00:00.000Z');
const CHARGE: MoneyCharge = {
  id: 'ch_3Q8xL2Tz9Kq04Lk', createdAt: '2026-10-01T13:03:00.000Z', amountCents: 10000, currency: 'cad', status: 'succeeded',
  refundedCents: 0, disputed: false, failureCode: null, card: { brand: 'visa', last4: '4242' }, refunds: [], invoice: null,
};
const CLUB = { customerId: 'cus_Qa7Rk2Lm9Vt3Xy', customerShared: false };

// ── The fakes ────────────────────────────────────────────────────────────────────────────────────

type Captured = { inserts: Record<string, unknown>[]; completes: Array<{ id: string; patch: Record<string, unknown> }>; audits: Array<Record<string, unknown>> };

function fakeStore(seed: RefundRecord[] = [], opts: { insertFails?: boolean } = {}): RefundStore & { captured: Captured; records: RefundRecord[] } {
  const records = [...seed];
  const captured: Captured = { inserts: [], completes: [], audits: [] };
  let n = 0;
  return {
    records, captured,
    async openFor(chargeId) { return records.filter(r => (r as RefundRecord & { charge?: string }).charge === chargeId && (r.status === 'started' || r.status === 'unknown')); },
    async countByActorSince() { return 0; },
    async insertStarted(row) {
      captured.inserts.push(row as unknown as Record<string, unknown>);
      if (opts.insertFails) throw new Error('db down');
      // The partial unique index: one unfinished refund per charge.
      if (records.some(r => (r as RefundRecord & { charge?: string }).charge === row.stripe_charge_id && (r.status === 'started' || r.status === 'unknown'))) throw new InFlightError();
      const rec = { id: `rf-${++n}`, status: 'started', actor_email: row.actor_email, created_at: NOW.toISOString(), amount_cents: row.amount_cents,
        currency: row.currency, reason: row.reason, stripe_refund_id: null, stripe_invoice_id: row.stripe_invoice_id, charge: row.stripe_charge_id } as RefundRecord & { charge: string };
      records.push(rec);
      return { id: rec.id };
    },
    async complete(id, patch) {
      const r = records.find(x => x.id === id);
      if (!r || (r.status !== 'started' && r.status !== 'unknown')) return false; // only an unfinished record
      captured.completes.push({ id, patch: patch as Record<string, unknown> });
      Object.assign(r, patch);
      return true;
    },
    async audit(entry) { captured.audits.push(entry as unknown as Record<string, unknown>); },
  };
}

type Posted = { params: Stripe.RefundCreateParams; options: Stripe.RequestOptions };
function fakeStripe(opts: { error?: unknown; listed?: Array<{ id: string; metadata: Record<string, string> }>; refundedNow?: number } = {}) {
  const posted: Posted[] = [];
  const byKey = new Map<string, { id: string; status: string }>();
  let listCalls = 0;
  const stripe = {
    // The charge as Stripe holds it NOW (read again once our record holds the charge).
    charges: { async retrieve() { return { amount: CHARGE.amountCents, amount_refunded: opts.refundedNow ?? 0 }; } },
    refunds: {
      async create(params: Stripe.RefundCreateParams, options: Stripe.RequestOptions) {
        posted.push({ params, options });
        if (opts.error) throw opts.error;
        // Stripe answers a repeated key with its first refund.
        const key = options.idempotencyKey!;
        if (!byKey.has(key)) byKey.set(key, { id: `re_${byKey.size + 1}`, status: 'succeeded' });
        return byKey.get(key)!;
      },
      async list() { listCalls++; return { data: opts.listed ?? [], has_more: false }; },
    },
  } as unknown as Stripe;
  return { stripe, posted, listCalls: () => listCalls };
}

const input = (over: Partial<RefundInput> = {}): RefundInput => ({
  orgId: 'org-1', club: CLUB, actor: { email: 'billing@fieldlogichq.ca', role: 'billing' }, ownClub: false, demoClub: false,
  charge: CHARGE, invoice: null, ask: { amountCents: 10000, remainingSeenCents: 10000, reason: 'Charged twice on the Oct 1 renewal' },
  flaggedDuplicate: true, live: false, now: NOW, clock: () => '3:06 p.m.', ...over,
});
const stripeError = (statusCode: number, code: string, message = 'No such charge; acct_1ABC rk_live_secret') =>
  Object.assign(new Error(message), { statusCode, code, requestId: 'req_AbC123', type: 'StripeInvalidRequestError', raw: { message } });

// ── 1 · The refund, against a fake Stripe ───────────────────────────────────────────────────────

describe('1 · one refund per click, per retry; no means no money moved; recovery lists, never re-sends', () => {
  it('a double submit makes one refund (the second start is refused by the one-unfinished-refund rule)', async () => {
    const store = fakeStore();
    const s = fakeStripe();
    // The first start is written, its Stripe call still out; the second press arrives.
    store.records.push({ id: 'rf-x', status: 'started', actor_email: 'billing@fieldlogichq.ca', created_at: NOW.toISOString(), amount_cents: 10000,
      currency: 'cad', reason: 'r', stripe_refund_id: null, charge: CHARGE.id } as RefundRecord & { charge: string });
    const second = await makeRefund(s.stripe, store, input());
    assert.equal(second.ok, false);
    assert.equal(s.posted.length, 0);
    assert.match((second as { error: string }).error, /started a refund of this charge at 3:06 p\.m\./);
  });

  it('a retry carries the same key — our record’s id — so Stripe answers it with the first refund', async () => {
    const store = fakeStore();
    const s = fakeStripe();
    const r = await makeRefund(s.stripe, store, input());
    assert.ok(r.ok);
    assert.equal(s.posted.length, 1);
    assert.equal(s.posted[0].options.idempotencyKey, store.records[0].id);
    assert.ok((s.posted[0].options.maxNetworkRetries ?? 0) >= 1, 'the SDK retries a dropped request with the same key');
    // The same key again is the same refund.
    const again = await (s.stripe.refunds.create as (p: unknown, o: unknown) => Promise<{ id: string }>)(s.posted[0].params, s.posted[0].options);
    assert.equal(again.id, (r as { stripeRefundId: string }).stripeRefundId);
  });

  for (const [code, words] of [
    ['charge_already_refunded', /already refunded\. No money moved\./],
    ['charge_disputed', /disputed\. A disputed charge is answered in Stripe/],
    ['amount_too_large', /more than is left on the charge\. No money moved\./],
  ] as const) {
    it(`Stripe’s "${code}" leaves a refused record, the audit entry, and no money moved`, async () => {
      const store = fakeStore();
      const s = fakeStripe({ error: stripeError(400, code) });
      const r = await makeRefund(s.stripe, store, input());
      assert.equal(r.ok, false);
      assert.match((r as { error: string }).error, words);
      assert.equal(store.records[0].status, 'refused');
      assert.ok(store.captured.audits.some(a => a.action === 'refund_charge_refused'));
    });
  }

  it('a refund that finished since the person’s read is caught by reading Stripe again: no refund sent, the charge released', async () => {
    const store = fakeStore();
    const s = fakeStripe({ refundedNow: 5000 });
    const r = await makeRefund(s.stripe, store, input({ ask: { amountCents: 5000, remainingSeenCents: 10000, reason: 'Second half' } }));
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /^Only \$50\.00 of this charge can still be refunded: it changed since you opened it\./);
    assert.equal(s.posted.length, 0);
    assert.equal(store.records[0].status, 'not_made');
  });

  it('a timeout, a Stripe fault or a gateway’s 4xx is "unknown", never "refused"', async () => {
    for (const err of [Object.assign(new Error('timeout'), { type: 'StripeConnectionError' }), stripeError(500, 'api_error'), stripeError(409, 'idempotency_key_in_use'), stripeError(408, 'timeout')]) {
      const store = fakeStore();
      const r = await makeRefund(fakeStripe({ error: err }).stripe, store, input());
      assert.equal(r.ok, false);
      assert.equal(store.records[0].status, 'unknown');
      assert.equal((r as { error: string }).error, REFUND_WORDS.noAnswer);
    }
  });

  it('a lost answer more than a day old is recovered by LISTING: zero refund requests', async () => {
    const old = new Date(NOW.getTime() - 26 * 3_600_000).toISOString();
    const store = fakeStore([{ id: 'rf-old', status: 'unknown', actor_email: 'b@x', created_at: old, amount_cents: 10000, currency: 'cad', reason: 'r', stripe_refund_id: null, charge: CHARGE.id } as RefundRecord & { charge: string }]);
    const s = fakeStripe({ listed: [{ id: 're_found', metadata: { platform_refund_id: 'rf-old' } }] });
    await recoverRefunds(s.stripe, store, { orgId: 'org-1', chargeId: CHARGE.id, now: NOW });
    assert.equal(s.posted.length, 0, 'recovery never sends a refund');
    assert.equal(s.listCalls(), 1);
    assert.equal(store.records[0].status, 'done');
    assert.equal(store.records[0].stripe_refund_id, 're_found');
  });

  it('an in-flight start keeps its hold; an abandoned one with no refund in Stripe is closed as not made (released)', async () => {
    const young = new Date(NOW.getTime() - 30_000).toISOString();
    const old = new Date(NOW.getTime() - RECOVERY_AFTER_MS - 1000).toISOString();
    const store = fakeStore([
      { id: 'rf-young', status: 'started', actor_email: 'b@x', created_at: young, amount_cents: 1, currency: 'cad', reason: 'r', stripe_refund_id: null, charge: 'ch_A' } as RefundRecord & { charge: string },
      { id: 'rf-old', status: 'started', actor_email: 'b@x', created_at: old, amount_cents: 1, currency: 'cad', reason: 'r', stripe_refund_id: null, charge: 'ch_B' } as RefundRecord & { charge: string },
    ]);
    const s = fakeStripe({ listed: [] });
    const held = await recoverRefunds(s.stripe, store, { orgId: 'org-1', chargeId: 'ch_A', now: NOW });
    assert.equal(held.length, 1);
    assert.equal(s.listCalls(), 0, 'nothing old enough on ch_A: Stripe is not even asked');
    await recoverRefunds(s.stripe, store, { orgId: 'org-1', chargeId: 'ch_B', now: NOW });
    assert.equal(store.records.find(r => r.id === 'rf-old')!.status, 'not_made');
    assert.equal(s.posted.length, 0);
  });

  it('two people opening the same charge recover its refund once, and write one entry', async () => {
    const old = new Date(NOW.getTime() - RECOVERY_AFTER_MS - 1000).toISOString();
    const store = fakeStore([{ id: 'rf-old', status: 'unknown', actor_email: 'b@x', created_at: old, amount_cents: 1, currency: 'cad', reason: 'r', stripe_refund_id: null, charge: CHARGE.id } as RefundRecord & { charge: string }]);
    const s = fakeStripe({ listed: [{ id: 're_found', metadata: { platform_refund_id: 'rf-old' } }] });
    // Both read the open record before either completes it.
    const stale = await store.openFor(CHARGE.id);
    store.openFor = async () => stale;
    await Promise.all([recoverRefunds(s.stripe, store, { orgId: 'org-1', chargeId: CHARGE.id, now: NOW }), recoverRefunds(s.stripe, store, { orgId: 'org-1', chargeId: CHARGE.id, now: NOW })]);
    assert.equal(store.captured.audits.filter(a => a.action === 'refund_charge_resolved').length, 1);
  });

  it('two starts for one charge: the database refuses the second (a partial unique index, not a read)', () => {
    const sql = readSource('supabase/migrations/380_support_console_money.sql');
    assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS platform_refunds_one_open_per_charge\s+ON public\.platform_refunds \(stripe_charge_id\) WHERE status IN \('started', 'unknown'\)/);
    assert.match(readCode('lib/console-money-store.ts'), /error\?\.code === '23505'\) throw new InFlightError\(\)/);
  });
});

// ── 2 · The server's rules ──────────────────────────────────────────────────────────────────────

const FACTS: RefundFacts = { role: 'billing', ownClub: false, demoClub: false, charge: CHARGE, refundsLast24h: 0, now: NOW };
const ASK = { amountCents: 10000, remainingSeenCents: 10000, reason: 'Charged twice' };
const why = (r: ReturnType<typeof decideRefund>) => (r.ok ? null : r.error);

describe('2 · every refusal the server makes before Stripe is asked', () => {
  it('the refund power is Super admin and Billing; the route checks it before it reads anything', () => {
    for (const role of ['super_admin', 'billing'] as const) assert.ok(hasPlatformPower(role, 'refund'));
    for (const role of ['support', 'product', 'growth', 'read_only'] as const) {
      assert.ok(!hasPlatformPower(role, 'refund'), role);
      assert.equal(why(decideRefund({ ...FACTS, role }, ASK)), REFUND_WORDS.readerRole);
    }
    const route = readCode('app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/refund/route.ts');
    const body = route.slice(route.indexOf('export const POST'));
    assert.ok(body.indexOf("requirePlatformPower('refund')") < body.indexOf('clubStripeFacts('), 'power before the first read');
    assert.ok(body.indexOf("requirePlatformPower('refund')") < body.indexOf('req.json('), 'power before the body');
  });

  it('your own club and a demo club are refused', () => {
    assert.equal(why(decideRefund({ ...FACTS, ownClub: true }, ASK)), REFUND_WORDS.ownClub);
    assert.equal(why(decideRefund({ ...FACTS, demoClub: true }, ASK)), REFUND_WORDS.demo);
  });

  it('"your own club" is the wide check: a member, an invite, a team coach, a portal the club pays for, the owner’s or customer’s email', () => {
    const code = readCode('lib/staff-own-club.ts');
    for (const needle of ["from('organization_members').select('organization_id').in('organization_id', ids).eq('user_id', staff.id)",
      ".ilike('invited_email', exactly(email))", "from('rep_team_staff_memberships')", "from('league_team_coaches')", "from('assistant_invite_tokens')",
      "from('team_workspaces')", ".in('billing_owner_org_id', ids)", 'primary_owner_user_id === staff.id', 'billing_owner_user_id === staff.id',
      ".eq('role', 'owner')", 'peopleByIds(left.map(', "stripeCustomerEmail?.trim().toLowerCase() === email", 'customers.list({ email,']) {
      assert.ok(code.includes(needle), needle);
    }
    // Free time adopts it; so does Bulk changes' billing status; the refund and the Money tab use it.
    assert.match(readCode('lib/free-time-writes.ts'), /staffBelongsToClub\(orgId, staff\)/);
    assert.doesNotMatch(readCode('lib/free-time-writes.ts'), /function staffBelongsTo\(/);
    assert.match(readCode('app/api/platform-admin/bulk-operations/route.ts'), /clubsStaffBelongsTo\(orgs\.map\(o => o\.id\),/);
    assert.match(readCode('app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/refund/route.ts'), /staffBelongsToClub\(id,/);
  });

  it('a charge is this club’s only when it is exactly this club’s customer, not shared, in this site’s mode — on every read', () => {
    const charge = { customer: 'cus_Qa7Rk2Lm9Vt3Xy', livemode: false };
    assert.equal(ownsObject(CLUB, charge, false), true);
    assert.equal(ownsObject({ customerId: null, customerShared: false }, { customer: null, livemode: false }, false), false, 'null customer on a club with none');
    assert.equal(ownsObject({ ...CLUB, customerShared: true }, charge, false), false, 'a customer two clubs share');
    assert.equal(ownsObject(CLUB, { ...charge, customer: 'cus_OTHER' }, false), false, 'another club’s charge');
    assert.equal(ownsObject(CLUB, charge, true), false, 'a test charge on a live key');
    assert.equal(ownsObject(CLUB, { ...charge, livemode: true }, false), false, 'a live charge on a test key');
    // The read paths: the charge window and the refund both read the charge through the ownership check.
    assert.match(readCode('lib/console-money-stripe.ts'), /if \(!ownsObject\(club, charge, live\)\) return null;/);
    for (const f of ['app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/route.ts', 'app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/refund/route.ts']) {
      assert.match(readCode(f), /readClubCharge\(stripe, chargeId, club,/, f);
      assert.match(readCode(f), /club\.customerShared/, f);
    }
  });

  it('a customer is "shared" only when another CLUB uses it; a coach’s own (person-paid) customer is not, and names its other portals', () => {
    const ME = '3150a614-8a71-48df-8740-5f4962795fad';
    const personPaid = (workspaceOrg: string) => ({ billing_owner_org_id: null, billing_owner_user_id: 'user-1', workspace_org_id: workspaceOrg });
    // The walk case: a coach bought Premium as a person; the one workspace on the customer is this record's own.
    assert.deepEqual(customerSharing(ME, 1, [personPaid(ME)]), { shared: false, coversOtherPortals: false });
    // The same coach's customer also pays for another portal: read it, and say so.
    assert.deepEqual(customerSharing(ME, 1, [personPaid(ME), personPaid('other-portal')]), { shared: false, coversOtherPortals: true });
    // A portal this club pays for is the club's own.
    assert.equal(customerSharing(ME, 1, [{ billing_owner_org_id: ME, billing_owner_user_id: null, workspace_org_id: 'p' }]).shared, false);
    // Another club on the customer, a second org row, or a workspace with no payer at all stays shared.
    assert.equal(customerSharing(ME, 1, [{ billing_owner_org_id: 'other-club', billing_owner_user_id: null, workspace_org_id: 'p' }]).shared, true);
    assert.equal(customerSharing(ME, 2, []).shared, true);
    assert.equal(customerSharing(ME, 1, [{ billing_owner_org_id: null, billing_owner_user_id: null, workspace_org_id: ME }]).shared, true);
  });

  it('amounts: whole cents above zero, never above Stripe’s remainder; "all" with a changed remainder is refused', () => {
    for (const bad of [20.1, '20.10', '', 0, -5, null, 2 ** 53]) {
      assert.equal(why(decideRefund(FACTS, { ...ASK, amountCents: bad })), REFUND_WORDS.amount, String(bad));
    }
    assert.match(why(decideRefund(FACTS, { ...ASK, amountCents: 10001 }))!, /^Only \$100\.00 of this charge can still be refunded\./);
    const partly = { ...CHARGE, refundedCents: 2000 };
    assert.match(why(decideRefund({ ...FACTS, charge: partly }, { ...ASK, amountCents: 8000, remainingSeenCents: 10000 }))!, /it changed since you opened it/);
    assert.equal(why(decideRefund({ ...FACTS, charge: { ...CHARGE, refundedCents: 10000 } }, ASK)), REFUND_WORDS.fullyRefunded);
    assert.equal(why(decideRefund({ ...FACTS, charge: { ...CHARGE, disputed: true } }, ASK)), REFUND_WORDS.disputed);
    assert.equal(why(decideRefund({ ...FACTS, charge: { ...CHARGE, status: 'failed' } }, ASK)), REFUND_WORDS.notPaid);
    assert.equal(centsFromTyped('20.1'), 2010);
    assert.equal(centsFromTyped('20.105'), null);
    assert.equal(centsFromTyped('-5'), null);
  });

  it('Billing: a charge older than 6 months (Stripe’s date) and a sixth refund in 24 hours need a Super admin', () => {
    const march = { ...CHARGE, createdAt: '2026-03-15T14:00:00.000Z' };
    assert.match(why(decideRefund({ ...FACTS, charge: march }, ASK))!, /^This charge is from March 2026, more than 6 months ago\. A Super admin can refund it\.$/);
    assert.equal(decideRefund({ ...FACTS, role: 'super_admin', charge: march }, ASK).ok, true);
    assert.match(why(decideRefund({ ...FACTS, refundsLast24h: 5 }, ASK))!, /^You have made 5 refunds in the last 24 hours\. A Super admin can make this one\.$/);
    assert.equal(decideRefund({ ...FACTS, refundsLast24h: 4 }, ASK).ok, true);
    assert.equal(decideRefund({ ...FACTS, role: 'super_admin', refundsLast24h: 40 }, ASK).ok, true);
  });

  it('the reason: required, under 500, and never a card number (Luhn)', () => {
    assert.equal(why(decideRefund(FACTS, { ...ASK, reason: '   ' })), REFUND_WORDS.reasonBlank);
    assert.equal(why(decideRefund(FACTS, { ...ASK, reason: 'x'.repeat(501) })), REFUND_WORDS.reasonLong);
    assert.equal(why(decideRefund(FACTS, { ...ASK, reason: 'Card 4242 4242 4242 4242 was charged twice' })), REFUND_WORDS.reasonCard);
    assert.equal(holdsCardNumber('Card 4242-4242-4242-4242'), true);
    assert.equal(holdsCardNumber('Owner phone 416 555 1234, order 2026-10-01'), false);
    assert.equal(decideRefund(FACTS, { ...ASK, reason: 'Visa ending 4242 charged twice' }).ok, true);
  });
});

// ── 3 · The order ───────────────────────────────────────────────────────────────────────────────

describe('3 · our record first, or Stripe is never asked; the audit entry either way', () => {
  it('the first write fails → Stripe never called, and the person is told no money moved', async () => {
    const s = fakeStripe();
    const r = await makeRefund(s.stripe, fakeStore([], { insertFails: true }), input());
    assert.equal(s.posted.length, 0);
    assert.equal((r as { error: string }).error, REFUND_WORDS.recordFailed);
  });
  it('the audit entry exists whether Stripe accepts or refuses, its reason in the column', async () => {
    const ok = fakeStore();
    await makeRefund(fakeStripe().stripe, ok, input());
    assert.deepEqual(ok.captured.audits.map(a => [a.action, a.reason]), [['refund_charge', 'Charged twice on the Oct 1 renewal']]);
    const no = fakeStore();
    await makeRefund(fakeStripe({ error: stripeError(400, 'charge_disputed') }).stripe, no, input());
    assert.deepEqual(no.captured.audits.map(a => a.action), ['refund_charge_refused']);
    assert.match(readCode('lib/console-money-store.ts'), /writePlatformAuditLogStrict\(/);
  });
  it('"all of it" is always sent as an explicit amount, and Stripe’s reason is never fraudulent', async () => {
    const s = fakeStripe();
    await makeRefund(s.stripe, fakeStore(), input());
    assert.equal(s.posted[0].params.amount, 10000);
    assert.equal(s.posted[0].params.reason, 'duplicate');
    const t = fakeStripe();
    await makeRefund(t.stripe, fakeStore(), input({ flaggedDuplicate: false }));
    assert.equal(t.posted[0].params.reason, 'requested_by_customer');
    assert.doesNotMatch(readCode('lib/console-money-stripe.ts'), /'fraudulent'/);
  });
});

// ── 4 · Words that leave us ─────────────────────────────────────────────────────────────────────

describe('4 · Stripe gets our number, the club and the staff member; nobody gets Stripe’s own error text', () => {
  it('the refund’s metadata holds no free text', async () => {
    const s = fakeStripe();
    await makeRefund(s.stripe, fakeStore(), input());
    assert.deepEqual(Object.keys(s.posted[0].params.metadata as object).sort(), ['org_id', 'platform_refund_id', 'staff_email']);
    assert.ok(!JSON.stringify(s.posted[0].params).includes('Charged twice'));
  });
  it('an error naming rk_live_ or acct_ never reaches the answer or our records', async () => {
    const store = fakeStore();
    const r = await makeRefund(fakeStripe({ error: stripeError(400, 'charge_not_refundable') }).stripe, store, input());
    const everything = JSON.stringify([r, store.captured, store.records]);
    assert.doesNotMatch(everything, /rk_live_|acct_|No such charge/);
    assert.deepEqual(stripeErrorFacts(stripeError(400, 'charge_disputed')), { code: 'charge_disputed', requestId: 'req_AbC123', definite: true });
    assert.equal(stripeErrorFacts({ code: 'Bad Code!', requestId: 'x' }).code, null);
  });
});

// ── 5 · No card data kept ───────────────────────────────────────────────────────────────────────

describe('5 · nothing we write carries a card number, expiry, holder name, billing details or fingerprint', () => {
  const CARD = /last4|exp_?month|exp_?year|expMonth|expYear|fingerprint|billing_details|cardholder|holder|"brand"|4242/i;
  it('the refund record, its completion and its audit entry', async () => {
    const store = fakeStore();
    await makeRefund(fakeStripe().stripe, store, input());
    assert.doesNotMatch(JSON.stringify(store.captured), CARD);
  });
  it('the Story’s console refund says "to the card it came from", never the card', () => {
    const story = readCode('lib/platform-story.ts');
    // GST/HST Part 6b: the sub names the credit note (or says there is none), still never the card.
    assert.match(story, /sub: `To the card it came from · \$\{f\.stripe_credit_note_number \? `credit note \$\{f\.stripe_credit_note_number\}` : 'no credit note'\} · the plan did not change`/);
    const select = /from\('platform_refunds'\)\.select\('([^']*)'\)/.exec(story)?.[1] ?? '';
    assert.doesNotMatch(select, /card|last4|exp/);
    assert.doesNotMatch(readSource('supabase/migrations/380_support_console_money.sql').replace(/--.*$/gm, '').replace(/COMMENT ON[\s\S]*?;/g, ''), /last4|exp_month|fingerprint|card_/);
  });
});

// ── 6b · A refund of an invoice charge is a CREDIT NOTE (GST/HST Stage 2 Part 6b; owner R1–R3 2026-11-05) ──────────────
// Against a fake Stripe that taxes each credit-note line at one rate, rounding per line, as Stripe did in Part 0
// (.probe/gst2/part6b-credit-notes-run1.txt: ON 13% 10000 → 10001 / 9999; NB 15% 10000 exact).

const TARGET_ON: CreditTarget = {
  invoiceId: 'in_1PlanOn', currency: 'cad', total: 247470, linesNetCents: 219000, creditedCents: 0, creditedBeforeTaxCents: 0,
  lines: [{ id: 'il_plan', amount: 219000, creditedCents: 0 }], isFeeInvoice: false,
};
const TARGET_NB: CreditTarget = { ...TARGET_ON, invoiceId: 'in_1PlanNb', total: 251850 };
const INVOICE_CHARGE: MoneyCharge = { ...CHARGE, amountCents: 247470, invoice: { id: 'in_1PlanOn', number: 'ABC-0001', billingReason: 'subscription_cycle',
  subscriptionId: 'sub_1', periodStart: null, periodEnd: null, planId: 'club', cycle: 'annual', fromPlanId: null, description: null, taxCents: 28470 } };

type NotePosted = { params: Stripe.CreditNoteCreateParams; options: Stripe.RequestOptions };
function fakeCreditStripe(opts: { rate?: number; discount?: number | Record<string, number>; charged?: number; error?: unknown; refundStatus?: string; listedNotes?: Array<Record<string, unknown>> } = {}) {
  const rate = opts.rate ?? 0.13;
  // A line's discount (a fraction) comes off INSIDE the note, as Stripe does: a note line's amount is before it (Part 4, J).
  // One number = every line (a subscription or invoice coupon); by line id = a LINE-level coupon (Part 4's J3).
  const off = (line?: string) => (typeof opts.discount === 'number' ? opts.discount : opts.discount?.[line ?? ''] ?? 0);
  const net = (amount: number, line?: string) => amount - Math.round(amount * off(line));
  const created: NotePosted[] = [];
  const previews: Stripe.CreditNotePreviewParams[] = [];
  const refundPosts: unknown[] = [];
  let noteLists = 0;
  let refundLists = 0;
  const byKey = new Map<string, Record<string, unknown>>();
  const shape = (lines: Stripe.CreditNotePreviewParams['lines']) => {
    const before = (lines ?? []).reduce((sum, l) => sum + net(l.amount ?? 0, l.invoice_line_item), 0);
    const tax = (lines ?? []).reduce((sum, l) => sum + Math.round(net(l.amount ?? 0, l.invoice_line_item) * rate), 0);
    return { total: before + tax, post_payment_amount: before + tax, total_excluding_tax: before, subtotal: before,
      total_taxes: [{ amount: tax, tax_behavior: 'exclusive', tax_rate_details: { tax_rate: 'txr_hst' }, taxability_reason: 'standard_rated', taxable_amount: before, type: 'tax_rate_details' }] };
  };
  const stripe = {
    charges: { async retrieve() { return { amount: opts.charged ?? INVOICE_CHARGE.amountCents, amount_refunded: 0 }; } },
    creditNotes: {
      async preview(params: Stripe.CreditNotePreviewParams) { previews.push(params); return shape(params.lines); },
      async create(params: Stripe.CreditNoteCreateParams, options: Stripe.RequestOptions) {
        created.push({ params, options });
        if (opts.error) throw opts.error;
        const key = options.idempotencyKey!;
        if (!byKey.has(key)) byKey.set(key, { id: `cn_${byKey.size + 1}`, number: `MBEEZ5VW-0001-CN-0${byKey.size + 1}`, ...shape(params.lines), refunds: [{ refund: `re_cn${byKey.size + 1}`, amount_refunded: params.refund_amount, type: 'refund' }] });
        return byKey.get(key)!;
      },
      async list() { noteLists++; return { data: opts.listedNotes ?? [], has_more: false }; },
    },
    refunds: {
      async create(params: unknown) { refundPosts.push(params); return { id: 're_bare', status: 'succeeded' }; },
      async retrieve() { return { status: opts.refundStatus ?? 'succeeded' }; },
      async list() { refundLists++; return { data: [], has_more: false }; },
    },
  } as unknown as Stripe;
  return { stripe, created, previews, refundPosts, noteLists: () => noteLists, refundLists: () => refundLists };
}
const noteInput = (over: Partial<RefundInput> = {}): RefundInput => input({
  charge: INVOICE_CHARGE, invoice: TARGET_ON, flaggedDuplicate: false,
  ask: { amountCents: 247470, beforeTaxCents: 219000, remainingSeenCents: 247470, reason: 'The club closed; refund the renewal' }, ...over,
});

describe('6b · a refund of a charge that paid an invoice is a credit note', () => {
  it('the whole charge: ONE credit note, keyed by our record, the line by its before-tax amount; refunds.create is never called', async () => {
    const store = fakeStore();
    const s = fakeCreditStripe();
    const r = await makeRefund(s.stripe, store, noteInput());
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(s.refundPosts.length, 0, 'an invoice charge never reaches refunds.create');
    assert.equal(s.created.length, 1);
    const { params, options } = s.created[0];
    assert.equal(options.idempotencyKey, store.records[0].id, 'the key is our record’s id');
    assert.equal(params.invoice, 'in_1PlanOn');
    assert.deepEqual(params.lines, [{ type: 'invoice_line_item', invoice_line_item: 'il_plan', amount: 219000 }]);
    assert.equal(params.refund_amount, 247470, 'refund_amount is exactly the previewed total');
    assert.equal(params.email_type, 'credit_note', 'R2: Stripe emails the credit note');
    assert.ok(!('amount' in params), 'never a top-level amount: it reverses no tax');
    assert.ok(!params.lines!.some(l => 'quantity' in l), 'never quantity: Stripe refuses it on a proration line');
    assert.ok(!('memo' in params) && !('reason' in params), 'no memo, no reason: the typed reason never reaches the document');
    assert.deepEqual(Object.keys(params.metadata as object).sort(), ['org_id', 'platform_refund_id', 'staff_email']);
    assert.ok(!JSON.stringify(params).includes('The club closed'));
    assert.equal(store.captured.inserts[0].stripe_invoice_id, 'in_1PlanOn', 'the invoice is written with the request');
    assert.deepEqual(store.captured.completes[0].patch, { status: 'done', stripe_refund_id: 're_cn1', stripe_credit_note_id: 'cn_1', stripe_credit_note_number: 'MBEEZ5VW-0001-CN-01' });
    assert.match((r as { message: string }).message, /^Refunded \$2,474\.70 to the Visa ending 4242 with credit note MBEEZ5VW-0001-CN-01\. Stripe says it is on its way\./);
    assert.ok(store.captured.audits.some(a => a.action === 'refund_charge' && (a.value as Record<string, unknown>).stripe_credit_note_id === 'cn_1'));
  });

  it('R1: a part refund is the nearest total NOT above the figure typed (ON 13%: $100.00 → $99.99; NB 15%: exact)', async () => {
    const on = await planCreditNote(fakeCreditStripe().stripe, TARGET_ON, 10000);
    assert.ok(on.ok);
    assert.deepEqual([on.cardCents, on.beforeTaxCents], [9999, 8849], 'b 8850 makes $100.01, so one cent less before tax');
    const nb = await planCreditNote(fakeCreditStripe({ rate: 0.15 }).stripe, TARGET_NB, 10000);
    assert.ok(nb.ok);
    assert.deepEqual([nb.cardCents, nb.beforeTaxCents], [10000, 8696]);
    // A figure just above a reachable one walks up to it, never past.
    const up = await planCreditNote(fakeCreditStripe().stripe, TARGET_ON, 10002);
    assert.ok(up.ok);
    assert.ok(up.cardCents <= 10002 && up.cardCents >= 10001);
    // Walking UP: the first estimate lands a cent below and the next cent jumps past (b 88 → $0.99, b 89 → $1.01).
    const below = await planCreditNote(fakeCreditStripe().stripe, TARGET_ON, 100);
    assert.ok(below.ok);
    assert.deepEqual([below.cardCents, below.beforeTaxCents], [99, 88]);
    for (const typed of [1, 4, 13, 22, 48, 100, 3333, 12345, 247469]) {
      const p = await planCreditNote(fakeCreditStripe().stripe, TARGET_ON, typed);
      assert.ok(p.ok && p.cardCents <= typed && p.cardCents >= typed - 1, `${typed} → ${p.ok ? p.cardCents : p.error}`);
    }
  });

  it('a preview that moved since the window is a new record and a new look, never a re-send', async () => {
    for (const ask of [
      { amountCents: 10000, beforeTaxCents: 8850, remainingSeenCents: 247470, reason: 'Part' }, // a figure Stripe cannot make
      { amountCents: 9999, beforeTaxCents: 8850, remainingSeenCents: 247470, reason: 'Part' },  // the split moved
    ]) {
      const store = fakeStore();
      const s = fakeCreditStripe();
      const r = await makeRefund(s.stripe, store, noteInput({ ask }));
      assert.equal(r.ok, false);
      assert.equal((r as { error: string }).error, REFUND_WORDS.noteChanged);
      assert.equal(s.created.length + s.refundPosts.length, 0, 'nothing sent');
      assert.equal(store.records[0].status, 'not_made', 'the record is closed, so the next try is a new record and a new key');
    }
    const none = fakeStore();
    const t = fakeCreditStripe();
    const r = await makeRefund(t.stripe, none, noteInput({ ask: { amountCents: 247470, remainingSeenCents: 247470, reason: 'No split sent' } }));
    assert.equal((r as { error: string }).error, REFUND_WORDS.noteChanged);
    assert.equal(none.captured.inserts.length, 0, 'without the before-tax figure nothing is written');
  });

  it('a credit note whose refund failed still stands, and is said so', async () => {
    const r = await makeRefund(fakeCreditStripe({ refundStatus: 'failed' }).stripe, fakeStore(), noteInput());
    assert.ok(r.ok);
    assert.match((r as { message: string }).message, /did not reach the card\. The credit note stands\./);
  });

  it('Stripe’s no on the note leaves a refused record; a lost answer is unknown — as a bare refund', async () => {
    const no = fakeStore();
    await makeRefund(fakeCreditStripe({ error: stripeError(400, 'invalid_request_error') }).stripe, no, noteInput());
    assert.equal(no.records[0].status, 'refused');
    const lost = fakeStore();
    await makeRefund(fakeCreditStripe({ error: Object.assign(new Error('timeout'), { type: 'StripeConnectionError' }) }).stripe, lost, noteInput());
    assert.equal(lost.records[0].status, 'unknown');
  });

  it('the lines: positive lines only, the largest first, spilling past its room; the pool is the net of the lines', () => {
    // A proration invoice: the positive line (21,900) is larger than what was paid (19,000 net of the unused-time line).
    const proration: CreditTarget = { ...TARGET_ON, total: 21470, linesNetCents: 19000, lines: [{ id: 'il_new', amount: 21900, creditedCents: 0 }] };
    assert.equal(creditRoom(proration).pool, 19000);
    assert.deepEqual(creditLines(creditRoom(proration).order, 19000), [{ type: 'invoice_line_item', invoice_line_item: 'il_new', amount: 19000 }]);
    // Plan + a recovered fee: the plan line takes a part refund first; past its room, the fee line.
    const both: CreditTarget = { ...TARGET_ON, total: 249165, linesNetCents: 220500, lines: [{ id: 'il_fee', amount: 1500, creditedCents: 0 }, { id: 'il_plan', amount: 219000, creditedCents: 0 }] };
    const { order } = creditRoom(both);
    assert.deepEqual(creditLines(order, 8850).map(l => [l.invoice_line_item, l.amount]), [['il_plan', 8850]]);
    assert.deepEqual(creditLines(order, 219500).map(l => [l.invoice_line_item, l.amount]), [['il_plan', 219000], ['il_fee', 500]]);
    // Earlier notes: a line's room is its amount less what they took.
    const after = { ...both, creditedBeforeTaxCents: 8850, lines: [{ id: 'il_fee', amount: 1500, creditedCents: 0 }, { id: 'il_plan', amount: 219000, creditedCents: 8850 }] };
    assert.equal(creditRoom(after).pool, 211650);
    // Nothing left: refused, nothing previewed.
    assert.equal(creditRoom({ ...both, creditedBeforeTaxCents: 220500 }).pool, 0);
  });

  it('all that is left credits every line its room, exactly (Stripe’s last note takes the remaining tax)', async () => {
    const both: CreditTarget = { ...TARGET_ON, total: 249165, linesNetCents: 220500, lines: [{ id: 'il_fee', amount: 1500, creditedCents: 0 }, { id: 'il_plan', amount: 219000, creditedCents: 0 }] };
    const s = fakeCreditStripe();
    const p = await planCreditNote(s.stripe, both, 249165);
    assert.ok(p.ok);
    assert.equal(s.previews.length, 1, 'one preview');
    assert.deepEqual(p.lines.map(l => l.amount), [219000, 1500]);
    assert.equal(p.cardCents, 249165);
    assert.equal(p.capped, false);
  });

  it('a DISCOUNTED invoice: the pool is in line units, so all of it is exact and a part lands on the nearest (Part 4, J)', async () => {
    // 25% off a 219000 line at ON 13%: 164250 before tax + 21353 = 185603 paid. The note's line is 219000 (before the discount).
    const discounted: CreditTarget = { ...TARGET_ON, total: 185603, linesNetCents: 219000 };
    assert.equal(creditRoom(discounted).pool, 219000);
    const all = await planCreditNote(fakeCreditStripe({ discount: 0.25 }).stripe, discounted, 185603);
    assert.ok(all.ok);
    assert.deepEqual([all.cardCents, all.lines.map(l => l.amount), all.capped], [185603, [219000], false]);
    const s = fakeCreditStripe({ discount: 0.25 });
    const part = await planCreditNote(s.stripe, discounted, 10000);
    assert.ok(part.ok);
    // 11799 → 8849 + 1150 = 9999; 11800 → 8850 + 1151 = 10001 (above). The nearest NOT above, in ≤ 3 previews.
    assert.deepEqual([part.cardCents, part.beforeTaxCents, part.capped], [9999, 8849, false]);
    assert.ok(s.previews.length <= 3, `${s.previews.length} previews`);
  });

  // ── Q1 (owner 2026-11-06): step by the gap. The planner must land on the LARGEST line amount whose total is not above the
  // figure (the nearest, R1), within MAX_PREVIEWS, and planning again on the figure it returned must return the same split.
  const nearestByHand = async (target: CreditTarget, discount: number | Record<string, number>, typed: number, rate = 0.13) => {
    // Brute force against the same fake: the largest before-tax amount whose total is not above the figure.
    const { order, pool } = creditRoom(target);
    const { stripe } = fakeCreditStripe({ discount, rate });
    let lo = 0, hi = pool;
    while (lo < hi) {
      const m = Math.ceil((lo + hi) / 2);
      if ((await stripe.creditNotes.preview({ invoice: target.invoiceId, lines: creditLines(order, m) })).total <= typed) lo = m; else hi = m - 1;
    }
    return lo;
  };
  const sumOf = (p: { lines: Array<{ amount: number }> }) => p.lines.reduce((t, l) => t + l.amount, 0);
  // Part 4's J3: a 10% coupon on the PLAN line only, beside an undiscounted recovered fee (the invoice's average ratio is wrong
  // for the line being credited, so the old one-unit walk ran out at $99.97 and the confirm refused every time).
  const LINE_COUPON: CreditTarget = { ...TARGET_ON, total: 224418, linesNetCents: 220500,
    lines: [{ id: 'il_fee', amount: 1500, creditedCents: 0 }, { id: 'il_plan', amount: 219000, creditedCents: 0 }] };
  const LINE_OFF = { il_plan: 0.10 };
  const DEEP: CreditTarget = { ...TARGET_ON, total: 61868, linesNetCents: 219000 }; // 75% off: 54750 + 7118
  // A 75% coupon on the LARGER line of two, the full-price line spilled onto after it (the ratio changes at the spill point).
  const SPILL: CreditTarget = { ...TARGET_ON, total: 48025, linesNetCents: 80000,
    lines: [{ id: 'il_plan', amount: 50000, creditedCents: 0 }, { id: 'il_fee', amount: 30000, creditedCents: 0 }] };
  const SPILL_OFF = { il_plan: 0.75 };

  it('Q1: a LINE-level coupon on a two-line invoice lands on the nearest, within the preview budget (J3: $100.00)', async () => {
    for (const typed of [10000, 200000, 3333, 99, 150001]) {
      const s = fakeCreditStripe({ discount: LINE_OFF });
      const p = await planCreditNote(s.stripe, LINE_COUPON, typed);
      assert.ok(p.ok, `${typed}: ${p.ok ? '' : p.error}`);
      assert.ok(p.cardCents <= typed, 'never above what was typed (R1)');
      assert.equal(sumOf(p), await nearestByHand(LINE_COUPON, LINE_OFF, typed), `${typed}: the nearest, not a figure short of it`);
      assert.ok(s.previews.length <= MAX_PREVIEWS, `${typed}: ${s.previews.length} previews`);
    }
    const j3 = await planCreditNote(fakeCreditStripe({ discount: LINE_OFF }).stripe, LINE_COUPON, 10000);
    assert.ok(j3.ok && j3.cardCents >= 9999, 'J3 reaches a cent of $100.00, not $99.97');
  });

  it('Q1: a 75%-off line (a unit worth a quarter of a cent) and a coupon on the larger of two lines land on the nearest', async () => {
    for (const [target, discount] of [[DEEP, 0.75], [SPILL, SPILL_OFF]] as const) {
      for (const typed of [10000, 1, 4, 777, 14125, 16905, 20795, 47000]) {
        const s = fakeCreditStripe({ discount });
        const p = await planCreditNote(s.stripe, target, typed);
        const want = await nearestByHand(target, discount, typed);
        if (want === 0) { assert.equal(p.ok, false, `${typed}: nothing fits`); continue; }
        assert.ok(p.ok, `${typed}: ${p.ok ? '' : p.error}`);
        assert.ok(p.cardCents <= typed);
        assert.equal(sumOf(p), want, `${target.invoiceId}/${typed}: the largest amount that fits`);
        assert.ok(s.previews.length <= MAX_PREVIEWS, `${typed}: ${s.previews.length} previews`);
      }
    }
  });

  it('Q1: a sweep of 60 figures across each invoice (incl. 90% off at NB 15%): every one the nearest, none past the budget', async () => {
    const NINETY: CreditTarget = { ...TARGET_NB, total: 25185, linesNetCents: 219000 };
    for (const [target, discount, rate] of [[LINE_COUPON, LINE_OFF, 0.13], [DEEP, 0.75, 0.13], [SPILL, SPILL_OFF, 0.13], [NINETY, 0.9, 0.15]] as const) {
      const misses: string[] = [];
      for (let k = 1; k <= 60; k++) {
        const typed = Math.max(1, Math.floor(target.total * k / 61) + (k % 7));
        const s = fakeCreditStripe({ discount, rate });
        const p = await planCreditNote(s.stripe, target, typed);
        const want = await nearestByHand(target, discount, typed, rate);
        if (!p.ok || sumOf(p) !== want || p.cardCents > typed || s.previews.length > MAX_PREVIEWS) misses.push(`${typed}→${p.ok ? sumOf(p) : 'refused'} (want ${want}, ${s.previews.length} previews)`);
      }
      assert.deepEqual(misses, [], `${target.invoiceId} ${JSON.stringify(discount)}`);
    }
  });

  it('Q1: invoices pinned from the Part 7 random sweep (three lines; a 90%-off line beside a full-price one) land on the nearest', async () => {
    // Each failed without one rule (.probe/gst2/part7-q1-find.mjs): the first three without the spill point, the last two without halving.
    const cases: Array<{ rate: number; lines: Array<[string, number, number]>; typed: number[] }> = [
      { rate: 0.13, lines: [['l0', 52317, 0], ['l1', 95861, 0.1], ['l2', 151849, 0.9]], typed: [39151, 19300, 23095] },
      { rate: 0.15, lines: [['l0', 200218, 0.9], ['l1', 227758, 0]], typed: [264263] },
      { rate: 0.05, lines: [['l0', 240230, 0.9], ['l1', 86837, 0]], typed: [21346] },
    ];
    for (const c of cases) {
      const discount = Object.fromEntries(c.lines.map(([id, , d]) => [id, d]));
      const base: CreditTarget = { ...TARGET_ON, total: 0, linesNetCents: c.lines.reduce((t, [, a]) => t + a, 0),
        lines: c.lines.map(([id, amount]) => ({ id, amount, creditedCents: 0 })) };
      const { order, pool } = creditRoom(base);
      const target = { ...base, total: (await fakeCreditStripe({ discount, rate: c.rate }).stripe.creditNotes.preview({ invoice: 'x', lines: creditLines(order, pool) })).total };
      for (const typed of c.typed) {
        const p = await planCreditNote(fakeCreditStripe({ discount, rate: c.rate }).stripe, target, typed);
        assert.ok(p.ok, `${typed}: ${p.ok ? '' : p.error}`);
        assert.equal(sumOf(p), await nearestByHand(target, discount, typed, c.rate), `${typed}`);
        const again = await planCreditNote(fakeCreditStripe({ discount, rate: c.rate }).stripe, target, p.cardCents);
        assert.ok(again.ok);
        assert.deepEqual(again.lines, p.lines, `${typed}: the re-plan keeps the split`);
      }
    }
  });

  it('Q1: planning again on the figure it returned returns the SAME split (the refund re-plans on it; a split that moves is the 409 loop)', async () => {
    for (const [target, discount] of [[LINE_COUPON, LINE_OFF], [DEEP, 0.75], [SPILL, SPILL_OFF], [TARGET_ON, 0]] as const) {
      for (const typed of [10000, 2000, 33333, 4321]) {
        const first = await planCreditNote(fakeCreditStripe({ discount }).stripe, target, typed);
        if (!first.ok) continue;
        const again = await planCreditNote(fakeCreditStripe({ discount }).stripe, target, first.cardCents);
        assert.ok(again.ok);
        assert.deepEqual([again.lines, again.beforeTaxCents, again.cardCents], [first.lines, first.beforeTaxCents, first.cardCents], `${target.invoiceId}/${typed}`);
      }
    }
    // End to end: the confirm, sent the figures the window previewed on J3's invoice, makes the note (no "changed since").
    const look = await planCreditNote(fakeCreditStripe({ discount: LINE_OFF }).stripe, LINE_COUPON, 10000);
    assert.ok(look.ok);
    const s = fakeCreditStripe({ discount: LINE_OFF, charged: 224418 });
    const charge = { ...INVOICE_CHARGE, amountCents: 224418 };
    const r = await makeRefund(s.stripe, fakeStore(), noteInput({ charge, invoice: LINE_COUPON,
      ask: { amountCents: look.cardCents, beforeTaxCents: look.beforeTaxCents, remainingSeenCents: 224418, reason: 'Part of the renewal' } }));
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal(s.created[0].params.refund_amount, look.cardCents);
    assert.deepEqual(s.created[0].params.lines, look.lines);
  });

  it('Q1: all that is left is still ONE exact preview; a figure the budget cannot prove is REFUSED, never stated', async () => {
    const s = fakeCreditStripe({ discount: LINE_OFF });
    const all = await planCreditNote(s.stripe, LINE_COUPON, 224418);
    assert.ok(all.ok);
    assert.deepEqual([all.cardCents, sumOf(all), s.previews.length, all.capped], [224418, 220500, 1, false]);
    // 99.99% off: a cent of total is ten thousand line units, so no budget can find the edge. Refused, with nothing above typed.
    const t = fakeCreditStripe({ discount: 0.9999, rate: 0 });
    const no = await planCreditNote(t.stripe, { ...TARGET_ON, total: 22, linesNetCents: 219000 }, 10);
    assert.equal(no.ok, false);
    assert.equal((no as { error: string }).error, REFUND_WORDS.noteNotWorkedOut);
    assert.equal(t.previews.length, MAX_PREVIEWS, 'the budget is a ceiling');
  });

  it('recovery finds the credit note by ITS metadata (the refund a note makes carries none), never sends anything', async () => {
    const old = new Date(NOW.getTime() - RECOVERY_AFTER_MS - 1000).toISOString();
    const rec = (id: string) => ({ id, status: 'unknown', actor_email: 'b@x', created_at: old, amount_cents: 247470, currency: 'cad', reason: 'r', stripe_refund_id: null, stripe_invoice_id: 'in_1PlanOn', charge: INVOICE_CHARGE.id }) as RefundRecord & { charge: string };
    const store = fakeStore([rec('rf-old')]);
    const s = fakeCreditStripe({ listedNotes: [{ id: 'cn_9', number: 'MBEEZ5VW-0001-CN-09', metadata: { platform_refund_id: 'rf-old' }, refunds: [{ refund: 're_9', amount_refunded: 247470 }] }] });
    await recoverRefunds(s.stripe, store, { orgId: 'org-1', chargeId: INVOICE_CHARGE.id, now: NOW });
    assert.equal(s.noteLists(), 1);
    assert.equal(s.refundLists(), 0, 'an invoice record is found by its note, not the charge’s refunds');
    assert.equal(s.created.length + s.refundPosts.length, 0);
    assert.deepEqual(store.captured.completes[0].patch, { status: 'done', stripe_refund_id: 're_9', stripe_credit_note_id: 'cn_9', stripe_credit_note_number: 'MBEEZ5VW-0001-CN-09' });
    // No note with our id: not made (the charge is released).
    const none = fakeStore([rec('rf-gone')]);
    await recoverRefunds(fakeCreditStripe({ listedNotes: [{ id: 'cn_x', number: 'X', metadata: { platform_refund_id: 'someone-else' }, refunds: [] }] }).stripe, none, { orgId: 'org-1', chargeId: INVOICE_CHARGE.id, now: NOW });
    assert.equal(none.records[0].status, 'not_made');
  });

  it('R3: a charge that paid no invoice keeps today’s bare refund, and asks Stripe for no credit note', async () => {
    const s = fakeCreditStripe({ charged: CHARGE.amountCents });
    const r = await makeRefund(s.stripe, fakeStore(), input({ invoice: null }));
    assert.ok(r.ok);
    assert.equal(s.refundPosts.length, 1);
    assert.equal(s.created.length + s.previews.length, 0);
    assert.equal((r as { stripeCreditNoteId: string | null }).stripeCreditNoteId, null);
  });
});

// ── 6 · Reads ───────────────────────────────────────────────────────────────────────────────────

describe('6 · Stripe is read only for its readers, never stored, and its outage is one line', () => {
  it('the Money read and the charge read check the Stripe-reading power before any Stripe call', () => {
    for (const f of ['app/api/platform-admin/orgs/[id]/money/route.ts', 'app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/route.ts']) {
      const code = readCode(f);
      assert.ok(code.indexOf("requirePlatformPower('find_stripe')") > 0 && code.indexOf("requirePlatformPower('find_stripe')") < code.indexOf('getStripe()'), f);
      assert.doesNotMatch(code, /\.insert\(|\.upsert\(/, `${f} stores nothing Stripe returns`);
    }
    const tab = readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx');
    assert.match(tab, /const moneyWanted = props\.money\.readsStripe && /, 'a role without the power never asks');
    assert.match(tab, /useClubMoney\(org\.id, moneyWanted\)/);
    assert.match(readCode('app/platform-admin/orgs/[id]/page.tsx'), /const readsStripe = hasPlatformPower\(auth\.role, 'find_stripe'\);/);
  });
  it('a refund’s reason and details in the audit log and its export are for the Stripe-reading roles only (A2)', () => {
    for (const f of ['app/platform-admin/audit/page.tsx', 'app/api/platform-admin/audit/export/route.ts']) {
      const code = readCode(f);
      assert.match(code, /const readsMoney = hasPlatformPower\(auth\.role, 'find_stripe'\)/, f);
      // Stage 7 Part 0 folded the refund rule and the lead rule into one filter; its behaviour is pinned there.
      assert.match(code, /hiddenEntryLine\(\w+\.action, \{ money: readsMoney, leads: readsLeads \}\)/, f);
      assert.match(code, /hidden \? \{ \.\.\.\w+, reason: hidden, oldValue: null, newValue: null \}/, f);
    }
  });

  it('Stripe down renders our record and one line, not an error page', () => {
    assert.match(readCode('app/api/platform-admin/orgs/[id]/money/route.ts'), /state: 'unreachable'/);
    // GST/HST Stage 3 Part 2 (Ask 2 = A): the line now says what IS here (the sales, from our record), then what waits.
    assert.match(readCode('app/platform-admin/orgs/[id]/MoneyTab.tsx'), /SALES_WORDS\.unreachable\(consoleClock\(m\.readAt\)\)/);
  });
  it('our record beside Stripe’s: free time is ours only, and a club on free time never reads as "Differs" on its plan', () => {
    const read: MoneyRead = { readAt: NOW.toISOString(), testMode: true, customer: { id: 'cus_1', email: null }, card: null, charges: [], olderBefore: null, subscriptionsMore: false, nextCharge: { kind: 'none' },
      subscriptions: [{ id: 'sub_1', status: 'active', planId: 'tournament_plus', cycle: 'monthly', amountCents: 3900, currency: 'cad', currentPeriodEnd: '2026-11-01T13:00:00.000Z', createdAt: '2026-06-01T13:00:00.000Z', cancelAtPeriodEnd: false, endedAt: null }] };
    const rows = compareRecord({ planId: 'tournament_plus', status: 'active', currentPeriodEnd: '2026-11-01T13:00:00.000Z', subscriptionId: 'sub_1', customerId: 'cus_1', freeThrough: { lastDay: '2027-03-31', what: 'free time' } }, read);
    assert.ok(!rows.some(r => r.differs));
    assert.equal(agreeLine(rows, findPatterns(read, 'sub_1'), 'sub_1').text, 'Stripe and our record agree.');
  });
  it('the payment-method row names whatever the default is: a card, Link, or nothing — Link is never "no card"', () => {
    const ours = { planId: 'tournament_plus', status: 'active', currentPeriodEnd: null, subscriptionId: null, customerId: 'cus_1', freeThrough: null };
    const base: MoneyRead = { readAt: NOW.toISOString(), testMode: true, customer: { id: 'cus_1', email: null }, card: null, charges: [], olderBefore: null, subscriptionsMore: false, nextCharge: { kind: 'none' }, subscriptions: [] };
    const words = (read: MoneyRead) => compareRecord(ours, read).find(r => r.key === 'card')?.stripe;
    assert.equal(words({ ...base, otherMethod: 'Link · a@b.ca' }), 'Link · a@b.ca');
    assert.match(words({ ...base, card: { brand: 'visa', last4: '4242', expMonth: 3, expYear: 2030 } }) ?? '', /ending 4242 · expires 03\/2030/);
    assert.equal(words(base), 'No payment method on file');
  });
});

// ── The five patterns (drawing B) ───────────────────────────────────────────────────────────────

describe('drawing B · "charged twice" is found from invoices and periods, never from amounts and times alone', () => {
  const inv = (id: string, reason: string, start: string, end: string, sub: string | null = 'sub_1') => ({
    id, number: null, billingReason: reason, subscriptionId: sub, periodStart: start, periodEnd: end, planId: 'club', cycle: 'monthly', fromPlanId: null, description: null });
  const ch = (id: string, at: string, invoice: MoneyCharge['invoice'], over: Partial<MoneyCharge> = {}): MoneyCharge => ({ ...CHARGE, id, createdAt: at, invoice, ...over });
  const OCT = ['2026-10-01T13:00:00.000Z', '2026-11-01T13:00:00.000Z'] as const;
  it('two paid charges for one period of one subscription: the later is the duplicate', () => {
    const p = findPatterns({ subscriptions: [], charges: [ch('ch_b', '2026-10-01T13:03:00.000Z', inv('in_2', 'subscription_cycle', ...OCT)), ch('ch_a', '2026-10-01T13:00:00.000Z', inv('in_1', 'subscription_cycle', ...OCT))] }, 'sub_1');
    assert.equal(p.flags.get('ch_b')?.kind, 'duplicate');
    assert.equal(p.flags.get('ch_a')?.kind, 'duplicate_first');
  });
  it('the same amount on the same day, for DIFFERENT periods, is no duplicate (the common false alarm)', () => {
    const p = findPatterns({ subscriptions: [], charges: [
      ch('ch_move', '2026-09-14T18:20:00.000Z', inv('in_m', 'subscription_update', '2026-09-14T18:20:00.000Z', '2026-10-01T13:00:00.000Z')),
      ch('ch_oct', '2026-10-01T13:00:00.000Z', inv('in_o', 'subscription_cycle', ...OCT)),
    ] }, 'sub_1');
    assert.deepEqual(p.flags.get('ch_move'), { kind: 'plan_move', renewalAt: '2026-10-01T13:00:00.000Z' });
    assert.equal(p.duplicates.length, 0);
  });
  it('failed then retried is fine; a charge with no subscription is named; a second live subscription is named', () => {
    const sep = inv('in_s', 'subscription_cycle', '2026-09-01T13:00:00.000Z', OCT[0]);
    const p = findPatterns({
      subscriptions: [
        { id: 'sub_1', status: 'active', planId: 'club', cycle: 'monthly', amountCents: 10000, currency: 'cad', currentPeriodEnd: OCT[1], createdAt: '2026-06-01T00:00:00.000Z', cancelAtPeriodEnd: false, endedAt: null },
        { id: 'sub_2', status: 'active', planId: 'club', cycle: 'monthly', amountCents: 10000, currency: 'cad', currentPeriodEnd: OCT[1], createdAt: '2026-10-02T00:00:00.000Z', cancelAtPeriodEnd: false, endedAt: null },
        { id: 'sub_portal', status: 'active', planId: 'team', cycle: 'monthly', amountCents: 1500, currency: 'cad', currentPeriodEnd: OCT[1], createdAt: '2026-07-01T00:00:00.000Z', cancelAtPeriodEnd: false, endedAt: null },
      ],
      charges: [
        ch('ch_paid', '2026-09-04T13:00:00.000Z', sep), ch('ch_fail', '2026-09-01T13:00:00.000Z', sep, { status: 'failed', failureCode: 'card_declined' }),
        ch('ch_manual', '2026-08-12T20:41:00.000Z', inv('in_x', 'manual', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', null)),
        ch('ch_loose', '2026-08-10T20:41:00.000Z', null),
        ch('ch_portal', '2026-10-01T13:00:00.000Z', inv('in_p', 'subscription_cycle', OCT[0], OCT[1], 'sub_portal')),
      ],
    }, 'sub_1', ['sub_portal']);
    assert.equal(p.flags.get('ch_paid')?.kind, 'retry_paid');
    assert.deepEqual(p.flags.get('ch_manual'), { kind: 'not_subscription', manualInvoice: true });
    assert.deepEqual(p.flags.get('ch_loose'), { kind: 'not_subscription', manualInvoice: false });
    assert.equal(p.flags.get('ch_portal')?.kind, 'portal', 'a Coaches Portal the club pays for is its own, never a second subscription');
    assert.deepEqual(p.secondSubscriptions.map(s => s.id), ['sub_2']);
  });
});

// ── 7 · Find ────────────────────────────────────────────────────────────────────────────────────

describe('7 · Find builds a Stripe query only for a whole Stripe or invoice number', () => {
  it('quotes, OR, spaces, card digits and partial numbers never reach Stripe', async () => {
    for (const words of ['"x" OR number:"y"', '4242', 'A1B2C3D4-0007" OR "', 'A1B2 C3D4-0007', 'number:"A1B2C3D4-0007"', 'in_', 'ch_3Q8x OR', 'A1B2C3D4-0007\\']) {
      assert.equal(stripeNumberKind(words), null, words);
      assert.equal(invoiceNumberQuery(words), null, words);
    }
    let called = 0;
    const readers = { clubs: async () => ({ rows: [], total: 0 }), people: async () => ({ rows: [], total: 0 }), personClubs: async () => new Map(),
      stripe: async () => { called++; return []; } } as unknown as FindReaders;
    for (const words of ['"x" OR number:"y"', '4242', 'A1B2C3D4-0007" OR "', 'ch_3Q8x OR']) await runFind('super_admin', words, readers);
    assert.equal(called, 0);
    assert.equal(stripeNumberKind('A1B2C3D4-0007'), 'invoice_number');
    assert.equal(invoiceNumberQuery('a1b2c3d4-0007'), 'number:"A1B2C3D4-0007"');
    for (const [n, k] of [['ch_3Q8xL2Tz9Kq04Lk', 'payment'], ['py_3Q8xL2Tz9Kq04Lk', 'payment'], ['pi_3Q8xL2Tz9Kq04Lk', 'payment'], ['in_1Qz9Wb3Lm7Hs0Xp', 'invoice']] as const) {
      assert.equal(stripeNumberKind(n), k);
    }
  });
  it('Find’s Stripe read takes exactly one club by the item’s customer, in this site’s mode, and writes nothing', () => {
    const route = readCode('app/api/platform-admin/find/route.ts');
    assert.match(route, /item\.livemode === stripeKeyIsLive\(\)/);
    assert.match(route, /add\(orgs\.length === 1 && !shared \? orgs\[0\] : null,/);
    assert.match(route, /from\('team_workspaces'\)\.select\('billing_owner_org_id'\)\.eq\('stripe_customer_id', item\.customerId\)/);
    assert.match(route, /invoiceNumberQuery\(number\) : null\)\s*\.catch\(\(\) => null\);/, 'Stripe down never costs the clubs and people');
    assert.match(route, /if \(!org \|\| seen\.has\(org\.id\) \|\| isDemoOrgSlug\(org\.slug\)\) return;/);
    assert.doesNotMatch(route, /\.insert\(|\.update\(|\.upsert\(/);
    assert.match(readCode('lib/console-money-stripe.ts'), /res\.data\.length === 1 \? invoiceItem/);
  });
});

// ── 8 · Q9 ──────────────────────────────────────────────────────────────────────────────────────

describe('8 · Q9: a staff plan change on a club Stripe still bills is refused, everywhere', () => {
  it('any subscription not cancelled in Stripe, whatever its billing status', () => {
    for (const status of ['active', 'past_due', 'unpaid', 'incomplete', 'trialing', 'paused', null]) {
      assert.equal(stripeStillBills({ stripeSubscriptionId: 'sub_1', subscriptionStatus: status }), true, String(status));
    }
    for (const status of ['canceled', 'incomplete_expired']) assert.equal(stripeStillBills({ stripeSubscriptionId: 'sub_1', subscriptionStatus: status }), false);
    assert.equal(stripeStillBills({ stripeSubscriptionId: 'mock_sub', subscriptionStatus: 'active' }), false);
    assert.equal(stripeStillBills({ stripeSubscriptionId: null, subscriptionStatus: 'active' }), false);
  });
  it('the refusal lives in the one shared rule, before any write; Stripe is asked before refusing; the free plan drops only an ended link', () => {
    const rule = readCode('lib/operator-plan-change.ts');
    const body = rule.slice(rule.indexOf('export async function applyOperatorPlanChange'));
    assert.ok(body.indexOf('throw new PlanRefusedError()') < body.indexOf(".update(updatePayload)"));
    assert.match(body, /current\.plan_id !== planId \|\| currentEffectiveLimit !== effectiveTournamentLimit/, 'a custom team limit alone still saves');
    // A missed webhook leaves a subscription Stripe already ended reading as live: Stripe is asked, unknown refuses.
    assert.match(body, /subscriptionEnded = await subscriptionEndedInStripe\(current\.stripe_subscription_id!\);\s*if \(!subscriptionEnded\) throw new PlanRefusedError\(\);/);
    assert.match(rule, /async function subscriptionEndedInStripe[\s\S]*?return e\.statusCode === 404 \|\| e\.code === 'resource_missing';/);
    // The free plan never drops a link to a subscription Stripe still bills.
    assert.match(body, /if \(subscriptionEnded\) updatePayload\.stripe_subscription_id = null;/);
  });
  it('the pencil, Put it back, the plan route and Bulk changes all obey it; Bulk skips with the line', () => {
    for (const f of ['app/api/platform-admin/orgs/[id]/record/route.ts', 'app/api/platform-admin/orgs/[id]/put-back/route.ts', 'app/api/platform-admin/orgs/[id]/plan/route.ts']) {
      assert.match(readCode(f), /err instanceof PlanRefusedError\) return .*err\.message/, f);
    }
    assert.match(readCode('app/api/platform-admin/bulk-operations/route.ts'), /err instanceof PlanRefusedError\) \{\s*results\.push\(\{[^}]*skipped: true, message: `Skipped: \$\{err\.message\}`/);
    assert.match(readCode('app/platform-admin/orgs/[id]/ClubRecord.tsx'), /can\.billing && org\.paysThroughStripe && \(/);
  });
});

// ── 10 · Q7 ─────────────────────────────────────────────────────────────────────────────────────

describe('10 · Q7: the bulk billing status override follows free time’s rules, on the server', () => {
  it('no end, a past day, over the cap per role: refused', () => {
    assert.equal(lastDayRefusal('', 'billing', NOW), 'Choose the last free day.');
    assert.equal(lastDayRefusal('2026-10-01', 'billing', NOW), 'The last free day must be after today.');
    assert.notEqual(lastDayRefusal('2027-06-01', 'billing', NOW), null, 'Billing: 6 months');
    assert.equal(lastDayRefusal('2027-06-01', 'super_admin', NOW), null, 'Super admin: no month limit');
    assert.equal(lastDayRefusal('2027-12-01', 'super_admin', NOW), null, 'Super admin: past the old 12 months');
  });
  it('the route uses them and skips your own club; "Optional expiry" is gone', () => {
    const route = readCode('app/api/platform-admin/bulk-operations/route.ts');
    assert.match(route, /lastDayRefusal\(lastDay, auth\.role\)/);
    // "No end date" is a super admin's alone, checked on the server before the day.
    assert.match(route, /indefinite && !canGiveIndefinitely\(auth\.role\)/);
    assert.match(route, /endInstantForLastDay\(lastDay\)/);
    assert.doesNotMatch(route, /body\.expires_at/);
    assert.doesNotMatch(readSource('app/platform-admin/bulk-operations/BulkOperationsClient.tsx'), /Optional expiry/);
  });
});

// ── 11 · Q8 ─────────────────────────────────────────────────────────────────────────────────────

describe('11 · Q8: one running plan grant per club, enforced by the database', () => {
  it('an exclusion rule over un-ended plan grants’ time ranges — so a grant that ran out by itself never blocks a new one', () => {
    const sql = readSource('supabase/migrations/380_support_console_money.sql');
    assert.match(sql, /CREATE EXTENSION IF NOT EXISTS btree_gist/);
    assert.match(sql, /EXCLUDE USING gist \(org_id WITH =, tstzrange\(starts_at, expires_at, '\[\)'\) WITH &&\)\s+WHERE \(type = 'plan_tier' AND revoked_at IS NULL\)/);
    assert.doesNotMatch(sql, /UNIQUE INDEX[^;]*org_overrides/, 'not a plain unique index');
    assert.match(readCode('lib/free-time-writes.ts'), /error\?\.code === '23P01'/);
  });
});

// ── 12 · The window foot ────────────────────────────────────────────────────────────────────────

describe('12 · every sentence in a console window’s foot wears the foot-note face (12 px, quiet ink)', () => {
  const cssRule = (css: string, cls: string) => new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  it('the console’s own foot-note class is the support size', () => {
    assert.match(cssRule(readSource('app/platform-admin/record.module.css'), 'footNote'), /font-size:\s*var\(--type-support\)/);
    assert.match(cssRule(readSource('app/platform-admin/record.module.css'), 'footNote'), /color:\s*var\(--text-tertiary\)/);
  });
  it('each footerStart in the console is bare, or a class at the support size', () => {
    let seen = 0;
    for (const f of filesUnder('app/platform-admin', '.tsx')) {
      const code = readCode(f);
      for (const m of code.matchAll(/footerStart=\{([^\n]*)/g)) {
        seen++;
        const tags = [...m[1].matchAll(/<(span|p|div)(\s+className=\{([a-zA-Z]+)\.([a-zA-Z]+)\})?/g)];
        assert.ok(tags.length > 0, `${f}: a foot sentence that is not a span or p`);
        for (const t of tags) {
          if (!t[2]) continue; // bare: KitDialog gives it the face
          const imp = new RegExp(`import ${t[3]} from '([^']+)'`).exec(code)?.[1];
          assert.ok(imp, `${f}: ${t[3]} is not a CSS module import`);
          const cssPath = `${f.replace(/[^/]+$/, '')}${imp}`.replace(/\/\.\//g, '/');
          const resolved = cssPath.split('/').reduce<string[]>((acc, part) => (part === '..' ? acc.slice(0, -1) : [...acc, part]), []).join('/');
          assert.match(cssRule(readSource(resolved), t[4]), /font-size:\s*var\(--type-support\)/, `${f}: .${t[4]} is not the foot-note face`);
        }
      }
    }
    assert.ok(seen >= 3, `expected the console's windows, found ${seen}`);
  });
});

// ── 13 · The threat list ────────────────────────────────────────────────────────────────────────

/** Each of the drawing's 23 threats, and the guard above (or the reason a test cannot hold it). */
const THREAT_GUARDS: string[] = [
  'T1 a role without the power — 2 · the refund power … checks it before it reads anything',
  'T2 your own club — 2 · your own club …; the wide check',
  'T3 a friend’s club — no test can know a friend: every refund is on the Story and the audit log’s Reason column (3)',
  'T4 a stolen Billing login — 2 · Billing: 6 months and the sixth refund in 24 hours',
  'T5 a bigger amount, another club’s charge, a bad number — 2 · amounts; 2 · a charge is this club’s only when …',
  'T6 another club’s charge on this Money tab — 2 · … on every read (the charge window route)',
  'T7 a retry or double click — 1 · a double submit; 1 · a retry carries the same key',
  'T8 a lost answer after Stripe forgot the key — 1 · recovered by LISTING: zero refund requests',
  'T9 two staff at once — 1 · two starts for one charge: the database refuses the second',
  'T10 a refund in Stripe with no record — 3 · the first write fails → Stripe never called',
  'T11 a recorded refund Stripe never made — 1 · a timeout or a fault is "unknown", never done',
  'T12 Stripe’s message counted twice — Q4 A: no refund messages are received; the Story de-duplicates on the refund number (lib/console-money-story.ts)',
  'T13 an empty reason or a card number — 2 · the reason',
  'T14 our words in Stripe for good — 4 · the refund’s metadata holds no free text',
  'T15 card data stored — 5 · nothing we write carries card data',
  'T16 Stripe’s error text leaks — 4 · an error naming rk_live_ or acct_',
  'T17 fraudulent sent — 3 · "all of it" … never fraudulent',
  'T18 a refund changes the plan — no webhook change (Q4 A); the refund route writes only our refunds record and the audit log',
  'T19 the plan-change refusal walked around — 8 · Q9 everywhere',
  'T20 Find used to search Stripe freely — 7 · Find builds a Stripe query only for a whole number',
  'T21 Stripe’s side to a role that may not read it — 6 · the power before any Stripe call',
  'T22 a test refund on prod or the reverse — 2 · … in this site’s mode; the Test mode chip from the key',
  'T23 the console key can do anything — Stripe grants refunds only with charge writes (one "Charges and Refunds" permission): the full key stays and these guards carry the weight (gate, 2026-10-26)',
];

describe('13 · the 23 threats, each with a guard or a named reason', () => {
  it('the drawings’ threat list and this table have the same length', () => {
    const html = readSource('docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_DRAWINGS.html');
    const list = html.slice(html.indexOf('var THREATS = ['), html.indexOf('];', html.indexOf('var THREATS = [')));
    const count = (list.match(/^\s*\["/gm) ?? []).length;
    assert.equal(count, 23);
    assert.equal(THREAT_GUARDS.length, count);
  });
});
