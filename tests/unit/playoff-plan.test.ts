import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYOFF_PLAN_KEYS, hasPlayoffPlan, mergePlayoffPlan, pickPlayoffPlan } from '../../lib/playoff-plan.ts';
import { buildPlayoffPicture } from '../../lib/playoff-picture.ts';
import { BRACKET_WORDS } from '../../lib/schedule-words.ts';
import type { Division, Game, PlayoffConfig, Tournament } from '../../lib/types';
import type { DivisionStandingRow } from '../../lib/tie-breakers.ts';

/**
 * Tournament admin redesign, Stage 3 addendum — A63 (ruled 2026-10-12): the division's playoff PLAN is saved with the
 * bracket, and a division carries no plan until one is saved. Before: the generator never wrote it, and a division added
 * on the Divisions page carried "top 4, single elimination" nobody chose — the public standings drew a cut line from it.
 * P1 (owner, 2026-10-12): divisions with no playoff games lost the silent plan in mig 327.
 */

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const MIG = src('supabase/migrations/327_a_playoff_draft_saves_with_its_plan.sql');

describe('the plan keys — one list, in the code and in the database', () => {
  test('the function and the cleanup name exactly PLAYOFF_PLAN_KEYS', () => {
    const lists = [...MIG.matchAll(/ARRAY\[((?:'[A-Za-z]+',?\s*)+)\]/g)].map(m => m[1].match(/'([A-Za-z]+)'/g)!.map(s => s.slice(1, -1)));
    assert.ok(lists.length >= 3, 'the cleanup (twice) and the function each name the keys');
    for (const l of lists) assert.deepEqual([...l].sort(), [...PLAYOFF_PLAN_KEYS].sort());
  });
  test('only the server may call the save', () => {
    assert.match(MIG, /REVOKE ALL ON FUNCTION public\.replace_division_playoff_games\(uuid, uuid\[\], jsonb, jsonb\) FROM anon, authenticated;/);
    assert.match(MIG, /GRANT EXECUTE ON FUNCTION public\.replace_division_playoff_games\(uuid, uuid\[\], jsonb, jsonb\) TO service_role;/);
    for (const code of ['division_not_found', 'foreign_reference', 'schedule_changed', 'shape_held', 'invalid']) assert.match(MIG, new RegExp(`'${code}'`));
  });
  test('the cleanup reaches only divisions with no playoff game, and keeps everything that is not the plan', () => {
    assert.match(MIG, /AND NOT EXISTS \(SELECT 1 FROM public\.games g WHERE g\.division_id = d\.id AND g\.is_playoff\);/);
    assert.match(MIG, /SET playoff_config = NULLIF\(\n\s+d\.playoff_config - ARRAY/);
  });
});

describe('a plan is the plan keys, and only they change', () => {
  const kept = { tieBreakers: ['h2h', 'rd'], maxRunDiffPerGame: 7, coinTossResults: { 'a|b': ['a', 'b'] } } as Partial<PlayoffConfig>;
  test('saving a plan keeps the tie-breakers, the run-differential cap and the coin tosses', () => {
    const before = { type: 'single', crossover: 'standard', hasThirdPlace: false, teamsQualifying: 8, ...kept } as Partial<PlayoffConfig>;
    const after = mergePlayoffPlan(before, { type: 'single', format: 'double', crossover: 'reseed', hasThirdPlace: false, teamsQualifying: 4 });
    assert.deepEqual(after, { ...kept, type: 'single', format: 'double', crossover: 'reseed', hasThirdPlace: false, teamsQualifying: 4 });
  });
  test('a key the new plan leaves out goes (the plan is replaced whole), and no plan leaves the config alone', () => {
    const after = mergePlayoffPlan({ teamsQualifying: 8, tierConfigs: [], ...kept }, { format: 'single', crossover: 'reseed' });
    assert.equal('teamsQualifying' in (after ?? {}), false);
    assert.equal('tierConfigs' in (after ?? {}), false);
    assert.deepEqual(mergePlayoffPlan({ teamsQualifying: 4, ...kept }, null), { teamsQualifying: 4, ...kept });
  });
  test('a plan sent with standings rules in it carries only its plan keys', () => {
    assert.deepEqual(pickPlayoffPlan({ teamsQualifying: 4, ...kept }), { teamsQualifying: 4 });
  });
  test('a config of tie-breakers alone is not a plan; the customer bracket with no count is', () => {
    assert.equal(hasPlayoffPlan(null), false);
    assert.equal(hasPlayoffPlan({ tieBreakers: null, maxRunDiffPerGame: null } as unknown as PlayoffConfig), false);
    assert.equal(hasPlayoffPlan({ type: 'single', crossover: 'standard', hasThirdPlace: false } as unknown as PlayoffConfig), true);
    assert.equal(hasPlayoffPlan({ teamsQualifying: 4 } as unknown as PlayoffConfig), true);
  });
});

describe('every reader: no plan = no cut line, no "Top N advance"', () => {
  test('the public Playoffs picture (and its "Top N advance" kicker) reads 0 and marks nobody as through', () => {
    const division = { id: 'u11', name: 'U11', pools: [], playoffConfig: undefined } as unknown as Division;
    const rows = ['a', 'b', 'c', 'd'].map((id, i) => ({ teamId: id, teamName: id.toUpperCase(), gp: 3, w: 3 - i, l: i, t: 0, pts: 6 - 2 * i, rd: 0, rf: 10, ra: 5 })) as unknown as DivisionStandingRow[];
    const games = [{ id: 'g1', divisionId: 'u11', isPlayoff: true, status: 'scheduled', homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4', bracketCode: 'SF1' }] as unknown as Game[];
    const pic = buildPlayoffPicture({} as Tournament, [division], [], games, { u11: rows }, id => id ?? 'TBD', () => '', '2026-10-12');
    assert.equal(pic.divisions[0].teamsQualifying, 0);
    assert.equal(pic.divisions[0].seeds.some(s => s.qualified), false);
    assert.doesNotMatch(pic.divisions[0].narrative.join(' '), /advancing/);
    assert.match(src('app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx'), /div\.teamsQualifying > 0 \? ` · Top \$\{div\.teamsQualifying\} advance` : ''/);
  });
  test('the public standings: no cut line and no caption without a count', () => {
    const s = src('components/public/StandingsContent.tsx');
    assert.match(s, /const teamsQualifying = playoffCfg\?\.teamsQualifying \?\? 0;/);
    assert.match(s, /const advanceCaption = teamsQualifying > 0/);
    assert.match(s, /if \(teamsQualifying <= 0 \|\| !gamesStarted\) return ids;/);
  });
  test('a team\'s public page: no playoff spot without a count', () => {
    const s = src('app/api/public/team-profile/route.ts');
    assert.match(s, /const teamsQualifying = division\.playoffConfig\?\.teamsQualifying \?\? null;/);
    assert.match(s, /teamsQualifying !== null && poolRank !== null && poolRank <= teamsQualifying/);
  });
  test('the Bracket view\'s caption is the format alone', () => {
    assert.equal(BRACKET_WORDS.caption('Single elimination', 0, true), 'Single elimination');
    assert.match(src('app/[orgSlug]/admin/tournaments/schedule/components/PlayoffBracketView.tsx'), /cfg\?\.teamsQualifying \?\? 0/);
  });
  test('the schedule\'s playoff measures fall back to the accepted teams; the game window to the division\'s teams', () => {
    assert.match(src('lib/schedule-metrics.ts'), /activeDivision\?\.playoffConfig\?\.teamsQualifying \?\? acceptedTeamCount/);
    assert.match(src('app/[orgSlug]/admin/tournaments/schedule/components/GameWindow.tsx'), /pDiv\?\.playoffConfig\?\.teamsQualifying \|\| divisionTeams\.length/);
  });
});

describe('who writes a plan — the generator, and nothing else', () => {
  test('the Divisions page writes standings rules only', () => {
    assert.doesNotMatch(src('app/[orgSlug]/admin/tournaments/divisions/DivisionRecord.tsx'), /playoffDefaults|teamsQualifying: 4/);
  });
  test('the old insert writes no default plan', () => {
    const db = src('lib/db.ts');
    assert.match(db, /playoff_config: g\.playoffConfig \?\? null,/);
    assert.doesNotMatch(db, /playoff_config: g\.playoffConfig \|\| \{ type: 'single'/);
  });
  test('the divisions route MERGES a division edit, so an edit never drops a saved plan', () => {
    assert.match(src('app/api/admin/divisions/route.ts'), /const mergedConfig = \{ \.\.\.currentConfig, \.\.\.incomingConfig \};/);
  });
  test('the games route sends the plan keys only to the one-step save', () => {
    const route = src('app/api/admin/games/route.ts');
    assert.match(route, /p_plan: plan == null \? null : pickPlayoffPlan\(plan\),/);
  });
});

describe('the public Playoffs tab: a saved plan or a playoff game (A63 — no longer "any config")', () => {
  test('a tie-breaker edit no longer decides it, and a hand-built bracket still has it', () => {
    const s = src('app/[orgSlug]/[tournamentSlug]/layout.tsx');
    assert.match(s, /\(divisions\.some\(d => hasPlayoffPlan\(d\.playoffConfig\)\) \|\| playoffGamesExist\)/);
    assert.doesNotMatch(s, /d\.playoffConfig != null/);
    assert.match(s, /bracketVisible \? hasPlayoffGames\(tournament\.id\) : Promise\.resolve\(false\)/, 'raced with the other reads');
  });
});
