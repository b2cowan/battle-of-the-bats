import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

// Surfaces the free→Premium upgrade migration summary (Phase 4) stored on the workspace, so the
// Premium team overview can show a one-time "here's what we brought over + check these" banner.

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.some(a => a.teamId === teamId)) return { error: forbidden() };
  return { ctx };
}

type SummaryRow = { id: string; migration_summary: Record<string, unknown> | null };

async function loadWorkspaceSummary(orgId: string, teamId: string): Promise<SummaryRow | null> {
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, migration_summary')
    .eq('workspace_org_id', orgId)
    .eq('rep_team_id', teamId)
    .maybeSingle<SummaryRow>();
  if (error) throw error;
  return data ?? null;
}

/** Return the upgrade migration summary (only when present + not yet acknowledged). */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;

  const row = await loadWorkspaceSummary(resolved.ctx.org.id, teamId);
  const summary = row?.migration_summary ?? null;
  const acknowledged = !!(summary && typeof summary === 'object' && 'acknowledgedAt' in summary && summary.acknowledgedAt);
  return NextResponse.json({ ok: true, summary: acknowledged ? null : summary });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/upgrade-summary' });

/** Acknowledge (dismiss) the summary so it stops showing. */
export const POST = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;

  const row = await loadWorkspaceSummary(resolved.ctx.org.id, teamId);
  if (row?.migration_summary) {
    await supabaseAdmin
      .from('team_workspaces')
      .update({ migration_summary: { ...row.migration_summary, acknowledgedAt: new Date().toISOString() } })
      .eq('id', row.id);
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/upgrade-summary' });
