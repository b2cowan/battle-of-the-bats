import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { LEAVING_WORDS } from '../../lib/online-payment-words.ts';

/**
 * CLUB TIER STAGE 12d-2 PART 3: LEAVING ONLINE PAYMENTS (frame 4, words §4; asks 4 and 11; owner ruling 2, 2026-10-27).
 * The one rule: no ending disconnects the Stripe account; every ending closes open pay pages and counts them; debits
 * clearing, refunds and disputes still finish; webhooks land whatever the plan.
 */
const ENDINGS = 'lib/online-payment-endings.ts';

describe('the one count every ending reads', () => {
  it('counts house-league families as well as tournament teams (the Disconnect correction)', () => {
    const src = readCode(ENDINGS);
    assert.match(src, /async function familiesOwing\(orgId: string\)/);
    assert.match(src, /async function teamsOwing\(orgId: string\)/);
    // A child on a clearing debit owes nothing new; families, not children.
    assert.match(src, /eq\('online_payments\.status', 'clearing'\)/);
    assert.match(src, /new Set\(owing\.filter/);
  });
  it('counts open pages, clearing debits, open disputes and every unpaid Stripe fee, and a failed read throws', () => {
    const src = readCode(ENDINGS);
    for (const k of ['countClubPayPages(orgId)', "eq('status', 'clearing')", 'OPEN_DISPUTE_STATUSES', "from('platform_fee_invoices')", "not('bill_error', 'is', null)"]) {
      assert.ok(src.includes(k), k);
    }
    assert.match(src, /if \(error\) throw error;/);
  });
});

describe('the words (§4)', () => {
  const D = LEAVING_WORDS.disconnect;
  it('Disconnect counts families and teams, joined, and says nobody when none', () => {
    assert.equal(D.owing(23, 2), '23 families still owe a house-league fee, and 2 teams still owe a tournament fee. They can pay you another way.');
    assert.equal(D.owing(1, 0), '1 family still owes a house-league fee. They can pay you another way.');
    assert.equal(D.owing(0, 0), 'Nobody owes anything right now.');
    assert.equal(D.pages(1), '1 pay page is open right now. It closes when you disconnect.');
    assert.match(D.disputes(1, 'Nov 3'), /Answer it in Stripe by Nov 3;/);
  });
  it('the move and the cancel say what is owed today; the delete waits for disputes and debits', () => {
    assert.equal(LEAVING_WORDS.oweToday(23, 2), '23 families and 2 teams still owe today.');
    assert.equal(LEAVING_WORDS.oweToday(0, 1), '1 team still owes today.');
    assert.equal(LEAVING_WORDS.oweToday(0, 0), '');
    assert.equal(LEAVING_WORDS.delete.waiting(1, 2), '1 card dispute is open and 2 bank debits are still clearing. We wait for them before deleting.');
    assert.equal(LEAVING_WORDS.delete.waiting(0, 0), null);
    assert.match(LEAVING_WORDS.cancel.stripe(0), /Refunds are handled in Stripe while you’re suspended\.$/);
  });
});

describe('every ending closes the open pages (ask 11)', () => {
  it('Disconnect closes the club’s pages after it stamps the disconnect', () => {
    const src = readCode('app/api/admin/payouts/route.ts');
    assert.match(src, /case 'disconnect': \{[\s\S]*?closeClubPayPages\(ctx\.org\.id, 'disconnect'\)/);
  });
  it('closing never throws, and a bank debit already submitted is no open page', () => {
    const src = readCode('lib/online-pay-pages.ts');
    assert.match(src, /export async function closeClubPayPages\(orgId: string, where: string\): Promise<number> \{\s*try \{/);
    assert.match(src, /eq\('org_id', orgId\)\.eq\('status', 'open'\)/);
  });
});

describe('the operator’s Delete refuses money in flight (owner ruling 2)', () => {
  const src = readCode('app/api/platform-admin/orgs/[id]/delete/route.ts');
  it('refuses while a dispute is open, a debit clears or a Stripe fee is unbilled, failed or unpaid, and when it can’t count', () => {
    assert.match(src, /const outstanding = await readOutstanding\(id\)\.catch\(\(\) => null\);\s*if \(!outstanding\) \{/);
    assert.match(src, /if \(inFlight\.length\) \{\s*return NextResponse\.json\(\{ error: inFlightRefusal\(inFlight\), inFlight \}, \{ status: 409 \}\);/);
    const ends = readCode(ENDINGS);
    for (const k of ['disputes', 'clearing', 'fees_unbilled', 'fees_failed', 'invoices_unpaid']) assert.ok(ends.includes(`kind: '${k}'`), k);
  });
  it('closes the club’s open pages before the delete', () => {
    const close = src.indexOf("closeClubPayPages(id, 'operator delete')");
    assert.ok(close > 0 && close < src.indexOf(".delete().eq('org_id', id)"), 'the pages close before the first delete');
  });
});

describe('webhooks land whatever the plan; notices keep arriving (ask 4)', () => {
  it('the Connect webhook reads no plan gate', () => {
    assert.doesNotMatch(readCode('app/api/payments/connect-webhook/route.ts'), /hasPlanFeature|requiredFeature/);
  });
  it('the online-payment items are raised without the plan guard', () => {
    const src = readCode('lib/online-payment-landing.ts');
    const raise = /async function raiseOnce[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.ok(raise.includes('await notify('));
    assert.doesNotMatch(raise, /requiredFeature/);
  });
});

describe('every ending, against each kind of money in flight', () => {
  const ENDS: [string, string, RegExp][] = [
    ['Disconnect', 'app/api/admin/payouts/route.ts', /closeClubPayPages\(ctx\.org\.id, 'disconnect'\)/],
    ['a plan move on its date (the webhook’s flip, the operator’s change, an in-app move)', 'lib/plan-move.ts', /closePagesIfPaymentsEnded\(p\.orgId, `plan move/],
    ['the owner’s downgrade (it takes effect now)', 'app/api/billing/downgrade/confirm/route.ts', /closePagesIfPaymentsEnded\(ctx\.org\.id, 'owner downgrade'\)/],
    ['the owner’s cancel', 'app/api/billing/cancel/confirm/route.ts', /closePagesIfPaymentsEnded\(ctx\.org\.id, 'owner cancel', \{ ended: true \}\)/],
    ['the operator’s cancel', 'app/api/platform-admin/orgs/[id]/cancel-subscription/route.ts', /closePagesIfPaymentsEnded\(id, 'operator cancel', \{ ended: true \}\)/],
    ['a suspension by Stripe', 'app/api/billing/webhook/route.ts', /closePagesIfPaymentsEnded\(org\.id, 'stripe suspension', \{ ended: true \}\)/],
    ['the operator’s delete', 'app/api/platform-admin/orgs/[id]/delete/route.ts', /closeClubPayPages\(id, 'operator delete'\)/],
  ];
  for (const [name, file, pattern] of ENDS) {
    it(`an open page: ${name} closes it`, () => assert.match(readCode(file), pattern));
  }
  it('a clearing debit: no ending touches it (only `open` pages close; a submitted debit is complete at Stripe)', () => {
    const pages = readCode('lib/online-pay-pages.ts');
    assert.match(pages, /async function clubRows\(orgId: string\)[\s\S]*?\.eq\('status', 'open'\)/);
    assert.doesNotMatch(readCode(ENDINGS), /update\(\{ status:/);
  });
  it('a clearing debit lands, a refund and a dispute land: the Connect webhook reads no plan and no disconnect', () => {
    const hook = readCode('app/api/payments/connect-webhook/route.ts');
    assert.doesNotMatch(hook, /hasPlanFeature|disconnected_at|planId/);
  });
  it('an open dispute: its item reaches the owner after a downgrade, and its emails read no plan', () => {
    const landing = readCode('lib/online-payment-landing.ts');
    assert.doesNotMatch(landing, /requiredFeature: 'online_payments'/);
    assert.doesNotMatch(landing, /hasPlanFeature/);
  });
  it('a pending refund: the refund doors read the launch switch, never the plan', () => {
    const payments = readCode('app/api/admin/tournaments/[tournamentId]/registrations/payments/route.ts');
    assert.match(payments, /refunds: onlinePaymentsOn\(\) && !!facts\?\.account && !facts\.account\.disconnectedAt/);
    const online = readCode('app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts');
    assert.match(online, /if \(!onlinePaymentsOn\(\)\) return json\(\{ error: ONLINE_PAYMENTS_OFF_ERROR \}, 404\);/);
    assert.doesNotMatch(online, /hasPlanFeature/);
  });
  it('a clearing debit’s answer at the end of a registration reads the connection, never the plan', () => {
    assert.match(readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts'), /await clubPayoutsConnected\(ctx!\.org\.id\)/);
    assert.match(readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx'), /payoutsOn=\{!!read\?\.payoutsOn\}/);
  });
});

describe('the wind-down (ask 4): Pay now stops, nothing else', () => {
  it('both pay facts check the plan LAST, so a clearing debit and receipts still show', () => {
    for (const f of ['lib/team-pay-facts.ts', 'lib/league-pay-facts.ts']) {
      const src = readCode(f);
      assert.match(src, /if \(!onlinePaymentsOn\(\)\) refusal = 'switch_off';/, f);
      assert.match(src, /if \(refusal === null && !hasPlanFeature\(org\.planId, 'online_payments'\)\) refusal = 'switch_off';/, f);
    }
  });
  it('the Payouts card stays for a connected club on a plan without online payments; only setting up needs the plan', () => {
    const route = readCode('app/api/admin/payouts/route.ts');
    assert.match(route, /if \(!onlinePaymentsOn\(\)\) return refused\(\);/);
    assert.match(route, /case 'connect': \{\s*if \(!c\.planOffers\) return refused\(\);/);
    assert.match(route, /windDown: !c\.planOffers,/);
    const card = readCode('components/admin/kit/club/PayoutsCard.tsx');
    assert.match(card, /const wind = !!view\.windDown && state !== 'disconnected' && state !== 'not_set_up';/);
  });
  it('Stripe’s return from sign-up is not plan-gated (a needs-attention fix-up after a downgrade comes back)', () => {
    assert.doesNotMatch(readCode('app/api/admin/payouts/return/route.ts'), /hasPlanFeature/);
  });
});
