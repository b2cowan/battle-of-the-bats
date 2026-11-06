/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S NAME GOES BACK ON AFTER STRIPE'S PAGE — GST/HST Stage 2 Part 6b Part 3, the guard
 * (build prompt docs/projects/active/GST_HST_STAGE2_PART6B_BUILD_PROMPT.md; owner 2026-11-05 + R4).
 *
 * Checkout's `customer_update.name: 'auto'` writes the CARDHOLDER's name onto the Stripe customer when no business name is typed,
 * and every later invoice would name that person. The webhook puts ours back (`buyerNameAfterCheckout`, unit-tested in
 * billing-tax.test.ts). What a unit test cannot see, and this file pins:
 *   · the call is in the subscription-mode arm, and BEFORE the next-season and standalone_team arms — both `break` early, so a
 *     call placed after them silently never runs for paths C and B;
 *   · it never throws (a 500 re-sends the whole event), and a failure is told (nothing later repairs it);
 *   · every path stores OUR name on the customer before Checkout (without it the fix does nothing for that path);
 *   · R4: Stripe's page is unchanged — no `name_collection` anywhere.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TAXED_CHECKOUT } from '../../lib/billing-tax.ts';
import { between, filesUnder, functionBody, readCode, readSource } from './_source-code.ts';

const WEBHOOK = 'app/api/billing/webhook/route.ts';
const code = readCode(WEBHOOK);
const arm = between(code, "case 'checkout.session.completed': {", '\n    case ', `${WEBHOOK} checkout.session.completed`);
const CALL = "if (session.mode === 'subscription') await restoreBuyerName(session, customerId);";

describe('the webhook puts our name back on every subscription Checkout (paths A, B, C)', () => {
  it('calls it once, in the subscription arm, after the setup arm and before both early-break arms', () => {
    assert.equal(code.split('await restoreBuyerName(').length - 1, 1, 'one call of restoreBuyerName, the one below');
    const at = arm.indexOf(CALL);
    assert.ok(at > 0, `the checkout.session.completed arm must say: ${CALL}`);
    const setupEnd = arm.indexOf('break;', arm.indexOf("if (session.mode === 'setup')"));
    assert.ok(setupEnd > 0 && at > setupEnd, 'after the setup arm (a card save has no name to put back)');
    for (const early of ['NEXT_SEASON_CHOICE_KIND', "checkoutKind === 'org_team_addon'", "checkoutKind === 'standalone_team'"]) {
      const e = arm.indexOf(early);
      assert.ok(e > 0, `the arm still reads ${early}`);
      assert.ok(at < e, `before the ${early} arm: it breaks early, so a call after it never runs`);
    }
  });

  it('reads the customer fresh, asks buyerNameAfterCheckout, and makes one update', () => {
    const body = functionBody(code, 'restoreBuyerName');
    assert.match(body, /await stripe\.customers\.retrieve\(customerId\)/);
    assert.match(body, /const naming = buyerNameAfterCheckout\(session, customer as Stripe\.Customer\);/);
    assert.match(body, /if \(naming\) await stripe\.customers\.update\(customerId, naming\);/);
    assert.equal(body.split('customers.update(').length - 1, 1, 'one update');
  });

  it('never throws, and a failure is told: a log line, a platform event and the owner, once per session', () => {
    const body = functionBody(code, 'restoreBuyerName');
    assert.match(body, /^function restoreBuyerName\([^)]*\) \{\s*try \{/, 'the whole body is inside the try');
    assert.doesNotMatch(body, /\bthrow\b/, 'nothing is rethrown: a 500 would make Stripe re-send the whole event');
    const caught = body.slice(body.indexOf('} catch (error) {'));
    assert.match(caught, /console\.error\(/);
    assert.match(caught, /eventType: 'buyer_name_not_restored'/);
    assert.match(caught, /const key = `\$\{session\.id\}:buyer_name_not_restored`;/);
    assert.match(caught, /alertOwner\('buyer_name_alert'/);
    assert.match(caught, /\} catch \(tellError\) \{/, 'telling cannot throw either');
  });
});

describe('every path stores OUR name on the customer before Checkout (without it the webhook has nothing to put back)', () => {
  it('A club and C next-season: ensureStripeCustomer is given the name, and stores it as ours', () => {
    assert.match(readCode('app/api/billing/create-checkout/route.ts'),
      /ensureStripeCustomer\(auth\.org, auth\.user\.email, billingLocation, inPlaceClubName \?\? auth\.org\.name\)/);
    assert.match(readCode('app/api/billing/choose-next-season/route.ts'),
      /ensureStripeCustomer\(auth\.org, auth\.user\.email, located\.location, buyer\.kind === 'org' \? auth\.org\.name : coachName\)/);
    const ensure = functionBody(readCode('lib/billing-setup.ts'), 'ensureStripeCustomer');
    assert.match(ensure, /\[BUYER_NAME_META\]: name/, 'a new customer is created with our name stored');
    assert.match(ensure, /buyerNameUpdate\(await retrieveLiveCustomer\(customerId\), name\)/, 'an existing one is named through buyerNameUpdate');
  });

  it('B coach Premium: a new customer stores it, one found again is named through buyerNameUpdate', () => {
    const team = readCode('app/api/billing/create-team-checkout/route.ts');
    assert.match(between(team, 'async create() {', 'report:', 'create-team-checkout create()'), /\[BUYER_NAME_META\]: buyerName/);
    assert.match(team, /if \(source !== 'created'\) await stampStripeCustomerAddress\(customerId, located\.location, buyerName\);/);
    assert.match(functionBody(readCode('lib/billing-location-server.ts'), 'stampStripeCustomerAddress'), /buyerNameUpdate\(customer as Stripe\.Customer, buyerName\)/);
  });
});

describe('R4 (owner 2026-11-05): Stripe’s page is unchanged', () => {
  it('keeps `customer_update.name: auto` (the GST/HST number field needs it) and asks for no name of its own', () => {
    assert.deepEqual(TAXED_CHECKOUT.customer_update, { name: 'auto' });
    const asks = [...filesUnder('app', '.ts'), ...filesUnder('lib', '.ts')]
      .filter(f => readSource(f).includes('name_collection') && /\bname_collection\b/.test(readCode(f)));
    assert.deepEqual(asks, [], 'no Checkout session sets name_collection (R4: the first invoice inside Checkout is accepted)');
  });
});
