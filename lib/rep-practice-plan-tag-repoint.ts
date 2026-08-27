import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import type { PracticePlan, PracticePlanBlock, PracticeStation, RepTagKind } from './types';

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

const NESTED_KIND_FIELD: Record<'staff' | 'equipment', 'staffTagIds' | 'equipmentTagIds'> = {
  staff: 'staffTagIds',
  equipment: 'equipmentTagIds',
};

function repointIds(ids: string[] | undefined, transform: (id: string) => string | null): string[] | undefined {
  if (!ids?.length) return ids;
  const next: string[] = [];
  const seen = new Set<string>();
  let changed = false;
  for (const id of ids) {
    const mapped = transform(id);
    if (mapped !== id) changed = true;
    if (mapped === null) continue;
    if (seen.has(mapped)) { changed = true; continue; } // merge can collapse two picks into one
    seen.add(mapped);
    next.push(mapped);
  }
  if (!changed) return ids;
  return next;
}

/**
 * Walk one plan, applying `transform` to every id in the given kind's field at every level it
 * appears. Returns the same object reference when nothing changed, so callers can skip a write.
 */
export function repointPracticePlanTags(
  plan: PracticePlan,
  kind: 'staff' | 'equipment',
  transform: (id: string) => string | null,
): { plan: PracticePlan; changed: boolean } {
  const field = NESTED_KIND_FIELD[kind];
  let changed = false;

  const nextStation = (s: PracticeStation): PracticeStation => {
    if (kind !== 'staff' && kind !== 'equipment') return s;
    const before = s[field];
    const after = repointIds(before, transform);
    if (after === before) return s;
    changed = true;
    return { ...s, [field]: after };
  };

  const nextBlock = (b: PracticePlanBlock): PracticePlanBlock => {
    let block = b;
    if (kind === 'staff') {
      const after = repointIds(b.staffTagIds, transform);
      if (after !== b.staffTagIds) { changed = true; block = { ...block, staffTagIds: after }; }
    }
    if (b.stations?.length) {
      const stations = b.stations.map(nextStation);
      if (stations.some((s, i) => s !== b.stations![i])) block = { ...block, stations };
    }
    return block;
  };

  let next = plan;
  if (kind === 'equipment') {
    const after = repointIds(plan.equipmentTagIds, transform);
    if (after !== plan.equipmentTagIds) { changed = true; next = { ...next, equipmentTagIds: after }; }
  }
  const blocks = plan.blocks.map(nextBlock);
  if (blocks.some((b, i) => b !== plan.blocks[i])) next = { ...next, blocks };

  return { plan: next, changed };
}

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

/** Every plan pick pointing at the loser now points at the winner (dedup'd against an existing pick). */
export async function repointTeamPlansOnMerge(
  teamId: string, kind: RepTagKind, winnerTagId: string, loserTagId: string,
): Promise<void> {
  if (kind !== 'staff' && kind !== 'equipment') return;
  await repointTeamPlans(teamId, kind, id => (id === loserTagId ? winnerTagId : id));
}

/** Every plan pick pointing at the deleted tag is dropped — mirrors `ON DELETE CASCADE`'s effect
 *  on the relational tag kinds, where a deleted tag "simply leaves the things it was on." */
export async function repointTeamPlansOnDelete(
  teamId: string, kind: RepTagKind, tagId: string,
): Promise<void> {
  if (kind !== 'staff' && kind !== 'equipment') return;
  await repointTeamPlans(teamId, kind, id => (id === tagId ? null : id));
}
