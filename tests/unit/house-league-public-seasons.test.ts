import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { liveLeagueSeasons, publicSeasonLinks, publicSeasonState } from '../../lib/house-league-season.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9a, PART 5 — EVERY LIVE SEASON ON THE PUBLIC SIDE (owner Q14, 9a·7; frame E; words
 * HOUSE_LEAGUE_STAGE9A_COPY.md §8). F04: the league page, the site home and the fallback home each showed only the newest
 * live season. Now one list of rows draws every live season on all three, labelled by what is happening.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TODAY = '2026-10-24';

describe('1 · what families read beside a season (copy §8)', () => {
  const at = (status: string, start: string | null = null, end: string | null = null) =>
    publicSeasonState({ status, seasonStartDate: start, seasonEndDate: end }, TODAY);
  it('Registration open / closed, Starts, Playing now, Final standings; a finished season has no tag', () => {
    assert.equal(at('registration_open')?.label, 'Registration open');
    assert.equal(at('registration_closed')?.label, 'Registration closed');
    assert.equal(at('active', '2027-05-31', '2027-08-30')?.label, 'Starts May 31, 2027');
    assert.equal(at('active', '2026-05-31', '2026-12-30')?.label, 'Playing now');
    assert.equal(at('active', '2026-05-31', '2026-08-30')?.label, 'Final standings');
    assert.equal(at('completed'), null);
    assert.equal(at('archived'), null);
  });
  it('the links: Register first while it takes sign-ups; Schedule and Standings once it is under way', () => {
    const h = '/club/league/s';
    assert.deepEqual(publicSeasonLinks({ status: 'registration_open' }, h).map(l => l.label), ['Register', 'Season page']);
    assert.equal(publicSeasonLinks({ status: 'registration_open' }, h)[0].href, `${h}/register`);
    assert.deepEqual(publicSeasonLinks({ status: 'registration_closed' }, h).map(l => l.label), ['Season page']);
    assert.deepEqual(publicSeasonLinks({ status: 'active' }, h).map(l => l.label), ['Schedule', 'Standings']);
    assert.deepEqual(publicSeasonLinks({ status: 'completed' }, h).map(l => l.label), ['Schedule', 'Standings', 'Season page']);
  });
  it('every live season, newest first — never just one', () => {
    const live = liveLeagueSeasons([
      { id: '2025', status: 'completed', seasonStartDate: '2025-05-31' },
      { id: '2026', status: 'active', seasonStartDate: '2026-05-31' },
      { id: '2027', status: 'registration_open', seasonStartDate: '2027-05-31' },
      { id: 'draft', status: 'draft', seasonStartDate: '2028-05-31' },
    ]).map(s => s.id);
    assert.deepEqual(live, ['2027', '2026']);
  });
});

describe('2 · the three public surfaces draw the one list', () => {
  it('the league page: Running now (every live season) above Past seasons', () => {
    const page = readCode('app/[orgSlug]/league/page.tsx');
    assert.match(page, /liveLeagueSeasons\(visibleSeasons\)/);
    assert.match(page, /<div className=\{kit\.band\}>Running now<\/div>\s*<LeagueSeasonRows/);
    assert.doesNotMatch(page, /\.find\(s => ACTIVE_STATUSES|Current season|Season active|Season complete/);
  });
  it('the site home: every live season is a row', () => {
    assert.match(readCode('lib/club-home-data.ts'), /seasons: liveLeagueSeasons\(publicLeagueSeasons\)\.map/);
    assert.match(readCode('components/public/ClubSiteHome.tsx'), /<LeagueSeasonRows seasons=\{p\.league\.seasons\}/);
  });
  it('the fallback home: the same rows, its own old words retired', () => {
    const home = readCode('app/[orgSlug]/page.tsx');
    assert.match(home, /liveLeagueSeasons\(defaultPublicSeasons\)/);
    assert.doesNotMatch(home, /Season in progress|Registration closed — season starting soon|defaultActiveSeason/);
  });
  it('each row is a whole link, and its own links are 44 px', () => {
    const css = readCode('components/public/LeagueSeasonRows.module.css');
    assert.match(css, /\.name::after \{ content: ''; position: absolute; inset: 0;/);
    assert.match(css, /\.link \{[^}]*min-height: 44px;/);
    assert.match(css, /\.links \{ position: relative; z-index: 1;/, 'the links sit above the row’s own door');
  });
  it('Open now keeps listing every season taking sign-ups (9a·7)', () => {
    assert.match(readCode('lib/club-home-data.ts'), /publicLeagueSeasons\.filter\(s => s\.status === 'registration_open'\)\.map/);
  });
});
