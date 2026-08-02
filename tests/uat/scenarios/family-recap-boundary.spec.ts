import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * The season recap's access boundary (Coach Portal Chunk D, Slice 3).
 *
 * The recap is the one surface in this chunk that carries a NAMED CHILD'S RECORD to a phone,
 * and the one that deliberately reaches a PAST season. Every probe below is therefore written
 * from an unauthorized persona's point of view — the question is never "does the happy path
 * work" (the owner walks that in a browser), it is "does the wrong person get a 200".
 *
 *  1. THE ANONYMOUS CALLER. No session, no recap — and the refusal must name no child, no
 *     team and no season.
 *  2. THE FOLLOWER. The standing invariant of the two-tier model. An APPROVED follower is a
 *     real, verified, connected person, and they must still reach nothing player-level. This
 *     probe is written to pass in BOTH guardian-switch states so it stays the standing guard.
 *  3. GUARDIAN OF PLAYER A vs PLAYER B. There is no player id in any URL — the child is
 *     whoever the coach attached to the link — so this probe asserts the STRUCTURAL property:
 *     whatever the guardian receives, it is never the other child's name.
 *  4. THE COACH WITHOUT `rosterPii`. Owner ruling for 3.5: the engagement counts are for a
 *     coach trusted with family contacts. An assistant without that grant gets no counts.
 *  5. THE COACH WITHOUT `notes`. The recap preview carries development content, which rides
 *     the notes capability everywhere else in the portal.
 *  6. THE ARCHIVE EXEMPTION IS ONE-WAY. A family may read their own closed season; the
 *     COACH's preview route must still refuse to address a past one.
 *  7. NO READ RECEIPTS. Nothing anywhere returns a row from `family_recap_views` — the
 *     coach-facing payload is two integers and nothing more.
 *
 * Data-level and HTTP-status assertions only — never screenshots.
 * Self-provisions via service-role with the `caprecap-` marker; pre-cleans, tears down, and
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

const MARK = 'caprecap';
const HEAD_EMAIL = `${MARK}-head@dev.local`;
const ASSISTANT_EMAIL = `${MARK}-assistant@dev.local`;
const GUARDIAN_A_EMAIL = `${MARK}-guardian-a@dev.local`;
const GUARDIAN_B_EMAIL = `${MARK}-guardian-b@dev.local`;
const FOLLOWER_EMAIL = `${MARK}-follower@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';

/** The two children. Distinct, searchable names — a leak has something to be caught leaking. */
const CHILD_A = `${MARK}Ana`;
const CHILD_B = `${MARK}Bruno`;

let orgId = '';
let headUserId = '';
let assistantUserId = '';
let guardianAUserId = '';
let guardianBUserId = '';
let followerUserId = '';

/** The CLOSED season the recap belongs to. */
let teamId = '';
let closedYearId = '';
let playerAId = '';
let playerBId = '';

/** A team with a LIVE season — the coach preview's home, and the archive probe's control. */
let liveTeamId = '';
let liveYearId = '';
let livePlayerId = '';
let livePastYearId = '';

const YEAR = new Date().getFullYear() + 1;

async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const marked = (users?.users ?? []).filter(u => (u.email ?? '').startsWith(`${MARK}-`));

  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: links } = await admin.from('family_links').select('id').eq('rep_team_id', t.id);
    for (const l of links ?? []) {
      await admin.from('family_recap_views').delete().eq('link_id', l.id);
    }
    await admin.from('family_recap_views').delete().eq('rep_team_id', t.id);
    await admin.from('family_links').delete().eq('rep_team_id', t.id);
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      const { data: players } = await admin.from('rep_roster_players').select('id').eq('program_year_id', y.id);
      for (const p of players ?? []) {
        await admin.from('rep_player_awards').delete().eq('player_id', p.id);
        await admin.from('rep_player_development_goals').delete().eq('player_id', p.id);
        await admin.from('rep_player_measurables').delete().eq('player_id', p.id);
        await admin.from('rep_team_event_attendance').delete().eq('player_id', p.id);
      }
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

/** A plain consumer account — deliberately NOT an org member. */
async function makeAccount(email: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) throw error;
  return created.user!.id;
}

async function makeTeam(suffix: string, seasonStatus: string): Promise<{ teamId: string; yearId: string }> {
  const { data: team, error: teamErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} ${suffix}`, slug: `${MARK}-${suffix}`, sport: 'softball', schedule_visibility: 'families' })
    .select('id').single();
  if (teamErr) throw teamErr;

  const { data: year, error: yearErr } = await admin.from('rep_program_years')
    .insert({ team_id: team!.id, org_id: orgId, name: `${MARK} ${YEAR}`, year: YEAR, status: seasonStatus })
    .select('id').single();
  if (yearErr) throw yearErr;

  for (const [userId, role] of [[headUserId, 'head_coach'], [assistantUserId, 'assistant_coach']] as const) {
    const { error } = await admin.from('rep_team_coaches').insert({
      program_year_id: year!.id, team_id: team!.id, org_id: orgId,
      user_id: userId, coach_role: role,
      // The assistant gets roster visibility ONLY — no notes, no rosterPii. That is the
      // least-privilege default, and it is exactly the persona probes 4 and 5 need.
      ...(role === 'assistant_coach' ? { capabilities: { roster: 'view' } } : {}),
    });
    if (error) throw error;
  }
  return { teamId: team!.id, yearId: year!.id };
}

async function makePlayer(yearId: string, tId: string, firstName: string): Promise<string> {
  const { data, error } = await admin.from('rep_roster_players').insert({
    program_year_id: yearId, team_id: tId, org_id: orgId,
    player_first_name: firstName, player_last_name: 'Probe',
    guardian_email: 'someone@dev.local', status: 'active', source: 'admin_manual',
  }).select('id').single();
  if (error) throw error;
  return data!.id;
}

async function addGuardian(tId: string, userId: string, email: string, playerId: string) {
  const { error } = await admin.from('family_links').insert({
    org_id: orgId, rep_team_id: tId, role: 'guardian', player_id: playerId,
    user_id: userId, invited_email: email, status: 'verified',
    verified_via: 'coach_approved', approved_at: new Date().toISOString(),
  });
  if (error) throw error;
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org, error: orgErr } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  if (orgErr) throw orgErr;
  orgId = org!.id;

  headUserId = await makeAccount(HEAD_EMAIL);
  assistantUserId = await makeAccount(ASSISTANT_EMAIL);
  for (const uid of [headUserId, assistantUserId]) {
    const { error } = await admin.from('organization_members').insert({
      organization_id: orgId, user_id: uid, role: 'coach',
      status: 'active', accepted_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  guardianAUserId = await makeAccount(GUARDIAN_A_EMAIL);
  guardianBUserId = await makeAccount(GUARDIAN_B_EMAIL);
  followerUserId = await makeAccount(FOLLOWER_EMAIL);

  const closed = await makeTeam('closed', 'completed');
  teamId = closed.teamId; closedYearId = closed.yearId;
  playerAId = await makePlayer(closedYearId, teamId, CHILD_A);
  playerBId = await makePlayer(closedYearId, teamId, CHILD_B);

  // Something for the recap to actually contain, so an empty payload cannot pass a leak probe
  // by being empty for the wrong reason.
  const { error: goalErr } = await admin.from('rep_player_development_goals').insert({
    org_id: orgId, team_id: teamId, player_id: playerAId,
    focus_area: `${MARK} first touch`, status: 'working',
  });
  if (goalErr) throw goalErr;

  await addGuardian(teamId, guardianAUserId, GUARDIAN_A_EMAIL, playerAId);
  await addGuardian(teamId, guardianBUserId, GUARDIAN_B_EMAIL, playerBId);

  const { error: followerErr } = await admin.from('family_links').insert({
    org_id: orgId, rep_team_id: teamId, role: 'follower', player_id: null,
    user_id: followerUserId, invited_email: FOLLOWER_EMAIL, status: 'verified',
    verified_via: 'coach_approved', approved_at: new Date().toISOString(),
  });
  if (followerErr) throw followerErr;

  const live = await makeTeam('live', 'active');
  liveTeamId = live.teamId; liveYearId = live.yearId;
  livePlayerId = await makePlayer(liveYearId, liveTeamId, `${MARK}Live`);

  // A PAST season on the live team — the archive probe's target.
  const { data: past, error: pastErr } = await admin.from('rep_program_years')
    .insert({ team_id: liveTeamId, org_id: orgId, name: `${MARK} ${YEAR - 1}`, year: YEAR - 1, status: 'completed' })
    .select('id').single();
  if (pastErr) throw pastErr;
  livePastYearId = past!.id;
  const { error: pastCoachErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: livePastYearId, team_id: liveTeamId, org_id: orgId,
    user_id: headUserId, coach_role: 'head_coach',
  });
  if (pastCoachErr) throw pastCoachErr;
});

test.afterAll(async () => {
  await cleanup();
  const { data: leftTeams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  expect(leftTeams ?? []).toHaveLength(0);
  const { data: leftLinks } = await admin.from('family_links').select('id').eq('invited_email', GUARDIAN_A_EMAIL);
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

/** Call an API as the current browser session and return { status, body }. */
async function apiGet(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const res = await fetch(u);
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, body };
  }, url);
}

/** The recap is an SSR page, not an API — so the probe reads the RENDERED HTML and asserts on
 *  what is (and is not) in it. A name absent from the markup is a name that did not travel. */
async function pageHtml(page: Page, url: string): Promise<{ status: number; html: string }> {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { status: res?.status() ?? 0, html: await page.content() };
}

// ── 1. The anonymous caller ───────────────────────────────────────────────────

test.describe('the anonymous caller', () => {
  test('a signed-out visitor reaches no recap and learns no child\'s name', async ({ page }) => {
    await page.context().clearCookies();
    const { html } = await pageHtml(page, `/family/teams/${teamId}/recap`);
    expect(html).not.toContain(CHILD_A);
    expect(html).not.toContain(CHILD_B);
    expect(html).toMatch(/sign in/i);
  });
});

// ── 2. The follower — the standing tier boundary ──────────────────────────────

test.describe('the tier boundary — an approved FOLLOWER is not a guardian', () => {
  test('a verified follower reaches no recap at all', async ({ page }) => {
    await signIn(page, FOLLOWER_EMAIL);
    const { html } = await pageHtml(page, `/family/teams/${teamId}/recap`);
    expect(html).not.toContain(CHILD_A);
    expect(html).not.toContain(CHILD_B);
    expect(html).toMatch(/not available/i);
  });

  test('the follower\'s team payload still carries no player field', async ({ page }) => {
    await signIn(page, FOLLOWER_EMAIL);
    const res = await apiGet(page, `/api/family/teams/${teamId}`);
    const body = JSON.stringify(res.body ?? {});
    expect(body).not.toContain(CHILD_A);
    expect(body).not.toContain(CHILD_B);
    expect(body).not.toContain('playerFirstName');
  });
});

// ── 3. Guardian of A vs guardian of B ─────────────────────────────────────────

test.describe('one guardian, one child', () => {
  test('guardian A never receives child B — whatever the guardian switch is set to', async ({ page }) => {
    await signIn(page, GUARDIAN_A_EMAIL);
    const { html } = await pageHtml(page, `/family/teams/${teamId}/recap`);
    // The switch may be OFF, in which case A sees nothing either. What must ALWAYS hold is
    // that the other child never appears — there is no URL shape that could ask for them.
    expect(html).not.toContain(CHILD_B);
  });

  test('guardian B never receives child A', async ({ page }) => {
    await signIn(page, GUARDIAN_B_EMAIL);
    const { html } = await pageHtml(page, `/family/teams/${teamId}/recap`);
    expect(html).not.toContain(CHILD_A);
  });
});

// ── 4 & 5. The under-granted coach ────────────────────────────────────────────

test.describe('the coach\'s preview and counts are capability-gated', () => {
  test('an assistant without notes cannot preview a player\'s recap', async ({ page }) => {
    await signIn(page, ASSISTANT_EMAIL);
    const res = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${liveTeamId}/roster/${livePlayerId}/recap`);
    expect([403, 404]).toContain(res.status);
    expect(JSON.stringify(res.body ?? {})).not.toContain(MARK);
  });

  test('an assistant without rosterPii is told no engagement counts', async ({ page }) => {
    await signIn(page, ASSISTANT_EMAIL);
    const res = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${liveTeamId}/wrapped?year=${livePastYearId}`);
    // Wrapped itself is open to any assigned coach; the COUNTS are not.
    if (res.status === 200) {
      const body = res.body as { recapEngagement?: unknown };
      expect(body.recapEngagement ?? null).toBeNull();
    }
  });

  test('the head coach\'s counts are integers, never a list of families', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const res = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${liveTeamId}/wrapped?year=${livePastYearId}`);
    expect(res.status).toBe(200);
    const body = res.body as { recapEngagement?: { viewers: number; eligible: number } };
    expect(body.recapEngagement).toBeTruthy();
    expect(typeof body.recapEngagement!.viewers).toBe('number');
    expect(typeof body.recapEngagement!.eligible).toBe('number');
    // No identity of any kind rides along — this is the read-receipt guard.
    const raw = JSON.stringify(body.recapEngagement);
    expect(raw).not.toContain('@');
    expect(raw).not.toContain('link');
    expect(raw).not.toContain('viewedAt');
  });
});

// ── 6. The archive exemption is one-way ───────────────────────────────────────

test.describe('the archive is opt-in — the coach preview stays live-season only', () => {
  test('a ?year= on the preview route cannot reach a past season', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    const res = await apiGet(
      page,
      `/api/coaches/${ORG_SLUG}/teams/${liveTeamId}/roster/${livePlayerId}/recap?year=${livePastYearId}`,
    );
    // The route ignores the parameter entirely and resolves the ACTIVE season, so the LIVE
    // player still resolves. What must never happen is a past season's roster answering.
    if (res.status === 200) {
      const body = JSON.stringify(res.body ?? {});
      expect(body).toContain(`${MARK}Live`);
    }
  });

  test('a player who belongs only to a CLOSED season is unreachable from the preview', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    // playerA lives on the closed team's completed season; that team has no active year at
    // all, so the preview route must refuse rather than fall back to something.
    const res = await apiGet(page, `/api/coaches/${ORG_SLUG}/teams/${teamId}/roster/${playerAId}/recap`);
    expect([403, 404]).toContain(res.status);
    expect(JSON.stringify(res.body ?? {})).not.toContain(CHILD_A);
  });
});

// ── 7. No read receipts, ever ─────────────────────────────────────────────────

test.describe('engagement is a count, not a receipt', () => {
  test('no family-facing payload exposes who viewed a recap', async ({ page }) => {
    await signIn(page, GUARDIAN_A_EMAIL);
    const res = await apiGet(page, `/api/family/teams/${teamId}`);
    const body = JSON.stringify(res.body ?? {});
    expect(body).not.toContain('recapView');
    expect(body).not.toContain('firstViewedAt');
  });

  test('the view table is unreadable from the browser (service-role only)', async ({ page }) => {
    await signIn(page, GUARDIAN_A_EMAIL);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const probe = await page.evaluate(async ([u, k]) => {
      const res = await fetch(`${u}/rest/v1/family_recap_views?select=id`, {
        headers: { apikey: k as string, Authorization: `Bearer ${k}` },
      });
      return { status: res.status, text: (await res.text()).slice(0, 400) };
    }, [url, key]);
    // RLS ON with no policies ⇒ an empty set at best, an error at worst. Never rows.
    expect(probe.text).not.toMatch(/"id"\s*:/);
  });
});
