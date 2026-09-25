/**
 * seed-club-fixture.mjs — the Club Tier Readiness walk fixture: a whole rep club on the Club plan.
 *
 * Every § walk in `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` signs in here. It is
 * the first fixture on this platform that has a club's board AND its teams AND its coaches AND its
 * money in one org — before it, `uat-club-org` held two people and nothing else (plan H01).
 *
 * ⚠ WHY A NEW ORG AND NOT `uat-club-org` (decided 2026-09-25, Stage 0):
 *   · `plan-gating.spec.ts` asserts that org's admin is REFUSED club screens — it codifies defect
 *     A01 until Stage 8 rewrites it. Granting that admin what this walk needs would break it.
 *   · The Stripe billing spec can leave `uat-club-org` CANCELLED (plan-gating re-activates it before
 *     it runs). A walk fixture another spec cancels is a walk that dies halfway.
 *   · Its owner is the shared `uat-owner@` account, which owns three orgs — every walk would start
 *     at an org picker.
 *
 * WHAT IS IN IT (identities the walk pins — never figures the calendar moves):
 *   · `uat-rep-club` — "UAT Rep Club", plan `club`, team limit 15, public site ON.
 *   · Four board sign-ins: owner · admin · treasurer · registrar (`league_registrar`).
 *       - The ADMIN holds explicit grants for every module the plan carries (rep teams, accounting,
 *         public site, house league, families). By default an admin holds none (defect A01) and
 *         would be walked straight into the tournaments area; ruling D8 fixes the default in
 *         Stage 1. Until then the fixture grants what the walk needs.
 *       - The TREASURER is left on the role's DEFAULTS, deliberately. The allocation wizard's empty
 *         team list and the Payment Requests wall are defect C03 — the walk RECORDS them. Granting
 *         Rep Teams here would hide the defect the walk exists to show.
 *       - The REGISTRAR is on defaults too (house league only) — which is what the role is for.
 *   · Six rep teams in two groups: Senior (15U AAA, 15U AA, 18U AA — archived) and Junior (13U AAA,
 *     11U AA, 9U AA). Program years in all three live states: last year COMPLETED, this year ACTIVE
 *     (four teams), and one DRAFT year on 9U AA (a team being prepared for next season, no coach).
 *       ⚠ The draft year sits on its OWN team on purpose: the coach projection follows the newest
 *         draft/active year, so a draft beside an active year would land that team's coach on an
 *         empty season (plan B03) — and the walk's "coach lands in a populated portal" would fail
 *         for a reason Stage 2 owns.
 *   · A head coach with a real sign-in on each active team: the three rows the admin Coaches route
 *     writes (a capability-less `coach` org membership, the team staff membership — the access
 *     truth since mig 245 — and the live season's projection row), PLUS a projection row on the
 *     completed record year, which the product would have written when that season was live (the
 *     route itself only ever writes the live year's). (The dev seed writes none — B13.)
 *   · Rosters with guardians. Three households have a child on TWO teams, and one of them also has
 *     a child in the house league — so Families shows real multi-programme households.
 *   · This year's org budget (four lines, split into months), two allocations to teams — one with an
 *     OVERDUE installment and one paid installment that moved money — three coach payment requests
 *     (pending · approved · denied), the org General ledger and one team ledger with entries and
 *     transfers, a tournament the club hosts with its own 15U AAA linked in, tryouts OPEN on 15U AAA
 *     (the public "Tryouts are open" card), and a house-league season open for registration.
 *
 * Run:   node --env-file=.env.local scripts/seed-club-fixture.mjs           (build if absent)
 *        node --env-file=.env.local scripts/seed-club-fixture.mjs --reset   (delete + rebuild)
 * Without --reset an existing fixture is left alone (and its sign-ins printed): a walk in progress
 * must never be rebuilt under the walker by an accidental re-run.
 *
 * ⚠ DEV ONLY. Refuses to run against the production project. Sign-ins default to the standing
 * UAT password and can be overridden with UAT_REP_CLUB_{OWNER,ADMIN,TREASURER,REGISTRAR}_{EMAIL,PASSWORD}
 * (the `UAT_REP_CLUB_` prefix because `UAT_CLUB_ORG_SLUG` already names the OTHER club org).
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local');
  process.exit(1);
}
if (url.includes('qcttcboqysynwcdyghil')) {
  console.error('✗ Refusing to run: that is the PRODUCTION project.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const RESET = process.argv.includes('--reset');

const die = (label, error) => { if (error) { console.error(`✗ ${label}: ${error.message}`); process.exit(1); } };
const ok = (m) => console.log(`  ✓ ${m}`);
const head = (m) => console.log(`\n── ${m} ${'─'.repeat(Math.max(0, 74 - m.length))}`);
async function one(label, q) { const { data, error } = await q; die(label, error); return data; }

// ── Constants ──────────────────────────────────────────────────────────────────
const ORG_SLUG = 'uat-rep-club';
const ORG_NAME = 'UAT Rep Club';
const MARKER = '[UAT_PROTECTED] Club Tier Readiness walk fixture — scripts/seed-club-fixture.mjs (rebuild with --reset). Do not wipe.';
const DEFAULT_PASSWORD = 'UATPassword2026!';

const Y = new Date().getFullYear();
const DAY = 86_400_000;
/** The calendar day a person is standing in — never the UTC one (see seed-qa-day-fixtures.mjs). */
const isoDate = (d) => { const t = new Date(d); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 10); };
const daysFromNow = (n) => isoDate(Date.now() + n * DAY);
const nowIso = new Date().toISOString();

const board = [
  { key: 'OWNER',     role: 'owner',            name: 'Morgan Ellis',   title: 'President' },
  { key: 'ADMIN',     role: 'admin',            name: 'Dana Kowalski',  title: 'Club Administrator',
    // D8 is Stage 1; until then the walk needs the admin to reach every module the plan carries.
    capabilities: { module_rep_teams: true, module_accounting: true, module_public_site: true, module_house_league: true, module_families: true } },
  { key: 'TREASURER', role: 'treasurer',        name: 'Avery Chen',     title: 'Treasurer' },          // defaults, on purpose
  { key: 'REGISTRAR', role: 'league_registrar', name: 'Riley Okonkwo',  title: 'Registrar' },          // defaults, on purpose
].map(p => ({
  ...p,
  email: (process.env[`UAT_REP_CLUB_${p.key}_EMAIL`] ?? `uat-club-${p.key.toLowerCase()}@uat-rep-club.local`).toLowerCase(),
  password: process.env[`UAT_REP_CLUB_${p.key}_PASSWORD`] ?? DEFAULT_PASSWORD,
}));

const GROUPS = ['Senior', 'Junior'];
/** years: which program years exist, oldest first (creation order matters — see header). */
const TEAMS = [
  { slug: '15u-aaa', name: '15U AAA', division: '15U', group: 'Senior', color: '#1E3A8A', years: ['completed', 'active'],
    coach: { email: 'uat-club-coach-15aaa@uat-rep-club.local', name: 'Jordan Reyes' }, tryoutsOpen: true },
  { slug: '15u-aa',  name: '15U AA',  division: '15U', group: 'Senior', color: '#0F766E', years: ['completed', 'active'],
    coach: { email: 'uat-club-coach-15aa@uat-rep-club.local', name: 'Sam Whitford' } },
  { slug: '18u-aa',  name: '18U AA',  division: '18U', group: 'Senior', color: '#6B7280', years: ['completed'], archived: true },
  { slug: '13u-aaa', name: '13U AAA', division: '13U', group: 'Junior', color: '#B91C1C', years: ['completed', 'active'],
    coach: { email: 'uat-club-coach-13aaa@uat-rep-club.local', name: 'Priya Nair' } },
  { slug: '11u-aa',  name: '11U AA',  division: '11U', group: 'Junior', color: '#7C3AED', years: ['active'],
    coach: { email: 'uat-club-coach-11aa@uat-rep-club.local', name: 'Marcus Bell' } },
  { slug: '9u-aa',   name: '9U AA',   division: '9U',  group: 'Junior', color: '#CA8A04', years: ['draft'] },
];
const yearFor = (status) => status === 'completed' ? Y - 1 : status === 'draft' ? Y + 1 : Y;

// Households with a child on TWO teams (and one in the house league too) — Families' real case.
const SHARED = [
  { last: 'Okafor',    first: 'Chidi',  email: 'okafor.family@example.test',    phone: '905-555-0141', kids: [['Ada', '15u-aaa'], ['Emeka', '13u-aaa']] },
  { last: 'Lindqvist', first: 'Karin',  email: 'k.lindqvist@example.test',      phone: '905-555-0172', kids: [['Nils', '15u-aa'], ['Freya', '11u-aa']] },
  { last: 'Tremblay',  first: 'Julie',  email: 'julie.tremblay@example.test',   phone: '905-555-0198', kids: [['Luc', '13u-aaa'], ['Elise', '11u-aa']], league: 'Noah' },
];
const FIRST = ['Liam', 'Mason', 'Ethan', 'Owen', 'Caleb', 'Leo', 'Ryan', 'Theo', 'Jack', 'Evan', 'Aiden', 'Wyatt', 'Isaac', 'Hudson', 'Gavin', 'Miles'];
const LAST = ['Martin', 'Roy', 'Gagnon', 'Singh', 'Walsh', 'Bouchard', 'Patel', 'Campbell', 'Morin', 'Fraser', 'Lee', 'Byrne', 'Hughes', 'Dubois', 'Grant', 'Kaur'];
const GUARDIAN_FIRST = ['Sarah', 'Mike', 'Jen', 'Dave', 'Amanda', 'Chris', 'Lisa', 'Paul', 'Nicole', 'Steve', 'Kate', 'Rob'];

// ── Auth + membership helpers (the qa-day recipes) ───────────────────────────────
async function findUserByEmail(email) {
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    die('listUsers', error);
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}
async function ensureUser(email, password, fullName) {
  const existing = await findUserByEmail(email);
  if (existing) {
    // Re-assert the password so the walk card is always true (a tester may have changed it).
    die(`reset password ${email}`, (await db.auth.admin.updateUserById(existing.id, { password })).error);
    return existing;
  }
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  die(`createUser ${email}`, error);
  ok(`sign-in created ${email}`);
  return data.user;
}

// ── Reset ────────────────────────────────────────────────────────────────────────
const existing = await one('find org', db.from('organizations').select('id, internal_notes').eq('slug', ORG_SLUG).maybeSingle());
if (existing && !RESET) {
  head('Fixture already exists — left alone (pass --reset to rebuild it)');
  printSignIns();
  process.exit(0);
}
if (existing) {
  if (!String(existing.internal_notes ?? '').includes('seed-club-fixture.mjs')) {
    console.error(`✗ Refusing to delete ${ORG_SLUG}: it was not made by this script (no marker in internal_notes).`);
    process.exit(1);
  }
  head(`Resetting ${ORG_SLUG}`);
  const orgId = existing.id;
  // Links that do NOT cascade from the org (verified on dev 2026-09-25): payees on ledger lines and
  // expenses, dues payouts on ledger entries, and venue facilities. Clear them, then the org goes.
  const ledgers = await one('ledgers', db.from('accounting_ledgers').select('id').eq('org_id', orgId));
  const ledgerIds = ledgers.map(l => l.id);
  if (ledgerIds.length) {
    die('unlink payees', (await db.from('accounting_entries').update({ payee_id: null }).in('ledger_id', ledgerIds)).error);
    const entries = await one('entries', db.from('accounting_entries').select('id').in('ledger_id', ledgerIds));
    if (entries.length) die('unlink payouts', (await db.from('rep_dues_payouts').update({ accounting_entry_id: null }).in('accounting_entry_id', entries.map(e => e.id))).error);
  }
  die('unlink expense payees', (await db.from('rep_team_expenses').update({ payee_id: null }).eq('org_id', orgId)).error);
  die('delete facilities', (await db.from('org_venue_facilities').delete().eq('org_id', orgId)).error);
  die('delete org', (await db.from('organizations').delete().eq('id', orgId)).error);
  ok('old fixture deleted (sign-ins kept; they are re-used)');
}

// ── Build ────────────────────────────────────────────────────────────────────────
head(`Building ${ORG_NAME} (${ORG_SLUG})`);
const org = await one('org', db.from('organizations').insert({
  name: ORG_NAME, slug: ORG_SLUG, plan_id: 'club', subscription_status: 'active', account_kind: 'organization',
  is_public: true, is_discoverable: false, theme_preset: 'platform', internal_notes: MARKER,
  // 9999 is what a real Club checkout writes; the column's default of 1 would cap the club at ONE tournament.
  tournament_limit: 9999, team_limit: 15, onboarding_completed_at: nowIso,
}).select('id').single());
const orgId = org.id;
ok(`org ${orgId}`);

// Board
const people = {};
for (const p of board) {
  const user = await ensureUser(p.email, p.password, p.name);
  people[p.key] = user.id;
  die(`member ${p.key}`, (await db.from('organization_members').insert({
    organization_id: orgId, user_id: user.id, role: p.role, status: 'active',
    display_name: p.name, title: p.title, invited_at: nowIso, accepted_at: nowIso,
    ...(p.capabilities ? { capabilities: p.capabilities } : {}),
  })).error);
}
ok('board: owner · admin (all modules granted) · treasurer (defaults) · registrar (defaults)');
const OWNER = people.OWNER;

// Public site
die('public site', (await db.from('org_public_site_content').insert({
  org_id: orgId,
  tagline: 'Competitive rep baseball for 9U to 18U',
  description: 'UAT Rep Club is a volunteer-run rep program: five competitive teams, one house league, and a summer invitational. (Walk fixture — not a real club.)',
  contact_email: 'info@uat-rep-club.local',
  show_upcoming_tournaments: true, show_archives_link: true,
})).error);
ok('public site on (tagline, about, contact)');

// Groups + teams + years
const groupIds = {};
for (const [i, name] of GROUPS.entries()) {
  groupIds[name] = (await one(`group ${name}`, db.from('rep_team_groups').insert({ org_id: orgId, name, display_order: i }).select('id').single())).id;
}
const team = {};   // slug → { id, years: { completed?, active?, draft? } }
for (const t of TEAMS) {
  const row = await one(`team ${t.name}`, db.from('rep_teams').insert({
    org_id: orgId, name: t.name, slug: t.slug, sport: 'baseball', division: t.division, color: t.color,
    group_id: groupIds[t.group], is_archived: !!t.archived,
  }).select('id').single());
  team[t.slug] = { id: row.id, years: {} };
  for (const status of t.years) {
    const year = yearFor(status);
    const py = await one(`year ${t.name} ${year}`, db.from('rep_program_years').insert({
      team_id: row.id, org_id: orgId, name: `${year} Season`, year, status,
      tryout_open: status === 'active' && !!t.tryoutsOpen,
      tryout_description: status === 'active' && t.tryoutsOpen ? `Tryouts for the ${t.name} ${year} roster. Bring a glove, cleats and water.` : null,
    }).select('id').single());
    team[t.slug].years[status] = py.id;
  }
}
ok(`6 teams in 2 groups (18U AA archived); years ${Y - 1} completed · ${Y} active · ${Y + 1} draft (9U AA)`);

// Coaches — the admin Coaches route's three writes, per team
const coachIds = {};
for (const t of TEAMS.filter(x => x.coach)) {
  const user = await ensureUser(t.coach.email, DEFAULT_PASSWORD, t.coach.name);
  coachIds[t.slug] = user.id;
  // The capability-less coach membership (lib/assistant-invites.ts) — a coach is never a board seat.
  die(`coach member ${t.name}`, (await db.from('organization_members').insert({
    organization_id: orgId, user_id: user.id, role: 'coach', status: 'active', display_name: t.coach.name, invited_at: nowIso, accepted_at: nowIso,
  })).error);
  // Access truth (mig 245): the team staff membership.
  die(`staff membership ${t.name}`, (await db.from('rep_team_staff_memberships').insert({
    org_id: orgId, team_id: team[t.slug].id, user_id: user.id, coach_role: 'head_coach', status: 'active', staff_kind: null,
  })).error);
  // The per-season projection — the record year and the live one, oldest first.
  for (const status of ['completed', 'active']) {
    const py = team[t.slug].years[status];
    if (!py) continue;
    die(`projection ${t.name} ${status}`, (await db.from('rep_team_coaches').insert({
      program_year_id: py, team_id: team[t.slug].id, org_id: orgId, user_id: user.id, coach_role: 'head_coach',
    })).error);
  }
}
ok('4 head coaches — membership + staff membership + season projection each');

// Rosters
let nameCursor = 0;
const nextKid = () => {
  const i = nameCursor++;
  const g = GUARDIAN_FIRST[i % GUARDIAN_FIRST.length];
  const last = LAST[(i * 7) % LAST.length];
  return {
    first: FIRST[i % FIRST.length], last,
    guardian: { first: g, last, email: `${g}.${last}.${i}@example.test`.toLowerCase(), phone: `905-555-${String(1000 + i).slice(-4)}` },
  };
};
let rosterRows = 0;
for (const t of TEAMS) {
  const t_ = team[t.slug];
  // This year's roster (12 per active team), with the shared households woven in.
  const shared = SHARED.flatMap(h => h.kids.filter(([, s]) => s === t.slug).map(([kid]) => ({
    first: kid, last: h.last, guardian: { first: h.first, last: h.last, email: h.email, phone: h.phone },
  })));
  const current = [...shared];
  while (current.length < 12) current.push(nextKid());
  const write = async (pyId, kids) => {
    const rows = kids.map((k, i) => ({
      program_year_id: pyId, team_id: t_.id, org_id: orgId,
      player_first_name: k.first, player_last_name: k.last, player_number: String(i + 2),
      status: 'active', source: 'admin_manual', display_order: i,
      guardian_first_name: k.guardian.first, guardian_last_name: k.guardian.last,
      guardian_email: k.guardian.email, guardian_phone: k.guardian.phone,
    }));
    die(`roster ${t.name}`, (await db.from('rep_roster_players').insert(rows)).error);
    rosterRows += rows.length;
  };
  if (t_.years.active) await write(t_.years.active, current);
  // Last season: ten returning players (the same families — continuity), or a fresh ten.
  if (t_.years.completed) await write(t_.years.completed, t_.years.active ? current.slice(0, 10) : Array.from({ length: 10 }, nextKid));
}
ok(`${rosterRows} roster rows; households Okafor, Lindqvist, Tremblay each have a child on two teams`);

// ── Money ──────────────────────────────────────────────────────────────────────
// Budget words from the PLATFORM library only (org_id null) — a club-made word must not be picked up.
const words = await one('budget words', db.from('budget_items')
  .select('id, name, category_id, budget_categories!inner(name, org_id)').is('org_id', null).is('budget_categories.org_id', null));
const word = (cat, item) => words.find(w => w.name === item && w.budget_categories?.name === cat) ?? null;

const BUDGET = [
  { cat: 'Facilities', item: 'Diamond Permits', description: 'Diamond permits — city fields', months: [[4, 2000], [5, 2000], [6, 2000]] },
  { cat: 'Officials',  item: 'Umpire Fees',     description: 'Umpire fees — home games',     months: [[5, 1500], [6, 1500], [7, 1500]] },
  { cat: 'Admin',      item: 'Insurance',       description: 'Club insurance',               months: [[4, 2500]] },
  { cat: 'Tournaments', item: 'Entry Fees',     description: 'Tournament entry fees',        months: [[6, 1500], [7, 1500]] },
];
const lineIds = {};
for (const [i, b] of BUDGET.entries()) {
  const w = word(b.cat, b.item);
  const total = b.months.reduce((s, [, a]) => s + a, 0);
  const line = await one(`budget line ${b.description}`, db.from('org_budget_lines').insert({
    org_id: orgId, season_year: Y, category_id: w?.category_id ?? null, item_id: w?.id ?? null,
    description: b.description, total_amount: total, sort_order: i,
  }).select('id').single());
  lineIds[b.item] = line.id;
  die(`periods ${b.description}`, (await db.from('org_budget_periods').insert(b.months.map(([m, amount], j) => ({
    budget_line_id: line.id, period_label: `${Y}-${String(m).padStart(2, '0')}`, period_date: `${Y}-${String(m).padStart(2, '0')}-01`, amount, sort_order: j,
  })))).error);
}
ok(`${Y} org budget: 4 lines split by month`);

// Ledgers
const general = await one('general ledger', db.from('accounting_ledgers').insert({ org_id: orgId, entity_type: 'org', entity_id: null, name: `${ORG_NAME} — General` }).select('id').single());
const teamLedger = await one('team ledger', db.from('accounting_ledgers').insert({ org_id: orgId, entity_type: 'team', entity_id: team['15u-aaa'].id, name: '15U AAA' }).select('id').single());
const entry = (ledger_id, e) => db.from('accounting_entries').insert({ ledger_id, status: 'posted', created_by: OWNER, ...e });
die('sponsorship', (await entry(general.id, { entry_date: daysFromNow(-50), description: 'Sponsorship — Maple Hardware', amount: 1500, entry_type: 'income', category: 'Sponsorship', payment_method: 'cheque' })).error);
die('permit', (await entry(general.id, { entry_date: daysFromNow(-45), description: 'Diamond permits — spring block', amount: 2000, entry_type: 'expense', category: 'Facilities', payment_method: 'etransfer' })).error);
die('team income', (await entry(teamLedger.id, { entry_date: daysFromNow(-70), description: 'Player fee deposits', amount: 2400, entry_type: 'income', category: 'Player fees', payment_method: 'etransfer' })).error);
ok('ledgers: General (income + expense) and 15U AAA (income)');

// Allocations — mirror createRepCostAllocationWithSplits
async function allocate({ description, lineItem, splits }) {
  const total = splits.reduce((s, x) => s + x.amount, 0);
  const alloc = await one(`allocation ${description}`, db.from('rep_cost_allocations').insert({
    org_id: orgId, description, total_amount: total, created_by: OWNER, source_budget_line_id: lineIds[lineItem],
  }).select('id').single());
  const out = {};
  for (const s of splits) {
    const split = await one(`split ${description}`, db.from('rep_allocation_splits').insert({
      allocation_id: alloc.id, team_id: team[s.slug].id, program_year_id: team[s.slug].years.active, org_id: orgId,
      amount: s.amount, split_method: 'fixed', split_value: s.amount, payment_schedule: s.installments.length > 1 ? 'custom' : 'standard',
    }).select('id').single());
    out[s.slug] = [];
    for (const [n, [amount, due]] of s.installments.entries()) {
      out[s.slug].push(await one(`installment ${description}`, db.from('rep_allocation_installments').insert({
        split_id: split.id, installment_number: n + 1, amount, due_date: due, org_id: orgId, team_id: team[s.slug].id,
      }).select('id').single()));
    }
  }
  return out;
}
const permits = await allocate({
  description: 'Diamond permits — team share', lineItem: 'Diamond Permits',
  splits: [
    { slug: '15u-aaa', amount: 2000, installments: [[1000, daysFromNow(-60)], [1000, daysFromNow(30)]] },
    { slug: '15u-aa',  amount: 2000, installments: [[1000, daysFromNow(-20)], [1000, daysFromNow(30)]] },  // #1 left UNPAID → overdue
  ],
});
await allocate({
  description: 'Umpire fees — team share', lineItem: 'Umpire Fees',
  splits: [
    { slug: '13u-aaa', amount: 1500, installments: [[1500, daysFromNow(45)]] },
    { slug: '11u-aa',  amount: 1500, installments: [[1500, daysFromNow(45)]] },
  ],
});
// 15U AAA paid its first permit installment: the transfer the mark-paid routes post, then the stamp.
const paidTransfer = await one('allocation transfer', db.rpc('create_accounting_transfer', {
  p_from_ledger_id: teamLedger.id, p_to_ledger_id: general.id, p_amount: 1000, p_entry_date: daysFromNow(-58),
  p_description: 'Rep allocation payment — installment #1', p_category: 'rep_allocation', p_created_by: OWNER,
}));
die('stamp installment', (await db.from('rep_allocation_installments').update({
  paid_at: new Date(Date.now() - 58 * DAY).toISOString(), paid_by: OWNER, accounting_entry_id: paidTransfer,
}).eq('id', permits['15u-aaa'][0].id)).error);
ok('2 allocations: 15U AAA paid #1 (transfer posted); 15U AA #1 OVERDUE; umpire shares due later');

// Coach payment requests — three states, all from the 15U AAA head coach
const req = (r) => db.from('rep_team_payment_requests').insert({
  org_id: orgId, team_id: team['15u-aaa'].id, program_year_id: team['15u-aaa'].years.active, created_by: coachIds['15u-aaa'], ...r,
});
die('request pending', (await req({ request_type: 'charge_to_org', money_in_meaning: 'reimbursement', amount: 480, description: 'Tournament entry — Burlington Classic', status: 'pending' })).error);
die('request approved', (await req({ request_type: 'payment_to_org', amount: 350, description: 'Umpire fees owed for June', status: 'approved', reviewed_by: OWNER, reviewed_at: new Date(Date.now() - 10 * DAY).toISOString() })).error);
// The approve route posts the transfer and (defect C07) never records its id — mirror the product.
await one('request transfer', db.rpc('create_accounting_transfer', {
  p_from_ledger_id: teamLedger.id, p_to_ledger_id: general.id, p_amount: 350, p_entry_date: daysFromNow(-10),
  p_description: 'Payment to club — Umpire fees owed for June', p_category: 'team_payment_to_org', p_created_by: OWNER,
}));
die('request denied', (await req({ request_type: 'charge_to_org', money_in_meaning: 'funding', amount: 900, description: "New catcher's gear", status: 'denied', denial_reason: "Not in this year's budget — ask again in the spring.", reviewed_by: OWNER, reviewed_at: new Date(Date.now() - 20 * DAY).toISOString() })).error);
ok('3 coach payment requests: pending · approved (transfer posted) · denied');

// ── Tournament with the club's own team ───────────────────────────────────────────
const tourn = await one('tournament', db.from('tournaments').insert({
  org_id: orgId, year: Y, name: `UAT Rep Club Invitational ${Y}`, slug: `uat-rep-club-invitational-${Y}`,
  status: 'active', is_active: true, start_date: daysFromNow(10), end_date: daysFromNow(12), sport: 'baseball', list_in_directory: false,
}).select('id').single());
const div15 = await one('tournament division', db.from('divisions').insert({ tournament_id: tourn.id, name: '15U', display_order: 0, capacity: 8 }).select('id').single());
const entrants = ['UAT Rep Club 15U AAA', 'Oakville Otters 15U', 'Milton Mustangs 15U', 'Guelph Royals 15U'];
let ownEntry = null;
for (const name of entrants) {
  const row = await one(`entrant ${name}`, db.from('teams').insert({
    tournament_id: tourn.id, division_id: div15.id, name, status: 'accepted', payment_status: 'paid', registered_at: nowIso,
  }).select('id').single());
  if (!ownEntry) ownEntry = row;
}
die('link own team', (await db.from('rep_team_tournament_registrations').insert({
  tournament_team_id: ownEntry.id, rep_team_id: team['15u-aaa'].id, org_id: orgId, linked_by_user_id: OWNER, link_source: 'explicit',
})).error);
ok(`tournament "UAT Rep Club Invitational ${Y}" (active) — the club's own 15U AAA entered and linked`);

// ── House league for the registrar ───────────────────────────────────────────────
const season = await one('league season', db.from('league_seasons').insert({
  org_id: orgId, name: `${Y} Fall House League`, slug: `${Y}-fall-house-league`, sport: 'baseball', status: 'registration_open',
  registration_fee: 150, season_start_date: daysFromNow(21), season_end_date: daysFromNow(90),
}).select('id').single());
const u9 = await one('league division', db.from('league_divisions').insert({ season_id: season.id, name: 'U9 Rookie', capacity: 20, sort_order: 0 }).select('id').single());
const tremblay = SHARED.find(h => h.league);
const leagueKids = [
  { first: tremblay.league, last: tremblay.last, g: tremblay, status: 'pending_review' },
  ...Array.from({ length: 4 }, (_, i) => { const k = nextKid(); return { first: k.first, last: k.last, g: { first: k.guardian.first, last: k.guardian.last, email: k.guardian.email, phone: k.guardian.phone }, status: i < 2 ? 'pending_review' : 'active' }; }),
];
die('league registrations', (await db.from('league_registrations').insert(leagueKids.map(k => ({
  season_id: season.id, org_id: orgId, division_id: u9.id,
  player_first_name: k.first, player_last_name: k.last,
  guardian_first_name: k.g.first, guardian_last_name: k.g.last, guardian_email: k.g.email, guardian_phone: k.g.phone,
  status: k.status, source: 'public_form',
})))).error);
ok(`house league "${Y} Fall House League" open for registration — 5 registrations (Tremblay household among them)`);

// ── Families: mint the people (the same call every Families read makes) ────────────────
die('families attach', (await db.rpc('families_attach_people', { p_org_id: orgId })).error);
ok('families attached');

head('Done');
printSignIns();

function printSignIns() {
  console.log(`  Club:      http://localhost:3000/${ORG_SLUG}/admin   ·   public page http://localhost:3000/${ORG_SLUG}`);
  for (const p of board) console.log(`  ${p.role.padEnd(17)} ${p.email}  /  ${p.password}`);
  for (const t of TEAMS.filter(x => x.coach)) console.log(`  coach ${t.name.padEnd(11)} ${t.coach.email}  /  ${DEFAULT_PASSWORD}`);
  console.log('  ⚠ Dev-only credentials.');
}
