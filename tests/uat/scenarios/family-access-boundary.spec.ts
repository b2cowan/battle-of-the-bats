import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * The family layer's access boundary (Coach Portal Chunk D, Slice 1).
 *
 * This chunk's entire risk is READ AUTHORIZATION on data about minors, so every probe below
 * is written from an UNAUTHORIZED persona's point of view. The question each one asks is not
 * "does the happy path work" (the owner walks that in a browser) but "does the wrong person
 * get a 200".
 *
 *  1. THE STRANGER. A guessed join URL, a guessed family-team URL, a guessed game page. All
 *     must be indistinguishable from "no such thing" — a 404 that leaks nothing, including
 *     whether the team exists.
 *  2. THE PENDING / DECLINED / REVOKED REQUESTER. Asking is not access; being declined is not
 *     access; having been removed is not access. Each is asserted as an HTTP status, because
 *     losing the card in Following is not losing the data.
 *  3. THE TIER BOUNDARY — the standing security invariant of the two-tier model. An approved
 *     FOLLOWER must fail closed on anything player-level. In Slice 1 the guardian payloads do
 *     not exist yet, so this probe asserts the two things that DO: the follower's schedule
 *     payload contains no player field at all, and the coach-only routes refuse them.
 *  4. CROSS-TEAM. A verified follower of team A probing team B gets nothing.
 *  5. THE RESET LINK. Resetting is the revocation — the previous URL must die instantly.
 *  6. VISIBILITY FLIPPED TO STAFF. The setting is enforced at the API, so flipping it must
 *     remove the DATA from every surface (family view, calendar feed, game page, public team
 *     page), not just hide a button.
 *  7. THE SHARE GATE. A game page does not exist until the coach shares that specific game.
 *
 * Data-level and HTTP-status assertions only — never screenshots.
 * Self-provisions via service-role with the `capfamily-` marker; pre-cleans, tears down, and
 * ASSERTS the teardown. Error-checks EVERY provisioning insert.
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

const MARK = 'capfamily';
const COACH_EMAIL = `${MARK}-coach@dev.local`;
const FOLLOWER_EMAIL = `${MARK}-follower@dev.local`;
const DECLINED_EMAIL = `${MARK}-declined@dev.local`;
const REVOKED_EMAIL = `${MARK}-revoked@dev.local`;
const STRANGER_EMAIL = `${MARK}-stranger@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';

/** A syntactically valid token that was never minted — the stranger's guess. */
const GUESSED_TOKEN = 'ZZZZthisTokenWasNeverMintedAAAAAAAAAAAAAAAA';

let orgId = '';
let coachUserId = '';
let followerUserId = '';
let declinedUserId = '';
let revokedUserId = '';
let strangerUserId = '';

/** Team A — the one the follower is verified on. */
let teamAId = '';
let teamASlug = '';
let yearAId = '';
let sharedGameId = '';
let unsharedGameId = '';

/** Team B — the one they must NOT reach. */
let teamBId = '';
let teamBSlug = '';

const YEAR = new Date().getFullYear() + 1;

async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const marked = (users?.users ?? []).filter(u => (u.email ?? '').startsWith(`${MARK}-`));

  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    await admin.from('family_links').delete().eq('rep_team_id', t.id);
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
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
    await admin.from('organization_members').delete().eq('user_id', u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
}

/** A plain consumer account — deliberately NOT an org member. A family member is a fan, not
 *  staff, and provisioning them as staff would hide exactly the bug these probes hunt. */
async function makeAccount(email: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) throw error;
  return created.user!.id;
}

async function makeTeam(suffix: string): Promise<{ teamId: string; slug: string; yearId: string }> {
  const slug = `${MARK}-${suffix}`;
  const { data: team, error: teamErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} ${suffix}`, slug, sport: 'softball', schedule_visibility: 'families' })
    .select('id').single();
  if (teamErr) throw teamErr;

  const { data: year, error: yearErr } = await admin.from('rep_program_years')
    .insert({ team_id: team!.id, org_id: orgId, name: `${MARK} ${YEAR}`, year: YEAR, status: 'active' })
    .select('id').single();
  if (yearErr) throw yearErr;

  const { error: coachErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: year!.id, team_id: team!.id, org_id: orgId,
    user_id: coachUserId, coach_role: 'head_coach',
  });
  if (coachErr) throw coachErr;

  return { teamId: team!.id, slug, yearId: year!.id };
}

async function addLink(teamId: string, userId: string, email: string, status: string) {
  const { error } = await admin.from('family_links').insert({
    org_id: orgId, rep_team_id: teamId, role: 'follower', player_id: null,
    user_id: userId, invited_email: email, status,
    ...(status === 'verified' ? { verified_via: 'coach_approved', approved_at: new Date().toISOString() } : {}),
    ...(status === 'declined' ? { declined_at: new Date().toISOString() } : {}),
    ...(status === 'revoked' ? { revoked_at: new Date().toISOString() } : {}),
  });
  if (error) throw error;
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
  declinedUserId = await makeAccount(DECLINED_EMAIL);
  revokedUserId = await makeAccount(REVOKED_EMAIL);
  strangerUserId = await makeAccount(STRANGER_EMAIL);

  const a = await makeTeam('team-a');
  teamAId = a.teamId; teamASlug = a.slug; yearAId = a.yearId;
  const b = await makeTeam('team-b');
  teamBId = b.teamId; teamBSlug = b.slug;

  // A player on team A. Nothing in Slice 1 should ever surface this to a follower — its whole
  // job in this fixture is to exist so a leak has something to leak.
  const { error: playerErr } = await admin.from('rep_roster_players').insert({
    program_year_id: yearAId, team_id: teamAId, org_id: orgId,
    player_first_name: `${MARK}Secret`, player_last_name: 'Child',
    guardian_email: 'someone@dev.local', status: 'active', source: 'admin_manual',
  });
  if (playerErr) throw playerErr;

  const soon = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const later = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

  const { data: shared, error: sharedErr } = await admin.from('rep_team_events').insert({
    program_year_id: yearAId, team_id: teamAId, org_id: orgId,
    event_type: 'league_game', name: `${MARK} shared game`, starts_at: soon,
    opponent: 'Falcons', home_away: 'home', status: 'scheduled',
    family_shared_at: new Date().toISOString(),
  }).select('id').single();
  if (sharedErr) throw sharedErr;
  sharedGameId = shared!.id;

  const { data: unshared, error: unsharedErr } = await admin.from('rep_team_events').insert({
    program_year_id: yearAId, team_id: teamAId, org_id: orgId,
    event_type: 'league_game', name: `${MARK} unshared game`, starts_at: later,
    opponent: 'Storm', home_away: 'away', status: 'scheduled',
  }).select('id').single();
  if (unsharedErr) throw unsharedErr;
  unsharedGameId = unshared!.id;

  await addLink(teamAId, followerUserId, FOLLOWER_EMAIL, 'verified');
  await addLink(teamAId, declinedUserId, DECLINED_EMAIL, 'declined');
  await addLink(teamAId, revokedUserId, REVOKED_EMAIL, 'revoked');
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

/**
 * Call an API as the current browser session and return { status, body }.
 *
 * ⚠ FIXED 2026-08-03 (Tier 1 pilot). This used `page.evaluate(fetch(relativeUrl))`, which throws
 * `Failed to parse URL` whenever the page has never navigated — and the ANONYMOUS probes below
 * never navigate, because being signed out is the whole point of them. Three of this file's
 * probes therefore threw before reaching a single assertion: the guessed join token, the
 * anonymous team payload, and the link reset. **The most exposed surface in the chunk — an
 * unauthenticated stranger holding a guessed URL — was the part with no working probe.**
 *
 * `page.request` shares the context's cookie jar (so a signed-in probe stays signed in) and
 * resolves against `baseURL` (so an anonymous probe needs no page at all).
 */
async function apiGet(page: Page, url: string) {
  const res = await page.request.get(url, { timeout: 60_000 });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status(), body };
}

async function setVisibility(teamId: string, visibility: string) {
  const { error } = await admin.from('rep_teams').update({ schedule_visibility: visibility }).eq('id', teamId);
  if (error) throw error;
}

// ── 1. The stranger ───────────────────────────────────────────────────────────

test.describe('the stranger — a guessed URL learns nothing', () => {
  test('a guessed join token is 404 and names no team', async ({ page }) => {
    await page.context().clearCookies();
    const res = await apiGet(page, `/api/family/join/${GUESSED_TOKEN}`);
    expect(res.status).toBe(404);
    // The refusal must not confirm that any particular team exists.
    expect(JSON.stringify(res.body ?? {})).not.toContain(MARK);
  });

  test('an anonymous caller cannot read a family team payload', async ({ page }) => {
    await page.context().clearCookies();
    const res = await apiGet(page, `/api/family/teams/${teamAId}`);
    expect([401, 404]).toContain(res.status);
    expect(JSON.stringify(res.body ?? {})).not.toContain(MARK);
  });

  test('a guessed calendar token is 404', async ({ page }) => {
    await page.context().clearCookies();
    const res = await page.request.get(`/api/family/calendar/${GUESSED_TOKEN}`);
    expect(res.status()).toBe(404);
  });
});

// ── 2. Asked, declined, removed — none of them is access ─────────────────────

test.describe('a request is not an approval', () => {
  test('a DECLINED requester is refused the schedule', async ({ page }) => {
    await signIn(page, DECLINED_EMAIL);
    const res = await apiGet(page, `/api/family/teams/${teamAId}`);
    expect(res.status).toBe(404);
  });

  test('a REVOKED follower is refused the schedule', async ({ page }) => {
    await signIn(page, REVOKED_EMAIL);
    const res = await apiGet(page, `/api/family/teams/${teamAId}`);
    expect(res.status).toBe(404);
  });

  test('a signed-in stranger with no link at all is refused', async ({ page }) => {
    await signIn(page, STRANGER_EMAIL);
    const res = await apiGet(page, `/api/family/teams/${teamAId}`);
    expect(res.status).toBe(404);
  });

  test('a revoked follower cannot mint a calendar token', async ({ page }) => {
    await signIn(page, REVOKED_EMAIL);
    const res = await page.evaluate(async (id) => {
      const r = await fetch(`/api/family/teams/${id}`, { method: 'POST' });
      return r.status;
    }, teamAId);
    expect(res).toBe(404);
  });
});

// ── 3. The tier boundary — the standing invariant ────────────────────────────

test.describe('tier boundary — a follower reaches no child data', () => {
  test('the follower payload contains no player field and no roster name', async ({ page }) => {
    await signIn(page, FOLLOWER_EMAIL);
    const res = await apiGet(page, `/api/family/teams/${teamAId}`);
    expect(res.status).toBe(200);

    const serialized = JSON.stringify(res.body ?? {});
    // The fixture put a real player on this team. If any of these appear, the DTO leaked.
    expect(serialized).not.toContain('Secret');
    expect(serialized).not.toContain('someone@dev.local');

    /**
     * ⚠ REWRITTEN 2026-08-03 (Tier 1 pilot). This asserted `not.toContain('guardian')` and
     * `not.toContain('player')` against the serialized body. Slice 2 later added a
     * `"guardian": null` FIELD to this payload — the correct, safe value for a follower — and the
     * substring check started failing on a KEY NAME while no data had leaked at all.
     *
     * A blunt substring over a serialized DTO cannot tell "the guardian's email is in here" from
     * "there is a field called guardian and it is empty". Assert the SHAPE instead: the field is
     * present and null, and no player-level container exists.
     */
    const body = res.body as { role?: string; guardian?: unknown; view?: Record<string, unknown> };
    expect(body.role).toBe('follower');
    expect(body.guardian ?? null).toBeNull();
    expect(body.view).not.toHaveProperty('players');
    expect(body.view).not.toHaveProperty('roster');

    // And it must actually be serving the schedule — otherwise the assertions above pass
    // vacuously on an empty payload.
    expect(((body.view?.entries as unknown[]) ?? []).length).toBeGreaterThan(0);
  });

  test('a follower is refused every coach-side family route', async ({ page }) => {
    await signIn(page, FOLLOWER_EMAIL);
    const panel = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${teamAId}/family-access`);
    expect([401, 403, 404]).toContain(panel.status);

    const roster = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${teamAId}/roster`);
    expect([401, 403, 404]).toContain(roster.status);
  });
});

// ── 4. Cross-team ─────────────────────────────────────────────────────────────

test('a verified follower of team A is refused team B', async ({ page }) => {
  await signIn(page, FOLLOWER_EMAIL);
  const res = await apiGet(page, `/api/family/teams/${teamBId}`);
  expect(res.status).toBe(404);
});

// ── 5. Reset is the revocation ────────────────────────────────────────────────

test('resetting the team family link kills the previous URL', async ({ page }) => {
  // Mint by hand at the data layer so the probe does not depend on the coach UI.
  const crypto = await import('node:crypto');
  const first = crypto.randomBytes(32).toString('base64url');
  const firstHash = crypto.createHash('sha256').update(first).digest('hex');
  const { error: e1 } = await admin.from('rep_teams')
    .update({ family_link_token_hash: firstHash, family_link_created_at: new Date().toISOString() })
    .eq('id', teamAId);
  if (e1) throw e1;

  await page.context().clearCookies();
  const alive = await apiGet(page, `/api/family/join/${first}`);
  expect(alive.status).toBe(200);

  // Reset — a NEW token replaces the hash.
  const second = crypto.randomBytes(32).toString('base64url');
  const secondHash = crypto.createHash('sha256').update(second).digest('hex');
  const { error: e2 } = await admin.from('rep_teams')
    .update({ family_link_token_hash: secondHash })
    .eq('id', teamAId);
  if (e2) throw e2;

  const dead = await apiGet(page, `/api/family/join/${first}`);
  expect(dead.status).toBe(404);

  const fresh = await apiGet(page, `/api/family/join/${second}`);
  expect(fresh.status).toBe(200);
});

// ── 6. Visibility is enforced at the API, not the UI ─────────────────────────

test.describe('schedule visibility', () => {
  test.afterEach(async () => { await setVisibility(teamAId, 'families'); });

  test('flipping to STAFF removes the schedule from a verified follower', async ({ page }) => {
    await signIn(page, FOLLOWER_EMAIL);

    const before = await apiGet(page, `/api/family/teams/${teamAId}`);
    expect(before.status).toBe(200);
    expect((before.body as { state?: string }).state).toBe('open');

    await setVisibility(teamAId, 'staff');

    const after = await apiGet(page, `/api/family/teams/${teamAId}`);
    // The connection survives — the DATA does not. A quiet state, never an error (plan §6.3).
    expect(after.status).toBe(200);
    expect((after.body as { state?: string }).state).toBe('hidden');
    expect(JSON.stringify(after.body ?? {})).not.toContain('Falcons');
  });

  test('flipping to STAFF 404s the shared game page', async ({ page }) => {
    const live = await page.request.get(`/${ORG_SLUG}/teams/${teamASlug}/games/${sharedGameId}`);
    expect(live.status()).toBe(200);

    await setVisibility(teamAId, 'staff');

    const dead = await page.request.get(`/${ORG_SLUG}/teams/${teamASlug}/games/${sharedGameId}`);
    expect(dead.status()).toBe(404);
  });

  test('the standing public team schedule exists ONLY at public_link', async ({ page }) => {
    // At `families` the team page renders, but without the schedule.
    const atFamilies = await page.request.get(`/${ORG_SLUG}/teams/${teamASlug}`);
    expect(atFamilies.status()).toBe(200);
    expect(await atFamilies.text()).not.toContain('Falcons');

    await setVisibility(teamAId, 'public_link');

    const atPublic = await page.request.get(`/${ORG_SLUG}/teams/${teamASlug}`);
    expect(atPublic.status()).toBe(200);
    expect(await atPublic.text()).toContain('Falcons');
  });
});

// ── 7. A game page does not exist until it is shared ─────────────────────────

test.describe('per-game share gate', () => {
  test('an UNSHARED game has no page', async ({ page }) => {
    const res = await page.request.get(`/${ORG_SLUG}/teams/${teamASlug}/games/${unsharedGameId}`);
    expect(res.status()).toBe(404);
  });

  test('a SHARED game page carries no identity and no player name', async ({ page }) => {
    await page.context().clearCookies();
    const res = await page.request.get(`/${ORG_SLUG}/teams/${teamASlug}/games/${sharedGameId}`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    // The anonymous-public invariant: nothing about a person in the SSR HTML.
    expect(html).not.toContain('Secret');
    expect(html).not.toContain('someone@dev.local');
    expect(html).not.toContain(FOLLOWER_EMAIL);
    // It IS serving the game, so the assertions above are not vacuous.
    expect(html).toContain('Falcons');
    // Never indexed — a coach sharing one game did not ask to publish a fixture list.
    expect(html.toLowerCase()).toContain('noindex');
  });
});
