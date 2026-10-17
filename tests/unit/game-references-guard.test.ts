/**
 * A GAME NAMES ONLY ITS OWN TOURNAMENT'S DIVISION, TEAMS, SPOTS AND FACILITIES (security fix, 2026-10-16; the
 * team-update sweep's second finding). The games route org-checked a game's tournament and then wrote whatever
 * division, team, spot and facility-lane ids it was sent; a game could sit in another organization's division and
 * team schedules. The two generator saves were already safe in the database (migrations 320, 327).
 *
 * These cases pin the rule (lib/game-references.ts) and that each of the route's four other writers applies it before
 * its first write.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_REFERENCE_TABLES, foreignGameReference, referencedIds, type ReferenceTable,
} from '../../lib/game-references';
import { readCode } from './_source-code.ts';

const T = '11111111-1111-4111-8111-111111111111';
const OTHER_T = '99999999-9999-4999-8999-999999999999';
const D = '22222222-2222-4222-8222-222222222222';
const TEAM_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TEAM_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SLOT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LANE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const found = (overrides: Partial<Record<ReferenceTable, Array<[string, string | null]>>> = {}) => ({
  divisions: new Map(overrides.divisions ?? [[D, T]]),
  teams: new Map(overrides.teams ?? [[TEAM_A, T], [TEAM_B, T]]),
  pool_slots: new Map(overrides.pool_slots ?? [[SLOT, T]]),
  schedule_facility_lanes: new Map(overrides.schedule_facility_lanes ?? [[LANE, T]]),
});
const game = { tournament_id: T, division_id: D, home_team_id: TEAM_A, away_team_id: TEAM_B, home_slot_id: SLOT, away_slot_id: null, schedule_facility_lane_id: LANE };

describe('the rule', () => {
  it('names the six referencing columns, and not bracket_id (a grouping key, not a reference)', () => {
    assert.deepEqual(Object.keys(GAME_REFERENCE_TABLES).sort(), [
      'away_slot_id', 'away_team_id', 'division_id', 'home_slot_id', 'home_team_id', 'schedule_facility_lane_id',
    ]);
  });

  it('reads each table once for the ids the rows name; empty columns are skipped', () => {
    assert.deepEqual(referencedIds([game, { ...game, home_team_id: '', away_team_id: undefined }]), {
      divisions: [D], teams: [TEAM_A, TEAM_B], pool_slots: [SLOT], schedule_facility_lanes: [LANE],
    });
    assert.deepEqual(referencedIds([{ tournament_id: T }]), { divisions: [], teams: [], pool_slots: [], schedule_facility_lanes: [] });
  });

  it('a value that is not an id refuses before anything is read', () => {
    assert.equal(referencedIds([{ ...game, home_team_id: 'x),id.not.is.null' }]), null);
    assert.equal(referencedIds([{ ...game, division_id: 7 }]), null);
  });

  it('admits a game whose references are all its own tournament’s', () => {
    assert.equal(foreignGameReference([game], found()), false);
    assert.equal(foreignGameReference([{ tournament_id: T, home_team_id: null, away_team_id: null }], found()), false);
  });

  it('refuses any reference to another tournament’s row, or to a row that does not exist', () => {
    for (const [table, id] of [['divisions', D], ['teams', TEAM_A], ['pool_slots', SLOT], ['schedule_facility_lanes', LANE]] as const) {
      assert.equal(foreignGameReference([game], found({ [table]: [[id, OTHER_T]] } as never)), true, `${table} of another tournament`);
      assert.equal(foreignGameReference([game], found({ [table]: [] } as never)), true, `${table} missing`);
    }
    assert.equal(foreignGameReference([game], found({ divisions: [[D, null]] })), true, 'a division with no tournament');
    assert.equal(foreignGameReference([game, { ...game, tournament_id: OTHER_T }], found()), true, 'one game of a batch');
  });

  it('refuses a game that names no tournament, even with no references', () => {
    for (const tournament_id of [undefined, null, '', 7]) {
      assert.equal(foreignGameReference([{ tournament_id }], found()), true, String(tournament_id));
    }
  });
});

describe('the games route applies it before each writer’s first write', () => {
  const route = readCode('app/api/admin/games/route.ts');
  const between = (from: string, to: string) => {
    const a = route.indexOf(from);
    const b = route.indexOf(to, a + 1);
    assert.ok(a >= 0 && b > a, `found ${from} … ${to}`);
    return route.slice(a, b);
  };
  const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };

  it('bulk-save', () => {
    const s = between("if (action === 'bulk-save')", "else if (action === 'create')");
    assert.ok(at(s, 'const foreignRef = await gameReferencesRefusal(rows as GameReferenceRow[]);\n      if (foreignRef) return foreignReferenceResponse(foreignRef);') < at(s, ".from('games').insert(rows)"));
  });

  it('create', () => {
    const s = between("else if (action === 'create')", "else if (action === 'delete-game')");
    assert.ok(at(s, 'const foreignCreateRef = await gameReferencesRefusal(rows);\n      if (foreignCreateRef) return foreignReferenceResponse(foreignCreateRef);') < at(s, ".from('games').insert(rows)"));
  });

  it('save-bracket — its new games’ teams, before the loop’s first update', () => {
    const s = between("else if (action === 'save-bracket'", "else if (action === 'replace-division-round-robin'");
    const check = at(s, 'if (foreignBracketRef) return foreignReferenceResponse(foreignBracketRef);');
    assert.match(s, /gameReferencesRefusal\(\(games as any\[\]\)\.filter\(g => !g\.sourceGameId\)\.map\(g => \(\{\s*tournament_id: divRow\.tournament_id, home_team_id: g\.homeTeamId \|\| null, away_team_id: g\.awayTeamId \|\| null,/);
    assert.ok(check < at(s, ".from('games').update(common)"));
    assert.ok(check < at(s, ".from('games').insert(inserts)"));
    // An edited game's shared fields carry no team, spot or lane — only new games name teams.
    const common = s.slice(at(s, 'const common: Record<string, unknown> = {'), at(s, 'if (g.sourceGameId) {'));
    assert.doesNotMatch(common, /team_id|slot_id|schedule_facility_lane_id/);
  });

  it('the one-game update — teams and lane', () => {
    const s = between("if (action === 'update')", "else if (action === 'cancel')");
    assert.match(s, /gameReferencesRefusal\(\[\{\s*tournament_id: gameRow\.tournamentId,\s*home_team_id: updates\.home_team_id,\s*away_team_id: updates\.away_team_id,\s*schedule_facility_lane_id: updates\.schedule_facility_lane_id,\s*\}\]\);\s*if \(foreignRef\) return foreignReferenceResponse\(foreignRef\);/);
    assert.ok(at(s, 'if (foreignRef) return foreignReferenceResponse(foreignRef);') < at(s, ".from('games').update(updates)"));
    assert.doesNotMatch(s, /updates\.(home|away)_slot_id\s*=|updates\.division_id\s*=/, 'the update sets no spot or division');
  });

  it('the two id-based deletes treat a game with no tournament as not found (no check would run for it)', () => {
    const del = between("else if (action === 'delete-game')", "else if (action === 'save-bracket'");
    assert.ok(at(del, "if ((rows?.length ?? 0) !== ids.length || (rows ?? []).some(r => !r.tournament_id)) {") < at(del, ".from('games').delete()"));
    const dels = between("else if (action === 'delete-games')", "else if (action === 'delete-division-playoff-games'");
    assert.ok(at(dels, "if ((rows?.length ?? 0) !== ids.length || (rows ?? []).some(row => !row.tournament_id)) {") < at(dels, ".from('games').delete()"));
  });

  it('the generator saves pass their rows to the database functions that refuse a foreign reference', () => {
    for (const fn of ['replace_division_round_robin_games', 'replace_division_playoff_games']) {
      assert.match(route, new RegExp(`supabase\\.rpc\\('${fn}', \\{\\s*p_division_id: divisionId,`));
    }
    const mig320 = readCode('supabase/migrations/320_a_round_robin_draft_saves_in_one_step.sql');
    const mig327 = readCode('supabase/migrations/327_a_playoff_draft_saves_with_its_plan.sql');
    assert.match(mig320, /t\.id = g\.home_team_id AND t\.tournament_id = v_tournament_id/);
    assert.match(mig320, /ps\.id = g\.home_slot_id AND ps\.tournament_id = v_tournament_id/);
    assert.match(mig327, /t\.id = g\.home_team_id AND t\.division_id = p_division_id/);
  });
});
