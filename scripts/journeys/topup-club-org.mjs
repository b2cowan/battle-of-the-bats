/**
 * Journey-audit staging top-up for J4 (club president) — dev-club-org.
 *
 * Stages realistic ACCOUNTING + multi-module data so the J4 walk isn't empty:
 *   1. Org operating ledger (auto-created via GET /ledgers) + a "Fundraising" sub-ledger
 *   2. 3 payees, 10 ledger entries (Apr–Jun 2026, income+expense, 1 pending), 1 transfer
 *   3. 2026 budget plan: 4 lines against platform-default categories
 *      (Officials / Facilities / Tournaments / Admin)
 *   4. Allocation of the "Rep program tournament entries" line to Dev Rep U15
 *      (fixed $3,000 split, 2 installments) — the org<->team money link
 *   5. 1 rep-team payment request (coach API if a dev-club-scoped coach exists,
 *      else direct service-role insert mirroring the route's insert)
 *   6. organizations.is_public = true (direct DB flag flip)
 *   7. House-league season via POST /api/dev/seed/house-league (platform-admin session)
 *
 * All accounting writes go through the real admin APIs as club-owner@dev.local
 * (sole membership = dev-club-org; the accounting routes resolve org from the
 * caller's first membership, not an orgSlug param). Idempotent: skips by name/
 * description where the thing already exists.
 *
 * NOTE on the Fundraising ledger: we pass an explicit entityId (= org id).
 * The admin UI posts { entityType: 'org' } with NO entityId for sub-ledgers,
 * which creates a second (entity_type='org', entity_id NULL) row; getOrgLedger()
 * looks the org ledger up with .is('entity_id', null).maybeSingle(), which
 * errors on >1 row — risking duplicate "— General" ledgers being re-created on
 * every GET /ledgers. Passing entityId keeps the staged data clear of that
 * product hazard (recorded as an audit observation, not fixed here).
 *
 * Run: node --env-file=.env.local scripts/journeys/topup-club-org.mjs
 */
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const BASE   = 'http://localhost:3000';
const ORG_ID = '6f6f613b-79ed-44b6-9e7d-41e1b61ada4b'; // dev-club-org

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const summary = [];
const note = (s) => { summary.push(s); console.log(`  ${s}`); };
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };

// ── DB lookups ─────────────────────────────────────────────────────────────────
const { data: org } = await db.from('organizations').select('id, slug, name, plan_id, is_public').eq('id', ORG_ID).maybeSingle();
if (!org || org.slug !== 'dev-club-org') fail('dev-club-org not found by id — run run-dev-seeds.mjs first');

const { data: repTeam } = await db.from('rep_teams').select('id, name').eq('org_id', ORG_ID).eq('slug', 'dev-rep-u15').maybeSingle();
const { data: progYear } = repTeam
  ? await db.from('rep_program_years').select('id, name').eq('team_id', repTeam.id).eq('year', 2026).maybeSingle()
  : { data: null };
if (!repTeam) console.warn('WARN: Dev Rep U15 missing — allocation + payment request will be skipped');

const { data: userList } = await db.auth.admin.listUsers();
const findUser = (email) => userList?.users.find(u => u.email === email) ?? null;
const ownerUser = findUser('club-owner@dev.local');
if (!ownerUser) fail('club-owner@dev.local missing — run scripts/journeys/create-journey-users.mjs first');

// ── Browser + sessions ─────────────────────────────────────────────────────────
const browser = await chromium.launch();

async function loginUser(email, password) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'load' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-submit').click();
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && new URL(page.url()).pathname.startsWith('/auth/login')) {
    await page.waitForTimeout(400);
  }
  if (new URL(page.url()).pathname.startsWith('/auth/login')) {
    throw new Error(`login did not navigate away for ${email}`);
  }
  await page.close();
  return ctx;
}

function api(ctx) {
  return {
    async get(url) {
      const r = await ctx.request.get(`${BASE}${url}`);
      const j = await r.json().catch(() => ({}));
      if (r.status() >= 400) console.error(`  ${r.status()} GET ${url} → ${JSON.stringify(j)}`);
      return { status: r.status(), json: j };
    },
    async post(url, body) {
      const r = await ctx.request.post(`${BASE}${url}`, { data: body ?? {} });
      const j = await r.json().catch(() => ({}));
      if (r.status() >= 400) console.error(`  ${r.status()} POST ${url} → ${JSON.stringify(j)}`);
      return { status: r.status(), json: j };
    },
  };
}

console.log('— logging in as club-owner@dev.local —');
const owner = api(await loginUser('club-owner@dev.local', 'devpass123'));

// ── 1. Ledgers ─────────────────────────────────────────────────────────────────
console.log('— ledgers —');
let { status: lst, json: ledgersRes } = await owner.get('/api/admin/accounting/ledgers');
if (lst !== 200) fail(`GET /ledgers → ${lst} (is the dev server running and club-owner an owner of dev-club-org?)`);

const ledgerByName = (name) => (ledgersRes.ledgers ?? []).map(s => s.ledger).find(l => l.name === name);
const general = (ledgersRes.ledgers ?? []).map(s => s.ledger).find(l => l.entityType === 'org' && l.entityId === null);
if (!general) fail('org General ledger missing even after GET /ledgers (auto-create failed?)');
note(`General ledger: "${general.name}" (${general.id})`);

let fundraising = ledgerByName('Fundraising');
if (!fundraising) {
  const { status, json } = await owner.post('/api/admin/accounting/ledgers', { name: 'Fundraising', entityType: 'org', entityId: ORG_ID });
  if (status !== 201) fail(`create Fundraising ledger → ${status}`);
  fundraising = json;
  note(`Created Fundraising ledger (${fundraising.id})`);
} else {
  note(`Fundraising ledger already exists (${fundraising.id}) — skipped`);
}

// ── 2. Payees ──────────────────────────────────────────────────────────────────
console.log('— payees —');
const PAYEES = [
  { name: 'Halton Umpires Association', notes: 'Game officials for house league + rep' },
  { name: 'Diamond Sports Equipment Ltd', notes: 'Equipment supplier — net 30' },
  { name: 'Town of Milton — Parks & Recreation', notes: 'Diamond permits and lighting fees' },
];
const { json: payeesRes } = await owner.get('/api/admin/accounting/payees?q=');
const payeeIds = {};
for (const p of PAYEES) {
  const existing = (payeesRes.payees ?? []).find(x => x.name === p.name);
  if (existing) {
    payeeIds[p.name] = existing.id;
    note(`Payee "${p.name}" already exists — skipped`);
  } else {
    const { status, json } = await owner.post('/api/admin/accounting/payees', p);
    if (status !== 201) fail(`create payee "${p.name}" → ${status}`);
    payeeIds[p.name] = json.payee.id;
    note(`Created payee "${p.name}"`);
  }
}

// ── 3. Ledger entries (Apr–Jun 2026) ──────────────────────────────────────────
console.log('— ledger entries —');
const ENTRIES = [
  // General — operating ledger
  { ledger: general.id, entryDate: '2026-04-01', entryType: 'income',  amount: 4800,    status: 'posted',  category: 'Registration', paymentMethod: 'e-transfer', payeePayer: 'Spring registration batch', description: 'Spring registration fees — early-bird batch' },
  { ledger: general.id, entryDate: '2026-04-09', entryType: 'income',  amount: 3150,    status: 'posted',  category: 'Registration', paymentMethod: 'e-transfer', payeePayer: 'Spring registration batch', description: 'Spring registration fees — regular batch' },
  { ledger: general.id, entryDate: '2026-04-15', entryType: 'expense', amount: 1280,    status: 'posted',  category: 'Umpires',        paymentMethod: 'cheque', payeeId: payeeIds['Halton Umpires Association'], description: 'Umpire fees — April house league weekends' },
  { ledger: general.id, entryDate: '2026-04-22', entryType: 'expense', amount: 2340.5,  status: 'posted',  category: 'Equipment',      paymentMethod: 'cheque', payeeId: payeeIds['Diamond Sports Equipment Ltd'], description: 'Equipment order — game balls, catcher gear, first-aid kits' },
  { ledger: general.id, entryDate: '2026-05-01', entryType: 'expense', amount: 3600,    status: 'posted',  category: 'Facility rental', paymentMethod: 'EFT',   payeeId: payeeIds['Town of Milton — Parks & Recreation'], description: 'Diamond permits May–June — Lions Park' },
  { ledger: general.id, entryDate: '2026-05-12', entryType: 'expense', amount: 1975,    status: 'posted',  category: 'Insurance',      paymentMethod: 'EFT',   payeePayer: 'Ontario Sport Insurance Brokers', description: 'Annual liability insurance premium 2026' },
  { ledger: general.id, entryDate: '2026-05-20', entryType: 'income',  amount: 1500,    status: 'posted',  category: 'Sponsorship',    paymentMethod: 'cheque', payeePayer: 'Main Street Dental', description: 'Season sponsorship — Main Street Dental' },
  { ledger: general.id, entryDate: '2026-06-03', entryType: 'expense', amount: 860,     status: 'pending', category: 'Umpires',        payeeId: payeeIds['Halton Umpires Association'], description: 'Umpire fees — May house league (invoice received, unpaid)', notes: 'Awaiting cheque run' },
  // Fundraising sub-ledger
  { ledger: fundraising.id, entryDate: '2026-05-24', entryType: 'income', amount: 2210.75, status: 'posted', category: 'Fundraising', paymentMethod: 'cash', payeePayer: 'Bottle drive volunteers', description: 'Bottle drive proceeds — May' },
  { ledger: fundraising.id, entryDate: '2026-06-07', entryType: 'income', amount: 1340,    status: 'posted', category: 'Fundraising', paymentMethod: 'cash', payeePayer: 'Opening day BBQ', description: 'Opening day BBQ fundraiser' },
];

const existingDescriptions = new Set();
for (const lid of [general.id, fundraising.id]) {
  const { json } = await owner.get(`/api/admin/accounting/ledgers/${lid}/entries?limit=200`);
  for (const e of (json.entries ?? [])) existingDescriptions.add(`${lid}|${e.description}`);
}

let entriesCreated = 0;
for (const e of ENTRIES) {
  if (existingDescriptions.has(`${e.ledger}|${e.description}`)) continue;
  const { ledger, ...body } = e;
  const { status } = await owner.post(`/api/admin/accounting/ledgers/${ledger}/entries`, body);
  if (status !== 201) fail(`create entry "${e.description}" → ${status}`);
  entriesCreated++;
}
note(`Ledger entries: created ${entriesCreated}, skipped ${ENTRIES.length - entriesCreated} (already present)`);

// ── 4. Transfer Fundraising → General ─────────────────────────────────────────
console.log('— transfer —');
const TRANSFER_DESC = 'Transfer fundraising proceeds to operating account';
if (existingDescriptions.has(`${general.id}|${TRANSFER_DESC}`)) {
  note('Transfer already exists — skipped');
} else {
  const { status } = await owner.post('/api/admin/accounting/transfers', {
    fromLedgerId: fundraising.id,
    toLedgerId:   general.id,
    amount:       1500,
    entryDate:    '2026-06-08',
    description:  TRANSFER_DESC,
    category:     'Fundraising',
  });
  if (status !== 201) fail(`create transfer → ${status}`);
  note('Created transfer Fundraising → General ($1,500.00, 2026-06-08)');
}

// ── 5. Budget plan 2026 ────────────────────────────────────────────────────────
console.log('— budget plan 2026 —');
const { json: catsRes } = await owner.get('/api/admin/accounting/budget-categories?scope=org');
const catByName = (name) => (catsRes.categories ?? []).find(c => c.name === name) ?? null;

const BUDGET_LINES = [
  { catName: 'Officials',   description: 'Umpires & officials — all programs', totalAmount: 14500, notes: 'House league + rep, plate and base fees' },
  { catName: 'Facilities',  description: 'Diamond & facility permits',         totalAmount: 11200, notes: 'Lions Park + Rotary Field, May–Sept' },
  { catName: 'Tournaments', description: 'Rep program tournament entries',     totalAmount: 6000,  notes: 'Entry fees for rep team tournament season' },
  { catName: 'Admin',       description: 'Insurance & administration',         totalAmount: 4300,  notes: 'Liability premium + bookkeeping' },
];

const { json: planRes } = await owner.get('/api/admin/accounting/budget-plan?year=2026');
const existingLines = [
  ...(planRes.categories ?? []).flatMap(c => c.lines ?? []),
  ...(planRes.uncategorized ?? []),
];

const lineIdsByDesc = {};
let sort = existingLines.length;
for (const l of BUDGET_LINES) {
  const existing = existingLines.find(x => x.description === l.description);
  if (existing) {
    lineIdsByDesc[l.description] = existing.id;
    note(`Budget line "${l.description}" already exists — skipped`);
    continue;
  }
  const cat = catByName(l.catName);
  const { status, json } = await owner.post('/api/admin/accounting/budget-plan/lines', {
    seasonYear:  2026,
    categoryId:  cat?.id ?? null,
    description: l.description,
    totalAmount: l.totalAmount,
    notes:       l.notes,
    sortOrder:   sort++,
  });
  if (status !== 201) fail(`create budget line "${l.description}" → ${status}`);
  lineIdsByDesc[l.description] = json.line.id;
  note(`Created budget line "${l.description}" ($${l.totalAmount}) in ${cat ? cat.name : 'Uncategorized'}`);
}

// ── 6. Allocate tournament-entries line to Dev Rep U15 ────────────────────────
console.log('— allocation to rep team —');
const allocLineId = lineIdsByDesc['Rep program tournament entries'];
if (!repTeam || !progYear) {
  note('SKIPPED allocation: Dev Rep U15 team/2026 program year not found');
} else {
  const allocLine = existingLines.find(x => x.id === allocLineId);
  if (allocLine?.allocation) {
    note(`Allocation already exists on "Rep program tournament entries" — skipped`);
  } else {
    const { status, json } = await owner.post(`/api/admin/accounting/budget-plan/lines/${allocLineId}/allocate-to-teams`, {
      description: 'Rep tournament entries 2026 — Dev Rep U15 share',
      splits: [{
        teamId:          repTeam.id,
        programYearId:   progYear.id,
        splitMethod:     'fixed',
        splitValue:      3000,
        amount:          3000,
        paymentSchedule: 'standard',
        notes:           'Half of org tournament budget carried by U15',
        installments: [
          { installmentNumber: 1, amount: 1500, dueDate: '2026-07-01' },
          { installmentNumber: 2, amount: 1500, dueDate: '2026-08-01' },
        ],
      }],
    });
    if (status === 201) note(`Allocated $3,000 of "Rep program tournament entries" to ${repTeam.name} (allocation ${json.allocation.id})`);
    else if (status === 409) note('Allocation already exists (409) — skipped');
    else fail(`allocate-to-teams → ${status}`);
  }
}

// ── 7. Rep-team payment request ────────────────────────────────────────────────
console.log('— rep payment request —');
const PAYREQ_DESC = 'Tournament entry — Oakville Summer Classic U15 (pay by club cheque)';
if (!repTeam) {
  note('SKIPPED payment request: Dev Rep U15 not found');
} else {
  const { data: existingReq } = await db.from('rep_team_payment_requests')
    .select('id').eq('team_id', repTeam.id).eq('description', PAYREQ_DESC).maybeSingle();
  if (existingReq) {
    note(`Payment request already exists (${existingReq.id}) — skipped`);
  } else {
    const body = {
      requestType:   'charge_to_org',
      amount:        650,
      description:   PAYREQ_DESC,
      paymentMethod: 'Club cheque',
      notes:         'Entry deadline June 20 — please mail directly to convenor',
      budgetLineId:  allocLineId ?? null,
    };

    // Prefer the real coach API when a coach whose FIRST membership is dev-club-org exists
    let viaApi = false;
    const { data: coachRows } = await db.from('rep_team_coaches').select('user_id').eq('team_id', repTeam.id);
    for (const c of (coachRows ?? [])) {
      const cu = userList.users.find(u => u.id === c.user_id);
      if (!cu) continue;
      const { data: m } = await db.from('org_members').select('org_id').eq('user_id', cu.id).order('created_at').limit(1);
      if (m?.[0]?.org_id !== ORG_ID) continue;
      try {
        const coach = api(await loginUser(cu.email, 'devpass123'));
        const { status, json } = await coach.post(`/api/coaches/dev-club-org/teams/${repTeam.id}/payment-requests`, body);
        if (status === 201) {
          note(`Created payment request via coach API as ${cu.email} (${json.request.id})`);
          viaApi = true;
        }
      } catch (e) {
        console.warn(`  coach API path failed for ${cu.email}: ${e.message}`);
      }
      break;
    }

    if (!viaApi) {
      // Fallback: direct insert mirroring the coaches route insert exactly
      const creator = (coachRows?.[0] && userList.users.find(u => u.id === coachRows[0].user_id)) ?? ownerUser;
      const { data, error } = await db.from('rep_team_payment_requests').insert({
        org_id:         ORG_ID,
        team_id:        repTeam.id,
        request_type:   body.requestType,
        amount:         body.amount,
        description:    body.description,
        payment_method: body.paymentMethod,
        notes:          body.notes,
        budget_line_id: body.budgetLineId,
        created_by:     creator.id,
      }).select('id').single();
      if (error) fail(`direct payment-request insert: ${error.message}`);
      note(`Created payment request via direct insert (${data.id}, created_by ${creator.email ?? creator.id}) — coach API path unavailable`);
    }
  }
}

// ── 8. Make org public ─────────────────────────────────────────────────────────
console.log('— org visibility —');
if (org.is_public) {
  note('organizations.is_public already true — skipped');
} else {
  const { error } = await db.from('organizations').update({ is_public: true }).eq('id', ORG_ID);
  if (error) fail(`is_public update: ${error.message}`);
  note('Set organizations.is_public = true');
}

// ── 9. House league season (platform-admin dev seed) ──────────────────────────
console.log('— house league seed (platform admin) —');
const plEmail = process.env.UAT_PLATFORM_ADMIN_EMAIL;
const plPassword = process.env.UAT_PLATFORM_ADMIN_PASSWORD;
if (!plEmail || !plPassword) {
  note('SKIPPED house-league seed: UAT_PLATFORM_ADMIN_* missing from env');
} else {
  const plCtx = await browser.newContext();
  const plPage = await plCtx.newPage();
  await plPage.goto(`${BASE}/platform-admin/login?next=%2Fplatform-admin`, { waitUntil: 'load' });
  await plPage.locator('#pl-email').fill(plEmail);
  await plPage.locator('#pl-password').fill(plPassword);
  await plPage.locator('button[type="submit"]').click();
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && new URL(plPage.url()).pathname.startsWith('/platform-admin/login')) {
    await plPage.waitForTimeout(400);
  }
  if (new URL(plPage.url()).pathname.startsWith('/platform-admin/login')) {
    note('SKIPPED house-league seed: platform-admin login failed');
  } else {
    const pl = api(plCtx);
    const { status, json } = await pl.post('/api/dev/seed/house-league', { orgId: ORG_ID });
    if (status === 200) note(`House-league seed: ${JSON.stringify(json.log)}`);
    else note(`House-league seed FAILED (${status}): ${JSON.stringify(json)}`);
  }
}

await browser.close();

console.log('\n=== STAGING SUMMARY ===');
for (const s of summary) console.log(`- ${s}`);
console.log('OK dev-club-org staged for J4');
