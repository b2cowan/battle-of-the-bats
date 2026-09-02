import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { PracticePlan, RepTagKind } from './types';
// ⚠ The WALK itself is pure plan-shape logic and lives in `rep-practice-plan.ts`, which carries no
// `server-only` and is therefore unit-testable — see `tests/unit/practice-tag-repoint.test.ts`.
// Only the DB round-trips below belong in this module.
import { collectPracticePlanTagIds, repointPracticePlanTags } from './rep-practice-plan';

/**
 * Re-pointing 'staff'/'equipment' tag ids embedded inside `PracticePlan` jsonb.
 *
 * ⚠ **Why this file exists at all.** Every other tag kind (game, expense, focus) links through a
 * real foreign key — `rep_team_event_tags`, a drill's/template's own tag table — so
 * `merge_rep_team_tags` re-pointing those rows IS the whole job. A plan's staff/equipment picks are
 * ids sitting inside a jsonb column with no FK, so nothing re-points them automatically. A prior
 * session (COACH_PRACTICE_PLANS_PLAN.md §10.3) chose plain names specifically to avoid building
 * this; reopening that call (owner instruction, 2026-08-27) means this walk is the price of it, and
 * it must run in the SAME request as the tag write — see the callers in `lib/coach-tag-routes.ts`.
 *
 * ⚠ **Best-effort, not transactional across events.** Each event's `practice_plan` is its own row;
 * there is no single statement that rewrites all of a team's plans atomically. A failure partway
 * through leaves some plans repointed and others not — recoverable (the tag row itself is the
 * source of truth for what SHOULD be true; a stray old id just means one plan's picker shows a name
 * that no longer resolves, handled by dropping unresolvable ids at render time), never data loss.
 */

/**
 * Fetch every one of the team's practice events carrying a plan, repoint the given kind's ids
 * across all of them, and write back only the rows that actually changed.
 *
 * ⚠ Every season, not just the working one — a past season's printed run sheet still has to name
 * the right person after a rename; scoping this to the live year would leave old plans stale the
 * moment a coach merges two near-duplicate tags.
 */
async function repointTeamPlans(
  teamId: string,
  kind: 'staff' | 'equipment',
  transform: (id: string) => string | null,
): Promise<void> {
  const { data: events, error } = await supabaseAdmin
    .from('rep_team_events')
    .select('id, practice_plan')
    .eq('team_id', teamId)
    .eq('event_type', 'practice')
    .not('practice_plan', 'is', null);
  if (error) throw error;

  for (const row of events ?? []) {
    const plan = row.practice_plan as PracticePlan;
    const { plan: nextPlan, changed } = repointPracticePlanTags(plan, kind, transform);
    if (!changed) continue;
    const { error: updateError } = await supabaseAdmin
      .from('rep_team_events').update({ practice_plan: nextPlan }).eq('id', row.id);
    if (updateError) throw updateError;
  }
}

/**
 * The same walk over PLAN TEMPLATES, whose `plan` jsonb is the very same shape.
 *
 * ⚠⚠ A TEMPLATE IS NOT A PRACTICE EVENT, and walking only `rep_team_events` was a real defect.
 * `stationForTemplate` deliberately KEEPS `equipmentTagIds` — "kit is part of the SHAPE a template
 * carries (what to bring), not people" — while stripping staff. So a merge or delete that skipped
 * this table left templates pointing at a tag row that no longer exists anywhere, and a stale ID
 * (unlike a stale legacy NAME, which renders a "+ Add ... to your list" recovery chip) has nothing
 * to show and no way back: the kit simply disappeared from the template with no evidence it had
 * ever been chosen. Exactly the silent split this whole feature exists to prevent.
 *
 * ⚠ Walked for BOTH kinds even though today's builder strips staff — rows written before that rule
 * landed can still carry `staffTagIds`, and dropping a dead id is never wrong.
 */
async function repointTeamTemplates(
  teamId: string,
  kind: 'staff' | 'equipment',
  transform: (id: string) => string | null,
): Promise<void> {
  const { data: templates, error } = await supabaseAdmin
    .from('rep_team_plan_templates')
    .select('id, plan')
    .eq('team_id', teamId)
    .not('plan', 'is', null);
  if (error) throw error;

  for (const row of templates ?? []) {
    const plan = row.plan as PracticePlan;
    const { plan: nextPlan, changed } = repointPracticePlanTags(plan, kind, transform);
    if (!changed) continue;
    const { error: updateError } = await supabaseAdmin
      .from('rep_team_plan_templates').update({ plan: nextPlan }).eq('id', row.id);
    if (updateError) throw updateError;
  }
}


/**
 * The same walk over DRILLS (mig 272) — a drill's kit ids live in its own jsonb column, the third
 * home an 'equipment' id can sit in. ⚠ Only 'equipment' — a drill carries no staff. Skipping this
 * home would repeat the template omission this file's own header records: a merged/deleted tag
 * leaving a dangling id inside a drill, with nothing to render and no way back.
 */
async function repointTeamDrills(
  teamId: string,
  transform: (id: string) => string | null,
): Promise<void> {
  const { data: drills, error } = await supabaseAdmin
    .from('rep_team_drills')
    .select('id, equipment_tag_ids')
    .eq('team_id', teamId)
    .neq('equipment_tag_ids', '[]');
  if (error) throw error;

  for (const row of drills ?? []) {
    const before: string[] = Array.isArray(row.equipment_tag_ids) ? row.equipment_tag_ids : [];
    const next: string[] = [];
    const seen = new Set<string>();
    let changed = false;
    for (const id of before) {
      const mapped = transform(id);
      if (mapped !== id) changed = true;
      if (mapped === null) continue;
      if (seen.has(mapped)) { changed = true; continue; }
      seen.add(mapped);
      next.push(mapped);
    }
    if (!changed) continue;
    const { error: updateError } = await supabaseAdmin
      .from('rep_team_drills').update({ equipment_tag_ids: next }).eq('id', row.id);
    if (updateError) throw updateError;
  }
}
/** Every plan pick pointing at the loser now points at the winner (dedup'd against an existing pick). */
export async function repointTeamPlansOnMerge(
  teamId: string, kind: RepTagKind, winnerTagId: string, loserTagId: string,
): Promise<void> {
  if (kind !== 'staff' && kind !== 'equipment') return;
  const toWinner = (id: string) => (id === loserTagId ? winnerTagId : id);
  await repointTeamPlans(teamId, kind, toWinner);
  await repointTeamTemplates(teamId, kind, toWinner);
  if (kind === 'equipment') await repointTeamDrills(teamId, toWinner);
}

/** Every plan pick pointing at the deleted tag is dropped — mirrors `ON DELETE CASCADE`'s effect
 *  on the relational tag kinds, where a deleted tag "simply leaves the things it was on." */
export async function repointTeamPlansOnDelete(
  teamId: string, kind: RepTagKind, tagId: string,
): Promise<void> {
  if (kind !== 'staff' && kind !== 'equipment') return;
  const drop = (id: string) => (id === tagId ? null : id);
  await repointTeamPlans(teamId, kind, drop);
  await repointTeamTemplates(teamId, kind, drop);
  if (kind === 'equipment') await repointTeamDrills(teamId, drop);
}

/**
 * How many of the team's practice plans and plan templates reference each staff/equipment tag
 * (One Tag Idiom P0). Counts RECORDS, not occurrences — a tag on three stations of one plan
 * counts once, matching the join-table kinds where the unit is the tagged record.
 *
 * ⚠ Same two tables as the repoint walks above, deliberately: a count that read fewer homes than
 * the merge rewrites would tell a coach "not used yet" about a tag a template still holds.
 */
export async function countTeamPlanTagUsage(
  teamId: string,
  kind: 'staff' | 'equipment',
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const bump = (plan: PracticePlan) => {
    for (const id of collectPracticePlanTagIds(plan, kind)) counts[id] = (counts[id] ?? 0) + 1;
  };
  const [events, templates] = await Promise.all([
    supabaseAdmin
      .from('rep_team_events')
      .select('practice_plan')
      .eq('team_id', teamId)
      .eq('event_type', 'practice')
      .not('practice_plan', 'is', null),
    supabaseAdmin
      .from('rep_team_plan_templates')
      .select('plan')
      .eq('team_id', teamId)
      .not('plan', 'is', null),
  ]);
  if (events.error) throw events.error;
  if (templates.error) throw templates.error;
  for (const row of events.data ?? []) bump(row.practice_plan as PracticePlan);
  for (const row of templates.data ?? []) bump(row.plan as PracticePlan);
  // The THIRD home (mig 272): a drill's own kit ids — 'equipment' only, one count per drill.
  if (kind === 'equipment') {
    const drills = await supabaseAdmin
      .from('rep_team_drills')
      .select('equipment_tag_ids')
      .eq('team_id', teamId)
      .neq('equipment_tag_ids', '[]');
    if (drills.error) throw drills.error;
    for (const row of drills.data ?? []) {
      const ids: string[] = Array.isArray(row.equipment_tag_ids) ? row.equipment_tag_ids : [];
      for (const id of new Set(ids)) counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return counts;
}
