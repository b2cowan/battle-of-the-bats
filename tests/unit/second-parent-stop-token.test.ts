import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import * as T from '../../lib/unsubscribe-token.ts';

/**
 * Signed-in family accounts Stage 3b Part 2 (build prompt SIGNED_IN_FAMILY_STAGE3B_BUILD_PROMPT.md): the fourth token
 * family, the "Stop these emails" link on a second parent's copy. Keyed on (org, normalised address) with its own HMAC
 * suffix (`:stop-second-parent`), so it is non-interchangeable with the org, user and guardian families.
 */

const ORG = '11111111-1111-1111-1111-111111111111';
const OTHER_ORG = '22222222-2222-2222-2222-222222222222';
let had: string | undefined;

beforeEach(() => {
  had = process.env.UNSUBSCRIBE_SECRET;
  process.env.UNSUBSCRIBE_SECRET = 'a-test-secret-of-some-length';
});
afterEach(() => {
  if (had === undefined) delete process.env.UNSUBSCRIBE_SECRET; else process.env.UNSUBSCRIBE_SECRET = had;
});

describe('the second-parent stop token', () => {
  it('round-trips for the same org and address', () => {
    const token = T.generateSecondParentStopToken(ORG, 'dev@example.com')!;
    assert.match(token, /^[0-9a-f]{32}$/);
    assert.equal(T.verifySecondParentStopToken(ORG, 'dev@example.com', token), true);
  });

  it('is refused for another org or another address', () => {
    const token = T.generateSecondParentStopToken(ORG, 'dev@example.com')!;
    assert.equal(T.verifySecondParentStopToken(OTHER_ORG, 'dev@example.com', token), false, 'wrong org');
    assert.equal(T.verifySecondParentStopToken(ORG, 'gran@example.com', token), false, 'wrong address');
  });

  it('ignores capitals and surrounding spaces in the address, so a typed variant cannot mint a different link', () => {
    const token = T.generateSecondParentStopToken(ORG, 'dev@example.com')!;
    assert.equal(T.generateSecondParentStopToken(ORG, '  Dev@Example.COM '), token);
    assert.equal(T.verifySecondParentStopToken(ORG, 'DEV@example.com ', token), true);
  });

  it('refuses a tampered, empty or wrong-length token', () => {
    const token = T.generateSecondParentStopToken(ORG, 'dev@example.com')!;
    const flipped = (token[0] === 'a' ? 'b' : 'a') + token.slice(1);
    assert.equal(T.verifySecondParentStopToken(ORG, 'dev@example.com', flipped), false);
    assert.equal(T.verifySecondParentStopToken(ORG, 'dev@example.com', ''), false);
    assert.equal(T.verifySecondParentStopToken(ORG, 'dev@example.com', token.slice(1)), false);
    assert.equal(T.verifySecondParentStopToken('', 'dev@example.com', token), false);
    assert.equal(T.verifySecondParentStopToken(ORG, '', token), false);
  });

  it('never crosses with the org, user or guardian families, in either direction', () => {
    const stop = T.generateSecondParentStopToken(ORG, 'dev@example.com')!;
    const guardian = T.generateGuardianUnsubscribeToken(ORG, 'dev@example.com')!;
    const org = T.generateUnsubscribeToken(ORG)!;
    const user = T.generateUserUnsubscribeToken(ORG)!;
    assert.notEqual(stop, guardian);
    // Their tokens do not stop an address…
    assert.equal(T.verifySecondParentStopToken(ORG, 'dev@example.com', guardian), false);
    assert.equal(T.verifySecondParentStopToken(ORG, 'dev@example.com', org), false);
    assert.equal(T.verifySecondParentStopToken(ORG, 'dev@example.com', user), false);
    // …and this token opts nobody out of anything.
    assert.equal(T.verifyGuardianUnsubscribeToken(ORG, 'dev@example.com', stop), false);
    assert.equal(T.verifyUnsubscribeToken(ORG, stop), false);
    assert.equal(T.verifyUserUnsubscribeToken(ORG, stop), false);
  });

  it('is null without the secret: no link is drawn and every token is refused', () => {
    const token = T.generateSecondParentStopToken(ORG, 'dev@example.com')!;
    delete process.env.UNSUBSCRIBE_SECRET;
    assert.equal(T.generateSecondParentStopToken(ORG, 'dev@example.com'), null);
    assert.equal(T.buildSecondParentStopUrl(ORG, 'dev@example.com'), null);
    assert.equal(T.verifySecondParentStopToken(ORG, 'dev@example.com', token), false);
  });
});

describe('the second-parent stop link', () => {
  it('points at the confirm page (never at a route that writes on GET) and carries a token that verifies', () => {
    const url = new URL(T.buildSecondParentStopUrl(ORG, ' Dev@Example.com ')!);
    assert.equal(url.pathname, '/second-parent-stop');
    assert.equal(url.searchParams.get('org'), ORG);
    assert.equal(url.searchParams.get('email'), 'dev@example.com');
    assert.equal(T.verifySecondParentStopToken(ORG, url.searchParams.get('email')!, url.searchParams.get('token')!), true);
  });
});
