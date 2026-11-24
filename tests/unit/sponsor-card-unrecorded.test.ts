import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * A SPONSOR'S CARD PAYMENT THAT WAS TAKEN BUT NOT RECORDED (owner walk 2026-11-24). Stripe had the money, the deal did not, the
 * page went back to the plain form, and the business paid a second time. Every door that could take or bill money again asks
 * `unrecordedCardPayment` first, and the status poll never answers "paid" on Stripe's word alone.
 */
describe('a sponsor card payment taken and not recorded', () => {
  it('every door that could charge or invoice again asks first', () => {
    assert.match(readCode('lib/sponsor-card-server.ts'), /if \(await unrecordedCardPayment\(p\.orgId, p\.dealId\)\)/);
    assert.match(readCode('app/api/public/sponsorship/[token]/route.ts'), /if \(await unrecordedCardPayment\(org\.id, deal\.id\)\)/);
    assert.match(readCode('app/api/admin/sponsorships/deals/[dealId]/send-invoice/route.ts'), /if \(await unrecordedCardPayment\(org\.id, dealId\)\)/);
  });

  it('the public form POST asks BEFORE it issues an invoice', () => {
    const code = readCode('app/api/public/sponsorship/[token]/route.ts');
    assert.ok(code.indexOf('unrecordedCardPayment(org.id, deal.id)') < code.indexOf("rpc('club_sponsor_deal_receive'"), 'the guard must come before the invoice is issued');
  });

  it('the status poll answers "paid" only for a payment that landed, and lands one that did not', () => {
    const code = readCode('app/api/public/sponsorship/[token]/pay/route.ts');
    assert.match(code, /op\.status === 'paid' && op\.landed_at/);
    assert.match(code, /if \(op\.status === 'paid'\) \{\s*[\s\S]*?landCheckoutSession/);
  });

  it('the page and the club both say so, and a received payment hides the card button', () => {
    assert.match(readCode('lib/sponsor-deal-view.ts'), /card: facts && !received/);
    assert.match(readCode('components/public/SponsorDealContent.tsx'), /view\.received/);
    assert.match(readCode('components/admin/kit/club/sponsorships/DealScreen.tsx'), /r\.unrecordedCard/);
  });
});
