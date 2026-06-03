import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { TOURNAMENT_SCHEDULE_IMPORT_TYPE } from '@/lib/import/tournament-schedule';
import {
  TournamentScheduleImportCommitError,
  buildTournamentScheduleGameInsert,
  buildTournamentScheduleGameUpdate,
  prepareTournamentScheduleCommitRows,
  summarizeTournamentScheduleCommit,
  validateTournamentScheduleCommitAgainstContext,
  type PreparedTournamentScheduleCommitRow,
  type StoredTournamentScheduleImportRow,
} from '@/lib/import/tournament-schedule-commit';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  authorizeTournamentScheduleImport,
  json,
  loadTournamentScheduleImportContext,
  type RouteParams,
} from '../shared';

export const runtime = 'nodejs';

type ImportBatchRow = {
  id: string;
  org_id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  import_type: string;
  scope_json: unknown;
  status: string;
  summary_json: Record<string, unknown> | null;
  expires_at: string;
};

function scopeTournamentId(scope: unknown) {
  return scope && typeof scope === 'object' && !Array.isArray(scope) && typeof (scope as Record<string, unknown>).tournamentId === 'string'
    ? (scope as Record<string, string>).tournamentId
    : null;
}

function errorResponse(error: TournamentScheduleImportCommitError) {
  return json({ error: error.message, rowNumbers: error.rowNumbers }, error.status);
}

async function updateBatchStatus(batchId: string, status: 'committed' | 'failed' | 'expired', summary?: Record<string, unknown>) {
  const patch: Record<string, unknown> = { status };
  if (status === 'committed') patch.committed_at = new Date().toISOString();
  if (summary) patch.summary_json = summary;
  await supabaseAdmin.from('import_batches').update(patch).eq('id', batchId);
}

async function applyRows(input: {
  batchId: string;
  tournamentId: string;
  createRows: PreparedTournamentScheduleCommitRow[];
  updateRows: PreparedTournamentScheduleCommitRow[];
  unchangedRows: PreparedTournamentScheduleCommitRow[];
}) {
  const createdTargetIds = new Map<string, string>();
  const createRecords = input.createRows.map(row => {
    const id = crypto.randomUUID();
    createdTargetIds.set(row.id, id);
    return buildTournamentScheduleGameInsert(row.normalized, input.tournamentId, id);
  });

  if (createRecords.length > 0) {
    const { error } = await supabaseAdmin.from('games').insert(createRecords);
    if (error) throw new Error(error.message);
  }

  for (const row of input.updateRows) {
    const { error } = await supabaseAdmin
      .from('games')
      .update(buildTournamentScheduleGameUpdate(row.normalized))
      .eq('id', row.targetId)
      .eq('tournament_id', input.tournamentId);
    if (error) throw new Error(error.message);
  }

  for (const row of input.createRows) {
    const { error } = await supabaseAdmin
      .from('import_batch_rows')
      .update({ status: 'committed', target_id: createdTargetIds.get(row.id) ?? null })
      .eq('id', row.id)
      .eq('batch_id', input.batchId);
    if (error) throw new Error(error.message);
  }

  const committedRowIds = input.updateRows.map(row => row.id);
  if (committedRowIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('import_batch_rows')
      .update({ status: 'committed' })
      .in('id', committedRowIds)
      .eq('batch_id', input.batchId);
    if (error) throw new Error(error.message);
  }

  const skippedRowIds = input.unchangedRows.map(row => row.id);
  if (skippedRowIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('import_batch_rows')
      .update({ status: 'skipped' })
      .in('id', skippedRowIds)
      .eq('batch_id', input.batchId);
    if (error) throw new Error(error.message);
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const { tournamentId } = await params;
  const auth = await authorizeTournamentScheduleImport(req, tournamentId, { blockLocked: true });
  if ('response' in auth) return auth.response;

  let batchId = '';
  try {
    const body = await req.json().catch(() => ({}));
    batchId = typeof body.batchId === 'string' ? body.batchId : '';
    if (!batchId) return json({ error: 'Choose a schedule import preview to apply.' }, 400);

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('import_batches')
      .select('id, org_id, actor_user_id, actor_email, import_type, scope_json, status, summary_json, expires_at')
      .eq('id', batchId)
      .maybeSingle<ImportBatchRow>();
    if (batchError) return json({ error: batchError.message }, 500);
    if (!batch || batch.org_id !== auth.ctx.org.id || scopeTournamentId(batch.scope_json) !== tournamentId) {
      return json({ error: 'Schedule import preview was not found for this tournament.' }, 404);
    }
    if (batch.actor_user_id && batch.actor_user_id !== auth.ctx.user.id) {
      return json({ error: 'Only the admin who previewed this schedule import can apply it.' }, 403);
    }
    if (batch.import_type !== TOURNAMENT_SCHEDULE_IMPORT_TYPE) {
      return json({ error: 'This import preview is for a different importer.' }, 409);
    }
    if (batch.status !== 'previewed') {
      return json({ error: 'This schedule import preview has already been handled. Run preview again before applying.' }, 409);
    }
    if (new Date(batch.expires_at).getTime() <= Date.now()) {
      await updateBatchStatus(batch.id, 'expired');
      return json({ error: 'This schedule import preview expired. Run preview again before applying.' }, 409);
    }

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('import_batch_rows')
      .select('id, row_number, operation, target_id, normalized_json, before_json, errors_json, status')
      .eq('batch_id', batch.id)
      .order('row_number', { ascending: true });
    if (rowsError) return json({ error: rowsError.message }, 500);

    const prepared = prepareTournamentScheduleCommitRows((rows ?? []) as StoredTournamentScheduleImportRow[]);
    const context = await loadTournamentScheduleImportContext({
      tournamentId,
      orgId: auth.ctx.org.id,
      tournament: auth.tournament,
    });
    validateTournamentScheduleCommitAgainstContext(prepared, context);

    await applyRows({
      batchId: batch.id,
      tournamentId,
      createRows: prepared.createRows,
      updateRows: prepared.updateRows,
      unchangedRows: prepared.unchangedRows,
    });

    const commitSummary = summarizeTournamentScheduleCommit(prepared);
    const summary = {
      ...(batch.summary_json ?? {}),
      commit: commitSummary,
    };
    await updateBatchStatus(batch.id, 'committed', summary);

    await writePlatformEvent({
      eventType: 'tournament_registration_operation_used',
      source: 'app',
      orgId: auth.ctx.org.id,
      actorUserId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      planId: auth.ctx.org.planId,
      metadata: {
        feature: 'bulk_data_imports',
        action: 'schedule_import_commit',
        importMode: 'add_update',
        tournamentId,
        batchId: batch.id,
        created: commitSummary.created,
        updated: commitSummary.updated,
        unchanged: commitSummary.unchanged,
      },
    });

    return NextResponse.json({
      result: {
        batchId: batch.id,
        summary: commitSummary,
      },
    });
  } catch (error) {
    if (error instanceof TournamentScheduleImportCommitError) {
      return errorResponse(error);
    }
    if (batchId) {
      await updateBatchStatus(batchId, 'failed').catch(() => undefined);
    }
    return json({ error: error instanceof Error ? error.message : 'Schedule import apply failed.' }, 500);
  }
}
