import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  retryCoachUpgradeMigration,
  MAX_AUTO_MIGRATION_RETRIES,
  type CoachUpgradeMigrationSummary,
} from '@/lib/coach-upgrade-migration';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';

// Repair a PARTIAL free→Premium upgrade migration (Phase 4) by re-running the idempotent copy. The
// banner fires this automatically (up to MAX_AUTO_MIGRATION_RETRIES) when the stored summary is
// `ok:false`; a manual "Try again" press (`{ manual: true }`) bypasses the auto cap. Idempotent +
// never throws — the copy only fills what's still missing.

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  return { ctx, assignment };
}

type WorkspaceRow = { id: string; basic_coach_team_id: string | null; migration_summary: CoachUpgradeMigrationSummary | null };

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  // Repairing the migration copies roster/schedule/fees — a head-coach action.
  const denied = denyUnless(resolved.assignment.capabilities.isHeadCoach, 'Only the head coach can repair the upgrade.');
  if (denied) return denied;
  const orgId = resolved.ctx.org.id;

  const { data: workspace } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, basic_coach_team_id, migration_summary')
    .eq('workspace_org_id', orgId)
    .eq('rep_team_id', teamId)
    .maybeSingle<WorkspaceRow>();

  const summary = workspace?.migration_summary ?? null;

  // Nothing to repair: no summary, already complete, or already dismissed.
  if (!summary || summary.ok !== false || summary.acknowledgedAt) {
    return NextResponse.json({ ok: true, summary: summary && !summary.acknowledgedAt ? summary : null });
  }
  // Can't anchor a retry without the source team + the season the migration targeted.
  if (!workspace?.basic_coach_team_id || !summary.programYearId) {
    return NextResponse.json({ ok: true, summary });
  }

  const body = (await req.json().catch(() => ({}))) as { manual?: unknown };
  const manual = body.manual === true;
  const retryCount = summary.retryCount ?? 0;

  // Auto-retries are bounded; a manual "Try again" press always runs.
  if (!manual && retryCount >= MAX_AUTO_MIGRATION_RETRIES) {
    return NextResponse.json({ ok: true, summary });
  }

  const merged = await retryCoachUpgradeMigration({
    workspaceId: workspace.id,
    orgId,
    teamId,
    basicCoachTeamId: workspace.basic_coach_team_id,
    programYearId: summary.programYearId,
    priorSummary: summary,
  });

  return NextResponse.json({ ok: true, summary: merged });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/upgrade-summary/retry' });
