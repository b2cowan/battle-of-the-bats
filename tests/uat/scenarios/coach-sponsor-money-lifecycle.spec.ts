import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { grantMembershipsFromSeasonRows, clearMemberships } from './_coach-membership-fixture';

/**
 * A SPONSOR'S MONEY, END TO END — pledged → received → pledged again.
 *
 * ⚠⚠ THIS IS THE TEST THAT WOULD HAVE CAUGHT THE WORST FINDING OF THE SPONSORSHIPS REVIEW BEFORE A
 * HUMAN DID. A sponsor's entry is written the moment the sponsor is recorded — it holds the
 * arrangement — but while the sponsor is `pledged` no income has posted and no dues credit exists.
 * Three season-wide readers summed those entries without asking: the Money hub's headline "Money
 * in", Budget vs. Actual's funding ACTUAL, and — worst — the season settlement pot, which is what
 * families are PAID OUT OF, so a promise could have funded a refund of money the team never
 * received. Migration 237's own comment stated the rule; nothing executed it.
 *
 * Nothing automated opened a sponsor at all until this file: the layout sweep opens a FUNDRAISER,
 * which draws a different screen, and every unit test around sponsorships tests a pure function.
 * So this walks the MONEY rather than the markup, through the product's own read endpoints:
 *
 *   1. a PLEDGED sponsor adds nothing to the hub's money in, nothing to Budget vs. Actual's
 *      actual, and nothing to the family's dues — while its record and its amount are plainly
 *      visible, because a pledge is recorded, just not banked;
 *   2. flipping it to RECEIVED moves all three;
 *   3. flipping it BACK to pledged unwinds all three.
 *
 * Step 3 is not symmetry for its own sake: un-posting is the direction that leaves a credit
 * stranded on a family's bill for money that turned back into a promise, and it is the only one
 * with no create-time code path to lean on.
 *
 * Data-level assertions against the real endpoints, signed in as a real coach. Self-provisions via
 * service-role with the `sponmoney-` marker; pre-cleans, tears down, and ASSERTS the teardown.
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

/**
 * ⚠ REFUSES TO RUN AGAINST PRODUCTION.
 *
 * Most UAT specs in this repo trust `.env.local` to point at dev. This one writes MONEY — an
 * accounting income row, a dues credit on a family's bill — and then deletes it, so a mis-pointed
 * env here does not just leave litter, it moves real numbers on a real team and then removes the
 * evidence. The seed scripts already carry this guard (`scripts/seed-demo-coach.mjs`); a spec with
 * money-write side effects has at least as much claim to it.
 */
const PROD_PROJECT_REF = 'qcttcboqysynwcdyghil';
if ((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(PROD_PROJECT_REF)) {
  throw new Error(
    'coach-sponsor-money-lifecycle.spec.ts refuses to run: NEXT_PUBLIC_SUPABASE_URL points at PRODUCTION. '
    + 'This spec creates and deletes real income and dues credits. Point .env.local at dev.',
  );
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const MARK = 'sponmoney';
const HEAD_EMAIL = `${MARK}-head@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
const YEAR = new Date().getFullYear() + 3;

/** The sponsor's cheque, and the family's agreed share of it. Round numbers on purpose: every
 *  assertion below is an equality, and a figure that needs rounding to compare is a figure whose
 *  failure message argues about cents instead of about the bug. */
const SPONSOR_AMOUNT = 2000;
const CREDIT_PERCENT = 25;
const CREDIT_DOLLARS = 500;      // 25% of $2,000
const TEAM_KEEPS = 1500;         // what Budget vs. Actual counts: raised less the family's share
/** Budgeted expected sponsorship, so the report has a row to compare an actual against at all. */
const SPONSORSHIP_BUDGET = 2000;

let orgId = '';
let headUserId = '';
let repTeamId = '';
let programYearId = '';
let playerId = '';
let sponsorId = '';

async function cleanup() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const marked = (users?.users ?? []).filter(u => u.email === HEAD_EMAIL);

  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      // ⚠ Order matters and is the same trap the frozen-season fixture documents: an entry points
      // at BOTH a fundraiser and a player, and a dues credit points at an entry. Unwind inwards,
      // or the program-year delete fails silently and only the teardown assertion notices.
      const { data: frs } = await admin.from('rep_fundraisers').select('id').eq('program_year_id', y.id);
      for (const f of frs ?? []) {
        const { data: ens } = await admin.from('rep_fundraiser_entries').select('id').eq('fundraiser_id', f.id);
        for (const e of ens ?? []) await admin.from('rep_dues_credits').delete().eq('fundraiser_entry_id', e.id);
        await admin.from('rep_fundraiser_entries').delete().eq('fundraiser_id', f.id);
      }
      await admin.from('rep_fundraisers').delete().eq('program_year_id', y.id);
      await admin.from('rep_dues_credits').delete().eq('program_year_id', y.id);
      const { data: scheds } = await admin.from('rep_player_dues_schedules').select('id').eq('program_year_id', y.id);
      for (const s of scheds ?? []) await admin.from('rep_player_dues_installments').delete().eq('schedule_id', s.id);
      await admin.from('rep_player_dues_schedules').delete().eq('program_year_id', y.id);
      await admin.from('rep_budget_lines').delete().eq('program_year_id', y.id);
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

/** Every insert error-checked: a silently-missing fixture row makes a green run mean nothing. */
async function insert(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await admin.from(table).insert(row as never).select('id').single();
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
  return (data as { id: string }).id;
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org, error: orgErr } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  if (orgErr) throw orgErr;
  orgId = org!.id;

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: HEAD_EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (userErr) throw userErr;
  headUserId = created.user!.id;
  await insert('organization_members', {
    organization_id: orgId, user_id: headUserId, role: 'coach',
    status: 'active', accepted_at: new Date().toISOString(),
  });

  repTeamId = await insert('rep_teams', {
    org_id: orgId, name: `${MARK} Sponsor 12U`, slug: `${MARK}-sponsor-12u`, sport: 'softball',
  });
  programYearId = await insert('rep_program_years', {
    team_id: repTeamId, org_id: orgId, name: `${MARK} ${YEAR}`, year: YEAR, status: 'active',
  });
  await insert('rep_team_coaches', {
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: headUserId, coach_role: 'head_coach',
  });

  playerId = await insert('rep_roster_players', {
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    player_first_name: `${MARK}Sponsor`, player_last_name: 'Family',
    status: 'active', source: 'admin_manual',
  });

  // A real bill for the credit to land on. Without one the dues assertions would pass on a family
  // that has no dues at all, which proves nothing about a credit.
  const scheduleId = await insert('rep_player_dues_schedules', {
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    player_id: playerId, total_amount: 900,
  });
  // ⚠ `org_id` is NOT NULL on the installment, unlike most child rows here, which inherit scope
  // through their parent. Caught by running this spec for the first time — the fixture built fine
  // in review and fell over on contact with the real constraint, which is the whole argument for
  // never counting an unexecuted test as coverage.
  await insert('rep_player_dues_installments', {
    schedule_id: scheduleId, player_id: playerId, org_id: orgId, team_id: repTeamId,
    installment_number: 1, amount: 900, due_date: `${YEAR}-09-01`,
  });

  // Budgeted EXPECTED SPONSORSHIP — the plan side of the comparison. Without a funding line the
  // report returns `funding: null` and every actual assertion below would be vacuous.
  await insert('rep_budget_lines', {
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    description: `${MARK} expected sponsorship`, total_amount: SPONSORSHIP_BUDGET,
    line_kind: 'sponsorship', sort_order: 0,
  });

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

const api = () => `/api/coaches/${ORG_SLUG}/teams/${repTeamId}`;

/** Call an API as the signed-in browser session and return { status, body }. */
async function call(page: Page, url: string, init?: { method: string; body: unknown }) {
  return page.evaluate(async ({ u, i }) => {
    const res = await fetch(u, i
      ? { method: i.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(i.body) }
      : undefined);
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON error page */ }
    return { status: res.status, body };
  }, { u: url, i: init ?? null });
}

/**
 * The three figures this whole feature turns on, read the way three different screens read them.
 *
 * ⚠ THREE SEPARATE ENDPOINTS ON PURPOSE. The review's finding was not one wrong function — it was
 * one rule that three independent readers had each failed to apply. Asserting them together is
 * what makes a future reader that forgets it fail here rather than in front of a treasurer.
 */
async function moneyPicture(page: Page) {
  const hub = await call(page, `${api()}/money-summary`);
  const bva = await call(page, `${api()}/budget-vs-actual`);
  const dues = await call(page, `${api()}/dues`);
  expect(hub.status, 'money-summary').toBe(200);
  expect(bva.status, 'budget-vs-actual').toBe(200);
  expect(dues.status, 'dues').toBe(200);

  const h = hub.body as {
    moneyIn: { fundraisingRaised: number; total: number };
    fundraisers: { sponsorReceived: number; sponsorPledged: number; sponsorCount: number };
  };
  const b = bva.body as { funding: { budget: number; actual: number } | null };
  // ⚠ The dues row NESTS its player (`player.id`) rather than carrying a flat `playerId` — the
  // fundraiser entries route uses the flat shape, and reading one from the other is what made the
  // first real run of this spec fail. A `find` that misses returns undefined, and `undefined
  // === 0` would have quietly satisfied several of the assertions below, so the lookup asserts
  // itself before any figure is read.
  const d = dues.body as { players: { player: { id: string }; totalCredits: number }[] };
  const family = d.players.find(p => p.player.id === playerId);
  expect(family, 'the fixture family must be on the dues list at all').toBeTruthy();

  return {
    hubMoneyIn: h.moneyIn.fundraisingRaised,
    hubSponsorReceived: h.fundraisers.sponsorReceived,
    hubSponsorPledged: h.fundraisers.sponsorPledged,
    hubSponsorCount: h.fundraisers.sponsorCount,
    bvaFundingActual: b.funding?.actual ?? null,
    bvaFundingBudget: b.funding?.budget ?? null,
    familyCredits: family!.totalCredits,
  };
}

test.describe('a sponsor’s money follows its status, in every reader', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('pledged records the arrangement and banks nothing; received banks it; back unwinds it', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    // ── Baseline. Asserted rather than assumed: if the fixture already carried money, every
    // "unchanged" assertion below would be comparing two wrong numbers to each other.
    const before = await moneyPicture(page);
    expect(before.hubMoneyIn, 'a fresh season has raised nothing').toBe(0);
    expect(before.bvaFundingBudget, 'the expected-sponsorship line must be in the plan').toBe(SPONSORSHIP_BUDGET);
    expect(before.bvaFundingActual).toBe(0);
    expect(before.familyCredits).toBe(0);

    // ── 1. PLEDGED ────────────────────────────────────────────────────────────────────────────
    const created = await call(page, `${api()}/fundraisers`, {
      method: 'POST',
      body: {
        kind: 'sponsor',
        name: `${MARK} Pledged Sponsor`,
        sponsorStatus: 'pledged',
        sponsorAmount: SPONSOR_AMOUNT,
        broughtInById: playerId,
        creditValue: CREDIT_PERCENT,
        creditUnit: 'percent',
      },
    });
    expect(created.status, 'a coach with money-write may record a sponsor').toBe(201);
    sponsorId = (created.body as { fundraiser: { id: string } }).fundraiser.id;

    const pledged = await moneyPicture(page);
    // The record EXISTS and states its amount — a pledge is recorded, it is simply not banked.
    expect(pledged.hubSponsorCount, 'the sponsor is on the books as a record').toBe(1);
    expect(pledged.hubSponsorPledged, 'and its amount is visible as a PROMISE').toBe(SPONSOR_AMOUNT);
    // …and moves nothing that means "money we have".
    expect(pledged.hubMoneyIn, 'a pledge is not money in').toBe(0);
    expect(pledged.hubSponsorReceived, 'a pledge has not arrived').toBe(0);
    expect(pledged.bvaFundingActual, 'a pledge is not an actual against the plan').toBe(0);
    expect(pledged.familyCredits, 'a pledge credits nobody — the cheque has not come').toBe(0);

    // The belt, one level below the readers: no credit ROW may exist yet. A reader could be fixed
    // while the writer still creates the credit, which is the same bug wearing the other face.
    const { data: earlyCredits } = await admin.from('rep_dues_credits')
      .select('id').eq('program_year_id', programYearId);
    expect(earlyCredits ?? [], 'no dues credit is written for a pledge').toHaveLength(0);

    // ── 2. RECEIVED ───────────────────────────────────────────────────────────────────────────
    const received = await call(page, `${api()}/fundraisers/${sponsorId}`, {
      method: 'PATCH',
      body: { sponsorStatus: 'received', sponsorAmount: SPONSOR_AMOUNT },
    });
    expect(received.status).toBe(200);

    const banked = await moneyPicture(page);
    expect(banked.hubMoneyIn, 'the cheque landed: it is money in').toBe(SPONSOR_AMOUNT);
    expect(banked.hubSponsorReceived).toBe(SPONSOR_AMOUNT);
    expect(banked.hubSponsorPledged, 'and it is no longer a promise').toBe(0);
    // The actual against an expected-funding line is the TEAM'S SHARE — everything that arrived,
    // less what was rebated to the family, because that rebate already lowers their own dues.
    expect(banked.bvaFundingActual, 'the report counts what the team KEPT').toBe(TEAM_KEEPS);
    expect(banked.familyCredits, 'the family who brought it in is credited their share').toBe(CREDIT_DOLLARS);

    // ── 3. BACK TO PLEDGED ────────────────────────────────────────────────────────────────────
    // The direction with no create-time path to lean on, and the one that strands a credit on a
    // real family's bill for money the team no longer has.
    const unwound = await call(page, `${api()}/fundraisers/${sponsorId}`, {
      method: 'PATCH',
      body: { sponsorStatus: 'pledged', sponsorAmount: SPONSOR_AMOUNT },
    });
    expect(unwound.status).toBe(200);

    const after = await moneyPicture(page);
    expect(after.hubMoneyIn, 'un-receiving takes it back off the books').toBe(0);
    expect(after.hubSponsorReceived).toBe(0);
    expect(after.hubSponsorPledged, 'it is a promise again, and says so').toBe(SPONSOR_AMOUNT);
    expect(after.bvaFundingActual, 'and off the report').toBe(0);
    expect(after.familyCredits, '⚠ and OFF THE FAMILY’S BILL — the credit must not be stranded').toBe(0);

    const { data: leftCredits } = await admin.from('rep_dues_credits')
      .select('id').eq('program_year_id', programYearId);
    expect(leftCredits ?? [], 'no credit row survives the un-receive').toHaveLength(0);
  });

  test('the per-player drive endpoints refuse a sponsor rather than posting its money twice', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    // These two routes predate sponsors and enforce a DRIVE's rules only. Pointed at a sponsor by
    // a coach who legitimately holds money-write they would post real income and write a real dues
    // credit for a sponsorship still marked pledged, and add a second entry to a record every
    // sponsor read assumes has exactly one. Fixed in review; pinned here because the fix lives in
    // two files a later refactor could easily merge back into the drive path.
    const logged = await call(page, `${api()}/fundraisers/${sponsorId}/entries`, {
      method: 'POST',
      body: { playerId, amountRaised: 50 },
    });
    expect(logged.status, 'a sponsor is one amount on the sponsor, never logged per player').toBe(400);

    const { data: entries } = await admin.from('rep_fundraiser_entries')
      .select('id').eq('fundraiser_id', sponsorId);
    expect(entries ?? [], 'a sponsor still has exactly ONE entry').toHaveLength(1);
  });
});
