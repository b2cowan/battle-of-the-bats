import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9c — A RATING NEVER LEAKS (rulings 9c·2a/b/c, owner 2026-10-26; build prompt argument 2).
 *
 * A rating is read and written only by the people who run the league. It lives in its own table so a whole-row read of
 * a registration can never carry one, and this guard holds the other half: ONLY the files listed here may name the
 * table or import its module, and every route among them refuses through the gate's `seeRatings` or `rate` FIRST.
 * So the registrar's screens and exports, the status page, the coach's page, the families book and every email are
 * structurally unable to show one. Adding a file to the list is a decision about children's data: argue it first.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The whole door. The module, and the runner-gated routes that read or write through it. */
export const RATING_READERS = [
  'lib/house-league-ratings.ts',
  'app/api/admin/house-league/seasons/[seasonId]/ratings/route.ts',
  'app/api/admin/house-league/seasons/[seasonId]/teams-board/route.ts',
  'app/api/admin/house-league/seasons/[seasonId]/draft/route.ts',
] as const;

const SOURCES = ['app', 'lib', 'components'].flatMap(dir => [...filesUnder(dir, '.ts'), ...filesUnder(dir, '.tsx')]);
const NAMES_RATINGS = /league_player_ratings|house-league-ratings/;

describe('1 · only the listed files reach a rating', () => {
  it('nothing outside the list names the ratings table or imports its module', () => {
    const outside = SOURCES.filter(f => !(RATING_READERS as readonly string[]).includes(f) && NAMES_RATINGS.test(readCode(f)));
    assert.deepEqual(outside, []);
  });
  it('every listed file exists', () => {
    for (const f of RATING_READERS) assert.ok(SOURCES.includes(f), `${f} is gone: take it off the list`);
  });
});

describe('2 · every listed route asks the gate about ratings before anything else', () => {
  for (const route of RATING_READERS.filter(f => f.endsWith('/route.ts'))) {
    it(route, () => {
      const code = readCode(route);
      const handlers = code.split(/export const (?:GET|POST|PATCH|PUT|DELETE)\s*=/).slice(1);
      assert.ok(handlers.length > 0, 'no handler found');
      for (const body of handlers) {
        // A handler that reads ratings asks seeRatings or rate; one that never reaches a rating may ask run/read only
        // if it does not call the rating module at all.
        const touches = /getRatings|setRatings/.test(body);
        if (!touches) continue;
        assert.match(body, /houseLeagueRefusal\(ctx,\s*'(seeRatings|rate)'|access\.seeRatings|\.seeRatings\s*\?/,
          'reads or writes a rating without asking seeRatings / rate');
      }
    });
  }
});

describe('3 · the surfaces a rating must never reach do not import it (9c·2a, 9c·2c)', () => {
  const NEVER = [
    'app/api/league/[orgSlug]/[seasonSlug]/status-lookup/route.ts',
    'lib/league-signup-status.ts',
    'lib/house-league-coach.ts',
    'app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts',
    'app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts',
    'app/api/admin/house-league/seasons/[seasonId]/email/route.ts',
  ];
  for (const f of NEVER) it(f, () => assert.doesNotMatch(readCode(f), NAMES_RATINGS));
});
