import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
  const { error: perErr } = await admin.from('rep_budget_periods').insert([
    { budget_line_id: lines![0].id, period_label: 'May', period_date: day(-40), amount: 1600, sort_order: 0 },
    { budget_line_id: lines![0].id, period_label: 'June', period_date: day(-10), amount: 1600, sort_order: 1 },
    { budget_line_id: lines![0].id, period_label: 'July', period_date: day(20), amount: 1600, sort_order: 2 },
  ]);
  if (perErr) throw perErr;

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
      ['Season Budget Plan', `${base()}/accounting/budget`],
      ['Budget vs. Actual', `${base()}/accounting/budget-vs-actual`],
      ['Expenses', `${base()}/accounting/expenses`],
      ['Player Dues', `${base()}/accounting/dues`],
      ['Fundraisers', `${base()}/accounting/fundraisers`],
      ['Fundraiser detail', `${base()}/accounting/fundraisers/${fundraiserId}`],
      ['Org Allocations', `${base()}/accounting/allocations`],
      ['Payment Requests', `${base()}/accounting/payment-requests`],
    ];

    for (const [label, url] of surfaces) {
      await open(page, url);
      await expectNoPageScroll(page, label);
      await expectNoClippedAmounts(page, label);
    }

    // The payables tab is a separate render of the Expenses page (the two-across split).
    await open(page, `${base()}/accounting/expenses`);
    const main = page.locator('main[class*="coachesMain"]');
    await main.getByRole('button', { name: /^tournament payables/i }).click();
    await expect(main.getByText('Provincials entry')).toBeVisible();
    // Both halves of the split are readable, not two ~150px boxes.
    await expect(main.getByText(/mark deposit paid/i)).toBeVisible();
    await expect(main.getByText(/mark balance paid/i)).toBeVisible();
    for (const label of [/mark deposit paid/i, /mark balance paid/i]) {
      const box = await main.getByRole('button', { name: label }).boundingBox();
      expect(box!.width, 'a stacked payable action should span the card').toBeGreaterThan(200);
    }
    await expectNoPageScroll(page, 'Expenses — payables tab');
    await expectNoClippedAmounts(page, 'Expenses — payables tab');
  });

  test('Budget vs. Actual keeps the comparison: scrolls inside its own frame, first column pinned, hint present', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting/budget-vs-actual`);

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
    await open(page, `${base()}/accounting/budget`);

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
    // The per-period heading and field labels are revealed at this width.
    await expect(sheet.getByText(/^Period 1$/)).toBeVisible();

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
    await open(page, `${base()}/accounting/expenses`);

    await page.getByRole('button', { name: /add expense/i }).first().click();
    await expect(page.getByPlaceholder(/diamond rental/i)).toBeVisible();
    await page.getByRole('button', { name: /^back$/i }).click();
    await expect(page.getByText(/discard this expense/i)).toBeHidden();
    await expect(page.getByPlaceholder(/diamond rental/i)).toHaveCount(0);
  });

  test('list-shaped money tables become labelled cards, and empty action cells draw no blank line', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting/expenses`);

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
      ['Season Budget Plan', `${base()}/accounting/budget`],
      ['Budget vs. Actual', `${base()}/accounting/budget-vs-actual`],
      ['Expenses', `${base()}/accounting/expenses`],
      ['Org Allocations', `${base()}/accounting/allocations`],
      ['Fundraisers', `${base()}/accounting/fundraisers`],
      ['Fundraiser detail', `${base()}/accounting/fundraisers/${fundraiserId}`],
      ['Payment Requests', `${base()}/accounting/payment-requests`],
    ] as Array<[string, string]>) {
      await open(page, url);
      await expectNoPageScroll(page, `${label} (read-only)`);
      await expectNoClippedAmounts(page, `${label} (read-only)`);

      const main = page.locator('main[class*="coachesMain"]');
      await expect(
        main.getByRole('button', {
          name: /mark paid|mark deposit paid|mark balance paid|add line|add expense|add payable|recategorize|new request|new fundraiser|settings|log amount|edit amount|generate installments|start — about a minute/i,
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

    await open(page, `${base()}/accounting/budget`);

    // Force the failure the old alert() reported, without depending on a real server-side conflict.
    await page.route('**/budget-plan/lines/**', route =>
      route.request().method() === 'DELETE'
        ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'This line is used by player installments that have already been generated.' }) })
        : route.fallback());

    await page.locator('[class*="actionBtnDanger"]').first().click();
    await expect(page.getByText(/delete budget line/i)).toBeVisible();
    await page.getByRole('button', { name: /^delete$/i }).click();

    // The reason appears in the dialog that is still open, and the dialog stays open.
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
    await open(page, `${base()}/accounting/expenses`);

    await page.getByRole('button', { name: /add expense/i }).first().click();
    await page.getByPlaceholder(/diamond rental/i).fill('Bat bag');

    await page.locator('[class*="modalOverlay"]').first().click({ position: { x: 5, y: 5 } });
    await expect(page.getByText(/discard this expense/i)).toBeVisible();
    await page.getByRole('button', { name: /keep editing/i }).click();
    await expect(page.getByPlaceholder(/diamond rental/i)).toHaveValue('Bat bag');
  });

  test('Budget vs. Actual has room for the comparison and no internal scrollbar on a wide screen', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting/budget-vs-actual`);

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
    await signIn(page, WRITE_EMAIL);
    await open(page, `${base()}/accounting/budget`);
    await page.locator('main[class*="coachesMain"]').getByRole('button', { name: /see a sample budget/i }).click();
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

  const sBase = () => `/${ORG_SLUG}/coaches/teams/${starterTeamId}`;

  test('the blank page becomes three doors, and a dirty starter guards its dismiss', async ({ page }) => {
    await signIn(page, WRITE_EMAIL);
    await open(page, `${sBase()}/accounting/budget`);
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
    await open(page, `${sBase()}/accounting/budget`);
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
    await open(page, `${sBase()}/accounting/budget-vs-actual`);
    await page.locator('main[class*="coachesMain"]').getByRole('button', { name: /see a finished example/i }).click();
    await expect(page.getByTestId('sample-budget-fence')).toBeVisible();
    await expect(page.getByText(/3 of 4 tournaments paid/i)).toBeVisible();
  });

  test('the starter turns answers into real lines holding only coach-typed numbers', async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page, WRITE_EMAIL);
    // The Money hub's plan anchor carries ?starter=1 — the deep link opens the questions
    // directly (write-capable + still-empty only).
    await open(page, `${sBase()}/accounting/budget?starter=1`);
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
    await open(page, `${sBase()}/accounting/budget`);
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

  test('the sample is fenced and uncopyable, and its BvA tab teaches what "over" looks like', async ({ page }) => {
    await signIn(page, READ_EMAIL);
    await open(page, `${sBase()}/accounting/budget`);
    const main = page.locator('main[class*="coachesMain"]');

    // With a budget present, the read-only coach sees the lines — but never the strip
    // (a write invitation) and never an add door. The quiet sample link IS allowed.
    await expect(page.getByTestId('budget-checklist')).toHaveCount(0);
    await expect(main.getByRole('button', { name: /add line/i })).toHaveCount(0);
    await main.getByRole('button', { name: /see a sample budget/i }).click();

    const fence = page.getByTestId('sample-budget-fence');
    await expect(fence).toBeVisible();
    await expect(fence.getByText(/sample — a made-up team/i)).toBeVisible();
    await expect(fence.getByText('Riverdale 12U')).toBeVisible();

    // Uncopyable by construction: nothing inside the fence is an input, and no button
    // offers to use the numbers (the only fence buttons are the two view tabs).
    expect(await fence.locator('input, select, textarea').count()).toBe(0);
    expect(await fence.getByRole('button', { name: /use|copy|apply|add|create|import/i }).count()).toBe(0);

    // The BvA tab renders the real comparison idiom — honest swipe hint, and the
    // over-budget line visibly over.
    await fence.getByRole('button', { name: /budget vs\. actual/i }).click();
    await expect(page.getByTestId('coach-scrollx-hint')).toBeVisible();
    await expect(fence.getByText('-$130')).toBeVisible();
    await expect(fence.getByText(/gone over on purpose/i)).toBeVisible();
    await expectNoPageScroll(page, 'sample sheet — BvA tab');
  });
});
