/**
 * Club Website Stage 1, Pass 2 — what the club home's games part says (lib/club-games-home.ts), the editor's rep line
 * (G10) and the house league pages' check (G6). Drawing tabs 2, 3, 5 and 6; asks G1–G11 ruled 2026-11-25.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BAND_ROWS, gameContext, gameHeadTime, homeGamesView, movedLine, tournamentItem, tournamentsWithGamesToday } from '../../lib/club-games-home.ts';
import { leagueCheckWindow, seasonGamesFingerprint } from '../../lib/club-game-live.ts';
import { clubHomeSectionsFor, repGamesLine } from '../../lib/club-site-sections.ts';
import type { ClubGameRow, ClubTournamentDay } from '../../lib/club-games-read';

const TODAY = '2026-11-28'; // a Saturday; Eastern is UTC−5 in November
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00-05:00`).toISOString();
const NOW = Date.parse(at(TODAY, '10:15'));

let n = 0;
function row(p: Partial<ClubGameRow> & Pick<ClubGameRow, 'state'>): ClubGameRow {
  n += 1;
  const day = p.day ?? TODAY;
  const startsAt = p.startsAt ?? at(day, '09:00');
  const base: ClubGameRow = {
    key: `k${n}`, program: 'league', day, startsAt, endsAt: null, group: 'U11', groupOrder: 1,
    home: `Home ${n}`, away: `Away ${n}`, homeAway: null, place: 'Harbourview Park · Diamond 1', address: null,
    score: null, movedTo: null, closedPlace: null, path: '/league/2026-house-league/schedule?d=div-u11', seasonName: '2026 House League', seasonSlug: '2026-house-league', decided: false, state: 'coming',
  };
  return { ...base, ...p, day, startsAt };
}
const tournament = (days: ClubTournamentDay['days']): ClubTournamentDay => ({ name: 'Kestrel Bay Winter Classic', path: '/winter-classic', days });
const view = (rows: ClubGameRow[], tournaments: ClubTournamentDay[] = [], now = NOW) =>
  homeGamesView({ today: TODAY, rows, tournaments }, now);
const titles = (v: ReturnType<typeof view>) => v?.bands.map(b => b.title);

describe('the title (G1, G2)', () => {
  it('a quiet day: no games today, no result in two days — the part is absent', () => {
    assert.equal(view([]), null);
    assert.equal(view([row({ state: 'coming', day: '2026-11-29' })]), null);
  });
  it('a game today: "Today" with the date', () => {
    const v = view([row({ state: 'live' })])!;
    assert.equal(v.title, 'Today');
    assert.equal(v.date, 'Sat, Nov 28');
  });
  it('the day after: "Latest results", no date, each row carrying its day', () => {
    const r = row({ state: 'final', day: '2026-11-27', score: { home: 3, away: 2 } });
    const v = view([r])!;
    assert.equal(v.title, 'Latest results');
    assert.equal(v.date, null);
    assert.deepEqual(titles(v), ['']);
    assert.equal(gameHeadTime(r, TODAY), 'Fri, Nov 27');
  });
  it('a day with only games called off is still "Today": a family learns what happened', () => {
    assert.deepEqual(titles(view([row({ state: 'postponed' })])), ['Not being played today']);
  });
});

describe('the bands and their order (G4)', () => {
  it('by time, never by program: Live now, Later today, Latest results, Not being played today', () => {
    const v = view([
      row({ state: 'cancelled', startsAt: at(TODAY, '11:00') }),
      row({ state: 'final', startsAt: at(TODAY, '07:30'), score: { home: 7, away: 5 } }),
      row({ state: 'coming', startsAt: at(TODAY, '10:30') }),
      row({ state: 'live' }),
    ])!;
    assert.deepEqual(titles(v), ['Live now', 'Later today', 'Latest results', 'Not being played today']);
  });
  it('a tournament first, then by start; at one start house league by division from the youngest, then rep, then place', () => {
    const rep = row({ state: 'live', program: 'rep', groupOrder: 0, group: 'Kestrel Bay U13 Ospreys', path: '/teams/u13-ospreys', seasonName: null, seasonSlug: null });
    const u15 = row({ state: 'live', group: 'U15', groupOrder: 4 });
    const u11b = row({ state: 'live', place: 'Lions Park' });
    const u11a = row({ state: 'live', place: 'Harbourview Park' });
    const later = row({ state: 'live', startsAt: at(TODAY, '09:30') });
    const v = view([later, rep, u15, u11b, u11a], [tournament({ [TODAY]: { games: 22, live: 6, final: 4, first: '08:00:00', last: '17:00:00' } })])!;
    const live = v.bands[0];
    assert.equal(live.items[0].kind, 'tournament');
    assert.deepEqual(live.items.slice(1).map(i => i.key), [u11a.key, u11b.key, u15.key, rep.key, later.key]);
  });
  it('Latest results reads newest first', () => {
    const early = row({ state: 'final', startsAt: at(TODAY, '07:30'), score: { home: 1, away: 0 } });
    const late = row({ state: 'final', startsAt: at(TODAY, '09:30'), score: { home: 1, away: 0 } });
    const older = row({ state: 'final', day: '2026-11-26', startsAt: at('2026-11-26', '19:00'), score: { home: 1, away: 0 } });
    assert.deepEqual(view([older, early, late])!.bands[0].items.map(i => i.key), [late.key, early.key, older.key]);
  });
});

describe('four rows a band, then "N more" (G4)', () => {
  it('a busy band shows four and says what the rest are', () => {
    const rows = [
      ...Array.from({ length: 7 }, () => row({ state: 'live' })),
      row({ state: 'live', program: 'rep', group: 'U15 Rep', path: '/teams/u15', seasonName: null, seasonSlug: null }),
    ];
    const band = view(rows, [tournament({ [TODAY]: { games: 36, live: 9, final: 0, first: '08:00:00', last: '16:00:00' } })])!.bands[0];
    assert.equal(band.items.length, 9);
    assert.equal(BAND_ROWS, 4);
    assert.deepEqual(band.more, { title: '5 more live now', sub: '4 house league · 1 rep' });
  });
  it('results name their days; one more is singular', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ state: 'final', day: i < 4 ? TODAY : '2026-11-26', startsAt: at(i < 4 ? TODAY : '2026-11-26', `0${8 + (i % 2)}:00`), score: { home: 1, away: 0 } }));
    assert.deepEqual(view(rows)!.bands[0].more, { title: '1 more result', sub: 'Thu, Nov 26' });
  });
  it('a capped band on a game day ends the part with the season\'s own schedule', () => {
    const v = view(Array.from({ length: 5 }, () => row({ state: 'coming', startsAt: at(TODAY, '12:30') })))!;
    assert.equal(v.bands[0].more?.title, '1 more later today');
    assert.deepEqual(v.doors, [{ key: 'door|/league/2026-house-league/schedule', path: '/league/2026-house-league/schedule', title: '2026 House League schedule', sub: 'Today, by division' }]);
  });
  it('a band that fits has no "more" row and no door', () => {
    const v = view([row({ state: 'live' })])!;
    assert.equal(v.bands[0].more, null);
    assert.deepEqual(v.doors, []);
  });
});

describe('a running tournament is one row with its counts (A3)', () => {
  const t = (d: ClubTournamentDay['days'][string]) => tournamentItem(tournament({ [TODAY]: d }), TODAY, NOW);
  it('live, before its first game, all final, and some never final', () => {
    assert.deepEqual(t({ games: 22, live: 6, final: 4, first: '08:00:00', last: '17:00:00' }), { band: 'live', sub: '6 live now · 22 games today' });
    assert.deepEqual(tournamentItem(tournament({ [TODAY]: { games: 22, live: 0, final: 0, first: '08:00:00', last: '17:00:00' } }), TODAY, Date.parse(at(TODAY, '07:45'))),
      { band: 'later', sub: '22 games today · first at 8:00 a.m.' });
    assert.deepEqual(t({ games: 22, live: 0, final: 22, first: '08:00:00', last: '09:00:00' }), { band: 'results', sub: '22 games today · all final' });
    assert.deepEqual(t({ games: 22, live: 0, final: 20, first: '06:00:00', last: '07:00:00' }), { band: 'results', sub: '20 of 22 games final' });
    // /marketing 2026-11-25: past its last window with nothing entered says so; between rounds says where the day stands.
    assert.deepEqual(t({ games: 5, live: 0, final: 0, first: '06:00:00', last: '07:00:00' }), { band: 'results', sub: '5 games today · no results yet' });
    assert.deepEqual(t({ games: 22, live: 0, final: 14, first: '06:00:00', last: '23:00:00' }), { band: 'later', sub: '14 of 22 games final' });
    assert.deepEqual(t({ games: 22, live: 0, final: 0, first: '06:00:00', last: '23:00:00' }), { band: 'later', sub: '22 games today' });
  });
  it('the day after: its results over the days it played', () => {
    const two = tournament({ '2026-11-27': { games: 20, live: 0, final: 20, first: null, last: null }, '2026-11-26': { games: 18, live: 0, final: 18, first: null, last: null } });
    assert.deepEqual(tournamentItem(two, TODAY, NOW), { band: 'results', sub: '38 results · Thu, Nov 26 – Fri, Nov 27' });
  });
  it('the Tournaments card says "Games today" only for one with games today (G9)', () => {
    assert.deepEqual([...tournamentsWithGamesToday({ today: TODAY, tournaments: [tournament({ [TODAY]: { games: 2, live: 0, final: 0, first: null, last: null } })] })], ['/winter-classic']);
    assert.equal(tournamentsWithGamesToday({ today: TODAY, tournaments: [tournament({ '2026-11-27': { games: 2, live: 0, final: 2, first: null, last: null } })] }).size, 0);
  });
});

describe('the rows (tab 3, G5, G7)', () => {
  it('the context line: house league names its division; rep says away only when away', () => {
    assert.equal(gameContext({ program: 'league', group: 'U11', homeAway: null }), 'House league · U11');
    assert.equal(gameContext({ program: 'rep', group: 'U13 Ospreys', homeAway: 'home' }), 'Rep');
    assert.equal(gameContext({ program: 'rep', group: 'U13 Ospreys', homeAway: 'away' }), 'Rep · away');
  });
  it('a house league game past its window with no score stays in Latest results; a rep one with nothing saved does not', () => {
    const v = view([row({ state: 'noScore' }), row({ state: 'noScore', program: 'rep', path: '/teams/x', seasonName: null, seasonSlug: null })])!;
    assert.deepEqual(v.bands.map(b => [b.title, b.items.length]), [['Latest results', 1]]);
  });
  it('a game still on after midnight stays in Live now', () => {
    const late = row({ state: 'live', day: '2026-11-27', startsAt: at('2026-11-27', '23:30') });
    assert.deepEqual(view([late])?.bands.map(b => [b.title, b.items.length]), [['Live now', 1]]);
  });
  it('a time today, its day otherwise; "Moved to" its new day, the pill alone without one', () => {
    assert.equal(gameHeadTime(row({ state: 'coming', startsAt: at(TODAY, '10:30') }), TODAY), '10:30 a.m.');
    assert.equal(movedLine({ movedTo: at('2026-12-05', '09:00') }), 'Moved to Sat, Dec 5');
    assert.equal(movedLine({ movedTo: null }), null);
  });
});

describe('a rainout is one row per season (tab 2, Rained out)', () => {
  it('more than three postponed at one park: one row with its count, season, place and first time', () => {
    const rows = Array.from({ length: 6 }, (_, i) => row({ state: 'postponed', place: 'Lions Park', startsAt: at(TODAY, `${String(9 + i).padStart(2, '0')}:00`) }));
    const off = view(rows)!.bands.find(b => b.key === 'off')!;
    assert.deepEqual(off.items.map(i => i.kind === 'calledOff' && [i.title, i.sub, i.path]),
      [['6 house league games postponed', '2026 House League · Lions Park · from 9:00 a.m.', '/league/2026-house-league/schedule']]);
  });
  it('three or fewer stay rows; a mix says "not being played"', () => {
    assert.equal(view([row({ state: 'postponed' }), row({ state: 'cancelled' })])!.bands[0].items.every(i => i.kind === 'game'), true);
    const mix = [...Array.from({ length: 3 }, () => row({ state: 'postponed' })), row({ state: 'cancelled' })];
    const item = view(mix)!.bands[0].items[0];
    assert.equal(item.kind === 'calledOff' && item.title, '4 house league games not being played');
  });
});

describe('the house league pages\' check (G6)', () => {
  it('the window runs from half an hour before the first game to the last game\'s end plus 30 minutes', () => {
    const w = leagueCheckWindow([
      { scheduledAt: at(TODAY, '09:00'), endsAt: at(TODAY, '10:30'), status: 'scheduled' },
      { scheduledAt: at(TODAY, '11:00'), endsAt: at(TODAY, '12:30'), status: 'scheduled' },
      { scheduledAt: at(TODAY, '15:00'), endsAt: at(TODAY, '16:30'), status: 'postponed' },
      { scheduledAt: at('2026-12-05', '09:00'), endsAt: null, status: 'scheduled' },
    ], NOW);
    assert.deepEqual(w, { from: at(TODAY, '08:30'), to: at(TODAY, '13:00') });
  });
  it('a day with no game never checks', () => {
    assert.equal(leagueCheckWindow([{ scheduledAt: at('2026-12-05', '09:00'), endsAt: null, status: 'scheduled' }], NOW), null);
  });
  it('the season\'s fingerprint changes with a score or a state, and ignores other seasons and the order', () => {
    const a = row({ state: 'live' });
    const other = row({ state: 'live', path: '/league/2025-fall/schedule?d=x', seasonSlug: '2025-fall' });
    const before = seasonGamesFingerprint([a, other], '2026-house-league');
    assert.equal(seasonGamesFingerprint([other, a], '2026-house-league'), before);
    assert.equal(seasonGamesFingerprint([a, { ...other, state: 'final', score: { home: 1, away: 0 } }], '2026-house-league'), before);
    assert.notEqual(seasonGamesFingerprint([{ ...a, state: 'final', score: { home: 6, away: 4 } }, other], '2026-house-league'), before);
  });
});

describe('the games part\'s place (Stage 0 A1)', () => {
  const carries = { teams: true, league: true, tournaments: true };
  const has = { openNow: 2, teams: 3, league: true, tournaments: 1, about: true };
  it('right under Open now, before the club\'s own order, whatever that order is', () => {
    const prefs = { order: ['about', 'tournaments', 'league', 'teams'], hidden: [] };
    assert.deepEqual(clubHomeSectionsFor({ ...has, games: true }, prefs, carries), ['openNow', 'games', 'about', 'tournaments', 'league', 'teams']);
    assert.deepEqual(clubHomeSectionsFor({ ...has, openNow: 0, games: true }, prefs, carries)[0], 'games');
  });
  it('absent when it has nothing to say', () => {
    assert.ok(!clubHomeSectionsFor(has, { order: null, hidden: null }, carries).includes('games'));
  });
});

describe('the site editor\'s rep line (G10)', () => {
  it('its some, one, all and none forms, each saying who decides', () => {
    const who = ' Each team\'s coach chooses this in Schedule visibility.';
    assert.equal(repGamesLine({ showing: 3, total: 20 }), `3 of 20 rep teams show their games on your site.${who}`);
    assert.equal(repGamesLine({ showing: 1, total: 20 }), `1 of 20 rep teams shows its games on your site.${who}`);
    assert.equal(repGamesLine({ showing: 20, total: 20 }), `All 20 rep teams show their games on your site.${who}`);
    assert.equal(repGamesLine({ showing: 0, total: 20 }), `No rep team shows its games on your site yet.${who}`);
    assert.equal(repGamesLine({ showing: 2, total: 2 }), `Both rep teams show their games on your site.${who}`);
    assert.equal(repGamesLine({ showing: 1, total: 1 }), `Your rep team shows its games on your site.${who}`);
    assert.equal(repGamesLine({ showing: 0, total: 1 }), `Your rep team's games aren't on your site yet.${who}`);
    assert.equal(repGamesLine({ showing: 0, total: 0 }), null);
  });
});
