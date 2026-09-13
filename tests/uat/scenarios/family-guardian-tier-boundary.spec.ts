import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { grantMembershipsFromSeasonRows, clearMemberships } from './_coach-membership-fixture';

/**
 * The GUARDIAN tier boundary (Coach Portal Chunk D, Slice 2) — built, shipped switched OFF.
 *
 * Two jobs, and the first one is the reason this file exists at all:
 *
 *  1. THE SWITCH ACTUALLY HOLDS. `GUARDIAN_TIER_ENABLED` defaults off, and while it is off
 *     NOTHING guardian-shaped may be created — not by the UI, not by a direct API call. A
 *     feature "shipped disabled" whose disable can be stepped around is not disabled, and this
 *     one is gating a consent flow that has not been through counsel yet.
 *  2. THE BOUNDARY. A signed-in account with NO guardian link must fail closed on every family
 *     payload, and the database must refuse the two shapes that can no longer exist: a
 *     team-level "follower" row, and a guardian row with no child.
 *
 * ⚠ REWRITTEN 2026-09-12: the team family LINK and the FOLLOWER tier were removed (owner, mig
 * 290). This file's second job used to be "an approved FOLLOWER reaches no child data" — the
 * standing invariant of a two-tier model that no longer exists — and its switch probes went
 * through the join page. The persona is now simply "signed in, not connected", the join probes
 * are gone with the route, and the database assertions are inverted to match mig 290's strict
 * CHECKs.
 *
 * The boundary assertions are written to pass whether the switch is on or off, so this file
 * keeps working as the standing guard the day the tier is turned on. The switch assertions
 * FAIL (never skip) when it is on, and say so.
 *
 * Data-level and HTTP-status assertions only. Self-provisions via service-role with the
 * `capguard-` marker; pre-cleans, tears down, and ASSERTS the teardown.
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

/** The server's own view of the switch — the tests read the SAME source the app does. */
const GUARDIAN_TIER_ENABLED = process.env.GUARDIAN_TIER_ENABLED === 'true';

const MARK = 'capguard';
const COACH_EMAIL = `${MARK}-coach@dev.local`;
const OUTSIDER_EMAIL = `${MARK}-outsider@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
const GUESSED_TOKEN = 'ZZZZthisTokenWasNeverMintedBBBBBBBBBBBBBBBB';

let orgId = '';
let coachUserId = '';
let outsiderUserId = '';
let teamId = '';
let yearId = '';
let playerId = '';

const YEAR = new Date().getFullYear() + 1;

async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const marked = (users?.users ?? []).filter(u => (u.email ?? '').startsWith(`${MARK}-`));

  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    await admin.from('family_links').delete().eq('rep_team_id', t.id);
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      await admin.from('rep_team_announcements').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_events').delete().eq('program_year_id', y.id);
      await admin.from('rep_roster_players').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_coaches').delete().eq('program_year_id', y.id);
    }
    await admin.from('rep_program_years').delete().eq('team_id', t.id);
    // M1: memberships are team-scoped — clear them before the team row goes, or the
    // FK leaves the team undeletable and it surfaces as the teardown assertion.
    await clearMemberships(admin, t.id);
    await admin.from('rep_teams').delete().eq('id', t.id);
  }
  for (const u of marked) {
    await admin.from('fan_follows').delete().eq('user_id', u.id);
    await admin.from('family_links').delete().eq('user_id', u.id);
    await admin.from('family_consents').delete().eq('guardian_email', u.email ?? '');
    await admin.from('organization_members').delete().eq('user_id', u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
}

async function makeAccount(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  return data.user!.id;
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org, error: orgErr } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  if (orgErr) throw orgErr;
  orgId = org!.id;

  coachUserId = await makeAccount(COACH_EMAIL);
  const { error: memErr } = await admin.from('organization_members').insert({
    organization_id: orgId, user_id: coachUserId, role: 'coach',
    status: 'active', accepted_at: new Date().toISOString(),
  });
  if (memErr) throw memErr;
  outsiderUserId = await makeAccount(OUTSIDER_EMAIL);

  const { data: team, error: teamErr } = await admin.from('rep_teams').insert({
    org_id: orgId, name: `${MARK} Guardians`, slug: `${MARK}-guardians`, sport: 'softball',
    schedule_visibility: 'families',
  }).select('id').single();
  if (teamErr) throw teamErr;
  teamId = team!.id;

  const { data: year, error: yearErr } = await admin.from('rep_program_years').insert({
    team_id: teamId, org_id: orgId, name: `${MARK} ${YEAR}`, year: YEAR, status: 'active',
  }).select('id').single();
  if (yearErr) throw yearErr;
  yearId = year!.id;

  const { error: coachErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: yearId, team_id: teamId, org_id: orgId,
    user_id: coachUserId, coach_role: 'head_coach',
  });
  if (coachErr) throw coachErr;

  // The child whose data must never reach an unconnected account.
  const { data: player, error: playerErr } = await admin.from('rep_roster_players').insert({
    program_year_id: yearId, team_id: teamId, org_id: orgId,
    player_first_name: `${MARK}Child`, player_last_name: 'Surname',
    player_number: '7', guardian_email: `${MARK}-parent@dev.local`,
    medical_notes: `${MARK}MedicalSecret`, admin_notes: `${MARK}AdminSecret`,
    status: 'active', source: 'admin_manual',
  }).select('id').single();
  if (playerErr) throw playerErr;
  playerId = player!.id;

  // A coach announcement — guardian-only content by design.
  const { error: annErr } = await admin.from('rep_team_announcements').insert({
    org_id: orgId, team_id: teamId, program_year_id: yearId,
    subject: `${MARK}AnnouncementSubject`, body: `${MARK}AnnouncementBody`,
    recipient_count: 1, sent_count: 1, failed_count: 0, status: 'sent',
    sent_at: new Date().toISOString(), created_by: coachUserId,
  });
  if (annErr) throw annErr;

  // The OUTSIDER holds no family_links row at all — that is the persona. (The old fixture
  // here was a verified FOLLOWER; the database now refuses that row, see the probe below.)
  void outsiderUserId;

  /**
   * ⚠ M1 MEMBERSHIPS — THE ACCESS TRUTH (owner ruling 2026-08-16, mig 245). Without this every
   * coach above 403s at the first membership-gated route, and the spec fails for a reason that
   * has nothing to do with what it tests. PROJECTED from the season rows rather than restated,
   * so the pair can never disagree — see tests/uat/scenarios/_coach-membership-fixture.ts.
   */
  await grantMembershipsFromSeasonRows(admin, teamId);
});

test.afterAll(async () => {
  await cleanup();
  const { data: leftTeams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  expect(leftTeams ?? []).toHaveLength(0);
  const { data: leftLinks } = await admin.from('family_links').select('id').eq('rep_team_id', teamId);
  expect(leftLinks ?? []).toHaveLength(0);
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}

async function apiPost(page: Page, url: string, body: unknown) {
  return page.evaluate(async ({ u, b }) => {
    const res = await fetch(u, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
    });
    let parsed: unknown = null;
    try { parsed = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, body: parsed };
  }, { u: url, b: body });
}

/**
 * ⚠ FIXED 2026-08-04. This used `page.evaluate(fetch(relativeUrl))`, which throws
 * `Failed to parse URL` on a page that has never navigated — and the signed-out probes here
 * deliberately never navigate. The "join page reports the tier as off" probe had therefore never
 * run an assertion in its life; the `test.skip` above hid a probe that was broken anyway.
 *
 * `page.request` carries the context's cookies and resolves against `baseURL`, so it works signed
 * in and signed out alike. Same fix as `family-access-boundary.spec.ts`.
 */
async function apiGet(page: Page, url: string) {
  const res = await page.request.get(url, { timeout: 60_000 });
  let parsed: unknown = null;
  try { parsed = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status(), body: parsed };
}

// ── 1. The switch actually holds ──────────────────────────────────────────────

test.describe('guardian tier switch', () => {
  /**
   * ⚠ THIS USED TO BE `test.skip(GUARDIAN_TIER_ENABLED, ...)`, AND THAT WAS THE BUG.
   *
   * These four probes exist for one reason: to prove the guardian tier stays shut while it waits on
   * counsel. Skipping them when the tier is ON silenced them in exactly the state they guard
   * against. On 2026-08-04 a dev machine was found running with the tier switched on; the suite
   * reported it as "4 skipped" — no failure, no warning, no colour — and it was caught by someone
   * asking why a number was 4, not by anything going red.
   *
   * **A guard that disables itself in the state it guards against is not a guard.** So this now
   * FAILS instead, naming the misconfiguration. When the tier is legitimately turned on after
   * sign-off, this block is what you delete — deliberately, as the decision point — rather than
   * something that quietly stops running on its way there.
   *
   * The tier-BOUNDARY probes further down are unaffected: they are written to hold in both states
   * and must keep running whatever this switch says.
   */
  test.beforeEach(() => {
    expect(
      GUARDIAN_TIER_ENABLED,
      'GUARDIAN_TIER_ENABLED is ON for the app under test. These probes assert the OFF behaviour, '
      + 'which is the state the guardian tier is meant to be in until counsel signs off. Either the '
      + 'environment is misconfigured, or the tier was turned on and this block should have been '
      + 'removed as a deliberate decision.',
    ).toBe(false);
  });

  test('the coach guardian routes do not exist', async ({ page }) => {
    await signIn(page, COACH_EMAIL);
    const list = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${teamId}/guardians`);
    expect(list.status).toBe(404);

    const invite = await apiPost(page, `/api/coaches/${ORG_SLUG}/teams/${teamId}/guardians`, {
      playerId, email: 'someone@dev.local',
    });
    expect(invite.status).toBe(404);
  });

  test('an invite cannot be claimed', async ({ page }) => {
    await signIn(page, OUTSIDER_EMAIL);
    const res = await apiPost(page, `/api/family/claim/${GUESSED_TOKEN}`, {});
    expect(res.status).toBe(404);

    // The real assertion: with both on-ramps shut, no guardian link and no consent record can
    // exist for this team — the switch is the gate, not validation happening to reject.
    const { data: links } = await admin.from('family_links')
      .select('id').eq('rep_team_id', teamId);
    expect(links ?? []).toHaveLength(0);
    const { data: consents } = await admin.from('family_consents')
      .select('id').eq('guardian_email', OUTSIDER_EMAIL);
    expect(consents ?? []).toHaveLength(0);
  });
});

// ── 2. The tier boundary — true whether the switch is on or off ──────────────

test.describe('boundary — an account with no guardian link reaches no child data', () => {
  test('the team payload is refused outright and names nothing', async ({ page }) => {
    await signIn(page, OUTSIDER_EMAIL);
    const res = await apiGet(page, `/api/family/teams/${teamId}`);
    expect(res.status).toBe(404);

    const serialized = JSON.stringify(res.body ?? {});
    // Everything the fixture planted that an unconnected account must never receive.
    expect(serialized).not.toContain(`${MARK}Child`);
    expect(serialized).not.toContain('Surname');
    expect(serialized).not.toContain(`${MARK}MedicalSecret`);
    expect(serialized).not.toContain(`${MARK}AdminSecret`);
    expect(serialized).not.toContain(`${MARK}AnnouncementSubject`);
    expect(serialized).not.toContain(`${MARK}AnnouncementBody`);
    expect(serialized).not.toContain(`${MARK}-parent@dev.local`);
    expect(serialized).not.toContain(MARK);
  });

  test('an unconnected account cannot invite a co-guardian', async ({ page }) => {
    await signIn(page, OUTSIDER_EMAIL);
    const res = await apiPost(page, `/api/family/teams/${teamId}/co-guardian`, {
      email: 'other-parent@dev.local',
    });
    // 404 whether the tier is off (route disabled) or on (no link, no player) — either way an
    // unconnected account can never attach an adult to a child.
    expect(res.status).toBe(404);
  });

  test('an unconnected account cannot reach the coach-side guardian routes', async ({ page }) => {
    await signIn(page, OUTSIDER_EMAIL);
    const res = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${teamId}/guardians`);
    expect([401, 403, 404]).toContain(res.status);
  });

  test('the database refuses a follower row — with or without a player', async () => {
    // The last line of defence, asserted directly: even if every app-layer check were wrong,
    // mig 290's role CHECK makes a team-level connection impossible to store.
    for (const player_id of [playerId, null]) {
      const { error } = await admin.from('family_links').insert({
        org_id: orgId, rep_team_id: teamId, role: 'follower', player_id,
        invited_email: `${MARK}-illegal@dev.local`, status: 'verified',
      });
      expect(error).not.toBeNull();
      expect(String(error?.message ?? '')).toMatch(/family_links_role_check|family_links_role_player_ck|violates check/i);
    }
  });

  test('the database refuses a guardian row with no player', async () => {
    // Mig 290 restored mig 215's strict form. The only producer of a player-less request was
    // the ask-via-link path, which went with the family link; if this ever passes, the CHECK
    // has been loosened again and something can once more write a child-less guardian.
    const { error } = await admin.from('family_links').insert({
      org_id: orgId, rep_team_id: teamId, role: 'guardian',
      player_id: null, invited_email: `${MARK}-pending@dev.local`,
      status: 'requested',
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? '')).toMatch(/family_links_role_player_ck|violates check/i);
  });
});
