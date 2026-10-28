import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { earlyBirdLine, liveLeagueSeasons, publicSeasonLinks, publicSeasonState, saveWords } from '../../lib/house-league-season.ts';
import { earlyBirdOffer } from '../../lib/league-price.ts';
import { promotesEarlyBird } from '../../lib/league-registration-state.ts';

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
    assert.match(readCode('lib/club-home-data.ts'), /seasons: \(await withEarlyBird\(liveLeagueSeasons\(publicLeagueSeasons\), today\)\)\.map/);
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
  it('Open now keeps listing every season taking sign-ups (9a·7) — by its dates and status together (9b-1 Part 4)', () => {
    // The list is shaped in lib/club-open-now.ts (Public tournament Stage 2), fed the home's public seasons.
    assert.match(readCode('lib/club-open-now.ts'), /leagueSeasons\.filter\(s => takesSignups\(s\)\)\.map/);
    assert.match(readCode('lib/club-home-data.ts'), /clubOpenNowRows\(publicLeagueSeasons,/);
  });
});

describe('3 · the early bird where families choose (owner 2026-10-25)', () => {
  const season = { registrationFee: 165, earlyBirdUntil: '2026-10-31' };
  const u8 = { price: null, earlyPrice: 145 };
  const u12 = { price: 175, earlyPrice: 155 };
  const u10 = { price: null, earlyPrice: null };
  it('the offer: the saving, the day, and "up to" when a division has none', () => {
    assert.deepEqual(earlyBirdOffer([u8, u12], season, TODAY), { until: '2026-10-31', saveLow: 20, saveHigh: 20, partial: false });
    assert.equal(earlyBirdOffer([u8, u10], season, TODAY)?.partial, true);
  });
  it('no offer once the day has passed, with no early amounts, or with no date', () => {
    assert.equal(earlyBirdOffer([u8], season, '2026-11-01'), null);
    assert.equal(earlyBirdOffer([u8], season, '2026-10-31')?.until, '2026-10-31', 'the day itself still counts');
    assert.equal(earlyBirdOffer([u10], season, TODAY), null);
    assert.equal(earlyBirdOffer([u8], { registrationFee: 165, earlyBirdUntil: null }, TODAY), null);
  });
  it('the words: Save $20 / Save up to $20, and the row line counts down in the last week', () => {
    assert.equal(saveWords({ saveLow: 20, saveHigh: 20, partial: false }), 'Save $20');
    assert.equal(saveWords({ saveLow: 10, saveHigh: 20, partial: false }), 'Save up to $20');
    assert.equal(saveWords({ saveLow: 20, saveHigh: 20, partial: true }), 'Save up to $20');
    const offer = { until: '2026-10-31', saveLow: 20, saveHigh: 20, partial: false };
    assert.equal(earlyBirdLine(offer, '2026-10-20'), 'Save $20 · early bird through Oct 31');
    assert.equal(earlyBirdLine(offer, '2026-10-25'), 'Save $20 · early bird ends in 6 days');
    assert.equal(earlyBirdLine(offer, '2026-10-30'), 'Save $20 · early bird ends tomorrow');
    assert.equal(earlyBirdLine(offer, '2026-10-31'), 'Save $20 · early bird ends today');
  });
  it('an early amount equal to or above the price is not a saving, and cents stay whole', () => {
    assert.equal(earlyBirdOffer([{ price: 165, earlyPrice: 165 }], season, TODAY), null);
    assert.equal(earlyBirdOffer([{ price: 165, earlyPrice: 175 }], season, TODAY), null);
    assert.equal(earlyBirdOffer([{ price: 165.55, earlyPrice: 125.55 }], season, TODAY)?.saveHigh, 40);
    assert.equal(earlyBirdOffer([{ price: 165, earlyPrice: 165 }, u8], season, TODAY)?.partial, true);
  });
  it('promoted while sign-ups are open or about to open, never once closed, never when the form opens after the day', () => {
    const NOW = '2026-10-25T12:00';
    const s = (status: string, open: string | null, close: string | null, until: string | null = '2026-10-31') => ({ status, registrationOpenAt: open, registrationCloseAt: close, earlyBirdUntil: until });
    assert.equal(promotesEarlyBird(s('registration_open', '2026-10-20T08:00', '2026-11-30T17:00'), NOW), true);
    assert.equal(promotesEarlyBird(s('registration_open', '2026-10-28T08:00', '2026-11-30T17:00'), NOW), true, 'about to open: the discount entices now');
    assert.equal(promotesEarlyBird(s('registration_open', '2026-11-05T08:00', '2026-11-30T17:00'), NOW), false, 'opens after the early-bird day');
    assert.equal(promotesEarlyBird(s('registration_open', '2026-10-01T08:00', '2026-10-24T17:00'), NOW), false, 'closed by its date');
    assert.equal(promotesEarlyBird(s('registration_closed', '2026-10-01T08:00', '2026-11-30T17:00'), NOW), false, 'closed by the convenor');
    assert.equal(promotesEarlyBird(s('registration_open', '2026-10-20T08:00', '2026-11-30T17:00', null), NOW), false, 'no early-bird day');
  });
  it('the three public lists carry it, and the season page leads with the price today', () => {
    assert.match(readCode('app/[orgSlug]/league/page.tsx'), /withEarlyBird\(liveLeagueSeasons\(visibleSeasons\), today\)/);
    assert.match(readCode('app/[orgSlug]/page.tsx'), /withEarlyBird\(liveLeagueSeasons\(defaultPublicSeasons\)\)/);
    assert.match(readCode('app/[orgSlug]/league/[seasonSlug]/page.tsx'), /earlyBirdOffer\(divisions, season, today\)/);
  });
});
