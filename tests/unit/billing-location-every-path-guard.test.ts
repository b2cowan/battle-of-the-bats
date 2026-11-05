/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * EVERY STRIPE CHARGE IS ON ONE LIST — GST/HST Stage 1 Part 4, the guard
 * (build prompt docs/projects/active/GST_HST_STAGE1_PART4_BUILD_PROMPT.md; plan GST_HST_COLLECTION_PLAN.md §4 Stage 1, §7).
 *
 * Stage 2 turns tax on and promises that every paid checkout knows where the buyer is. A missing address does not fail
 * loudly: it silently becomes the wrong tax. Parts 1–3 made the promise true for the paths that existed;
 * billing-location-checkout-guard pins those five one by one. This file is what that one cannot be: a CENSUS of every Stripe
 * call that can charge or open a charge, anywhere in `app/`, `lib/` and `components/`, each on CHARGING_CALLS below as either
 *   · `checked` — the buyer's address is required before it (`requireBillingLocation`, lib/billing-location-server.ts), or
 *   · `allowed` — with the one-sentence reason it needs no address, and the facts that reason rests on.
 * A call on no list fails the build with a sentence that says what to do. So does a list entry whose call is gone, so a
 * deleted path leaves no stale allowance behind. And one level down: a shared helper that charges (`applyMove`) has every
 * caller pinned, because the address check lives in the caller, not the helper.
 *
 * Left out ON PURPOSE: `scripts/` (the seed scripts create Stripe TEST subscriptions for owner walks and never run for a
 * buyer) and `tests/`. Not charges, so not matched: `invoices.createPreview` (a quote), `subscriptions.cancel`, schedule
 * `release`, `billingPortal.sessions.create` (edits no address since Part 3), the dev-only `/api/billing/mock-apply`
 * toggle (no Stripe call; it answers "not found" in production).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { between, filesUnder, readCode, sourceExists, stripComments } from './_source-code.ts';

/** Every Stripe method that charges, or opens a charge, by its path on the client. */
const CHARGING_METHODS = [
  'checkout.sessions.create',
  'subscriptions.create', 'subscriptions.update', 'subscriptions.resume',
  'subscriptionSchedules.create', 'subscriptionSchedules.update',
  'invoices.create', 'invoices.pay', 'invoices.finalizeInvoice',
  'invoiceItems.create',
  'paymentIntents.create',
  'paymentLinks.create',
] as const;

/**
 * Any reach of a charging method: `stripe.…`, `getStripe().…`, `stripe?.…`, a destructured `invoiceItems.create(`, and a
 * chain split across lines. `createPreview(` is not `create(`. Read comment-stripped code (`readCode`) only.
 */
const CHARGING = new RegExp(
  `(?<![\\w$])(${CHARGING_METHODS.map(m => m.split('.').join('\\s*\\??\\.\\s*')).join('|')})\\s*\\(`,
  'g',
);

/** The charging calls in `code`, in order, each as its method path with the spacing removed. */
function chargingCalls(code: string): { call: string; index: number }[] {
  return [...code.matchAll(CHARGING)].map(m => ({ call: m[1].replace(/[\s?]/g, ''), index: m.index! }));
}

/** `checked` with a `helper`: the check lives in that helper's callers (HELPER_CALLERS), not in the file. */
type Entry = { file: string; call: string; count: number; facts?: RegExp[] } & (
  | { checked: string; helper?: keyof typeof HELPER_CALLERS }
  | { allowed: string }
);

const MOVE_DOWN = 'a move DOWN, at renewal and with no proration: it renews a subscription the buyer already bought through a checked path, and charges nothing new';
const FEE_RECOVERY = 'the monthly Stripe-fee recovery invoice: it can bill a club that has no paid plan and so no address. A Stage 5 finding '
  + '(GST_HST_COLLECTION_PLAN.md); until Stage 5 it is the ONE FieldLogicHQ charge that can go out with no address on file (owner, Ask 2b, 2026-11-04)';

/** THE LIST. A new charge goes on it in the same commit, `checked` or `allowed` with its reason. */
const CHARGING_CALLS: Entry[] = [
  // ── checked: the address is required before the call ──
  { file: 'app/api/billing/create-checkout/route.ts', call: 'checkout.sessions.create', count: 1,
    checked: 'paths A + B, a club plan and a Premium portal becoming the club in place' },
  { file: 'app/api/billing/create-team-checkout/route.ts', call: 'checkout.sessions.create', count: 1,
    checked: 'path C, coach Premium: new, reactivate and Keep Premium (the buyer is the person)' },
  { file: 'app/api/billing/choose-next-season/route.ts', call: 'checkout.sessions.create', count: 1,
    checked: 'path D, the Founding next-season choice' },
  { file: 'lib/plan-move.ts', call: 'subscriptions.update', count: 1, helper: 'applyMove',
    checked: 'path E, a move UP on a live subscription (a prorated invoice): checked in each caller of applyMove, pinned below' },

  // ── allowed: no address needed, and why ──
  { file: 'lib/plan-move.ts', call: 'subscriptionSchedules.create', count: 1, allowed: MOVE_DOWN, facts: [/proration_behavior: 'none'/] },
  { file: 'lib/plan-move.ts', call: 'subscriptionSchedules.update', count: 1, allowed: MOVE_DOWN, facts: [/proration_behavior: 'none'/] },
  { file: 'lib/plan-ending-server.ts', call: 'subscriptions.update', count: 2,
    allowed: 'cancel at renewal, and Keep {Plan} withdrawing it: the same subscription, only its cancel fields, no new charge',
    facts: [
      /subscriptions\.update\(id, \{ cancel_at_period_end: true \}\)/,
      /subscriptions\.update\(id, clear === 'period_end' \? \{ cancel_at_period_end: false \} : \{ cancel_at: '' \}\)/,
    ] },
  { file: 'lib/billing-setup.ts', call: 'checkout.sessions.create', count: 1,
    allowed: 'saves a card for later (setup mode): charges nothing', facts: [/checkout\.sessions\.create\(\{\s*mode: 'setup',/] },
  { file: 'lib/team-org-billing.ts', call: 'checkout.sessions.create', count: 1,
    allowed: 'DEAD: startOrgTeamAddonCheckout (a club paying for a coach’s team) has no caller, and the pin below fails the day one '
      + 'appears without the address check. Left in place on purpose (owner, Ask 1, 2026-11-04); its deletion is on the dead-code report' },
  { file: 'lib/stripe-connect.ts', call: 'checkout.sessions.create', count: 1,
    allowed: 'a family paying a CLUB, on the club’s own Stripe account: the club is the seller, not FieldLogicHQ. Our payment fee on it '
      + 'is a later stage’s tax question (owner, Ask 2a, 2026-11-04)',
    facts: [/mode: 'payment'/, /\{ \.\.\.on\(args\.accountId\), idempotencyKey: args\.idempotencyKey \}/] },
  { file: 'lib/platform-stripe-fees.ts', call: 'invoiceItems.create', count: 3, allowed: FEE_RECOVERY },
  { file: 'lib/platform-stripe-fees.ts', call: 'invoices.create', count: 1, allowed: FEE_RECOVERY },
  { file: 'lib/platform-stripe-fees.ts', call: 'invoices.finalizeInvoice', count: 1, allowed: FEE_RECOVERY },
];

/**
 * One level down: every file that names a shared charging helper, and why that caller is safe. A file not on its list fails,
 * because the helper itself does not check the address.
 */
const HELPER_CALLERS = {
  applyMove: {
    home: 'lib/plan-move.ts',
    callers: {
      'app/api/billing/move/route.ts': (code: string, file: string) => {
        const post = between(code, 'export const POST', 'export const DELETE', `${file} POST`);
        const check = post.indexOf('requireBillingLocation(');
        assert.ok(check >= 0 && check < post.indexOf('applyMove('), `${file}: the address check must come before applyMove (path E)`);
      },
      // Keep {Plan} rebuilding a waiting move: only ever DOWN, refused before applyMove otherwise, so it never charges.
      'lib/plan-ending-server.ts': (code: string, file: string) => {
        const body = between(code, 'async rescheduleMove(', 'applyMove({', `${file} rescheduleMove`);
        assert.match(body, /if \(moveDirection\(account\.ownPlan, plan\) !== 'down'\) return /,
          `${file}: rescheduleMove must refuse anything but a move DOWN before it calls applyMove, or it can charge with no address check`);
      },
    } as Record<string, (code: string, file: string) => void>,
  },
} as const;

/** A helper that charges with no check of its own and that nothing calls (Ask 1): the day something does, this fails. */
const UNCALLED_CHARGING_HELPERS = [{ name: 'startOrgTeamAddonCheckout', home: 'lib/team-org-billing.ts' }];

const SOURCE_FILES = [...new Set(['app', 'lib', 'components'].flatMap(dir => ['.ts', '.tsx', '.js', '.mjs'].flatMap(ext => filesUnder(dir, ext))))];
const CODE = new Map(SOURCE_FILES.map(file => [file, readCode(file)]));

const unlisted = (file: string, call: string) =>
  `${file} opens a Stripe charge (\`${call}\`) that isn't on the billing-address list. Call \`requireBillingLocation\` before it `
  + '(see GST_HST_STAGE1_BUILD_PROMPT.md Part 2), then add it to CHARGING_CALLS in this file with `checked`, or with `allowed` '
  + 'and the reason it needs no address.';

describe('the matcher (proved on fixtures, so the census can fail without planting a call in the tree)', () => {
  const calls = (src: string) => chargingCalls(stripComments(src)).map(c => c.call);

  it('finds the shared client, the getter, optional chaining and a destructured client', () => {
    assert.deepEqual(calls('await stripe.checkout.sessions.create({ mode: "payment" })'), ['checkout.sessions.create']);
    assert.deepEqual(calls('return getStripe().subscriptions.update(id, {})'), ['subscriptions.update']);
    assert.deepEqual(calls('client?.invoices?.pay(id)'), ['invoices.pay']);
    assert.deepEqual(calls('const { invoiceItems } = stripe;\ninvoiceItems.create({})'), ['invoiceItems.create']);
  });

  it('finds a chain split across lines', () => {
    assert.deepEqual(calls('stripe.checkout\n    .sessions\n    .create({\n  mode: "subscription" })'), ['checkout.sessions.create']);
    assert.deepEqual(calls('stripe\n  .subscriptionSchedules\n  .update(s.id, {})'), ['subscriptionSchedules.update']);
  });

  it('ignores a call inside a comment', () => {
    assert.deepEqual(calls('// stripe.checkout.sessions.create({})\n/* stripe.invoices.create({}) */\nconst x = 1;'), []);
  });

  it('ignores what charges nothing: a quote, a cancel, a release, Stripe’s billing page, a read', () => {
    assert.deepEqual(calls([
      'stripe.invoices.createPreview({})',
      'stripe.subscriptions.cancel(id)',
      'stripe.subscriptions.retrieve(id)',
      'stripe.subscriptionSchedules.release(id)',
      'stripe.billingPortal.sessions.create({})',
      'mySubscriptions.update(1)',
    ].join('\n')), []);
  });
});

describe('every Stripe charge in app/, lib/ and components/ is on the list', () => {
  const found = new Map<string, Map<string, { count: number; first: number }>>();
  for (const [file, code] of CODE) {
    for (const { call, index } of chargingCalls(code)) {
      const byCall = found.get(file) ?? new Map();
      const seen = byCall.get(call);
      byCall.set(call, { count: (seen?.count ?? 0) + 1, first: seen?.first ?? index });
      found.set(file, byCall);
    }
  }

  it('the census sees the charges it is meant to (a matcher that found nothing would pass everything)', () => {
    assert.ok(found.size >= 5, `only ${found.size} files with a Stripe charge: the matcher or the walk is broken`);
  });

  it('no charge is missing from the list, and none appeared beside a listed one', () => {
    for (const [file, byCall] of found) {
      for (const [call, { count }] of byCall) {
        const entry = CHARGING_CALLS.find(e => e.file === file && e.call === call);
        assert.ok(entry, unlisted(file, call));
        assert.equal(count, entry.count, `${file} now has ${count} \`${call}\` calls and CHARGING_CALLS says ${entry.count}. `
          + `${unlisted(file, call)} If the extra one is the same kind as the listed one, change the count.`);
      }
    }
  });

  it('no entry outlives its call (a deleted path leaves no stale allowance)', () => {
    for (const entry of CHARGING_CALLS) {
      assert.ok(sourceExists(entry.file), `${entry.file} is gone: remove its \`${entry.call}\` entry from CHARGING_CALLS`);
      assert.ok(found.get(entry.file)?.has(entry.call), `${entry.file} no longer calls \`${entry.call}\`: remove it from CHARGING_CALLS`);
    }
  });

  for (const entry of CHARGING_CALLS) {
    if (!('checked' in entry)) continue;
    it(`checked · ${entry.file} (${entry.checked})`, () => {
      if (entry.helper) {
        assert.equal(HELPER_CALLERS[entry.helper].home, entry.file, `${entry.helper} must live in ${entry.file}`);
        return; // its callers are pinned in the next block
      }
      const code = CODE.get(entry.file)!;
      const check = code.indexOf('requireBillingLocation(');
      assert.ok(check >= 0 && check < found.get(entry.file)!.get(entry.call)!.first,
        `${entry.file}: \`requireBillingLocation\` must come before \`${entry.call}\``);
    });
  }

  for (const entry of CHARGING_CALLS) {
    if (!entry.facts) continue;
    it(`allowed · ${entry.file} \`${entry.call}\` still is what its reason says`, () => {
      for (const fact of entry.facts!) {
        assert.match(CODE.get(entry.file)!, fact, `${entry.file}: the reason it needs no address rests on ${fact}, which is gone. `
          + `Re-check the call: if it can charge now, call \`requireBillingLocation\` before it and move it to \`checked\`.`);
      }
    });
  }
});

describe('one level down: the callers of a helper that charges', () => {
  for (const [helper, { home, callers }] of Object.entries(HELPER_CALLERS)) {
    const named = new RegExp(`\\b${helper}\\b`);
    const mentions = [...CODE].filter(([file, code]) => file !== home && named.test(code)).map(([file]) => file);

    it(`every file that reaches ${helper} is a pinned caller`, () => {
      for (const file of mentions) {
        assert.ok(callers[file], `${file} calls ${helper}, which charges and does not check the address itself. Call `
          + `\`requireBillingLocation\` before it (see app/api/billing/move/route.ts), then add ${file} to HELPER_CALLERS.${helper} in this file.`);
      }
    });

    for (const [file, pin] of Object.entries(callers)) {
      it(`${helper} · ${file}`, () => {
        assert.ok(mentions.includes(file), `${file} no longer calls ${helper}: remove it from HELPER_CALLERS.${helper}`);
        pin(CODE.get(file)!, file);
      });
    }
  }

  for (const { name, home } of UNCALLED_CHARGING_HELPERS) {
    it(`${name} (dead, no address check) has no caller`, () => {
      const named = new RegExp(`\\b${name}\\b`);
      for (const [file, code] of CODE) {
        if (file === home) continue;
        assert.doesNotMatch(code, named, `${file} reaches ${name}, a paid Stripe checkout with no billing-address check. `
          + `Call \`requireBillingLocation\` before it (see GST_HST_STAGE1_BUILD_PROMPT.md Part 2), then move ${home}'s `
          + '`checkout.sessions.create` entry in this file from `allowed` to `checked`.');
      }
      const homeCode = CODE.get(home);
      assert.ok(homeCode, `${home} is gone: remove ${name} from UNCALLED_CHARGING_HELPERS and its entry from CHARGING_CALLS`);
      assert.equal((homeCode.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) ?? []).length, 1,
        `${home} calls ${name} itself now: treat that caller like any other (check the address first)`);
    });
  }
});

/**
 * GST/HST Stage 2 Part 2b (Ask 8, owner 2026-11-05): turning on online payments is a door to an INVOICE, not a charge, so the
 * census above cannot see it. The club's Stripe fees are invoiced and taxed by its billing address, and Stripe refuses a taxed
 * invoice it cannot place. So `connect` (a new account and a reconnect alike) asks for the club's own address before any
 * Stripe call, and the Payouts card opens the Billing address window on the refusal instead of showing an error.
 */
describe('turning on online payments asks for the club’s billing address first (Part 2b)', () => {
  const ROUTE = 'app/api/admin/payouts/route.ts';
  const CARD = 'components/admin/kit/club/PayoutsCard.tsx';

  it(`${ROUTE}: connect checks the address before it touches Stripe or the payout account`, () => {
    const connect = between(CODE.get(ROUTE)!, "case 'connect':", "case 'agree_terms':", `${ROUTE} connect`);
    const check = connect.indexOf('requireBillingLocation(');
    assert.ok(check >= 0, `${ROUTE}: connect must call requireBillingLocation (GST_HST_STAGE2_PART2B_BUILD_PROMPT.md Part 1)`);
    for (const after of ['createClubAccount(', 'retrieveAccount(', "from('org_payment_accounts')", 'onboardingLink(']) {
      const at = connect.indexOf(after);
      assert.ok(at === -1 || check < at, `${ROUTE}: the address check must come before ${after} — a refusal creates and changes nothing`);
    }
    assert.match(connect, /if \(!address\.ok\) return address\.response;/, `${ROUTE}: connect must return the address refusal as is (409)`);
    assert.match(connect, /kind: 'org'/, `${ROUTE}: connect checks the CLUB's own row, the one the fee invoice reads`);
  });

  it(`${CARD}: the Before window asks first, and opens the window on the server's refusal`, () => {
    const before = between(CODE.get(CARD)!, 'function BeforeWindow(', 'function TermsRow(', `${CARD} BeforeWindow`);
    assert.match(before, /useBillingAddressGate\(\{ orgSlug \}\)/, `${CARD}: the Before window needs the billing-address gate`);
    assert.match(before, /address\.ensure\(\(\) => void go\(\)\)/, `${CARD}: the connect button must go through ensure(go)`);
    assert.match(before, /if \(isAddressRefusal\(e\)\) \{ address\.refused\(\(\) => void go\(\)\); return; \}/,
      `${CARD}: billing_address_required must open the window and retry the connect, not show an error`);
    assert.match(before, /if \(address\.open && address\.dialog\) return address\.dialog;/,
      `${CARD}: the address window replaces the Before window (which stays mounted, so the fee choice and the tick survive) — `
      + 'only once it can draw, or a failed address read blanks the window with no way out (/review 2026-11-05)');
  });

  it(`${CARD}: a club connected without an address sees the line (owner ruling A), by the fee invoice's own test`, () => {
    assert.match(CODE.get(ROUTE)!, /addressMissing: isOwner && facts && !facts\.disconnectedAt\s*\? !\(await clubFeeInvoicePlaceable\(ctx\.org\)/,
      `${ROUTE}: addressMissing must use clubFeeInvoicePlaceable, the test invoiceOneClub waits on`);
    assert.match(CODE.get(CARD)!, /isOwner && view\.addressMissing && <AddressMissingLine /, `${CARD}: the card must show the address line to the owner`);
    assert.match(between(CODE.get(CARD)!, 'function AddressMissingLine(', 'function PayoutsRecord(', `${CARD} AddressMissingLine`),
      /if \(address\.location\) return null;[\s\S]*onClick=\{\(\) => address\.edit\(\)\}/,
      `${CARD}: the line's button opens the Billing address window, and the line goes once the address is saved`);
    assert.match(CODE.get('lib/platform-stripe-fees.ts')!, /if \(!\(await placeable\(location, existingCustomer\)\)\) \{/,
      'lib/platform-stripe-fees.ts: invoiceOneClub must wait on placeable(), the same test the card reads');
  });
});
