/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A USAGE COUNT THAT READS FEWER HOMES THAN THE MERGE REWRITES IS A LIE.**
 *
 * One Tag Idiom P0 (COACH_TAGGING_PLAN.md): the manager's delete sentence ("It's on 12 records —
 * they keep everything but the label") and its "Merge instead" offer are only honest if the count
 * reaches every place an id can sit. For staff/equipment that is plan jsonb with no FK — the same
 * problem the re-point walk solves — so `collectPracticePlanTagIds` deliberately RIDES the
 * repoint walk with an identity transform instead of re-implementing it. This file proves two
 * things about that choice:
 *
 *   1. **The collector sees every level the walk rewrites** — the practice-level equipment line,
 *      a block's staff, and a station's both — and returns DISTINCT ids (a tag on three surfaces
 *      of one plan is one record, matching the join-table kinds where the unit is the tagged
 *      record, never the link row).
 *   2. **The collector is the walk** (source scan): `countTeamPlanTagUsage` counts through
 *      `collectPracticePlanTagIds`, and the collector calls `repointPracticePlanTags` — so a new
 *      surface added to the walk is counted the day it exists, and one added anywhere else fails
 *      here. ⚠ Like its sibling file's scan, this proves reachability in SOURCE, not behaviour
 *      against a live database — this repo unit-tests neither Postgres nor a mocked client.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectPracticePlanTagIds } from '../../lib/rep-practice-plan';
import type { PracticePlan } from '../../lib/types';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const STAFF_A = 'staff-a';
const STAFF_B = 'staff-b';
const KIT_A = 'kit-a';
const KIT_B = 'kit-b';

/** A plan carrying both kinds' ids at every level each can appear on — STAFF_A and KIT_A on
 *  purpose in more than one place, because de-duplication is half the claim under test. */
function planWith(): PracticePlan {
  return {
    version: 1,
    equipmentTagIds: [KIT_A, KIT_B],
    blocks: [
      {
        id: 'b1',
        title: 'Warm-up',
        duration: { minutes: 15 },
        staffTagIds: [STAFF_A],
        stations: [
          {
            id: 's1',
            name: 'Tee',
            staffTagIds: [STAFF_A, STAFF_B],
            equipmentTagIds: [KIT_A],
          },
        ],
      },
    ],
  } as PracticePlan;
}

describe('collectPracticePlanTagIds — the count walks everything the merge walks', () => {
  it('equipment: reaches the practice level AND the station, de-duplicated across levels', () => {
    const ids = collectPracticePlanTagIds(planWith(), 'equipment');
    assert.deepEqual([...ids].sort(), [KIT_A, KIT_B], 'KIT_A sits on two levels and counts once');
  });

  it('staff: reaches the block AND the station, de-duplicated across levels', () => {
    const ids = collectPracticePlanTagIds(planWith(), 'staff');
    assert.deepEqual([...ids].sort(), [STAFF_A, STAFF_B], 'STAFF_A sits on two levels and counts once');
  });

  it('kinds never bleed: an equipment collect sees no staff ids, and vice versa', () => {
    assert.equal(collectPracticePlanTagIds(planWith(), 'equipment').has(STAFF_A), false);
    assert.equal(collectPracticePlanTagIds(planWith(), 'staff').has(KIT_A), false);
  });

  it('collecting mutates nothing — the plan is exactly what it was', () => {
    const plan = planWith();
    const before = JSON.stringify(plan);
    collectPracticePlanTagIds(plan, 'equipment');
    collectPracticePlanTagIds(plan, 'staff');
    assert.equal(JSON.stringify(plan), before);
  });
});

describe('the count rides the walk (source scan — reachability, not runtime)', () => {
  it('collectPracticePlanTagIds is implemented ON repointPracticePlanTags', () => {
    const src = read('lib/rep-practice-plan.ts');
    const fn = src.slice(src.indexOf('export function collectPracticePlanTagIds'));
    assert.ok(
      fn.slice(0, fn.indexOf('\n}')).includes('repointPracticePlanTags('),
      'the collector must reuse the repoint walk — a second hand-written walk drifts from it',
    );
  });

  it('countTeamPlanTagUsage counts through the collector, over ALL THREE homes', () => {
    const src = read('lib/rep-practice-plan-tag-repoint.ts');
    const fn = src.slice(src.indexOf('export async function countTeamPlanTagUsage'));
    assert.ok(fn.includes('collectPracticePlanTagIds('), 'counts must come from the shared collector');
    assert.ok(fn.includes("'rep_team_events'"), 'practice plans are counted');
    assert.ok(
      fn.includes("'rep_team_plan_templates'"),
      'templates are counted — the home the original repoint walk famously missed',
    );
    assert.ok(
      fn.includes("'rep_team_drills'"),
      'drills are counted — the THIRD home (mig 272: a drill stores its own kit ids)',
    );
  });

  it('the equipment merge/delete repoints reach DRILLS too (mig 272)', () => {
    const src = read('lib/rep-practice-plan-tag-repoint.ts');
    const merge = src.slice(src.indexOf('export async function repointTeamPlansOnMerge'), src.indexOf('export async function repointTeamPlansOnDelete'));
    const del = src.slice(src.indexOf('export async function repointTeamPlansOnDelete'));
    assert.ok(merge.includes('repointTeamDrills(teamId'), 'a merge must rewrite drill kit ids');
    assert.ok(del.includes('repointTeamDrills(teamId'), 'a delete must drop drill kit ids');
    assert.ok(
      src.slice(src.indexOf('async function repointTeamDrills')).includes("'rep_team_drills'"),
      'the drill walk reads the drills table',
    );
  });

  it('the library GET hands staff/equipment to the plan walk and every other kind to the join-table counts', () => {
    const src = read('lib/coach-tag-routes.ts');
    assert.ok(src.includes('countTeamPlanTagUsage(teamId, config.kind)'), 'jsonb kinds dispatch to the walk');
    assert.ok(src.includes('getRepTeamTagUsageCounts(teamId, config.kind'), 'relational kinds dispatch to db counts');
  });
});
