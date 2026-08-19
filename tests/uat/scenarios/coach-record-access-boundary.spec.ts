import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { grantMembershipsFromSeasonRows, clearMemberships } from './_coach-membership-fixture';

/**
 * The coach-side RECORD ACCESS boundary — Tier 1 of the owner QA ledger.
 *
 * Three ledger sections converge on one question, so they share one fixture:
 *
 *  §1.5  Player documents & guardian PII gating (LIVE). A signed medical form needs BOTH
 *        `documents` AND `rosterPii`. An assistant holding Documents alone must reach no child's
 *        signed forms — while the TEAM templates, which are about nobody, stay visible.
 *  §1.9c A1 — the roster switch is gone (UNCOMMITTED, the one Tier 1 item not yet live). The
 *        `roster` grant is retired and `hasRecordAccess` took over the job it was doing. Two ways
 *        that could have gone wrong, and both are probed here: it could have QUIETLY WEAKENED the
 *        contacts gate that actually protects something, and it could have NARROWED past practice
 *        plans for ordinary assistants who reached them through the retired switch.
 *  §1.9b The helper's OWN screens. `staff-helper-layout.spec.ts` says in its own header that it
 *        cannot cover these — the harness has one coach fixture and he is a head coach. This file
 *        provisions a real helper and asks the ledger's question directly: "paste a roster or
 *        Development URL into their browser — it must refuse, not show a blank page with the data
 *        underneath."
 *
 * ⚠ METHOD. HTTP status and payload assertions only, never screenshots. Every persona is probed
 * from the UNAUTHORIZED direction first: the question is not "does the happy path work" (the owner
 * walks that) but "does the wrong person get a 200 with a child's name in it".
 *
 * ⚠ A VACUOUS PASS IS NOT A PASS. Every "must not contain X" assertion is paired with a positive
 * probe proving the payload was actually populated, because an empty body satisfies every
 * absence assertion ever written. The fixture seeds a player whose only job is to be leakable.
 *
 * Self-provisions via service-role with the `caprec-` marker; pre-cleans, tears down, and ASSERTS
 * the teardown. Error-checks EVERY provisioning insert.
 *
 * Run by FILE PATH, not `-g` — unrelated specs fail at collection with "Cannot find module
 * 'server-only'" and drown the run:
 *   npx playwright test --config playwright.config.ts tests/uat/scenarios/coach-record-access-boundary.spec.ts
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

const MARK = 'caprec';
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';

/** The personas. Each is one bundle of grants and one question. */
const PERSONAS = {
  head:     `${MARK}-head@dev.local`,
  /** Documents but NOT contacts — §1.5's whole point. */
  docs:     `${MARK}-docs@dev.local`,
  /** Documents AND contacts — the same person after the second grant. */
  docsPii:  `${MARK}-docspii@dev.local`,
  /** Money only. A1's motivating case: names beside the amounts, contacts still withheld. */
  money:    `${MARK}-money@dev.local`,
  /** Ordinary assistant on the defaults — the NARROWING risk for past plans. */
  plain:    `${MARK}-plain@dev.local`,
  /** The helper preset — a non-coach adult with children in front of them. */
  helper:   `${MARK}-helper@dev.local`,
  /** A helper carrying a STALE pre-A1 grants row, keys and all. */
  stale:    `${MARK}-stale@dev.local`,
} as const;

/** Grants written to `rep_team_coaches.capabilities`. Mirrors lib/coach-capabilities.ts. */
const GRANTS: Record<keyof typeof PERSONAS, Record<string, unknown> | null> = {
  head: null, // head_coach — no grants object
  docs:    { schedule: true, scheduleManage: false, attendance: false, lineups: false,
             rosterPii: false, notes: false, money: 'off', documents: 'manage',
             announcementsSend: false, tryouts: false, staffChat: false },
  docsPii: { schedule: true, scheduleManage: false, attendance: false, lineups: false,
             rosterPii: true, notes: false, money: 'off', documents: 'manage',
             announcementsSend: false, tryouts: false, staffChat: false },
  money:   { schedule: false, scheduleManage: false, attendance: false, lineups: false,
             rosterPii: false, notes: false, money: 'read', documents: 'off',
             announcementsSend: false, tryouts: false, staffChat: false },
  plain:   { schedule: true, scheduleManage: true, attendance: true, lineups: true,
             rosterPii: false, notes: false, money: 'off', documents: 'off',
             announcementsSend: false, tryouts: false, staffChat: true },
  // HELPER_PRESET, exactly as lib/coach-capabilities.ts defines it post-A1.
  helper:  { schedule: true, scheduleManage: false, attendance: false, lineups: false,
             rosterPii: false, notes: false, money: 'off', documents: 'off',
             announcementsSend: false, tryouts: false, staffChat: false },
  /**
   * ⚠ The pre-A1 shape, stored verbatim. A1 ships no migration and no backfill, so every helper
   * and assistant row written before 2026-08-03 still carries these two keys. The claim under
   * test is that `sanitizeAssistantGrants` drops them and the row simply stops meaning anything —
   * NOT that a stale `roster: 'off'` keeps a door shut or, worse, opens one.
   */
  stale:   { schedule: true, scheduleManage: false, attendance: false, lineups: false,
             roster: 'off', planPlayerNames: true,
             rosterPii: false, notes: false, money: 'off', documents: 'off',
             announcementsSend: false, tryouts: false, staffChat: false },
};

const YEAR = new Date().getFullYear() + 1;

let orgId = '';
let teamId = '';
let liveYearId = '';
let closedYearId = '';
let playerId = '';
let docId = '';
let livePracticeId = '';
let pastPracticeId = '';
const userIds: Record<string, string> = {};

/** The strings that must never reach an unauthorized payload. */
const PLAYER_FIRST = `${MARK}Nadia`;
const PLAYER_LAST = 'Leakcheck';
const GUARDIAN_EMAIL = `${MARK}-guardian@dev.local`;
const DOC_NAME = `${MARK}-medical-consent.pdf`;

async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const marked = (users?.users ?? []).filter(u => (u.email ?? '').startsWith(`${MARK}-`));

  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      const { data: players } = await admin.from('rep_roster_players').select('id').eq('program_year_id', y.id);
      for (const p of players ?? []) {
        await admin.from('rep_player_documents').delete().eq('player_id', p.id);
      }
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

/** Assign a persona to BOTH seasons, so a past-season probe finds them where they were. */
async function assign(userId: string, role: string, grants: Record<string, unknown> | null) {
  for (const yid of [liveYearId, closedYearId]) {
    const { error } = await admin.from('rep_team_coaches').insert({
      program_year_id: yid, team_id: teamId, org_id: orgId,
      user_id: userId, coach_role: role,
      ...(grants ? { capabilities: grants } : {}),
    });
    if (error) throw error;
  }
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org, error: orgErr } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  if (orgErr) throw orgErr;
  orgId = org!.id;

  const { data: team, error: teamErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} record team`, slug: `${MARK}-record-team`, sport: 'softball' })
    .select('id').single();
  if (teamErr) throw teamErr;
  teamId = team!.id;

  const { data: live, error: liveErr } = await admin.from('rep_program_years')
    .insert({ team_id: teamId, org_id: orgId, name: `${MARK} ${YEAR}`, year: YEAR, status: 'active' })
    .select('id').single();
  if (liveErr) throw liveErr;
  liveYearId = live!.id;

  const { data: closed, error: closedErr } = await admin.from('rep_program_years')
    .insert({ team_id: teamId, org_id: orgId, name: `${MARK} ${YEAR - 1}`, year: YEAR - 1, status: 'completed' })
    .select('id').single();
  if (closedErr) throw closedErr;
  closedYearId = closed!.id;

  for (const [key, email] of Object.entries(PERSONAS)) {
    userIds[key] = await makeAccount(email);
    await assign(userIds[key], key === 'head' ? 'head_coach' : 'assistant_coach',
                 GRANTS[key as keyof typeof PERSONAS]);
  }

  // The player whose only job is to be leakable — a name, a guardian address, and a signed form.
  const { data: player, error: playerErr } = await admin.from('rep_roster_players').insert({
    program_year_id: liveYearId, team_id: teamId, org_id: orgId,
    player_first_name: PLAYER_FIRST, player_last_name: PLAYER_LAST,
    guardian_email: GUARDIAN_EMAIL, player_number: '12',
    status: 'active', source: 'admin_manual',
  }).select('id').single();
  if (playerErr) throw playerErr;
  playerId = player!.id;

  const { data: doc, error: docErr } = await admin.from('rep_player_documents').insert({
    player_id: playerId, org_id: orgId, team_id: teamId,
    document_type: 'medical_consent', file_name: DOC_NAME, file_size: 1024,
    storage_path: `${MARK}/consent.pdf`, uploaded_by: userIds.head,
  }).select('id').single();
  if (docErr) throw docErr;
  docId = doc!.id;

  const soon = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
  const past = new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString();

  const { data: lp, error: lpErr } = await admin.from('rep_team_events').insert({
    program_year_id: liveYearId, team_id: teamId, org_id: orgId,
    event_type: 'practice', name: `${MARK} live practice`, starts_at: soon, status: 'scheduled',
  }).select('id').single();
  if (lpErr) throw lpErr;
  livePracticeId = lp!.id;

  const { data: pp, error: ppErr } = await admin.from('rep_team_events').insert({
    program_year_id: closedYearId, team_id: teamId, org_id: orgId,
    event_type: 'practice', name: `${MARK} past practice`, starts_at: past, status: 'scheduled',
  }).select('id').single();
  if (ppErr) throw ppErr;
  pastPracticeId = pp!.id;

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

/**
 * ⚠ Uses `page.request`, NOT an in-page `fetch`. Both carry the session, but an in-page fetch
 * aborts with a bare "Failed to fetch" if the post-login redirect chain is still settling or if
 * the dev server is compiling that route for the first time — and an aborted probe reads as a
 * failed boundary, which is exactly the "a skipped step is not a passed step" trap in reverse.
 */
async function apiGet(page: Page, url: string) {
  const res = await page.request.get(url, { timeout: 60_000 });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status(), body };
}

const base = () => `/api/coaches/${ORG_SLUG}/teams/${teamId}`;
const ser = (b: unknown) => JSON.stringify(b ?? {});

// ── §1.5 · A signed medical form needs BOTH grants ────────────────────────────

test.describe('§1.5 — player documents need Documents AND Contacts', () => {
  test('Documents WITHOUT Contacts reaches no child\'s documents', async ({ page }) => {
    await signIn(page, PERSONAS.docs);

    const list = await apiGet(page, `${base()}/roster/${playerId}/documents`);
    expect(list.status).toBe(403);
    expect(ser(list.body)).not.toContain(DOC_NAME);

    const one = await apiGet(page, `${base()}/roster/${playerId}/documents/${docId}`);
    expect(one.status).toBe(403);
    expect(ser(one.body)).not.toContain(DOC_NAME);
  });

  test('...and cannot WRITE one either — the refusal is not read-only', async ({ page }) => {
    await signIn(page, PERSONAS.docs);
    const res = await page.evaluate(async (u) => {
      const r = await fetch(u, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ docName: 'x.pdf', storagePath: 'x' }),
      });
      return r.status;
    }, `${base()}/roster/${playerId}/documents`);
    expect(res).toBe(403);
  });

  test('the TEAM templates stay visible — they are about nobody', async ({ page }) => {
    await signIn(page, PERSONAS.docs);
    const res = await apiGet(page, `${base()}/documents/templates`);
    expect(res.status).toBe(200);
  });

  test('the player PAGE carries no document name for a Documents-only assistant', async ({ page }) => {
    await signIn(page, PERSONAS.docs);
    const res = await page.goto(`/${ORG_SLUG}/coaches/teams/${teamId}/roster/${playerId}`);
    expect(res?.status()).toBeLessThan(400);

    /**
     * Not vacuous, and not measured mid-load: this assistant DOES have record access, so wait for
     * the player to actually render before asserting what is NOT beside them. Asserting absence on
     * a spinner passes for the wrong reason.
     *
     * ⚠ Anchored on the HEADING, not on `getByText(name)`. The name appears several times in this
     * page's markup and `.first()` resolved to a hidden duplicate, which reported "hidden" and read
     * as a product failure on the first run. It was not one — the page was rendering perfectly.
     */
    await expect(
      page.getByRole('heading', { name: `${PLAYER_FIRST} ${PLAYER_LAST}` }),
    ).toBeVisible({ timeout: 30_000 });

    // The documents section is absent entirely — not an empty box, not a locked one.
    await expect(page.getByRole('heading', { name: /documents/i })).toHaveCount(0);

    const html = await page.content();
    expect(html).not.toContain(DOC_NAME);
    expect(html).not.toContain(GUARDIAN_EMAIL);
  });

  test('granting Contacts as well opens exactly that door', async ({ page }) => {
    await signIn(page, PERSONAS.docsPii);
    const list = await apiGet(page, `${base()}/roster/${playerId}/documents`);
    expect(list.status).toBe(200);
    // Positive proof — the fixture's document is actually there, so the 403 above meant something.
    expect(ser(list.body)).toContain(DOC_NAME);
  });

  test('the head coach is unaffected', async ({ page }) => {
    await signIn(page, PERSONAS.head);
    const list = await apiGet(page, `${base()}/roster/${playerId}/documents`);
    expect(list.status).toBe(200);
    expect(ser(list.body)).toContain(DOC_NAME);
  });
});

// ── §1.9c · A1 — names are baseline, contacts are not ─────────────────────────

test.describe('§1.9c A1 — the roster switch is gone', () => {
  test('a MONEY-ONLY assistant sees names beside the amounts', async ({ page }) => {
    await signIn(page, PERSONAS.money);
    const res = await apiGet(page, `${base()}/roster`);
    expect(res.status).toBe(200);
    // The case that prompted the ruling: this bundle used to render "Player #12".
    expect(ser(res.body)).toContain(PLAYER_FIRST);
    expect(ser(res.body)).toContain(PLAYER_LAST);
  });

  test('⚠ and STILL no contacts — the switch that protects something is untouched', async ({ page }) => {
    await signIn(page, PERSONAS.money);
    const res = await apiGet(page, `${base()}/roster`);
    expect(res.status).toBe(200);
    expect(ser(res.body)).toContain(PLAYER_FIRST);      // not vacuous
    expect(ser(res.body)).not.toContain(GUARDIAN_EMAIL); // the real protection
  });

  test('⚠ an ordinary assistant can still open a PAST practice plan (the narrowing risk)', async ({ page }) => {
    await signIn(page, PERSONAS.plain);
    const res = await apiGet(
      page,
      `${base()}/events/${pastPracticeId}/practice-plan/read?year=${closedYearId}`,
    );
    // Assistants carry notes:false and reached this through the retired switch. Dropping the
    // roster clause without hasRecordAccess would have locked every one of them out.
    expect(res.status).toBe(200);
  });

  test('a stale pre-A1 grants row grants and withholds nothing of its own', async ({ page }) => {
    await signIn(page, PERSONAS.stale);
    // `roster:'off'` + `planPlayerNames:true` are dropped by sanitize. What is left is the helper
    // shape, so the roster must still refuse — the stale keys neither opened nor held a door.
    const roster = await apiGet(page, `${base()}/roster`);
    expect(roster.status).toBe(403);
  });
});

// ── §1.9b · The helper's own screens — never probed before ────────────────────

test.describe('§1.9b — a helper is refused every record surface', () => {
  const refused: [string, () => string][] = [
    ['the roster',            () => `${base()}/roster`],
    ['one player',            () => `${base()}/roster/${playerId}`],
    ['the development board', () => `${base()}/development/board`],
    ['the season review',     () => `${base()}/wrapped`],
    ['attendance',            () => `${base()}/history?section=attendance`],
    ['past practice plans',   () => `${base()}/events/${pastPracticeId}/practice-plan/read?year=${closedYearId}`],
  ];

  for (const [what, url] of refused) {
    test(`${what} refuses, and the refusal carries no child`, async ({ page }) => {
      await signIn(page, PERSONAS.helper);
      const res = await apiGet(page, url());
      expect([401, 403, 404]).toContain(res.status);
      // The ledger's exact worry: "it must refuse, not show a blank page with the data underneath".
      expect(ser(res.body)).not.toContain(PLAYER_FIRST);
      expect(ser(res.body)).not.toContain(GUARDIAN_EMAIL);
    });
  }

  test('but their OWN practice plan still shows names — that must not have regressed', async ({ page }) => {
    await signIn(page, PERSONAS.helper);
    const res = await apiGet(page, `${base()}/events/${livePracticeId}/practice-plan`);
    expect(res.status).toBe(200);
    expect(ser(res.body)).toContain(PLAYER_FIRST);
    // Names yes; the guardian's address no. That is the whole shape of A1 in one payload.
    expect(ser(res.body)).not.toContain(GUARDIAN_EMAIL);
  });

  test('a helper on a CLOSED season meets the finished notice, not the season review', async ({ page }) => {
    await signIn(page, PERSONAS.helper);
    const res = await page.goto(`/${ORG_SLUG}/coaches/teams/${teamId}/season-end?year=${closedYearId}`);
    expect(res?.status()).toBeLessThan(400);

    /**
     * ⚠ This screen is a CLIENT component that renders "Loading..." first, so reading
     * `page.content()` straight after `goto` measures the spinner and reports a false failure.
     * (It did, on the first run of this file.) Wait for the decided state instead.
     */
    await expect(page.getByText('This season has finished')).toBeVisible({ timeout: 30_000 });

    // The regression this work exists to prevent — a season review of other people's children,
    // with a share button on it.
    const html = await page.content();
    expect(html).not.toContain(PLAYER_FIRST);
    expect(html).not.toContain(GUARDIAN_EMAIL);
  });
});
