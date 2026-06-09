import crypto from 'node:crypto';
import type { Page } from '@playwright/test';

import { supabaseAdmin } from '../../../lib/supabase-admin';
import { expect, test } from '../helpers/fixtures';

const TEAM_IMPORT_TYPE = 'tournament_teams';
const SCHEDULE_IMPORT_TYPE = 'tournament_schedule';

const HEADERS = [
  'Team ID',
  'Team Name',
  'Division ID',
  'Division Name',
  'Coach Name',
  'Email',
  'Status',
  'Payment Status',
  'Deposit Paid',
  'Total Paid',
  'Waitlist Position',
  'Admin Notes',
];

type HardeningState = {
  orgId: string;
  orgSlug: string;
  tournamentId: string;
  divisionOneId: string;
  divisionOneName: string;
  divisionTwoId: string;
  divisionTwoName: string;
  teamOneId: string;
  teamOneName: string;
  teamTwoId: string;
  teamTwoName: string;
  teamThreeId: string;
  teamThreeName: string;
};

type ApiResult = {
  body: Record<string, unknown>;
  status: number;
};

type PreviewBody = {
  preview?: {
    batchId?: string;
    canCommit?: boolean;
    summary?: Record<string, unknown>;
  };
};

let createdBatchIds: string[] = [];
let createdTournamentIds: string[] = [];

function todayString() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function csvCell(value: string | null | undefined) {
  const text = value ?? '';
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(values: Array<string | null | undefined>) {
  return values.map(csvCell).join(',');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function errorText(result: ApiResult) {
  return typeof result.body.error === 'string' ? result.body.error : '';
}

function previewBatchId(result: ApiResult) {
  const body = result.body as PreviewBody;
  const batchId = body.preview?.batchId;
  if (batchId) createdBatchIds.push(batchId);
  return batchId;
}

function uatBaseUrl() {
  return process.env.UAT_BASE_URL ?? 'http://localhost:3000';
}

async function apiResultFromResponse(response: Response): Promise<ApiResult> {
  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { body: asRecord(body), status: response.status };
}

function buildCreateCsv(state: HardeningState, input: {
  adminNotes?: string;
  divisionId?: string;
  divisionName?: string;
  email?: string;
  status?: string;
  teamName: string;
}) {
  const divisionId = input.divisionId ?? state.divisionOneId;
  const divisionName = input.divisionName ?? state.divisionOneName;
  return [
    csvLine(HEADERS),
    csvLine([
      '',
      input.teamName,
      divisionId,
      divisionName,
      `Coach ${input.teamName}`,
      input.email ?? `${input.teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@example.test`,
      input.status ?? 'accepted',
      'paid',
      '25',
      '100',
      '',
      input.adminNotes ?? 'Created by team import hardening smoke',
    ]),
  ].join('\n');
}

function buildUpdateCsv(state: HardeningState, input: {
  adminNotes?: string;
  coachName?: string;
  divisionId?: string;
  divisionName?: string;
  teamId?: string;
  teamName?: string;
}) {
  const divisionId = input.divisionId ?? state.divisionOneId;
  const divisionName = input.divisionName ?? state.divisionOneName;
  return [
    csvLine(HEADERS),
    csvLine([
      input.teamId ?? state.teamOneId,
      input.teamName ?? state.teamOneName,
      divisionId,
      divisionName,
      input.coachName ?? 'Updated Coach',
      'updated-team-import-hardening@example.test',
      'accepted',
      'paid',
      '25',
      '100',
      '',
      input.adminNotes ?? 'Updated by team import hardening smoke',
    ]),
  ].join('\n');
}

async function createHardeningState(orgSlug: string): Promise<HardeningState> {
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, slug')
    .eq('slug', orgSlug)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) throw new Error(`UAT organization ${orgSlug} was not found.`);

  const suffix = `team-import-hardening-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const smokeDate = todayString();
  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .insert({
      org_id: org.id,
      year: new Date().getFullYear(),
      name: `UAT Team Import Hardening ${suffix}`,
      slug: `uat-team-import-hardening-${suffix}`,
      status: 'active',
      is_active: true,
      start_date: smokeDate,
      end_date: smokeDate,
      settings: {},
    })
    .select('id')
    .single();

  if (tournamentError) throw tournamentError;
  createdTournamentIds.push(tournament.id);

  const divisionRows = [
    { tournament_id: tournament.id, name: `UAT Team Import Division A ${suffix}`, display_order: 1 },
    { tournament_id: tournament.id, name: `UAT Team Import Division B ${suffix}`, display_order: 2 },
  ];
  const { data: divisions, error: divisionError } = await supabaseAdmin
    .from('divisions')
    .insert(divisionRows)
    .select('id, name');

  if (divisionError) throw divisionError;
  if (!divisions || divisions.length !== 2) throw new Error('Team import hardening divisions were not created.');

  const divisionOne = divisions.find(division => division.name === divisionRows[0].name);
  const divisionTwo = divisions.find(division => division.name === divisionRows[1].name);
  if (!divisionOne || !divisionTwo) throw new Error('Team import hardening divisions could not be resolved.');

  const teamRows = [
    `Blue ${suffix}`,
    `Red ${suffix}`,
    `Gold ${suffix}`,
  ].map((name, index) => ({
    tournament_id: tournament.id,
    division_id: divisionOne.id,
    name,
    coach: `Coach ${index + 1}`,
    email: `team-import-hardening-${index + 1}-${suffix}@example.test`,
    status: 'accepted',
    payment_status: 'paid',
    deposit_paid: 25,
    total_paid: 100,
  }));

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .insert(teamRows)
    .select('id, name');

  if (teamsError) throw teamsError;
  if (!teams || teams.length !== 3) throw new Error('Team import hardening teams were not created.');

  const teamByName = new Map(teams.map(team => [team.name, team]));
  const [teamOneName, teamTwoName, teamThreeName] = teamRows.map(team => team.name);
  const teamOne = teamByName.get(teamOneName);
  const teamTwo = teamByName.get(teamTwoName);
  const teamThree = teamByName.get(teamThreeName);
  if (!teamOne || !teamTwo || !teamThree) throw new Error('Team import hardening teams could not be resolved.');

  const { error: gameError } = await supabaseAdmin
    .from('games')
    .insert({
      tournament_id: tournament.id,
      division_id: divisionOne.id,
      home_team_id: teamOne.id,
      away_team_id: teamTwo.id,
      game_date: smokeDate,
      game_time: '09:00',
      status: 'scheduled',
      is_playoff: false,
      notes: 'Team import hardening scheduled game',
    });

  if (gameError) throw gameError;

  return {
    orgId: org.id,
    orgSlug,
    tournamentId: tournament.id,
    divisionOneId: divisionOne.id,
    divisionOneName: divisionOne.name,
    divisionTwoId: divisionTwo.id,
    divisionTwoName: divisionTwo.name,
    teamOneId: teamOne.id,
    teamOneName,
    teamTwoId: teamTwo.id,
    teamTwoName,
    teamThreeId: teamThree.id,
    teamThreeName,
  };
}

async function createTargetTournament(input: { orgId: string }) {
  const suffix = `team-import-target-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const smokeDate = todayString();
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .insert({
      org_id: input.orgId,
      year: new Date().getFullYear(),
      name: `UAT Team Import Scope Target ${suffix}`,
      slug: `uat-team-import-scope-target-${suffix}`,
      status: 'active',
      is_active: true,
      start_date: smokeDate,
      end_date: smokeDate,
      settings: {},
    })
    .select('id')
    .single();

  if (error) throw error;
  createdTournamentIds.push(data.id);
  return data.id as string;
}

async function createExtraDivision(input: { displayOrder: number; name: string; tournamentId: string }) {
  const { data, error } = await supabaseAdmin
    .from('divisions')
    .insert({
      tournament_id: input.tournamentId,
      name: input.name,
      display_order: input.displayOrder,
    })
    .select('id, name')
    .single();

  if (error) throw error;
  return data;
}

async function loadOrigin(page: Page) {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
}

async function previewTeam(page: Page, state: HardeningState, csvText: string): Promise<ApiResult> {
  const result = await page.evaluate(async ({ csvText, orgSlug, tournamentId }) => {
    const form = new FormData();
    form.append('file', new File([csvText], 'team-import-hardening.csv', { type: 'text/csv' }));
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/registrations/import/preview?orgSlug=${encodeURIComponent(orgSlug)}`, {
      method: 'POST',
      body: form,
    });
    const text = await response.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { body, status: response.status };
  }, { csvText, orgSlug: state.orgSlug, tournamentId: state.tournamentId });

  return { body: asRecord(result.body), status: result.status };
}

async function previewTeamWithoutSession(state: HardeningState, csvText: string): Promise<ApiResult> {
  const form = new FormData();
  form.append('file', new Blob([csvText], { type: 'text/csv' }), 'team-import-hardening.csv');
  const response = await fetch(`${uatBaseUrl()}/api/admin/tournaments/${state.tournamentId}/registrations/import/preview?orgSlug=${encodeURIComponent(state.orgSlug)}`, {
    method: 'POST',
    body: form,
  });
  return apiResultFromResponse(response);
}

async function commitTeam(page: Page, input: { batchId: string; orgSlug: string; tournamentId: string }): Promise<ApiResult> {
  const result = await page.evaluate(async ({ batchId, orgSlug, tournamentId }) => {
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/registrations/import/commit?orgSlug=${encodeURIComponent(orgSlug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId }),
    });
    const text = await response.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    return { body, status: response.status };
  }, input);

  return { body: asRecord(result.body), status: result.status };
}

async function setTournamentStatus(tournamentId: string, status: string) {
  const { error } = await supabaseAdmin
    .from('tournaments')
    .update({ status })
    .eq('id', tournamentId);

  if (error) throw error;
}

async function insertImportBatch(input: {
  actorUserId?: string | null;
  expiresAt?: string;
  importType?: string;
  orgId: string;
  sourceFilename?: string;
  status?: string;
  tournamentId: string;
}) {
  const batchId = crypto.randomUUID();
  const { error } = await supabaseAdmin
    .from('import_batches')
    .insert({
      id: batchId,
      org_id: input.orgId,
      actor_user_id: input.actorUserId ?? null,
      actor_email: 'uat-team-import-hardening@example.test',
      import_type: input.importType ?? TEAM_IMPORT_TYPE,
      scope_json: { tournamentId: input.tournamentId },
      source_filename: input.sourceFilename ?? 'team-import-hardening.csv',
      status: input.status ?? 'previewed',
      summary_json: { totalRows: 0 },
      ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    });

  if (error) throw error;
  createdBatchIds.push(batchId);
  return batchId;
}

test.describe.serial('Tournament team import route hardening', () => {
  test.setTimeout(120_000);

  test.afterEach(async () => {
    if (createdBatchIds.length > 0) {
      await supabaseAdmin
        .from('import_batches')
        .delete()
        .in('id', createdBatchIds);
      createdBatchIds = [];
    }

    if (createdTournamentIds.length > 0) {
      await supabaseAdmin
        .from('tournaments')
        .delete()
        .in('id', createdTournamentIds);
      createdTournamentIds = [];
    }
  });

  test('rejects unsafe preview and apply states before team data changes', async ({ orgSlug, ownerPage }) => {
    const state = await createHardeningState(orgSlug);
    const otherTournamentId = await createTargetTournament({ orgId: state.orgId });
    const cleanCsv = buildCreateCsv(state, { teamName: `New Safe Team ${Date.now()}` });
    const blockedCsv = buildCreateCsv(state, {
      status: 'unknown-status',
      teamName: `Blocked Team ${Date.now()}`,
    });

    await loadOrigin(ownerPage);

    const unauthenticatedPreview = await previewTeamWithoutSession(state, cleanCsv);
    expect([401, 403, 404]).toContain(unauthenticatedPreview.status);
    expect((unauthenticatedPreview.body as PreviewBody).preview).toBeUndefined();

    await setTournamentStatus(state.tournamentId, 'completed');
    const lockedPreview = await previewTeam(ownerPage, state, cleanCsv);
    expect(lockedPreview.status).toBe(409);
    expect(errorText(lockedPreview)).toContain('completed and locked');
    await setTournamentStatus(state.tournamentId, 'active');

    const lockBatchId = await insertImportBatch({
      orgId: state.orgId,
      tournamentId: state.tournamentId,
    });
    await setTournamentStatus(state.tournamentId, 'completed');
    const lockedCommit = await commitTeam(ownerPage, {
      batchId: lockBatchId,
      orgSlug,
      tournamentId: state.tournamentId,
    });
    expect(lockedCommit.status).toBe(409);
    expect(errorText(lockedCommit)).toContain('completed and locked');
    await setTournamentStatus(state.tournamentId, 'active');

    const wrongActorBatchId = await insertImportBatch({
      actorUserId: crypto.randomUUID(),
      orgId: state.orgId,
      tournamentId: state.tournamentId,
    });
    const wrongActorCommit = await commitTeam(ownerPage, {
      batchId: wrongActorBatchId,
      orgSlug,
      tournamentId: state.tournamentId,
    });
    expect(wrongActorCommit.status).toBe(403);
    expect(errorText(wrongActorCommit)).toContain('Only the admin who previewed this import can apply it');

    const wrongImporterBatchId = await insertImportBatch({
      importType: SCHEDULE_IMPORT_TYPE,
      orgId: state.orgId,
      tournamentId: state.tournamentId,
    });
    const wrongImporterCommit = await commitTeam(ownerPage, {
      batchId: wrongImporterBatchId,
      orgSlug,
      tournamentId: state.tournamentId,
    });
    expect(wrongImporterCommit.status).toBe(409);
    expect(errorText(wrongImporterCommit)).toContain('different importer');

    const scopedBatchId = await insertImportBatch({
      orgId: state.orgId,
      tournamentId: state.tournamentId,
    });
    const scopedCommit = await commitTeam(ownerPage, {
      batchId: scopedBatchId,
      orgSlug,
      tournamentId: otherTournamentId,
    });
    expect(scopedCommit.status).toBe(404);
    expect(errorText(scopedCommit)).toContain('not found for this tournament');

    const handledBatchId = await insertImportBatch({
      orgId: state.orgId,
      status: 'committed',
      tournamentId: state.tournamentId,
    });
    const handledCommit = await commitTeam(ownerPage, {
      batchId: handledBatchId,
      orgSlug,
      tournamentId: state.tournamentId,
    });
    expect(handledCommit.status).toBe(409);
    expect(errorText(handledCommit)).toContain('already been handled');

    const expiredBatchId = await insertImportBatch({
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      orgId: state.orgId,
      tournamentId: state.tournamentId,
    });
    const expiredCommit = await commitTeam(ownerPage, {
      batchId: expiredBatchId,
      orgSlug,
      tournamentId: state.tournamentId,
    });
    expect(expiredCommit.status).toBe(409);
    expect(errorText(expiredCommit)).toContain('expired');
    await expect.poll(async () => {
      const { data, error } = await supabaseAdmin
        .from('import_batches')
        .select('status')
        .eq('id', expiredBatchId)
        .maybeSingle();
      if (error) throw error;
      return data?.status;
    }).toBe('expired');

    const blockedPreview = await previewTeam(ownerPage, state, blockedCsv);
    expect(blockedPreview.status).toBe(200);
    expect((blockedPreview.body as PreviewBody).preview?.summary).toMatchObject({
      blocked: 1,
      totalRows: 1,
    });
    expect((blockedPreview.body as PreviewBody).preview?.canCommit).toBe(false);
    const blockedBatchId = previewBatchId(blockedPreview);
    expect(blockedBatchId).toBeTruthy();

    const blockedCommit = await commitTeam(ownerPage, {
      batchId: blockedBatchId ?? '',
      orgSlug,
      tournamentId: state.tournamentId,
    });
    expect(blockedCommit.status).toBe(409);
    expect(errorText(blockedCommit)).toContain('Resolve blocked rows');
    expect(blockedCommit.body.rowNumbers).toEqual([2]);
  });

  test('rejects stale, duplicate, invalid-division, and scheduled-team apply states', async ({ orgSlug, ownerPage }) => {
    await loadOrigin(ownerPage);

    const staleState = await createHardeningState(orgSlug);
    const stalePreview = await previewTeam(ownerPage, staleState, buildUpdateCsv(staleState, {
      coachName: 'Preview Coach Change',
    }));
    expect(stalePreview.status).toBe(200);
    const staleBatchId = previewBatchId(stalePreview);
    expect(staleBatchId).toBeTruthy();
    const { error: staleUpdateError } = await supabaseAdmin
      .from('teams')
      .update({ coach: 'Changed outside import after preview' })
      .eq('id', staleState.teamOneId);
    if (staleUpdateError) throw staleUpdateError;
    const staleCommit = await commitTeam(ownerPage, {
      batchId: staleBatchId ?? '',
      orgSlug,
      tournamentId: staleState.tournamentId,
    });
    expect(staleCommit.status).toBe(409);
    expect(errorText(staleCommit)).toContain('changed since preview');
    expect(staleCommit.body.rowNumbers).toEqual([2]);

    const duplicateState = await createHardeningState(orgSlug);
    const duplicateName = `Duplicate After Preview ${Date.now()}`;
    const duplicatePreview = await previewTeam(ownerPage, duplicateState, buildCreateCsv(duplicateState, {
      teamName: duplicateName,
    }));
    expect(duplicatePreview.status).toBe(200);
    const duplicateBatchId = previewBatchId(duplicatePreview);
    expect(duplicateBatchId).toBeTruthy();
    const { error: duplicateInsertError } = await supabaseAdmin
      .from('teams')
      .insert({
        tournament_id: duplicateState.tournamentId,
        division_id: duplicateState.divisionOneId,
        name: duplicateName,
        coach: 'Duplicate Coach',
        email: `duplicate-after-preview-${Date.now()}@example.test`,
        status: 'accepted',
        payment_status: 'paid',
      });
    if (duplicateInsertError) throw duplicateInsertError;
    const duplicateCommit = await commitTeam(ownerPage, {
      batchId: duplicateBatchId ?? '',
      orgSlug,
      tournamentId: duplicateState.tournamentId,
    });
    expect(duplicateCommit.status).toBe(409);
    expect(errorText(duplicateCommit)).toContain('now match an existing team');
    expect(duplicateCommit.body.rowNumbers).toEqual([2]);

    const invalidDivisionState = await createHardeningState(orgSlug);
    const extraDivision = await createExtraDivision({
      displayOrder: 3,
      name: `Deleted Import Division ${Date.now()}`,
      tournamentId: invalidDivisionState.tournamentId,
    });
    const invalidDivisionPreview = await previewTeam(ownerPage, invalidDivisionState, buildCreateCsv(invalidDivisionState, {
      divisionId: extraDivision.id,
      divisionName: extraDivision.name,
      teamName: `Invalid Division After Preview ${Date.now()}`,
    }));
    expect(invalidDivisionPreview.status).toBe(200);
    const invalidDivisionBatchId = previewBatchId(invalidDivisionPreview);
    expect(invalidDivisionBatchId).toBeTruthy();
    const { error: deleteDivisionError } = await supabaseAdmin
      .from('divisions')
      .delete()
      .eq('id', extraDivision.id);
    if (deleteDivisionError) throw deleteDivisionError;
    const invalidDivisionCommit = await commitTeam(ownerPage, {
      batchId: invalidDivisionBatchId ?? '',
      orgSlug,
      tournamentId: invalidDivisionState.tournamentId,
    });
    expect(invalidDivisionCommit.status).toBe(409);
    expect(errorText(invalidDivisionCommit)).toContain('division that no longer belongs');
    expect(invalidDivisionCommit.body.rowNumbers).toEqual([2]);

    const scheduledMoveState = await createHardeningState(orgSlug);
    const scheduledMovePreview = await previewTeam(ownerPage, scheduledMoveState, buildUpdateCsv(scheduledMoveState, {
      divisionId: scheduledMoveState.divisionTwoId,
      divisionName: scheduledMoveState.divisionTwoName,
      teamId: scheduledMoveState.teamOneId,
      teamName: scheduledMoveState.teamOneName,
    }));
    expect(scheduledMovePreview.status).toBe(200);
    const scheduledMoveBatchId = previewBatchId(scheduledMovePreview);
    expect(scheduledMoveBatchId).toBeTruthy();
    const scheduledMoveCommit = await commitTeam(ownerPage, {
      batchId: scheduledMoveBatchId ?? '',
      orgSlug,
      tournamentId: scheduledMoveState.tournamentId,
    });
    expect(scheduledMoveCommit.status).toBe(409);
    expect(errorText(scheduledMoveCommit)).toContain('scheduled or slotted teams');
    expect(scheduledMoveCommit.body.rowNumbers).toEqual([2]);
  });
});
