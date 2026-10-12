import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playoffTeamsKnown, type PlayoffSidesGame } from '../../lib/playoffs-set-rule.ts';
import { PLAYOFFS_SET_WORDS } from '../../lib/schedule-words.ts';

/**
 * Tournament admin redesign, Stage 3 addendum — A69 (ruled 2026-10-12) and the build-start rulings P3 + P4: "Playoffs
 * are set" goes ONCE PER DIVISION, when a PUBLISHED division's playoff teams are all known, to staff and to followers of
 * THAT division's teams. Before (F102): the first bracket SAVED anywhere in the tournament sent it — unpublished, before
 * the round robin, to every follower of every team, "the seeding is locked" before any seeding existed.
 */

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const g = (over: Partial<PlayoffSidesGame>): PlayoffSidesGame => ({
  status: 'scheduled', homeTeamId: null, awayTeamId: null, homePlaceholder: null, awayPlaceholder: null, ...over,
});

describe('every playoff team is known', () => {
  const semis = (h1: string | null, a1: string | null) => [
    g({ homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4', homeTeamId: h1, awayTeamId: a1 }),
    g({ homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #3', homeTeamId: 'b', awayTeamId: 'c' }),
    g({ homePlaceholder: 'Winner SF1', awayPlaceholder: 'Winner SF2' }),
  ];
  test('the seeds filled, the final waiting on its semifinals → known', () => {
    assert.equal(playoffTeamsKnown(semis('a', 'd')), true);
  });
  test('a side still waiting on a seed or a pool place → not yet', () => {
    assert.equal(playoffTeamsKnown(semis('a', null)), false);
    assert.equal(playoffTeamsKnown([g({ homePlaceholder: '1st Pool Red', awayPlaceholder: '2nd Pool Blue', homeTeamId: 'a' })]), false);
  });
  test('a bye: the top seed waits for a winner, and is known', () => {
    assert.equal(playoffTeamsKnown([
      g({ homePlaceholder: 'Seed #3', awayPlaceholder: 'Seed #6', homeTeamId: 'c', awayTeamId: 'f' }),
      g({ homePlaceholder: 'Seed #1', awayPlaceholder: 'Winner QF1', homeTeamId: 'a' }),
    ]), true);
  });
  test('a playoffs-only bracket built by hand (teams, no placeholders) → known; a blank side → not', () => {
    assert.equal(playoffTeamsKnown([g({ homeTeamId: 'a', awayTeamId: 'b' })]), true);
    assert.equal(playoffTeamsKnown([g({ homeTeamId: 'a' })]), false);
  });
  test('a cancelled game is not counted; no bracket at all is never "set"', () => {
    assert.equal(playoffTeamsKnown([...semis('a', 'd'), g({ status: 'cancelled', homePlaceholder: 'Seed #9' })]), true);
    assert.equal(playoffTeamsKnown([]), false);
    assert.equal(playoffTeamsKnown([g({ status: 'cancelled', homeTeamId: 'a', awayTeamId: 'b' })]), false);
  });
});

describe('the moment: published, not yet announced, every team known, no toss owed — cheapest first', () => {
  const lib = src('lib/playoffs-set.ts');
  const fn = lib.slice(lib.indexOf('export async function announcePlayoffsSetIfReady('), lib.indexOf('export async function fillPlayoffTeams('));
  test('the division and its playoff sides are read first; the tournament only once every team is known', () => {
    assert.match(fn, /\.eq\('division_id', divisionId\)\n\s+\.eq\('is_playoff', true\)/);
    assert.ok(fn.indexOf('if (!playoffTeamsKnown(playoffGames)) return;') < fn.indexOf('getGames(tournamentId'), 'a round robin under way never reads the tournament');
  });
  test('a coin toss still owed waits for the toss (the seeds it decides can swap), before the claim', () => {
    assert.match(fn, /if \(pendingCoinTosses\(\{ divisions: \[division\], teams, games, settings: tournament\.settings \}\)\.length > 0\) return;/);
    assert.ok(fn.indexOf('pendingCoinTosses(') < fn.indexOf("is('playoffs_announced_at', null)"));
  });
});

describe('the words name the division (/marketing 2026-10-12)', () => {
  test('staff and fans', () => {
    assert.equal(PLAYOFFS_SET_WORDS.staffTitle('U13 Boys'), '🏆 U13 Boys playoffs are set');
    assert.equal(PLAYOFFS_SET_WORDS.staffBody('Fall Classic'), 'Fall Classic · every playoff team is known. See who plays who.');
    assert.equal(PLAYOFFS_SET_WORDS.fanTitle('U11 Girls'), '🏆 U11 Girls playoffs are set!');
    assert.doesNotMatch(Object.values(PLAYOFFS_SET_WORDS).map(f => f('X')).join(' '), /seeding is locked|&/);
  });
});

describe('never on a save as such — every writer asks the rule after it writes', () => {
  const route = src('app/api/admin/games/route.ts');
  test('the first-save announcement is gone, and nothing writes the tournament-wide stamp', () => {
    // Code, not the comments that say why it went (a guard that punished the explanation would get it deleted).
    const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(code(route), /announcePlayoffsIfFirstTime|playoffs_published_at/);
    assert.doesNotMatch(code(src('lib/playoffs-set.ts')), /playoffs_published_at/);
  });
  test('bulk-save, save-bracket, the generator\'s save and a coin toss fill the teams, then ask', () => {
    const bulk = route.slice(route.indexOf("if (action === 'bulk-save')"), route.indexOf("else if (action === 'create')"));
    assert.match(bulk, /await fillPlayoffTeamsThenAnnounce\(tid as string, divisionIds, ctx\.user\.id\);/);
    const bracket = route.slice(route.indexOf("action === 'save-bracket'"), route.indexOf("action === 'replace-division-round-robin'"));
    assert.match(bracket, /await fillPlayoffTeamsThenAnnounce\(divRow\.tournament_id, \[divisionId\], ctx\.user\.id\);/);
    const gen = route.slice(route.indexOf("action === 'replace-division-playoffs'"), route.indexOf("action === 'delete-division-games'"));
    assert.ok(gen.indexOf('await fillPlayoffTeams(') > gen.indexOf(".rpc('replace_division_playoff_games'"));
    assert.ok(gen.indexOf('announcePlayoffsSetIfReady(divisionId') > gen.indexOf('await fillPlayoffTeams('));
    assert.match(src('app/api/admin/divisions/route.ts'), /await fillPlayoffTeamsThenAnnounce\(div\.tournament_id, \[id\], ctx\.user\.id\);/);
    const lib = src('lib/playoffs-set.ts');
    const both = lib.slice(lib.indexOf('export async function fillPlayoffTeamsThenAnnounce('), lib.indexOf('export async function announcePlayoffsSetForGame('));
    assert.ok(both.indexOf('await fillPlayoffTeams(') < both.indexOf('announcePlayoffsSetIfReady('), 'the teams before the question');
  });
  test('both generators\' saves tell a replaced game from where its followers last heard it', () => {
    for (const action of ['replace-division-round-robin', 'replace-division-playoffs']) {
      const body = route.slice(route.indexOf(`action === '${action}'`));
      assert.match(body.slice(0, 6000), /readReplaced\(divRow\.tournament_id, divisionId, replaceIds\)/, action);
    }
    const read = route.slice(route.indexOf('async function readReplaced('), route.indexOf('/**', route.indexOf('async function readReplaced(')));
    assert.match(read, /from\('game_change_notices'\)/);
  });
  test('the score that ends the round robin asks — a terminal score only', () => {
    assert.match(src('lib/tournament-scoring-service.ts'), /if \(status === 'completed' \|\| status === 'forfeit'\) void announcePlayoffsSetForGame\(gameId\);/);
  });
  test('publishing asks — for the divisions the write published, never an id merely named', () => {
    const div = src('app/api/admin/divisions/route.ts');
    assert.match(div, /if \(vis === 'published'\) await announcePlayoffsSetIfReady\(agId, ctx\.user\.id\);/);
    assert.match(div, /if \(vis === 'published'\) await Promise\.all\(\(published \?\? \[\]\)\.map\(d => announcePlayoffsSetIfReady\(d\.id as string, ctx\.user\.id\)\)\);/);
    const pub = src('app/api/admin/schedule-publish/route.ts');
    assert.match(pub, /await Promise\.all\(\(publishedRows \?\? \[\]\)\.map\(row => announcePlayoffsSetIfReady\(row\.id as string, ctx\.user\.id\)\)\);/);
    assert.doesNotMatch(pub, /divisionIds\)?\.map\(\w+ => announcePlayoffsSetIfReady/);
  });
  test('/review: every route AWAITS it — this host can drop work left after the response, and the claim makes a drop permanent', () => {
    for (const p of ['app/api/admin/games/route.ts', 'app/api/admin/divisions/route.ts', 'app/api/admin/schedule-publish/route.ts']) {
      assert.doesNotMatch(src(p), /void announcePlayoffsSetIfReady|void fillPlayoffTeamsThenAnnounce/, p);
    }
    const lib = src('lib/playoffs-set.ts');
    const both = lib.slice(lib.indexOf('export async function fillPlayoffTeamsThenAnnounce('), lib.indexOf('export async function announcePlayoffsSetForGame('));
    assert.match(both, /await Promise\.all\(ids\.map\(divisionId => announcePlayoffsSetIfReady\(divisionId, actorUserId\)\)\);/);
  });
});

describe('the announcement itself: once, published, that division\'s followers', () => {
  const lib = src('lib/playoffs-set.ts');
  test('it reads published and not-yet-announced first, and claims NULL → now() while still published', () => {
    assert.match(lib, /if \(!div \|\| div\.schedule_visibility !== 'published' \|\| div\.playoffs_announced_at\) return;/);
    assert.match(lib, /\.update\(\{ playoffs_announced_at: new Date\(\)\.toISOString\(\) \}\)\n\s+\.eq\('id', divisionId\)\n\s+\.is\('playoffs_announced_at', null\)\n\s+\.eq\('schedule_visibility', 'published'\)/);
    assert.ok(lib.indexOf("is('playoffs_announced_at', null)") < lib.indexOf('notify({'), 'only the winning claim sends');
  });
  test('/review: the org is read before the claim, and both sends finish before it returns', () => {
    assert.ok(lib.indexOf("from('organizations')") < lib.indexOf('.update({ playoffs_announced_at'), 'a claim with nowhere to send would silence the division');
    assert.match(lib, /await Promise\.all\(\[\n\s+notify\(\{/);
    assert.doesNotMatch(lib, /\}\)\.catch\(console\.error\);\n\s+const divisionTeamIds/);
  });
  test('P3: the fan push is scoped to that division\'s teams', () => {
    assert.match(lib, /notifyFansForPlayoff\(tournamentId, \{ divisionName: div\.name as string, teamIds: divisionTeamIds \}\)/);
    const fan = src('lib/fan-notify.ts');
    const fn = fan.slice(fan.indexOf('export async function notifyFansForPlayoff('), fan.indexOf('export async function notifyFansForChampions('));
    assert.match(fn, /mergedTargets\(ctx\.tournament\.id, 'game_alerts', \[\.\.\.division\.teamIds\]\)/);
    assert.match(fn, /if \(division\.teamIds\.length === 0\) return;/, 'no teams → nobody, never the whole tournament');
  });
  test('the migration stamps only a division families were already told about: the old push went, a team is known', () => {
    const mig = src('supabase/migrations/327_a_playoff_draft_saves_with_its_plan.sql');
    assert.match(mig, /SET playoffs_announced_at = now\(\)\n  FROM public\.tournaments t\n WHERE t\.id = d\.tournament_id\n   AND t\.playoffs_published_at IS NOT NULL\n   AND d\.playoffs_announced_at IS NULL\n   AND EXISTS \(/);
    assert.match(mig, /AND \(g\.home_team_id IS NOT NULL OR g\.away_team_id IS NOT NULL\)/);
  });
});
