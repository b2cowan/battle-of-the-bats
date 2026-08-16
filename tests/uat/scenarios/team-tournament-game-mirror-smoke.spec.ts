import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { grantMembershipsFromSeasonRows, clearMemberships } from './_coach-membership-fixture';

/**
 * Real tournament games become first-class team events (Coach Portal Batch 4, P0 #2).
 *
 * PERMANENT regression coverage, deliberately kept rather than deleted after the build: the
 * reconcile it exercises — reschedule, delete-and-recreate re-point, orphan cancel-vs-delete, and
 * the 409 refusals — is stateful multi-request behaviour that unit tests can't reach and code
 * review can't confirm, and getting it wrong silently destroys a coach's saved lineup.
 *
 * Self-provisions DB rows via service-role, matching the other `*-smoke.spec.ts` files in this
 * directory (see `team-attendance-smoke.spec.ts`). Every row carries the `b4probe-` marker; the
 * suite pre-cleans before provisioning and tears down after, and the teardown is asserted, not
 * assumed.
 *
 * Computed styles / real DOM assertions only — never screenshots (memory/feedback_verify_with_playwright_not_screenshots.md).
 * ⚠ The portal has an OUTER layout <main> wrapping the phone-hidden sidebar; scope text assertions
 * to `main[class*="coachesMain"]` or `.first()` matches hidden nav copy.
 */

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}
loadEnv();

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const MARK = 'b4probe';
const EMAIL = `${MARK}-coach@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
const PHONE = { width: 360, height: 740 };

let orgId = '';
let userId = '';
let repTeamId = '';
let programYearId = '';
let tournamentId = '';
let divisionId = '';
let registrationId = '';
let playerIds: string[] = [];
const gameIds: string[] = [];

/** YYYY-MM-DD n days from today. */
function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function cleanup() {
  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    await admin.from('rep_team_tournament_registrations').delete().eq('rep_team_id', t.id);
    await admin.from('rep_team_events').delete().eq('team_id', t.id);
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      await admin.from('rep_roster_players').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_coaches').delete().eq('program_year_id', y.id);
    }
    await admin.from('rep_program_years').delete().eq('team_id', t.id);
    // M1: memberships are team-scoped — clear them before the team row goes, or the
    // FK leaves the team undeletable and it surfaces as the teardown assertion.
    await clearMemberships(admin, t.id);
    await admin.from('rep_teams').delete().eq('id', t.id);
  }
  const { data: tourneys } = await admin.from('tournaments').select('id').like('name', `${MARK}%`);
  for (const tr of tourneys ?? []) {
    await admin.from('games').delete().eq('tournament_id', tr.id);
    await admin.from('teams').delete().eq('tournament_id', tr.id);
    await admin.from('divisions').delete().eq('tournament_id', tr.id);
    await admin.from('tournaments').delete().eq('id', tr.id);
  }
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of users?.users ?? []) {
    if (u.email === EMAIL) {
      await admin.from('organization_members').delete().eq('user_id', u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  orgId = org!.id;

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (userErr) throw userErr;
  userId = created.user!.id;

  // getAuthContext requires the membership row or the portal bounces to /discover.
  await admin.from('organization_members').insert({
    organization_id: orgId, user_id: userId, role: 'coach',
    status: 'active', accepted_at: new Date().toISOString(),
  });

  const { data: team, error: teamErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} Riverside 14U`, slug: `${MARK}-riverside-14u`, sport: 'softball' })
    .select('id').single();
  if (teamErr) throw teamErr;
  repTeamId = team!.id;

  const { data: year } = await admin.from('rep_program_years')
    .insert({ team_id: repTeamId, org_id: orgId, name: `${MARK} 2026`, year: 2026, status: 'active' })
    .select('id').single();
  programYearId = year!.id;

  // ⚠ Probe-recipe gotcha (cost a full run): `coach_role` is CHECK-constrained to 'head_coach' /
  // 'assistant_coach' — 'head' is silently rejected — and the table has NO email/name columns. A
  // failed insert here reads downstream as "the mirror didn't run", so error-check every insert.
  const { error: coachErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: userId, coach_role: 'head_coach',
  });
  if (coachErr) throw coachErr;

  const { data: players, error: playerErr } = await admin.from('rep_roster_players').insert([
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, player_first_name: 'Avery', player_last_name: 'M', player_number: '7', status: 'active' },
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, player_first_name: 'Jordan', player_last_name: 'S', player_number: '12', status: 'active' },
  ]).select('id');
  if (playerErr) throw playerErr;
  playerIds = (players ?? []).map(p => p.id);

  // A coach-owned practice that outlives the tournament-game churn — so the Attendance page's
  // "take attendance for…" test asserts against a real target rather than the (also correct)
  // empty state it would otherwise reach after the removal test.
  const { error: practiceErr } = await admin.from('rep_team_events').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    event_type: 'practice', name: `${MARK} Practice`, starts_at: `${day(6)}T18:00:00`, status: 'scheduled',
  });
  if (practiceErr) throw practiceErr;

  // ── The tournament side: an ACCEPTED registration in a PUBLISHED division. Both are part of
  // the honest-reveal contract the mirror inherits — an unpublished division reveals nothing.
  const { data: tournament } = await admin.from('tournaments')
    .insert({ org_id: orgId, name: `${MARK} Spring Classic`, slug: `${MARK}-spring-classic`, year: 2026, status: 'active', start_date: day(3), end_date: day(4) })
    .select('id').single();
  tournamentId = tournament!.id;

  const { data: division } = await admin.from('divisions')
    .insert({ tournament_id: tournamentId, name: 'U14', schedule_visibility: 'published' })
    .select('id').single();
  divisionId = division!.id;

  const { data: regs } = await admin.from('teams').insert([
    { tournament_id: tournamentId, division_id: divisionId, name: `${MARK} Riverside 14U`, status: 'accepted' },
    { tournament_id: tournamentId, division_id: divisionId, name: 'Kanata Selects', status: 'accepted' },
    { tournament_id: tournamentId, division_id: divisionId, name: 'Barrhaven Blue', status: 'accepted' },
  ]).select('id, name');
  registrationId = regs!.find(r => r.name.startsWith(MARK))!.id;
  const kanataId = regs!.find(r => r.name === 'Kanata Selects')!.id;
  const barrhavenId = regs!.find(r => r.name === 'Barrhaven Blue')!.id;

  // The mig-196 admin-link bridge — an org-created rep team's only route to a registration.
  await admin.from('rep_team_tournament_registrations').insert({
    tournament_team_id: registrationId, rep_team_id: repTeamId, org_id: orgId, link_source: 'explicit',
  });

  const { data: anchorReg } = await admin.from('teams')
    .insert({ tournament_id: tournamentId, division_id: divisionId, name: 'Nepean Nite', status: 'accepted' })
    .select('id').single();

  const { data: games, error: gamesErr } = await admin.from('games').insert([
    { tournament_id: tournamentId, division_id: divisionId, home_team_id: registrationId, away_team_id: kanataId, game_date: day(3), game_time: '09:00:00', location: 'Millennium Park', status: 'scheduled' },
    { tournament_id: tournamentId, division_id: divisionId, home_team_id: barrhavenId, away_team_id: registrationId, game_date: day(3), game_time: '13:30:00', location: 'Millennium Park', status: 'scheduled' },
    // An unresolved bracket slot — no date, so it can never be mirrored.
    { tournament_id: tournamentId, division_id: divisionId, home_team_id: registrationId, away_placeholder: 'Winner QF2', status: 'scheduled' },
    // An ANCHOR game, never touched by any test. It keeps the tournament revealing at least one
    // game throughout — which is what separates "the organizer removed this game" (cancel/delete)
    // from "this tournament's schedule went offline" (leave everything alone).
    { tournament_id: tournamentId, division_id: divisionId, home_team_id: registrationId, away_team_id: anchorReg!.id, game_date: day(5), game_time: '11:00:00', location: 'Millennium Park', status: 'scheduled' },
  ]).select('id, game_time');
  if (gamesErr) throw gamesErr;
  for (const g of games ?? []) gameIds.push(g.id);

  /**
   * ⚠ M1 MEMBERSHIPS — THE ACCESS TRUTH (owner ruling 2026-08-16, mig 245). Without this every
   * coach above 403s at the first membership-gated route, and the spec fails for a reason that
   * has nothing to do with what it tests. PROJECTED from the season rows rather than restated,
   * so the pair can never disagree — see tests/uat/scenarios/_coach-membership-fixture.ts.
   */
  await grantMembershipsFromSeasonRows(admin, repTeamId);
});

test.afterAll(async () => {
  await cleanup();
  const { data: leftTeams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  const { data: leftTourneys } = await admin.from('tournaments').select('id').like('name', `${MARK}%`);
  expect(leftTeams ?? []).toHaveLength(0);
  expect(leftTourneys ?? []).toHaveLength(0);
});

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}

const base = () => `/${ORG_SLUG}/coaches/teams/${repTeamId}`;

/** The mirror runs on the shared events read; warm it so a cold Turbopack compile can't be mistaken
 *  for a missing mirror. */
async function warmAndSync(page: import('@playwright/test').Page) {
  await page.goto(`${base()}/schedule`);
  await page.waitForLoadState('networkidle');
}

/**
 * Force a fresh reconcile after changing the tournament side. The sync debounces a page-set
 * (10s per season), so a probe that changes a game and re-reads immediately would assert against
 * the previous reconcile. Waiting the window out exercises the real route with no test-only hook.
 */
async function resync(page: import('@playwright/test').Page) {
  await page.waitForTimeout(10_500);
  const res = await page.request.get(`/api/coaches/${ORG_SLUG}/teams/${repTeamId}/events`);
  expect(res.ok(), await res.text()).toBeTruthy();
}

test.describe('Batch 4 — tournament games get real tools', () => {
  // Fresh context: the shared UAT project seeds an org-owner session, and this probe signs in as
  // its own disposable coach.
  test.use({ viewport: PHONE, storageState: { cookies: [], origins: [] } });

  test('a real tournament game becomes an editable event with attendance and a lineup', async ({ page }) => {
    await signIn(page);
    await warmAndSync(page);

    // 1. The mirror landed: two DATED games, the undated bracket slot skipped.
    const { data: mirrored } = await admin.from('rep_team_events')
      .select('id, name, opponent, starts_at, event_type, source_tournament_game_id, home_away')
      .eq('program_year_id', programYearId)
      .not('source_tournament_game_id', 'is', null)
      .order('starts_at');
    expect(mirrored, 'all three dated tournament games mirror; the undated bracket slot does not').toHaveLength(3);
    expect(mirrored![0].event_type).toBe('tournament_game');
    expect(mirrored![0].name).toBe(`${MARK} Spring Classic`);
    expect(mirrored!.map(m => m.opponent).sort()).toEqual(['Barrhaven Blue', 'Kanata Selects', 'Nepean Nite']);
    // Team-relative side, not literal home/away on the games row.
    expect(mirrored!.find(m => m.opponent === 'Kanata Selects')!.home_away).toBe('home');
    expect(mirrored!.find(m => m.opponent === 'Barrhaven Blue')!.home_away).toBe('away');

    const mirrorEventId = mirrored!.find(m => m.opponent === 'Kanata Selects')!.id;

    // 2. It renders as a real event row (a button, i.e. it opens the editor) — NOT a read-only chip,
    //    and with NO provenance badge (owner call: the colour rail + tournament name carry it).
    const main = page.locator('main[class*="coachesMain"]');
    const row = main.getByRole('button', { name: /Kanata Selects/ });
    await expect(row).toBeVisible();
    // Owner call: NO provenance badge on the row — the colour rail and the tournament name carry it.
    expect(await row.textContent()).not.toMatch(/\bTournament\b/);
    // The undated bracket slot still shows in its own group, read-only.
    await expect(main.getByText('To be scheduled')).toBeVisible();

    // 3. Nothing renders twice — exactly one row per mirrored game.
    await expect(main.getByRole('button', { name: /Kanata Selects/ })).toHaveCount(1);

    // 4. Opening it gives the game panel with attendance, plus the provenance line.
    await row.click();
    await expect(page.getByText(/organizer’s schedule/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Attendance/ })).toBeVisible();
    // No Delete / Cancel event on an organizer-owned game.
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Cancel event/ })).toHaveCount(0);
    await expect(page.getByText(/can cancel or remove this game/)).toBeVisible();

    // 5. Attendance saves against the mirrored game.
    const attRes = await page.request.patch(
      `/api/coaches/${ORG_SLUG}/teams/${repTeamId}/events/${mirrorEventId}/attendance`,
      { data: { entries: playerIds.map(id => ({ playerId: id, status: 'attending' })) } },
    );
    expect(attRes.ok(), await attRes.text()).toBeTruthy();
    const { data: attRows } = await admin.from('rep_team_event_attendance').select('id').eq('event_id', mirrorEventId);
    expect(attRows ?? []).toHaveLength(2);

    // 6. A lineup saves against it, and the Lineups page counts it as ready.
    const lineupRes = await page.request.put(
      `/api/coaches/${ORG_SLUG}/teams/${repTeamId}/events/${mirrorEventId}/lineup`,
      {
        data: {
          lineupMode: 'everyone_bats', inningCount: 7,
          entries: playerIds.map((id, i) => ({
            playerId: id, battingOrder: i + 1, starter: true, inningPositions: { 1: i === 0 ? 'P' : 'C' },
          })),
        },
      },
    );
    expect(lineupRes.ok(), await lineupRes.text()).toBeTruthy();

    await page.goto(`${base()}/lineups`);
    await page.waitForLoadState('networkidle');
    const lineupsMain = page.locator('main[class*="coachesMain"]');
    await expect(lineupsMain.getByText(/Kanata Selects/).first()).toBeVisible();
  });

  test('the organizer’s facts are refused by the API, not just hidden in the UI', async ({ page }) => {
    await signIn(page);
    await warmAndSync(page);
    // Target the Barrhaven game explicitly: the coach-owned write below sets fields that would
    // otherwise change the cancel-vs-delete outcome a later test asserts on.
    const { data: mirrored } = await admin.from('rep_team_events')
      .select('id').eq('program_year_id', programYearId).eq('opponent', 'Kanata Selects').single();
    const id = mirrored!.id;

    const moveRes = await page.request.patch(
      `/api/coaches/${ORG_SLUG}/teams/${repTeamId}/events/${id}`,
      { data: { startsAt: `${day(9)}T18:00` } },
    );
    expect(moveRes.status(), 'moving an organizer-owned game is refused').toBe(409);

    const scoreRes = await page.request.patch(
      `/api/coaches/${ORG_SLUG}/teams/${repTeamId}/events/${id}`,
      { data: { teamScore: 12, opponentScore: 0 } },
    );
    expect(scoreRes.status(), 'inventing a score is refused').toBe(409);

    const delRes = await page.request.delete(`/api/coaches/${ORG_SLUG}/teams/${repTeamId}/events/${id}?scope=one`);
    expect(delRes.status(), 'deleting the organizer’s game is refused').toBe(409);

    // The coach's OWN fields still save.
    const okRes = await page.request.patch(
      `/api/coaches/${ORG_SLUG}/teams/${repTeamId}/events/${id}`,
      { data: { arrivalTime: '08:15', uniform: 'Home whites' } },
    );
    expect(okRes.ok(), await okRes.text()).toBeTruthy();
    const { data: after } = await admin.from('rep_team_events').select('arrival_time, uniform, starts_at').eq('id', id).single();
    expect(after!.arrival_time).toBe('08:15');
    expect(after!.uniform).toBe('Home whites');
  });

  // Two full debounce windows plus page loads — this one needs more than the 60s default.
  test('a reschedule keeps the lineup, and a delete-and-recreate re-points instead of stranding it', async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    await warmAndSync(page);

    const kanataGameId = gameIds[0];
    const { data: before } = await admin.from('rep_team_events')
      .select('id').eq('source_tournament_game_id', kanataGameId).single();
    const eventId = before!.id;

    // Give it real coach work first — this is what must survive.
    await page.request.put(`/api/coaches/${ORG_SLUG}/teams/${repTeamId}/events/${eventId}/lineup`, {
      data: {
        lineupMode: 'everyone_bats', inningCount: 7,
        entries: playerIds.map((id, i) => ({ playerId: id, battingOrder: i + 1, starter: true, inningPositions: { 1: i === 0 ? 'P' : 'C' } })),
      },
    });

    // ── The organizer MOVES it ────────────────────────────────────────────────
    await admin.from('games').update({ game_date: day(4), game_time: '14:00:00' }).eq('id', kanataGameId);
    await resync(page);

    const { data: moved } = await admin.from('rep_team_events').select('id, starts_at').eq('id', eventId).single();
    expect(moved!.starts_at.slice(0, 10), 'the game moved with the organizer').toBe(day(4));
    const { data: lineupAfterMove } = await admin.from('rep_team_lineups').select('id').eq('event_id', eventId);
    expect(lineupAfterMove ?? [], 'the lineup rode along — same event, new time').toHaveLength(1);

    // The Schedule flags it as Moved (this device had seen the old time on first load).
    await page.goto(`${base()}/schedule`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main[class*="coachesMain"]').getByText('Moved', { exact: true })).toBeVisible();

    // ── The organizer DELETES and RE-CREATES it (bracket regeneration) ────────
    await admin.from('games').delete().eq('id', kanataGameId);
    const { data: replacement } = await admin.from('games').insert({
      tournament_id: tournamentId, division_id: divisionId,
      home_team_id: registrationId, away_team_id: (await admin.from('teams').select('id').eq('tournament_id', tournamentId).eq('name', 'Kanata Selects').single()).data!.id,
      game_date: day(4), game_time: '15:00:00', location: 'Millennium Park', status: 'scheduled',
    }).select('id').single();
    gameIds.push(replacement!.id);

    await resync(page);

    const { data: repointed } = await admin.from('rep_team_events')
      .select('id, source_tournament_game_id, status').eq('id', eventId).single();
    expect(repointed!.source_tournament_game_id, 'the coach’s game followed to its new identity').toBe(replacement!.id);
    expect(repointed!.status, 'and was never cancelled along the way').toBe('scheduled');
    const { data: lineupAfterRepoint } = await admin.from('rep_team_lineups').select('id').eq('event_id', eventId);
    expect(lineupAfterRepoint ?? [], 'the lineup survived a wholesale re-identify').toHaveLength(1);
  });

  test('a removed game is cancelled when the coach worked on it, and vanishes cleanly when they did not', async ({ page }) => {
    await signIn(page);
    await warmAndSync(page);

    // The Barrhaven game has no coach work — it should disappear without a trace.
    const untouchedGameId = gameIds[1];
    const { data: untouched } = await admin.from('rep_team_events')
      .select('id').eq('source_tournament_game_id', untouchedGameId).single();
    const untouchedEventId = untouched!.id;

    // The Kanata game gets attendance, so it must be KEPT (cancelled), not deleted.
    const { data: worked } = await admin.from('rep_team_events')
      .select('id, source_tournament_game_id').eq('program_year_id', programYearId)
      .eq('opponent', 'Kanata Selects').single();
    await page.request.patch(
      `/api/coaches/${ORG_SLUG}/teams/${repTeamId}/events/${worked!.id}/attendance`,
      { data: { entries: playerIds.map(id => ({ playerId: id, status: 'attending' })) } },
    );

    // The organizer removes both of those. The ANCHOR game stays, so the tournament is still
    // showing this team a schedule — which is what makes "removed" mean removed, rather than
    // "this tournament's schedule went offline".
    await admin.from('games').delete().eq('id', untouchedGameId);
    await admin.from('games').delete().eq('id', worked!.source_tournament_game_id);
    await resync(page);

    const { data: goneRow } = await admin.from('rep_team_events').select('id').eq('id', untouchedEventId).maybeSingle();
    expect(goneRow, 'an untouched removed game leaves no phantom behind').toBeNull();

    const { data: keptRow } = await admin.from('rep_team_events').select('id, status').eq('id', worked!.id).maybeSingle();
    expect(keptRow, 'a game the coach worked on is never deleted').not.toBeNull();
    expect(keptRow!.status).toBe('cancelled');
    const { data: keptAttendance } = await admin.from('rep_team_event_attendance').select('id').eq('event_id', worked!.id);
    expect(keptAttendance ?? [], 'their attendance survived').toHaveLength(2);
  });

  test('a tournament that stops showing ANY games is a retracted schedule, not a mass cancellation', async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    await warmAndSync(page);

    const before = await admin.from('rep_team_events').select('id, status')
      .eq('program_year_id', programYearId).not('source_tournament_game_id', 'is', null);
    expect(before.data?.length ?? 0, 'some mirrored games remain from the earlier tests').toBeGreaterThan(0);
    const liveBefore = (before.data ?? []).filter(r => r.status === 'scheduled').map(r => r.id).sort();
    expect(liveBefore.length).toBeGreaterThan(0);

    // Take the division's schedule offline — exactly what the platform does automatically when an
    // organizer reopens registration. Every remaining game stops being revealable at once.
    await admin.from('divisions').update({ schedule_visibility: 'unpublished' }).eq('id', divisionId);
    await resync(page);

    const after = await admin.from('rep_team_events').select('id, status')
      .eq('program_year_id', programYearId).not('source_tournament_game_id', 'is', null);
    const liveAfter = (after.data ?? []).filter(r => r.status === 'scheduled').map(r => r.id).sort();
    expect(liveAfter, 'nothing is marked cancelled just because the schedule went offline').toEqual(liveBefore);

    // …and it heals on its own when the organizer publishes again.
    await admin.from('divisions').update({ schedule_visibility: 'published' }).eq('id', divisionId);
    await resync(page);
    const healed = await admin.from('rep_team_events').select('id, status')
      .eq('program_year_id', programYearId).not('source_tournament_game_id', 'is', null);
    expect((healed.data ?? []).filter(r => r.status === 'scheduled').map(r => r.id).sort()).toEqual(liveBefore);
  });

  /**
   * ⚠ REWRITTEN 2026-08-15 (plan Phase 3). This test used to assert "Attendance has a real home in
   * the nav" — and it did, in both navs. It does not any more, and that is the change, not a
   * regression: nothing is ever RECORDED on that page (marking happens in the Schedule's event
   * panel, which this test still pins), so it is a report and its one parent is the Insights hub.
   * The assertion is inverted rather than deleted, so a future change that quietly re-adds the nav
   * item fails here instead of silently restoring the double-parent this phase removed.
   */
  test('Attendance is a report under Insights, and the page still says where to record it', async ({ page }) => {
    await signIn(page);
    await page.goto(`${base()}/attendance`);
    await page.waitForLoadState('networkidle');

    const main = page.locator('main[class*="coachesMain"]');
    // The page is titled as a question now, and the word for word must match the Insights door
    // that leads here — a door and its destination disagreeing about their own name is exactly
    // what having one parent is supposed to prevent.
    await expect(main.getByRole('heading', { name: /Who's showing up\?/ })).toBeVisible();

    // The card links straight to where attendance is recorded, for a specific event — the review's
    // complaint was that this page explained itself but never said where to go. Asserting the
    // event-scoped href (not just the words) is what stops the honest empty state, whose CTA is a
    // bare /schedule link, from passing this test. UNCHANGED by Phase 3: the recording flow moved
    // nowhere.
    const cta = main.getByRole('link', { name: /Take attendance/ });
    await expect(cta).toHaveAttribute('href', /\/schedule\?event=.+&tab=attendance/);

    // Phone: the More sheet must NOT carry it any more — it left both navs together.
    await page.getByRole('button', { name: /More/i }).click();
    await expect(page.getByRole('link', { name: 'Attendance', exact: true })).toHaveCount(0);
    // ...and the door that replaced it is right there in the same sheet.
    await expect(page.getByRole('link', { name: 'Insights', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // Nothing scrolls sideways at 360.
    const widths = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    }));
    expect(widths.doc).toBe(widths.vw);
  });

  /** The Insights hub is now the report's ONLY live door, so the hub must actually carry it. */
  test('the Insights hub carries the attendance door, worded exactly as the page it opens', async ({ page }) => {
    await signIn(page);
    await page.goto(`${base()}/history`);
    await page.waitForLoadState('networkidle');

    const door = page.locator('main').getByRole('link', { name: /Who's showing up\?/ });
    await expect(door).toBeVisible();
    await expect(door).toHaveAttribute('href', /\/attendance$/);
  });
});
