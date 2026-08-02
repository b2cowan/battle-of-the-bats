import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * The GUARDIAN tier boundary (Coach Portal Chunk D, Slice 2) — built, shipped switched OFF.
 *
 * Two jobs, and the first one is the reason this file exists at all:
 *
 *  1. THE SWITCH ACTUALLY HOLDS. `GUARDIAN_TIER_ENABLED` defaults off, and while it is off
 *     NOTHING guardian-shaped may be created — not by the UI, not by a direct API call. A
 *     feature "shipped disabled" whose disable can be stepped around is not disabled, and this
 *     one is gating a consent flow that has not been through counsel yet.
 *  2. THE TIER BOUNDARY. An approved FOLLOWER must fail closed on every guardian payload. This
 *     is the standing security invariant of the two-tier model: a follower is connected to a
 *     TEAM and to no child, and no route may hand them one.
 *
 * The boundary assertions are written to pass whether the switch is on or off, so this file
 * keeps working as the standing guard the day the tier is turned on. The switch assertions
 * self-skip when it is on, and say so rather than silently passing.
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
const FOLLOWER_EMAIL = `${MARK}-follower@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
const GUESSED_TOKEN = 'ZZZZthisTokenWasNeverMintedBBBBBBBBBBBBBBBB';

let orgId = '';
let coachUserId = '';
let followerUserId = '';
let teamId = '';
let yearId = '';
let playerId = '';
let familyLinkToken = '';

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
  followerUserId = await makeAccount(FOLLOWER_EMAIL);

  const crypto = await import('node:crypto');
  familyLinkToken = crypto.randomBytes(32).toString('base64url');
  const { data: team, error: teamErr } = await admin.from('rep_teams').insert({
    org_id: orgId, name: `${MARK} Guardians`, slug: `${MARK}-guardians`, sport: 'softball',
    schedule_visibility: 'families',
    family_link_token_hash: crypto.createHash('sha256').update(familyLinkToken).digest('hex'),
    family_link_created_at: new Date().toISOString(),
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

  // The child whose data must never reach a follower.
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

  // A VERIFIED FOLLOWER — the persona the boundary is about.
  const { error: linkErr } = await admin.from('family_links').insert({
    org_id: orgId, rep_team_id: teamId, role: 'follower', player_id: null,
    user_id: followerUserId, invited_email: FOLLOWER_EMAIL, status: 'verified',
    verified_via: 'coach_approved', approved_at: new Date().toISOString(),
  });
  if (linkErr) throw linkErr;
});

test.afterAll(async () => {
  await cleanup();
  const { data: leftTeams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  expect(leftTeams ?? []).toHaveLength(0);
  const { data: leftLinks } = await admin.from('family_links').select('id').eq('invited_email', FOLLOWER_EMAIL);
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

async function apiGet(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const res = await fetch(u);
    let parsed: unknown = null;
    try { parsed = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, body: parsed };
  }, url);
}

// ── 1. The switch actually holds ──────────────────────────────────────────────

test.describe('guardian tier switch', () => {
  test.skip(GUARDIAN_TIER_ENABLED, 'GUARDIAN_TIER_ENABLED is ON — these assert the OFF behaviour.');

  test('a direct guardian request is refused and writes NOTHING', async ({ page }) => {
    await signIn(page, FOLLOWER_EMAIL);

    // Deliberately a well-formed request with every consent ticked — the point is that a
    // complete, valid payload is still refused, so the switch is the gate rather than
    // validation happening to reject it.
    const res = await apiPost(page, `/api/family/join/${familyLinkToken}`, {
      role: 'guardian',
      playerFirstName: `${MARK}Child`,
      playerLastName: 'Surname',
      relationship: 'Parent',
      ageBand: 'under_13',
      consentDataCollection: true,
      consentGuardian: true,
    });
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body ?? {})).toContain('guardian_tier_unavailable');

    // The real assertion: no guardian link and no consent record exist.
    const { data: links } = await admin.from('family_links')
      .select('id').eq('rep_team_id', teamId).eq('role', 'guardian');
    expect(links ?? []).toHaveLength(0);

    const { data: consents } = await admin.from('family_consents')
      .select('id').eq('guardian_email', FOLLOWER_EMAIL);
    expect(consents ?? []).toHaveLength(0);
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
    await signIn(page, FOLLOWER_EMAIL);
    const res = await apiPost(page, `/api/family/claim/${GUESSED_TOKEN}`, {});
    expect(res.status).toBe(404);
  });

  test('the join page reports the tier as off, so the UI cannot offer it', async ({ page }) => {
    await page.context().clearCookies();
    const res = await apiGet(page, `/api/family/join/${familyLinkToken}`);
    expect(res.status).toBe(200);
    expect((res.body as { guardianTierEnabled?: boolean }).guardianTierEnabled).toBe(false);
  });
});

// ── 2. The tier boundary — true whether the switch is on or off ──────────────

test.describe('tier boundary — a follower reaches no child data', () => {
  test('the follower payload carries no player, no announcement, no roster secret', async ({ page }) => {
    await signIn(page, FOLLOWER_EMAIL);
    const res = await apiGet(page, `/api/family/teams/${teamId}`);
    expect(res.status).toBe(200);

    const serialized = JSON.stringify(res.body ?? {});
    // Everything the fixture planted that a follower must never receive.
    expect(serialized).not.toContain(`${MARK}Child`);
    expect(serialized).not.toContain('Surname');
    expect(serialized).not.toContain(`${MARK}MedicalSecret`);
    expect(serialized).not.toContain(`${MARK}AdminSecret`);
    expect(serialized).not.toContain(`${MARK}AnnouncementSubject`);
    expect(serialized).not.toContain(`${MARK}AnnouncementBody`);
    expect(serialized).not.toContain(`${MARK}-parent@dev.local`);

    // The guardian payload must be absent entirely — not present-but-empty, which would mean
    // the shape reached them and only happened to be unfilled.
    const body = res.body as { role?: string; guardian?: unknown };
    expect(body.role).toBe('follower');
    expect(body.guardian ?? null).toBeNull();
  });

  test('a follower cannot invite a co-guardian', async ({ page }) => {
    await signIn(page, FOLLOWER_EMAIL);
    const res = await apiPost(page, `/api/family/teams/${teamId}/co-guardian`, {
      email: 'other-parent@dev.local',
    });
    // 404 whether the tier is off (route disabled) or on (follower has no player) — either
    // way a follower can never attach an adult to a child.
    expect(res.status).toBe(404);
  });

  test('a follower cannot reach the coach-side guardian routes', async ({ page }) => {
    await signIn(page, FOLLOWER_EMAIL);
    const res = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${teamId}/guardians`);
    expect([401, 403, 404]).toContain(res.status);
  });

  test('the database refuses a follower row carrying a player', async () => {
    // The last line of defence, asserted directly: even if every app-layer check were wrong,
    // the CHECK constraint makes a child-linked follower impossible to store.
    const { error } = await admin.from('family_links').insert({
      org_id: orgId, rep_team_id: teamId, role: 'follower',
      player_id: playerId,                                   // ← the violation
      invited_email: `${MARK}-illegal@dev.local`, status: 'verified',
    });
    expect(error).not.toBeNull();
    expect(String(error?.message ?? '')).toMatch(/family_links_role_player_ck|violates check/i);
  });

  test('the database still allows a guardian REQUEST with no player yet', async () => {
    // Migration 216's other half: the coach attaches the player at approval, so a waiting
    // request legitimately has none. If this ever fails, the request flow is broken.
    const { error } = await admin.from('family_links').insert({
      org_id: orgId, rep_team_id: teamId, role: 'guardian',
      player_id: null, invited_email: `${MARK}-pending@dev.local`,
      status: 'requested', requested_player_name: 'Someone',
    });
    expect(error).toBeNull();

    // ...and refuses to let that row become VERIFIED without one.
    const { error: verifyError } = await admin.from('family_links')
      .update({ status: 'verified' })
      .eq('rep_team_id', teamId)
      .eq('invited_email', `${MARK}-pending@dev.local`);
    expect(verifyError).not.toBeNull();

    await admin.from('family_links').delete()
      .eq('rep_team_id', teamId).eq('invited_email', `${MARK}-pending@dev.local`);
  });
});
