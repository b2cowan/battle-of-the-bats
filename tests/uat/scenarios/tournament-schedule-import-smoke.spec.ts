import { expect, test } from '@playwright/test';
import path from 'node:path';

import { supabaseAdmin } from '../../../lib/supabase-admin';

const OWNER_STORAGE = path.join(__dirname, '../.auth/org-owner.json');

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

type SmokeState = {
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
  updatedNote: string;
  createdNote: string;
};

let state: SmokeState | null = null;

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

function buildImportCsv(smoke: SmokeState) {
  return [
    csvLine(HEADERS),
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
      smoke.updatedNote,
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
      smoke.createdNote,
    ]),
  ].join('\n');
}

async function createSmokeState(): Promise<SmokeState> {
  const orgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org';
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, slug')
    .eq('slug', orgSlug)
    .maybeSingle();

  if (orgError) throw orgError;
  if (!org) throw new Error(`UAT organization ${orgSlug} was not found.`);

  const suffix = `schedule-import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const smokeDate = todayString();
  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .insert({
      org_id: org.id,
      year: new Date().getFullYear(),
      name: `UAT Schedule Import ${suffix}`,
      slug: `uat-schedule-import-${suffix}`,
      status: 'active',
      is_active: true,
      start_date: smokeDate,
      end_date: smokeDate,
      settings: { game_duration_minutes: 90, buffer_minutes: 15 },
    })
    .select('id')
    .single();

  if (tournamentError) throw tournamentError;

  const venueName = `UAT Import Diamond ${suffix}`;
  const { data: venue, error: venueError } = await supabaseAdmin
    .from('diamonds')
    .insert({
      tournament_id: tournament.id,
      name: venueName,
      address: 'UAT Import Park',
    })
    .select('id, name')
    .single();

  if (venueError) throw venueError;

  const divisionName = `UAT Import Division ${suffix}`;
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
    email: `schedule-import-${index + 1}-${suffix}@example.test`,
    status: 'accepted',
    payment_status: 'paid',
  }));

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .insert(teamRows)
    .select('id, name')
    .order('name', { ascending: true });

  if (teamsError) throw teamsError;
  if (!teams || teams.length !== 4) throw new Error('Schedule import smoke teams were not created.');

  const teamByName = new Map(teams.map(team => [team.name, team]));
  const [teamOneName, teamTwoName, teamThreeName, teamFourName] = teamRows.map(team => team.name);
  const teamOne = teamByName.get(teamOneName);
  const teamTwo = teamByName.get(teamTwoName);
  const teamThree = teamByName.get(teamThreeName);
  const teamFour = teamByName.get(teamFourName);
  if (!teamOne || !teamTwo || !teamThree || !teamFour) throw new Error('Schedule import smoke teams could not be resolved.');

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
      notes: 'Original schedule import smoke game',
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
    updatedNote: `Updated by schedule import smoke ${suffix}`,
    createdNote: `Created by schedule import smoke ${suffix}`,
  };
}

async function readSmokeGames(smoke: SmokeState) {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('id, game_time, notes, home_team_id, away_team_id, status')
    .eq('tournament_id', smoke.tournamentId)
    .order('game_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

test.describe.serial('Tournament schedule import UAT smoke', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    state = await createSmokeState();
  });

  test.afterAll(async () => {
    if (!state) return;
    await supabaseAdmin.from('tournaments').delete().eq('id', state.tournamentId);
  });

  test('previews and applies add/update schedule rows', async ({ browser }) => {
    const smoke = state;
    if (!smoke) throw new Error('Schedule import smoke state was not initialized.');

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

    const csv = buildImportCsv(smoke);
    const previewResponse = await page.evaluate(async ({ csvText, orgSlug, tournamentId }) => {
      const form = new FormData();
      form.append('file', new File([csvText], 'schedule-import-smoke.csv', { type: 'text/csv' }));
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/schedule/import/preview?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        body: form,
      });
      return { body: await response.json(), status: response.status };
    }, { csvText: csv, orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.preview.summary).toMatchObject({
      creates: 1,
      updates: 1,
      blocked: 0,
    });
    expect(previewResponse.body.preview.canCommit).toBe(true);

    const batchId = previewResponse.body.preview.batchId as string;
    const commitResponse = await page.evaluate(async ({ batchId, orgSlug, tournamentId }) => {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/schedule/import/commit?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      return { body: await response.json(), status: response.status };
    }, { batchId, orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

    expect(commitResponse.status).toBe(200);
    expect(commitResponse.body.result.summary).toEqual({
      created: 1,
      updated: 1,
      unchanged: 0,
      skipped: 0,
    });

    await expect.poll(async () => {
      const games = await readSmokeGames(smoke);
      return games.map(game => ({
        awayTeamId: game.away_team_id,
        homeTeamId: game.home_team_id,
        notes: game.notes,
        status: game.status,
        time: String(game.game_time).slice(0, 5),
      }));
    }, { timeout: 10_000 }).toContainEqual({
      awayTeamId: smoke.teamTwoId,
      homeTeamId: smoke.teamOneId,
      notes: smoke.updatedNote,
      status: 'scheduled',
      time: '09:30',
    });

    const games = await readSmokeGames(smoke);
    expect(games).toEqual(expect.arrayContaining([
      expect.objectContaining({
        home_team_id: smoke.teamThreeId,
        away_team_id: smoke.teamFourId,
        notes: smoke.createdNote,
        status: 'scheduled',
      }),
    ]));

    const historyResponse = await page.evaluate(async ({ orgSlug, tournamentId }) => {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/imports/history?orgSlug=${encodeURIComponent(orgSlug)}&limit=5`);
      return { body: await response.json(), status: response.status };
    }, { orgSlug: smoke.orgSlug, tournamentId: smoke.tournamentId });

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.imports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: batchId,
        importLabel: 'Schedule',
        status: 'committed',
      }),
    ]));

    await context.close();
  });
});
