/**
 * CLUB WEBSITE STAGE 1, PASS 1 — THE ONE GAMES READ AND THE ONE HOUSE LEAGUE RULE (drawing tab 7, its guard list).
 *
 * The club home reads a club's games through each program's OWN public rule, called and never copied (Stage 0's D1: a
 * draft schedule reached families once). These guards hold that, so a later edit cannot widen what the home shows:
 *   1. the read's imports are an exact list (dynamic imports and re-exports caught);
 *   2. it reads no table and holds no copy of a rule;
 *   3. each program's rule is called, and not called when its switch or plan says no;
 *   4. what it returns is its own short list of fields (no notes, no score-entry details, no internal id);
 *   5. a copied tournament game, a multi-day tournament entry and a practice never come out;
 *   6. the house league "today" window is applied after the unsent-changes view (pinned with a moved game);
 *   7. no public file reaches the staff calendar;
 *   8. no house league page or route tests "draft" or "schedule published" itself;
 *   9. the 30-second check request: site and plan, no cookie, held at the edge with no serve-stale, no tag cache.
 * (The rep batch's own public question is guarded beside the one-team rule's, in club-stage6d-feeds-guard; the read
 * joined public-games-guard's surfaces.)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, reachableFrom } from './_source-code.ts';
import { lastSentInWindow } from '../../lib/league-game-changes.ts';
import type { HeldChange } from '../../lib/league-game-changes.ts';
import {
  CHECK_OPENS_BEFORE_MINUTES, gameDayCheckWindow, isGameDayCheckOn, isNewerGamesRead, leagueGamePhase,
} from '../../lib/club-game-live.ts';
import { DEFAULT_GAME_DURATION_MINUTES, LIVE_GRACE_MINUTES } from '../../lib/game-status.ts';

const READ = 'lib/club-games-read.ts';
const ROUTE = 'app/api/public/club-games/[orgSlug]/route.ts';
const MIN = 60_000;

/** Every `interface Name { … }` field name, in order. */
function fieldsOf(code: string, name: string): string[] {
  const start = code.indexOf(`export interface ${name} {`);
  assert.ok(start >= 0, `interface ${name}`);
  let depth = 0, i = code.indexOf('{', start), body = '';
  for (; i < code.length; i++) {
    const c = code[i];
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (depth === 0) break;
    if (depth === 1) body += c;
  }
  return [...body.matchAll(/^\s*(\w+)\??:/gm)].map(m => m[1]);
}

describe('1 · the read imports exactly its list', () => {
  const code = readCode(READ);
  it('the three program rules, the site and plan check, the live rules, the time and link helpers, the types', () => {
    assert.match(code, /^import 'server-only';\n/);
    assert.deepEqual([...code.matchAll(/from '([^']+)'/g)].map(m => m[1]), [
      './public-club-access',
      './league-game-changes-server',
      './public-team-schedule',
      './public-tournament-data',
      './club-game-live',
      './game-status',
      './timezone',
      './types',
    ]);
  });
  it('no dynamic import, no require, no re-export', () => {
    assert.doesNotMatch(code, /\bimport\s*\(/);
    assert.doesNotMatch(code, /\brequire\s*\(/);
    assert.doesNotMatch(code, /export\s+(\*|\{[^}]*\}|type\s+\{[^}]*\})\s+from/);
  });
});

describe('2 · it reads no table and holds no copy of a rule', () => {
  const code = readCode(READ);
  it('no table read, no database function call, no database client', () => {
    assert.doesNotMatch(code, /\.from\(['"]/);
    assert.doesNotMatch(code, /\.rpc\(/);
    assert.doesNotMatch(code, /supabase/i);
  });
  it('no publish, visibility or draft test of its own', () => {
    for (const re of [/'draft'/, /public_link/, /isPubliclyVisible/, /scheduleVisibility/, /schedulePublishedAt/, /'published'/,
      /onlyPublishedGames/, /isPublicPageEnabled/, /isPublicTournamentStatus/, /isPublicLeagueSeason/, /source_tournament_game_id/,
      /event_type|eventType/, /PUBLIC_EVENT_TYPES|COACH_GAME_EVENT_TYPES/]) {
      assert.doesNotMatch(code, re, `the read holds a copy of a rule: ${re}`);
    }
  });
});

describe('3 · each program’s rule is called, behind its switch and plan', () => {
  const code = readCode(READ);
  const body = code.slice(code.indexOf('export async function readClubGames'));
  it('the home’s door first: a closed site reads nothing', () => {
    assert.ok(body.indexOf(`if (publicClubRefusal(org, 'home')) return empty;`) >= 0);
    assert.ok(body.indexOf(`if (publicClubRefusal(org, 'home')) return empty;`) < body.indexOf('await Promise.all('));
  });
  it('house league and rep teams each ask the site and plan check once, before the rule, and skip it on a no', () => {
    assert.match(body, /const leagueOn = !publicClubRefusal\(org, 'league'\);/);
    assert.match(body, /const teamsOn = !publicClubRefusal\(org, 'teams'\);/);
    assert.match(body, /leagueOn \? publicLeagueGamesBetween\(org\.id, fromIso, toIso\) : null,/);
    assert.match(body, /teamsOn \? getPublicTeamGamesBetween\(\{ org, fromIso, toIso, now: nowMs \}\) : null,/);
    assert.equal(body.match(/publicClubRefusal\(/g)?.length, 3, 'the check is asked once per program');
  });
  it('tournaments answer to their own rule, never the site switch (every tournament page’s rule)', () => {
    assert.match(body, /publicTournamentGamesBetween\(org, days\[days\.length - 1\], today\),/);
    assert.doesNotMatch(code, /publicClubRefusal\(org, 'tournaments'\)/);
  });
  it('all or nothing (G11): the three are awaited together, so one failing throws the whole read', () => {
    assert.equal(body.match(/await Promise\.all\(\[/g)?.length, 1);
    assert.doesNotMatch(body, /allSettled|\.catch\(/);
  });
});

describe('4 · it returns its own short list of fields', () => {
  const code = readCode(READ);
  it('a game row', () => {
    assert.deepEqual(fieldsOf(code, 'ClubGameRow'), [
      'key', 'program', 'day', 'startsAt', 'endsAt', 'group', 'groupOrder', 'home', 'away', 'homeAway', 'place', 'address', 'state',
      'score', 'movedTo', 'path', 'seasonName', 'seasonSlug', 'decided',
    ]);
  });
  it('a tournament row, and the read', () => {
    assert.deepEqual(fieldsOf(code, 'ClubTournamentDay'), ['name', 'path', 'days']);
    // No count of the club's rep teams: the public answer says nothing about teams that do not show (the site editor reads
    // that server-side).
    assert.deepEqual(fieldsOf(code, 'ClubGamesRead'), ['asOf', 'today', 'days', 'rows', 'tournaments', 'checkWindow']);
  });
  it('never a stored game, a note, a score-entry detail or an internal id', () => {
    for (const name of ['ClubGameRow', 'ClubTournamentDay', 'ClubGamesRead']) {
      for (const f of fieldsOf(code, name)) {
        assert.doesNotMatch(f, /^id$|Id$|notes|scoreSubmitted|submitted|entered/i, `${name}.${f}`);
      }
    }
    assert.doesNotMatch(code, /\.\.\.g\b|\.\.\.entry\b|\.\.\.game\b/, 'no stored row spread into a returned one');
  });
  it('a row key is made of what the row shows', () => {
    assert.match(code, /const rowKey = \(r: Omit<ClubGameRow, 'key'>\) => \[r\.program, r\.startsAt \?\? r\.day, r\.group, r\.home, r\.away\]\.join\('\|'\);/);
  });
});

describe('all or nothing (G11): every read on the home’s path throws on a failure, never reads as a quiet day', () => {
  const hl = readCode('lib/league-game-changes-server.ts');
  const hlFn = hl.slice(hl.indexOf('export async function publicLeagueGamesBetween'));
  const t = readCode('lib/public-tournament-data.ts');
  const tFn = t.slice(t.indexOf('export async function publicTournamentGamesBetween'));
  it('house league: seasons, divisions and teams are read strictly (the paged reads and the places read throw already)', () => {
    assert.match(hlFn, /getLeagueSeasons\(orgId, \{ strict: true \}\)/);
    assert.match(hlFn, /getDivisionsForSeason\(season\.id, \{ strict: true \}\)/);
    assert.match(hlFn, /getTeamsForSeason\(season\.id, \{ strict: true \}\)/);
  });
  it('tournaments: the list and each tournament’s games, teams and divisions are read strictly', () => {
    assert.match(tFn, /getTournamentsByOrg\(org\.id, \{ admin: true, strict: true \}\)/);
    assert.match(tFn, /await readScoresGames\(tournament\.id, true\)/);
    const helper = t.slice(t.indexOf('async function readScoresGames'), t.indexOf('function isPublicStatus'));
    for (const read of ['getGames', 'getTeams', 'getDivisions']) assert.match(helper, new RegExp(read + '\\(tournamentId, \\{ admin: true, strict \\}\\)'));
  });
  it('each strict reader throws when asked to', () => {
    const db = readCode('lib/db.ts');
    for (const fn of ['getLeagueSeasons', 'getDivisionsForSeason', 'getTeamsForSeason']) {
      const body = db.slice(db.indexOf(`export async function ${fn}(`), db.indexOf('\n}\n', db.indexOf(`export async function ${fn}(`)));
      assert.match(body, /if \(options\.strict && error\) throw error;/, fn);
    }
    for (const fn of ['getGames', 'getTeams']) {
      const body = db.slice(db.indexOf(`export async function ${fn}(`), db.indexOf('\n}\n', db.indexOf(`export async function ${fn}(`)));
      assert.match(body, /if \(options\.strict && \(error \|\| !data\)\) throw error/, fn);
    }
  });
});

describe('5 · a copied tournament game, a multi-day entry and a practice never come out', () => {
  const view = readCode('lib/family-view.ts');
  const batch = view.slice(view.indexOf('export async function getTeamGameEntriesBetween'));
  it('the rep batch reads games only, never a copy of a tournament game', () => {
    assert.match(batch, /\.in\('event_type', COACH_GAME_EVENT_TYPES\)/);
    assert.match(batch, /\.is\('source_tournament_game_id', null\)/);
    assert.match(readCode('lib/coach-tournament-games.ts'), /export const COACH_GAME_EVENT_TYPES = \['league_game', 'tournament_game'\];/);
  });
  it('from the team’s live season, the one-team view’s definition', () => {
    assert.match(batch, /\.in\('status', \[\.\.\.LIVE_SEASON_STATUSES\]\)\n\s+\.order\('year', \{ ascending: false \}\);/);
    assert.match(view, /\.in\('status', \[\.\.\.LIVE_SEASON_STATUSES\]\)\n\s+\.order\('year', \{ ascending: false \}\)\n\s+\.limit\(1\)/);
    assert.match(view, /import \{ LIVE_SEASON_STATUSES \} from '\.\/season-live';/, 'the one definition of a live season');
  });
  it('tournament games go through the shipped public-game and held-back-opponent steps, behind the Schedule switch', () => {
    const t = readCode('lib/public-tournament-data.ts');
    const helper = t.slice(t.indexOf('async function readScoresGames'), t.indexOf('function isPublicStatus'));
    assert.match(helper, /onlyPublishedGames\(games, divisions\)/);
    assert.match(helper, /publicFrameGame\(publishedGameTeams\(g, openTeamIds\)\)/);
    const fn = t.slice(t.indexOf('export async function publicTournamentGamesBetween'));
    assert.match(fn, /if \(org\.subscriptionStatus === 'canceled'\) return \[\];/);
    assert.match(fn, /\.filter\(isPublicStatus\)/);
    assert.match(fn, /\.filter\(t => isPublicPageEnabled\(t, 'schedule'\)\)/);
    assert.match(fn, /await readScoresGames\(tournament\.id, true\)/);
  });
});

describe('6 · the house league window is applied after the unsent-changes view', () => {
  const day = (d: string, t = '10:00:00') => `2026-11-${d}T${t}.000Z`;
  const from = day('23', '05:00:00'), to = day('26', '05:00:00');
  const game = (over: Record<string, unknown>) => ({
    id: 'g1', scheduledAt: day('25'), endsAt: day('25', '11:00:00'), location: null, orgVenueId: null, orgVenueFacilityId: null,
    status: 'scheduled' as const, movedFrom: null as string | null, ...over,
  });
  const moved = (gameId: string, beforeAt: string, afterAt: string): HeldChange => ({
    id: `c-${gameId}`, gameId, kind: 'moved', source: 'league', createdAt: day('24'),
    before: { scheduledAt: beforeAt, endsAt: null, location: null, venueId: null, facilityId: null, status: 'scheduled', movedFrom: null },
    after: { scheduledAt: afterAt, endsAt: null, location: null, venueId: null, facilityId: null, status: 'scheduled', movedFrom: beforeAt },
  });

  it('a game moved from today to next week, NOT yet sent, still reads today, at the time families were told', () => {
    // The row as stored: next week, with the day families heard kept on it (the database does that on every re-date).
    const stored = game({ scheduledAt: '2026-12-02T15:00:00.000Z', movedFrom: day('25') });
    const out = lastSentInWindow([stored], [moved('g1', day('25'), '2026-12-02T15:00:00.000Z')], from, to);
    assert.equal(out.length, 1);
    assert.equal(out[0].scheduledAt, day('25'));
  });
  it('the same move once SENT reads as moved off today: the day it left is in the window, its new start is not', () => {
    const out = lastSentInWindow([game({ scheduledAt: '2026-12-02T15:00:00.000Z', movedFrom: day('25') })], [], from, to);
    assert.equal(out.length, 1);
    assert.equal(out[0].scheduledAt, '2026-12-02T15:00:00.000Z');
  });
  it('a game moved INTO today by an unsent change reads as its old day and drops out', () => {
    const stored = game({ scheduledAt: day('25'), movedFrom: '2026-11-18T15:00:00.000Z' });
    assert.deepEqual(lastSentInWindow([stored], [moved('g1', '2026-11-18T15:00:00.000Z', day('25'))], from, to), []);
  });
  it('a game added since the last send is not shown', () => {
    const added: HeldChange = { ...moved('g1', day('25'), day('25')), kind: 'added', before: null };
    assert.deepEqual(lastSentInWindow([game({})], [added], from, to), []);
  });
  it('the window is [from, to): the first instant in, the last out', () => {
    assert.equal(lastSentInWindow([game({ scheduledAt: from })], [], from, to).length, 1);
    assert.equal(lastSentInWindow([game({ scheduledAt: to })], [], from, to).length, 0);
  });
});

describe('the live rule for house league (G7) and when a page checks (G6)', () => {
  const start = Date.parse('2026-11-28T14:00:00Z'), end = Date.parse('2026-11-28T15:00:00Z');
  const hl = (over: Record<string, unknown> = {}) => ({
    scheduledAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), status: 'scheduled',
    homeScore: null as number | null, awayScore: null as number | null, ...over,
  });
  it('inside the window: live ("Score after the game"); after it with no score: "No score yet"; completed with scores: final', () => {
    assert.equal(leagueGamePhase(hl(), start - MIN), 'coming');
    assert.equal(leagueGamePhase(hl(), start + 10 * MIN), 'live');
    assert.equal(leagueGamePhase(hl(), end + (LIVE_GRACE_MINUTES - 1) * MIN), 'live');
    assert.equal(leagueGamePhase(hl(), end + LIVE_GRACE_MINUTES * MIN), 'noScore');
    assert.equal(leagueGamePhase(hl({ status: 'completed', homeScore: 3, awayScore: 1 }), start + 10 * MIN), 'final');
    assert.equal(leagueGamePhase(hl({ status: 'postponed' }), start + 10 * MIN), 'postponed');
    assert.equal(leagueGamePhase(hl({ status: 'cancelled' }), start + 10 * MIN), 'cancelled');
  });
  it('the check runs from half an hour before the first game to the end of the last window, and only then', () => {
    const second = start + 3 * 60 * MIN;
    const w = gameDayCheckWindow([
      { startsAt: new Date(second).toISOString(), endsAt: null },
      { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() },
      { startsAt: null, endsAt: null },
    ])!;
    assert.equal(w.fromMs, start - CHECK_OPENS_BEFORE_MINUTES * MIN);
    assert.equal(w.toMs, second + (DEFAULT_GAME_DURATION_MINUTES + LIVE_GRACE_MINUTES) * MIN);
    assert.equal(isGameDayCheckOn(w, w.fromMs - 1), false);
    assert.equal(isGameDayCheckOn(w, w.fromMs), true);
    assert.equal(isGameDayCheckOn(w, w.toMs), false);
    assert.equal(gameDayCheckWindow([]), null);
    assert.equal(isGameDayCheckOn(null), false);
  });
  it('a newer render that shows "Final" ignores an older check still saying "Live now"', () => {
    assert.equal(isNewerGamesRead({ asOf: '2026-11-28T14:10:00Z' }, { asOf: '2026-11-28T14:10:20Z' }), false);
    assert.equal(isNewerGamesRead({ asOf: '2026-11-28T14:10:40Z' }, { asOf: '2026-11-28T14:10:20Z' }), true);
  });
});

describe('7 · no public file reaches the staff calendar', () => {
  // The staff calendar holds every game with none of the publish rules. Its harmless VIEW helpers (club-calendar-view)
  // stay allowed: the house league schedule formats its rows with them.
  const publicEntries = [
    READ, ROUTE, 'app/[orgSlug]/page.tsx',
    ...filesUnder('app/[orgSlug]/league', '.tsx'), ...filesUnder('app/[orgSlug]/league', '.ts'),
    ...filesUnder('app/[orgSlug]/teams', '.tsx'), ...filesUnder('app/[orgSlug]/teams', '.ts'),
    ...filesUnder('app/api/public', '.ts'), ...filesUnder('app/api/league', '.ts'),
    ...filesUnder('components/public', '.tsx'), ...filesUnder('components/public', '.ts'),
  ];
  it('found the public entries', () => assert.ok(publicEntries.length > 40, String(publicEntries.length)));
  it('lib/club-calendar.ts is reachable from none of them (the view helpers are)', () => {
    const reached = reachableFrom(...publicEntries);
    assert.ok(!reached.has('lib/club-calendar.ts'), 'a public path imports the staff calendar');
    assert.ok(reached.has('lib/club-calendar-view.ts'), 'the schedule’s calendar-view import is still there (else re-anchor)');
  });
});

describe('8 · no house league page or route tests "draft" or "schedule published" itself', () => {
  const files = [
    ...filesUnder('app/[orgSlug]/league', '.tsx'), ...filesUnder('app/[orgSlug]/league', '.ts'),
    ...filesUnder('app/api/league', '.ts'),
    'app/[orgSlug]/page.tsx', 'lib/club-home-data.ts', 'lib/club-public-teams.ts', READ,
  ];
  it('found the pages and routes', () => assert.ok(files.length > 15, String(files.length)));
  for (const f of files) {
    it(`${f} asks the one rule`, () => {
      const code = readCode(f);
      assert.doesNotMatch(code, /\b[sS]eason\w*\.status\s*[!=]==?\s*'draft'|\bs\.status\s*[!=]==?\s*'draft'/, 'a draft test of its own');
      assert.doesNotMatch(code, /\.neq\('status',\s*'draft'\)/, 'a draft filter of its own');
      assert.doesNotMatch(code, /schedulePublishedAt|schedule_published_at/, 'a published test of its own');
    });
  }
  it('the rule is defined once, in the house league module, and the games rule asks it', () => {
    const rule = readCode('lib/league-game-changes-server.ts');
    assert.match(rule, /export function isPublicLeagueSeason<S extends Pick<LeagueSeason, 'status'>>\(season: S \| null \| undefined\): season is S \{\n\s+return !!season && season\.status !== 'draft';/);
    assert.match(rule, /export function isDivisionSchedulePublic\(division: Pick<LeagueDivision, 'schedulePublishedAt'>\): boolean \{\n\s+return !!division\.schedulePublishedAt;/);
    assert.match(rule, /function publishedOf\([^)]*\)[^{]*\{\n\s+if \(!isPublicLeagueSeason\(season\)\) return null;/);
    assert.equal(rule.match(/const published = publishedOf\(season, divisions\);/g)?.length, 3, 'every games read asks it');
  });
  it('the schedule passes the season itself, so a draft can never reach the games read', () => {
    assert.match(readCode('app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx'), /publicSeasonGames\(season, divisions\)/);
  });
});

describe('9 · the 30-second check request', () => {
  const code = readCode(ROUTE);
  it('asks the club’s site and plan (the home’s door) before reading', () => {
    assert.match(code, /const org = await resolvePublicClub\(orgSlug, 'home'\);\n\s+if \(!org\) return/);
    assert.match(code, /await readClubGames\(org\)/);
  });
  it('the club is in the path and a query string is refused (an edge keyed on the path alone cannot mix two clubs)', () => {
    assert.match(code, /\{ params \}: \{ params: Promise<\{ orgSlug: string \}> \}/);
    assert.match(code, /if \(new URL\(req\.url\)\.search\) \{\n\s+return NextResponse\.json\(\{ error: [^}]+\}, \{ status: 400, headers: \{ 'Cache-Control': NEVER_HELD \} \}\);/);
    assert.doesNotMatch(code, /searchParams/);
  });
  it('reads and sets no cookie, opens no session, uses no browser connection or live channel', () => {
    assert.doesNotMatch(code, /cookies\(|next\/headers|supabase-server|createServerClient|Set-Cookie|realtime|channel\(/i);
    assert.doesNotMatch(readCode(READ), /cookies\(|next\/headers|supabase-server|realtime|channel\(/i);
  });
  it('held at the edge 15 to 30 seconds, with no serve-stale allowance and no tag cache', () => {
    const held = /s-maxage=(\d+)/.exec(code);
    assert.ok(held, 'an edge hold');
    assert.ok(Number(held![1]) >= 15 && Number(held![1]) <= 30, `s-maxage=${held![1]}`);
    assert.doesNotMatch(code, /stale-while-revalidate|stale-if-error/);
    assert.doesNotMatch(code + readCode(READ), /unstable_cache|revalidateTag|cacheTag|'use cache'/);
  });
  it('a refusal or a failure is never held at the edge', () => {
    assert.equal(code.match(/'Cache-Control': NEVER_HELD/g)?.length, 3, 'the query refusal, not found, and a failed read');
    assert.match(code, /const NEVER_HELD = 'no-store';/);
  });
});
