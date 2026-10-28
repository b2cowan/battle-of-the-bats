/**
 * AN UNPUBLISHED SCHEDULE NEVER LEAVES THE SERVER (public tournament pages, Stage 0 · D1, 2026-10-27).
 *
 * An organizer publishes a schedule division by division. The tournament home, the live-scores ticker, standings,
 * playoffs, champions, the teams list, a game's page and the share images all read every game and the Schedule tab
 * hid the unpublished ones in the browser — so families saw a draft the organizer had not released, and the draft sat
 * in every page's source. Now one rule (`lib/public-games.ts`) decides it on the server, for every public read; an
 * unpublished division's games count as absent (its teams rank 0-0-0, as the team page always showed them).
 *
 * This guard holds every public surface to that rule, so a new public read cannot quietly skip it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filesUnder, readCode } from './_source-code.ts';

const count = (src: string, re: RegExp) => [...src.matchAll(re)].length;

/** Every file a family's browser is served from, or that answers an anonymous caller, about a tournament. */
const PUBLIC_SURFACES = [
  'app/[orgSlug]/[tournamentSlug]',
  'components/public',
  'app/api/public',
  'app/api/consumer',
  'app/[orgSlug]/admin/tournaments/preview',
].flatMap(dir => [...filesUnder(dir, '.ts'), ...filesUnder(dir, '.tsx')]);

/** The public readers that read a tournament's games themselves — each must put them through the gate. */
const GATED_READERS = [
  'lib/public-tournament-data.ts',
  'app/api/public/team-profile/route.ts',
  'app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx',
  'app/[orgSlug]/[tournamentSlug]/champions/page.tsx',
  'app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx',
];

describe('the rule', () => {
  const rule = readCode('lib/public-games.ts');
  it('a division is published only when it says so; no setting reads as unpublished', () => {
    assert.match(rule, /return \(division\?\.scheduleVisibility \?\? 'unpublished'\) === 'published';/);
  });
  it('a game whose division is not published, or not in the list, is dropped', () => {
    assert.match(rule, /return games\.filter\(g => published\.has\(g\.divisionId\)\);/);
  });
  it('standings are computed from the published games only', () => {
    assert.match(rule, /\? \[onlyPublishedGames\(read\.games, divisions\), read\.teams\]/);
    assert.match(rule, /: await Promise\.all\(\[getPublicGames\(tournament\.id, divisions\)/);
  });
  it('the Playoffs tab counts a playoff game only in a published division', () => {
    assert.match(rule, /\.eq\('divisions\.schedule_visibility', 'published'\)/);
  });
});

describe('every public surface goes through it', () => {
  it('found the public surfaces', () => {
    assert.ok(PUBLIC_SURFACES.length > 30, `public files found: ${PUBLIC_SURFACES.length}`);
  });
  for (const file of PUBLIC_SURFACES) {
    it(`${file} reads no game, standing or playoff row around the gate`, () => {
      const src = readCode(file);
      assert.doesNotMatch(src, /\.from\(['"]games['"]\)/, 'no direct games query');
      assert.doesNotMatch(src, /\bgetStandings\(/, 'standings come from getPublicStandingsByDivision');
      assert.doesNotMatch(src, /\bhasPlayoffGames\(/, 'the Playoffs tab asks hasPublicPlayoffGames');
      if (!GATED_READERS.includes(file)) {
        assert.doesNotMatch(src, /\bgetGames\(/, 'games come from getPublicTournamentPageData or getPublicGames');
      }
    });
  }
  for (const file of GATED_READERS) {
    it(`${file} puts every games read through the gate`, () => {
      const src = readCode(file);
      const reads = count(src, /\bgetGames\(/g);
      assert.ok(reads > 0, 'still reads games (else drop it from GATED_READERS)');
      assert.equal(count(src, /\bonlyPublishedGames\(/g), reads, 'one gate per read');
      assert.doesNotMatch(src, /\bgetStandings\(/);
    });
  }
  it('the home reads its games and standings through the gate', () => {
    const home = readCode('components/public/TournamentHomeContent.tsx');
    assert.match(home, /const \{ games: allGames, withheld: scheduleWithheld \} = await readPublicGames\(tournament\.id, divisions\);/);
    assert.match(home, /getPublicStandingsByDivision\(tournament, divisions, \{ games: allGames, teams: allTeams \}\)/);
  });
  it('an event holding a division back is not finished, or crowned, on the divisions it shows', () => {
    assert.match(readCode('lib/public-games.ts'), /return \{ games, withheld: games\.length !== all\.length \};/);
    assert.match(readCode('components/public/TournamentHomeContent.tsx'),
      /isCompletedTournament \|\|\s*\(!scheduleWithheld && \(\(playoffsComplete && noUnplayedGames\) \|\| roundRobinComplete\)\);/);
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/champions/page.tsx'),
      /const playoffsComplete = allGames\.length === rawGames\.length && isTournamentPlayoffsComplete\(allGames, sortedDivisions\);/);
  });
  it('the layout asks for a published playoff game', () => {
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx'), /hasPublicPlayoffGames\(tournament\.id\)/);
  });
  it('the ungated playoff check is gone, so nothing can reach for it', () => {
    assert.doesNotMatch(readCode('lib/db.ts'), /export async function hasPlayoffGames\(/);
  });
});

describe('a score alert', () => {
  it('reaches no follower from an unpublished schedule, before anyone is looked up', () => {
    const notify = readCode('lib/fan-notify.ts');
    const gate = notify.indexOf('if (!(await isDivisionPublishedById(game.division_id))) return;');
    assert.ok(gate > 0, 'the publish check');
    assert.ok(gate < notify.indexOf("await mergedTargets(ctx.tournament.id, 'game_alerts', teamIds)"));
  });
  it('"Champions crowned" waits, unclaimed, while any division is held back — and publishing asks again', () => {
    const champs = readCode('lib/champions-notify.ts');
    const wait = champs.indexOf('if (onlyPublishedGames(games, divisions).length !== games.length) return;');
    assert.ok(wait > 0, 'the held-back check');
    assert.ok(wait < champs.indexOf('champions_crowned_at: new Date().toISOString()'), 'before the one-time claim');
    assert.equal(count(champs, /notifyFansForChampions\(/g), 1, 'no other fan send');
    const route = readCode('app/api/admin/divisions/route.ts');
    assert.equal(count(route, /if \(vis === 'published'(?: && ag)?\) await announceChampionsForTournament\(/g), 2, 'both set-visibility paths');
    assert.match(readCode('app/api/admin/schedule-publish/route.ts'),
      /if \(\(publishedRows \?\? \[\]\)\.length > 0\) await announceChampionsForTournament\(tournamentId, ctx\.user\.id\);/, 'the Publish window');
  });
  it('a club team\'s mirrored tournament games (its public page and calendar) go by each game\'s own division', () => {
    const coach = readCode('lib/basic-coach-teams.ts');
    assert.match(coach, /\.from\('divisions'\)\.select\('id, schedule_visibility'\)\.in\('tournament_id', tournamentIds\)/);
    assert.match(coach, /g\.division_id !== null && publishedDivisions\.has\(g\.division_id\) && \(/);
  });
  it('the follow cards are not finished on the divisions they show either', () => {
    assert.match(readCode('lib/public-tournament-data.ts'), /gamesWithheld: shown\.length !== games\.length/);
    assert.match(readCode('lib/entity-follow-status.ts'),
      /tournament\.status === 'completed' \|\|\s*\(!gamesWithheld && \(\(playoffsComplete && noUnplayed\) \|\| roundRobinComplete\)\);/);
  });
});
