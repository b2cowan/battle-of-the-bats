/**
 * THE TEAM PAY PAGE SHOWS THE COACH'S ADDRESS MASKED (Signed-in family accounts Stage 2, Part 6; ask 5 = A, after walk
 * §440 passed). The team pay link stays a sent link, so a forwarded one must not hand the full address to the browser:
 * the view masks it on the server, the receipt field sends nothing while it still holds the mask, and the pay route
 * refuses a masked address and uses the one on file. The league page's rule (league-signup-link.test.ts, Part 5b).
 * No reset: the team gets no "Send a new link" (ruled).
 *
 * Source guards (the view is server-only and the route needs Stripe); the mask itself is pinned by behaviour below.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMaskedEmail, maskEmail } from '../../lib/utils.ts';
import { readCode } from './_source-code.ts';

const VIEW = readCode('lib/team-pay-view.ts');
const PAGE = readCode('components/public/TeamPayContent.tsx');
const ROUTE = readCode('app/api/pay/team/[token]/route.ts');

describe('the team pay page masks the coach’s address', () => {
  it('the view never carries the full address', () => {
    assert.match(VIEW, /payerEmail: f\.teamEmail \? maskEmail\(f\.teamEmail\) : null,/);
    assert.doesNotMatch(VIEW, /payerEmail: f\.teamEmail,/);
    assert.equal([...VIEW.matchAll(/teamEmail/g)].length, 2, 'read once, to mask it');
  });

  it('the mask is text to read, never an address to send to', () => {
    const shown = maskEmail('sam.rivera@example.com');
    assert.equal(shown, 's•••@example.com');
    assert.ok(isMaskedEmail(shown));
    assert.ok(!isMaskedEmail('sam.rivera@example.com'));
  });

  it('the receipt field sends nothing while it still holds the masked value; a typed address is sent', () => {
    assert.match(PAGE, /useState\(view\.payerEmail \?\? ''\)/);
    assert.match(PAGE, /openCheckout\(`\/api\/pay\/team\/\$\{token\}`, \{ scope: chosen\.scope, rail, totalCents, email: email === view\.payerEmail \? '' : email \}\)/);
  });

  it('the route refuses a masked address and falls back to the one on file, at Stripe and on the payment row', () => {
    assert.match(ROUTE, /const email = typeof body\.email === 'string' && !isMaskedEmail\(body\.email\) && \/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\/\.test\(body\.email\.trim\(\)\) \? body\.email\.trim\(\) : null;/);
    assert.match(ROUTE, /payerEmail: email \?\? facts\.teamEmail,/);
    assert.match(ROUTE, /payer_email: email \?\? facts\.teamEmail,/);
  });

  it('no reset for a team (ruled): the page offers no new link', () => {
    assert.doesNotMatch(PAGE, /Send a new link/);
  });
});
