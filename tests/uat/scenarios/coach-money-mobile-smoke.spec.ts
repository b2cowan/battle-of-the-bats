import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { grantMembershipsFromSeasonRows, clearMemberships } from './_coach-membership-fixture';

/**
 * Money on a phone (Coach Portal Chunk A — readiness review P1 #10, #5, f7-6).
 *
 * PERMANENT regression coverage, deliberately kept rather than deleted after the build. What it
 * guards is invisible to unit tests and to code review: whether a fixed-width money column pushes
 * the PAGE sideways at 360px, whether the pinned label survives a scroll, and whether a
 * half-finished budget split can still be binned by a stray backdrop tap. Every one of those is a
 * computed-layout fact, and every one of them regresses silently the moment a column is added.
 *
 * Computed styles / real DOM assertions only — never screenshots
 * (memory/feedback_verify_with_playwright_not_screenshots.md: screenshots previously caused wrong
 * fixes on exactly this class of bug).
 *
 * Self-provisions via service-role, matching the other `*-smoke.spec.ts` files here. Every row
 * carries the `capmoney-` marker; the suite pre-cleans, tears down, and ASSERTS the teardown.
 *
 * ⚠ The portal has an OUTER layout <main> wrapping the phone-hidden sidebar — scope text
 * assertions to `main[class*="coachesMain"]` or a locator matches hidden nav copy.
 * ⚠ Error-check every provisioning insert: a silently-failed one reads downstream as "the feature
 * doesn't work" and costs a whole run (the Batch 4 lesson).
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

const MARK = 'capmoney';
const WRITE_EMAIL = `${MARK}-head@dev.local`;
const READ_EMAIL = `${MARK}-assistant@dev.local`;
const PASSWORD = 'devpass123';
const ORG_SLUG = 'dev-club-org';
/** A true small phone. Narrower than an iPhone SE, so anything that passes here passes everywhere. */
const PHONE = { width: 360, height: 740 };

let orgId = '';
let writeUserId = '';
let readUserId = '';
let repTeamId = '';
let programYearId = '';
let fundraiserId = '';
let allocationId = '';
// Chunk G — a SECOND team with NO budget data: the first-season state the starter exists for.
// The main team above is provisioned WITH lines, so the two must never share a team.
let starterTeamId = '';
let starterYearId = '';

function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function cleanup() {
  const { data: teams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  for (const t of teams ?? []) {
    const { data: years } = await admin.from('rep_program_years').select('id').eq('team_id', t.id);
    for (const y of years ?? []) {
      const { data: lines } = await admin.from('rep_budget_lines').select('id').eq('program_year_id', y.id);
      for (const l of lines ?? []) await admin.from('rep_budget_periods').delete().eq('budget_line_id', l.id);
      await admin.from('rep_budget_lines').delete().eq('program_year_id', y.id);
      const { data: frs } = await admin.from('rep_fundraisers').select('id').eq('program_year_id', y.id);
      for (const f of frs ?? []) await admin.from('rep_fundraiser_entries').delete().eq('fundraiser_id', f.id);
      await admin.from('rep_fundraisers').delete().eq('program_year_id', y.id);
      const { data: splits } = await admin.from('rep_allocation_splits').select('id').eq('program_year_id', y.id);
      for (const s of splits ?? []) await admin.from('rep_allocation_installments').delete().eq('split_id', s.id);
      await admin.from('rep_allocation_splits').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_expenses').delete().eq('program_year_id', y.id);
      await admin.from('rep_roster_players').delete().eq('program_year_id', y.id);
      await admin.from('rep_team_coaches').delete().eq('program_year_id', y.id);
    }
    await admin.from('rep_program_years').delete().eq('team_id', t.id);
    // M1: memberships are team-scoped — clear them before the team row goes, or the
    // FK leaves the team undeletable and it surfaces as the teardown assertion.
    await clearMemberships(admin, t.id);
    await admin.from('rep_teams').delete().eq('id', t.id);
  }
  await admin.from('rep_cost_allocations').delete().like('description', `${MARK}%`);
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of users?.users ?? []) {
    if (u.email === WRITE_EMAIL || u.email === READ_EMAIL) {
      await admin.from('organization_members').delete().eq('user_id', u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

async function makeCoach(email: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (error) throw error;
  const id = created.user!.id;
  // getAuthContext requires the membership row or the portal bounces to /discover.
  const { error: memErr } = await admin.from('organization_members').insert({
    organization_id: orgId, user_id: id, role: 'coach',
    status: 'active', accepted_at: new Date().toISOString(),
  });
  if (memErr) throw memErr;
  return id;
}

test.beforeAll(async () => {
  await cleanup();

  const { data: org, error: orgErr } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  if (orgErr) throw orgErr;
  orgId = org!.id;

  writeUserId = await makeCoach(WRITE_EMAIL);
  readUserId = await makeCoach(READ_EMAIL);

  const { data: team, error: teamErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} Treasury 14U`, slug: `${MARK}-treasury-14u`, sport: 'softball' })
    .select('id').single();
  if (teamErr) throw teamErr;
  repTeamId = team!.id;

  const { data: year, error: yearErr } = await admin.from('rep_program_years')
    .insert({ team_id: repTeamId, org_id: orgId, name: `${MARK} 2026`, year: 2026, status: 'active', budget_amount: 7500 })
    .select('id').single();
  if (yearErr) throw yearErr;
  programYearId = year!.id;

  // coach_role is CHECK-constrained to head_coach|assistant_coach, and the table has no
  // email/name columns. The assistant gets money: 'read' — the capability this suite exists to
  // prove a card reflow doesn't leak past.
  const { error: hcErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: writeUserId, coach_role: 'head_coach',
  });
  if (hcErr) throw hcErr;
  const { error: acErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: programYearId, team_id: repTeamId, org_id: orgId,
    user_id: readUserId, coach_role: 'assistant_coach',
    capabilities: { money: 'read', roster: true, schedule: true },
  });
  if (acErr) throw acErr;

  const { data: players, error: pErr } = await admin.from('rep_roster_players').insert([
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, player_first_name: 'Avery', player_last_name: 'Chen', player_number: '7', status: 'active' },
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, player_first_name: 'Jordan', player_last_name: 'Bell', player_number: '12', status: 'active' },
  ]).select('id');
  if (pErr) throw pErr;

  // ── Budget: a long description (the truncation case) + a line WITH periods, so Budget vs.
  // Actual renders both the 4-column and the 5-column grid families.
  const { data: lines, error: lErr } = await admin.from('rep_budget_lines').insert([
    { org_id: orgId, team_id: repTeamId, program_year_id: programYearId, description: 'Provincial championship entry fee including umpire assessment', total_amount: 4800, sort_order: 0 },
    { org_id: orgId, team_id: repTeamId, program_year_id: programYearId, description: 'Umpire fees', total_amount: 1150, sort_order: 1 },
  ]).select('id');
  if (lErr) throw lErr;
  // Four dated periods summing to the line total. The LAST one is ~3 months out on purpose
  // (chunk H): the month grid needs a month strictly after today's in every run, or the
  // "Difference shows nothing for a month that hasn't happened" assertion is date-dependent.
  // The second line is deliberately left UNDATED — that is the "No date yet" column's case.
  const { error: perErr } = await admin.from('rep_budget_periods').insert([
    { budget_line_id: lines![0].id, period_label: 'First', period_date: day(-40), amount: 1200, sort_order: 0 },
    { budget_line_id: lines![0].id, period_label: 'Second', period_date: day(-10), amount: 1200, sort_order: 1 },
    { budget_line_id: lines![0].id, period_label: 'Third', period_date: day(20), amount: 1200, sort_order: 2 },
    { budget_line_id: lines![0].id, period_label: 'Fourth', period_date: day(80), amount: 1200, sort_order: 3 },
  ]);
  if (perErr) throw perErr;

  // Chunk H2: the first line gets a real category link, so the importer has something to MATCH
  // and the update path is exercised end to end (an unlinked line can only ever be an "add").
  // 'Tournaments' is a platform default (mig 027) and is team-visible.
  const { data: tournamentsCat, error: tcErr } = await admin.from('budget_categories')
    .select('id').eq('name', 'Tournaments').is('org_id', null).maybeSingle();
  if (tcErr) throw tcErr;
  if (tournamentsCat) {
    const { error: linkErr } = await admin.from('rep_budget_lines')
      .update({ category_id: tournamentsCat.id }).eq('id', lines![0].id);
    if (linkErr) throw linkErr;
  }

  // ── Chunk H: a PRIOR season with its own lines, so the comparison column has something to
  // compare. 'Umpire fees' matches this season's line by name; 'Banquet' has no match at all,
  // which is the whole point of the "in last season's plan, not in this one" list. No coach
  // row for this year — a closed ASSIGNMENT would change the team switcher, and this fixture
  // is only about the budget data rollover leaves behind.
  const { data: priorYear, error: pyErr } = await admin.from('rep_program_years')
    .insert({ team_id: repTeamId, org_id: orgId, name: `${MARK} 2025`, year: 2025, status: 'completed' })
    .select('id').single();
  if (pyErr) throw pyErr;
  const { error: plErr } = await admin.from('rep_budget_lines').insert([
    { org_id: orgId, team_id: repTeamId, program_year_id: priorYear!.id, description: 'Umpire fees', total_amount: 900, sort_order: 0 },
    { org_id: orgId, team_id: repTeamId, program_year_id: priorYear!.id, description: 'Banquet', total_amount: 400, sort_order: 1 },
  ]);
  if (plErr) throw plErr;

  // ── Expenses: one paid (no action cell → must not draw a blank card line), one unpaid (action),
  // and a tournament payable with BOTH a deposit and a balance (the two-across split).
  const { error: eErr } = await admin.from('rep_team_expenses').insert([
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, expense_type: 'expense', description: 'Diamond rental — May long weekend', category: 'Umpire fees', amount: 420, expense_paid_at: new Date().toISOString() },
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, expense_type: 'expense', description: 'Umpire fees', category: 'Umpire fees', amount: 275 },
    // ⚠ expense_type is CHECK-constrained to 'expense' | 'tournament_payable' — 'tournament'
    // is silently rejected (cost a run; the error-check is why it surfaced as itself).
    { program_year_id: programYearId, team_id: repTeamId, org_id: orgId, expense_type: 'tournament_payable', description: 'Provincials entry', category: 'Tournaments', amount: 1600, deposit_amount: 800, deposit_due_date: day(-5), balance_amount: 800, balance_due_date: day(30) },
  ]);
  if (eErr) throw eErr;

  // ── Fundraiser with one logged entry (ranked row) and one player without (unranked row).
  const { data: fr, error: frErr } = await admin.from('rep_fundraisers')
    .insert({ org_id: orgId, team_id: repTeamId, program_year_id: programYearId, name: `${MARK} Bottle drive`, player_rebate_percent: 30, is_active: true })
    .select('id').single();
  if (frErr) throw frErr;
  fundraiserId = fr!.id;
  const { error: feErr } = await admin.from('rep_fundraiser_entries').insert({
    fundraiser_id: fundraiserId, org_id: orgId, team_id: repTeamId, player_id: players![0].id,
    amount_raised: 310, rebate_percent: 30, rebate_amount: 93,
  });
  if (feErr) throw feErr;

  // ── Org allocation with an OVERDUE installment (the danger-coloured card) and a future one.
  const { data: alloc, error: aErr } = await admin.from('rep_cost_allocations')
    .insert({ org_id: orgId, description: `${MARK} Ice & facility share`, total_amount: 2400 })
    .select('id').single();
  if (aErr) throw aErr;
  allocationId = alloc!.id;
  const { data: split, error: sErr } = await admin.from('rep_allocation_splits')
    // ⚠ Two CHECKs on this one row, neither guessable: payment_schedule is
    // 'standard' | 'custom' (not 'installments') and split_method is
    // 'percentage' | 'sessions' | 'fixed' (not 'manual').
    .insert({ allocation_id: allocationId, team_id: repTeamId, program_year_id: programYearId, org_id: orgId, amount: 2400, split_method: 'fixed', split_value: 2400, payment_schedule: 'custom' })
    .select('id').single();
  if (sErr) throw sErr;
  const { error: iErr } = await admin.from('rep_allocation_installments').insert([
    { split_id: split!.id, installment_number: 1, amount: 800, due_date: day(-60), paid_at: new Date().toISOString(), org_id: orgId, team_id: repTeamId },
    { split_id: split!.id, installment_number: 2, amount: 800, due_date: day(-7), org_id: orgId, team_id: repTeamId },
    { split_id: split!.id, installment_number: 3, amount: 800, due_date: day(45), org_id: orgId, team_id: repTeamId },
  ]);
  if (iErr) throw iErr;

  // ── Chunk G: the starter team — same two coaches, deliberately NOTHING else. No budget
  // lines and no season envelope, so the page renders the true-empty first-run state.
  const { data: sTeam, error: stErr } = await admin.from('rep_teams')
    .insert({ org_id: orgId, name: `${MARK} Starter 12U`, slug: `${MARK}-starter-12u`, sport: 'softball' })
    .select('id').single();
  if (stErr) throw stErr;
  starterTeamId = sTeam!.id;
  const { data: sYear, error: syErr } = await admin.from('rep_program_years')
    .insert({ team_id: starterTeamId, org_id: orgId, name: `${MARK} Starter 2026`, year: 2026, status: 'active' })
    .select('id').single();
  if (syErr) throw syErr;
  starterYearId = sYear!.id;
  const { error: shcErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: starterYearId, team_id: starterTeamId, org_id: orgId,
    user_id: writeUserId, coach_role: 'head_coach',
  });
  if (shcErr) throw shcErr;
  const { error: sacErr } = await admin.from('rep_team_coaches').insert({
    program_year_id: starterYearId, team_id: starterTeamId, org_id: orgId,
    user_id: readUserId, coach_role: 'assistant_coach',
    capabilities: { money: 'read', roster: true, schedule: true },
  });
  if (sacErr) throw sacErr;

  /**
   * ⚠ M1 MEMBERSHIPS — THE ACCESS TRUTH (owner ruling 2026-08-16, mig 245). Without this every
   * coach above 403s at the first membership-gated route, and the spec fails for a reason that
   * has nothing to do with what it tests. PROJECTED from the season rows rather than restated,
   * so the pair can never disagree — see tests/uat/scenarios/_coach-membership-fixture.ts.
   */
  // ⚠ BOTH teams — the starter team is a second REAL rep team (the no-budget-yet state), and the
  // desktop tall-sheet probe opens its empty state.
  await grantMembershipsFromSeasonRows(admin, repTeamId);
  await grantMembershipsFromSeasonRows(admin, starterTeamId);
});

test.afterAll(async () => {
  await cleanup();
  const { data: leftTeams } = await admin.from('rep_teams').select('id').like('name', `${MARK}%`);
  const { data: leftAllocs } = await admin.from('rep_cost_allocations').select('id').like('description', `${MARK}%`);
  expect(leftTeams ?? []).toHaveLength(0);
  expect(leftAllocs ?? []).toHaveLength(0);
});

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}

const base = () => `/${ORG_SLUG}/coaches/teams/${repTeamId}`;
// The starter team's base — module-scoped (it was Chunk G-local) because the desktop
// tall-sheet test now opens the sample from this team's empty state too.
const sBase = () => `/${ORG_SLUG}/coaches/teams/${starterTeamId}`;

/** Warm a route so a cold Turbopack compile can't be mistaken for a layout failure. */
async function open(page: Page, url: string) {
  await page.goto(url);
  const main = page.locator('main[class*="coachesMain"]');
  await expect(main).toBeVisible({ timeout: 45_000 });
  // Every Money page loads its data client-side and renders "Loading…" until it lands.
  // Waiting for THAT to clear is the deterministic signal; `networkidle` never settles
  // reliably against a dev server (the HMR socket keeps the connection alive) and turned
  // a cold Turbopack compile into a spurious layout failure.
  await expect(main.getByText('Loading…')).toHaveCount(0, { timeout: 45_000 });
}

/** The pass bar: the PAGE never scrolls sideways, whatever a grid does inside its own frame. */
async function expectNoPageScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(
    overflow.scrollWidth - overflow.clientWidth,
    `${label}: page scrolls sideways by ${overflow.scrollWidth - overflow.clientWidth}px`,
  ).toBeLessThanOrEqual(1);
}

/** No money figure may be cut off inside its own box. */
async function expectNoClippedAmounts(page: Page, label: string) {
  const clipped = await page.evaluate(() => {
    const out: string[] = [];
    const main = document.querySelector('main[class*="coachesMain"]');
    if (!main) return out;
    for (const el of Array.from(main.querySelectorAll<HTMLElement>('*'))) {
      if (el.children.length > 0) continue;
      const text = (el.textContent ?? '').trim();
      if (!/^[-+]?\$[\d,]+\.\d{2}$/.test(text)) continue;
      if (el.offsetParent === null) continue;
      if (el.scrollWidth - el.clientWidth > 1) out.push(text);
    }
    return out;
  });
  expect(clipped, `${label}: clipped money figures`).toEqual([]);
}

test.describe('Money on a phone @360x740', () => {
  test.use({ viewport: PHONE });

  test('every Money surface reflows with zero horizontal page scroll and no clipped figures', async ({ page }) => {
    // Visits ten routes; on a cold dev server each one is a first Turbopack compile.
    test.setTimeout(180_000);
    await signIn(page, WRITE_EMAIL);

    const surfaces: Array<[string, string]> = [
      ['Money hub', `${base()}/accounting`],
      ['Season Budget Plan', `${base()}/accounting?section=budget`],
      ['Budget vs. Actual', `${base()}/accounting?section=budget-vs-actual`],
      ['Transactions', `${base()}/accounting?section=transactions`],
      ['Payables', `${base()}/accounting?section=payables`],
      ['Player Dues', `${base()}/accounting?section=dues`],
      ['Fundraisers', `${base()}/accounting?section=fundraisers`],
      ['Fundraiser detail', `${base()}/accounting?section=fundraisers&fundraiser=${fundraiserId}`],
      ['Org Allocations', `${base()}/accounting?section=allocations`],
      ['Payment Requests', `${base()}/accounting?section=payment-requests`],
    ];

    for (const [label, url] of surfaces) {
      await open(page, url);
      await expectNoPageScroll(page, label);
      await expectNoClippedAmounts(page, label);
    }

    // The commitment list is a sub-view of Payables (Money split P1, 2026-08-16) — the tab opens
    // on its Schedule, so this switches to the list the assertions below are about.
    await open(page, `${base()}/accounting?section=payables`);
    const main = page.locator('main[class*="coachesMain"]');
    await main.getByRole('button', { name: /^commitments/i }).click();
    await expect(main.getByText('Provincials entry')).toBeVisible();
    // Both halves of the split are readable, not two ~150px boxes.
    await expect(main.getByText(/mark deposit paid/i)).toBeVisible();
    await expect(main.getByText(/mark balance paid/i)).toBeVisible();
    for (const label of [/mark deposit paid/i, /mark balance paid/i]) {
      const box = await main.getByRole('button', { name: label }).boundingBox();
      expect(box!.width, 'a stacked payable action should span the card').toBeGreaterThan(200);
    }
    await expectNoPageScroll(page, 'Payables — commitments view');
    await expectNoClippedAmounts(page, 'Payables — commitments view');
  });

  test('Budget vs. Actual keeps the comparison: scrolls inside its own frame, first column pinned, hint present', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting?section=budget-vs-actual`);

    // The grid must genuinely overflow at this width — otherwise the rest of this test is vacuous.
    const scroller = page.getByTestId('coach-scrollx').first();
    await expect(scroller).toBeVisible();
    const metrics = await scroller.evaluate((el: HTMLElement) => ({
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: getComputedStyle(el).overflowX,
    }));
    expect(metrics.overflowX).toBe('auto');
    expect(metrics.scrollWidth, 'the comparison grid should overflow at 360px').toBeGreaterThan(metrics.clientWidth + 1);

    // Never a SILENT sideways scroll — the affordance the primitive has always required.
    await expect(page.getByTestId('coach-scrollx-hint')).toBeVisible();

    // Budgeted / Actual / Variance are all still rendered side by side.
    for (const heading of ['Budgeted', 'Actual', 'Variance']) {
      await expect(page.locator('main[class*="coachesMain"]').getByText(heading, { exact: true }).first()).toBeAttached();
    }

    // The line name stays put while the money columns move.
    const pinned = page.locator('[class*="scrollXStickyCell"]').first();
    const before = await pinned.boundingBox();
    await scroller.evaluate((el: HTMLElement) => { el.scrollLeft = 200; });
    await page.waitForFunction(() => true);
    const after = await pinned.boundingBox();
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0)), 'first column should stay pinned while scrolling').toBeLessThanOrEqual(2);
    // …and it is opaque, or the scrolled columns would read through the label.
    const pinBg = await pinned.evaluate((el: HTMLElement) => getComputedStyle(el).backgroundColor);
    expect(pinBg).not.toBe('rgba(0, 0, 0, 0)');

    // The hint retires once it has been acted on (a one-time hint, per the contract).
    await expect(page.getByTestId('coach-scrollx-hint')).toBeHidden();

    // And the page itself still never scrolled.
    await expectNoPageScroll(page, 'Budget vs. Actual after swiping the grid');
  });

  test('a budget period split is full-width and tappable, and a backdrop tap cannot silently bin it', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting?section=budget`);

    await page.getByRole('button', { name: /add line/i }).first().click();
    await page.getByLabel(/total amount/i).fill('4800');
    await page.getByText(/split by period/i).click();

    // Each period field fills the sheet rather than sharing a row three ways.
    const sheet = page.locator('[class*="modal"]').first();
    const periodInputs = sheet.locator('[class*="periodInputRow"] input');
    await expect(periodInputs.first()).toBeVisible();
    const widths = await periodInputs.evaluateAll((els: HTMLElement[]) =>
      els.map(e => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })));
    for (const { w, h } of widths) {
      expect(w, 'a period field should not be a stub at 360px').toBeGreaterThan(200);
      expect(h, 'a period field should meet the touch-target standard').toBeGreaterThanOrEqual(32);
    }
    // The per-period heading and field labels are revealed at this width. The heading text is
    // the DERIVED label (a month like "Sep 2026" since the split-modes work — "Period 1" only
    // survives in names mode), so assert the revealed structure, not a hardcoded name.
    await expect(sheet.locator('[class*="periodGroupNum"]').first()).toBeVisible();

    await page.locator('[class*="periodInputRow"]').first().locator('input').first().fill('May');
    await expectNoPageScroll(page, 'Add Budget Line sheet');

    // ── The guard. NOTE the phone reality: at ≤640 a portal modal is a full-height sheet with
    // NO backdrop to tap (Batch 1's sheet contract), so the way a coach loses work here is the
    // BACK ARROW — which reads as navigation, not destruction. That makes it the more dangerous
    // of the two dismiss paths, not the lesser one. The backdrop case is covered at desktop
    // width in the test below.
    const backArrow = page.getByRole('button', { name: /^back$/i });
    await expect(backArrow).toBeVisible();
    await backArrow.click();

    await expect(page.getByText(/discard this budget line/i)).toBeVisible();
    // It names what is at stake rather than saying "unsaved changes".
    await expect(page.getByText(/payment period/i).first()).toBeVisible();

    // "Keep editing" loses nothing.
    await page.getByRole('button', { name: /keep editing/i }).click();
    await expect(page.getByText(/discard this budget line/i)).toBeHidden();
    await expect(page.getByLabel(/total amount/i)).toHaveValue('4800');
    await expect(page.locator('[class*="periodInputRow"]').first().locator('input').first()).toHaveValue('May');

    // Discarding actually closes it.
    await backArrow.click();
    await page.getByRole('button', { name: /^discard$/i }).click();
    await expect(page.getByLabel(/total amount/i)).toHaveCount(0);
  });

  test('an untouched form still closes silently — a guard with nothing to protect is friction', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting?section=transactions`);

    /* ⚠ THE TOOLBAR BUTTON IS "Add", NOT "Add Expense" — it has been since the one-Add-button
       ruling (2026-08-15), and this selector had gone stale against it: the fixture seeds two
       expenses, so the empty state that DOES say "Add Expense" never renders here. The form's
       own SAVE button names the outcome instead. */
    await page.getByRole('button', { name: /^add$/i }).first().click();
    await expect(page.getByPlaceholder(/diamond rental/i)).toBeVisible();
    await page.getByRole('button', { name: /^back$/i }).click();
    await expect(page.getByText(/discard this expense/i)).toBeHidden();
    await expect(page.getByPlaceholder(/diamond rental/i)).toHaveCount(0);
  });

  test('list-shaped money tables become labelled cards, and empty action cells draw no blank line', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting?section=transactions`);

    // thead is hidden and each cell carries its own label — the Dues card idiom.
    const wrap = page.locator('[class*="tableAsCards"]').first();
    await expect(wrap).toBeVisible();
    expect(await wrap.locator('thead').evaluate((el: HTMLElement) => getComputedStyle(el).display)).toBe('none');
    expect(await wrap.locator('td[data-label]').count()).toBeGreaterThan(0);

    // The PAID expense has no action, so its trailing cell must not be drawn at all.
    const emptyCellsShown = await wrap.locator('td').evaluateAll((cells: HTMLElement[]) =>
      cells.filter(c => (c.textContent ?? '').trim() === '' && getComputedStyle(c).display !== 'none').length);
    expect(emptyCellsShown, 'an empty action cell would render as a blank card line').toBe(0);

    // The action that DOES exist is a real touch target, not a chip.
    const markPaid = wrap.getByRole('button', { name: /mark paid/i }).first();
    const box = await markPaid.boundingBox();
    expect(box!.width, 'the card action should span the card').toBeGreaterThan(200);
  });

  test('a read-only money coach sees the same readable pages with no write affordances', async ({ page }) => {
    await signIn(page, READ_EMAIL);

    // ⚠ ALL money surfaces, not just the ones the mobile work touched: the review found
    // three MORE pages offering write forms a read-only coach's server calls would refuse
    // (Allocations mark-paid, New Fundraiser, fundraiser Settings + log-amount). A page can
    // miss the gate that every row on it has, so the sweep has to be the whole area.
    for (const [label, url] of [
      ['Money hub', `${base()}/accounting`],
      ['Season Budget Plan', `${base()}/accounting?section=budget`],
      ['Budget vs. Actual', `${base()}/accounting?section=budget-vs-actual`],
      ['Transactions', `${base()}/accounting?section=transactions`],
      ['Payables', `${base()}/accounting?section=payables`],
      ['Org Allocations', `${base()}/accounting?section=allocations`],
      ['Fundraisers', `${base()}/accounting?section=fundraisers`],
      ['Fundraiser detail', `${base()}/accounting?section=fundraisers&fundraiser=${fundraiserId}`],
      ['Payment Requests', `${base()}/accounting?section=payment-requests`],
    ] as Array<[string, string]>) {
      await open(page, url);
      await expectNoPageScroll(page, `${label} (read-only)`);
      await expectNoClippedAmounts(page, `${label} (read-only)`);

      const main = page.locator('main[class*="coachesMain"]');
      await expect(
        main.getByRole('button', {
          name: /mark paid|mark deposit paid|mark balance paid|add line|add expense|add a commitment|recategorize|new request|new fundraiser|settings|log amount|edit amount|generate installments|start — about a minute/i,
        }),
        `${label} (read-only): a write affordance the server would refuse`,
      ).toHaveCount(0);

      // The reflow must not leave a card full of blank lines where the buttons were.
      const blanks = await main.locator('[class*="tableAsCards"] td').evaluateAll((cells: HTMLElement[]) =>
        cells.filter(c => (c.textContent ?? '').trim() === '' && getComputedStyle(c).display !== 'none').length);
      expect(blanks, `${label} (read-only): blank card lines where actions were`).toBe(0);
    }
  });

  test('a failed budget-line delete reports inside the dialog — no native browser alert anywhere in Money', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);

    // A native dialog would hang the run; failing loudly here is the point.
    let nativeDialog = '';
    page.on('dialog', async d => { nativeDialog = d.message(); await d.dismiss(); });

    await open(page, `${base()}/accounting?section=budget`);

    // Force the failure the old alert() reported, without depending on a real server-side conflict.
    await page.route('**/budget-plan/lines/**', route =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'This line is used by player installments that have already been generated.' }) })
        : route.fallback());

    // Deleting moved INTO the edit form (owner 2026-08-13): tapping a line is the door —
    // rows carry no trash icon any more — and "Delete line" sits in the form's footer.
    await page.locator('[class*="ledgerRow"]').first().click();
    const deleteLine = page.getByRole('button', { name: /delete line/i });
    await expect(deleteLine).toBeVisible();
    // ⚠ Keyboard, not pointer: the button sits bottom-LEFT of the sticky footer, which on a
    // dev server is exactly where the Next dev-tools badge floats — it intercepts pointer
    // clicks at phone width and UAT always runs against dev. Production has no badge.
    await deleteLine.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/delete budget line/i)).toBeVisible();
    await page.getByRole('button', { name: /^delete$/i }).click();

    // The reason appears in the dialog that is still open, and the dialog stays open —
    // with the edit form intact behind it.
    await expect(page.getByText(/already been generated/i)).toBeVisible();
    await expect(page.getByText(/delete budget line/i)).toBeVisible();
    expect(nativeDialog, 'a native browser dialog fired').toBe('');
  });
});

test.describe('Money forms on a desktop', () => {
  // A backdrop tap only exists ABOVE the content breakpoint — below it a portal modal is a
  // full-height sheet (Batch 1's contract) with nothing behind it to hit, which is why the
  // phone tests above exercise the back arrow instead.
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a backdrop click on a dirty Money form asks before discarding', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting?section=transactions`);

    /* ⚠ THE TOOLBAR BUTTON IS "Add", NOT "Add Expense" — it has been since the one-Add-button
       ruling (2026-08-15), and this selector had gone stale against it: the fixture seeds two
       expenses, so the empty state that DOES say "Add Expense" never renders here. The form's
       own SAVE button names the outcome instead. */
    await page.getByRole('button', { name: /^add$/i }).first().click();
    await page.getByPlaceholder(/diamond rental/i).fill('Bat bag');

    await page.locator('[class*="modalOverlay"]').first().click({ position: { x: 5, y: 5 } });
    await expect(page.getByText(/discard this expense/i)).toBeVisible();
    await page.getByRole('button', { name: /keep editing/i }).click();
    await expect(page.getByPlaceholder(/diamond rental/i)).toHaveValue('Bat bag');
  });

  test('Budget vs. Actual has room for the comparison and no internal scrollbar on a wide screen', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting?section=budget-vs-actual`);

    // f9-2: with the wider page the grid fits, so the scroller never engages and — because the
    // hint is honest about overflow — no swipe is claimed.
    const scroller = page.getByTestId('coach-scrollx').first();
    const metrics = await scroller.evaluate((el: HTMLElement) => ({
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
    }));
    expect(metrics.scrollWidth - metrics.clientWidth, 'no internal scroll on a wide monitor').toBeLessThanOrEqual(1);
    await expect(page.getByTestId('coach-scrollx-hint')).toHaveCount(0);
  });

  test('a tall sheet\'s last content scrolls clear of the sticky footer (Chunk G fix)', async ({ page }) => {
    // Owner QA finding: the shared footer's desktop bottom bleed shortened the scroll
    // extent, pinning the sample/starter's last row under the button bar forever.
    // ⚠ The sample is EMPTY-STATE-ONLY now (owner 2026-08-13) — so this opens it from the
    // starter team, which stays empty until the Chunk G starter test later in this file.
    await signIn(page, WRITE_EMAIL);
    await open(page, `${sBase()}/accounting?section=budget`);
    await page.locator('main[class*="coachesMain"]').getByRole('button', { name: /see a finished example/i }).click();
    const fence = page.getByTestId('sample-budget-fence');
    await expect(fence).toBeVisible();
    const clear = await page.evaluate(() => {
      const fenceEl = document.querySelector('[data-testid="sample-budget-fence"]') as HTMLElement;
      const panel = fenceEl.closest('[class*="modal"]:not([class*="Overlay"])') as HTMLElement;
      const footer = panel.querySelector('[class*="modalFooter"]') as HTMLElement;
      panel.scrollTop = panel.scrollHeight; // max scroll
      const f = fenceEl.getBoundingClientRect();
      const bar = footer.getBoundingClientRect();
      return { fenceBottom: f.bottom, barTop: bar.top };
    });
    expect(clear.fenceBottom, 'last content should clear the sticky footer at max scroll')
      .toBeLessThanOrEqual(clear.barTop + 1);
  });
});

test.describe('The budget starter @360x740 (Chunk G)', () => {
  // These five tests are ORDERED (workers: 1, in-file order): the team starts empty, the
  // guard test discards, the flow test writes the first real lines, and everything after
  // runs against a budget that now exists. Reordering them changes what they prove.
  test.use({ viewport: PHONE });

  test('the blank page becomes three doors, and a dirty starter guards its dismiss', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${sBase()}/accounting?section=budget`);
    const main = page.locator('main[class*="coachesMain"]');

    // The first-run surface leads: starter, sample, and the never-walled manual path.
    // The $0.00 summary banner is suppressed on the true-empty state.
    await expect(page.getByTestId('budget-first-run')).toBeVisible();
    await expect(main.getByRole('button', { name: /start — about a minute/i })).toBeVisible();
    await expect(main.getByRole('button', { name: /see a finished example/i })).toBeVisible();
    await expect(main.getByRole('button', { name: /or add lines yourself/i })).toBeVisible();
    await expect(main.getByText('Total Planned Budget')).toHaveCount(0);
    await expectNoPageScroll(page, 'budget first-run surface');

    // One answered question makes the sheet worth protecting; the phone's dangerous
    // dismiss is the BACK ARROW (the sheet has no backdrop at ≤640 — Chunk A rule).
    await main.getByRole('button', { name: /start — about a minute/i }).click();
    const sheet = page.locator('[class*="modalOverlay"]').first();
    await expect(sheet.getByText(/step 1 of 2/i)).toBeVisible();
    await sheet.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: /^back$/i }).click();
    await expect(page.getByText(/discard this starting budget/i)).toBeVisible();
    await expect(page.getByText(/1 answer/i)).toBeVisible();

    // "Keep editing" loses nothing…
    await page.getByRole('button', { name: /keep editing/i }).click();
    await expect(sheet.getByRole('button', { name: '3', exact: true })).toHaveClass(/segBtnActive/);
    // …and a deliberate discard actually closes it, leaving the team still empty.
    await page.getByRole('button', { name: /^back$/i }).click();
    await page.getByRole('button', { name: /^discard$/i }).click();
    await expect(page.getByText(/step 1 of 2/i)).toHaveCount(0);
  });

  test('a read-only assistant meets education, never an offer', async ({ page }) => {
    await signIn(page, READ_EMAIL);
    await open(page, `${sBase()}/accounting?section=budget`);
    const main = page.locator('main[class*="coachesMain"]');

    // Honest empty state: whose job it is, what they will see — and NO write doors.
    await expect(page.getByTestId('budget-first-run')).toHaveCount(0);
    await expect(main.getByText(/no budget yet/i)).toBeVisible();
    await expect(main.getByText(/head coach/i).first()).toBeVisible();
    await expect(main.getByRole('button', { name: /start — about a minute|add line/i })).toHaveCount(0);

    // The sample door IS allowed — it is education, not a write.
    await main.getByRole('button', { name: /see a finished example/i }).click();
    await expect(page.getByTestId('sample-budget-fence')).toBeVisible();
    await expect(page.getByText(/riverdale is invented/i)).toBeVisible();
    await page.getByRole('button', { name: /^close$/i }).click();

    // Budget vs. Actual's empty state opens the same sample ON ITS BvA TAB (D4) —
    // the coach on that page came asking what the report becomes.
    await open(page, `${sBase()}/accounting?section=budget-vs-actual`);
    await page.locator('main[class*="coachesMain"]').getByRole('button', { name: /see a finished example/i }).click();
    const fence = page.getByTestId('sample-budget-fence');
    await expect(fence).toBeVisible();
    await expect(page.getByText(/3 of 4 tournaments paid/i)).toBeVisible();

    // The fence assertions live HERE now (they were a separate built-budget test until the
    // sample became empty-state-only, owner 2026-08-13): clearly a made-up team, uncopyable
    // by construction — nothing inside is an input, no button offers to use the numbers —
    // and its BvA tab teaches the comparison idiom: honest swipe hint, a line visibly over.
    await expect(fence.getByText(/sample — a made-up team/i)).toBeVisible();
    await expect(fence.getByText('Riverdale 12U')).toBeVisible();
    expect(await fence.locator('input, select, textarea').count()).toBe(0);
    expect(await fence.getByRole('button', { name: /use|copy|apply|add|create|import/i }).count()).toBe(0);
    await expect(page.getByTestId('coach-scrollx-hint')).toBeVisible();
    await expect(fence.getByText('-$130')).toBeVisible();
    await expect(fence.getByText(/gone over on purpose/i)).toBeVisible();
    await expectNoPageScroll(page, 'sample sheet — BvA tab');
  });

  test('the starter turns answers into real lines holding only coach-typed numbers', async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, WRITE_EMAIL);
    // The Money hub's plan anchor carries ?starter=1 — the deep link opens the questions
    // directly (write-capable + still-empty only).
    await open(page, `${sBase()}/accounting?section=budget&starter=1`);
    const sheet = page.locator('[class*="modalOverlay"]').first();
    await expect(sheet.getByText(/step 1 of 2/i)).toBeVisible();

    await sheet.getByRole('button', { name: '4', exact: true }).click();
    const yes = sheet.getByRole('button', { name: 'Yes', exact: true });
    const no = sheet.getByRole('button', { name: 'No', exact: true });
    await yes.nth(0).click(); // hotels / real travel
    await yes.nth(1).click(); // pays officials directly
    await no.nth(2).click();  // no off-season block
    await yes.nth(3).click(); // provides uniforms
    await sheet.getByRole('button', { name: /next — your lines/i }).click();
    await expect(sheet.getByText(/step 2 of 2/i)).toBeVisible();

    // D-G1 at the DOM level: no input in the sheet may carry a numeric placeholder —
    // a placeholder that reads as a figure is a suggestion.
    const numericPlaceholders = await sheet.locator('input[placeholder]').evaluateAll(
      (els: HTMLInputElement[]) => els.filter(e => /\d/.test(e.placeholder)).length);
    expect(numericPlaceholders, 'a numeric placeholder is a product-supplied figure').toBe(0);

    // Entry fees: the coach's own per-event figure × their own count, arithmetic shown.
    await sheet.getByLabel(/about what does one entry cost you/i).fill('600');
    await expect(sheet.getByText(/= \$2,400\.00/)).toBeVisible();
    await sheet.getByLabel('Uniforms amount').fill('980');

    // The CTA counts honestly: 2 priced (Entry Fees, Uniforms) · 2 blank (Travel, Umpire Fees).
    await sheet.getByRole('button', { name: /add 2 priced lines · keep 2 on checklist/i }).click();
    await expect(sheet.getByText(/your starting budget is in/i)).toBeVisible({ timeout: 30_000 });
    await expect(sheet.getByText(/\$3,380\.00/)).toBeVisible();
    await sheet.getByRole('button', { name: /see my budget/i }).click();

    // The page behind refreshed: real lines, the coach's arithmetic kept visible on the
    // line, and the checklist strip carrying what they left blank.
    const main = page.locator('main[class*="coachesMain"]');
    await expect(main.getByText('Entry Fees')).toBeVisible();
    await expect(main.getByText('4 × $600')).toBeVisible();
    await expect(main.getByText('Uniforms')).toBeVisible();
    await expect(page.getByTestId('budget-checklist')).toBeVisible();
    await expect(page.getByTestId('budget-checklist')).toContainText('Travel');
    await expectNoPageScroll(page, 'budget page after the starter');

    // The database agrees: exactly the two priced lines with the coach's totals — and no
    // platform-default item gained a suggested amount (D-G1 at the data level).
    const { data: lines } = await admin.from('rep_budget_lines')
      .select('description, total_amount').eq('program_year_id', starterYearId);
    expect((lines ?? []).map(l => `${l.description}:${Number(l.total_amount)}`).sort())
      .toEqual(['Entry Fees:2400', 'Uniforms:980']);
    const { count } = await admin.from('budget_items')
      .select('id', { count: 'exact', head: true })
      .is('org_id', null).not('suggested_amount', 'is', null);
    expect(count ?? 0, 'a platform-default budget item gained a suggested_amount').toBe(0);
  });

  test('a checklist chip opens Add Line prefilled with the amount EMPTY, and a dismiss is remembered', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${sBase()}/accounting?section=budget`);
    const strip = page.getByTestId('budget-checklist');
    await strip.getByRole('button', { name: /review/i }).click();

    // + opens the NORMAL Add Line modal: category+item prefilled, amount empty — the
    // coach types the number.
    await strip.getByRole('button', { name: '+ Travel', exact: true }).click();
    await expect(page.getByText(/add budget line/i)).toBeVisible();
    await expect(page.getByLabel(/total amount/i)).toHaveValue('');
    await expect(page.getByPlaceholder('Travel')).toBeVisible();

    // An untouched prefilled form closes SILENTLY — our prefill is not the coach's work,
    // so the discard guard has nothing to protect.
    await page.getByRole('button', { name: /^back$/i }).click();
    await expect(page.getByText(/discard this budget line/i)).toHaveCount(0);
    await expect(page.getByText(/add budget line/i)).toHaveCount(0);

    // ✕ dismisses an item this team doesn't pay for — and the device remembers.
    await strip.getByRole('button', { name: /we don't pay for plate fees/i }).click();
    await expect(strip.getByRole('button', { name: '+ Plate Fees', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.locator('main[class*="coachesMain"]').getByText('Loading…')).toHaveCount(0, { timeout: 45_000 });
    const strip2 = page.getByTestId('budget-checklist');
    await strip2.getByRole('button', { name: /review/i }).click();
    await expect(strip2.getByRole('button', { name: '+ Plate Fees', exact: true })).toHaveCount(0);
    await expect(strip2.getByRole('button', { name: '+ Umpire Fees', exact: true })).toBeVisible();
  });

  test('a built budget puts the sample away — and read-only still gets no write doors', async ({ page }) => {
    // The sample is a getting-started aid, EMPTY STATES ONLY (owner 2026-08-13, superseding
    // Chunk G's D6 "permanent quiet reference"). By this point in the ordered suite the
    // starter team has a real plan, so the page must offer NO route to it — and the fence's
    // own assertions live in the read-only education test above, where the sheet still opens.
    await signIn(page, READ_EMAIL);
    await open(page, `${sBase()}/accounting?section=budget`);
    const main = page.locator('main[class*="coachesMain"]');

    // The plan is readable — but never the checklist strip (a write invitation), never an
    // add door, and no sample link anywhere on a page that has real numbers.
    await expect(page.getByTestId('budget-checklist')).toHaveCount(0);
    await expect(main.getByRole('button', { name: /add line/i })).toHaveCount(0);
    await expect(main.getByRole('button', { name: /see a sample budget|see a finished example/i })).toHaveCount(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Chunk H — Money by Month. The month grid, its four lenses, the drill-ins, the cash-flow
// strip, the prior-season column, and the payment schedule.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Switch Budget vs. Actual into the month grid and (optionally) a lens. */
async function openMonths(page: Page, lens?: 'Budget' | 'Scheduled' | 'Actual' | 'Difference') {
  await open(page, `${base()}/accounting?section=budget-vs-actual`);
  const main = page.locator('main[class*="coachesMain"]');
  await main.getByRole('button', { name: 'Months', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  if (lens) {
    // Each lens button carries a full and an abbreviated label (only one shows at a given
    // width), so match the accessible name rather than exact visible text.
    await main.getByRole('button', { name: new RegExp(`^${lens}`, 'i') }).click();
  }
  return main;
}

test.describe('Money by month @360x740', () => {
  test.use({ viewport: PHONE });
  test.beforeEach(async ({ page }) => { await signIn(page, WRITE_EMAIL); });

  test('the month grid keeps its comparison shape: scrolls in its own frame, first column pinned, page still', async ({ page }) => {
    const main = await openMonths(page);

    // A comparison is never card-stacked (Chunk A D1) — it scrolls, and it SAYS it scrolls.
    await expect(page.getByTestId('coach-scrollx-hint')).toBeVisible();
    const scroller = page.getByTestId('coach-scrollx');
    const overflow = await scroller.evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow, 'the month grid should overflow its frame on a phone').toBeGreaterThan(1);

    // The line name must not move when the money columns do.
    const firstLabel = main.getByRole('table').locator('tbody th').first();
    const before = await firstLabel.boundingBox();
    await scroller.evaluate(el => { el.scrollLeft = 180; });
    await page.waitForTimeout(120);
    const after = await firstLabel.boundingBox();
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0)), 'pinned label drifted while scrolling').toBeLessThanOrEqual(1);

    await expectNoPageScroll(page, 'budget-vs-actual — months view');
    await expectNoClippedAmounts(page, 'budget-vs-actual — months view');
  });

  test('undated plan money gets its own column instead of being spread across months', async ({ page }) => {
    const main = await openMonths(page);
    // The second seeded line has no periods at all, so its whole total is undated.
    await expect(main.getByRole('columnheader', { name: /no date yet/i })).toBeVisible();

    // …and the chart on the Categories view names the same amount rather than smearing it.
    await main.getByRole('button', { name: 'Categories', exact: true }).click();
    await expect(main.getByText(/has no date yet and isn/i)).toBeVisible();
  });

  test('Difference says nothing about a month that has not happened yet', async ({ page }) => {
    const main = await openMonths(page, 'Difference');
    await expect(main.getByText(/isn.t a saving/i)).toBeVisible();

    // The last seeded period is ~3 months out, so the grid always has a month strictly after
    // today's. Its Difference cell must be an em dash — never a flattering "fully under".
    const headerCount = await main.getByRole('table').locator('thead th').count();
    const totalRow = main.getByRole('table').locator('tbody tr').filter({ hasText: /^Total/ }).first();
    // Row cells are the <td>s after the row's own <th> label; the last td is the Total column.
    const futureCell = totalRow.locator('td').nth(headerCount - 3);
    await expect(futureCell).toHaveText('—');
  });

  test('the cash-flow strip runs a balance and names the month the team goes short', async ({ page }) => {
    const main = await openMonths(page, 'Budget');
    const table = main.getByRole('table');
    await expect(table.locator('tbody tr').filter({ hasText: 'Money in' })).toHaveCount(1);
    await expect(table.locator('tbody tr').filter({ hasText: 'Money out' })).toHaveCount(1);
    await expect(table.locator('tbody tr').filter({ hasText: 'Running balance' })).toHaveCount(1);

    // This fixture spends and has no dues schedules, so the balance must go negative — and the
    // page must say so in words, naming the month.
    await expect(main.getByText(/you go short in \w+ \d{4}/i)).toBeVisible();
    // It must also state which lens it projected with, so "Budget" is never read as "committed".
    await expect(main.getByText(/cash flow is projected with the/i)).toBeVisible();
  });

  test('last season shows up as a column, and what is missing from this season shows up as a list', async ({ page }) => {
    const main = await openMonths(page);
    await expect(main.getByRole('columnheader', { name: '2025' })).toBeVisible();
    // 'Banquet' existed last season and has no line this season — the point of the column.
    await expect(main.getByText(/not in this one/i)).toBeVisible();
    await expect(main.getByText('Banquet')).toBeVisible();
    // Last season's figures are reference, never a suggestion (D-G1 holds across chunk H too).
    await expect(main.getByText(/not a suggestion for this one/i)).toBeVisible();
  });

  test('a budget cell opens the budget-line form that already exists — the grid never edits', async ({ page }) => {
    const main = await openMonths(page, 'Budget');
    // Expand the category so a LINE row (and therefore a line-level budget cell) is present.
    await main.getByRole('table').locator('tbody th button').first().click();
    const drill = main.getByRole('table').locator('a[href*="section=budget&line="]').first();
    await expect(drill).toBeVisible();
    await drill.click();

    await expect(page).toHaveURL(/\/accounting\?section=budget&line=/);
    const budgetMain = page.locator('main[class*="coachesMain"]');
    await expect(budgetMain.getByText('Loading…')).toHaveCount(0, { timeout: 45_000 });
    // The real edit modal, pre-filled — not a second editor built into the grid.
    await expect(page.getByLabel(/total amount/i)).toHaveValue('4800');
  });

  test('an actual cell opens a read-only list of what made it up', async ({ page }) => {
    const main = await openMonths(page, 'Actual');
    await expect(main.getByText(/not to an individual line/i)).toBeVisible();
    const cell = main.getByRole('table').locator('tbody button[title*="See what makes up"]').first();
    await expect(cell).toBeVisible();
    await cell.click();
    const dialog = page.locator('[class*="modal"]').filter({ hasText: /paid in/i }).first();
    await expect(dialog).toBeVisible();
    // A read panel, not an editor.
    expect(await dialog.locator('input, select, textarea').count()).toBe(0);
  });
});

test.describe('The payment schedule (chunk H)', () => {
  test.use({ viewport: PHONE });

  test('every commitment in one list, by due date, with a filter that means what it says', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting?section=payables&tab=schedule`);
    const main = page.locator('main[class*="coachesMain"]');

    await expect(main.getByRole('heading', { name: /^payables$/i })).toBeVisible();
    // The seeded payable's deposit was due 5 days ago and its balance is 30 days out; the org
    // allocation adds another overdue instalment. Unpaid is the default view.
    await expect(main.getByText(/provincials entry — deposit/i)).toBeVisible();
    await expect(main.getByText(/days overdue/i).first()).toBeVisible();

    // Paid drops the outstanding rows entirely.
    await main.getByRole('button', { name: 'Paid', exact: true }).click();
    await expect(main.getByText(/provincials entry — deposit/i)).toHaveCount(0);

    await main.getByRole('button', { name: 'All', exact: true }).click();
    await expect(main.getByText(/provincials entry — deposit/i)).toBeVisible();

    // Dues are money IN and belong to the Dues page — the schedule says so rather than
    // silently mixing the two directions.
    await expect(main.getByText(/money going out only/i)).toBeVisible();
    await expectNoPageScroll(page, 'payment schedule');
  });

  test('a read-only money coach reads the month grid and the schedule, and can change neither', async ({ page }) => {
    await signIn(page, READ_EMAIL);

    await open(page, `${base()}/accounting?section=budget-vs-actual`);
    const main = page.locator('main[class*="coachesMain"]');
    await main.getByRole('button', { name: 'Months', exact: true }).click();
    await expect(page.getByRole('table')).toBeVisible();
    // Reading is never gated on write — the whole grid and the cash-flow strip are present…
    await expect(main.getByRole('table').locator('tbody tr').filter({ hasText: 'Running balance' })).toHaveCount(1);
    // …but no cell offers a way into an editor.
    expect(await main.locator('a[href*="section=budget&line="]').count()).toBe(0);

    await open(page, `${base()}/accounting?section=payables&tab=schedule`);
    const sched = page.locator('main[class*="coachesMain"]');
    await expect(sched.getByText(/provincials entry — deposit/i)).toBeVisible();
    expect(await sched.getByRole('button', { name: /mark paid/i }).count()).toBe(0);
  });
});

test.describe('Money by month on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await signIn(page, WRITE_EMAIL); });

  test('a budget line cannot be relinked to another org taxonomy', async ({ page }) => {
    await open(page, `${base()}/accounting?section=budget`);
    // The lines POST was hardened during the Chunk G review; its PATCH sibling was not, so a
    // crafted request could relink a line to another org's custom category and echo its name.
    const status = await page.evaluate(async ({ orgSlug, teamId }) => {
      // `cache: 'no-store'` matters: earlier tests in this file add and remove budget lines, and
      // a browser-cached plan would hand this probe a line id that no longer exists — which the
      // route correctly answers 404, hiding whether the ownership check fired at all.
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan`, { cache: 'no-store' });
      const lineId = (await res.json())?.plan?.lines?.[0]?.id;
      const bad = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // A category id that is neither this org's nor a platform default.
        body: JSON.stringify({ categoryId: '00000000-0000-4000-8000-000000000001' }),
      });
      return bad.status;
    }, { orgSlug: ORG_SLUG, teamId: repTeamId });
    expect(status, 'a foreign category id must be refused, not stored').toBe(400);
  });

  test('a tall Money form keeps its sticky footer flush instead of eating the last inch', async ({ page }) => {
    await open(page, `${base()}/accounting?section=budget`);
    const main = page.locator('main[class*="coachesMain"]');
    await main.getByRole('button', { name: /add line/i }).first().click();

    // The bug was a NEGATIVE bottom margin on a sticky footer: it shortens the panel's
    // scrollable extent by exactly that much and hides the form's last inch for good. One
    // shared rule now zeroes it for every tall modal (three private copies retired).
    const marginBottom = await page.evaluate(() => {
      const footer = document.querySelector<HTMLElement>('[class*="modalFooter"]');
      return footer ? parseFloat(getComputedStyle(footer).marginBottom) : null;
    });
    expect(marginBottom, 'the sticky footer still bleeds below the panel').toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Chunk H2 — bringing a budget in from a spreadsheet. Preview-first, a verdict per row, and
// templates that never carry a figure.
// ═══════════════════════════════════════════════════════════════════════════════════════

const LINE_ONE = 'Provincial championship entry fee including umpire assessment';

test.describe('Importing a budget @360x740', () => {
  test.use({ viewport: PHONE });
  test.beforeEach(async ({ page }) => { await signIn(page, WRITE_EMAIL); });

  test('a pasted sheet previews with a verdict per row, writes nothing until confirmed, then lands', async ({ page }) => {
    await open(page, `${base()}/accounting?section=budget`);
    const main = page.locator('main[class*="coachesMain"]');
    await main.getByRole('button', { name: /^import$/i }).click();

    // Step 1 — which shape.
    await page.getByRole('button', { name: /simple list/i }).click();

    // Step 2 — paste. One row updates an existing line, one adds, one can't be read at all.
    await page.getByLabel(/paste your rows/i).fill(
      [
        'Category,Line,Amount,Notes',
        `Tournaments,${LINE_ONE},5000,`,
        'Officials,Umpire fees,1150,',
        'misc stuff we always forget,Something,400,',
      ].join('\n'),
    );
    await page.getByRole('button', { name: /review rows/i }).click();

    // Step 3 — the verdicts. This is the whole point of preview-first.
    await expect(page.getByText(/nothing has been saved yet/i)).toBeVisible();
    const dialog = page.locator('[class*="modal"]').filter({ hasText: /nothing has been saved yet/i }).first();
    await expect(dialog.getByText('Updates', { exact: true })).toHaveCount(1);
    await expect(dialog.getByText('Adds', { exact: true })).toHaveCount(1);
    await expect(dialog.getByText(/can.t import/i)).toHaveCount(1);
    await expect(dialog.getByText(/No category called/i)).toBeVisible();

    // The blocked row is counted out loud rather than silently dropped.
    await expect(dialog.getByText(/1 row can.t be imported yet/i)).toBeVisible();

    // Nothing is written before the confirm — the budget still has its two original lines.
    const beforeCount = await page.evaluate(async ({ orgSlug, teamId }) => {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan`, { cache: 'no-store' });
      return (await res.json())?.plan?.lines?.length ?? -1;
    }, { orgSlug: ORG_SLUG, teamId: repTeamId });
    expect(beforeCount, 'the preview must not have written anything').toBe(2);

    await dialog.getByRole('button', { name: /import 2 rows/i }).click();

    // The result names what happened, and the plan reflects it: one added, one updated.
    await expect(main.getByText(/1 added, 1 updated/i)).toBeVisible({ timeout: 20_000 });
    const after = await page.evaluate(async ({ orgSlug, teamId }) => {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan`, { cache: 'no-store' });
      const plan = (await res.json())?.plan;
      return {
        count: plan?.lines?.length ?? -1,
        updated: plan?.lines?.find((l: { description: string }) => l.description.startsWith('Provincial'))?.totalAmount,
      };
    }, { orgSlug: ORG_SLUG, teamId: repTeamId });
    expect(after.count).toBe(3);
    expect(after.updated, 'the matched line took the sheet’s amount').toBe(5000);
  });

  test('a sheet where nothing can be read reports failure — never a quiet "0 imported"', async ({ page }) => {
    await open(page, `${base()}/accounting?section=budget`);
    const main = page.locator('main[class*="coachesMain"]');
    await main.getByRole('button', { name: /^import$/i }).click();
    await page.getByRole('button', { name: /simple list/i }).click();
    await page.getByLabel(/paste your rows/i).fill(
      ['Category,Line,Amount', 'Nowhere,Mystery cost,100'].join('\n'),
    );
    await page.getByRole('button', { name: /review rows/i }).click();

    const dialog = page.locator('[class*="modal"]').filter({ hasText: /nothing has been saved yet/i }).first();
    await expect(dialog.getByText(/can.t import/i)).toHaveCount(1);
    // With every row blocked there is nothing to import, and the button says so by being dead.
    await expect(dialog.getByRole('button', { name: /import 0 rows/i })).toBeDisabled();
  });

  test('a coach can fix a blocked row in the preview and watch its verdict change', async ({ page }) => {
    await open(page, `${base()}/accounting?section=budget`);
    const main = page.locator('main[class*="coachesMain"]');
    await main.getByRole('button', { name: /^import$/i }).click();
    await page.getByRole('button', { name: /simple list/i }).click();
    await page.getByLabel(/paste your rows/i).fill(
      ['Category,Line,Amount', 'Nowhere,Team hoodies,650'].join('\n'),
    );
    await page.getByRole('button', { name: /review rows/i }).click();

    const dialog = page.locator('[class*="modal"]').filter({ hasText: /nothing has been saved yet/i }).first();
    await expect(dialog.getByText(/can.t import/i)).toHaveCount(1);

    // Correcting the category in place clears the block immediately — the preview re-reviews
    // against the plan it already holds rather than round-tripping to the server.
    await dialog.getByLabel(/^category, row 1$/i).selectOption('Team Gear');
    await expect(dialog.getByText('Adds', { exact: true })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: /import 1 row/i })).toBeEnabled();
  });

  test('a read-only money coach is offered no way to import', async ({ page }) => {
    await signIn(page, READ_EMAIL);
    await open(page, `${base()}/accounting?section=budget`);
    const main = page.locator('main[class*="coachesMain"]');
    expect(await main.getByRole('button', { name: /^import$/i }).count()).toBe(0);

    await open(page, `${base()}/accounting?section=payables`);
    const payablesMain = page.locator('main[class*="coachesMain"]');
    expect(await payablesMain.getByRole('button', { name: /import payables/i }).count()).toBe(0);
  });
});

test.describe('Import templates (D-G1: structure, never amounts)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('every downloadable template ships with its amount cells EMPTY', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting?section=budget`);
    const main = page.locator('main[class*="coachesMain"]');
    await main.getByRole('button', { name: /^import$/i }).click();

    // Every shape, one at a time — a template that leaked an example dollar would be the
    // product proposing a figure, which is forbidden across all of Money.
    for (const shape of [/month grid/i, /simple list/i, /payables schedule/i]) {
      const sheet = page.locator('[class*="modal"]').filter({ hasText: /import a spreadsheet/i }).first();
      await sheet.getByRole('button', { name: shape }).click();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        sheet.getByRole('button', { name: /^csv$/i }).click(),
      ]);
      const path = await download.path();
      const csv = fs.readFileSync(path!, 'utf8').trim();
      const [header, ...rows] = csv.split(/\r?\n/);
      expect(rows.length, `${shape} template should carry example structure`).toBeGreaterThan(0);

      for (const row of rows) {
        const cells = row.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        // Columns 0 and 1 are the category and the line name — structure. EVERY other cell
        // must be blank, and no cell anywhere may contain a digit.
        expect(cells.slice(2).join(''), `${shape}: a template row carried a value`).toBe('');
        expect(/\d/.test(row), `${shape}: a template row carried a number`).toBe(false);
      }
      expect(header.length).toBeGreaterThan(0);

      await sheet.getByRole('button', { name: /choose a different shape/i }).click();
    }
  });
});
