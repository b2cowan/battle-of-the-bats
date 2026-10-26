import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { onlineFee, splitFeeAcross } from '../../lib/online-payment-fee.ts';
import { leaguePayPath, readLeaguePayToken, signLeaguePayToken } from '../../lib/league-pay-link.ts';
import { readTeamPayToken, signTeamPayToken } from '../../lib/team-pay-link.ts';
import { readCode } from './_source-code.ts';

/**
 * Club Tier Stage 12b, Part 2: a house-league family pays by card. The family's pay link (§0e c), siblings in ONE
 * checkout with the fee split per child (§0e a), and the pay route's own rules (re-read at paying, one open page per
 * sign-up, the children recorded with the payment, the switch read first).
 */

const SECRET = 'x'.repeat(40);
const REG = '0f8b3c1e-2d4a-4b6c-9e8f-1a2b3c4d5e6f';

describe('the family pay link (§0e c)', () => {
  it('names one registration, signed, and reads back only under the same secret', () => {
    const token = signLeaguePayToken(REG, SECRET);
    assert.equal(readLeaguePayToken(token, SECRET), REG);
    assert.equal(readLeaguePayToken(token, 'y'.repeat(40)), null);
    // A changed signature character (the 5th of the signature half: its bits are all real, never padding).
    const at = token.indexOf('.') + 5;
    assert.equal(readLeaguePayToken(token.slice(0, at) + (token[at] === 'A' ? 'B' : 'A') + token.slice(at + 1), SECRET), null);
    assert.equal(readLeaguePayToken('not-a-token', SECRET), null);
  });
  it('a team’s link never opens a family’s page, nor a family’s a team’s', () => {
    assert.equal(readLeaguePayToken(signTeamPayToken(REG, SECRET), SECRET), null);
    assert.equal(readTeamPayToken(signLeaguePayToken(REG, SECRET), SECRET), null);
  });
  it('opens the status page under the club’s own season address, never a top-level /pay', () => {
    assert.equal(leaguePayPath('dev-league', '2026-season', 'abc.def'), '/dev-league/league/2026-season/status/abc.def');
  });
});

describe('siblings in one checkout (§0e a)', () => {
  it('one fee on the whole owed total — one flat part, not one per child', () => {
    const two = onlineFee(30_000, 'family');
    const each = onlineFee(15_000, 'family');
    assert.ok(two.feeCents < each.feeCents * 2, 'paying together saves a flat part');
    assert.equal(two.totalCents, 30_000 + two.feeCents);
  });
  it('the fee splits in proportion to each child’s amount and always sums to the fee exactly', () => {
    for (const [fee, amounts] of [[1200, [15_000, 15_000]], [1001, [10_000, 5_000, 2_500]], [675, [15_000]], [3, [1, 1, 1, 1]]] as const) {
      const shares = splitFeeAcross(fee, amounts);
      assert.equal(shares.reduce((s, x) => s + x, 0), fee);
      assert.equal(shares.length, amounts.length);
      assert.ok(shares.every(x => x >= 0));
    }
    assert.deepEqual(splitFeeAcross(1200, [15_000, 15_000]), [600, 600]);
    assert.deepEqual(splitFeeAcross(1000, [20_000, 10_000]), [666, 334]);
  });
  it('the club pays the fee (A14): the family is charged the base alone', () => {
    const club = onlineFee(30_000, 'club');
    assert.equal(club.totalCents, 30_000);
    assert.equal(club.applicationFeeCents, club.feeCents);
  });
});

describe('the pay route (Part 2)', () => {
  const ROUTE = readCode('app/api/pay/league/[token]/route.ts');
  const STATUS = readCode('app/api/pay/league/[token]/status/route.ts');
  it('reads the switch first, then the link, then RE-READS what is owed at the moment of paying', () => {
    assert.ok(ROUTE.indexOf('onlinePaymentsOn()') < ROUTE.indexOf('registrationFromPayToken(token)'));
    assert.match(ROUTE, /const facts = await loadLeaguePayFacts\(regId\)/);
    // 12c: the fee and the split are the pressed rail's (a bank button whose account stopped taking bank debit reloads).
    assert.match(ROUTE, /const fee = rail === 'bank_debit' \? facts\.bankFee : facts\.fee;/);
    assert.match(ROUTE, /const shares = rail === 'bank_debit' \? facts\.bankShares : facts\.shares;/);
    assert.match(ROUTE, /if \(!fee \|\| fee\.totalCents !== shownTotalCents\) return NextResponse\.json\(\{ error: W\.error\.amountChanged, changed: true \}/);
  });
  it('one line per child and the processing fee its own line only while families pay it (A14)', () => {
    assert.match(ROUTE, /\.\.\.shares\.map\(s => \(\{ name: `\$\{s\.description\} · \$\{facts\.season\.name\}`, amountCents: s\.amountCents \}\)\)/);
    assert.match(ROUTE, /\.\.\.\(fee\.feePayer === 'family' \? \[\{ name: W\.receiptFee, amountCents: fee\.feeCents \}\] : \[\]\)/);
    assert.match(ROUTE, /applicationFeeCents: fee\.applicationFeeCents/);
  });
  it('Stripe first, then the payment and its children recorded together; a lost race closes its own page', () => {
    assert.ok(ROUTE.indexOf('createCheckout(') < ROUTE.indexOf("rpc('online_payment_league_open'"));
    assert.match(ROUTE, /p_rail: rail,\s*p_items: shares\.map\(/);
    assert.match(ROUTE, /if \(openError\) \{\s*await expireCheckout\(account\.stripeAccountId, session\.id\)/);
  });
  it('the status route answers from the RECORD and only for the sign-up the link opens', () => {
    assert.match(STATUS, /op\.flow !== 'league_signup' \|\| op\.season_id !== reg\.season_id \|\| op\.signup_key !== signupKey/);
    assert.match(STATUS, /landCheckoutSession\(op\.stripe_account_id as string, sessionId\)/);
  });
  it('only the pay route opens a house-league payment', () => {
    const doors = ['app/api/pay/league/[token]/route.ts'];
    for (const f of ['lib/online-payment-landing.ts', 'lib/league-pay-facts.ts', 'lib/league-pay-view.ts', 'app/api/pay/league/[token]/status/route.ts']) {
      assert.doesNotMatch(readCode(f), /online_payment_league_open/, f);
    }
    assert.equal(doors.length, 1);
  });
});
