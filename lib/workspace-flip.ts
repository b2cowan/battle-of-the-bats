import { supabaseAdmin } from './supabase-admin';
import { PLAN_CONFIG } from './plan-config';
import { isClubPlan } from './module-entitlements';
import type { OrgPlan } from './types';

/**
 * THE WORKSPACE FLIP (Plan & billing Stage 4b, Part 1; owner ruling 2026-10-30): a coach's standalone Coaches Portal that is
 * now on a Club plan becomes the club IN PLACE. The work is one database transaction (`flip_workspace_into_club`, mig 414) —
 * the sibling of the coach bridge's `move_team_into_club`, which is the OTHER door (joining someone else's club). This module
 * is the app half: it asks, and turns the database's named refusals into answers instead of thrown strings.
 *
 * Called from ONE place, `applyPlanChangeSideEffects` (lib/plan-move.ts), which the move apply, the Stripe webhook, the
 * operator's plan change and the mock checkout all run. Safe to call twice and safe on an organization that was never a
 * workspace (a club-to-club move calls it too): both answer without writing. No Stripe call lives here or in the RPC.
 *
 * ⚠ What it exists to stop (the plan's risk 1 and 2): the workspace carries a permanent coach-portal tag that about 90 files
 * read. A club still wearing it behaves as a portal, and a later Club cancellation would run the Coaches Portal retention and
 * send its email. The RPC NULLs the workspace row's Stripe ids, which is what keeps that branch of the webhook out.
 */

export type WorkspaceFlipRefusalCode =
  | 'not_a_workspace'
  | 'org_not_found'
  | 'workspace_closed'
  | 'not_a_club_plan'
  | 'plan_mismatch'
  | 'not_settled'
  | 'holds_other_teams';

export type WorkspaceFlipResult =
  | { status: 'flipped'; orgId: string; orgSlug: string; workspaceId: string; repTeamId: string; name: string }
  | { status: 'already_flipped'; orgId: string; orgSlug: string; workspaceId: string }
  /** Nothing to do: the plan is not a Club plan, or the organization never was a workspace. No write happened. */
  | { status: 'skipped'; reason: 'not_a_club_plan' | 'not_a_workspace' }
  /** The database said no, by name. Nothing was written; the next billing event asks again. */
  | { status: 'refused'; code: WorkspaceFlipRefusalCode };

/**
 * The RPC's exception names. `surprise` marks a refusal nobody should ever see in ordinary use (the caller only asks when the
 * plan is Club and a workspace row exists): it goes to the Errors screen. `not_settled` is ordinary — the first payment is
 * not through yet, and the event that settles it asks again.
 */
const REFUSALS: Record<string, { code: WorkspaceFlipRefusalCode; surprise: boolean }> = {
  workspace_flip_not_a_workspace: { code: 'not_a_workspace', surprise: false },
  workspace_flip_org_not_found: { code: 'org_not_found', surprise: true },
  workspace_flip_workspace_closed: { code: 'workspace_closed', surprise: true },
  workspace_flip_not_a_club_plan: { code: 'not_a_club_plan', surprise: true },
  workspace_flip_plan_mismatch: { code: 'plan_mismatch', surprise: true },
  workspace_flip_not_settled: { code: 'not_settled', surprise: false },
  workspace_flip_holds_other_teams: { code: 'holds_other_teams', surprise: true },
};

function refusalOf(message: string): { code: WorkspaceFlipRefusalCode; surprise: boolean } | null {
  for (const [name, refusal] of Object.entries(REFUSALS)) if (message.includes(name)) return refusal;
  return null;
}

/** Tells staff about a refusal that should not happen. Loaded here, not at the top: it is server-only and unit tests load this file. Never throws. */
async function reportSurprise(orgId: string, code: WorkspaceFlipRefusalCode): Promise<void> {
  try {
    const { captureError } = await import('./observability/capture');
    await captureError(new Error(`Workspace flip refused (${code}) for organization ${orgId}: a Coaches Portal on a Club plan was not turned into a club.`), {
      route: 'lib/workspace-flip#flipWorkspaceIntoClub', severity: 'warning', title: 'A Coaches Portal on Club was not turned into a club',
    });
  } catch (e) {
    console.error('[workspace-flip] couldn’t report a refusal:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Turn the organization's workspace into the club, when it is one and the Club subscription is settled.
 *
 * Returns a named result for every ordinary and expected-refusal outcome. THROWS only when the database itself failed (the
 * transaction rolled back whole, so the organization is exactly as it was): the webhook lets that reach Stripe, which retries,
 * and every retry is safe because the flip is idempotent.
 *
 * `clubName` is the name the coach typed; absent keeps today's. (Part 2 decides where it travels from.)
 */
export async function flipWorkspaceIntoClub(p: {
  orgId: string;
  plan: OrgPlan | string;
  actor: string;
  clubName?: string | null;
}): Promise<WorkspaceFlipResult> {
  if (!isClubPlan(p.plan)) return { status: 'skipped', reason: 'not_a_club_plan' };

  // An ordinary club (every club-to-club move) has no workspace row: answer without calling the RPC.
  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from('team_workspaces')
    .select('id')
    .eq('workspace_org_id', p.orgId)
    .maybeSingle<{ id: string }>();
  if (workspaceError) throw workspaceError;
  if (!workspace) return { status: 'skipped', reason: 'not_a_workspace' };

  const { data, error } = await supabaseAdmin.rpc('flip_workspace_into_club', {
    p_org_id: p.orgId,
    p_plan: p.plan,
    p_club_name: p.clubName ?? null,
    // The limit is plan-config (TypeScript); the RPC writes it with the rest, in the same transaction.
    p_tournament_limit: PLAN_CONFIG[p.plan as OrgPlan]?.tournamentLimit ?? null,
    p_actor: p.actor,
  });
  if (error) {
    const refusal = refusalOf(error.message ?? '');
    if (!refusal) throw error;
    if (refusal.surprise) await reportSurprise(p.orgId, refusal.code);
    return { status: 'refused', code: refusal.code };
  }

  const result = (data ?? {}) as {
    alreadyFlipped?: boolean; orgId?: string; orgSlug?: string; workspaceId?: string; repTeamId?: string; name?: string;
  };
  if (result.alreadyFlipped) {
    return { status: 'already_flipped', orgId: result.orgId ?? p.orgId, orgSlug: result.orgSlug ?? '', workspaceId: result.workspaceId ?? workspace.id };
  }
  return {
    status: 'flipped',
    orgId: result.orgId ?? p.orgId,
    orgSlug: result.orgSlug ?? '',
    workspaceId: result.workspaceId ?? workspace.id,
    repTeamId: result.repTeamId ?? '',
    name: result.name ?? '',
  };
}
