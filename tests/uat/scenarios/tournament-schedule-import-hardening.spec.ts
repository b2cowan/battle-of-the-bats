import crypto from 'node:crypto';
import type { Page } from '@playwright/test';

import { supabaseAdmin } from '../../../lib/supabase-admin';
import { expect, test } from '../helpers/fixtures';

const SCHEDULE_IMPORT_TYPE = 'tournament_schedule';
const TEAM_IMPORT_TYPE = 'tournament_teams';

const HEADERS = [
  'Game ID',
  'Game Type',
  'Division ID',
  'Division Name',
  'Home Team ID',
  'Home Team',
  'Away Team ID',
  'Away Team',
  'Game Date',
  'Start Time',
  'Venue ID',
  'Venue Name',
  'Facility ID',
  'Facility Name',
  'Location',
  'Status',
  'Notes',
];

type HardeningState = {
  orgId: string;
  orgSlug: string;
  tournamentId: string;
  divisionId: string;
  divisionName: string;
  venueId: string;
  venueName: string;
  existingGameId: string;
  teamOneId: string;
  teamOneName: string;
  teamTwoId: string;
  teamTwoName: string;
  teamThreeId: string;
  teamThreeName: string;
  teamFourId: string;
  teamFourName: string;
  smokeDate: string;
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

function buildCreateCsv(smoke: HardeningState, input: { note: string; startTime: string }) {
  return [
    csvLine(HEADERS),
    csvLine([
      '',
      'pool',
      smoke.divisionId,
      smoke.divisionName,
      smoke.teamThreeId,
      smoke.teamThreeName,
      smoke.teamFourId,
      smoke.teamFourName,
      smoke.smokeDate,
      input.startTime,
      smoke.venueId,
      smoke.venueName,
      '',
      '',
      smoke.venueName,
      'scheduled',
      input.note,
    ]),
  ].join('\n');
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

async function createHardeningState(orgSlug: string): Promise<HardeningState> {
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, slug')
    .eq('slug', orgSlug)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) throw new Error(`UAT organization ${orgSlug} was not found.`);

  const suffix = `schedule-import-hardening-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const smokeDate = todayString();
  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .insert({
      org_id: org.id,
      year: new Date().getFullYear(),
      name: `UAT Schedule Import Hardening ${suffix}`,
      slug: `uat-schedule-import-hardening-${suffix}`,
      status: 'active',
      is_active: true,
      start_date: smokeDate,
      end_date: smokeDate,
      settings: { game_duration_minutes: 90, buffer_minutes: 15 },
    })
    .select('id')
    .single();

  if (tournamentError) throw tournamentError;
  createdTournamentIds.push(tournament.id);

  const venueName = `UAT Hardening Diamond ${suffix}`;
  const { data: venue, error: venueError } = await supabaseAdmin
    .from('diamonds')
    .insert({
      tournament_id: tournament.id,
      name: venueName,
      address: 'UAT Hardening Park',
    })
    .select('id, name')
    .single();

  if (venueError) throw venueError;

  const divisionName = `UAT Hardening Division ${suffix}`;
  const { data: division, error: divisionError } = await supabaseAdmin
    .from('divisions')
    .insert({
      tournament_id: tournament.id,
      name: divisionName,
      display_order: 1,
      schedule_visibility: 'published',
      settings: { game_duration_minutes: 90, buffer_minutes: 15 },
    })
    .select('id, name')
    .single();

  if (divisionError) throw divisionError;

  const teamRows = [
    `Blue ${suffix}`,
    `Red ${suffix}`,
    `Gold ${suffix}`,
    `Green ${suffix}`,
  ].map((name, index) => ({
    tournament_id: tournament.id,
    division_id: division.id,
    name,
    coach: `Coach ${index + 1}`,
    email: `schedule-import-hardening-${index + 1}-${suffix}@example.test`,
    status: 'accepted',
    payment_status: 'paid',
  }));

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .insert(teamRows)
    .select('id, name');

  if (teamsError) throw teamsError;
  if (!teams || teams.length !== 4) throw new Error('Schedule import hardening teams were not created.');

  const teamByName = new Map(teams.map(team => [team.name, team]));
  const [teamOneName, teamTwoName, teamThreeName, teamFourName] = teamRows.map(team => team.name);
  const teamOne = teamByName.get(teamOneName);
  const teamTwo = teamByName.get(teamTwoName);
  const teamThree = teamByName.get(teamThreeName);
  const teamFour = teamByName.get(teamFourName);
  if (!teamOne || !teamTwo || !teamThree || !teamFour) throw new Error('Schedule import hardening teams could not be resolved.');

  const { data: game, error: gameError } = await supabaseAdmin
    .from('games')
    .insert({
      tournament_id: tournament.id,
      division_id: division.id,
      home_team_id: teamOne.id,
      away_team_id: teamTwo.id,
      game_date: smokeDate,
      game_time: '09:00',
      location: venue.name,
      diamond_id: venue.id,
      status: 'scheduled',
      is_playoff: false,
      notes: 'Original schedule import hardening game',
    })
    .select('id')
    .single();

  if (gameError) throw gameError;

  return {
    orgId: org.id,
    orgSlug,
    tournamentId: tournament.id,
    divisionId: division.id,
    divisionName: division.name,
    venueId: venue.id,
    venueName: venue.name,
    existingGameId: game.id,
    teamOneId: teamOne.id,
    teamOneName,
    teamTwoId: teamTwo.id,
    teamTwoName,
    teamThreeId: teamThree.id,
    teamThreeName,
    teamFourId: teamFour.id,
    teamFourName,
    smokeDate,
  };
}

async function createTargetTournament(input: { orgId: string }) {
  const suffix = `schedule-import-target-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const smokeDate = todayString();
  const { data, error } = await supabaseAdmin
    .from('tournaments')
    .insert({
      org_id: input.orgId,
      year: new Date().getFullYear(),
      name: `UAT Schedule Import Scope Target ${suffix}`,
      slug: `uat-schedule-import-scope-target-${suffix}`,
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

async function loadOrigin(page: Page) {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
}

async function previewSchedule(page: Page, smoke: HardeningState, csvText: string): Promise<ApiResult> {
  const result = await page.evaluate(async ({ csvText, orgSlug, tournamentId }) => {
    const form = new FormData();
    form.append('file', new File([csvText], 'schedule-import-hardening.csv', { type: 'text/csv' }));
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/schedule/import/preview?orgSlug=${encodeURIComponent(orgSlug)}`, {
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
  }, { csvText, orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

  return { body: asRecord(result.body), status: result.status };
}

async function previewScheduleWithoutSession(smoke: HardeningState, csvText: string): Promise<ApiResult> {
  const form = new FormData();
  form.append('file', new Blob([csvText], { type: 'text/csv' }), 'schedule-import-hardening.csv');
  const response = await fetch(`${uatBaseUrl()}/api/admin/tournaments/${smoke.tournamentId}/schedule/import/preview?orgSlug=${encodeURIComponent(smoke.orgSlug)}`, {
    method: 'POST',
    body: form,
  });
  return apiResultFromResponse(response);
}

async function commitSchedule(page: Page, input: { batchId: string; orgSlug: string; tournamentId: string }): Promise<ApiResult> {
  const result = await page.evaluate(async ({ batchId, orgSlug, tournamentId }) => {
    const response = await fetch(`/api/admin/tournaments/${tournamentId}/schedule/import/commit?orgSlug=${encodeURIComponent(orgSlug)}`, {
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
      actor_email: 'uat-schedule-import-hardening@example.test',
      import_type: input.importType ?? SCHEDULE_IMPORT_TYPE,
      scope_json: { tournamentId: input.tournamentId },
      source_filename: input.sourceFilename ?? 'schedule-import-hardening.csv',
      status: input.status ?? 'previewed',
      summary_json: { totalRows: 0 },
      ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    });

  if (error) throw error;
  createdBatchIds.push(batchId);
  return batchId;
}

test.describe.serial('Tournament schedule import route hardening', () => {
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

  test('rejects unsafe preview and apply states before schedule data changes', async ({ orgSlug, ownerPage }) => {
    const smoke = await createHardeningState(orgSlug);
    const otherTournamentId = await createTargetTournament({ orgId: smoke.orgId });
    const blockedCsv = buildCreateCsv(smoke, {
      note: 'This row overlaps the existing game',
      startTime: '09:30',
    });
    const nonConflictingCsv = buildCreateCsv(smoke, {
      note: 'This row should only be used to create a preview batch',
      startTime: '13:30',
    });

    await loadOrigin(ownerPage);

    const unauthenticatedPreview = await previewScheduleWithoutSession(smoke, nonConflictingCsv);
    expect([401, 403, 404]).toContain(unauthenticatedPreview.status);
    expect((unauthenticatedPreview.body as PreviewBody).preview).toBeUndefined();

    await setTournamentStatus(smoke.tournamentId, 'completed');
    const lockedPreview = await previewSchedule(ownerPage, smoke, nonConflictingCsv);
    expect(lockedPreview.status).toBe(409);
    expect(errorText(lockedPreview)).toContain('completed and locked');
    await setTournamentStatus(smoke.tournamentId, 'active');

    const lockBatchId = await insertImportBatch({
      orgId: smoke.orgId,
      tournamentId: smoke.tournamentId,
    });
    await setTournamentStatus(smoke.tournamentId, 'completed');
    const lockedCommit = await commitSchedule(ownerPage, {
      batchId: lockBatchId,
      orgSlug,
      tournamentId: smoke.tournamentId,
    });
    expect(lockedCommit.status).toBe(409);
    expect(errorText(lockedCommit)).toContain('completed and locked');
    await setTournamentStatus(smoke.tournamentId, 'active');

    const wrongActorBatchId = await insertImportBatch({
      actorUserId: crypto.randomUUID(),
      orgId: smoke.orgId,
      tournamentId: smoke.tournamentId,
    });
    const wrongActorCommit = await commitSchedule(ownerPage, {
      batchId: wrongActorBatchId,
      orgSlug,
      tournamentId: smoke.tournamentId,
    });
    expect(wrongActorCommit.status).toBe(403);
    expect(errorText(wrongActorCommit)).toContain('Only the admin who previewed this schedule import can apply it');

    const wrongImporterBatchId = await insertImportBatch({
      importType: TEAM_IMPORT_TYPE,
      orgId: smoke.orgId,
      tournamentId: smoke.tournamentId,
    });
    const wrongImporterCommit = await commitSchedule(ownerPage, {
      batchId: wrongImporterBatchId,
      orgSlug,
      tournamentId: smoke.tournamentId,
    });
    expect(wrongImporterCommit.status).toBe(409);
    expect(errorText(wrongImporterCommit)).toContain('different importer');

    const scopedBatchId = await insertImportBatch({
      orgId: smoke.orgId,
      tournamentId: smoke.tournamentId,
    });
    const scopedCommit = await commitSchedule(ownerPage, {
      batchId: scopedBatchId,
      orgSlug,
      tournamentId: otherTournamentId,
    });
    expect(scopedCommit.status).toBe(404);
    expect(errorText(scopedCommit)).toContain('not found for this tournament');

    const handledBatchId = await insertImportBatch({
      orgId: smoke.orgId,
      status: 'committed',
      tournamentId: smoke.tournamentId,
    });
    const handledCommit = await commitSchedule(ownerPage, {
      batchId: handledBatchId,
      orgSlug,
      tournamentId: smoke.tournamentId,
    });
    expect(handledCommit.status).toBe(409);
    expect(errorText(handledCommit)).toContain('already been handled');

    const expiredBatchId = await insertImportBatch({
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      orgId: smoke.orgId,
      tournamentId: smoke.tournamentId,
    });
    const expiredCommit = await commitSchedule(ownerPage, {
      batchId: expiredBatchId,
      orgSlug,
      tournamentId: smoke.tournamentId,
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

    const blockedPreview = await previewSchedule(ownerPage, smoke, blockedCsv);
    expect(blockedPreview.status).toBe(200);
    expect((blockedPreview.body as PreviewBody).preview?.summary).toMatchObject({
      blocked: 1,
      totalRows: 1,
    });
    expect((blockedPreview.body as PreviewBody).preview?.canCommit).toBe(false);
    const blockedBatchId = previewBatchId(blockedPreview);
    expect(blockedBatchId).toBeTruthy();

    const blockedCommit = await commitSchedule(ownerPage, {
      batchId: blockedBatchId ?? '',
      orgSlug,
      tournamentId: smoke.tournamentId,
    });
    expect(blockedCommit.status).toBe(409);
    expect(errorText(blockedCommit)).toContain('Resolve blocked rows');
    expect(blockedCommit.body.rowNumbers).toEqual([2]);
  });
});
