import { NextResponse } from 'next/server';
import { TOURNAMENT_TEAM_IMPORT_TYPE } from '@/lib/import/tournament-teams';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  authorizeTournamentTeamImport,
  json,
  type RouteParams,
} from '../shared';

export const runtime = 'nodejs';

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

export async function GET(req: Request, { params }: RouteParams) {
  const { tournamentId } = await params;
  const auth = await authorizeTournamentTeamImport(req, tournamentId, { blockLocked: false });
  if ('response' in auth) return auth.response;

  const url = new URL(req.url);
  const requestedLimit = Number(url.searchParams.get('limit') ?? 8);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 20)
    : 8;

  const { data, error } = await supabaseAdmin
    .from('import_batches')
    .select('id, import_type, source_filename, status, summary_json, actor_email, created_at, committed_at, expires_at')
    .eq('org_id', auth.ctx.org.id)
    .eq('import_type', TOURNAMENT_TEAM_IMPORT_TYPE)
    .contains('scope_json', { tournamentId })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return json({ error: error.message }, 500);

  const imports = ((data ?? []) as ImportBatchRow[]).map(row => ({
    id: row.id,
    importType: row.import_type,
    importLabel: 'Teams & Registrations',
    status: effectiveStatus(row),
    sourceFilename: row.source_filename,
    actorEmail: row.actor_email,
    createdAt: row.created_at,
    committedAt: row.committed_at,
    expiresAt: row.expires_at,
    summary: normalizeSummary(row.summary_json),
  }));

  return NextResponse.json({ imports });
}
