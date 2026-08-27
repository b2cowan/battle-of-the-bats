/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A MERGE THAT FAILS MUST DESTROY NOTHING, AND IT MUST REACH EVERY SURFACE THE ID SITS ON.**
 *
 * `staff` and `equipment` are the only two tag kinds whose ids live INSIDE a jsonb column with no
 * foreign key (migration 266). Every other kind links through a real join table, so the
 * `merge_rep_team_tags` RPC re-pointing those rows IS the whole job. For these two, nothing
 * re-points them automatically — `lib/rep-practice-plan-tag-repoint.ts` is the price of that
 * choice, and this file is what keeps it paid.
 *
 * Both rules below were REAL DEFECTS found by `/review` on 03e1dd6d, on the day the feature was
 * built, and both were fixed in `ad9beee5`. Neither had a test. They are written down here because
 * each is a one-line edit away from coming back, and neither failure is visible from the screen:
 *
 *   1. **The re-point runs BEFORE the destructive RPC, not after.** `merge_rep_team_tags`
 *      hard-DELETEs the loser tag row. The walk originally ran after it, so a walk that threw
 *      partway left the merge committed, ids dangling inside old plans, and the coach told
 *      "Merge failed" — the one thing that had not happened. It now runs inside
 *      `mergeRepTeamTags`, after the ownership proof and before the RPC, so a throw destroys
 *      nothing and the coach can simply retry. ⚠ The ordering is the ENTIRE fix; a future edit
 *      that "tidies" the hook back out to the call site silently restores the data loss.
 *
 *   2. **Plan TEMPLATES are walked too, not just practice events.** `stationForTemplate`
 *      deliberately KEEPS `equipmentTagIds` — "kit is part of the SHAPE a template carries (what
 *      to bring), not people" — while stripping staff. The walk originally queried only
 *      `rep_team_events`, so a merge or delete left templates pointing at a row that no longer
 *      existed anywhere. And a stale ID is worse than a stale legacy NAME: a name renders a
 *      "+ Add … to your list" recovery chip, an id has nothing to show and no way back, so the
 *      kit simply vanished from the template with no evidence it had ever been chosen.
 *
 * ⚠⚠ **SCOPE LIMITS, STATED SO THEY ARE NOT MISTAKEN FOR COVERAGE.** The first half of this file
 * is a real behavioural test of the pure walk. The second half is a SOURCE SCAN, and it proves
 * only what it can read:
 *
 *   - It cannot prove the ordering actually holds AT RUNTIME — that would need a live Postgres or
 *     a mocked Supabase client, and this repo unit-tests neither. It proves the merge route hands
 *     the walk to `mergeRepTeamTags` as an argument rather than calling it separately, and that
 *     `mergeRepTeamTags` invokes it before the `.rpc(...)` line. A refactor that keeps both shapes
 *     but breaks the ordering some third way would pass here.
 *   - It cannot prove the template walk WROTE anything — only that both exported entry points
 *     reach a function that queries `rep_team_plan_templates`.
 *   - It says nothing about partial failure across rows. The walk is still best-effort and
 *     non-transactional across events by design; what changed is that a failure is now
 *     non-destructive, not that it is atomic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repointPracticePlanTags } from '../../lib/rep-practice-plan';
import type { PracticePlan } from '../../lib/types';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const WINNER = 'tag-winner';
const LOSER = 'tag-loser';
const OTHER = 'tag-other';

/** A plan carrying the kind's ids at every level it can appear on. */
function planWith(): PracticePlan {
  return {
    version: 1,
    equipmentTagIds: [OTHER, LOSER],
    blocks: [
      {
        id: 'b1',
        title: 'Warm-up',
        duration: { minutes: 15 },
        staffTagIds: [LOSER],
        stations: [
          {
            id: 's1',
            name: 'Tee',
            staffTagIds: [OTHER, LOSER],
            equipmentTagIds: [LOSER],
          },
        ],
      },
    ],
  } as PracticePlan;
}

const toWinner = (id: string) => (id === LOSER ? WINNER : id);
const drop = (id: string) => (id === LOSER ? null : id);

describe('repointPracticePlanTags — every surface an id sits on', () => {
  it('a merge re-points equipment at BOTH the practice level and the station', () => {
    const { plan, changed } = repointPracticePlanTags(planWith(), 'equipment', toWinner);
    assert.equal(changed, true);
    assert.deepEqual(plan.equipmentTagIds, [OTHER, WINNER], 'the practice-level equipment line');
    assert.deepEqual(
      plan.blocks[0].stations![0].equipmentTagIds,
      [WINNER],
      "the station's own equipment",
    );
  });

  it('a merge re-points staff at BOTH the block and the station', () => {
    const { plan, changed } = repointPracticePlanTags(planWith(), 'staff', toWinner);
    assert.equal(changed, true);
    assert.deepEqual(plan.blocks[0].staffTagIds, [WINNER], "the block's staff");
    assert.deepEqual(
      plan.blocks[0].stations![0].staffTagIds,
      [OTHER, WINNER],
      "the station's who-runs-it",
    );
  });

  it('a delete drops the id from every level rather than leaving it dangling', () => {
    const eq = repointPracticePlanTags(planWith(), 'equipment', drop);
    assert.deepEqual(eq.plan.equipmentTagIds, [OTHER]);
    assert.deepEqual(eq.plan.blocks[0].stations![0].equipmentTagIds, []);

    const st = repointPracticePlanTags(planWith(), 'staff', drop);
    assert.deepEqual(st.plan.blocks[0].staffTagIds, []);
    assert.deepEqual(st.plan.blocks[0].stations![0].staffTagIds, [OTHER]);
  });

  it('a merge collapses a duplicate rather than listing the winner twice', () => {
    // The station already had the winner AND the loser picked; after the merge it is one pick.
    const plan = planWith();
    plan.blocks[0].stations![0].equipmentTagIds = [WINNER, LOSER];
    const { plan: next, changed } = repointPracticePlanTags(plan, 'equipment', toWinner);
    assert.equal(changed, true);
    assert.deepEqual(next.blocks[0].stations![0].equipmentTagIds, [WINNER]);
  });

  it('each kind leaves the other kind alone', () => {
    const eq = repointPracticePlanTags(planWith(), 'equipment', toWinner);
    assert.deepEqual(eq.plan.blocks[0].staffTagIds, [LOSER], 'staff untouched by an equipment walk');

    const st = repointPracticePlanTags(planWith(), 'staff', toWinner);
    assert.deepEqual(
      st.plan.equipmentTagIds,
      [OTHER, LOSER],
      'equipment untouched by a staff walk',
    );
  });

  it('returns the SAME object when nothing matched, so the caller skips the write', () => {
    const plan = planWith();
    const { plan: next, changed } = repointPracticePlanTags(plan, 'equipment', (id: string) => id);
    assert.equal(changed, false);
    assert.equal(next, plan, 'same reference — a no-op must not cost a row update');
  });

  it('a plan carrying no ids of that kind at all is a no-op', () => {
    const bare = { version: 1, blocks: [] } as unknown as PracticePlan;
    const { plan, changed } = repointPracticePlanTags(bare, 'staff', toWinner);
    assert.equal(changed, false);
    assert.equal(plan, bare);
  });
});

describe('the merge is ordered so a failure destroys nothing', () => {
  it('the merge route hands the walk to mergeRepTeamTags instead of calling it afterwards', () => {
    const src = read('lib/coach-tag-routes.ts');

    assert.match(
      src,
      /mergeRepTeamTags\(\s*winnerTagId,\s*loserTagId,\s*teamId,\s*config\.repointForMerge/,
      'the walk must be PASSED to mergeRepTeamTags — that is what puts it before the RPC',
    );
    assert.doesNotMatch(
      src,
      /await\s+mergeRepTeamTags\([^)]*\);[\s\S]{0,400}?await\s+config\.repointForMerge\(/,
      'a separate repointForMerge call AFTER the merge is the original data-loss bug',
    );
  });

  it('mergeRepTeamTags runs the hook BEFORE the destructive RPC', () => {
    const src = read('lib/db.ts');
    const fnStart = src.indexOf('export async function mergeRepTeamTags(');
    assert.ok(fnStart > -1, 'mergeRepTeamTags not found — this guard has gone blind');

    const body = src.slice(fnStart, fnStart + 2500);
    const hookAt = body.indexOf('beforeDestructive)');
    const rpcAt = body.indexOf("supabaseAdmin.rpc('merge_rep_team_tags'");
    assert.ok(hookAt > -1, 'the beforeDestructive hook is gone');
    assert.ok(rpcAt > -1, 'the merge RPC call is gone — this guard has gone blind');
    assert.ok(
      hookAt < rpcAt,
      'the hook must be invoked BEFORE the RPC that deletes the loser row, never after',
    );
  });

  it('the DELETE route still strips from plans before removing the row', () => {
    const src = read('lib/coach-tag-routes.ts');
    const stripAt = src.indexOf('config.repointForDelete(teamId, tagId)');
    const deleteAt = src.indexOf('deleteRepTeamTag(tagId, teamId)');
    assert.ok(stripAt > -1 && deleteAt > -1, 'the delete path changed shape — re-read this guard');
    assert.ok(
      stripAt < deleteAt,
      'the strip must precede the delete so a failure leaves a resolvable tag, not a dangling id',
    );
  });
});

describe('the walk reaches plan templates, not only practice events', () => {
  const src = read('lib/rep-practice-plan-tag-repoint.ts');

  it('a template walk exists and addresses the templates table', () => {
    assert.match(
      src,
      /from\('rep_team_plan_templates'\)/,
      'templates keep equipmentTagIds on purpose — a walk that skips them strands ids there',
    );
  });

  for (const entry of ['repointTeamPlansOnMerge', 'repointTeamPlansOnDelete']) {
    it(`${entry} walks templates as well as events`, () => {
      const at = src.indexOf(`export async function ${entry}(`);
      assert.ok(at > -1, `${entry} not found — this guard has gone blind`);
      const body = src.slice(at, at + 700);
      assert.match(body, /repointTeamPlans\(/, `${entry} must walk practice events`);
      assert.match(body, /repointTeamTemplates\(/, `${entry} must walk plan templates too`);
    });
  }
});
