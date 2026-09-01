import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE MEMBERSHIP SMOKE — "the team is the account" (M1), and the season dial is gone (Design A).
 *
 * ⚠ **This file was `coach-frozen-season-smoke.spec.ts`.** It walked an ARCHIVE: a coach dialled
 * into a past season and every screen was checked for read-only-ness. P1 re-aimed its access probes
 * at team membership; P2 deleted the place they walked. Renamed rather than rewritten from scratch,
 * because most of what it proved is still true — it just belongs to a different subject now.
 *
 * PERMANENT regression coverage for what unit tests cannot see. Six properties:
 *
 *  1. **MEMBERSHIP IS THE ACCESS TRUTH.** Revoking it closes every season at once, at the server —
 *     not by losing a menu item. Re-adding restores. The season's staff RECORD row survives, because
 *     who coached that year is a fact.
 *  2. **CURRENT CAPABILITIES, EVERYWHERE** (owner ruling 2026-08-16, replacing Chunk F's governing
 *     rule 1). The assistant granted money TODAY reads the finished season's money — the recorded
 *     WIDENING. If that 200 ever turns 403, someone has un-decided an owner ruling.
 *  3. **BETWEEN SEASONS IS AN ORDINARY STATE, NOT A LOCK-OUT.** A team whose working season has
 *     finished keeps its whole nav, lands on Season's End, and renders every record read-only. This
 *     is the state that used to swap the coach onto a second, shorter menu.
 *  4. **A FINISHED SEASON IS A RECORD** — no write control anywhere, one level down as well as at
 *     the top. (The source-level half is `tests/unit/coach-history-endpoint-guard.test.ts`.)
 *  5. **THE DIAL IS GONE, AND A YEAR PARAMETER DOES NOTHING.** On a rolled-forward team, asking any
 *     ordinary route for a past year answers with the LIVE season. This is the sharpest probe in the
 *     file: it is what "there is no archive" means at runtime, and nothing else would catch a route
 *     quietly re-learning `?year=`.
 *  6. **THE COMPARE LIST BELONGS TO EVERY CURRENT MEMBER** (the head-coach restriction was reverted
 *     with Design A), and Season's End is reachable from it per year.
 *  7. **THE PRACTICES SHELF IS NARROWER THAN THE PAGE IT SITS ON** (P3 C3, 2026-08-16), and it
 *     reaches a season the team has ROLLED PAST. Two probes, and the second is the one the whole
 *     phase exists for: everything above walks a team between seasons, where the finished season IS
 *     the working one and no year is needed. The gap C3 closes opens the day the next season does.
 *
 * Computed styles / real DOM / data-level assertions only — never screenshots.
 * Self-provisions via service-role with the `capmember-` marker; pre-cleans, tears down, and
 * ASSERTS the teardown. Error-checks EVERY provisioning insert.
 * ⚠ Scope text assertions to `main[class*="coachesMain"]` — the outer layout <main> wraps the
 * phone-hidden sidebar, so an unscoped query passes on a control the coach cannot see.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
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

const MARK = 'capmember';
const HEAD_EMAIL = `${MARK}-head@dev.local`;
const ASSIST_EMAIL = `${MARK}-assistant@dev.local`;
/** Removed from the team mid-test — property 1's subject. */
const REVOKED_EMAIL = `${MARK}-revoked@dev.local`;
/**
 * ⚠ A HELPER: the schedule and a practice plan, and NOTHING that makes a season's record theirs
 * (P3 C3's subject). They exist here because the practices shelf's gate is narrower than the page
 * it sits on, and only a real sign-in can prove the pair holds end to end.
 */
const HELPER_EMAIL = `${MARK}-helper@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
const PHONE_ODD = { width: 361, height: 740 };
const DESKTOP = { width: 1280, height: 900 };

let orgId = '';
let headUserId = '';
let assistUserId = '';
let revokedUserId = '';
let helperUserId = '';

/**
 * ⚠ TWO TEAMS, and the pair is the fixture's whole point.
 *
 *  · BETWEEN — one finished season and nothing after it. Its WORKING season is that finished one,
 *    which is the state properties 3, 4 and 6 are about. This is what the old file could not test:
 *    it only ever had a rolled-forward team, so "between seasons" was never rendered.
 *  · ROLLED — a live season with a finished one behind it. Property 5 lives here, because the leak
 *    it hunts (a route answering for a season the caller named) is only visible where the two
 *    seasons hold DIFFERENT data.
 */
let betweenTeamId = '';
let betweenYearId = '';
let betweenPlayerId = '';
let betweenFundraiserId = '';
let olderYearId = '';
/** A practice carrying a plan in the finished working season — the helper's refusal needs a real
 *  id, or a 403 could be a 404 wearing a different number. */
let betweenPracticeId = '';

let rolledTeamId = '';
let rolledLiveYearId = '';
let rolledPastYearId = '';

/** The revoked user's TEAM MEMBERSHIP (M1) — flipped to 'revoked' mid-test. */
let revokedMembershipId = '';
/** Their season RECORD row — asserted to SURVIVE the revocation. */
let revokedRecordRowId = '';
/** Real guardian data, so the PII probe distinguishes "redacted" from "was never there". */
const GUARDIAN_EMAIL = `${MARK}-guardian@dev.local`;

/**
 * ⚠ The rolled-forward team's PAST season budget, deliberately a different figure from its live
 * one — a route that ignored `?year=` would answer with the live season's total and look perfectly
 * healthy doing it. The two numbers ARE the assertion (P4).
 */
const PAST_SEASON_BUDGET = 4321;
const LIVE_SEASON_BUDGET = 8765;

const THIS_YEAR = new Date().getFullYear() + 1;
const LAST_YEAR = THIS_YEAR - 1;
const OLDER_YEAR = THIS_YEAR - 2;

async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const marked = (users?.users ?? []).filter(u =>
    u.email === HEAD_EMAIL || u.email === ASSIST_EMAIL || u.email === REVOKED_EMAIL
    || u.email === HELPER_EMAIL);

  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      await admin.from('rep_team_events').delete().eq('program_year_id', y.id);
      // ⚠ Entries, then fundraisers, then players — an entry references BOTH, so deleting the
      // roster first leaves a row pointing at a player who is gone and the year delete below
      // fails silently, which surfaces later as the afterAll "teams left behind" assertion
      // rather than as anything to do with fundraisers.
      const { data: frs } = await admin.from('rep_fundraisers').select('id').eq('program_year_id', y.id);
      for (const f of frs ?? []) await admin.from('rep_fundraiser_entries').delete().eq('fundraiser_id', f.id);
      await admin.from('rep_fundraisers').delete().eq('program_year_id', y.id);
      await admin.from('rep_roster_players').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_coaches').delete().eq('program_year_id', y.id);
      // ⚠ Budget lines too (P4). A season row cannot be deleted while one references it, so a
      // missed child here does not fail loudly — it surfaces later as the afterAll "teams left
      // behind" assertion, looking like something else entirely.
      await admin.from('rep_budget_lines').delete().eq('program_year_id', y.id);
    }
    // M1: memberships are team-scoped, not season-scoped — clear them before the team goes.
    await admin.from('rep_team_staff_memberships').delete().eq('team_id', t.id);
    await admin.from('rep_program_years').delete().eq('team_id', t.id);
    await admin.from('rep_teams').delete().eq('id', t.id);
  }
  for (const u of marked) {
    await admin.from('organization_members').delete().eq('user_id', u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
}

async function makeCoach(email: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) throw error;
  const id = created.user!.id;
  const { error: memErr } = await admin.from('organization_members').insert({
    organization_id: orgId, user_id: id, role: 'coach',
    status: 'active', accepted_at: new Date().toISOString(),
  });
  if (memErr) throw memErr;
  return id;
}

async function makeTeam(name: string, slug: string): Promise<string> {
  const { data, error } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name, slug, sport: 'softball' })
    .select('id').single();
  if (error) throw error;
  return data!.id;
}

async function makeYear(teamId: string, year: number, status: 'active' | 'completed'): Promise<string> {
  const { data, error } = await admin.from('rep_program_years')
    .insert({ team_id: teamId, org_id: orgId, name: `${MARK} ${year}`, year, status })
    .select('id').single();
  if (error) throw error;
  return data!.id;
}

async function makeRecordRow(
  yearId: string, teamId: string, userId: string,
  coachRole: 'head_coach' | 'assistant_coach', capabilities: object | null = null,
): Promise<string> {
  const { data, error } = await admin.from('rep_team_coaches')
    .insert({ program_year_id: yearId, team_id: teamId, org_id: orgId, user_id: userId, coach_role: coachRole, capabilities })
    .select('id').single();
  if (error) throw error;
  return data!.id;
}

async function makeMembership(
  teamId: string, userId: string,
  coachRole: 'head_coach' | 'assistant_coach', capabilities: object | null,
): Promise<string> {
  const { data, error } = await admin.from('rep_team_staff_memberships').insert({
    org_id: orgId, team_id: teamId, user_id: userId,
    coach_role: coachRole, capabilities, status: 'active',
  }).select('id').single();
  if (error) throw error;
  return data!.id;
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org, error: orgErr } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  if (orgErr) throw orgErr;
  orgId = org!.id;

  headUserId = await makeCoach(HEAD_EMAIL);
  assistUserId = await makeCoach(ASSIST_EMAIL);
  revokedUserId = await makeCoach(REVOKED_EMAIL);
  helperUserId = await makeCoach(HELPER_EMAIL);

  // ── The BETWEEN-SEASONS team: two finished seasons, no live one ──
  // Two, not one, so the compare list has a row that is NOT the season on screen — otherwise its
  // per-year Season Wrapped link would point at the page the coach is already on.
  betweenTeamId = await makeTeam(`${MARK} Between 12U`, `${MARK}-between-12u`);
  olderYearId = await makeYear(betweenTeamId, OLDER_YEAR, 'completed');
  betweenYearId = await makeYear(betweenTeamId, LAST_YEAR, 'completed');

  for (const yearId of [olderYearId, betweenYearId]) {
    await makeRecordRow(yearId, betweenTeamId, headUserId, 'head_coach');
    /**
     * ⚠ The assistant's RECORD rows say money 'off' and rosterPii false — deliberately the opposite
     * of their membership below. That is what makes property 2's probes adversarial: a surface still
     * reading the season row would refuse them, and the ruling says it must not.
     * ⚠ Every key is set explicitly — an assistant's grants fall back to ASSISTANT_DEFAULTS, so an
     * omitted key GRANTS it.
     */
    await makeRecordRow(yearId, betweenTeamId, assistUserId, 'assistant_coach', {
      money: 'off', roster: 'view', rosterPii: false, schedule: true, attendance: true, tryouts: false,
    });
  }
  revokedRecordRowId = await makeRecordRow(betweenYearId, betweenTeamId, revokedUserId, 'assistant_coach', {
    money: 'off', roster: 'view', rosterPii: false, schedule: true, attendance: true, tryouts: false,
  });

  /**
   * ── M1 memberships — THE access truth (mig 245). Without these, every probe below 403s. ──
   * The membership's grants are the member's CURRENT capabilities in EVERY season:
   *   · head — head coach, full access
   *   · assistant — money WRITE + rosterPii TRUE today (neither on their record rows above)
   *   · revoked-subject — ordinary assistant defaults, revoked mid-run
   */
  await makeMembership(betweenTeamId, headUserId, 'head_coach', null);
  await makeMembership(betweenTeamId, assistUserId, 'assistant_coach', {
    money: 'write', rosterPii: true, schedule: true, attendance: true, tryouts: false,
  });
  revokedMembershipId = await makeMembership(betweenTeamId, revokedUserId, 'assistant_coach', null);
  /**
   * ⚠ THE HELPER PRESET, spelled out rather than left to defaults — an assistant's omitted key
   * GRANTS the duty, and a single missing `false` here would flip `hasRecordAccess` true and turn
   * the refusal probes green for the wrong reason.
   */
  await makeMembership(betweenTeamId, helperUserId, 'assistant_coach', {
    schedule: true, scheduleManage: false, attendance: false, lineups: false, rosterPii: false,
    notes: false, money: 'off', documents: 'off', announcementsSend: false, tryouts: false,
    staffChat: false,
  });

  // A player in the finished working season, with real guardian data.
  const { data: player, error: playerErr } = await admin.from('rep_roster_players').insert({
    program_year_id: betweenYearId, team_id: betweenTeamId, org_id: orgId,
    player_first_name: `${MARK}Between`, player_last_name: 'Player',
    guardian_email: GUARDIAN_EMAIL,
    status: 'active', source: 'admin_manual',
  }).select('id').single();
  if (playerErr) throw playerErr;
  betweenPlayerId = player!.id;

  const { data: fr, error: frErr } = await admin.from('rep_fundraisers').insert({
    org_id: orgId, team_id: betweenTeamId, program_year_id: betweenYearId,
    name: `${MARK} Finished drive`, player_rebate_percent: 40, is_active: false,
  }).select('id').single();
  if (frErr) throw frErr;
  betweenFundraiserId = fr!.id;

  const { error: feErr } = await admin.from('rep_fundraiser_entries').insert({
    fundraiser_id: betweenFundraiserId, org_id: orgId, team_id: betweenTeamId, player_id: betweenPlayerId,
    amount_raised: 250, rebate_percent: 40, rebate_amount: 100,
  });
  if (feErr) throw feErr;

  /**
   * ── The practices the P3 C3 shelf reads ──────────────────────────────────────────────────
   * A minimal but REAL plan: one block, because "has a plan" means at least one block everywhere
   * in this feature (a goal typed and abandoned is not a plan), and the read route hands the whole
   * jsonb back.
   */
  const onePlan = {
    id: `${MARK}-plan`,
    blocks: [{ id: `${MARK}-b1`, title: 'Cut-offs', duration: { minutes: 20 }, stations: [] }],
  };
  const { data: betweenPractice, error: bpErr } = await admin.from('rep_team_events').insert({
    program_year_id: betweenYearId, team_id: betweenTeamId, org_id: orgId,
    event_type: 'practice', name: `${MARK} Between practice`,
    starts_at: new Date(Date.UTC(LAST_YEAR, 5, 11, 22, 0)).toISOString(),
    status: 'scheduled', practice_plan: onePlan, practice_recap: 'Went long on cut-offs.',
  }).select('id').single();
  if (bpErr) throw bpErr;
  betweenPracticeId = betweenPractice!.id;

  // ── The ROLLED-FORWARD team: live season + a finished one behind it ──
  rolledTeamId = await makeTeam(`${MARK} Rolled 12U`, `${MARK}-rolled-12u`);
  rolledLiveYearId = await makeYear(rolledTeamId, THIS_YEAR, 'active');
  rolledPastYearId = await makeYear(rolledTeamId, LAST_YEAR, 'completed');
  for (const yearId of [rolledLiveYearId, rolledPastYearId]) {
    await makeRecordRow(yearId, rolledTeamId, headUserId, 'head_coach');
  }
  await makeMembership(rolledTeamId, headUserId, 'head_coach', null);

  /**
   * ⚠ THE TRAP FOR PROPERTY 5: one player per season, with different names. A route that has
   * quietly re-learned `?year=` renders perfectly and lacks no control — only the NAMES give it
   * away, which is exactly how the archive's one-level-down defects used to hide.
   */
  for (const [yearId, first] of [[rolledLiveYearId, `${MARK}Live`], [rolledPastYearId, `${MARK}Past`]] as const) {
    const { error } = await admin.from('rep_roster_players').insert({
      program_year_id: yearId, team_id: rolledTeamId, org_id: orgId,
      player_first_name: first, player_last_name: 'Player',
      status: 'active', source: 'admin_manual',
    });
    if (error) throw error;
  }

  /**
   * ⚠ **THE TRAP FOR THE P3 C3 PROBE**, and it is a PAIR. The past season gets a practice that
   * happened and one that was CALLED OFF, both carrying a full plan — cancelling only flips
   * `status`, it never clears the plan. A shelf that forgot the exclusion renders perfectly and
   * shows a coach a night that never took place, complete with who was assigned where.
   */
  const { error: rolledPracticeErr } = await admin.from('rep_team_events').insert([
    {
      program_year_id: rolledPastYearId, team_id: rolledTeamId, org_id: orgId,
      event_type: 'practice', name: `${MARK} Past practice`,
      starts_at: new Date(Date.UTC(LAST_YEAR, 5, 11, 22, 0)).toISOString(),
      status: 'scheduled', practice_plan: onePlan,
    },
    {
      program_year_id: rolledPastYearId, team_id: rolledTeamId, org_id: orgId,
      event_type: 'practice', name: `${MARK} Cancelled practice`,
      starts_at: new Date(Date.UTC(LAST_YEAR, 5, 18, 22, 0)).toISOString(),
      status: 'cancelled', practice_plan: onePlan,
    },
  ]);
  if (rolledPracticeErr) throw rolledPracticeErr;

  /**
   * ⚠ Budget lines on BOTH of the rolled-forward team's seasons, with different totals — the trap
   * for P4's probe. The closed money book is only proved by a figure that could not have come from
   * the live season.
   */
  const { error: budgetErr } = await admin.from('rep_budget_lines').insert([
    {
      org_id: orgId, team_id: rolledTeamId, program_year_id: rolledPastYearId,
      description: `${MARK} last season's diamonds`, total_amount: PAST_SEASON_BUDGET,
      sort_order: 0, line_kind: 'cost',
    },
    {
      org_id: orgId, team_id: rolledTeamId, program_year_id: rolledLiveYearId,
      description: `${MARK} this season's diamonds`, total_amount: LIVE_SEASON_BUDGET,
      sort_order: 0, line_kind: 'cost',
    },
  ]);
  if (budgetErr) throw budgetErr;
});

test.afterAll(async () => {
  await cleanup();
  const { data: leftTeams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  expect(leftTeams ?? []).toHaveLength(0);
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}

const between = () => `/${ORG_SLUG}/coaches/teams/${betweenTeamId}`;
const betweenApi = () => `/api/coaches/${ORG_SLUG}/teams/${betweenTeamId}`;
const rolled = () => `/${ORG_SLUG}/coaches/teams/${rolledTeamId}`;
const rolledApi = () => `/api/coaches/${ORG_SLUG}/teams/${rolledTeamId}`;
const main = (page: Page) => page.locator('main[class*="coachesMain"]');

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(main(page)).toBeVisible({ timeout: 45_000 });
  /* ⚠⚠ MATCH THE LOADING ELEMENT, NEVER ITS WORDS (/review, 2026-08-26). This waited on the
     literal text "Loading…" reaching zero, and Playwright matches a plain string as a SUBSTRING —
     so the moment the portal gave every loading state a subject ("Loading the register…",
     "Loading the roster…"), the substring stopped existing and this wait passed instantly on every
     screen. A no-op wait is worse than no wait: it reads as a deterministic signal while the fetch
     it was built to wait for races on underneath it. `[class*="loadingState"]` is the same
     hashed-CSS-module idiom `main[class*="coachesMain"]` already uses one line up, and it matches
     the shared CoachLoading component AND every hand-written .loadingState still in the portal —
     i.e. it cannot be broken by a copy change. */
  await expect(main(page).locator('[class*="loadingState"]')).toHaveCount(0, { timeout: 45_000 });
}

/** Call an API as the signed-in browser session and return { status, body }. */
async function apiGet(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const res = await fetch(u);
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON error page */ }
    return { status: res.status, body };
  }, url);
}

// ── 1. Membership is the access truth ────────────────────────────────────────

test.describe('removing a coach removes them — everywhere, at once', () => {
  test.use({ viewport: DESKTOP });

  /**
   * ⚠ ORDER MATTERS INSIDE THIS TEST, so it is one test rather than three: it reads BEFORE the
   * revocation (proving the refusal afterwards is caused by the revocation and not by a fixture
   * that never worked), then revokes, then re-reads, then restores. Split across tests, Playwright's
   * parallelism could run them in any order against shared state.
   */
  test('reads before revocation; refused everywhere after; the record survives; re-adding restores', async ({ page }) => {
    await signIn(page, REVOKED_EMAIL);

    const before = await apiGet(page, `${betweenApi()}/roster`);
    expect(before.status, 'a member of the staff reads their team').toBe(200);

    const { error: revErr } = await admin.from('rep_team_staff_memberships')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', revokedMembershipId);
    if (revErr) throw revErr;

    /**
     * ⚠ EVERY PROBE, not one. Membership is checked in one shared resolver, and the value of
     * checking it in one place is only real if every surface goes through it.
     */
    for (const probe of ['roster', 'events', 'attendance', 'money-summary', 'history', 'wrapped']) {
      const res = await apiGet(page, `${betweenApi()}/${probe}`);
      expect([401, 403, 404], `${probe} still answers a removed coach`).toContain(res.status);
    }

    /**
     * ⚠ THE RECORD IS NOT THE ACCESS. Who coached that season is a FACT, and revocation must not
     * rewrite history — it only closes the door. The row's survival is what lets the season keep
     * naming its staff after somebody leaves.
     */
    const { data: row } = await admin.from('rep_team_coaches').select('id').eq('id', revokedRecordRowId).maybeSingle();
    expect(row?.id, 'the season’s staff RECORD row must survive a revocation').toBe(revokedRecordRowId);

    const { error: restoreErr } = await admin.from('rep_team_staff_memberships')
      .update({ status: 'active', revoked_at: null }).eq('id', revokedMembershipId);
    if (restoreErr) throw restoreErr;

    const after = await apiGet(page, `${betweenApi()}/roster`);
    expect(after.status, 're-adding a coach restores their access').toBe(200);
  });
});

// ── 2. Current capabilities, everywhere (replaces Chunk F's governing rule 1) ─

test.describe('capabilities are the member’s CURRENT ones, in every season', () => {
  test.use({ viewport: DESKTOP });

  /**
   * ⚠⚠ THIS PROBE'S EXPECTATION FLIPPED ON 2026-08-16, DELIBERATELY. It used to assert 403 —
   * "capabilities must come from the season's own assignment row" (governing rule 1). The owner
   * replaced that rule: access belongs to CURRENT staff, and their current grant is the honest one
   * everywhere, which WIDENS what a newly-trusted assistant can read (recorded, with the reasoning,
   * in COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md §1). The 200 below is that ruling, asserted so it
   * stays a decision — if it ever turns 403 again, someone has quietly un-decided it.
   */
  test('an assistant with money NOW reads the finished season’s money — the recorded widening', async ({ page }) => {
    await signIn(page, ASSIST_EMAIL);
    const res = await apiGet(page, `${betweenApi()}/money-summary`);
    expect(res.status,
      'capabilities are the member’s CURRENT ones in every season (owner ruling 2026-08-16); this '
      + 'assistant’s RECORD row for that season says money:off, and it no longer governs anything')
      .toBe(200);
  });

  /**
   * ⚠ FLIPPED WITH THE RULING, same date, same reasoning: rosterPii was FALSE on the record rows
   * and is TRUE on the membership today, so the guardian email is visible. The fixture player
   * carries a real guardian email precisely so this cannot pass by the field never having existed.
   */
  test('guardian details follow the CURRENT rosterPii grant', async ({ page }) => {
    await signIn(page, ASSIST_EMAIL);
    const res = await apiGet(page, `${betweenApi()}/roster`);
    expect(res.status).toBe(200);
    const body = res.body as { players?: Record<string, unknown>[]; isReadOnly?: boolean };
    expect(body.isReadOnly, 'the API must declare a finished working season a record').toBe(true);
    const player = body.players?.find(p => p.playerFirstName === `${MARK}Between`);
    expect(player, 'fixture player must be present or this assertion is vacuous').toBeTruthy();
    expect(player?.guardianEmail,
      'current rosterPii governs every season (owner ruling 2026-08-16)').toBe(GUARDIAN_EMAIL);
  });
});

// ── 3. Between seasons is an ordinary state, not a lock-out ──────────────────

test.describe('a team between seasons keeps its whole portal', () => {
  test.use({ viewport: DESKTOP });

  /**
   * ⚠⚠ THE PROPERTY P2 EXISTS FOR. Until 2026-08-16 a finished season swapped the coach onto a
   * SECOND, shorter, differently-ordered menu — nine doors instead of fifteen, with Settings, Chat
   * and Email families simply gone. There is one nav now. What changes is the landing slot.
   */
  test('the nav is the coach’s own, with Season’s End in the landing slot', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/roster`);

    const nav = page.locator('nav');
    await expect(nav.getByRole('link', { name: "Season's End" }),
      'a finished working season must land on Season’s End').toBeVisible({ timeout: 30_000 });
    await expect(nav.getByRole('link', { name: 'Overview', exact: true }),
      'Overview describes a live season and gives way to Season’s End').toHaveCount(0);

    /**
     * ⚠ These four are the ones the deleted archive menu dropped. They are back — not because
     * anything about them changed, but because a team between seasons is a TEAM: its staff is
     * current, its settings are its own, and its families are still reachable. The live
     * INSTRUMENTS behind them say for themselves that they come back next season
     * (components/coaches/CoachNotOnTeam.tsx).
     */
    for (const label of ['Settings', 'Chat', 'Email families', 'Staff']) {
      await expect(nav.getByRole('link', { name: label }),
        `${label} vanished between seasons — that is the second-menu behaviour P2 deleted`)
        .toBeVisible({ timeout: 30_000 });
    }
  });

  /** The two shipped limbo dead-ends P1 closed, re-asserted at the API where they were closed. */
  test('Settings answers between seasons instead of "unavailable"', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const res = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${betweenTeamId}`);
    expect(res.status,
      'the team route must fall back to the newest finished season for READS — requiring a live '
      + 'year is what put "Settings unavailable" in front of a coach whose season had just ended')
      .toBe(200);
  });

  test('no season switcher exists anywhere', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/roster`);
    await expect(page.locator('#coach-season-select'),
      'the sidebar season switcher was deleted on 2026-08-16 (Design A)').toHaveCount(0);
    await expect(main(page).getByRole('button', { name: /Choose a different season/i }),
      'the page-title season chip was the switcher wearing a label; it went with it').toHaveCount(0);
  });
});

// ── 4. A finished season is a record — all the way down ──────────────────────

test.describe('no write control survives on a finished working season', () => {
  test.use({ viewport: DESKTOP });

  /**
   * `/review` once found the archive correct at the hub level and leaky one level below — money
   * sub-pages, player detail and lineup detail all silently resolved a different season, with full
   * write UI. The pages are the same; only the way they are addressed changed.
   */
  const DEEP_PAGES = [
    { path: '/accounting', label: 'Money hub' },
    // The Money screen that became two tabs (2026-08-16) and then one Ledger with views
    // (2026-08-28 fold) — every view needs the probe, because a season leak one level down is
    // exactly what this sweep exists to catch.
    { path: '/accounting?section=ledger&view=timeline', label: 'Ledger — Timeline' },
    { path: '/accounting?section=ledger&view=bills', label: 'Ledger — By bill' },
    { path: '/accounting?section=dues', label: 'Dues' },
    { path: '/accounting?section=budget', label: 'Budget' },
    { path: '/accounting?section=fundraisers', label: 'Fundraisers' },
    { path: '/development', label: 'Skills & Goals' },
    { path: '/lineups', label: 'Lineups' },
    { path: '/tryouts/history', label: 'Tryout history' },
    { path: '/history', label: 'Insights hub' },
    { path: '/history?section=results', label: 'Insights results tab' },
    { path: '/history?section=awards', label: 'Awards tab' },
    { path: '/roster', label: 'Roster' },
  ];

  for (const { path, label } of DEEP_PAGES) {
    test(`${label} is a record, not an editor`, async ({ page }) => {
      await signIn(page, HEAD_EMAIL);
      await open(page, `${between()}${path}`);

      // It must KNOW the season has finished — otherwise it resolved something else and the
      // absence of write controls below would prove nothing.
      await expect(main(page).getByText(/Complete/).first(),
        `${label} must show the finished-season marker in the masthead`)
        .toBeVisible({ timeout: 30_000 });

      /**
       * ⚠⚠ **THE MATCHER IS THE ASSERTION.** `/^Add /i` — with a trailing space — was blind to the
       * Money hub's consolidated button, whose accessible name is exactly "Add": the regex demands
       * another word after it, so it matched "Add Credit" and "Add Line" while missing the one
       * control most likely to be left ungated. A `toHaveCount(0)` that cannot see the thing it is
       * looking for is green through a real regression, which is the failure this whole file exists
       * to prevent. `\b` after the verb matches both the bare word and the two-word forms.
       */
      for (const name of [/^(Add|New|Create|Log|Record|Edit|Delete|Remove)\b/i, /^Give an award/i]) {
        await expect(main(page).getByRole('button', { name }),
          `${label} offers a write control on a finished season`).toHaveCount(0);
        await expect(main(page).getByRole('link', { name }),
          `${label} offers a write link on a finished season`).toHaveCount(0);
      }
    });
  }

  /**
   * ⚠⚠ REWRITTEN 2026-08-31, and the discovery matters more than the rewrite. The original opened
   * the finished drive and asserted THAT season's roster on its leaderboard — but since the
   * season-close ruling (2026-08-18, "a closed season is ONE PAGE") the server-side gate sends a
   * no-live-season team's `?section=fundraisers` to the Season's End page before any Money screen
   * mounts, so the old assertion had been timing out against a page with no fundraisers on it at
   * all. It only surfaced when the drive band rework ran this file: ⚠ every OTHER test in this
   * describe block "passes" on the SAME redirect — the Season's End masthead shows "Complete" and
   * offers no Add/Edit buttons, so the record-not-editor assertions go green without ever seeing
   * the screen they name. Green over a redirect is the empty-fixture trap wearing a new face.
   *
   * Today's honest assertion is the GATE ITSELF. The content assertion (that season's entries,
   * read-only) comes back when the closed-season page grows its money shelf (season-close plan
   * P4 — owner mockup session required first).
   */
  test('a finished season’s fundraisers URL lands on Season’s End, not a live Money screen', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/accounting?section=fundraisers`);

    await expect(main(page).getByText(/That's a wrap/i),
      'a no-live-season team’s money URL must land on the one closed-season page')
      .toBeVisible({ timeout: 30_000 });
    await expect(main(page).getByRole('button', { name: new RegExp(`${MARK} Finished drive`) }),
      'no live fundraising surface may render for a finished season').toHaveCount(0);
  });

  /**
   * ⚠⚠ A HIDDEN TILE IS THE ONLY HONEST ANSWER FOR A REPORT THAT CANNOT SERVE A FINISHED SEASON,
   * and this probe exists because the failure mode is a SILENT one: both routes below serve the
   * live season only, so asking them from a finished one returns numbers about nothing — a page
   * that renders perfectly, describing a season that is not the one on screen.
   *
   *   · Playing time — ruled live-season-only PERMANENTLY (owner, 2026-08-16): its figures are
   *     recomputed from saved lineups, so a finished season would show as today's code reads it.
   *   · Opponents — the scouting book is an INSTRUMENT (owner, 2026-08-04, re-confirmed): the notes
   *     are the team's CURRENT book, not a snapshot of that year.
   */
  test('the Insights hub hides the two reports a finished season cannot honestly serve', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/history`);
    await expect(main(page).getByText(/Complete/).first(),
      'the hub must have resolved the finished season, or this proves nothing')
      .toBeVisible({ timeout: 30_000 });

    for (const { name, why } of [
      { name: /Where is playing time going/, why: 'playing-time figures are recomputed — live-season-only by ruling' },
      { name: /Who are we up against/, why: 'the scouting book is a live-season instrument (owner ruling 2026-08-04)' },
    ]) {
      await expect(main(page).getByRole('link', { name }), why).toHaveCount(0);
    }

    // …and both ARE offered on a live season, so the assertions above cannot pass for the wrong
    // reason (a tile hidden by a missing capability rather than by the season).
    await open(page, `${rolled()}/history`);
    await expect(main(page).getByRole('link', { name: /Where is playing time going/ }),
      'the playing-time tile must exist on a live season, or the assertion above is vacuous')
      .toHaveCount(1);
  });

  /**
   * ⚠ Attendance is the counter-case, and it belongs beside the two above: it is a RECORD of who
   * turned up, so its tile must STAY. Hiding it would take a finished season's report away with
   * nothing to replace it — the report is in neither nav, so this tile is its only door.
   */
  test('the attendance door survives, because attendance is a record', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/history`);
    const door = main(page).getByRole('link', { name: /Who's showing up/ });
    await expect(door, 'the attendance report lost its only door').toBeVisible({ timeout: 30_000 });
    await door.click();
    await expect(main(page).getByRole('link', { name: /Take attendance/ }),
      'a finished season must not offer to TAKE attendance — the report is a record, the marking '
      + 'is an instrument').toHaveCount(0);
  });

  test('a player opened from the roster is a record, not a dead end', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/roster`);
    await main(page).getByRole('link', { name: new RegExp(`${MARK}Between`) }).click();
    await expect(main(page).getByText(/Complete/).first(),
      'the player page must open in the finished season, not 404 on "no active program year"')
      .toBeVisible({ timeout: 30_000 });
  });
});

// ── 5. The dial is gone: a year parameter does nothing ───────────────────────

test.describe('there is no archive — a year parameter cannot reach one', () => {
  test.use({ viewport: DESKTOP });

  /**
   * ⚠⚠ **THE SHARPEST PROBE IN THIS FILE.** Every ordinary coach route resolves the team's WORKING
   * season, and nothing a caller sends can change that. On the rolled-forward team the two seasons
   * hold DIFFERENT players, so a route that has quietly re-learned `?year=` answers with the wrong
   * name — which is the only symptom it would ever show. A source-level guard
   * (`tests/unit/coach-history-endpoint-guard.test.ts`) pins the same rule statically; this is its
   * runtime half, and it also covers the case the scan cannot see: a parameter read through a
   * helper the regex does not recognise.
   */
  test('asking an ordinary route for a past year answers with the LIVE season', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const res = await apiGet(page, `${rolledApi()}/roster?year=${rolledPastYearId}`);
    expect(res.status).toBe(200);
    const body = res.body as { players?: { playerFirstName: string }[]; isReadOnly?: boolean };
    expect(body.isReadOnly, 'a rolled-forward team’s working season is its LIVE one').toBe(false);
    expect(body.players?.some(p => p.playerFirstName === `${MARK}Live`),
      'the live season’s roster must be what comes back').toBe(true);
    expect(body.players?.some(p => p.playerFirstName === `${MARK}Past`),
      'a past season’s roster came back for a `?year=` — a route has re-learned the season dial')
      .toBe(false);
  });

  test('and the page does the same, so a stale bookmark lands somewhere honest', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${rolled()}/roster?year=${rolledPastYearId}`);
    await expect(main(page).getByText(`${MARK}Live Player`),
      'a bookmark from the archive era must land on the live season, not a past one')
      .toBeVisible({ timeout: 30_000 });
    await expect(main(page).getByText(`${MARK}Past Player`)).toHaveCount(0);
  });
});

// ── 6. The look-back layer ───────────────────────────────────────────────────

test.describe('the look-back layer — Season’s End, Wrapped, the compare list', () => {
  test.use({ viewport: DESKTOP });

  /**
   * ⚠⚠ REVERTED WITH DESIGN A (owner, 2026-08-16). The head-coach-only restriction shipped hours
   * earlier the same day, as a floor, while access was still per-season and an ex-coach could read
   * the whole book. M1 removed that premise. Both halves matter: asserting only that the assistant
   * gets rows would pass just as happily if the route were broken for everyone.
   */
  test('every current member sees the team’s season-by-season history', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const asHead = await apiGet(page, `${betweenApi()}/history`);
    expect(asHead.status).toBe(200);
    expect(((asHead.body as { history?: unknown[] }).history ?? []).length,
      'the head coach must get rows, or the assistant assertion below proves nothing')
      .toBeGreaterThan(0);

    await signIn(page, ASSIST_EMAIL);
    const asAssistant = await apiGet(page, `${betweenApi()}/history`);
    expect(asAssistant.status).toBe(200);
    const body = asAssistant.body as { history?: unknown[]; canViewSeasonHistory?: boolean };
    expect(body.canViewSeasonHistory, 'the restriction was reverted — every member sees it').toBe(true);
    expect((body.history ?? []).length,
      'an assistant on the team today sees the seasons the team has played').toBeGreaterThan(0);
  });

  /**
   * ⚠ The compare list is one of only THREE ways a coach reaches a finished season now, and its
   * per-year link is the only link in the product that names a season other than the working one.
   * That link is why `?year=` still exists at all.
   */
  test('the compare list opens an older season’s Wrapped', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/history?section=results`);

    const olderLink = main(page).locator(`a[href*="/season-end?year=${olderYearId}"]`).first();
    await expect(olderLink, 'each past season must offer its own Season Wrapped').toBeVisible({ timeout: 30_000 });
    await olderLink.click();
    await expect(page).toHaveURL(new RegExp(`season-end\\?year=${olderYearId}`));
    await expect(main(page).getByRole('heading', { name: "Season's End" })).toBeVisible({ timeout: 30_000 });
  });

  /**
   * ⚠⚠ **THE PRACTICES SHELF, AND THE GATE THAT IS NARROWER THAN THE PAGE IT SITS ON** (P3 C3).
   *
   * Season's End gates on `hasRecordAccess`. The read route behind every row of the new section has
   * always ALSO required `canViewSchedule`, so a parent volunteer who turns up to run one station
   * cannot type the URL — and its own header records that the gate and the entry point must move
   * together. This walks the pair at runtime, which is the half no source scan can prove: the
   * assistant (record access) gets the section AND the plan behind it; the helper is refused both.
   *
   * ⚠ The assistant's presence is asserted FIRST. A "the helper is refused" test that would pass
   * just as happily against a section broken for everyone proves nothing.
   */
  test('the practices shelf opens for a coach and is refused to a helper', async ({ page }) => {
    await signIn(page, ASSIST_EMAIL);
    const asAssistant = await apiGet(page, `${betweenApi()}/season-practices`);
    expect(asAssistant.status,
      'an assistant with record access reads the finished season’s practices — assert this before '
      + 'the refusal below, or that refusal could pass against a broken route').toBe(200);
    const body = asAssistant.body as { practices?: unknown[]; season?: { isReadOnly?: boolean } };
    expect(body.season?.isReadOnly, 'the route must declare a finished season a record').toBe(true);
    expect(Array.isArray(body.practices), 'the payload must carry a practices array').toBe(true);

    await signIn(page, HELPER_EMAIL);
    const list = await apiGet(page, `${betweenApi()}/season-practices`);
    expect(list.status,
      'a helper with schedule access but NO record access must not read the season’s practices — '
      + 'the shelf carries the plan door’s pair, not Season’s End’s looser gate').toBe(403);

    // …and the plan behind a row, which is the door the pair was invented to keep shut.
    const plan = await apiGet(page,
      `${betweenApi()}/events/${betweenPracticeId}/practice-plan/read`);
    expect(plan.status, 'a helper must not read a past practice plan by typing its URL').toBe(403);
  });

  /**
   * ⚠⚠ **THE CASE THE WHOLE PHASE EXISTS FOR.** Everything else here walks a team between seasons,
   * where the finished season IS the working one and nothing needed a year. The gap C3 closes is
   * narrower: the day the NEXT season opens, last year's practices stop being reachable, because
   * the list that led to them resolves the working season. So this asks the rolled-forward team's
   * Season's End for its PAST year and expects that year's practice — a route that ignored the
   * parameter would answer with the live season's, render perfectly, and be wrong.
   */
  test('a rolled-forward team still reads the season it has left behind', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const res = await apiGet(page, `${rolledApi()}/season-practices?year=${rolledPastYearId}`);
    expect(res.status).toBe(200);
    const body = res.body as {
      season?: { programYearId?: string; isReadOnly?: boolean };
      practices?: { eventId: string; name: string }[];
    };
    expect(body.season?.programYearId,
      'the answer must be about the season that was ASKED for, not the team’s live one')
      .toBe(rolledPastYearId);
    expect(body.season?.isReadOnly, 'the season asked for has finished').toBe(true);
    expect(body.practices?.some(p => p.name === `${MARK} Past practice`),
      'last season’s practice must come back — this is the reachability the phase exists to '
      + 'restore').toBe(true);
    expect(body.practices?.some(p => p.name === `${MARK} Cancelled practice`),
      'a CANCELLED practice did not happen and must never appear in the record').toBe(false);
  });

  /**
   * ⚠⚠ **THE CLOSED MONEY BOOK'S GATE IS THE NARROW ONE** (P4, 2026-08-17). Season's End now
   * carries TWO shelves keyed on two different questions: the practices shelf on
   * `canReadPastPracticePlans`, the statement on `canViewMoney`. The assistant in this fixture holds
   * money WRITE today (their record row says money:off — the recorded widening, property 2), so they
   * read both. The HELPER holds neither and reads nothing.
   *
   * ⚠ The head coach's 200 is asserted first: a refusal test that would pass just as happily against
   * a route broken for everyone proves nothing.
   */
  test('the statement opens for money-trusted staff and is refused without money access', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const asHead = await apiGet(page, `${betweenApi()}/budget-vs-actual`);
    expect(asHead.status, 'a head coach reads the finished season’s statement').toBe(200);
    expect((asHead.body as { report?: unknown }).report,
      'the payload must carry the report the shelf renders').toBeTruthy();

    await signIn(page, HELPER_EMAIL);
    const asHelper = await apiGet(page, `${betweenApi()}/budget-vs-actual`);
    expect(asHelper.status,
      'a helper has no money access and must not read the team’s books').toBe(403);
  });

  /**
   * ⚠⚠ **THE CASE THE PHASE EXISTS FOR**, and the money half of it. Everything else here walks a
   * team between seasons, where the finished season IS the working one and no year is needed. The
   * gap P4 closes opens the day the next season does — so this asks the ROLLED-FORWARD team for the
   * season it has left behind and checks the answer is about THAT year.
   */
  test('a rolled-forward team can still read the money of the season it has left behind', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const past = await apiGet(page, `${rolledApi()}/budget-vs-actual?year=${rolledPastYearId}`);
    expect(past.status).toBe(200);
    const pastBody = past.body as { totalBudget?: number };

    // …and the live season answers differently, or the assertion above proves only that a route
    // returns 200 for any year it is handed.
    const live = await apiGet(page, `${rolledApi()}/budget-vs-actual`);
    expect(live.status).toBe(200);
    const liveBody = live.body as { totalBudget?: number };
    expect(pastBody.totalBudget,
      'the past season carries the budget seeded against it — a route ignoring `?year=` would '
      + 'answer with the live season’s instead').toBe(PAST_SEASON_BUDGET);
    expect(liveBody.totalBudget,
      'and the live season keeps its own, so the two are genuinely distinguishable').not.toBe(PAST_SEASON_BUDGET);
  });

  test('Season’s End keeps its door back to the compare list', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/season-end`);
    await expect(main(page).getByRole('link', { name: /Compare every season/ }),
      'Season’s End links to the list, and the list links back per season — the loop IS the '
      + 'look-back layer now').toBeVisible({ timeout: 30_000 });
  });
});

// ── 7. Every door carries help (the Chunk B rule) ────────────────────────────

test.describe('every door a between-seasons team opens carries help', () => {
  test.use({ viewport: DESKTOP });

  test('walks the RENDERED nav, so a future door without help fails here', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/season-end`);

    const hrefs = await page.locator('nav a[href*="/coaches/teams/"]').evaluateAll(
      els => Array.from(new Set(els.map(e => (e as HTMLAnchorElement).getAttribute('href') ?? ''))),
    );
    const doors = hrefs.filter(h => h.includes(betweenTeamId));
    expect(doors.length, 'the nav should render several doors').toBeGreaterThan(4);

    for (const href of doors) {
      await open(page, href);
      // Scoped to the content area so the sidebar's own "Help" link can never satisfy this.
      const help = main(page).getByRole('button', { name: /^Help/i }).first();
      await expect(help, `${href} is a nav door and must carry a help icon`)
        .toBeVisible({ timeout: 30_000 });
    }
  });
});

// ── 8. Composed layout at 361px ──────────────────────────────────────────────

test.describe('a between-seasons team on a phone', () => {
  test.use({ viewport: PHONE_ODD });

  test('the bar leads with Season’s End, and nothing scrolls sideways', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    await open(page, `${between()}/roster`);

    await expect(page.getByRole('link', { name: "Season's End" }).first(),
      'the phone bar’s landing tab swaps with the season’s state, exactly as the sidebar’s does')
      .toBeVisible({ timeout: 30_000 });

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page body must never scroll sideways').toBeLessThanOrEqual(0);

    // The More sheet held the phone's season list. It must not have grown one back.
    await page.locator('#coaches-mob-more').click();
    await expect(page.getByText(/This team’s seasons/i),
      'the phone season list was deleted with the dial (Design A)').toHaveCount(0);
  });
});
