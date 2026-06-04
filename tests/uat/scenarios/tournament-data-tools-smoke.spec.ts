import path from 'node:path';
import { expect, test } from '@playwright/test';

import { supabaseAdmin } from '../../../lib/supabase-admin';

const OWNER_STORAGE = path.join(__dirname, '../.auth/org-owner.json');

const TEAM_HEADERS = [
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

const SCHEDULE_HEADERS = [
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

type SmokeState = {
  orgId: string;
  orgSlug: string;
  originalPlanId: string | null;
  originalSubscriptionStatus: string | null;
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
  updatedTeamCoach: string;
  createdTeamName: string;
  updatedGameNote: string;
  createdGameNote: string;
};

type ApiResult = {
  body: Record<string, unknown>;
  status: number;
};

let state: SmokeState | null = null;
let createdBatchIds: string[] = [];

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

function previewBatchId(result: ApiResult) {
  const preview = asRecord(result.body.preview);
  const batchId = typeof preview.batchId === 'string' ? preview.batchId : '';
  if (batchId) createdBatchIds.push(batchId);
  return batchId;
}

function buildTeamImportCsv(smoke: SmokeState) {
  return [
    csvLine(TEAM_HEADERS),
    csvLine([
      smoke.teamOneId,
      smoke.teamOneName,
      smoke.divisionId,
      smoke.divisionName,
      smoke.updatedTeamCoach,
      `updated-${smoke.teamOneId}@example.test`,
      'accepted',
      'paid',
      '25',
      '100',
      '',
      'Updated by combined Data Tools smoke',
    ]),
    csvLine([
      '',
      smoke.createdTeamName,
      smoke.divisionId,
      smoke.divisionName,
      'Created Coach',
      `created-${smoke.teamTwoId}@example.test`,
      'accepted',
      'pending',
      '',
      '',
      '',
      'Created by combined Data Tools smoke',
    ]),
  ].join('\n');
}

function buildScheduleImportCsv(smoke: SmokeState) {
  return [
    csvLine(SCHEDULE_HEADERS),
    csvLine([
      smoke.existingGameId,
      'pool',
      smoke.divisionId,
      smoke.divisionName,
      smoke.teamOneId,
      smoke.teamOneName,
      smoke.teamTwoId,
      smoke.teamTwoName,
      smoke.smokeDate,
      '09:30',
      smoke.venueId,
      smoke.venueName,
      '',
      '',
      smoke.venueName,
      'scheduled',
      smoke.updatedGameNote,
    ]),
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
      '12:00',
      smoke.venueId,
      smoke.venueName,
      '',
      '',
      smoke.venueName,
      'scheduled',
      smoke.createdGameNote,
    ]),
  ].join('\n');
}

async function createSmokeState(): Promise<SmokeState> {
  const orgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org';
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, plan_id, subscription_status')
    .eq('slug', orgSlug)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) throw new Error(`UAT organization ${orgSlug} was not found.`);

  const suffix = `data-tools-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const smokeDate = todayString();
  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .insert({
      org_id: org.id,
      year: new Date().getFullYear(),
      name: `UAT Data Tools ${suffix}`,
      slug: `uat-data-tools-${suffix}`,
      status: 'active',
      is_active: true,
      start_date: smokeDate,
      end_date: smokeDate,
      settings: { game_duration_minutes: 90, buffer_minutes: 15 },
    })
    .select('id')
    .single();

  if (tournamentError) throw tournamentError;

  const venueName = `UAT Data Tools Diamond ${suffix}`;
  const { data: venue, error: venueError } = await supabaseAdmin
    .from('diamonds')
    .insert({
      tournament_id: tournament.id,
      name: venueName,
      address: 'UAT Data Tools Park',
    })
    .select('id, name')
    .single();

  if (venueError) throw venueError;

  const divisionName = `UAT Data Tools Division ${suffix}`;
  const { data: division, error: divisionError } = await supabaseAdmin
    .from('divisions')
    .insert({
      tournament_id: tournament.id,
      name: divisionName,
      display_order: 1,
      schedule_visibility: 'published_teams',
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
    email: `data-tools-${index + 1}-${suffix}@example.test`,
    players: [],
    status: 'accepted',
    payment_status: 'paid',
  }));

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .insert(teamRows)
    .select('id, name');

  if (teamsError) throw teamsError;
  if (!teams || teams.length !== 4) throw new Error('Data Tools smoke teams were not created.');

  const teamByName = new Map(teams.map(team => [team.name, team]));
  const [teamOneName, teamTwoName, teamThreeName, teamFourName] = teamRows.map(team => team.name);
  const teamOne = teamByName.get(teamOneName);
  const teamTwo = teamByName.get(teamTwoName);
  const teamThree = teamByName.get(teamThreeName);
  const teamFour = teamByName.get(teamFourName);
  if (!teamOne || !teamTwo || !teamThree || !teamFour) throw new Error('Data Tools smoke teams could not be resolved.');

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
      notes: 'Original Data Tools smoke game',
    })
    .select('id')
    .single();

  if (gameError) throw gameError;

  return {
    orgId: org.id,
    orgSlug: org.slug,
    originalPlanId: org.plan_id,
    originalSubscriptionStatus: org.subscription_status,
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
    updatedTeamCoach: `Updated Coach ${suffix}`,
    createdTeamName: `Created Data Tools Team ${suffix}`,
    updatedGameNote: `Updated by combined Data Tools smoke ${suffix}`,
    createdGameNote: `Created by combined Data Tools smoke ${suffix}`,
  };
}

async function restoreOrgPlan(smoke: SmokeState) {
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({
      plan_id: smoke.originalPlanId ?? 'tournament_plus',
      subscription_status: smoke.originalSubscriptionStatus ?? 'active',
    })
    .eq('id', smoke.orgId);

  if (error) throw error;
}

async function readTeams(smoke: SmokeState) {
  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id, name, coach, email')
    .eq('tournament_id', smoke.tournamentId);

  if (error) throw error;
  return data ?? [];
}

async function readGames(smoke: SmokeState) {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('id, game_time, notes, home_team_id, away_team_id, status')
    .eq('tournament_id', smoke.tournamentId)
    .order('game_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

test.describe.serial('Tournament Data Tools combined UAT smoke', () => {
  test.setTimeout(150_000);

  test.beforeAll(async () => {
    state = await createSmokeState();
  });

  test.afterAll(async () => {
    if (!state) return;
    await restoreOrgPlan(state);

    if (createdBatchIds.length > 0) {
      await supabaseAdmin
        .from('import_batches')
        .delete()
        .in('id', createdBatchIds);
      createdBatchIds = [];
    }

    await supabaseAdmin.from('tournaments').delete().eq('id', state.tournamentId);
  });

  test('downloads templates, applies team and schedule imports, records history, and shows paywall upgrade UI', async ({ browser }) => {
    const smoke = state;
    if (!smoke) throw new Error('Data Tools smoke state was not initialized.');

    const context = await browser.newContext({ storageState: OWNER_STORAGE });
    await context.addInitScript(({ key, tournamentId }) => {
      window.localStorage.setItem(key, tournamentId);
    }, {
      key: `botb_admin_tournament_id:${smoke.orgSlug}`,
      tournamentId: smoke.tournamentId,
    });
    const page = await context.newPage();

    await page.goto(`/${smoke.orgSlug}/admin/tournaments/data-tools`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Data Tools' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Add\/update teams/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Add\/update schedule/i })).toBeVisible({ timeout: 20_000 });

    const templateChecks = await page.evaluate(async ({ orgSlug, tournamentId }) => {
      const urls = [
        `/api/admin/tournaments/${tournamentId}/registrations/import/template?mode=current&format=xlsx&orgSlug=${encodeURIComponent(orgSlug)}`,
        `/api/admin/tournaments/${tournamentId}/registrations/import/template?mode=empty&format=csv&orgSlug=${encodeURIComponent(orgSlug)}`,
        `/api/admin/tournaments/${tournamentId}/schedule/import/template?mode=current&format=xlsx&orgSlug=${encodeURIComponent(orgSlug)}`,
        `/api/admin/tournaments/${tournamentId}/schedule/import/template?mode=empty&format=csv&orgSlug=${encodeURIComponent(orgSlug)}`,
      ];

      return Promise.all(urls.map(async url => {
        const response = await fetch(url);
        const bytes = await response.arrayBuffer();
        return {
          contentDisposition: response.headers.get('content-disposition') ?? '',
          contentType: response.headers.get('content-type') ?? '',
          size: bytes.byteLength,
          status: response.status,
          url,
        };
      }));
    }, { orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

    for (const check of templateChecks) {
      expect(check.status, check.url).toBe(200);
      expect(check.size, check.url).toBeGreaterThan(40);
      expect(check.contentDisposition, check.url).toContain('filename=');
    }

    const teamPreview = await page.evaluate(async ({ csvText, orgSlug, tournamentId }) => {
      const form = new FormData();
      form.append('file', new File([csvText], 'data-tools-team-smoke.csv', { type: 'text/csv' }));
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/registrations/import/preview?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        body: form,
      });
      return { body: await response.json(), status: response.status };
    }, { csvText: buildTeamImportCsv(smoke), orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

    expect(teamPreview.status, JSON.stringify(teamPreview.body)).toBe(200);
    expect(teamPreview.body.preview.summary).toMatchObject({
      creates: 1,
      updates: 1,
      blocked: 0,
    });
    expect(teamPreview.body.preview.canCommit).toBe(true);
    const teamBatchId = previewBatchId(teamPreview);
    expect(teamBatchId).toBeTruthy();

    const teamCommit = await page.evaluate(async ({ batchId, orgSlug, tournamentId }) => {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/registrations/import/commit?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      return { body: await response.json(), status: response.status };
    }, { batchId: teamBatchId, orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

    expect(teamCommit.status, JSON.stringify(teamCommit.body)).toBe(200);
    expect(teamCommit.body.result.summary).toEqual({
      created: 1,
      updated: 1,
      unchanged: 0,
      skipped: 0,
    });

    await expect.poll(async () => {
      const teams = await readTeams(smoke);
      return teams.map(team => ({
        coach: team.coach,
        name: team.name,
      }));
    }, { timeout: 10_000 }).toEqual(expect.arrayContaining([
      expect.objectContaining({ coach: smoke.updatedTeamCoach, name: smoke.teamOneName }),
      expect.objectContaining({ name: smoke.createdTeamName }),
    ]));

    const schedulePreview = await page.evaluate(async ({ csvText, orgSlug, tournamentId }) => {
      const form = new FormData();
      form.append('file', new File([csvText], 'data-tools-schedule-smoke.csv', { type: 'text/csv' }));
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/schedule/import/preview?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        body: form,
      });
      return { body: await response.json(), status: response.status };
    }, { csvText: buildScheduleImportCsv(smoke), orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

    expect(schedulePreview.status, JSON.stringify(schedulePreview.body)).toBe(200);
    expect(schedulePreview.body.preview.summary).toMatchObject({
      creates: 1,
      updates: 1,
      blocked: 0,
    });
    expect(schedulePreview.body.preview.canCommit).toBe(true);
    const scheduleBatchId = previewBatchId(schedulePreview);
    expect(scheduleBatchId).toBeTruthy();

    const scheduleCommit = await page.evaluate(async ({ batchId, orgSlug, tournamentId }) => {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/schedule/import/commit?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      return { body: await response.json(), status: response.status };
    }, { batchId: scheduleBatchId, orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

    expect(scheduleCommit.status, JSON.stringify(scheduleCommit.body)).toBe(200);
    expect(scheduleCommit.body.result.summary).toEqual({
      created: 1,
      updated: 1,
      unchanged: 0,
      skipped: 0,
    });

    await expect.poll(async () => {
      const games = await readGames(smoke);
      return games.map(game => ({
        awayTeamId: game.away_team_id,
        homeTeamId: game.home_team_id,
        notes: game.notes,
        status: game.status,
        time: String(game.game_time).slice(0, 5),
      }));
    }, { timeout: 10_000 }).toEqual(expect.arrayContaining([
      expect.objectContaining({
        awayTeamId: smoke.teamTwoId,
        homeTeamId: smoke.teamOneId,
        notes: smoke.updatedGameNote,
        status: 'scheduled',
        time: '09:30',
      }),
      expect.objectContaining({
        awayTeamId: smoke.teamFourId,
        homeTeamId: smoke.teamThreeId,
        notes: smoke.createdGameNote,
        status: 'scheduled',
      }),
    ]));

    const history = await page.evaluate(async ({ orgSlug, tournamentId }) => {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/imports/history?orgSlug=${encodeURIComponent(orgSlug)}&limit=8`);
      return { body: await response.json(), status: response.status };
    }, { orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

    expect(history.status).toBe(200);
    expect(history.body.imports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: teamBatchId,
        importLabel: 'Teams & Registrations',
        status: 'committed',
      }),
      expect.objectContaining({
        id: scheduleBatchId,
        importLabel: 'Schedule',
        status: 'committed',
      }),
    ]));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Teams & Registrations').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Schedule').first()).toBeVisible({ timeout: 20_000 });

    const { error: downgradeError } = await supabaseAdmin
      .from('organizations')
      .update({ plan_id: 'tournament', subscription_status: 'active' })
      .eq('id', smoke.orgId);
    if (downgradeError) throw downgradeError;

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Unlock import/export workflows' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('link', { name: /Review Tournament Plus/i })).toBeVisible();

    await restoreOrgPlan(smoke);
    await context.close();
  });
});
