import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { grantMembershipsFromSeasonRows, clearMemberships } from './_coach-membership-fixture';

/**
 * A SPONSOR'S MONEY, END TO END — promise → first cheque → second cheque → undone, cheque by
 * cheque (rewritten for ARRIVALS, mig 268 / owner rulings Q12+Q16 2026-08-28: the pledge lives on
 * the record, an entry means money that arrived, the credit is a plan of family shares earning as
 * each cheque lands, and status is DERIVED — the old hand flip is a pinned 409 below).
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

/** The sponsor's promise, its two cheques, and the family's agreed share. Round numbers on
 *  purpose: every assertion below is an equality, and a figure that needs rounding to compare is
 *  a figure whose failure message argues about cents instead of about the bug.
 *
 *  ⚠ ARRIVALS (mig 268, owner ruling Q12 2026-08-28): the pledge lives on the record
 *  (`pledged_amount`) and an entry means money that ARRIVED — dated, several per sponsor. The
 *  lifecycle this spec walks is therefore no longer a status flip: it is promise → first cheque
 *  → second cheque → undo → undo, with every reader asked at every step. Arrival dates are fixed
 *  PAST dates — the writer refuses a future arrival, and "today" computed in the wrong timezone
 *  is a flake this suite has met before. */
const SPONSOR_AMOUNT = 2000;
const CREDIT_PERCENT = 25;
const ARRIVAL_1 = 800;
const ARRIVAL_2 = 1200;
const ARRIVAL_1_DATE = '2026-01-10';
const ARRIVAL_2_DATE = '2026-02-10';
const CREDIT_1 = 200;            // 25% of the first cheque
const CREDIT_DOLLARS = 500;      // 25% of the full $2,000, once both cheques land
const TEAM_KEEPS_1 = 600;        // Budget vs. Actual after one cheque: 800 arrived − 200 rebated
const TEAM_KEEPS = 1500;         // and after both: raised less the family's share
/** Budgeted expected sponsorship, so the report has a row to compare an actual against at all. */
const SPONSORSHIP_BUDGET = 2000;

let orgId = '';
let headUserId = '';
let repTeamId = '';
let programYearId = '';
let playerId = '';
let sponsorId = '';

async function cleanup() {
  // Page through rather than trusting page 1 — cheap robustness against a growing dev DB.
  const marked: { id: string }[] = [];
  for (let page = 1; page <= 25; page++) {
    const { data: users } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const batch = users?.users ?? [];
    marked.push(...batch.filter(u => u.email === HEAD_EMAIL));
    if (batch.length < 200) break;
  }

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
      // Payouts too: the guarded-delete tests below write one to prove the payout floor refuses,
      // and a surviving payout row keeps its player undeletable.
      await admin.from('rep_dues_payouts').delete().eq('program_year_id', y.id);
      // And payments (QA §123: the reconcile tests record real receipts) — same reason.
      await admin.from('rep_dues_payments').delete().eq('program_year_id', y.id);
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
    /* ⚠ THE BOOKS OUTLIVE THE TEAMS (found 2026-08-30, the first run after §123's tests recorded
       real dues payments): a removed payment VOIDS its ledger entry rather than deleting it — the
       books only grow — so accounting rows stamped created_by=this user survive every table wipe
       above, their FK blocks auth deleteUser, and the failure was SILENT (unchecked), stranding
       the user so every later run collided at createUser. Fixture rows in a fixture ledger:
       delete them, then delete the user, and THROW if that fails rather than hiding it again. */
    await admin.from('accounting_entries').delete().eq('created_by', u.id);
    const { error: delUserErr } = await admin.auth.admin.deleteUser(u.id);
    if (delUserErr) throw new Error(`fixture user could not be deleted (${delUserErr.message}) — later runs will collide at createUser`);
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

test.describe('a sponsor’s money follows its arrivals, in every reader', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a pledge banks nothing; each arrival banks its share; undoing unwinds, cheque by cheque', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    // ── Baseline. Asserted rather than assumed: if the fixture already carried money, every
    // "unchanged" assertion below would be comparing two wrong numbers to each other.
    const before = await moneyPicture(page);
    expect(before.hubMoneyIn, 'a fresh season has raised nothing').toBe(0);
    expect(before.bvaFundingBudget, 'the expected-sponsorship line must be in the plan').toBe(SPONSORSHIP_BUDGET);
    expect(before.bvaFundingActual).toBe(0);
    expect(before.familyCredits).toBe(0);

    // ── 1. THE PROMISE ────────────────────────────────────────────────────────────────────────
    const created = await call(page, `${api()}/fundraisers`, {
      method: 'POST',
      body: {
        kind: 'sponsor',
        name: `${MARK} Pledged Sponsor`,
        sponsorStatus: 'pledged',
        sponsorAmount: SPONSOR_AMOUNT,
        // Q16: the credit is a PLAN of family rows — this is the array shape both doors send.
        creditPlan: [{ playerId, value: CREDIT_PERCENT, unit: 'percent' }],
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

    // The belt, one level below the readers (mig 268 sharpened it): a pledge has NO entry rows
    // at all — an entry means money that arrived — and therefore no credit rows either.
    const { data: pledgeEntries } = await admin.from('rep_fundraiser_entries')
      .select('id').eq('fundraiser_id', sponsorId);
    expect(pledgeEntries ?? [], 'a pledge writes ZERO entries — the promise lives on the record').toHaveLength(0);
    const { data: earlyCredits } = await admin.from('rep_dues_credits')
      .select('id').eq('program_year_id', programYearId);
    expect(earlyCredits ?? [], 'no dues credit is written for a pledge').toHaveLength(0);

    // ── 2. STATUS IS DERIVED — the old flip is refused with directions ───────────────────────
    const flipped = await call(page, `${api()}/fundraisers/${sponsorId}`, {
      method: 'PATCH',
      body: { sponsorStatus: 'received' },
    });
    expect(flipped.status, 'status follows the money — a hand flip is refused').toBe(409);
    expect((flipped.body as { code?: string }).code).toBe('SPONSOR_STATUS_IS_DERIVED');

    // ── 3. THE FIRST CHEQUE ───────────────────────────────────────────────────────────────────
    const first = await call(page, `${api()}/fundraisers/${sponsorId}/arrivals`, {
      method: 'POST',
      body: { amount: ARRIVAL_1, receivedDate: ARRIVAL_1_DATE, method: 'cheque' },
    });
    expect(first.status, 'an arrival is recorded against the sponsor').toBe(201);
    const firstEntryId = (first.body as { entryId: string }).entryId;

    const partPaid = await moneyPicture(page);
    expect(partPaid.hubMoneyIn, 'the first cheque is money in').toBe(ARRIVAL_1);
    expect(partPaid.hubSponsorReceived).toBe(ARRIVAL_1);
    expect(partPaid.hubSponsorPledged, 'the promise shrinks to what is STILL TO COME').toBe(SPONSOR_AMOUNT - ARRIVAL_1);
    // The actual against an expected-funding line is the TEAM'S SHARE — everything that arrived,
    // less what was rebated to the family, because that rebate already lowers their own dues.
    expect(partPaid.bvaFundingActual, 'the report counts what the team KEPT of what ARRIVED').toBe(TEAM_KEEPS_1);
    expect(partPaid.familyCredits, 'the family earns their share of THIS cheque, not of the promise').toBe(CREDIT_1);

    // ── 4. THE SECOND CHEQUE keeps the pledge in full ────────────────────────────────────────
    const second = await call(page, `${api()}/fundraisers/${sponsorId}/arrivals`, {
      method: 'POST',
      body: { amount: ARRIVAL_2, receivedDate: ARRIVAL_2_DATE, method: 'etransfer' },
    });
    expect(second.status).toBe(201);
    const secondEntryId = (second.body as { entryId: string }).entryId;

    const banked = await moneyPicture(page);
    expect(banked.hubMoneyIn, 'both cheques landed: the full promise is money in').toBe(SPONSOR_AMOUNT);
    expect(banked.hubSponsorReceived).toBe(SPONSOR_AMOUNT);
    expect(banked.hubSponsorPledged, 'nothing is still to come').toBe(0);
    expect(banked.bvaFundingActual, 'the report counts what the team KEPT').toBe(TEAM_KEEPS);
    expect(banked.familyCredits, 'the family’s credit reaches their full agreed share').toBe(CREDIT_DOLLARS);

    const { data: bothEntries } = await admin.from('rep_fundraiser_entries')
      .select('id, received_date').eq('fundraiser_id', sponsorId);
    expect(bothEntries ?? [], 'two arrivals, two entries').toHaveLength(2);
    expect((bothEntries ?? []).every(e => !!e.received_date), 'every arrival knows its day').toBe(true);

    // ── 5. UNDO, CHEQUE BY CHEQUE — the direction with no create-time path to lean on ────────
    const undoSecond = await call(page, `${api()}/fundraisers/${sponsorId}/arrivals/${secondEntryId}`, {
      method: 'DELETE', body: undefined,
    });
    expect(undoSecond.status, 'an arrival can be undone').toBe(200);

    const backToOne = await moneyPicture(page);
    expect(backToOne.hubMoneyIn, 'the second cheque is off the books').toBe(ARRIVAL_1);
    expect(backToOne.hubSponsorPledged, 'and its amount is a promise again').toBe(SPONSOR_AMOUNT - ARRIVAL_1);
    expect(backToOne.familyCredits, 'the family keeps only the first cheque’s share').toBe(CREDIT_1);

    const undoFirst = await call(page, `${api()}/fundraisers/${sponsorId}/arrivals/${firstEntryId}`, {
      method: 'DELETE', body: undefined,
    });
    expect(undoFirst.status).toBe(200);
    expect((undoFirst.body as { nowPledged?: boolean }).nowPledged,
      'undoing the LAST arrival returns the sponsor to a pledge').toBe(true);

    const after = await moneyPicture(page);
    expect(after.hubMoneyIn, 'un-arriving takes it all back off the books').toBe(0);
    expect(after.hubSponsorReceived).toBe(0);
    expect(after.hubSponsorPledged, 'it is a full promise again, and says so').toBe(SPONSOR_AMOUNT);
    expect(after.bvaFundingActual, 'and off the report').toBe(0);
    expect(after.familyCredits, '⚠ and OFF THE FAMILY’S BILL — the credit must not be stranded').toBe(0);

    const { data: leftCredits } = await admin.from('rep_dues_credits')
      .select('id').eq('program_year_id', programYearId);
    expect(leftCredits ?? [], 'no credit row survives the unwind').toHaveLength(0);
    const { data: leftEntries } = await admin.from('rep_fundraiser_entries')
      .select('id').eq('fundraiser_id', sponsorId);
    expect(leftEntries ?? [], 'no arrival row survives it either').toHaveLength(0);
  });

  test('the per-player drive endpoints refuse a sponsor rather than posting its money twice', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);
    // These two routes predate sponsors and enforce a DRIVE's rules only. Pointed at a sponsor by
    // a coach who legitimately holds money-write they would post real income and write a real dues
    // credit against a sponsorship — outside the arrivals writer and its payout floor entirely.
    // Fixed in review; pinned here because the fix lives in two files a later refactor could
    // easily merge back into the drive path.
    const logged = await call(page, `${api()}/fundraisers/${sponsorId}/entries`, {
      method: 'POST',
      body: { playerId, amountRaised: 50 },
    });
    expect(logged.status, 'a sponsor’s money moves through arrivals, never logged per player').toBe(400);

    const { data: entries } = await admin.from('rep_fundraiser_entries')
      .select('id').eq('fundraiser_id', sponsorId);
    expect(entries ?? [], 'and no entry appeared — the sponsor is still a clean pledge').toHaveLength(0);
  });
  /**
   * ── GUARDED DELETES (sponsors Q14 + drives R5-A, owner-ruled 2026-08-30) ────────────────────
   *
   * ⚠⚠ THE POINT OF THESE IS THE REFUSAL, NOT THE DELETE. `rep_fundraiser_entries` is ON DELETE
   * CASCADE from `rep_fundraisers`, so an unguarded delete here would take every arrival and
   * every player entry with it — and NOT their income rows, which hang off the entries by a SET
   * NULL link and would be left standing with nothing to explain them. The 409s below are the
   * only thing between a mis-tap and that state, so each one is asserted with the rows still
   * present afterwards: a guard that refuses AFTER writing is not a guard.
   */
  test('a sponsor holding cheques refuses to be deleted; emptied of them, the pledge deletes clean', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    // Put one cheque back on the books so there is something to refuse over.
    const arrival = await call(page, `${api()}/fundraisers/${sponsorId}/arrivals`, {
      method: 'POST',
      body: { amount: ARRIVAL_1, receivedDate: ARRIVAL_1_DATE, method: 'cheque' },
    });
    expect(arrival.status).toBe(201);
    const entryId = (arrival.body as { entryId: string }).entryId;

    const refused = await call(page, `${api()}/fundraisers/${sponsorId}`, { method: 'DELETE', body: undefined });
    expect(refused.status, 'money on the books refuses the delete').toBe(409);
    const refusalBody = refused.body as { code?: string; error?: string; entryCount?: number };
    expect(refusalBody.code).toBe('FUNDRAISER_HAS_MONEY');
    expect(refusalBody.entryCount, 'and says how many arrivals stand in the way').toBe(1);
    expect(refusalBody.error, 'the refusal names the dollars, never a bare "cannot"').toContain('800.00');

    // ⚠ NOTHING WAS TOUCHED BY THE REFUSAL. This is the assertion that would catch a guard moved
    // below the delete in some later tidy-up.
    const { data: survivors } = await admin.from('rep_fundraisers').select('id').eq('id', sponsorId);
    expect(survivors ?? [], 'the sponsor is still there').toHaveLength(1);
    const stillBanked = await moneyPicture(page);
    expect(stillBanked.hubMoneyIn, 'and its money is still on the books').toBe(ARRIVAL_1);

    // The way out the refusal names: undo the arrival from the row.
    const undone = await call(page, `${api()}/fundraisers/${sponsorId}/arrivals/${entryId}`, {
      method: 'DELETE', body: undefined,
    });
    expect(undone.status).toBe(200);

    const deleted = await call(page, `${api()}/fundraisers/${sponsorId}`, { method: 'DELETE', body: undefined });
    expect(deleted.status, 'an empty promise deletes on a plain confirm').toBe(200);

    const { data: gone } = await admin.from('rep_fundraisers').select('id').eq('id', sponsorId);
    expect(gone ?? [], 'the record is gone').toHaveLength(0);
    const { data: planLeft } = await admin.from('rep_fundraiser_credit_plan')
      .select('id').eq('fundraiser_id', sponsorId);
    expect(planLeft ?? [], 'and its credit plan went with it').toHaveLength(0);

    const after = await moneyPicture(page);
    expect(after.hubSponsorCount, 'the band is empty again').toBe(0);
    expect(after.familyCredits, 'and no credit was stranded on the family').toBe(0);
  });

  test('a drive entry removes cleanly, and the drive will not go while its leaderboard has rows', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    const made = await call(page, `${api()}/fundraisers`, {
      method: 'POST',
      body: { kind: 'fundraiser', name: `${MARK} bottle drive`, playerRebatePercent: CREDIT_PERCENT },
    });
    expect(made.status).toBe(201);
    const driveId = (made.body as { fundraiser: { id: string } }).fundraiser.id;

    const logged = await call(page, `${api()}/fundraisers/${driveId}/entries`, {
      method: 'POST',
      body: { playerId, amountRaised: ARRIVAL_1, receivedDate: ARRIVAL_1_DATE },
    });
    expect(logged.status, 'a player logs what they raised').toBe(201);

    const raised = await moneyPicture(page);
    expect(raised.hubMoneyIn, 'the drive money is on the books').toBe(ARRIVAL_1);
    expect(raised.familyCredits, 'and the family earned its share').toBe(CREDIT_1);

    const refused = await call(page, `${api()}/fundraisers/${driveId}`, { method: 'DELETE', body: undefined });
    expect(refused.status, 'a drive with entries refuses to be deleted').toBe(409);
    expect((refused.body as { entryCount?: number }).entryCount).toBe(1);

    const { data: stillThere } = await admin.from('rep_fundraiser_entries').select('id').eq('fundraiser_id', driveId);
    expect(stillThere ?? [], '⚠ and the entry SURVIVED the refusal — no silent cascade').toHaveLength(1);
    const entryId = (stillThere ?? [])[0].id as string;
    const { data: entryRow } = await admin.from('rep_fundraiser_entries')
      .select('accounting_entry_id').eq('id', entryId).single();
    const ledgerId = entryRow!.accounting_entry_id as string | null;
    expect(ledgerId, 'the entry posted a real income row').toBeTruthy();

    // The way out the refusal names: remove the entry from the leaderboard.
    const removed = await call(page, `${api()}/fundraisers/${driveId}/entries/${entryId}`, {
      method: 'DELETE', body: undefined,
    });
    expect(removed.status).toBe(200);

    const unwound = await moneyPicture(page);
    expect(unwound.hubMoneyIn, 'the amount came off the books').toBe(0);
    expect(unwound.familyCredits, '⚠ and the credit came off the family — never stranded').toBe(0);
    const { data: ledgerLeft } = await admin.from('accounting_entries').select('id').eq('id', ledgerId!);
    expect(ledgerLeft ?? [], 'and the income row went with it, rather than being orphaned').toHaveLength(0);

    const nowDeleted = await call(page, `${api()}/fundraisers/${driveId}`, { method: 'DELETE', body: undefined });
    expect(nowDeleted.status, 'an empty drive deletes').toBe(200);
    const { data: driveLeft } = await admin.from('rep_fundraisers').select('id').eq('id', driveId);
    expect(driveLeft ?? [], 'the drive is gone').toHaveLength(0);
  });

  test('removing an entry is refused when that family has already been paid out in cash', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    const made = await call(page, `${api()}/fundraisers`, {
      method: 'POST',
      body: { kind: 'fundraiser', name: `${MARK} raffle`, playerRebatePercent: CREDIT_PERCENT },
    });
    const driveId = (made.body as { fundraiser: { id: string } }).fundraiser.id;

    const logged = await call(page, `${api()}/fundraisers/${driveId}/entries`, {
      method: 'POST',
      body: { playerId, amountRaised: ARRIVAL_1, receivedDate: ARRIVAL_1_DATE },
    });
    expect(logged.status).toBe(201);
    const { data: rows } = await admin.from('rep_fundraiser_entries').select('id').eq('fundraiser_id', driveId);
    const entryId = (rows ?? [])[0].id as string;

    // The family has been handed their whole credit back in cash. Removing the entry would leave
    // the books owing them less than they have already received — the payout floor's whole job.
    const payoutId = await insert('rep_dues_payouts', {
      program_year_id: programYearId, player_id: playerId, org_id: orgId, team_id: repTeamId,
      amount: CREDIT_1, paid_date: ARRIVAL_2_DATE, method: 'etransfer',
    });

    const refused = await call(page, `${api()}/fundraisers/${driveId}/entries/${entryId}`, {
      method: 'DELETE', body: undefined,
    });
    expect(refused.status, 'the payout floor refuses the removal').toBe(409);
    expect((refused.body as { code?: string }).code).toBe('CREDIT_HAS_PAYOUT');

    // ⚠⚠ THE REFUSAL CAME BEFORE ANY WRITE. A guard that fires after an irreversible delete
    // strands the record forever, which is why both halves are asserted rather than just the code.
    const { data: entryLeft } = await admin.from('rep_fundraiser_entries').select('id').eq('id', entryId);
    expect(entryLeft ?? [], 'the entry is untouched').toHaveLength(1);
    const { data: creditLeft } = await admin.from('rep_dues_credits').select('id').eq('fundraiser_entry_id', entryId);
    expect(creditLeft ?? [], 'and so is the credit it created').toHaveLength(1);

    // Remove the payout and the same call goes through — the refusal was about the cash, not the row.
    await admin.from('rep_dues_payouts').delete().eq('id', payoutId);
    const allowed = await call(page, `${api()}/fundraisers/${driveId}/entries/${entryId}`, {
      method: 'DELETE', body: undefined,
    });
    expect(allowed.status, 'with the payout gone the removal is allowed').toBe(200);

    await call(page, `${api()}/fundraisers/${driveId}`, { method: 'DELETE', body: undefined });
  });
  /**
   * ⚠⚠ THE CONTRACT THE DRIVE-DELETE GUARD STANDS ON (/review finding, 2026-08-30, High).
   *
   * The leaderboard is built by walking the ACTIVE roster and hanging each player's entry off it,
   * so an entry whose player has since been marked inactive is NOT in `players` — while its row
   * and its dollars are still on the books, and the server's delete still counts it. The first cut
   * of the client guard counted `players`, read ZERO for a drive that had money in it, went live,
   * and promised "no money moves" over a delete the server then refused — pointing at a board that
   * could not show the row.
   *
   * The fix reads `summary.playerCount`, so this test pins the two halves of that contract:
   * the summary counts EVERY entry regardless of roster status, and the board does not.
   */
  test('an inactive player’s entry leaves the leaderboard but never leaves the summary', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    const made = await call(page, `${api()}/fundraisers`, {
      method: 'POST',
      body: { kind: 'fundraiser', name: `${MARK} bake sale`, playerRebatePercent: CREDIT_PERCENT },
    });
    const driveId = (made.body as { fundraiser: { id: string } }).fundraiser.id;
    const logged = await call(page, `${api()}/fundraisers/${driveId}/entries`, {
      method: 'POST',
      body: { playerId, amountRaised: ARRIVAL_1, receivedDate: ARRIVAL_1_DATE },
    });
    expect(logged.status).toBe(201);

    const before = await call(page, `${api()}/fundraisers/${driveId}/entries`);
    expect(before.status).toBe(200);
    const b = before.body as { summary: { playerCount: number; totalRaised: number }; players: { entry: unknown }[] };
    expect(b.summary.playerCount, 'the entry is counted while the player is active').toBe(1);
    expect(b.players.filter(p => p.entry), 'and visible on the board').toHaveLength(1);

    // The ordinary, reversible roster toggle that opens the hole.
    await admin.from('rep_roster_players').update({ status: 'inactive' }).eq('id', playerId);

    const after = await call(page, `${api()}/fundraisers/${driveId}/entries`);
    const a = after.body as { summary: { playerCount: number; totalRaised: number }; players: { entry: unknown }[] };
    expect(a.players.filter(p => p.entry),
      'the board cannot show it — this is the trap').toHaveLength(0);
    expect(a.summary.playerCount,
      '⚠ but the SUMMARY still counts it, which is what the delete guard must read').toBe(1);
    expect(a.summary.totalRaised, 'and its money is still on the books').toBe(ARRIVAL_1);

    // And the server refuses the delete on that hidden entry alone — the client guard and the
    // server guard must agree, or the screen offers a delete that cannot happen.
    const refused = await call(page, `${api()}/fundraisers/${driveId}`, { method: 'DELETE', body: undefined });
    expect(refused.status, 'the drive still refuses to be deleted').toBe(409);
    expect((refused.body as { entryCount?: number }).entryCount).toBe(1);

    // Put the fixture back the way the other tests expect it, then clean up.
    await admin.from('rep_roster_players').update({ status: 'active' }).eq('id', playerId);
    const { data: rows } = await admin.from('rep_fundraiser_entries').select('id').eq('fundraiser_id', driveId);
    await call(page, `${api()}/fundraisers/${driveId}/entries/${(rows ?? [])[0].id}`, { method: 'DELETE', body: undefined });
    await call(page, `${api()}/fundraisers/${driveId}`, { method: 'DELETE', body: undefined });
  });
  /**
   * ⚠⚠ WHY THE REFUSAL CAN SAFELY QUOTE MONEY — the invariant a review challenged.
   *
   * The drive-delete refusal gates on the entry COUNT but names the TOTAL, and a review argued
   * that a $0 entry would make it read "$0.00 logged across 1 entry" — a sentence arguing against
   * itself — because both writers validate the amount as merely non-negative.
   *
   * It cannot happen, and the reason is a table away from the code that looks responsible:
   * `accounting_entries.amount` carries CHECK (amount > 0) (mig 016), and every drive entry posts
   * one. So the DATABASE refuses a zero-amount entry at creation, and refuses an edit down to zero
   * the same way — leaving the original amount untouched, which is the part worth pinning, because
   * a half-applied edit here would be worse than a refused one.
   *
   * This test is the guard on that reasoning. If someone ever relaxes the CHECK, this fails and
   * points at the sentence that would start lying — rather than the sentence quietly starting to.
   */
  test('a zero-amount drive entry cannot be created or edited into', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    const made = await call(page, `${api()}/fundraisers`, {
      method: 'POST',
      body: { kind: 'fundraiser', name: `${MARK} zero drive`, playerRebatePercent: CREDIT_PERCENT },
    });
    const driveId = (made.body as { fundraiser: { id: string } }).fundraiser.id;

    // 1 — Creating one at $0 is refused, and leaves nothing behind.
    const atZero = await call(page, `${api()}/fundraisers/${driveId}/entries`, {
      method: 'POST',
      body: { playerId, amountRaised: 0, receivedDate: ARRIVAL_1_DATE },
    });
    expect(atZero.status, 'the books refuse a $0 income row, so the entry never exists').not.toBe(201);
    const { data: afterZero } = await admin.from('rep_fundraiser_entries').select('id').eq('fundraiser_id', driveId);
    expect(afterZero ?? [], 'and no half-written entry survives the refusal').toHaveLength(0);

    // 2 — A real entry, then an edit down to $0: also refused, amount UNCHANGED.
    const logged = await call(page, `${api()}/fundraisers/${driveId}/entries`, {
      method: 'POST',
      body: { playerId, amountRaised: ARRIVAL_1, receivedDate: ARRIVAL_1_DATE },
    });
    expect(logged.status).toBe(201);
    const { data: rows } = await admin.from('rep_fundraiser_entries').select('id').eq('fundraiser_id', driveId);
    const entryId = (rows ?? [])[0].id as string;

    const toZero = await call(page, `${api()}/fundraisers/${driveId}/entries/${entryId}`, {
      method: 'PATCH', body: { amountRaised: 0 },
    });
    expect(toZero.status, 'editing down to $0 is refused too').not.toBe(200);
    const { data: still } = await admin.from('rep_fundraiser_entries')
      .select('amount_raised').eq('id', entryId).single();
    expect(Number(still!.amount_raised),
      '⚠ and the amount is UNCHANGED — a refused edit must not half-apply').toBe(ARRIVAL_1);

    // 3 — So the refusal always has real money to name. Never "$0.00".
    const refused = await call(page, `${api()}/fundraisers/${driveId}`, { method: 'DELETE', body: undefined });
    expect(refused.status).toBe(409);
    const msg = (refused.body as { error: string }).error;
    expect(msg, 'the figure it quotes is the real one').toContain('800.00');
    expect(msg, 'and it can never be the self-defeating one').not.toContain('$0.00');

    await call(page, `${api()}/fundraisers/${driveId}/entries/${entryId}`, { method: 'DELETE', body: undefined });
    const gone = await call(page, `${api()}/fundraisers/${driveId}`, { method: 'DELETE', body: undefined });
    expect(gone.status, 'emptied, it deletes').toBe(200);
  });
  /**
   * ── MONEY THAT MOVED HAS A DATE IN THE PAST — every door, both layers ───────────────────────
   * (owner-raised 2026-08-30 walking §122: "we at least have to be consistent between types of
   * transactions". Plan: COACH_MONEY_DATE_CONSISTENCY_PLAN.md.)
   *
   * ⚠ THE POINT IS THE SERVER, NOT THE PICKER. Three pickers gained a cap in the same change, and
   * a cap is worth exactly nothing on its own — a typed date, a stale tab or any other caller
   * walks straight past it. These assertions are the half that binds.
   *
   * ⚠ AND THE FORWARD-LOOKING DATES MUST STILL ACCEPT THE FUTURE. A pledge's expected-by is the
   * whole reason the sponsor refusal can hand off to it; if a tidy-up ever caps that too, the
   * refusal starts pointing at a door that no longer opens. Asserted here on purpose.
   */
  test('every money-that-moved door refuses a future date — and the forward-looking ones still take one', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // ── 1. A sponsor cheque dated ahead: refused, and the refusal NAMES the way out.
    const pledge = await call(page, `${api()}/fundraisers`, {
      method: 'POST',
      body: {
        kind: 'sponsor', sponsorStatus: 'pledged', name: `${MARK} date rules`,
        sponsorAmount: 500, creditPlan: [],
      },
    });
    expect(pledge.status).toBe(201);
    const dateSponsorId = (pledge.body as { fundraiser: { id: string } }).fundraiser.id;

    const aheadCheque = await call(page, `${api()}/fundraisers/${dateSponsorId}/arrivals`, {
      method: 'POST',
      body: { amount: 100, receivedDate: tomorrow, method: 'cheque' },
    });
    expect(aheadCheque.status, 'a cheque cannot arrive tomorrow').toBe(400);
    expect((aheadCheque.body as { error: string }).error,
      '⚠ and the refusal hands off to the control that DOES take a future date')
      .toContain('expected-by');

    /* The same money on a date that HAS happened still records — the rule is about the date, not
       the door. Deliberately a fixed past date rather than a computed "today": the server compares
       against the ORG clock, and re-deriving that here in UTC is how a spec starts failing for one
       hour a day in a timezone nobody runs it in. */
    const arrived = await call(page, `${api()}/fundraisers/${dateSponsorId}/arrivals`, {
      method: 'POST',
      body: { amount: 100, receivedDate: ARRIVAL_1_DATE, method: 'cheque' },
    });
    expect(arrived.status, 'a cheque that has arrived still records').toBe(201);

    // ── 2. Income and money back: the server hole this change closed.
    for (const kind of ['income', 'money_back']) {
      const ahead = await call(page, `${api()}/money-in`, {
        method: 'POST',
        body: { kind, amount: 25, receivedDate: tomorrow, description: `${MARK} ahead` },
      });
      expect(ahead.status, `${kind} cannot be dated ahead either`).toBe(400);
      expect((ahead.body as { error: string }).error, 'and it says why in words, not a code')
        .toContain('happened yet');
    }

    // ── 3. ⚠ THE OTHER HALF: a PLEDGE's expected-by must still accept the future.
    const expected = await call(page, `${api()}/fundraisers/${dateSponsorId}`, {
      method: 'PATCH',
      body: { expectedBy: tomorrow },
    });
    expect(expected.status,
      '⚠ a promise is SUPPOSED to point ahead — capping this would break the refusal above').toBe(200);

    // Cleanup: unwind the arrival, then the record.
    const { data: arrivals } = await admin.from('rep_fundraiser_entries').select('id').eq('fundraiser_id', dateSponsorId);
    for (const a of arrivals ?? []) {
      await call(page, `${api()}/fundraisers/${dateSponsorId}/arrivals/${a.id}`, { method: 'DELETE', body: undefined });
    }
    await call(page, `${api()}/fundraisers/${dateSponsorId}`, { method: 'DELETE', body: undefined });
  });
});

/**
 * ── THE RECONCILE COUNTS THE CREDITS IT WRITES, AND BOTH SCHEDULE DOORS ASK THE FLOOR ──────────
 * (QA §123 Phase A — the dues-forms build.)
 *
 * The unit suite pins the pure planner; these walk the SEAM the unit test cannot reach — the real
 * query feeding the real function through the real doors, signed in as a real coach. Both owner-
 * prompt sequences were reachable from either schedule door and invisible on screen; both were
 * found by executing the arithmetic, so both are pinned by executing it here.
 */
test.describe('a family’s overpayment credit follows the schedule, both doors guarded', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  let p2Id = '';
  const P2_FIRST = `${MARK}Reconcile`;

  /** The player's overpayment credit rows, amounts only, for exact-set assertions. */
  async function overpaymentCredits(): Promise<number[]> {
    const { data } = await admin.from('rep_dues_credits')
      .select('amount, credit_type').eq('program_year_id', programYearId).eq('player_id', p2Id);
    return (data ?? []).filter(c => c.credit_type === 'overpayment').map(c => Number(c.amount)).sort((a, b) => a - b);
  }

  const setTotal = (page: Page, total: number) => call(page, `${api()}/dues`, {
    method: 'POST',
    body: { playerId: p2Id, totalAmount: total, installments: [{ installmentNumber: 1, amount: total, dueDate: `${YEAR}-09-01` }] },
  });

  test('lowering twice tops up to the truth, and restoring removes the stale credit (sequence 1 + 2)', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    p2Id = await insert('rep_roster_players', {
      program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
      player_first_name: P2_FIRST, player_last_name: 'Family',
      status: 'active', source: 'admin_manual',
    });

    // The membership gate first (/review 2026-08-30): a player id outside this season must 404,
    // never be written — this door was the one dues write missing the check its siblings make.
    const bogus = await call(page, `${api()}/dues`, {
      method: 'POST',
      body: { playerId: '00000000-0000-0000-0000-000000000000', totalAmount: 100, installments: [{ installmentNumber: 1, amount: 100, dueDate: `${YEAR}-09-01` }] },
    });
    expect(bogus.status, 'a foreign player id is refused, never written').toBe(404);

    // The season as the prompt states it: a $1,200 schedule, paid in full.
    expect((await setTotal(page, 1200)).status).toBe(201);
    const paid = await call(page, `${api()}/players/${p2Id}/dues-payments`, {
      method: 'POST',
      body: { amount: 1200, receivedDate: ARRIVAL_1_DATE, method: 'etransfer' },
    });
    expect(paid.status, 'the family pays the year in full').toBe(201);
    expect(await overpaymentCredits(), 'paid exactly the total: no credit yet').toEqual([]);

    // Lower to $800 → one $400 credit, standalone by design (schedule-change credits carry no
    // payment link, which is exactly why the old query could not see them).
    expect((await setTotal(page, 800)).status).toBe(201);
    expect(await overpaymentCredits()).toEqual([400]);

    // ⚠ SEQUENCE 1 — lower again to $600. The defect stacked a second $600 credit here ($1,000
    // carried for a $600 truth); the fix tops up by the $200 difference — and since the
    // consolidation (owner, 2026-09-01) it tops up the SAME ROW: one credit, not a pile of
    // identical "dues changed" rows that read as a bug.
    expect((await setTotal(page, 600)).status).toBe(201);
    expect(await overpaymentCredits(), 'ONE row at the $600 truth — topped up in place').toEqual([600]);

    // ⚠ The engine's row cannot be deleted (owner, 2026-09-01 — deleting it made $700 of a
    // family's money vanish mid-walk, and the next reconcile would have quietly recreated it).
    const { data: engineRows } = await admin.from('rep_dues_credits')
      .select('id').eq('program_year_id', programYearId).eq('player_id', p2Id).eq('credit_type', 'overpayment');
    const delTry = await call(page, `${api()}/players/${p2Id}/dues-credits/${(engineRows ?? [])[0].id}`, { method: 'DELETE', body: undefined });
    expect(delTry.status, 'the schedule-change credit refuses deletion').toBe(409);
    expect((delTry.body as { code?: string }).code).toBe('CREDIT_FOLLOWS_SCHEDULE');
    expect(await overpaymentCredits(), 'and the row survived the refusal').toEqual([600]);

    // The ownership mark cannot be claimed by hand (review 2026-09-01): a manual credit wearing
    // the engine's exact description would be locked by the 409 above and silently rewritten by
    // the next reconcile — both manual doors refuse the reserved sentence.
    const forge = await call(page, `${api()}/players/${p2Id}/dues-credits`, {
      method: 'POST',
      body: { amount: 50, description: 'Overpayment (dues changed)', creditType: 'overpayment', creditDate: '2026-08-01' },
    });
    expect(forge.status, 'the reserved description is refused at the manual door').toBe(400);

    // ⚠ SEQUENCE 2 — restore to $1,200. The defect left the whole credit standing; the fix
    // removes every overpayment row, because nothing is stranded any more.
    expect((await setTotal(page, 1200)).status).toBe(201);
    expect(await overpaymentCredits(), 'no stale credit survives the restore').toEqual([]);

    // And the drawer agrees: the dues payload shows no credit on this family.
    const dues = await call(page, `${api()}/dues`);
    const fam = (dues.body as { players: { player: { id: string }; totalCredits: number }[] })
      .players.find(p => p.player.id === p2Id);
    expect(fam!.totalCredits).toBe(0);
  });

  test('the per-player door asks the payout floor before writing (Phase A2)', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    // Overpaid by $400, then handed the $400 back in cash — the credit is spoken for.
    expect((await setTotal(page, 800)).status).toBe(201);
    expect(await overpaymentCredits()).toEqual([400]);
    const payoutId = await insert('rep_dues_payouts', {
      program_year_id: programYearId, player_id: p2Id, org_id: orgId, team_id: repTeamId,
      amount: 400, paid_date: ARRIVAL_2_DATE, method: 'etransfer',
    });

    // Raising the total back to $1,200 would make the reconcile delete that credit.
    const refused = await setTotal(page, 1200);
    expect(refused.status, 'the floor refuses, pre-flight').toBe(409);
    expect((refused.body as { code?: string }).code).toBe('CREDIT_HAS_PAYOUT');
    expect((refused.body as { error?: string }).error, 'the refusal names the dollars').toContain('400.00');

    // ⚠ NOTHING WAS WRITTEN. The refusal must come before the upsert — a guard that fires after
    // an irreversible write strands the record forever (the P4 lesson, binding).
    expect(await overpaymentCredits(), 'the credit the payout stands on is untouched').toEqual([400]);
    const { data: sched } = await admin.from('rep_player_dues_schedules')
      .select('total_amount').eq('program_year_id', programYearId).eq('player_id', p2Id).single();
    expect(Number(sched!.total_amount), 'and the schedule total did not move').toBe(800);

    // The way out the refusal names: remove the payout, and the same save goes through.
    await admin.from('rep_dues_payouts').delete().eq('id', payoutId);
    expect((await setTotal(page, 1200)).status).toBe(201);
    expect(await overpaymentCredits(), 'with the cash back, the reconcile claws the credit cleanly').toEqual([]);
  });

  test('the roster-wide re-run refuses the paid-out family BY NAME and completes for everyone else', async ({ page }) => {
    await signIn(page, HEAD_EMAIL);

    // Same standing: overpaid at $800, whole credit handed back in cash.
    expect((await setTotal(page, 800)).status).toBe(201);
    const payoutId = await insert('rep_dues_payouts', {
      program_year_id: programYearId, player_id: p2Id, org_id: orgId, team_id: repTeamId,
      amount: 400, paid_date: ARRIVAL_2_DATE, method: 'etransfer',
    });

    // A team-wide $1,200 re-run. The fixture family writes clean; this family must be refused.
    const run = await call(page, `${api()}/budget-plan/generate-installments`, {
      method: 'POST',
      body: {
        replace: true,
        basis: 'manual',
        installments: [{ installmentNumber: 1, dueDate: `${YEAR}-10-01`, amount: 1200 }],
      },
    });
    expect(run.status, 'the run itself succeeds — a floor refusal never fails the roster').toBe(201);
    const r = run.body as {
      playersProcessed: number; playersSkipped: number; playersFailed: string[];
      payoutFloorRefusals: { name: string; paidOut: number }[];
    };
    expect(r.payoutFloorRefusals, 'the refused family — id, name and the dollars').toEqual(
      [{ playerId: p2Id, name: `${P2_FIRST} Family`, paidOut: 400 }],
    );
    expect(r.playersFailed, 'counted in the failed bucket so the roster still adds up').toContain(`${P2_FIRST} Family`);
    expect(r.playersProcessed + r.playersSkipped + r.playersFailed.length,
      'the route’s own invariant holds').toBe(2);

    // The refused family is untouched: old total, credit still standing.
    const { data: sched } = await admin.from('rep_player_dues_schedules')
      .select('total_amount').eq('program_year_id', programYearId).eq('player_id', p2Id).single();
    expect(Number(sched!.total_amount)).toBe(800);
    expect(await overpaymentCredits()).toEqual([400]);

    // Unwind: payout off, receipts out through their own door (voiding their ledger entries).
    await admin.from('rep_dues_payouts').delete().eq('id', payoutId);
    const { data: pays } = await admin.from('rep_dues_payments')
      .select('id').eq('program_year_id', programYearId).eq('player_id', p2Id);
    for (const p of pays ?? []) {
      const gone = await call(page, `${api()}/players/${p2Id}/dues-payments/${p.id}`, { method: 'DELETE', body: undefined });
      expect(gone.status).toBe(200);
    }
    expect(await overpaymentCredits(), 'removing the receipts reconciles the credit away with them').toEqual([]);
  });
});
