/**
 * "Last season's team" — WHAT MAY PRE-FILL IT (mig 265, owner-approved 2026-08-26).
 *
 * The field is stored as the FAMILY'S CLAIM about their own history, and the coach's Add player
 * form captions a pre-filled value "Filled from last season". So the bar for writing into it
 * automatically is not "we probably know this person" — it is "we can state this".
 *
 * `priorRosterSeasonForFill` is that bar. Both halves are guarded below, because each fails
 * differently and neither throws:
 *
 *   · Drop the ROSTER condition and the form tells a coach that a child they CUT last season played
 *     for the team — and files it as something the family said.
 *   · Drop the NAME condition and TWINS pre-fill each other.
 *
 * ⚠⚠ THE TWIN CASE IS THE REASON THIS FILE EXISTS, and it caught the first version of the rule.
 * That version filtered on `confidence === 'high'`, which reads like the careful choice and is
 * exactly wrong: `high` is `exact DOB + (email OR strong name)`, so two siblings who share a
 * birthday and a family email address reach it with completely different first names. The name is
 * what tells two children of one family apart, so the name is what the rule asks about. Every case
 * below runs through the REAL `matchPriorIdentities`, so this stays true of the matcher rather than
 * of a hand-built fixture.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  matchPriorIdentities, priorRosterSeasonForFill, type ContinuityIdentity,
} from '../../lib/continuity-match.ts';

const PRIOR_YEAR = 'py-2025';

/** The child standing in front of the coach, as the Add player form has them so far. */
function typed(over: Partial<ContinuityIdentity> = {}): ContinuityIdentity {
  return {
    kind: 'registration', id: '', programYearId: 'py-2026',
    firstName: 'Tessa', lastName: 'Nakagawa',
    dateOfBirth: '2015-04-11', guardianEmail: 'nakagawa@example.com',
    ...over,
  };
}

/** Someone the team already has on file from a past season. */
function prior(over: Partial<ContinuityIdentity> = {}): ContinuityIdentity {
  return {
    kind: 'roster', id: 'prior-1', programYearId: PRIOR_YEAR,
    firstName: 'Tessa', lastName: 'Nakagawa',
    dateOfBirth: '2015-04-11', guardianEmail: 'nakagawa@example.com',
    ...over,
  };
}

const fillFor = (current: ContinuityIdentity, pool: ContinuityIdentity[]) =>
  priorRosterSeasonForFill(current, matchPriorIdentities(current, pool));

describe('last season\'s team — what may pre-fill it', () => {
  it('fills from a player who was ON THE ROSTER last season', () => {
    const match = fillFor(typed(), [prior()]);
    assert.ok(match, 'a rostered player whose full name matches is the case the pre-fill exists for');
    assert.equal(match.prior.programYearId, PRIOR_YEAR);
  });

  it('refuses a player who only TRIED OUT last season and did not make it', () => {
    // Identical human, identical evidence — the ONE difference is that they were never rostered.
    const pool = [prior({ kind: 'registration' })];
    assert.ok(matchPriorIdentities(typed(), pool).length > 0,
      'guard integrity: the matcher must still RECOGNISE this person, or the next assertion passes '
      + 'for the wrong reason — it would prove the matcher found nothing, not that the fill rule '
      + 'refused something it was offered');
    assert.equal(fillFor(typed(), pool), null,
      'a child who was cut did not play for this team; saying so would be a false sentence the '
      + 'record then attributes to their family');
  });

  it('refuses a TWIN — same birthday, same family email, different first name', () => {
    const twin = prior({ firstName: 'Tomas' });
    const current = typed({ firstName: 'Tessa' });
    const matches = matchPriorIdentities(current, [twin]);
    assert.equal(matches[0]?.confidence, 'high',
      'guard integrity, and the whole point of this case: a shared birthday plus a shared guardian '
      + 'email reaches the HIGH tier on its own. Filtering the pre-fill by confidence would admit '
      + 'exactly this. If this ever stops being high, re-derive the rule rather than deleting the '
      + 'assertion — the case it protects has not gone away');
    assert.equal(priorRosterSeasonForFill(current, matches), null,
      'a sibling is not the player, however confident the identifiers are');
  });

  it('refuses when only a first name is on file — a full name is what tells siblings apart', () => {
    const current = typed({ lastName: null });
    assert.equal(fillFor(current, [prior({ lastName: null })]), null);
  });

  it('still fills when no birth date was typed, if the full name and family email agree', () => {
    // The tier here is `possible`, and that is fine: a full-name match plus the family's own
    // address is the same child. Requiring `high` would have refused this for no reason.
    const current = typed({ dateOfBirth: null });
    const match = fillFor(current, [prior()]);
    assert.ok(match, 'an exactly-named player at the same family address is not a coincidence');
    assert.equal(match.confidence, 'possible');
  });

  it('prefers the roster row when a season holds both kinds for one child', () => {
    // The commonest real shape: a kid who tried out AND made it has both rows in some seasons.
    const match = fillFor(typed(), [prior({ kind: 'registration', id: 'reg-1' }), prior()]);
    assert.equal(match?.prior.kind, 'roster');
  });

  it('fills nothing when the team has no history at all', () => {
    assert.equal(fillFor(typed(), []), null);
  });
});

/**
 * WHICH season the caption names, when a player was rostered in several.
 *
 * The value is the same whichever match wins — it is this team's own name — but the caller writes
 * "Filled from 2023 Season" beside it, and that is a claim about a family's history. The prior-pool
 * query carries no ORDER BY, so without an explicit ranking the sentence would be decided by
 * whatever order Postgres returned rows in, and a three-year player could be told they last played
 * two seasons before they actually did.
 */
describe('last season\'s team — WHICH season the caption names', () => {
  const SEASONS = [
    { id: 'py-2022', year: 2022 },
    { id: 'py-2023', year: 2023 },
    { id: 'py-2024', year: 2024 },
    { id: 'py-2026', year: 2026 },
  ];
  const rosteredIn = (programYearId: string, id: string): ContinuityIdentity => ({
    kind: 'roster', id, programYearId,
    firstName: 'Tessa', lastName: 'Nakagawa',
    dateOfBirth: '2015-04-11', guardianEmail: 'nakagawa@example.com',
  });

  it('names the MOST RECENT season, whatever order the rows arrive in', () => {
    const current = typed();
    // Deliberately oldest-first and newest-first: a correct answer cannot depend on the order.
    for (const pool of [
      [rosteredIn('py-2022', 'r22'), rosteredIn('py-2023', 'r23'), rosteredIn('py-2024', 'r24')],
      [rosteredIn('py-2024', 'r24'), rosteredIn('py-2022', 'r22'), rosteredIn('py-2023', 'r23')],
      [rosteredIn('py-2023', 'r23'), rosteredIn('py-2024', 'r24'), rosteredIn('py-2022', 'r22')],
    ]) {
      const matches = matchPriorIdentities(current, pool);
      assert.equal(matches.length, 3, 'guard integrity: all three seasons must actually match, or '
        + 'this proves nothing about choosing between them');
      const picked = priorRosterSeasonForFill(current, matches, SEASONS);
      assert.equal(picked?.prior.programYearId, 'py-2024',
        'the caption must name the season they most recently played, not the first row returned');
    }
  });

  it('still answers when no season list is supplied', () => {
    const current = typed();
    const matches = matchPriorIdentities(current, [rosteredIn('py-2023', 'r23')]);
    assert.ok(priorRosterSeasonForFill(current, matches));
  });
});
