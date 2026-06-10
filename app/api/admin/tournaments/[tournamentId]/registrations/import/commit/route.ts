import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  TOURNAMENT_TEAM_IMPORT_TYPE,
} from '@/lib/import/tournament-teams';
import {
  TournamentTeamImportCommitError,
  buildTournamentTeamInsert,
  buildTournamentTeamUpdate,
  didImportDivisionChange,
  prepareTournamentTeamCommitRows,
  rowsWithInvalidTournamentDivisions,
  summarizeTournamentTeamCommit,
  tournamentTeamImportIdentityKey,
  type PreparedTournamentTeamCommitRow,
  type StoredTournamentTeamImportRow,
} from '@/lib/import/tournament-teams-commit';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { manualTeamRegistrationHtml, sendEmail } from '@/lib/email';
import {
  authorizeTournamentTeamImport,
  json,
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

type TeamRow = {
  id: string;
  tournament_id: string | null;
  division_id: string | null;
  name: string;
  coach: string | null;
  email: string | null;
  status: string | null;
  payment_status: string | null;
  deposit_paid: number | null;
  total_paid: number | null;
  waitlist_position: number | null;
  admin_notes: string | null;
  slot_id: string | null;
};

type GameTeamRefRow = {
  id: string;
  home_team_id?: string | null;
  away_team_id?: string | null;
};

type DivisionRefRow = {
  id: string;
};

function scopeTournamentId(scope: unknown) {
  return scope && typeof scope === 'object' && !Array.isArray(scope) && typeof (scope as Record<string, unknown>).tournamentId === 'string'
    ? (scope as Record<string, string>).tournamentId
    : null;
}

function currentTeamSnapshot(team: TeamRow) {
  return {
    teamName: team.name,
    divisionId: team.division_id ?? '',
    coachName: team.coach ?? '',
    email: team.email ?? '',
    status: team.status ?? 'accepted',
    paymentStatus: team.payment_status ?? 'pending',
    depositPaid: team.deposit_paid ?? null,
    totalPaid: team.total_paid ?? null,
    waitlistPosition: team.waitlist_position ?? null,
    adminNotes: team.admin_notes ?? null,
  };
}

function samePreviewValue(left: unknown, right: unknown) {
  return (left ?? null) === (right ?? null);
}

function changedSincePreview(row: PreparedTournamentTeamCommitRow, current: TeamRow) {
  if (!row.before) return false;
  const snapshot = currentTeamSnapshot(current);
  return Object.entries(snapshot).some(([key, value]) => !samePreviewValue(row.before?.[key], value));
}

function errorResponse(error: TournamentTeamImportCommitError) {
  return json({ error: error.message, rowNumbers: error.rowNumbers }, error.status);
}

async function updateBatchStatus(batchId: string, status: 'committed' | 'failed' | 'expired', summary?: Record<string, unknown>) {
  const patch: Record<string, unknown> = { status };
  if (status === 'committed') patch.committed_at = new Date().toISOString();
  if (summary) patch.summary_json = summary;
  await supabaseAdmin.from('import_batches').update(patch).eq('id', batchId);
}

async function loadScheduleTeamIds(tournamentId: string, teamIds: string[]) {
  if (teamIds.length === 0) return new Set<string>();

  const [homeResult, awayResult] = await Promise.all([
    supabaseAdmin
      .from('games')
      .select('id, home_team_id')
      .eq('tournament_id', tournamentId)
      .in('home_team_id', teamIds),
    supabaseAdmin
      .from('games')
      .select('id, away_team_id')
      .eq('tournament_id', tournamentId)
      .in('away_team_id', teamIds),
  ]);

  if (homeResult.error) throw new Error(homeResult.error.message);
  if (awayResult.error) throw new Error(awayResult.error.message);

  const used = new Set<string>();
  for (const row of (homeResult.data ?? []) as GameTeamRefRow[]) {
    if (row.home_team_id) used.add(row.home_team_id);
  }
  for (const row of (awayResult.data ?? []) as GameTeamRefRow[]) {
    if (row.away_team_id) used.add(row.away_team_id);
  }
  return used;
}

async function validateCurrentState(input: {
  tournamentId: string;
  updateRows: PreparedTournamentTeamCommitRow[];
  createRows: PreparedTournamentTeamCommitRow[];
}) {
  const { data: divisionRows, error: divisionError } = await supabaseAdmin
    .from('divisions')
    .select('id')
    .eq('tournament_id', input.tournamentId);
  if (divisionError) throw new Error(divisionError.message);

  const validDivisionIds = new Set(((divisionRows ?? []) as DivisionRefRow[]).map(row => row.id));
  const invalidDivisionRows = rowsWithInvalidTournamentDivisions(
    [...input.createRows, ...input.updateRows],
    validDivisionIds,
  );
  if (invalidDivisionRows.length > 0) {
    throw new TournamentTeamImportCommitError(
      'One or more rows reference a division that no longer belongs to this tournament. Run preview again before applying.',
      409,
      invalidDivisionRows.map(row => row.rowNumber),
    );
  }

  const updateIds = input.updateRows.map(row => row.targetId).filter((id): id is string => Boolean(id));
  const teamById = new Map<string, TeamRow>();

  if (updateIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('id, tournament_id, division_id, name, coach, email, status, payment_status, deposit_paid, total_paid, waitlist_position, admin_notes, slot_id')
      .in('id', updateIds);
    if (error) throw new Error(error.message);

    for (const team of (data ?? []) as TeamRow[]) {
      teamById.set(team.id, team);
    }

    const missingRows = input.updateRows.filter(row => !row.targetId || !teamById.has(row.targetId));
    if (missingRows.length > 0) {
      throw new TournamentTeamImportCommitError('One or more teams changed since preview. Run preview again before applying.', 409, missingRows.map(row => row.rowNumber));
    }

    const outsideRows = input.updateRows.filter(row => {
      const current = row.targetId ? teamById.get(row.targetId) : null;
      return current?.tournament_id !== input.tournamentId;
    });
    if (outsideRows.length > 0) {
      throw new TournamentTeamImportCommitError('One or more teams are outside this tournament. Run preview again before applying.', 409, outsideRows.map(row => row.rowNumber));
    }

    const staleRows = input.updateRows.filter(row => {
      const current = row.targetId ? teamById.get(row.targetId) : null;
      return current ? changedSincePreview(row, current) : false;
    });
    if (staleRows.length > 0) {
      throw new TournamentTeamImportCommitError('One or more teams changed since preview. Run preview again before applying.', 409, staleRows.map(row => row.rowNumber));
    }

    const divisionChangeRows = input.updateRows.filter(didImportDivisionChange);
    if (divisionChangeRows.length > 0) {
      const changedIds = divisionChangeRows.map(row => row.targetId).filter((id): id is string => Boolean(id));
      const scheduleTeamIds = await loadScheduleTeamIds(input.tournamentId, changedIds);
      const unsafeRows = divisionChangeRows.filter(row => {
        const current = row.targetId ? teamById.get(row.targetId) : null;
        return Boolean(current?.slot_id) || Boolean(row.targetId && scheduleTeamIds.has(row.targetId));
      });
      if (unsafeRows.length > 0) {
        throw new TournamentTeamImportCommitError(
          'Rows that move scheduled or slotted teams to another division must be handled manually after clearing those assignments.',
          409,
          unsafeRows.map(row => row.rowNumber),
        );
      }
    }
  }

  if (input.createRows.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('id, division_id, name')
      .eq('tournament_id', input.tournamentId);
    if (error) throw new Error(error.message);

    const existingKeys = new Set((data ?? []).map(team => tournamentTeamImportIdentityKey(team.division_id ?? '', team.name ?? '')));
    const duplicateRows = input.createRows.filter(row => existingKeys.has(tournamentTeamImportIdentityKey(row.normalized.divisionId, row.normalized.teamName)));
    if (duplicateRows.length > 0) {
      throw new TournamentTeamImportCommitError('One or more new teams now match an existing team. Run preview again before applying.', 409, duplicateRows.map(row => row.rowNumber));
    }
  }
}

async function applyRows(input: {
  batchId: string;
  tournamentId: string;
  createRows: PreparedTournamentTeamCommitRow[];
  updateRows: PreparedTournamentTeamCommitRow[];
  unchangedRows: PreparedTournamentTeamCommitRow[];
}) {
  const createdTargetIds = new Map<string, string>();
  const createRecords = input.createRows.map(row => {
    const id = crypto.randomUUID();
    createdTargetIds.set(row.id, id);
    return buildTournamentTeamInsert(row.normalized, input.tournamentId, id);
  });

  if (createRecords.length > 0) {
    const { error } = await supabaseAdmin.from('teams').insert(createRecords);
    if (error) throw new Error(error.message);
  }

  for (const row of input.updateRows) {
    const { error } = await supabaseAdmin
      .from('teams')
      .update(buildTournamentTeamUpdate(row.normalized))
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

  return { createdTargetIds };
}

/**
 * Opt-in (default off) coach-portal claim emails for NEWLY created teams. Best-effort and run
 * AFTER the batch is committed, so a send failure never rolls back the import. Coach email is
 * NOT required — rows without an email are skipped, as are FieldLogicHQ staff emails (defense in
 * depth; the claim discovery already excludes staff).
 */
async function sendImportPortalEmails(input: {
  tournamentId: string;
  createRows: PreparedTournamentTeamCommitRow[];
  createdTargetIds: Map<string, string>;
}): Promise<number> {
  const candidates = input.createRows
    .map(row => ({ row, teamId: input.createdTargetIds.get(row.id) }))
    .filter((c): c is { row: PreparedTournamentTeamCommitRow; teamId: string } =>
      Boolean(c.teamId) && Boolean((c.row.normalized.email ?? '').trim()));
  if (candidates.length === 0) return 0;

  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('name, contact_email')
    .eq('id', input.tournamentId)
    .maybeSingle<{ name: string | null; contact_email: string | null }>();
  const tournamentName = tournament?.name ?? 'Tournament';
  const contactEmail = tournament?.contact_email ?? undefined;

  let sent = 0;
  for (const { row, teamId } of candidates) {
    const email = (row.normalized.email ?? '').trim();
    if (await isPlatformAdminEmail(email)) continue; // never invite FieldLogicHQ staff
    const result = await sendEmail(
      email,
      `Team Registered - ${row.normalized.teamName}`,
      manualTeamRegistrationHtml({
        teamName: row.normalized.teamName,
        coachName: row.normalized.coachName ?? '',
        divisionName: row.normalized.divisionName || 'Division',
        tournamentName,
        paymentStatus: row.normalized.paymentStatus === 'paid' ? 'paid' : 'pending',
        contactEmail,
        registrationId: teamId,
        coachEmail: email,
      }),
    ).catch(() => ({ status: 'provider_error' as const }));
    if (result.status === 'sent') sent++;
  }
  return sent;
}

export async function POST(req: Request, { params }: RouteParams) {
  const { tournamentId } = await params;
  const auth = await authorizeTournamentTeamImport(req, tournamentId, { blockLocked: true });
  if ('response' in auth) return auth.response;

  let batchId = '';
  try {
    const body = await req.json().catch(() => ({}));
    batchId = typeof body.batchId === 'string' ? body.batchId : '';
    if (!batchId) return json({ error: 'Choose an import preview to apply.' }, 400);
    const sendPortalEmails = body.sendPortalEmails === true;

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('import_batches')
      .select('id, org_id, actor_user_id, actor_email, import_type, scope_json, status, summary_json, expires_at')
      .eq('id', batchId)
      .maybeSingle<ImportBatchRow>();
    if (batchError) return json({ error: batchError.message }, 500);
    if (!batch || batch.org_id !== auth.ctx.org.id || scopeTournamentId(batch.scope_json) !== tournamentId) {
      return json({ error: 'Import preview was not found for this tournament.' }, 404);
    }
    if (batch.actor_user_id && batch.actor_user_id !== auth.ctx.user.id) {
      return json({ error: 'Only the admin who previewed this import can apply it.' }, 403);
    }
    if (batch.import_type !== TOURNAMENT_TEAM_IMPORT_TYPE) {
      return json({ error: 'This import preview is for a different importer.' }, 409);
    }
    if (batch.status !== 'previewed') {
      return json({ error: 'This import preview has already been handled. Run preview again before applying.' }, 409);
    }
    if (new Date(batch.expires_at).getTime() <= Date.now()) {
      await updateBatchStatus(batch.id, 'expired');
      return json({ error: 'This import preview expired. Run preview again before applying.' }, 409);
    }

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('import_batch_rows')
      .select('id, row_number, operation, target_id, normalized_json, before_json, errors_json, status')
      .eq('batch_id', batch.id)
      .order('row_number', { ascending: true });
    if (rowsError) return json({ error: rowsError.message }, 500);

    const prepared = prepareTournamentTeamCommitRows((rows ?? []) as StoredTournamentTeamImportRow[]);
    await validateCurrentState({
      tournamentId,
      createRows: prepared.createRows,
      updateRows: prepared.updateRows,
    });

    const { createdTargetIds } = await applyRows({
      batchId: batch.id,
      tournamentId,
      createRows: prepared.createRows,
      updateRows: prepared.updateRows,
      unchangedRows: prepared.unchangedRows,
    });

    const commitSummary = summarizeTournamentTeamCommit(prepared);
    const summary = {
      ...(batch.summary_json ?? {}),
      commit: commitSummary,
    };
    await updateBatchStatus(batch.id, 'committed', summary);

    // Opt-in coach-portal claim emails for newly created teams — best-effort, post-commit so a
    // send failure never rolls back the import. Coach email stays OPTIONAL: no-email rows skipped.
    let emailsSent = 0;
    if (sendPortalEmails && prepared.createRows.length > 0) {
      emailsSent = await sendImportPortalEmails({
        tournamentId,
        createRows: prepared.createRows,
        createdTargetIds,
      }).catch(() => 0);
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
        action: 'import_commit',
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
        emailsSent,
      },
    });
  } catch (error) {
    if (error instanceof TournamentTeamImportCommitError) {
      return errorResponse(error);
    }
    if (batchId) {
      await updateBatchStatus(batchId, 'failed').catch(() => undefined);
    }
    return json({ error: error instanceof Error ? error.message : 'Import apply failed.' }, 500);
  }
}
