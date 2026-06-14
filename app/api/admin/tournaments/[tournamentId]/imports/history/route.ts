import { NextResponse } from 'next/server';
import { getAuthContextWithScope, forbidden, requireTournamentInOrg, scopeGuard, unauthorized } from '@/lib/api-auth';
import { TOURNAMENT_SCHEDULE_IMPORT_TYPE } from '@/lib/import/tournament-schedule';
import { TOURNAMENT_TEAM_IMPORT_TYPE } from '@/lib/import/tournament-teams';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ tournamentId: string }> };
type ImportBatchStatus = 'previewed' | 'committed' | 'failed' | 'expired';

type ImportBatchRow = {
  id: string;
  import_type: string;
  source_filename: string | null;
  status: ImportBatchStatus;
  summary_json: Record<string, unknown> | null;
  actor_email: string | null;
  created_at: string;
  committed_at: string | null;
  expires_at: string;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function numeric(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeSummary(summary: Record<string, unknown> | null) {
  const commit = summary?.commit && typeof summary.commit === 'object'
    ? summary.commit as Record<string, unknown>
    : null;

  return {
    totalRows: numeric(summary?.totalRows),
    creates: numeric(summary?.creates),
    updates: numeric(summary?.updates),
    unchanged: numeric(summary?.unchanged),
    warnings: numeric(summary?.warnings),
    blocked: numeric(summary?.blocked),
    commit: commit ? {
      created: numeric(commit.created),
      updated: numeric(commit.updated),
      unchanged: numeric(commit.unchanged),
      skipped: numeric(commit.skipped),
    } : null,
  };
}

function effectiveStatus(row: ImportBatchRow): ImportBatchStatus {
  if (row.status === 'previewed' && new Date(row.expires_at).getTime() <= Date.now()) {
    return 'expired';
  }
  return row.status;
}

function importLabel(importType: string) {
  if (importType === TOURNAMENT_TEAM_IMPORT_TYPE) return 'Teams & Registrations';
  if (importType === TOURNAMENT_SCHEDULE_IMPORT_TYPE) return 'Schedule';
  return 'Import';
}

export const GET = withObservability(async (req: Request, { params }: RouteParams) => {
  const { tournamentId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (!hasPlanFeature(ctx.org.planId, 'bulk_data_imports')) {
    return json({ error: requiresPlanCopy('bulk_data_imports') }, 403);
  }

  const canViewImports =
    hasCapability(ctx.role, ctx.capabilities, 'manage_registrations') ||
    hasCapability(ctx.role, ctx.capabilities, 'manage_schedule_structure') ||
    hasCapability(ctx.role, ctx.capabilities, 'update_schedule') ||
    hasCapability(ctx.role, ctx.capabilities, 'create_tournaments');
  if (!canViewImports) return forbidden();

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const url = new URL(req.url);
  const requestedLimit = Number(url.searchParams.get('limit') ?? 8);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 20)
    : 8;

  const { data, error } = await supabaseAdmin
    .from('import_batches')
    .select('id, import_type, source_filename, status, summary_json, actor_email, created_at, committed_at, expires_at')
    .eq('org_id', ctx.org.id)
    .in('import_type', [TOURNAMENT_TEAM_IMPORT_TYPE, TOURNAMENT_SCHEDULE_IMPORT_TYPE])
    .contains('scope_json', { tournamentId })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return json({ error: error.message }, 500);

  const imports = ((data ?? []) as ImportBatchRow[]).map(row => ({
    id: row.id,
    importType: row.import_type,
    importLabel: importLabel(row.import_type),
    status: effectiveStatus(row),
    sourceFilename: row.source_filename,
    actorEmail: row.actor_email,
    createdAt: row.created_at,
    committedAt: row.committed_at,
    expiresAt: row.expires_at,
    summary: normalizeSummary(row.summary_json),
  }));

  return NextResponse.json({ imports });
}, { route: '/api/admin/tournaments/[tournamentId]/imports/history' });
