import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * THE DEVELOPMENT GRANT — the boundary probe (owner ruling 2026-09-11; built 2026-09-12 as Part A
 * of the development lifecycle's Phase 1 chat). Ledger exit A: "an assistant with the switch on can
 * define a test, start a session and record a reading on the UAT team; with it off the same
 * assistant gets a clear refusal and read-only screens."
 *
 * ⚠ METHOD. HTTP status and payload assertions, from the UNAUTHORIZED direction first — the
 * question is not "does the head coach's happy path work" (the owner walks that) but "does the
 * person WITHOUT the switch get a 403 with the grant's own sentence, and does the person WITH it
 * get through". Two fixture personas that differ in exactly one key carry the whole answer:
 *   · `uat-asst-development` — attendance + lineups + notes, `development: true`
 *   · `uat-asst-nomoney`     — attendance + lineups, `development` absent (= off)
 *
 * ⚠ WRITES ONLY WHAT IT TAKES BACK. A session it starts is deleted; a reading it records is
 * deleted; a goal it adds is deleted — through the routes, never the database. A definition is NOT
 * created here (types cannot be hard-deleted; a probe would leave a retired "Grant probe" on the
 * Metrics tab for every later walk). Defining a test with the grant is the walk's own step.
 *
 * Runs on the shared UAT fixture (`uat-test-org`). By file path, never `-g`:
 *   npx playwright test --config playwright.config.ts tests/uat/scenarios/coach-development-grant.spec.ts
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

const PROD_PROJECT_REF = 'qcttcboqysynwcdyghil';
if ((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(PROD_PROJECT_REF)) {
  throw new Error('coach-development-grant.spec.ts refuses to run: NEXT_PUBLIC_SUPABASE_URL points at PRODUCTION.');
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const ORG_SLUG = process.env.UAT_ORG_SLUG!;
const PASSWORD = process.env.UAT_COACH_PASSWORD!;
const GRANTED = 'uat-asst-development@uat-test-org.local';
const NOT_GRANTED = 'uat-asst-nomoney@uat-test-org.local';
/** The one sentence every refused development write answers with (lib/coach-capabilities.ts). */
const REFUSAL = /Development grant/;

let teamId = '';
let playerId = '';
let typeId = '';

test.beforeAll(async () => {
  const { data: org } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  const { data: team } = await admin.from('rep_teams').select('id').eq('org_id', org!.id).eq('name', 'UAT Test Team').single();
  teamId = team!.id;
  const { data: py } = await admin.from('rep_program_years')
    .select('id').eq('team_id', teamId).eq('status', 'active').order('year', { ascending: false }).limit(1).single();
  // Casey Test — a live-season player the seeded probe session holds NO reading for under the sprint.
  const { data: player } = await admin.from('rep_roster_players')
    .select('id').eq('program_year_id', py!.id).eq('player_first_name', 'Casey').eq('status', 'active').limit(1).single();
  playerId = player!.id;
  const { data: type } = await admin.from('rep_team_measurable_types')
    .select('id').eq('team_id', teamId).ilike('name', '60-yd sprint').eq('is_active', true).limit(1).single();
  typeId = type!.id;
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}

const api = () => `/api/coaches/${ORG_SLUG}/teams/${teamId}`;
async function call(page: Page, method: 'get' | 'post' | 'patch' | 'delete', url: string, data?: unknown) {
  const res = await page.request[method](url, { data, timeout: 60_000 });
  let body: { error?: string; [k: string]: unknown } = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status(), body };
}
const today = () => new Date().toISOString().slice(0, 10); // utc-intentional: any valid date will do for a probe session

// ── The switch OFF: read-only screens, one refusal ─────────────────────────────

test.describe('an assistant WITHOUT the Development grant', () => {
  test('reads Skills & Goals as read-only and every write answers the grant’s sentence', async ({ page }) => {
    await signIn(page, NOT_GRANTED);

    const hub = await call(page, 'get', `${api()}/development/sessions`);
    expect(hub.status).toBe(200);
    expect(hub.body.canWrite).toBe(false);
    expect((hub.body.sessions as unknown[]).length).toBeGreaterThan(0); // reading is unchanged

    const session = await call(page, 'post', `${api()}/development/sessions`, { sessionDate: today() });
    expect(session.status).toBe(403);
    expect(session.body.error).toMatch(REFUSAL);

    const type = await call(page, 'post', `${api()}/development/measurable-types`, { name: 'Grant probe', unit: 'seconds' });
    expect(type.status).toBe(403);
    expect(type.body.error).toMatch(REFUSAL);

    const reading = await call(page, 'post', `${api()}/roster/${playerId}/development/measurables`,
      { measurableTypeId: typeId, value: 8.5, recordedOn: today() });
    expect(reading.status).toBe(403);
    expect(reading.body.error).toMatch(REFUSAL);

    const goal = await call(page, 'post', `${api()}/roster/${playerId}/development/goals`, { focusArea: 'Grant probe goal' });
    expect(goal.status).toBe(403);
    expect(goal.body.error).toMatch(REFUSAL);
  });
});

// ── The switch ON: the same person, the same doors, through ────────────────────

test.describe('an assistant WITH the Development grant', () => {
  test('starts a session, records a reading and writes a goal — and takes each back', async ({ page }) => {
    await signIn(page, GRANTED);

    const hub = await call(page, 'get', `${api()}/development/sessions`);
    expect(hub.status).toBe(200);
    expect(hub.body.canWrite).toBe(true);

    // A session, then its deletion (readings are never touched by a session delete; this one has none).
    const started = await call(page, 'post', `${api()}/development/sessions`, { sessionDate: today(), note: 'grant probe' });
    expect(started.status).toBe(201);
    const sessionId = (started.body.session as { id: string }).id;
    const gone = await call(page, 'delete', `${api()}/development/sessions/${sessionId}`);
    expect(gone.status).toBe(200);

    // A single reading on Casey Test, then its deletion.
    const reading = await call(page, 'post', `${api()}/roster/${playerId}/development/measurables`,
      { measurableTypeId: typeId, value: 8.5, recordedOn: today(), note: 'grant probe' });
    expect(reading.status).toBe(201);
    const entryId = (reading.body.entry as { id: string }).id;
    const readingGone = await call(page, 'delete', `${api()}/roster/${playerId}/development/measurables/${entryId}`);
    expect(readingGone.status).toBe(200);

    // A goal (the grant WITH notes), then its deletion.
    const goal = await call(page, 'post', `${api()}/roster/${playerId}/development/goals`, { focusArea: 'Grant probe goal' });
    expect(goal.status).toBe(201);
    const goalId = (goal.body.goal as { id: string }).id;
    const goalGone = await call(page, 'delete', `${api()}/roster/${playerId}/development/goals/${goalId}`);
    expect(goalGone.status).toBe(200);
  });

  test('the profile read says which writes this person holds', async ({ page }) => {
    await signIn(page, GRANTED);
    const profile = await call(page, 'get', `${api()}/roster/${playerId}/development`);
    expect(profile.status).toBe(200);
    expect(profile.body.canWrite).toBe(true);
    expect(profile.body.canWriteGoals).toBe(true);
  });
});

test.afterAll(async () => {
  // A crashed run must not leave a probe behind — and the next run must SEE it, not work around it.
  const { data: strayGoals } = await admin.from('rep_player_development_goals').select('id').eq('focus_area', 'Grant probe goal');
  const { data: strayReadings } = await admin.from('rep_player_measurables').select('id').eq('note', 'grant probe');
  const { data: straySessions } = await admin.from('rep_team_evaluation_sessions').select('id').eq('note', 'grant probe');
  expect(strayGoals ?? []).toHaveLength(0);
  expect(strayReadings ?? []).toHaveLength(0);
  expect(straySessions ?? []).toHaveLength(0);
});
