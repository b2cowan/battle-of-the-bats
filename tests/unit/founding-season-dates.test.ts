import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FOUNDING_SEASON_SIGNUP_CLOSE,
  FOUNDING_SEASON_END,
  FOUNDING_SEASON_CARD_WINDOW_OPEN,
  FOUNDING_SEASON_SIGNUP_CLOSE_LABEL,
  FOUNDING_SEASON_END_LABEL,
  FOUNDING_SEASON_FIRST_CHARGE_LABEL,
  FOUNDING_SEASON_YEAR_LABEL,
  FOUNDING_SEASON_NEXT_YEAR_LABEL,
  FOUNDING_SEASON_DECISION_MONTH_LABEL,
  FOUNDING_SEASON_AFTER_LINE,
  foundingSeasonOfferLine,
  foundingSeasonOfferCore,
  isFoundingSeasonCompExpiry,
  isFoundingSeasonCurrentExpiry,
  FOUNDING_SEASON_LEGACY_END,
  FOUNDING_SEASON_COMP_EXPIRIES,
} from '../../lib/plan-config.ts';

/**
 * The Founding Season has TWO dates (BUSINESS_DECISIONS 2026-09-07) and every customer sentence is
 * derived from them. These tests pin the derivation so the wording can never drift from the date it
 * describes — the failure mode that produced two dozen hand-typed "Jan 1, 2027"s the first time.
 */
describe('Founding Season dates and labels', () => {
  it('the signup window closes BEFORE the free period ends, and the card window sits between them', () => {
    const close = new Date(FOUNDING_SEASON_SIGNUP_CLOSE).getTime();
    const end = new Date(FOUNDING_SEASON_END).getTime();
    const card = new Date(FOUNDING_SEASON_CARD_WINDOW_OPEN).getTime();
    assert.ok(close < end, 'signup close must precede the free-period end');
    assert.ok(card > close && card < end, 'the card window opens after the signup close and before the end');
  });

  it('the ratified dates: sign up by December 31, 2026; free through September 30, 2027', () => {
    assert.equal(FOUNDING_SEASON_SIGNUP_CLOSE_LABEL, 'December 31, 2026');
    assert.equal(FOUNDING_SEASON_END_LABEL, 'September 30, 2027');
    assert.equal(FOUNDING_SEASON_FIRST_CHARGE_LABEL, 'October 1, 2027');
    assert.equal(FOUNDING_SEASON_YEAR_LABEL, '2027');
    assert.equal(FOUNDING_SEASON_NEXT_YEAR_LABEL, '2028');
    assert.equal(FOUNDING_SEASON_DECISION_MONTH_LABEL, 'September 2027');
  });

  it('the instants are pinned to the END of the named day in Eastern time, not to UTC midnight', () => {
    // 2026-12-31 23:59:59 EST = 2027-01-01T05:00Z; 2027-09-30 23:59:59 EDT = 2027-10-01T04:00Z.
    assert.equal(FOUNDING_SEASON_SIGNUP_CLOSE, '2027-01-01T05:00:00.000Z');
    assert.equal(FOUNDING_SEASON_END, '2027-10-01T04:00:00.000Z');
  });

  it('dates are written in full — no abbreviated months anywhere a customer reads them', () => {
    const full = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}$/;
    for (const label of [FOUNDING_SEASON_SIGNUP_CLOSE_LABEL, FOUNDING_SEASON_END_LABEL, FOUNDING_SEASON_FIRST_CHARGE_LABEL]) {
      assert.match(label, full);
    }
  });

  it('the offer line is the copy canon sentence, verbatim, in all three forms', () => {
    assert.equal(
      foundingSeasonOfferLine(),
      'Tournament Plus and the Premium Coaches Portal are free through September 30, 2027 when you sign up by December 31, 2026. No credit card.',
    );
    assert.equal(
      foundingSeasonOfferLine('tournament_plus'),
      'Tournament Plus is free through September 30, 2027 when you sign up by December 31, 2026. No credit card.',
    );
    assert.equal(
      foundingSeasonOfferLine('team'),
      'The Premium Coaches Portal is free through September 30, 2027 when you sign up by December 31, 2026. No credit card.',
    );
    assert.equal(
      foundingSeasonOfferCore('tournament_plus'),
      'Tournament Plus is free through September 30, 2027 when you sign up by December 31, 2026',
    );
  });

  it('the after line names the decision month and the next season', () => {
    assert.equal(
      FOUNDING_SEASON_AFTER_LINE,
      "In September 2027 you'll choose a plan for your 2028 season. Nothing is charged before then, and there is nothing to cancel.",
    );
  });

  it('a comp row written under the END instant is recognised as a Founding Season comp — in Postgres formatting too', () => {
    assert.equal(isFoundingSeasonCompExpiry(FOUNDING_SEASON_END), true);
    assert.equal(isFoundingSeasonCompExpiry('2027-10-01 04:00:00+00'), true);
    assert.equal(isFoundingSeasonCurrentExpiry(FOUNDING_SEASON_END), true);
  });

  it('a comp row still carrying the LEGACY instant is recognised too, but is not "current" — so it gets healed, never duplicated', () => {
    // Migration 279 moves those rows, but it is data-only and unprovable on prod; recognition must
    // not depend on it (/review 2026-09-07).
    assert.equal(FOUNDING_SEASON_LEGACY_END, '2027-01-01T00:00:00.000Z');
    assert.deepEqual([...FOUNDING_SEASON_COMP_EXPIRIES], [FOUNDING_SEASON_END, FOUNDING_SEASON_LEGACY_END]);
    assert.equal(isFoundingSeasonCompExpiry(FOUNDING_SEASON_LEGACY_END), true);
    assert.equal(isFoundingSeasonCompExpiry('2027-01-01 00:00:00+00'), true);
    assert.equal(isFoundingSeasonCurrentExpiry(FOUNDING_SEASON_LEGACY_END), false);
    // An unrelated instant is neither.
    assert.equal(isFoundingSeasonCompExpiry('2026-12-31 05:00:00+00'), false);
  });
});
