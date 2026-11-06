/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A PLATFORM-ADMIN REFUND OF AN INVOICE CHARGE IS A CREDIT NOTE — GST/HST Stage 2 Part 6b, the build guard
 * (build prompt docs/projects/active/GST_HST_STAGE2_PART6B_BUILD_PROMPT.md, Part 2; owner R1–R3 2026-11-05; accounting 6c).
 *
 * A refund of a taxed invoice that skips the credit note does not fail loudly: the money goes back, the club's invoice still
 * reads paid with its full GST/HST, and our own tax filing over-reports. So the path is pinned in the SOURCE, beside the
 * behaviour suite (support-console-stage3-guard.test.ts §6b, which runs the real code against a fake Stripe):
 *   1. `refunds.create` on a platform charge is called in exactly one place — the no-invoice branch of `makeRefund` (R3) —
 *      and nowhere else under the platform-admin routes or the console's money modules;
 *   2. a credit note is never asked with a top-level `amount` (Part 0 1a: it reverses no tax) and never with `quantity`
 *      (5a/5c: refused on a proration line); the refund's note is emailed by Stripe (R2), keyed by our record;
 *   3. the refund route learns the invoice BEFORE makeRefund and hands it on; the preview route writes nothing;
 *   4. the answering-fee credit (lib/platform-stripe-fees.ts) keeps its own email setting, `none` (unchanged by Part 6b).
 * Read through `readCode`, which strips comments: a guard that reads prose proves the prose.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';

const STRIPE_HALF = 'lib/console-money-stripe.ts';
const PLANNER = 'lib/console-money-credit.ts';
const REFUND_ROUTE = 'app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/refund/route.ts';
const PREVIEW_ROUTE = 'app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/refund/preview/route.ts';

const count = (text: string, needle: string) => text.split(needle).length - 1;
/** The text of `fn(` … its matching close paren. */
function callBody(text: string, start: number): string {
  const open = text.indexOf('(', start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(open, i + 1);
  }
  throw new Error('unbalanced call');
}

describe('a refund of a charge that paid an invoice goes through a credit note', () => {
  it('refunds.create is called once, in makeRefund’s no-invoice branch, after the credit note’s', () => {
    const code = readCode(STRIPE_HALF);
    assert.equal(count(code, 'refunds.create('), 1, 'one bare refund call in the Stripe half');
    const fn = code.slice(code.indexOf('export async function makeRefund('), code.indexOf('export async function recoverRefunds('));
    const branch = fn.indexOf('if (plan) {');
    const note = fn.indexOf('creditNotes.create(');
    const otherwise = fn.indexOf('} else {', note);
    const bare = fn.indexOf('refunds.create(');
    assert.ok(branch > 0 && branch < note && note < otherwise && otherwise < bare, 'the bare refund sits only in the else of `if (plan)`');
    // `plan` is set only when the route handed an invoice, and nothing else assigns it.
    assert.equal(count(fn, 'plan = planned;'), 1);
    assert.match(fn, /if \(invoice\) \{\s+let planned/);
  });

  it('no other platform-admin route or console money module makes a bare refund', () => {
    const files = [...filesUnder('app/api/platform-admin', '.ts'), ...filesUnder('lib', '.ts').filter(f => /^lib\/console-[^/]*\.ts$/.test(f))];
    assert.ok(files.length > 10, 'the census read the folders');
    for (const f of files) {
      if (f.replace(/\\/g, '/') === STRIPE_HALF) continue;
      assert.equal(count(readCode(f), 'refunds.create('), 0, `${f} makes a refund outside makeRefund`);
    }
  });

  it('a credit note is never asked with a top-level amount or with quantity; Stripe emails it; our record is the key', () => {
    const code = readCode(STRIPE_HALF);
    const create = callBody(code, code.indexOf('stripe.creditNotes.create'));
    assert.match(create, /^\(\{\s+invoice: invoice!\.invoiceId,\s+lines: plan\.lines,\s+refund_amount: plan\.cardCents,\s+email_type: 'credit_note',\s+metadata,\s+\}, \{ \.\.\.REFUND_OPTS, idempotencyKey: record\.id \}\)$/);
    const planner = readCode(PLANNER);
    assert.equal(count(planner, 'creditNotes.preview('), 1);
    assert.match(callBody(planner, planner.indexOf('creditNotes.preview')), /^\(\{ invoice: target\.invoiceId, lines: creditLines\(order, b\) \}, READ_OPTS\)$/);
    assert.match(planner, /out\.push\(\{ type: 'invoice_line_item', invoice_line_item: l\.id, amount \}\)/);
    for (const f of [STRIPE_HALF, PLANNER]) assert.doesNotMatch(readCode(f), /quantity/, `${f} never credits by quantity`);
  });

  it('the refund route learns the invoice before makeRefund and hands it on; the preview route writes nothing', () => {
    const route = readCode(REFUND_ROUTE);
    const learn = route.indexOf('creditTargetForCharge(stripe, paymentIntentId, { customerId: club.customerId, live })');
    assert.ok(learn > 0 && learn < route.indexOf('makeRefund(stripe'), 'the invoice is read first');
    assert.match(route, /invoice: credit\.target,/);
    assert.match(route, /if \(!credit\.ok\) return refuse\(credit\.status, credit\.error\);/);
    const preview = readCode(PREVIEW_ROUTE);
    assert.ok(preview.indexOf("requirePlatformPower('refund')") > 0 && preview.indexOf("requirePlatformPower('refund')") < preview.indexOf('clubStripeFacts('), 'the refund power before any read');
    assert.match(preview, /readClubCharge\(stripe, chargeId, club,/);
    assert.match(preview, /creditTargetForCharge\(stripe, found\.paymentIntentId, \{ customerId: club\.customerId, live \}\)/);
    assert.doesNotMatch(preview, /\.insert\(|\.update\(|\.upsert\(|creditNotes\.create|refunds\.create|makeRefund/);
  });

  it('the answering-fee credit keeps Stripe’s email off (Plan & billing says it; Part 6b changes only the refund)', () => {
    const fees = readCode('lib/platform-stripe-fees.ts');
    const body = fees.slice(fees.indexOf('async function creditAgainst('));
    assert.match(body, /email_type: 'none',/);
  });
});
