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
 *   · Eight rep teams in two groups: Senior (15U AAA, 15U AA, 16U AA, 18U AA — archived) and Junior
 *     (13U AAA, 12U AA, 11U AA, 9U AA). Club Tier Stage 2 · session 3 added 12U AA (a live season with a
 *     roster and NO head coach) and 16U AA (a CLOSED season with no next one), plus a pending head-coach
 *     invitation on 9U AA (its accept link printed at the end), a club invitation waiting on 11U AA's
 *     coach's home page, three club templates (one switched off) and signed copies on two teams. Program years in all three live states: last year COMPLETED, this year ACTIVE
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
 *   · This year's org budget (four lines, split into months) and the Club Tier Stage 3a money loop,
 *     written through the real one-step moves (mig 315): Diamond fees with two OVERDUE teams (one with no
 *     head coach), a coach's SENT payment waiting to be confirmed, one RECEIVED then UNDONE, the rest on
 *     track; payment requests in every state (two waiting and holding payouts, approved, declined,
 *     reversed); the club's General ledger with a pending cheque, a void, two spellings of one payee and
 *     a float to the tournament's own book; a tournament the club hosts with its own 15U AAA linked in, tryouts OPEN on 15U AAA
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
import crypto from 'node:crypto';
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
/** The 9U AA head-coach invitation's raw token — set when the fixture is BUILT (printed once, at the end). */
let inviteToken = null;

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
  // Club Tier Stage 2 · session 3 — the states the §C/§D walks need (the board's reds, the season doors):
  //   12U AA — a live season with a roster and NO head coach (the red "No head coach");
  //   16U AA — a CLOSED season with no next one, its head coach still on staff (Start the next / Reopen).
  { slug: '12u-aa',  name: '12U AA',  division: '12U', group: 'Junior', color: '#0E7490', years: ['completed', 'active'] },
  { slug: '16u-aa',  name: '16U AA',  division: '16U', group: 'Senior', color: '#9D174D', years: ['completed'],
    coach: { email: 'uat-club-coach-16aa@uat-rep-club.local', name: 'Casey Morgan' } },
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
ok(`8 teams in 2 groups (18U AA archived; 12U AA has no head coach; 16U AA between seasons); years ${Y - 1} completed · ${Y} active · ${Y + 1} draft (9U AA)`);

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
ok('5 head coaches — membership + staff membership + season projection each (16U AA’s on its closed season)');

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
die('sponsorship', (await entry(general.id, { entry_date: daysFromNow(-50), description: 'Sponsorship — Maple Hardware', amount: 1500, entry_type: 'income', category: 'Sponsorship', payment_method: 'Cheque 1042' })).error);
die('permit', (await entry(general.id, { entry_date: daysFromNow(-45), description: 'Diamond permits — spring block', amount: 2000, entry_type: 'expense', category: 'Facilities', payment_method: 'E-Transfer 5531' })).error);
die('team income', (await entry(teamLedger.id, { entry_date: daysFromNow(-70), description: 'Player fee deposits', amount: 2400, entry_type: 'income', category: 'Player fees', payment_method: 'E-Transfer' })).error);
ok('ledgers: General (income + expense) and 15U AAA (income)');

// ── Club Tier Stage 3a — the money loop the §E walks need, written through the REAL one-step moves
// (mig 315's functions), so every ledger line, stamp and void is exactly what the product writes:
//   · Diamond fees ${Y} (three installments) — 15U AA and 12U AA OVERDUE (12U AA has no head coach, so a
//     reminder can't reach it); 13U AAA's coach says #2 is SENT (waiting for the club to confirm); 11U AA's
//     #1 RECEIVED and then UNDONE with a reason; 15U AAA on track. #3 falls due inside the 14-day window.
//   · Umpire fees — one installment each, later this season (Coming due's Due → Rest of the season).
//   · Payment requests in every state: two WAITING (one To club, one From club — no team here has dues
//     outstanding, so both read "holding up the payout"), approved, declined, and approved-then-REVERSED.
const METHOD_WORD = { etransfer: 'E-Transfer', cheque: 'Cheque', cash: 'Cash', card: 'Card', other: 'Other' };
const TREASURER = people.TREASURER;
async function move(fn, args, label) {
  const { data, error } = await db.rpc(fn, args);
  die(label, error);
  if (!data?.ok) { console.error(`✗ ${label}: ${JSON.stringify(data)}`); process.exit(1); }
  return data;
}

// Allocations — mirror createRepCostAllocationWithSplits
async function allocate({ description, lineItem, splits }) {
  const total = splits.reduce((sum, x) => sum + x.amount, 0);
  const alloc = await one(`allocation ${description}`, db.from('rep_cost_allocations').insert({
    org_id: orgId, description, total_amount: total, created_by: TREASURER, source_budget_line_id: lineIds[lineItem],
  }).select('id').single());
  const out = {};
  for (const sp of splits) {
    const split = await one(`split ${description}`, db.from('rep_allocation_splits').insert({
      allocation_id: alloc.id, team_id: team[sp.slug].id, program_year_id: team[sp.slug].years.active, org_id: orgId,
      amount: sp.amount, split_method: 'fixed', split_value: sp.amount, payment_schedule: sp.installments.length > 1 ? 'custom' : 'standard',
    }).select('id').single());
    out[sp.slug] = [];
    for (const [n, [amount, due]] of sp.installments.entries()) {
      out[sp.slug].push(await one(`installment ${description}`, db.from('rep_allocation_installments').insert({
        split_id: split.id, installment_number: n + 1, amount, due_date: due, org_id: orgId, team_id: team[sp.slug].id,
      }).select('id').single()));
    }
  }
  return { id: alloc.id, installments: out };
}
const DIAMOND = `Diamond fees ${Y}`;
const DUE = [daysFromNow(-45), daysFromNow(-15), daysFromNow(10)];
const three = (each) => DUE.map(d => [each, d]);
const diamond = await allocate({
  description: DIAMOND, lineItem: 'Diamond Permits',
  splits: ['15u-aaa', '15u-aa', '13u-aaa', '11u-aa', '12u-aa'].map(slug => ({ slug, amount: 1350, installments: three(450) })),
});
await allocate({
  description: `Umpire fees ${Y}`, lineItem: 'Umpire Fees',
  splits: [
    { slug: '13u-aaa', amount: 1500, installments: [[1500, daysFromNow(45)]] },
    { slug: '11u-aa',  amount: 1500, installments: [[1500, daysFromNow(45)]] },
  ],
});
const teamName = Object.fromEntries(TEAMS.map(t => [t.slug, t.name]));
async function receive(slug, n, { on, method, reference }) {
  const i = diamond.installments[slug][n - 1];
  const what = `${DIAMOND}, ${n} of 3`;
  await move('club_installment_receive', {
    p_installment: i.id, p_org: orgId, p_actor: TREASURER, p_expect: 'unpaid', p_on: on, p_method: method,
    p_method_word: METHOD_WORD[method], p_reference: reference,
    p_club_words: `Allocation received · ${teamName[slug]} · ${what}`, p_team_words: `Allocation paid to ${ORG_NAME} · ${what}`,
    p_category: 'rep_allocation',
  }, `receive ${slug} #${n}`);
}
await receive('15u-aaa', 1, { on: daysFromNow(-47), method: 'cheque', reference: '1188' });
await receive('15u-aaa', 2, { on: daysFromNow(-16), method: 'etransfer', reference: '4471' });
await receive('15u-aa', 1, { on: daysFromNow(-44), method: 'cheque', reference: '1051' });
await receive('13u-aaa', 1, { on: daysFromNow(-46), method: 'etransfer', reference: '3307' });
await receive('11u-aa', 1, { on: daysFromNow(-40), method: 'etransfer', reference: '5520' });
// 11U AA's e-Transfer came back from the bank: the club UNDOES it, with a reason the coach reads.
await move('club_installment_undo', {
  p_installment: diamond.installments['11u-aa'][0].id, p_org: orgId, p_actor: TREASURER,
  p_reason: 'The E-Transfer was returned by the bank',
}, 'undo 11u-aa #1');
// 13U AAA's coach says #2 is SENT — the coach's conditional update (no ledger line).
die('13u-aaa sent', (await db.from('rep_allocation_installments').update({
  sent_on: daysFromNow(-2), sent_method: 'etransfer', sent_reference: '88213', sent_by: coachIds['13u-aaa'], sent_at: new Date(Date.now() - 2 * DAY).toISOString(),
}).eq('id', diamond.installments['13u-aaa'][1].id).is('paid_at', null).is('sent_at', null)).error);
ok(`${DIAMOND}: 15U AA + 12U AA (no head coach) overdue · 13U AAA #2 sent, waiting · 11U AA #1 received then undone · 15U AAA on track; Umpire fees later`);

// Coach payment requests — every state, decided through the real moves
const req = async (slug, r) => one(`request ${r.description}`, db.from('rep_team_payment_requests').insert({
  org_id: orgId, team_id: team[slug].id, program_year_id: team[slug].years.active, created_by: coachIds[slug] ?? OWNER, ...r,
}).select('id').single());
const reqWords = (slug, type, description) => type === 'charge_to_org'
  ? { club: `Paid to ${teamName[slug]} · ${description}`, team: `From ${ORG_NAME} · ${description}` }
  : { club: `From ${teamName[slug]} · ${description}`, team: `Paid to ${ORG_NAME} · ${description}` };
async function approve(slug, id, type, description, { on, method, reference }) {
  const w = reqWords(slug, type, description);
  await move('club_request_approve', {
    p_request: id, p_org: orgId, p_actor: TREASURER, p_on: on, p_method: method, p_method_word: METHOD_WORD[method],
    p_reference: reference, p_club_words: w.club, p_team_words: w.team,
    p_category: type === 'charge_to_org' ? 'team_charge_to_org' : 'team_payment_to_org',
  }, `approve ${description}`);
}
await req('15u-aaa', { request_type: 'charge_to_org', money_in_meaning: 'reimbursement', amount: 480, description: 'Tournament entry — Burlington Classic', payment_method: 'etransfer', notes: 'Burlington Classic entry. The club agreed at the August meeting to cover one tournament per team.', status: 'pending', created_at: new Date(Date.now() - 9 * DAY).toISOString() });
await req('13u-aaa', { request_type: 'payment_to_org', amount: 180, description: 'Tournament refund — the club’s share', payment_method: 'cheque', status: 'pending', created_at: new Date(Date.now() - 12 * DAY).toISOString() });
const appr = await req('15u-aaa', { request_type: 'payment_to_org', amount: 350, description: 'Umpire fees owed for June', payment_method: 'etransfer', status: 'pending' });
await approve('15u-aaa', appr.id, 'payment_to_org', 'Umpire fees owed for June', { on: daysFromNow(-10), method: 'etransfer', reference: '7710' });
const clinic = await req('13u-aaa', { request_type: 'charge_to_org', money_in_meaning: 'funding', amount: 120, description: 'Umpire clinic, two coaches', payment_method: 'etransfer', status: 'pending' });
await approve('13u-aaa', clinic.id, 'charge_to_org', 'Umpire clinic, two coaches', { on: daysFromNow(-25), method: 'etransfer', reference: '6602' });
await req('15u-aa', { request_type: 'charge_to_org', money_in_meaning: 'funding', amount: 900, description: "New catcher's gear", status: 'denied', denial_reason: "Not in this year's budget — ask again in the spring.", reviewed_by: TREASURER, reviewed_at: new Date(Date.now() - 20 * DAY).toISOString() });
const float = await req('11u-aa', { request_type: 'payment_to_org', amount: 500, description: 'Fundraiser float returned', payment_method: 'cheque', status: 'pending' });
await approve('11u-aa', float.id, 'payment_to_org', 'Fundraiser float returned', { on: daysFromNow(-30), method: 'cheque', reference: '2231' });
await move('club_request_reverse', { p_request: float.id, p_org: orgId, p_actor: TREASURER, p_reason: 'Cheque returned by the bank' }, 'reverse float');
ok('6 coach payment requests: 2 waiting (holding payouts) · 2 approved · declined · approved then reversed');

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

// ── Club Tier Stage 3a — the club's books: a tournament's book and a transfer to it, two spellings of
// one payee (the Payees page merges them), a pending cheque, and a line voided with its reason.
const tourBook = await one('tournament book', db.from('accounting_ledgers').insert({
  org_id: orgId, entity_type: 'tournament', entity_id: tourn.id, name: `UAT Rep Club Invitational ${Y}`,
}).select('id').single());
await one('tournament float', db.rpc('create_accounting_transfer', {
  p_from_ledger_id: general.id, p_to_ledger_id: tourBook.id, p_amount: 500, p_entry_date: daysFromNow(-8),
  p_description: 'Tournament float', p_category: 'Transfer', p_created_by: TREASURER,
}));
const payee = async (name) => one(`payee ${name}`, db.from('org_payees').insert({ org_id: orgId, team_id: null, name, created_by: TREASURER }).select('id').single());
const mizuno = await payee('Mizuno Canada');
const mizunoLtd = await payee('Mizuno Canada Ltd.');
const town = await payee('Town of Milton');
// ⚖ Ledger Parity D7 (2026-10-02): one payee the club SHARES with its teams (in every team's picker under
// "Shared by your club"), the two Mizuno spellings kept as the club's own. The D7a clock starts here.
die('share Town of Milton', (await db.from('org_payees').update({ shared_with_teams: true, shared_at: new Date().toISOString() }).eq('id', town.id)).error);
die('gear 1', (await entry(general.id, { entry_date: daysFromNow(-33), description: 'Helmets and catcher gear', amount: 1200, entry_type: 'expense', category: 'Equipment', payment_method: 'Cheque 2201', payee_id: mizuno.id, payee_payer: 'Mizuno Canada', created_by: TREASURER })).error);
die('gear 2', (await entry(general.id, { entry_date: daysFromNow(-12), description: 'Practice balls', amount: 340, entry_type: 'expense', category: 'Equipment', payment_method: 'Card', payee_id: mizunoLtd.id, payee_payer: 'Mizuno Canada Ltd.', created_by: TREASURER })).error);
die('permit 2', (await entry(general.id, { entry_date: daysFromNow(-3), description: 'Diamond permit', amount: 1850, entry_type: 'expense', category: 'Facilities', payment_method: 'Cheque 2231', payee_id: town.id, payee_payer: 'Town of Milton', created_by: TREASURER })).error);
die('pending cheque', (await entry(general.id, { entry_date: daysFromNow(-1), description: 'Umpires’ association fees', amount: 640, entry_type: 'expense', category: 'Officials', payment_method: 'Cheque 2230', status: 'pending', notes: 'Not cleared yet', created_by: TREASURER })).error);
die('void line', (await entry(general.id, { entry_date: daysFromNow(-6), description: 'Umpire clinic registration', amount: 240, entry_type: 'expense', category: 'Training', payment_method: 'Card', status: 'void', void_reason: 'Entered twice', voided_by: TREASURER, voided_at: new Date(Date.now() - 5 * DAY).toISOString(), created_by: TREASURER })).error);
ok('books: the tournament\'s own book + a $500.00 float to it · payees "Mizuno Canada" and "Mizuno Canada Ltd." (the club\'s own) and "Town of Milton" (shared with teams) · a pending cheque · a void');

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

// ── Club Tier Stage 2 · session 3 — invitations, templates and signatures ──────────────────
// A pending HEAD-COACH invitation on 9U AA to a brand-new address (the board's amber "Invited", and
// the arrival walk: its accept link is printed below, because the raw token lives only in a link).
// A previous run's account for that address is deleted first, so the walk always meets the
// "new to FieldLogicHQ" page rather than "Welcome back".
const NEW_COACH_EMAIL = 'uat-club-newcoach@uat-rep-club.local';
const priorNewCoach = await findUserByEmail(NEW_COACH_EMAIL);
if (priorNewCoach) die('delete prior new coach', (await db.auth.admin.deleteUser(priorNewCoach.id)).error);
inviteToken = crypto.randomBytes(32).toString('base64url');
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
die('head-coach invitation', (await db.from('assistant_invite_tokens').insert({
  org_id: orgId, team_id: team['9u-aa'].id, program_year_id: team['9u-aa'].years.draft,
  invited_by_user_id: OWNER, invited_by_name: 'Morgan Ellis', invited_email: NEW_COACH_EMAIL, team_name: '9U AA',
  token_hash: hashToken(inviteToken), status: 'pending', coach_role: 'head_coach', sent_by: 'club', staff_kind: null,
})).error);
// A club invitation waiting on an EXISTING coach's home page: 11U AA's head coach, asked to help coach
// 16U AA (a team between seasons, so accepting lands on its closed-season page).
die('home-card invitation', (await db.from('assistant_invite_tokens').insert({
  org_id: orgId, team_id: team['16u-aa'].id, program_year_id: team['16u-aa'].years.completed,
  invited_by_user_id: OWNER, invited_by_name: 'Morgan Ellis', invited_email: 'uat-club-coach-11aa@uat-rep-club.local', team_name: '16U AA',
  token_hash: hashToken(crypto.randomBytes(32).toString('base64url')), status: 'pending', coach_role: 'assistant_coach', sent_by: 'club', staff_kind: 'assistant',
})).error);
ok('invitations: 9U AA head coach (new address, link below) · 16U AA assistant (11U AA\'s coach, on their home page)');

// Club-published templates (two on, one switched off) and signed copies on two teams — the board's
// Documents column reads "9 of 12" on 15U AAA, "12 of 12" on 13U AAA and "0 of 12" elsewhere.
// Files at FIXED paths with upsert, so a rebuild never strands copies in storage.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const filePath = (name) => `${ORG_SLUG}-fixture/${name}`;
for (const name of ['participant-waiver.pdf', 'medical-consent.pdf', 'code-of-conduct-2024.pdf', 'signed-form.pdf']) {
  die(`upload ${name}`, (await db.storage.from('rep-team-documents').upload(filePath(name), PDF, { contentType: 'application/pdf', upsert: true })).error);
}
const template = async (t) => one(`template ${t.name}`, db.from('rep_document_templates').insert({
  org_id: orgId, published_by: OWNER, storage_path: filePath(t.file), file_name: t.file, file_size: PDF.length, ...t.row,
}).select('id').single());
const waiver = await template({ name: 'Participant waiver', file: 'participant-waiver.pdf', row: { name: `Participant waiver ${Y}`, document_type: 'waiver', team_id: null, is_active: true } });
const medical = await template({ name: 'Medical consent', file: 'medical-consent.pdf', row: { name: 'Medical consent — travel', document_type: 'medical_consent', team_id: team['15u-aaa'].id, is_active: true } });
await template({ name: 'Code of conduct', file: 'code-of-conduct-2024.pdf', row: { name: 'Code of conduct (old)', document_type: 'code_of_conduct', team_id: null, is_active: false } });
const playersOf = async (slug) => one(`players ${slug}`, db.from('rep_roster_players').select('id')
  .eq('program_year_id', team[slug].years.active).order('display_order', { ascending: true }));
const signed = (players, slug, type, templateId) => players.map(p => ({
  player_id: p.id, team_id: team[slug].id, org_id: orgId, document_type: type, template_id: templateId,
  storage_path: filePath('signed-form.pdf'), file_name: 'signed-form.pdf', file_size: PDF.length, uploaded_by: coachIds[slug],
}));
const p15 = await playersOf('15u-aaa');
const p13 = await playersOf('13u-aaa');
die('signatures', (await db.from('rep_player_documents').insert([
  ...signed(p15.slice(0, 11), '15u-aaa', 'waiver', waiver.id),
  ...signed(p15.slice(0, 9), '15u-aaa', 'medical_consent', medical.id),
  ...signed(p13, '13u-aaa', 'waiver', waiver.id),
])).error);
ok('templates: waiver (every team) · medical consent (15U AAA) · an old code of conduct switched off; signatures 15U AAA 9 of 12, 13U AAA 12 of 12');

// ── Families: mint the people (the same call every Families read makes) ────────────────
die('families attach', (await db.rpc('families_attach_people', { p_org_id: orgId })).error);
ok('families attached');

head('Done');
printSignIns();

function printSignIns() {
  console.log(`  Club:      http://localhost:3000/${ORG_SLUG}/admin   ·   public page http://localhost:3000/${ORG_SLUG}`);
  for (const p of board) console.log(`  ${p.role.padEnd(17)} ${p.email}  /  ${p.password}`);
  for (const t of TEAMS.filter(x => x.coach)) console.log(`  coach ${t.name.padEnd(11)} ${t.coach.email}  /  ${DEFAULT_PASSWORD}`);
  console.log(`  new coach (9U AA head-coach invitation, no account yet): ${'uat-club-newcoach@uat-rep-club.local'}`);
  console.log(inviteToken
    ? `    accept link: http://localhost:3000/auth/accept-assistant-invite?token=${inviteToken}`
    : '    accept link: printed only when the fixture is built (--reset) — or Resend it from 9U AA › Coaches');
  console.log('  ⚠ Dev-only credentials.');
}
