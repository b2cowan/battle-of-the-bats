/**
 * Seed test fixtures for FP-5 Cluster 4 (wizard lane count · Event Settings
 * summaries · fees-optional activation). Does NOT touch the existing free-cup
 * fixture. Provisions TWO orgs under ONE shared owner login so each test part
 * starts in exactly the right state — and so you never have to re-run the setup
 * wizard over a tournament that already exists.
 *
 * Shared login:  fp5-owner@dev.local  /  devpass123  (real org member → browser writes work)
 *
 * Org 1 — "FP5 Wizard Test"  slug=fp5-wizard-test   (plan tournament / FREE)
 *   • NO tournament. onboarding_completed_at = null → the setup wizard runs
 *     CLEAN here. This is the org for Part A (wizard venue/lane count).
 *
 * Org 2 — "FP5 Draft Test"   slug=fp5-draft-test    (plan tournament_plus)
 *   • One DRAFT tournament "Draft Cup" slug=draft-cup:
 *       - start/end dates set
 *       - 1 division (U13), OPEN for registration
 *       - settings = {} → NO fee approach (fee_scope unset) → fees-optional path
 *   • Two venues already created with multiple facilities so the venue/lane
 *     model is visible immediately:
 *       - "Riverside Park" → 3 facilities (Diamond 1/2/3)
 *       - "Single Field"   → 1 facility (venue-named)
 *   This is the org for Part B (settings summaries) and Part C (activate a
 *   draft with no fees → must succeed).
 *
 * Idempotent: re-running wipes + recreates Draft Cup (orgs + user reused) and
 * leaves the wizard org tournament-less.
 *
 * Run: node --env-file=.env.local scripts/seed-fp5-cluster4.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const OWNER_EMAIL = 'fp5-owner@dev.local';
const PASSWORD = 'devpass123';

const WIZARD_ORG = { slug: 'fp5-wizard-test', name: 'FP5 Wizard Test', plan: 'tournament' };
const DRAFT_ORG = { slug: 'fp5-draft-test', name: 'FP5 Draft Test', plan: 'tournament_plus' };

const DRAFT_TOURN_SLUG = 'draft-cup';
const DRAFT_TOURN_NAME = 'Draft Cup';
const DIVISION = 'U13';

const DAY = 86_400_000;
const iso = (d) => d.toISOString().split('T')[0];
const today = new Date();
const startDate = iso(new Date(today.getTime() + 14 * DAY));
const endDate = iso(new Date(today.getTime() + 16 * DAY));

function die(label, error) { if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); } }

// ── 1. shared owner auth user ─────────────────────────────────────────────────
const { data: userList } = await db.auth.admin.listUsers();
let owner = userList?.users.find(u => u.email === OWNER_EMAIL);
if (!owner) {
  const { data, error } = await db.auth.admin.createUser({ email: OWNER_EMAIL, password: PASSWORD, email_confirm: true });
  die('createUser', error); owner = data.user;
  console.log(`created auth user ${OWNER_EMAIL}`);
} else {
  console.log(`auth user exists ${OWNER_EMAIL}`);
}

// ── helper: ensure org + owner membership ─────────────────────────────────────
async function ensureOrg({ slug, name, plan }) {
  let org = (await db.from('organizations').select('*').eq('slug', slug).maybeSingle()).data;
  if (!org) {
    const row = {
      id: randomUUID(), name, slug,
      plan_id: plan, subscription_status: 'active', tournament_limit: 1,
      is_public: true, theme_preset: 'platform',
      // Leave onboarding incomplete so the wizard is reachable where we want it.
      onboarding_completed_at: null,
    };
    die(`insert org ${slug}`, (await db.from('organizations').insert(row)).error);
    org = row;
    console.log(`created org ${slug} (plan_id=${plan})`);
  } else {
    if (org.plan_id !== plan) {
      die(`reset plan ${slug}`, (await db.from('organizations').update({ plan_id: plan }).eq('id', org.id)).error);
    }
    console.log(`org exists ${slug} (plan_id=${plan})`);
  }
  const member = (await db.from('organization_members')
    .select('id').eq('organization_id', org.id).eq('user_id', owner.id).maybeSingle()).data;
  if (!member) {
    die(`insert member ${slug}`, (await db.from('organization_members').insert({
      organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active',
      accepted_at: new Date().toISOString(),
    })).error);
    console.log(`linked ${OWNER_EMAIL} as owner of ${slug}`);
  }
  return org;
}

// ── 2. Org 1 — wizard org (no tournament) ─────────────────────────────────────
const wizardOrg = await ensureOrg(WIZARD_ORG);
// Make sure it stays tournament-less so the wizard runs clean for Part A.
const wizPrior = (await db.from('tournaments').select('id').eq('org_id', wizardOrg.id)).data ?? [];
for (const t of wizPrior) {
  const divs = (await db.from('divisions').select('id').eq('tournament_id', t.id)).data ?? [];
  await db.from('games').delete().eq('tournament_id', t.id);
  await db.from('teams').delete().eq('tournament_id', t.id);
  await db.from('venue_facilities').delete().eq('tournament_id', t.id);
  await db.from('diamonds').delete().eq('tournament_id', t.id);
  if (divs.length) await db.from('pools').delete().in('division_id', divs.map(d => d.id));
  await db.from('divisions').delete().eq('tournament_id', t.id);
  await db.from('tournaments').delete().eq('id', t.id);
}
if (wizPrior.length) console.log('cleared tournaments from wizard org (kept tournament-less)');

// ── 3. Org 2 — draft org ──────────────────────────────────────────────────────
const draftOrg = await ensureOrg(DRAFT_ORG);

// wipe prior Draft Cup (idempotent)
const prior = (await db.from('tournaments').select('id').eq('org_id', draftOrg.id).eq('slug', DRAFT_TOURN_SLUG)).data ?? [];
for (const t of prior) {
  const divs = (await db.from('divisions').select('id').eq('tournament_id', t.id)).data ?? [];
  await db.from('games').delete().eq('tournament_id', t.id);
  await db.from('teams').delete().eq('tournament_id', t.id);
  await db.from('venue_facilities').delete().eq('tournament_id', t.id);
  await db.from('diamonds').delete().eq('tournament_id', t.id);
  if (divs.length) await db.from('pools').delete().in('division_id', divs.map(d => d.id));
  await db.from('divisions').delete().eq('tournament_id', t.id);
  await db.from('tournaments').delete().eq('id', t.id);
  console.log('wiped prior Draft Cup');
}

// tournament — DRAFT, dates set, NO fee approach (settings = {})
const tid = randomUUID();
die('insert draft tournament', (await db.from('tournaments').insert({
  id: tid, org_id: draftOrg.id, slug: DRAFT_TOURN_SLUG, name: DRAFT_TOURN_NAME, year: 2026,
  status: 'draft', is_active: false, start_date: startDate, end_date: endDate, settings: {},
})).error);

// division — OPEN for registration (is_closed = false)
const did = randomUUID();
die('insert division', (await db.from('divisions').insert({
  id: did, tournament_id: tid, name: DIVISION, is_closed: false, settings: {},
})).error);

// venues + facilities — mirror what the wizard produces (lanes already present)
async function addVenue(name, fieldCount) {
  const vid = randomUUID();
  die('insert venue', (await db.from('diamonds').insert({
    id: vid, tournament_id: tid, name, address: null, notes: null,
  })).error);
  const rows = fieldCount === 1
    ? [{ name, display_order: 0 }]
    : Array.from({ length: fieldCount }, (_, i) => ({ name: `${name} — Diamond ${i + 1}`, display_order: i }));
  die('insert facilities', (await db.from('venue_facilities').insert(
    rows.map(r => ({
      id: randomUUID(), venue_id: vid, tournament_id: tid,
      name: r.name, facility_type: 'other', display_order: r.display_order,
    }))
  )).error);
  return rows.length;
}
const f1 = await addVenue('Riverside Park', 3);
const f2 = await addVenue('Single Field', 1);

console.log(`\n✅ Seeded FP-5 Cluster 4 fixtures`);
console.log(`\n   Shared login:  ${OWNER_EMAIL} / ${PASSWORD}`);
console.log(`\n   Part A (wizard, tournament-less):`);
console.log(`     /${WIZARD_ORG.slug}/admin/onboarding`);
console.log(`\n   Parts B + C (Draft Cup — DRAFT, dates set, open division, NO fee approach):`);
console.log(`     Settings:  /${DRAFT_ORG.slug}/admin/tournaments/settings/event`);
console.log(`     Dashboard: /${DRAFT_ORG.slug}/admin/tournaments/dashboard`);
console.log(`     Venues:    /${DRAFT_ORG.slug}/admin/tournaments/venues`);
console.log(`     Riverside Park = ${f1} facilities · Single Field = ${f2} facility`);
