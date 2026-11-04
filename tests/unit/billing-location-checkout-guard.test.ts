import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  BILLING_ADDRESS_FORM_WORDS as F, BILLING_ADDRESS_REQUIRED, BILLING_LOCATION_WORDS as W, US_DECLARATION_VERSION,
  storedLocationStillValid, type StoredBillingLocation,
} from '../../lib/billing-location.ts';

/**
 * GST/HST Stage 1 Part 2 (build prompt docs/projects/active/GST_HST_STAGE1_PART2_BUILD_PROMPT.md): no paid path reaches
 * Stripe without the buyer's billing address on file. Each of Part 0's paths A–E calls the ONE shared check
 * (`requireBillingLocation`, lib/billing-location-server.ts) before its first Stripe call — and before its dev-mock branch,
 * which is a purchase too, so the dev walk meets the window. The comped Founding branches charge nothing and come before it.
 *
 * (Part 4 adds the build-wide guard on any NEW `checkout.sessions.create`; this file pins the five known paths.)
 */

const at = (code: string, needle: string, file: string) => {
  const i = code.indexOf(needle);
  assert.ok(i >= 0, `${file}: expected to find ${needle}`);
  return i;
};

describe('every paid path checks the billing address before Stripe (paths A–E)', () => {
  it('A/B · club plan checkout, and a Premium portal becoming the club in place', () => {
    const file = 'app/api/billing/create-checkout/route.ts';
    const code = readCode(file);
    const check = at(code, 'requireBillingLocation(', file);
    assert.ok(check < at(code, 'stripe.checkout.sessions.create(', file), `${file}: the check must come before the Stripe checkout`);
    assert.ok(check < at(code, 'if (shouldApplyDirectly) {', file), `${file}: the check must come before the dev-mock purchase`);
    assert.ok(check < at(code, 'ensureStripeCustomer(', file), `${file}: the check must come before the Stripe customer is made`);
    // B: the club's address from "Start your club" is saved to the club's own row, then checked.
    assert.match(code, /requireBillingLocation\(buyer, inPlaceClubName \? billingAddressFromBody\(body\.billingAddress\)/, `${file}: the in-place club address is handed to the check, which saves it first`);
    assert.match(code, /ensureStripeCustomer\(auth\.org, auth\.user\.email, billingLocation\)/, `${file}: the customer carries the address`);
    // The comped Founding choice charges nothing and is never asked.
    assert.match(code, /if \(!isFoundingSeasonTournamentUpgrade\) \{[\s\S]*?requireBillingLocation\(/);
  });

  it('C · coach Premium new, reactivate and Keep Premium (the buyer is the PERSON)', () => {
    const file = 'app/api/billing/create-team-checkout/route.ts';
    const code = readCode(file);
    const check = at(code, "requireBillingLocation({ kind: 'user', userId: user.id })", file);
    assert.ok(at(code, 'provisionCompTeamWorkspaceFromCheckout(', file) < check, `${file}: the comped Founding path comes before the check`);
    assert.ok(check < at(code, 'if (shouldApplyDirectly) {', file), `${file}: the check must come before the dev-mock purchase`);
    assert.ok(check < at(code, 'stripe.checkout.sessions.create(', file), `${file}: the check must come before the Stripe checkout`);
    assert.match(code, /address: toStripeAddress\(located\.location\)/, `${file}: a new customer is made with the address`);
    assert.match(code, /stampStripeCustomerAddress\(customerId, located\.location\)/, `${file}: a found customer is given the address`);
  });

  it('D · the Founding next-season choice', () => {
    const file = 'app/api/billing/choose-next-season/route.ts';
    const code = readCode(file);
    const check = at(code, 'requireBillingLocation(billingBuyerOf(auth.org, auth.user))', file);
    assert.ok(check < at(code, 'recordNextSeasonChoice(', file), `${file}: the check must come before the dev-mock choice`);
    assert.ok(check < at(code, 'stripe.checkout.sessions.create(', file), `${file}: the check must come before the Stripe checkout`);
    assert.match(code, /ensureStripeCustomer\(auth\.org, auth\.user\.email, located\.location\)/);
  });

  it('E · a move UP on a live subscription (the safety net), saving the club address on Premium → Club', () => {
    const file = 'app/api/billing/move/route.ts';
    const code = readCode(file);
    const post = code.slice(at(code, 'export const POST', file), at(code, 'export const DELETE', file));
    const check = at(post, 'requireBillingLocation(', file);
    assert.ok(check < at(post, 'applyMove(', file), `${file}: the check must come before the move reaches Stripe`);
    assert.match(post, /if \(moveDirection\(ownPlanOf\(org\), toPlan\) === 'up'\) \{[\s\S]*?requireBillingLocation\(/, `${file}: only a move UP charges`);
    assert.match(post, /requireBillingLocation\(buyer, clubName \? billingAddressFromBody\(body\.billingAddress\)/, `${file}: the in-place club address is handed to the check, which saves it first`);
  });

  it('the check refuses with one stable code the screens open the window on', () => {
    const code = readCode('lib/billing-location-server.ts');
    assert.match(code, /code: BILLING_ADDRESS_REQUIRED/);
    assert.match(code, /status: 409/);
    assert.equal(BILLING_ADDRESS_REQUIRED, 'billing_address_required');
    // The client learns the US switch from the GET, never from its own env.
    assert.match(code, /process\.env\.US_SALES_OPEN === 'true'/);
    for (const file of ['components/billing/BillingAddressDialog.tsx', 'components/billing/BillingAddressFields.tsx', 'app/team/TeamSignupClient.tsx']) {
      assert.doesNotMatch(readCode(file), /US_SALES_OPEN/, `${file} must not read the US switch itself`);
    }
  });
});

describe('every caller of a paid route opens the window on the refusal, never an error', () => {
  const callers: Array<[string, RegExp]> = [
    ['components/billing/BillingBody.tsx', /isAddressRefusal\(data\)/],
    ['components/billing/PlanMoveDialog.tsx', /isAddressRefusal\(d\)/],
    ['lib/plan-upgrade.ts', /data\.code === BILLING_ADDRESS_REQUIRED/],
    ['components/billing/PlanPanelDrawer.tsx', /'addressRequired' in result/],
    ['app/[orgSlug]/admin/onboarding/page.tsx', /isAddressRefusal\(data\)/],
    ['app/team/TeamSignupClient.tsx', /isAddressRefusal\(payload\)/],
  ];
  for (const [file, pattern] of callers) {
    it(file, () => assert.match(readCode(file), pattern));
  }

  it('the monthly-or-yearly question opens only after the address step (window → question → Stripe)', () => {
    const code = readCode('components/billing/BillingBody.tsx');
    assert.match(code, /askFirst\(change\.target as OrgPlan, \(\) => setPayFor\(change\.target as OrgPlan\)\)/);
    assert.match(code, /billedTo=\{address\.location \? formatBilledTo\(address\.location\) : null\}/);
  });

  it('a US hold removes the main button (absent, not greyed) and says why in amber', () => {
    const dialog = readCode('components/billing/BillingAddressDialog.tsx');
    assert.match(dialog, /\{!form\.usClosed && \(/);
    assert.match(dialog, /BILLING_LOCATION_WORDS\.usClosed/);
    assert.doesNotMatch(dialog, /disabled=\{[^}]*usClosed/);
  });

  it('the province and state lists are native selects (a phone opens its own picker, drawing Ask 5)', () => {
    const fields = readCode('components/billing/BillingAddressFields.tsx');
    assert.equal((fields.match(/<select /g) ?? []).length, 2);
  });
});

describe('storedLocationStillValid', () => {
  const ca: StoredBillingLocation = {
    country: 'CA', regionCode: 'ON', line1: '120 Elm Street', line2: null, city: 'Guelph', postalCode: 'N1H 4H2',
    confirmedAt: '2026-11-03T12:00:00Z', usDeclarationAt: null, usDeclarationVersion: null,
  };
  const us: StoredBillingLocation = {
    country: 'US', regionCode: 'NY', line1: '88 Delaware Avenue', line2: 'Suite 400', city: 'Buffalo', postalCode: '14202',
    confirmedAt: '2026-11-03T12:00:00Z', usDeclarationAt: '2026-11-03T12:00:00Z', usDeclarationVersion: US_DECLARATION_VERSION,
  };

  it('a Canadian address on file is valid whether or not US sales are open', () => {
    assert.equal(storedLocationStillValid(ca, false)?.postalCode, 'N1H 4H2');
    assert.equal(storedLocationStillValid(ca, true)?.city, 'Guelph');
  });
  it('a US address stops counting while US sales are closed', () => {
    assert.equal(storedLocationStillValid(us, false), null);
    assert.equal(storedLocationStillValid(us, true)?.regionCode, 'NY');
  });
  it('a US address without its declaration never counts', () => {
    assert.equal(storedLocationStillValid({ ...us, usDeclarationAt: null, usDeclarationVersion: null }, true), null);
  });
});

describe('the words', () => {
  it('reads as drawn', () => {
    assert.equal(F.billedTo('120 Elm Street, Guelph, Ontario'), 'Billed to 120 Elm Street, Guelph, Ontario');
    assert.equal(F.onFile('120 Elm Street, Guelph, Ontario N1H 4H2'), 'Billing address: 120 Elm Street, Guelph, Ontario N1H 4H2');
    assert.equal(W.saveFailed, 'We couldn’t save your address. Try again.');
    assert.equal(F.title, 'Billing address');
    assert.equal(F.personTitle, 'Your home address');
  });
});
