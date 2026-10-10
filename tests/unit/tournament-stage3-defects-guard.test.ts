import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';

/**
 * Tournament admin redesign, Stage 3 defects pass (A45, 2026-10-09). The pure rules are proven in their own tests
 * (game-delete-policy, schedule-generator-taken-slots, bracket-save-schedule-notices, schedule-save-words); this
 * pins the WIRING — the places a later edit could quietly put the old behaviour back.
 */

const GENERATOR = 'app/[orgSlug]/admin/tournaments/schedule/Generator.tsx';
const WIZARD = 'app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx';
const PAGE = 'app/[orgSlug]/admin/tournaments/schedule/page.tsx';
// Stage 3 Part 0 split the page: the Publish window and the sandbox's refusal test live here now.
const PUBLISH = 'app/[orgSlug]/admin/tournaments/schedule/components/PublishScheduleModal.tsx';
const SANDBOX = 'lib/coach-sandbox-refusal.ts';
const ROUTE = 'app/api/admin/games/route.ts';
const MIGRATION = 'supabase/migrations/320_a_round_robin_draft_saves_in_one_step.sql';

describe('F70 + P1 — a draft saves in one step and never deletes a played game', () => {
  const gen = readCode(GENERATOR);

  it('the Replace all | Build from current switch is gone, and so is "permanently clear"', () => {
    assert.doesNotMatch(gen, /Replace all|Build from current|permanently clear|generationScope/);
  });

  it('the generator saves through ONE request — never a delete followed by a save', () => {
    assert.match(gen, /action: 'replace-division-round-robin'/);
    assert.doesNotMatch(gen, /'delete-division-games'|'delete-games'|'bulk-save'/);
  });

  it('a stale draft reloads the schedule, a refusal never shows raw server text', () => {
    assert.match(gen, /if \(data\.code === 'schedule_changed'\) onStale\?\.\(\);/);
    assert.match(gen, /throw new Error\(refusalReason\(res\.status, data\.error, DRAFT_SAVE_FAILED\.other\)\)/);
    assert.match(readCode(PAGE), /onStale=\{\(\) => \{ void reloadGames\(\); \}\}/);
  });

  it('only round-robin games cover a matchup, and only placed kept games take a slot (/review)', () => {
    assert.equal((gen.match(/partial\.preservedGames\s*\.filter\(game => !game\.isPlayoff\)/g) ?? []).length, 2);
    assert.match(gen, /fixedAssignments: placedPreservedGames\.map\(gameToFixedAssignment\)/);
    assert.match(gen, /const placedPreservedGames = preservedExistingGames\.filter\(game => game\.date && game\.time\);/);
  });

  it('the route hands the whole save to the database function, and the division delete keeps the narrowed scope', () => {
    const route = readCode(ROUTE);
    assert.match(route, /action === 'replace-division-round-robin'/);
    assert.match(route, /supabase\.rpc\('replace_division_round_robin_games'/);
    assert.match(route, /applyDivisionRoundRobinDeleteScope\(supabase\.from\('games'\)\.delete\(\), divisionId\)/);
  });

  it('the function refuses before writing, removes then inserts in one transaction, and is server-only', () => {
    const sql = readSource(MIGRATION);
    const body = sql.slice(sql.indexOf('AS $$'), sql.lastIndexOf('$$;'));
    // One save per division at a time, and another tournament's team / slot / temporary facility refused first.
    assert.match(body, /FROM public\.divisions WHERE id = p_division_id FOR UPDATE;/);
    assert.ok(body.indexOf("'foreign_reference'") < body.indexOf("'schedule_changed'"));
    // EXACTLY the division's games still to play — a list missing one, or empty after another save, is refused.
    assert.match(body, /IF v_current <> cardinality\(v_replace_ids\) OR v_matched <> cardinality\(v_replace_ids\) THEN/);
    const lock = body.indexOf('FOR UPDATE');
    const refuse = body.indexOf("'schedule_changed'");
    const remove = body.indexOf('DELETE FROM public.games');
    const insert = body.indexOf('INSERT INTO public.games');
    assert.ok(lock > 0 && lock < refuse && refuse < remove && remove < insert, 'lock → refuse → remove → insert');
    // Only replaceable games are ever in reach: the same four conditions on the lock and on the delete.
    for (const guard of ["is_playoff = false", "status = 'scheduled'", 'generator_locked = false', 'division_id = p_division_id']) {
      assert.equal(body.split(guard).length - 1, 2, guard);
    }
    // The draft is stamped with the division's own tournament, as a scheduled round-robin game.
    assert.match(body, /v_tournament_id, p_division_id, g\.home_team_id/);
    assert.match(body, /'scheduled', false, COALESCE\(g\.generator_locked, false\)/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.replace_division_round_robin_games\(uuid, uuid\[\], jsonb\) FROM anon, authenticated;/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.replace_division_round_robin_games\(uuid, uuid\[\], jsonb\) TO service_role;/);
  });
});

describe('F69 — both generators are offered only the slots no kept game holds', () => {
  it('the round-robin and the playoff generator filter their slots through the shared rule', () => {
    assert.match(readCode(GENERATOR), /return slotsClearOfTakenGames\(totalSlots, \{/);
    assert.match(readCode(WIZARD), /return slotsClearOfTakenGames\(filterStartsAfterRoundRobinCompletion\(totalSlots, roundRobinCompletion\), \{/);
  });

  it('the playoff generator reads the whole tournament\'s games, not only its own division\'s', () => {
    assert.match(readCode(WIZARD), /setTournamentGames\(games as Game\[\]\)/);
  });
});

describe('F71 — a refused save says why', () => {
  const page = readCode(PAGE);

  it('the save handler reads the reply, keeps the sandbox branch first, and throws so the row stays open', () => {
    const sandbox = page.indexOf("if (saveRes.headers.get('X-Sandbox-Blocked') === '1')");
    const refused = page.indexOf('if (await refusedWrite(saveRes, SCHEDULE_REFUSAL_TITLE.saveGame)) {');
    const refresh = page.indexOf('await refresh();', refused);
    assert.ok(sandbox > 0 && sandbox < refused && refused < refresh);
    // The refusal can be because the game changed: reload, then throw (the row stays open, a move rolls back).
    // A quiet re-read (no loading state), so the open inline row survives it.
    assert.match(page.slice(refused, refresh), /void reloadGames\(\);\s*throw new Error\('refused'\);/);
  });

  it('one helper reports a refused write — never the sandbox\'s by-design refusal', () => {
    assert.match(page, /async function refusedWrite\(res: Response, title: string, fallback\?: string\): Promise<boolean> \{\s*if \(res\.ok \|\| isSandboxRefusal\(res\)\) return false;/);
    assert.match(readCode(SANDBOX), /export const isSandboxRefusal = \(res: Response\): boolean => sandboxRefusal\(res, null\) !== null;/);
  });

  it('Cancel Game, Reinstate, Unpublish, Unpublish all and the close-on-publish step read their replies too', () => {
    assert.match(page, /refusedWrite\(res, action === 'cancel' \? SCHEDULE_REFUSAL_TITLE\.cancelGame : SCHEDULE_REFUSAL_TITLE\.reinstateGame\)/);
    assert.match(page, /refusedWrite\(res, SCHEDULE_REFUSAL_TITLE\.unpublish, SCHEDULE_REFUSAL\.divisionFallback\)/);
    assert.match(page, /title: SCHEDULE_REFUSAL_TITLE\.unpublishAll,/);
    assert.match(readCode(PUBLISH), /readRefusal\(refused, SCHEDULE_REFUSAL\.divisionFallback\)/);
  });
});

describe('F72 — the bracket editor\'s save records the games it moved', () => {
  it('save-bracket keeps each updated game\'s "before" row and announces the batch once', () => {
    const route = readCode(ROUTE);
    const start = route.indexOf("action === 'save-bracket'");
    const end = route.indexOf("action === 'replace-division-round-robin'");
    const block = route.slice(start, end);
    assert.match(block, /bracketBefore\.set\(g\.sourceGameId, existingRow/);
    assert.match(block, /await announceScheduleChanges\(ctx\.org, divRow\.tournament_id, bracketBefore\)/);
  });
});

describe('F73 + the gate key', () => {
  const page = readCode(PAGE);

  it('the reminder sentence shows only under the route\'s own rule', () => {
    const publish = readCode(PUBLISH);
    assert.match(publish, /willScheduleGameDayReminder\(\{ notify, planId, settings: tournament\.settings \}\)/);
    assert.match(publish, /targets\.length > 0 && willRemind && \(/);
    assert.doesNotMatch(page + publish, /sent even if the box above is left unchecked/);
  });

  it('the playoff generator\'s doors read playoff_generator, the round-robin generator keeps auto_schedule', () => {
    assert.match(page, /const canAutoBracket = currentOrg \? hasPlanFeature\(currentOrg\.planId, 'playoff_generator'\)/);
    assert.match(page, /function openAutoGenerator\(\) \{\s*if \(!canAutoBracket\)/);
    assert.match(page, /canAutoSchedule=\{canAutoBracket\}/);
    assert.doesNotMatch(page, /canAutoBracket=\{canAutoGenerateSchedule\}/);
  });
});
