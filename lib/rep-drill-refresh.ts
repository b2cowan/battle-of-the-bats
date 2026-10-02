import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getActiveRepProgramYear } from './db';
// ⚠ The WALK itself is pure plan-shape logic in `rep-drills.ts` (unit-tested in
// `tests/unit/rep-drill-refresh.test.ts`). Only the database round-trips live here — the
// `rep-practice-plan-tag-repoint.ts` split, for the same reason.
import { blockUsesDrill, refreshBlockFromDrill, refreshPlanFromDrill } from './rep-drills';
import { sanitizePracticePlan } from './rep-practice-plan';
import { planToTemplateShape } from './rep-plan-templates';
import { blockToCircuitShape } from './rep-circuits';
import type { DrillReach } from './rep-drills';
import type { PracticePlan, RepTeamDrill } from './types';

/**
 * SAVING A DRILL REACHES WHAT HASN'T HAPPENED YET (owner ruling D3, 2026-10-02 —
 * `COACH_PRACTICE_SAVE_OVER_PLAN.md` §4.3): "existing plans should pick up the updated drill but not
 * past ones".
 *
 * What "hasn't happened yet" means, decided ONCE here:
 *   · this team's practices in its LIVE season that have not started (`starts_at > now()`);
 *   · its plan templates and circuits (D7) — they are where the next practices come from, so leaving
 *     them stale would place the old words again next week.
 * A practice that has started keeps the version it ran, in any season, and a station a coach made
 * "just for this practice" carries no drill id, so the walk never sees it.
 *
 * ⚠ **Best-effort, not transactional across rows** — the tag repoint's posture. Each plan is its own
 * row; a failure partway leaves some rows refreshed and others not. That is recoverable rather than
 * lossy: the drill row is the truth, and saving the drill again re-runs the walk, which is
 * idempotent (a row already carrying this version is not written).
 *
 * ⚠ **`updated_at` is left alone, deliberately** — as the tag repoint leaves it. A drill save is not
 * the coach saving the template, circuit or practice: a template's "saved Sep 20" (Save as
 * template's list) stays the day the coach saved it.
 *
 * ⚠ **The plan PUT is last-write-wins.** A second tab open on another upcoming practice can write the
 * old words back on its next edit — the risk the staff/equipment repoint lives with too. The page
 * that ran the save converges on its own (it refreshes its in-memory plan and marks it dirty).
 */

/** The team's live-season practices that have not started, with a plan to walk. */
async function upcomingPracticePlans(teamId: string): Promise<{ id: string; name: string; startsAt: string; status: string; plan: PracticePlan }[]> {
  const season = await getActiveRepProgramYear(teamId);
  if (!season) return [];
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .select('id, name, starts_at, status, practice_plan')
    .eq('team_id', teamId)
    .eq('program_year_id', season.id)
    .eq('event_type', 'practice')
    .not('practice_plan', 'is', null)
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  // Through the sanitiser every reader of a plan uses (it runs on every read), so a row written
  // before a cap tightened is walked — and, if the drill touches it, written back — in today's shape.
  return (data ?? []).flatMap(r => {
    const plan = sanitizePracticePlan(r.practice_plan);
    return plan ? [{ id: r.id as string, name: r.name as string, startsAt: r.starts_at as string, status: r.status as string, plan }] : [];
  });
}

async function teamTemplates(teamId: string) {
  const { data, error } = await supabaseAdmin
    .from('rep_team_plan_templates').select('id, name, is_active, plan').eq('team_id', teamId);
  if (error) throw error;
  // `planToTemplateShape` is what `getRepTeamPlanTemplates` reads a template through (no people, ever).
  return (data ?? []).map(r => ({ id: r.id as string, name: r.name as string, isActive: !!r.is_active, plan: planToTemplateShape(r.plan) }));
}

async function teamCircuits(teamId: string) {
  const { data, error } = await supabaseAdmin
    .from('rep_team_circuits').select('id, name, is_active, block').eq('team_id', teamId);
  if (error) throw error;
  // `blockToCircuitShape` is what `getRepTeamCircuits` reads a circuit through (no people, ever).
  return (data ?? []).map(r => ({ id: r.id as string, name: r.name as string, isActive: !!r.is_active, block: blockToCircuitShape(r.block) }));
}

/** The name a team drill has NOW — read before an update, so the walk can follow a rename. */
export async function readTeamDrillName(drillId: string, teamId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_drills').select('name').eq('id', drillId).eq('team_id', teamId).maybeSingle();
  if (error) throw error;
  return data?.name ?? null;
}

/**
 * Re-copy a saved drill into everything of this team's that hasn't happened yet. Writes only the
 * rows that changed. Retired templates and circuits are refreshed too: restoring one must not bring
 * back words the coach replaced.
 */
export async function refreshDrillAcrossTeam(teamId: string, drill: RepTeamDrill, previousName: string | null): Promise<void> {
  const [practices, templates, circuits] = await Promise.all([
    upcomingPracticePlans(teamId), teamTemplates(teamId), teamCircuits(teamId),
  ]);
  for (const row of practices) {
    const r = refreshPlanFromDrill(row.plan, drill, previousName);
    if (!r.changed) continue;
    const { error } = await supabaseAdmin.from('rep_team_events').update({ practice_plan: r.plan }).eq('id', row.id);
    if (error) throw error;
  }
  for (const row of templates) {
    const r = refreshPlanFromDrill(row.plan, drill, previousName);
    if (!r.changed) continue;
    const { error } = await supabaseAdmin.from('rep_team_plan_templates').update({ plan: r.plan }).eq('id', row.id);
    if (error) throw error;
  }
  for (const row of circuits) {
    const r = refreshBlockFromDrill(row.block, drill, previousName);
    if (!r.changed) continue;
    const { error } = await supabaseAdmin.from('rep_team_circuits').update({ block: r.block }).eq('id', row.id);
    if (error) throw error;
  }
}

/** What saving this drill would reach (`DrillReach`, in `rep-drills.ts` so a client can name it).
 *  Practices soonest first; cancelled ones are left out of what is NAMED (the walk still refreshes
 *  them, so un-cancelling one finds it current). Active library only. */
export async function getDrillReach(teamId: string, drillId: string): Promise<DrillReach> {
  const [practices, templates, circuits] = await Promise.all([
    upcomingPracticePlans(teamId), teamTemplates(teamId), teamCircuits(teamId),
  ]);
  return {
    practices: practices
      .filter(p => p.status !== 'cancelled' && p.plan.blocks.some(b => blockUsesDrill(b, drillId)))
      .map(p => ({ eventId: p.id, name: p.name, startsAt: p.startsAt })),
    templates: templates
      .filter(t => t.isActive && t.plan.blocks.some(b => blockUsesDrill(b, drillId)))
      .map(t => t.name),
    circuits: circuits
      .filter(c => c.isActive && blockUsesDrill(c.block, drillId))
      .map(c => c.name),
  };
}
