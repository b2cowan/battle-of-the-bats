import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { parseCSV } from '@/lib/import/csv';
import { parseXLSX } from '@/lib/import/xlsx';
import {
  TOURNAMENT_SCHEDULE_IMPORT_MAX_ROWS,
  TOURNAMENT_SCHEDULE_IMPORT_TYPE,
  buildTournamentScheduleImportPreview,
} from '@/lib/import/tournament-schedule';
import { ImportParseError } from '@/lib/import/types';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  authorizeTournamentScheduleImport,
  json,
  loadTournamentScheduleImportContext,
  type RouteParams,
} from '../shared';

export const runtime = 'nodejs';

function getFileExtension(name: string) {
  return name.toLowerCase().split('.').pop() ?? '';
}

async function parseUploadedFile(file: File) {
  const extension = getFileExtension(file.name);
  const buffer = await file.arrayBuffer();

  if (extension === 'csv') {
    return parseCSV(new TextDecoder().decode(buffer), TOURNAMENT_SCHEDULE_IMPORT_MAX_ROWS);
  }
  if (extension === 'xlsx') {
    return parseXLSX(buffer, TOURNAMENT_SCHEDULE_IMPORT_MAX_ROWS);
  }

  throw new ImportParseError('Upload an .xlsx or .csv file.');
}

export async function POST(req: Request, { params }: RouteParams) {
  const { tournamentId } = await params;
  const auth = await authorizeTournamentScheduleImport(req, tournamentId, { blockLocked: true });
  if ('response' in auth) return auth.response;

  try {
    const formData = await req.formData();
    const uploaded = formData.get('file');
    if (!(uploaded instanceof File)) {
      return json({ error: 'Choose an .xlsx or .csv file to preview.' }, 400);
    }

    const parsed = await parseUploadedFile(uploaded);
    const context = await loadTournamentScheduleImportContext({
      tournamentId,
      orgId: auth.ctx.org.id,
      tournament: auth.tournament,
    });
    const batchId = crypto.randomUUID();
    const preview = buildTournamentScheduleImportPreview(parsed, context, batchId);

    const { error: batchError } = await supabaseAdmin.from('import_batches').insert({
      id: batchId,
      org_id: auth.ctx.org.id,
      actor_user_id: auth.ctx.user.id,
      actor_email: auth.ctx.user.email,
      import_type: TOURNAMENT_SCHEDULE_IMPORT_TYPE,
      scope_json: { tournamentId },
      source_filename: uploaded.name,
      status: 'previewed',
      summary_json: { ...preview.summary, notices: preview.notices ?? [] },
    });
    if (batchError) return json({ error: batchError.message }, 500);

    if (preview.rows.length > 0) {
      const { error: rowError } = await supabaseAdmin.from('import_batch_rows').insert(preview.rows.map(row => ({
        batch_id: batchId,
        row_number: row.rowNumber,
        operation: row.operation,
        target_id: row.targetId ?? null,
        raw_json: row.raw,
        normalized_json: row.normalized,
        before_json: row.before ?? null,
        after_json: row.after ?? null,
        warnings_json: row.warnings,
        errors_json: row.errors,
        status: 'previewed',
      })));
      if (rowError) return json({ error: rowError.message }, 500);
    }

    await writePlatformEvent({
      eventType: 'tournament_registration_operation_used',
      source: 'app',
      orgId: auth.ctx.org.id,
      actorUserId: auth.ctx.user.id,
      actorEmail: auth.ctx.user.email,
      planId: auth.ctx.org.planId,
      metadata: {
        feature: 'bulk_data_imports',
        action: 'schedule_import_preview',
        tournamentId,
        batchId,
        rowCount: preview.summary.totalRows,
        blocked: preview.summary.blocked,
        warnings: preview.summary.warnings,
      },
    });

    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof ImportParseError) {
      return json({ error: error.message }, error.status);
    }
    return json({ error: error instanceof Error ? error.message : 'Schedule import preview failed.' }, 500);
  }
}
