/**
 * Pay now on the coach's Registration card — the invariants that keep it safe.
 *
 * The button is a signed, never-expiring link to the team's public pay page, which can take a payment and lists its
 * receipts. So it is handed out like a credential:
 *  1. only to an entry the card shows as OWING (the same condition the card's own `owed` block uses);
 *  2. never to a money-off assistant, a tournament that doesn't track payments, or the club's own team;
 *  3. in the paid portal, only to a coach who can WRITE team money — read-only money sees the fee, not the link;
 *  4. a failed read of the pay facts is the manual wording, never a dead button or a broken page.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const record = read('components', 'coaches', 'CoachTournamentRecord.tsx');
const card = read('components', 'coaches', 'TournamentRegistrationCard.tsx');
const paidPage = read('app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'tournaments', '[registrationId]', 'page.tsx');

describe('Pay now is handed out like a credential', () => {
  const block = record.slice(record.indexOf('let payOnline'), record.indexOf('const coachPhase'));

  it('the pay facts are read only for an owing entry, behind every money gate', () => {
    assert.ok(block.length > 0, 'the Pay now block exists');
    const gate = /if \(([^)]*)\) \{\s*try \{/.exec(block)?.[1] ?? '';
    for (const part of ['canPayOnline', 'coachStatus', 'fee.hasSchedule', '!coachStatus.fee.isPaid', '!feeHidden', '!clubOwnTeam']) {
      assert.ok(gate.includes(part), `the gate keeps ${part}`);
    }
  });

  it('a link exists only when the pay page would take the payment, and a bank debit on its way is said, not offered', () => {
    assert.match(block, /refusal === 'clearing'/);
    assert.match(block, /facts\.refusal === null/);
    assert.match(block, /teamPayUrl\(/);
  });

  it('a failed read falls back to the manual wording and leaves a log line', () => {
    assert.match(block, /catch \(e\)/);
    assert.match(block, /console\.error\(/);
    assert.match(block, /payOnline = null/);
  });

  it('the paid portal passes the WRITE side of team money, not the read side', () => {
    assert.match(paidPage, /canPayOnline=\{canWriteMoney\(assignment\.capabilities\)\}/);
  });
});

describe('the Registration card never claims a manual process while Pay now is offered', () => {
  it('"records payment manually" lives only in the branch with no online payment', () => {
    const ready = card.indexOf("payOnline?.state === 'ready'");
    const clearing = card.indexOf("payOnline?.state === 'clearing'");
    const manual = card.indexOf('Your organizer records payment manually');
    assert.ok(ready > -1 && clearing > ready && manual > clearing, 'the manual line comes after both online branches');
  });

  it('the button is a plain link to the pay page, with no payment logic in the card', () => {
    assert.match(card, /<a className=\{`btn btn-primary \$\{styles\.payButton\}`\} href=\{payOnline\.href\}>Pay now<\/a>/);
    assert.doesNotMatch(card, /loadTeamPayFacts|supabase/);
  });

  it('the organizer\'s own how-to-pay text keeps its line breaks beside the button', () => {
    assert.match(card, /<p className=\{styles\.payInstructions\}>\{paymentInstructions\}<\/p>/);
  });
});
