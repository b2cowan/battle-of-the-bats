import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * THE BLINDFOLD — Tryout Insights (QA ledger §1.11), Tier 1.
 *
 * Blind evaluation exists so a coach scoring a child on a field cannot be swayed by who the child
 * is or what they did last year. That promise is only worth anything if it is enforced on the
 * SERVER: hiding a strip in the UI while the payload still carries last season's scores means the
 * de-anonymization is one devtools tab away, and the fairness receipt the report prints becomes a
 * claim the product cannot back.
 *
 * The ledger asks for the ABSENCE of things, which is the hardest kind of check to do honestly,
 * so every probe here comes in a pair:
 *
 *   · with the blindfold ON  — the payload must carry no prior-season score and no child's name
 *   · with the blindfold OFF — the SAME probe must carry them
 *
 * Without the second half, every assertion in this file would pass against a broken route that
 * returns nothing at all. That is the "a screen that could not be measured is not a screen that
 * passed" rule applied to a payload.
 *
 * What it covers from §1.11:
 *   · the live scoreboard carries no identity while blind
 *   · candidate memory refuses to assemble while blind, and says so rather than returning an
 *     empty map that reads as "no history"
 *   · the full-detail export's name×score×decision mapping does not leave the server while blind
 *   · a candidate's `tryouts` grant is required at all — an assistant without it sees no tryout
 *     surface, which is the §1.11 step "as an assistant coach without tryouts access"
 *
 * ⚠ HTTP status and payload assertions only, never screenshots.
 * Self-provisions via service-role with the `capblind-` marker; pre-cleans, tears down, ASSERTS
 * the teardown, and error-checks every provisioning insert.
 *
 * Run by FILE PATH, not `-g`:
 *   npx playwright test --config playwright.config.ts tests/uat/scenarios/tryout-blindfold-boundary.spec.ts
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

const MARK = 'capblind';
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';

const HEAD_EMAIL = `${MARK}-head@dev.local`;
/** An assistant holding everything EXCEPT tryouts — §1.11's "no tryout surface at all". */
const NO_TRYOUTS_EMAIL = `${MARK}-notryouts@dev.local`;

const CANDIDATE_FIRST = `${MARK}Rowan`;
const CANDIDATE_LAST = 'Blindcheck';
const CANDIDATE_GUARDIAN = `${MARK}-guardian@dev.local`;
const BIB = '77';

const YEAR = new Date().getFullYear() + 1;

let orgId = '';
let teamId = '';
let liveYearId = '';
let tryoutId = '';
let registrationId = '';
const userIds: Record<string, string> = {};

async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const marked = (users?.users ?? []).filter(u => (u.email ?? '').startsWith(`${MARK}-`));

  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      const { data: tryouts } = await admin.from('rep_tryouts').select('id').eq('program_year_id', y.id);
      for (const tr of tryouts ?? []) {
        await admin.from('rep_tryout_scores').delete().eq('tryout_id', tr.id);
        await admin.from('rep_tryout_sessions').delete().eq('tryout_id', tr.id);
      }
      await admin.from('rep_tryout_registrations').delete().eq('program_year_id', y.id);
      await admin.from('rep_tryouts').delete().eq('program_year_id', y.id);
      await admin.from('rep_roster_players').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_coaches').delete().eq('program_year_id', y.id);
    }
    await admin.from('rep_program_years').delete().eq('team_id', t.id);
    await admin.from('rep_teams').delete().eq('id', t.id);
  }
  for (const u of marked) {
    await admin.from('organization_members').delete().eq('user_id', u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
}

async function makeAccount(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) throw error;
  const uid = data.user!.id;
  const { error: memErr } = await admin.from('organization_members').insert({
    organization_id: orgId, user_id: uid, role: 'coach',
    status: 'active', accepted_at: new Date().toISOString(),
  });
  if (memErr) throw memErr;
  return uid;
}

/** Flip the blindfold at the data layer, so no probe depends on the settings UI. */
async function setBlind(on: boolean) {
  const { error } = await admin.from('rep_tryouts').update({ is_anonymous: on }).eq('id', tryoutId);
  if (error) throw error;
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org, error: orgErr } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  if (orgErr) throw orgErr;
  orgId = org!.id;

  const { data: team, error: teamErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} tryout team`, slug: `${MARK}-tryout-team`, sport: 'softball' })
    .select('id').single();
  if (teamErr) throw teamErr;
  teamId = team!.id;

  const { data: year, error: yearErr } = await admin.from('rep_program_years')
    .insert({ team_id: teamId, org_id: orgId, name: `${MARK} ${YEAR}`, year: YEAR, status: 'active', tryout_open: true })
    .select('id').single();
  if (yearErr) throw yearErr;
  liveYearId = year!.id;

  userIds.head = await makeAccount(HEAD_EMAIL);
  const { error: headErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: liveYearId, team_id: teamId, org_id: orgId,
    user_id: userIds.head, coach_role: 'head_coach',
  });
  if (headErr) throw headErr;

  userIds.noTryouts = await makeAccount(NO_TRYOUTS_EMAIL);
  const { error: asstErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: liveYearId, team_id: teamId, org_id: orgId,
    user_id: userIds.noTryouts, coach_role: 'assistant_coach',
    capabilities: {
      schedule: true, scheduleManage: true, attendance: true, lineups: true,
      rosterPii: true, notes: true, money: 'write', documents: 'manage',
      announcementsSend: true, tryouts: false, staffChat: true,
    },
  });
  if (asstErr) throw asstErr;

  // The tryout workspace, blindfold ON — the shipped default.
  const { data: tryout, error: tryoutErr } = await admin.from('rep_tryouts')
    .insert({ program_year_id: liveYearId, team_id: teamId, org_id: orgId, is_anonymous: true })
    .select('id').single();
  if (tryoutErr) throw tryoutErr;
  tryoutId = tryout!.id;

  // One candidate carrying a name, a guardian and a bib. Its whole job is to be leakable.
  const { data: reg, error: regErr } = await admin.from('rep_tryout_registrations').insert({
    program_year_id: liveYearId, team_id: teamId, org_id: orgId,
    player_first_name: CANDIDATE_FIRST, player_last_name: CANDIDATE_LAST,
    guardian_email: CANDIDATE_GUARDIAN, guardian_first_name: 'Pat', guardian_last_name: CANDIDATE_LAST,
    status: 'pending_review', bib_number: BIB, is_checked_in: true,
    checked_in_at: new Date().toISOString(),
    consent_data_collection: true, consent_eligibility: true,
  }).select('id').single();
  if (regErr) throw regErr;
  registrationId = reg!.id;
});

test.afterAll(async () => {
  await cleanup();
  const { data: leftTeams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  expect(leftTeams ?? []).toHaveLength(0);
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  expect((users?.users ?? []).filter(u => (u.email ?? '').startsWith(`${MARK}-`))).toHaveLength(0);
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}

async function apiGet(page: Page, url: string) {
  const res = await page.request.get(url, { timeout: 60_000 });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status(), body };
}

const base = () => `/api/coaches/${ORG_SLUG}/teams/${teamId}`;
const ser = (b: unknown) => JSON.stringify(b ?? {});

// ── The blindfold, both ways round ────────────────────────────────────────────

test.describe('the blindfold is enforced on the server', () => {
  test.afterEach(async () => { await setBlind(true); });

  test('candidate MEMORY refuses to assemble while blind, and says so', async ({ page }) => {
    await setBlind(true);
    await signIn(page, HEAD_EMAIL);

    const res = await apiGet(page, `${base()}/tryout-memory`);
    expect(res.status).toBe(200);
    // Told plainly — not handed an empty map it might misread as "this child has no history".
    expect((res.body as { blind?: boolean }).blind).toBe(true);
    expect(ser(res.body)).not.toContain(CANDIDATE_FIRST);
    expect(ser(res.body)).not.toContain(CANDIDATE_LAST);
  });

  test('...and DOES assemble once names are revealed — so the check above is not vacuous', async ({ page }) => {
    await setBlind(false);
    await signIn(page, HEAD_EMAIL);

    const res = await apiGet(page, `${base()}/tryout-memory`);
    expect(res.status).toBe(200);
    // The blindfold is the ONLY thing that was withholding this. If `blind` is still true with
    // `is_anonymous = false`, the route is refusing for some unrelated reason and the probe above
    // proved nothing.
    expect((res.body as { blind?: boolean }).blind).toBe(false);
  });

  test('the live SCOREBOARD carries no name while blind — a bib is just a bib', async ({ page }) => {
    await setBlind(true);
    await signIn(page, HEAD_EMAIL);

    const res = await apiGet(page, `${base()}/tryout-scoreboard`);
    expect(res.status).toBe(200);
    expect((res.body as { blind?: boolean }).blind).toBe(true);
    expect(ser(res.body)).not.toContain(CANDIDATE_FIRST);
    expect(ser(res.body)).not.toContain(CANDIDATE_LAST);
    expect(ser(res.body)).not.toContain(CANDIDATE_GUARDIAN);
    // Not vacuous: the candidate IS on the board, under their bib.
    expect(ser(res.body)).toContain(BIB);
  });

  test('...and names the candidate once revealed', async ({ page }) => {
    await setBlind(false);
    await signIn(page, HEAD_EMAIL);

    const res = await apiGet(page, `${base()}/tryout-scoreboard`);
    expect(res.status).toBe(200);
    expect(ser(res.body)).toContain(CANDIDATE_FIRST);
  });

  test('CHECK-IN carries no prior-season anything while blind', async ({ page }) => {
    await setBlind(true);
    await signIn(page, HEAD_EMAIL);

    const res = await apiGet(page, `${base()}/tryout-candidates`);
    expect(res.status).toBe(200);
    // Check-in's existing "tried out in {season}" marker is identity only and stays — what must
    // not appear is a prior SCORE or a memory pair.
    const s = ser(res.body);
    expect(s).not.toContain('priorScore');
    expect(s).not.toContain('memory');
    expect(s).toContain(BIB); // not vacuous
  });

  test("⚠ the full-detail export's name×score×decision mapping never leaves the server while blind", async ({ page }) => {
    await setBlind(true);
    await signIn(page, HEAD_EMAIL);

    const res = await apiGet(page, `${base()}/tryout-report`);
    expect(res.status).toBe(200);
    const body = res.body as { report?: { candidateRows?: unknown } };
    // The ledger's step: "While names are still hidden it must be UNAVAILABLE — not merely warned
    // about." Unavailable means the rows are not in the payload at all.
    expect(body.report?.candidateRows ?? null).toBeNull();
    expect(ser(res.body)).not.toContain(CANDIDATE_FIRST);
  });

  test('...and the export becomes available once names are revealed', async ({ page }) => {
    await setBlind(false);
    await signIn(page, HEAD_EMAIL);

    const res = await apiGet(page, `${base()}/tryout-report`);
    expect(res.status).toBe(200);
    const body = res.body as { report?: { candidateRows?: unknown } };
    expect(body.report?.candidateRows ?? null).not.toBeNull();
  });
});

// ── The capability boundary ───────────────────────────────────────────────────

test.describe('an assistant without tryouts access sees no tryout surface', () => {
  const surfaces = [
    'tryout-memory', 'tryout-scoreboard', 'tryout-candidates',
    'tryout-report', 'tryout-overview', 'tryout-decisions',
  ];

  for (const surface of surfaces) {
    test(`${surface} refuses, and the refusal names no child`, async ({ page }) => {
      await signIn(page, NO_TRYOUTS_EMAIL);
      const res = await apiGet(page, `${base()}/${surface}`);
      // This assistant holds money, contacts, notes and documents — everything except tryouts.
      // If any of these returns 200, the grant is not the thing gating candidate PII.
      expect([401, 403, 404]).toContain(res.status);
      expect(ser(res.body)).not.toContain(CANDIDATE_FIRST);
      expect(ser(res.body)).not.toContain(CANDIDATE_GUARDIAN);
    });
  }
});
