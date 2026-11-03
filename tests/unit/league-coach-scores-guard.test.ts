import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode } from './_source-code.ts';

/**
 * House League 9e-3: WHO ENTERED A SCORE IS NOT PUBLIC. `league_game_scores` (mig 428) holds the coaches' names and the
 * away coach's note; `league_games` is anon-readable, so the record lives in its own service-role table and is read in
 * exactly two places: the club's schedule read (staff) and the coach's own team page (team names only, never a person's).
 * A third reader is a decision — about who sees a coach's note — not a refactor.
 */
const CODE = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.ts'), ...filesUnder('components', '.tsx')];

describe('the score record has two readers', () => {
  it('only the server module names the table', () => {
    // The bare name, not a quoted one: an embedded select (`from('league_games').select('id, league_game_scores(...)')`) names it too.
    const naming = CODE.filter(f => /league_game_scores/.test(readCode(f)));
    assert.deepEqual(naming, ['lib/league-coach-scores-server.ts']);
  });

  it('its reads are called only by the club schedule read and the coach page', () => {
    const callers = CODE.filter(f => f !== 'lib/league-coach-scores-server.ts' && /\bread(Season)?ScoreRecords\b/.test(readCode(f)));
    assert.deepEqual(callers.sort(), ['app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts', 'lib/house-league-coach.ts']);
  });

  it("the coach page's row carries teams, never the record's names or note", () => {
    const body = functionBody(readCode('lib/house-league-coach.ts'), 'readTeamScores');
    assert.doesNotMatch(body, /enteredByName|reportedByName|reportNote|checkedByName|correctedByName/);
    // A spread of the record would carry every name and the note into the row without naming any of them.
    assert.doesNotMatch(body, /[.][.][.]\s*(rec|record|score)\b/);
  });

  it('the schedule read that returns it is behind the read gate', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts');
    const get = route.slice(route.indexOf('export const GET'), route.indexOf('export const POST'));
    assert.ok(get.indexOf("houseLeagueRefusal(ctx, 'read')") >= 0 && get.indexOf("houseLeagueRefusal(ctx, 'read')") < get.indexOf('readSeasonScoreRecords'));
  });
});
