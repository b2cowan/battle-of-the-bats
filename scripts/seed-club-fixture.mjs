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
 *   · Nine rep teams in two groups: Senior (15U AAA, 15U AA, 16U AA, 14U AA, 18U AA — archived) and Junior
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
 *   · Club Tier Stage 3b (the screens, 2026-10-06): revenue on the plan — a sponsor line (dated) and a grant line
 *     with NO date yet; TWO allocations from Diamond permits with some of the line still left to allocate; the
 *     club's lines FILED under the plan's words (one under a word with no line: off-plan), two older ones left
 *     Not filed; the tournament's book taking in its registrations; two teams recording payments to the shared
 *     payee after it was shared (the payee report); and money in on three teams, 16U AA's on its CLOSED season,
 *     so each team's cash on hand — and a team between seasons — reads a real figure.
 *   · Club Tier Stage 3c (the fiscal year, 2026-10-07): the club runs a SEPTEMBER fiscal year. The year before the
 *     one today falls in (2025–26 when built in the fall of 2026) is CLOSED — through the real one step
 *     (`club_fiscal_year_close`), with its locked closing — and at its close it still held open money: unpaid
 *     installments on its bill (13U AAA's, and 14U AA's on a FINISHED 2026 Season while its 2027 Season runs —
 *     call 1 and the Club tab's earlier bills; 14U AA's first payment, recorded now, counts in its 2027 Season), a
 *     request waiting on the club, a line filed under no word and an uncleared cheque. Today's year is open, with
 *     the plan above (Diamond permits has $450.00 left for the New allocation walk). Town of Milton, shared with the
 *     teams, has the club's records in both years. Everything the closed year holds is dated INSIDE it, never
 *     days-from-now (those drift between years with the calendar).
 *   · A SECOND club, `uat-calendar-club` ("UAT Calendar Club" — January, a plan this calendar year and next, nothing
 *     closed, one owner), for walking the first-time set-up and the move to September. `--calendar-club` rebuilds
 *     it alone, any time, so the transition walk can be walked again without touching UAT Rep Club.
 *
 * Run:   node --env-file=.env.local scripts/seed-club-fixture.mjs           (build if absent)
 *        node --env-file=.env.local scripts/seed-club-fixture.mjs --reset   (delete + rebuild)
 *        node --env-file=.env.local scripts/seed-club-fixture.mjs --calendar-club   (rebuild ONLY the calendar club)
 *        node --env-file=.env.local scripts/seed-club-fixture.mjs --club-venues     (ADD the Stage 6a venues + bookings)
 *   · Club Tier Stage 6a (the venue book and the clash check, 2026-10-08): the club's Venue library — Lions Park
 *     (Diamonds 1–3), Kinsmen Park (Diamonds A, B), Westfield School (no facilities) — 13U AAA's own places (its own
 *     "Lions Park", never merged, and Centennial Park), and a week of bookings on them from the first Tuesday at least
 *     a week out: 14U AA on Lions Park Diamond 2 against 13U AAA's practice (the hub's clash), 11U AA at Lions Park
 *     with no diamond set, 11U AA on Kinsmen Park Diamond B, and in the house league Reds vs Blues on Diamond B.
 *     `--club-venues` adds just this to a fixture that exists — additive, re-runnable, never a reset.
 * Without --reset an existing fixture is left alone (and its sign-ins printed): a walk in progress
 * must never be rebuilt under the walker by an accidental re-run.
 *
 * ⚠ DEV ONLY. Refuses to run against the production project. Sign-ins default to the standing
 * UAT password and can be overridden with UAT_REP_CLUB_{OWNER,ADMIN,TREASURER,REGISTRAR}_{EMAIL,PASSWORD}
 * (the `UAT_REP_CLUB_` prefix because `UAT_CLUB_ORG_SLUG` already names the OTHER club org).
 */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { insertCommitmentWithRecords, paidOnce } from './lib/seed-commitment-records.mjs';

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

// ── The fiscal year (Club Tier Stage 3c) — UAT Rep Club runs September to August ─────────────────────────────
// The pure rule's twin for a club with no short year (lib/club-fiscal-year.ts `fiscalYearOf`); the database finds
// the same years (`club_fiscal_year_ensure`). The fixture's two years are found from TODAY, so the shape — one
// closed year, one open — holds whenever it is built; their names follow ("2025–26", "2026–27" in the fall of 2026).
const FIRST_MONTH = 9;
const TODAY = isoDate(Date.now());
const pad2 = (n) => String(n).padStart(2, '0');
const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fyFirstOf = (day) => `${Number(day.slice(5, 7)) >= FIRST_MONTH ? Number(day.slice(0, 4)) : Number(day.slice(0, 4)) - 1}-${pad2(FIRST_MONTH)}-01`;
const fyOf = (day) => {
  const first = fyFirstOf(day);
  const last = addDays(`${Number(first.slice(0, 4)) + 1}${first.slice(4)}`, -1);
  return { first, last, name: first.slice(0, 4) === last.slice(0, 4) ? first.slice(0, 4) : `${first.slice(0, 4)}–${last.slice(2, 4)}` };
};
const CUR = fyOf(TODAY);                      // the open year
const PREV = fyOf(addDays(CUR.first, -1));    // the year the fixture CLOSES
/** A day by its month in the open year (September–December of its first calendar year, January–August of its second), or the closed one. */
const dayIn = (fy) => (month, day = 1) => `${Number(fy.first.slice(0, 4)) + (month >= FIRST_MONTH ? 0 : 1)}-${pad2(month)}-${pad2(day)}`;
const inCur = dayIn(CUR);
const inPrev = dayIn(PREV);
/** The calendar year the closed fiscal year's season was PLAYED in (spring and summer: its second calendar year). */
const PLAYED = Number(PREV.last.slice(0, 4));

// The second club (Club Tier Stage 3c): on January, for the first-time set-up and the move to September.
const CAL_SLUG = 'uat-calendar-club';
const CAL_NAME = 'UAT Calendar Club';
const CAL_MARKER = '[UAT_PROTECTED] Club Tier Stage 3c transition fixture — scripts/seed-club-fixture.mjs (rebuild with --calendar-club). Do not wipe.';
const CAL_OWNER = {
  name: 'Jamie Laurent', title: 'Treasurer',
  email: (process.env.UAT_CALENDAR_CLUB_OWNER_EMAIL ?? 'uat-calendar-owner@uat-rep-club.local').toLowerCase(),
  password: process.env.UAT_CALENDAR_CLUB_OWNER_PASSWORD ?? DEFAULT_PASSWORD,
};
// Club Tier Stage 6a (`--club-venues` and the full build) — the club's venues and a week of bookings on them; the step
// itself is `addClubVenues`, at the end of this file.
/** The one marker on every row this step writes — a re-run deletes exactly these and writes them again. */
const SIXA_MARK = 'Seeded for the Stage 6 walks (scripts/seed-club-fixture.mjs --club-venues).';
const SIXA_VENUES = [
  { name: 'Lions Park', address: '41 Lions Park Dr', facilities: ['Diamond 1', 'Diamond 2', 'Diamond 3'] },
  { name: 'Kinsmen Park', address: '200 Kinsmen Way', facilities: ['Diamond A', 'Diamond B'] },
  { name: 'Westfield School', address: '120 Westfield Rd', facilities: [] },
];
/** Filled by addClubVenues, read by printClubVenues. */
let sixaDates = null;

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
  // Club Tier Stage 3c — call 1 and the Club tab's earlier bills: a team whose season played in the closed fiscal
  // year is FINISHED, still owing on a bill made on it, while its next season runs.
  { slug: '14u-aa',  name: '14U AA',  division: '14U', group: 'Senior', color: '#065F46', years: ['completed', 'active'],
    seasonYears: { completed: PLAYED, active: PLAYED + 1 },
    coach: { email: 'uat-club-coach-14aa@uat-rep-club.local', name: 'Taylor Brooks' } },
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

// ── Club Tier Stage 6a — `--club-venues`: ADD the club's venues and a week of bookings on them, and stop ──────
// Additive, never a reset (a reset ends every session's club sign-ins). Re-running replaces exactly what this
// step wrote (rows it marks), so it can be run again before a walk without touching anything else.
if (process.argv.includes('--club-venues')) {
  head(`Club Tier Stage 6a — venues and bookings for ${ORG_NAME} (added; nothing rebuilt)`);
  await addClubVenues();
  head('Done');
  printClubVenues();
  process.exit(0);
}

// ── Club Tier Stage 3c — `--calendar-club`: rebuild ONLY the calendar club, and stop ────────────────
if (process.argv.includes('--calendar-club')) {
  head(`Rebuilding ${CAL_NAME} (${CAL_SLUG}) — UAT Rep Club untouched`);
  await buildCalendarClub();
  head('Done');
  printCalendarClub();
  process.exit(0);
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
  // Club Tier Stage 3c: a September fiscal year (a club with nothing yet just takes the month).
  fiscal_first_month: FIRST_MONTH,
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
    const year = t.seasonYears?.[status] ?? yearFor(status);
    const py = await one(`year ${t.name} ${year}`, db.from('rep_program_years').insert({
      team_id: row.id, org_id: orgId, name: `${year} Season`, year, status,
      tryout_open: status === 'active' && !!t.tryoutsOpen,
      tryout_description: status === 'active' && t.tryoutsOpen ? `Tryouts for the ${t.name} ${year} roster. Bring a glove, cleats and water.` : null,
    }).select('id').single());
    team[t.slug].years[status] = py.id;
  }
}
ok(`9 teams in 2 groups (18U AA archived; 12U AA has no head coach; 16U AA between seasons; 14U AA on its ${PLAYED + 1} Season, its ${PLAYED} finished); years ${Y - 1} completed · ${Y} active · ${Y + 1} draft (9U AA)`);

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
ok('6 head coaches — membership + staff membership + season projection each (16U AA’s on its closed season)');

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
  { cat: 'Facilities', item: 'Diamond Permits', description: 'Diamond permits — city fields', months: [[4, 3000], [5, 3000], [6, 3000]] },
  { cat: 'Officials',  item: 'Umpire Fees',     description: 'Umpire fees — home games',     months: [[5, 1500], [6, 1500], [7, 1500]] },
  { cat: 'Admin',      item: 'Insurance',       description: 'Club insurance',               months: [[4, 2500]] },
  { cat: 'Tournaments', item: 'Entry Fees',     description: 'Tournament entry fees',        months: [[6, 1500], [7, 1500]] },
  // Revenue (Club Tier 3b, Ask 4b): a sponsor line split across the year, and a grant with no date yet.
  { cat: 'Sponsorship', item: 'Team sponsorship', description: 'Club sponsors',             months: [[3, 1500], [9, 1500]] },
  { cat: 'Sponsorship', item: 'Grant',            description: 'Town recreation grant',     months: [], total: 2000 },
];
// ⚖ Club Tier Stage 3c: the plan is the OPEN fiscal year's (September to August) — each month falls in that year,
// so April–August are next spring and summer, September–December this fall. The closed year has its own plan below.
const curYearId = await one('open fiscal year', db.rpc('club_fiscal_year_ensure', { p_org: orgId, p_day: CUR.first }));
const lineIds = {};
for (const [i, b] of BUDGET.entries()) {
  const w = word(b.cat, b.item);
  if (!w) die(`budget word ${b.cat} › ${b.item}`, { message: 'not in the platform library — a plan line needs its word' });
  const total = b.total ?? b.months.reduce((s, [, a]) => s + a, 0);
  const line = await one(`budget line ${b.description}`, db.from('org_budget_lines').insert({
    org_id: orgId, fiscal_year_id: curYearId, category_id: w?.category_id ?? null, item_id: w?.id ?? null,
    description: b.description, total_amount: total, sort_order: i,
  }).select('id').single());
  lineIds[b.item] = line.id;
  if (!b.months.length) continue;   // "No date yet": a line with no periods
  die(`periods ${b.description}`, (await db.from('org_budget_periods').insert(b.months.map(([m, amount], j) => ({
    budget_line_id: line.id, period_label: inCur(m).slice(0, 7), period_date: inCur(m), amount, sort_order: j,
  })))).error);
}
ok(`${CUR.name} plan (the open fiscal year): 4 cost lines split by month · revenue: Club sponsors (dated) + Town recreation grant (no date yet)`);

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

// Allocations — the rows club_allocation_create writes (mig 317), inserted directly
async function allocate({ description, lineItem, lineId, splits }) {
  const total = splits.reduce((sum, x) => sum + x.amount, 0);
  const alloc = await one(`allocation ${description}`, db.from('rep_cost_allocations').insert({
    org_id: orgId, description, total_amount: total, created_by: TREASURER, source_budget_line_id: lineId ?? lineIds[lineItem],
  }).select('id').single());
  const out = {};
  for (const sp of splits) {
    const split = await one(`split ${description}`, db.from('rep_allocation_splits').insert({
      allocation_id: alloc.id, team_id: team[sp.slug].id, program_year_id: team[sp.slug].years[sp.season ?? 'active'], org_id: orgId,
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

// ── Club Tier Stage 3b — what the §F walks read (the screens, 2026-10-06) ──────────────────────────────
// Straight to the tables, as the books above are. Since mig 317 a club ledger line carries the coach's two
// columns (a budget category and a word); a FILED line writes no free-text category.
const platformWord = (cat, item) => {
  const w = word(cat, item);
  if (!w) die(`word ${cat} › ${item}`, { message: 'not in the platform library' });
  return w;
};
const filed = (cat, item) => { const w = platformWord(cat, item); return { budget_category_id: w.category_id, budget_item_id: w.id }; };
const fileUnder = async (ledgerId, description, cat, item) => {
  const { data, error } = await db.from('accounting_entries').update({ ...filed(cat, item), category: null })
    .eq('ledger_id', ledgerId).eq('description', description).select('id');
  die(`file ${description}`, error);
  if (!data?.length) die(`file ${description}`, { message: 'no such line on the book' });
};
await fileUnder(general.id, 'Sponsorship — Maple Hardware', 'Sponsorship', 'Team sponsorship');
await fileUnder(general.id, 'Diamond permit', 'Facilities', 'Diamond Permits');
await fileUnder(general.id, 'Umpires’ association fees', 'Officials', 'Umpire Fees');        // the pending cheque
await fileUnder(general.id, 'Helmets and catcher gear', 'Facilities', 'Field Equipment');    // a word with no line: Off-plan
// Left Not filed on purpose, as lines typed before 3b read: "Diamond permits — spring block", "Practice balls".

// A second allocation from Diamond permits ($9,000.00 planned; $6,750.00 + $1,800.00 allocated, $450.00 left).
// ⚠ Not named "Diamond fees …": the layout sweep finds THE Diamond fees allocation by that prefix.
await allocate({
  description: `Fall ball diamond fees ${Y}`, lineItem: 'Diamond Permits',
  splits: [
    { slug: '15u-aaa', amount: 900, installments: [[900, daysFromNow(30)]] },
    { slug: '13u-aaa', amount: 900, installments: [[900, daysFromNow(30)]] },
  ],
});

// The tournament's book takes money in of its own, beside its float (the Months grid's other-books row).
die('tournament registrations', (await entry(tourBook.id, {
  entry_date: daysFromNow(-20), description: 'Team registrations — three visiting teams', amount: 1440, entry_type: 'income',
  payment_method: 'E-Transfer', ...filed('Tournaments', 'Registration revenue'), created_by: TREASURER,
})).error);

// Two teams record payments to the shared payee AFTER it was shared (the report counts from the share).
const permitWord = platformWord('Facilities', 'Diamond Permits');
const toTown = (slug, description) => ({
  org_id: orgId, team_id: team[slug].id, program_year_id: team[slug].years.active, expense_type: 'expense', description,
  category: 'Facilities', budget_category_id: permitWord.category_id, budget_item_id: permitWord.id,
  payee_id: town.id, payee_payer: 'Town of Milton', created_by: coachIds[slug] ?? OWNER,
});
await insertCommitmentWithRecords(db, { row: toTown('15u-aaa', 'Diamond rental — Lions Park'), ...paidOnce(375, daysFromNow(-9)) });
await insertCommitmentWithRecords(db, {
  row: toTown('13u-aaa', 'Diamond rental — Bennett Park'),
  installments: [{ amount: 250, dueDate: daysFromNow(-20) }, { amount: 250, dueDate: daysFromNow(-4) }],
  payments: [{ amount: 250, paidDate: daysFromNow(-20), installmentNumber: 1 }, { amount: 250, paidDate: daysFromNow(-4), installmentNumber: 2 }],
});

// Money in on three teams, so each one's cash on hand reads a real figure — 16U AA's on its CLOSED season
// (a team between seasons shows its last closed season's closing figure).
const moneyIn = (slug, yearKey, r, cat, item) => db.from('rep_team_money_in').insert({
  org_id: orgId, team_id: team[slug].id, program_year_id: team[slug].years[yearKey], entry_kind: 'income',
  ...filed(cat, item), created_by: coachIds[slug] ?? OWNER, ...r,
});
die('15u-aaa bottle drive', (await moneyIn('15u-aaa', 'active', { amount: 1200, received_date: daysFromNow(-30), description: 'Bottle drive' }, 'Fundraising', 'Fundraising drive')).error);
die('13u-aaa sponsor', (await moneyIn('13u-aaa', 'active', { amount: 800, received_date: daysFromNow(-26), description: 'Team sponsor — Halton Auto', received_from: 'sponsor' }, 'Sponsorship', 'Team sponsorship')).error);
die('16u-aa last season', (await moneyIn('16u-aa', 'completed', { amount: 310, received_date: `${Y - 1}-06-15`, description: 'Bottle drive' }, 'Fundraising', 'Fundraising drive')).error);
ok('3b: four club lines filed (one off-plan), two Not filed · "Fall ball diamond fees" from Diamond permits ($450.00 left) · the tournament\'s book takes in $1,440.00 · 15U AAA and 13U AAA paid Town of Milton · money in on 15U AAA, 13U AAA and 16U AA (closed season)');

// ── Club Tier Stage 3c — the year before, which the fixture CLOSES at the very end (after every write) ───────
// Its plan, its bill and its books, dated INSIDE it. ⚠ The bill is named outside the "Diamond fees" prefix: the
// layout sweep finds THE Diamond fees allocation by that prefix.
const prevYearId = await one('closed fiscal year', db.rpc('club_fiscal_year_ensure', { p_org: orgId, p_day: PREV.first }));
const PREV_PLAN = [
  { cat: 'Facilities',  item: 'Diamond Permits',  description: 'Diamond permits — city fields', months: [[4, 2500], [5, 2500], [6, 2500]] },
  { cat: 'Admin',       item: 'Insurance',        description: 'Club insurance',               months: [[4, 2400]] },
  { cat: 'Sponsorship', item: 'Team sponsorship', description: 'Club sponsors',                months: [[10, 1500], [3, 1500]] },
  { cat: 'Sponsorship', item: 'Grant',            description: 'Town recreation grant',        months: [[11, 2000]] },
];
const prevLineIds = {};
for (const [i, b] of PREV_PLAN.entries()) {
  const w = platformWord(b.cat, b.item);
  const line = await one(`${PREV.name} line ${b.description}`, db.from('org_budget_lines').insert({
    org_id: orgId, fiscal_year_id: prevYearId, category_id: w.category_id, item_id: w.id,
    description: b.description, total_amount: b.months.reduce((s, [, a]) => s + a, 0), sort_order: i,
  }).select('id').single());
  prevLineIds[b.item] = line.id;
  die(`${PREV.name} periods ${b.description}`, (await db.from('org_budget_periods').insert(b.months.map(([m, amount], j) => ({
    budget_line_id: line.id, period_label: inPrev(m).slice(0, 7), period_date: inPrev(m), amount, sort_order: j,
  })))).error);
}

// Its bill, from its Diamond permits line: 15U AAA paid in full inside the year; 13U AAA's second still owed;
// 14U AA's on its FINISHED season — the first paid NOW (call 1: it counts in 14U AA's running season), the second
// still owed (the Club tab's earlier bills).
const PERMIT_SHARE = `Permit share ${PREV.name}`;
const permitShare = await allocate({
  description: PERMIT_SHARE, lineId: prevLineIds['Diamond Permits'],
  splits: [
    { slug: '15u-aaa', amount: 1200, installments: [[600, inPrev(5, 15)], [600, inPrev(7, 15)]] },
    { slug: '13u-aaa', amount: 1200, installments: [[600, inPrev(5, 15)], [600, inPrev(7, 15)]] },
    { slug: '14u-aa', season: 'completed', amount: 1200, installments: [[600, inPrev(5, 15)], [600, inPrev(7, 15)]] },
  ],
});
async function receiveShare(slug, n, { on, method, reference }) {
  const what = `${PERMIT_SHARE}, ${n} of 2`;
  await move('club_installment_receive', {
    p_installment: permitShare.installments[slug][n - 1].id, p_org: orgId, p_actor: TREASURER, p_expect: 'unpaid', p_on: on,
    p_method: method, p_method_word: METHOD_WORD[method], p_reference: reference,
    p_club_words: `Allocation received · ${teamName[slug]} · ${what}`, p_team_words: `Allocation paid to ${ORG_NAME} · ${what}`,
    p_category: 'rep_allocation',
  }, `receive ${slug} ${what}`);
}
await receiveShare('15u-aaa', 1, { on: inPrev(5, 14), method: 'cheque', reference: '1102' });
await receiveShare('15u-aaa', 2, { on: inPrev(7, 10), method: 'etransfer', reference: '4389' });
await receiveShare('13u-aaa', 1, { on: inPrev(5, 20), method: 'etransfer', reference: '3290' });
await receiveShare('14u-aa', 1, { on: addDays(TODAY, -5), method: 'etransfer', reference: '6014' });

// Its books: revenue and costs filed under the plan's words, one Town of Milton record (the shared payee's
// records in two fiscal years), a line filed under NO word, and a cheque still uncleared at the close.
await one(`${PREV.name} books`, db.from('accounting_entries').insert([
  { entry_date: inPrev(10, 20), description: 'Sponsorship — Halton Hills Dental', amount: 1500, entry_type: 'income', payment_method: 'Cheque 0981', ...filed('Sponsorship', 'Team sponsorship') },
  { entry_date: inPrev(3, 12), description: 'Sponsorship — Milton Home Hardware', amount: 1500, entry_type: 'income', payment_method: 'Cheque 1007', ...filed('Sponsorship', 'Team sponsorship') },
  { entry_date: inPrev(11, 18), description: 'Town recreation grant', amount: 2000, entry_type: 'income', payment_method: 'E-Transfer 2210', ...filed('Sponsorship', 'Grant') },
  { entry_date: inPrev(4, 2), description: 'Club insurance — annual premium', amount: 2380, entry_type: 'expense', payment_method: 'E-Transfer 7720', ...filed('Admin', 'Insurance') },
  { entry_date: inPrev(4, 18), description: 'Diamond permits — spring block (Town)', amount: 3900, entry_type: 'expense', payment_method: 'Cheque 2104', payee_id: town.id, payee_payer: 'Town of Milton', ...filed('Facilities', 'Diamond Permits') },
  { entry_date: inPrev(6, 9), description: 'Field line paint', amount: 185, entry_type: 'expense', category: 'Field supplies', payment_method: 'Card' },
  { entry_date: inPrev(8, 26), description: 'Fence repair — Lions Park', amount: 420, entry_type: 'expense', status: 'pending', payment_method: 'Cheque 2219', notes: 'Not cleared at the close', ...filed('Facilities', 'Diamond Permits') },
].map(e => ({ ledger_id: general.id, status: 'posted', created_by: TREASURER, ...e }))).select('id'));

// A request waiting on the club, filed in the closed year (a request belongs to the year it was filed in).
await req('15u-aaa', { request_type: 'charge_to_org', money_in_meaning: 'reimbursement', amount: 260, description: 'Provincials hotel deposit', payment_method: 'etransfer', status: 'pending', created_at: `${inPrev(8, 12)}T16:00:00Z` });
ok(`${PREV.name} (closed at the end): its plan · "${PERMIT_SHARE}" — 15U AAA paid, 13U AAA's second owed, 14U AA's first paid now (its ${PLAYED + 1} Season carries it) and second owed · books filed, "Field line paint" under no word, "Fence repair — Lions Park" uncleared, Town of Milton in both years · a request waiting`);

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

// ── Club Tier Stage 6a — the club's venues and a week of bookings on them (the same step `--club-venues` runs) ──
await addClubVenues();

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

// ── Club Tier Stage 3c — CLOSE the year before, through the real one step (`club_fiscal_year_close`) ──────────
// Last, after every write: the close locks every line dated in it. The step works out the closing itself (every
// book the club owns, posted through the last day); what it stores beside it (`closing_snapshot` — the open money
// as it stood, and each team's standing on the year's bills) is read here from the rows just written.
const snapshot = await closeSnapshotOf(orgId, PREV);
const closedYear = await move('club_fiscal_year_close', { p_org: orgId, p_first: PREV.first, p_actor: TREASURER, p_today: TODAY, p_snapshot: snapshot }, `close ${PREV.name}`);
ok(`${PREV.name} CLOSED — closing $${Number(closedYear.closingBalance).toFixed(2)} locked · still open at the close: ${snapshot.installments.count} installment(s), ${snapshot.requests.count} request(s), ${snapshot.unfiled.count} line(s) under no word, ${snapshot.pending.count} uncleared · ${CUR.name} open`);

// ── Club Tier Stage 3c — the calendar club ─────────────────────────────────────────────────────────────
head(`${CAL_NAME} (${CAL_SLUG})`);
await buildCalendarClub();

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
  console.log(`  Fiscal years: September to August — ${PREV.name} CLOSED (when built), ${CUR.name} open`);
  printCalendarClub();
  console.log('  ⚠ Dev-only credentials.');
}

/**
 * ⚠ A THIN COPY of `closeSnapshot` (lib/club-fiscal-reads.ts) — a seeder cannot import a server-only module, the
 * same reason every other row in this file is raw. If the close's snapshot changes there, mirror it here. The year
 * rule (a bill counts in its line's year; without a line, the year its first payment falls due), the overdue rule
 * (unpaid, not sent, due before today), the filing rule (a loop line files by its source; a line with a word is
 * filed; anything else on the club's books is "Not filed") and "a request belongs to the year it was filed in".
 */
async function closeSnapshotOf(orgId, fy) {
  const inYear = (d) => !!d && d >= fy.first && d <= fy.last;
  const dollars = (c) => Math.round(c) / 100;
  const cents = (n) => Math.round(Number(n) * 100);

  const bills = await one('snapshot bills', db.from('rep_cost_allocations')
    .select('id, created_at, org_budget_lines ( org_fiscal_years ( first_day ) ), rep_allocation_splits ( team_id, rep_teams ( name ), rep_allocation_installments ( amount, due_date, paid_at, sent_at ) )')
    .eq('org_id', orgId));
  const billYear = (a) => a.org_budget_lines?.org_fiscal_years?.first_day
    ?? fyFirstOf(a.rep_allocation_splits.flatMap(s => s.rep_allocation_installments.map(i => i.due_date)).sort()[0] ?? isoDate(a.created_at));
  const owed = [];
  const perTeam = new Map();
  for (const a of bills.filter(b => billYear(b) === fy.first)) {
    for (const s of a.rep_allocation_splits) {
      const teamName = s.rep_teams?.name ?? 'A team';
      const t = perTeam.get(s.team_id) ?? { teamId: s.team_id, teamName, billed: 0, collected: 0 };
      for (const i of s.rep_allocation_installments) {
        t.billed += cents(i.amount);
        if (i.paid_at) t.collected += cents(i.amount);
        else owed.push({ c: cents(i.amount), teamName, state: i.sent_at ? 'sent' : i.due_date < TODAY ? 'overdue' : 'upcoming' });
      }
      perTeam.set(s.team_id, t);
    }
  }
  const owedBy = (state) => dollars(owed.filter(o => o.state === state).reduce((x, o) => x + o.c, 0));

  const requests = await one('snapshot requests', db.from('rep_team_payment_requests')
    .select('amount, created_at, rep_teams ( name )').eq('org_id', orgId).eq('status', 'pending'));
  const waiting = requests.filter(r => inYear(isoDate(r.created_at)));

  const books = await one('snapshot books', db.from('accounting_ledgers').select('id, entity_type')
    .eq('org_id', orgId).in('entity_type', ['org', 'tournament', 'league_season']));
  const kindOf = new Map(books.map(b => [b.id, b.entity_type]));
  const all = await one('snapshot lines', db.from('accounting_entries')
    .select('id, ledger_id, entry_date, amount, entry_type, status, category, source_module, budget_item_id, budget_category_id, linked_entry_id, description')
    .in('ledger_id', [...kindOf.keys()]));
  const ledgerOf = new Map(all.map(l => [l.id, l.ledger_id]));
  const ownTransfer = (l) => (l.entry_type === 'transfer_in' || l.entry_type === 'transfer_out') && kindOf.has(ledgerOf.get(l.linked_entry_id));
  const moves = (l) => l.status !== 'void' && !ownTransfer(l);
  const lines = all.filter(l => inYear(l.entry_date));
  const LOOP_KEYS = ['rep_allocation', 'team_payment_to_org', 'team_charge_to_org'];
  const filedBySource = (l) => l.source_module === 'rep_allocation_installment' || l.source_module === 'rep_payment_request' || LOOP_KEYS.includes(l.category);
  const unfiled = lines.filter(l => l.status === 'posted' && kindOf.get(l.ledger_id) === 'org' && moves(l)
    && !filedBySource(l) && !(l.budget_item_id && l.budget_category_id));
  const pending = lines.filter(l => l.status === 'pending' && moves(l));

  const teams = [...perTeam.values()]
    .map(t => ({ teamId: t.teamId, teamName: t.teamName, billed: dollars(t.billed), collected: dollars(t.collected), owed: dollars(t.billed - t.collected) }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName, undefined, { numeric: true }));
  const sumOf = (xs, k) => dollars(xs.reduce((x, t) => x + cents(t[k]), 0));
  return {
    installments: { count: owed.length, amount: dollars(owed.reduce((x, o) => x + o.c, 0)), overdue: owedBy('overdue'), sent: owedBy('sent'), upcoming: owedBy('upcoming') },
    requests: { count: waiting.length, amount: sumOf(waiting, 'amount') },
    unfiled: { count: unfiled.length, amount: sumOf(unfiled, 'amount') },
    pending: { count: pending.length, amount: sumOf(pending, 'amount') },
    teams,
    totals: { billed: sumOf(teams, 'billed'), collected: sumOf(teams, 'collected'), owed: sumOf(teams, 'owed') },
    installmentTeams: [...new Set(owed.map(o => o.teamName))],
    requestTeams: [...new Set(waiting.map(r => r.rep_teams?.name ?? 'A team'))],
    pendingPayees: pending.map(l => l.description),
  };
}

/**
 * THE CALENDAR CLUB (Club Tier Stage 3c): a club on January — its first month never set — with a plan on this
 * calendar year and the next, for walking the first-time set-up and the move to September. This year's Diamond
 * permits line has dates on BOTH sides of September (the move splits it by its dates); its sponsors line is dated
 * only after August (it moves whole to the next year's plan); next year has a line of its own. Rebuilt whole each
 * time (`--calendar-club`): the move is one-way once the club closes a year, so a walk must be able to start again.
 */
async function buildCalendarClub() {
  const prior = await one('find calendar club', db.from('organizations').select('id, internal_notes').eq('slug', CAL_SLUG).maybeSingle());
  if (prior) {
    if (!String(prior.internal_notes ?? '').includes('seed-club-fixture.mjs')) {
      console.error(`✗ Refusing to delete ${CAL_SLUG}: it was not made by this script (no marker in internal_notes).`);
      process.exit(1);
    }
    die('delete calendar club', (await db.from('organizations').delete().eq('id', prior.id)).error);
    ok('old calendar club deleted (its sign-in kept; it is re-used)');
  }
  const calOrg = await one('calendar club', db.from('organizations').insert({
    name: CAL_NAME, slug: CAL_SLUG, plan_id: 'club', subscription_status: 'active', account_kind: 'organization',
    is_public: false, is_discoverable: false, theme_preset: 'platform', internal_notes: CAL_MARKER,
    tournament_limit: 9999, team_limit: 15, onboarding_completed_at: nowIso,
  }).select('id').single());
  const owner = await ensureUser(CAL_OWNER.email, CAL_OWNER.password, CAL_OWNER.name);
  die('calendar club owner', (await db.from('organization_members').insert({
    organization_id: calOrg.id, user_id: owner.id, role: 'owner', status: 'active',
    display_name: CAL_OWNER.name, title: CAL_OWNER.title, invited_at: nowIso, accepted_at: nowIso,
  })).error);

  const calWords = await one('budget words', db.from('budget_items')
    .select('id, name, category_id, budget_categories!inner(name, org_id)').is('org_id', null).is('budget_categories.org_id', null));
  const calWord = (cat, item) => {
    const w = calWords.find(x => x.name === item && x.budget_categories?.name === cat);
    if (!w) die(`calendar club word ${cat} › ${item}`, { message: 'not in the platform library' });
    return w;
  };
  const C = Number(TODAY.slice(0, 4));
  const PLAN = [
    { year: C,     cat: 'Facilities',  item: 'Diamond Permits',  description: 'Diamond permits — city fields', periods: [[`${C}-04-01`, 2000], [`${C}-06-01`, 2000], [`${C}-10-01`, 2000]] },
    { year: C,     cat: 'Admin',       item: 'Insurance',        description: 'Club insurance',               periods: [[`${C}-03-01`, 1200]] },
    { year: C,     cat: 'Sponsorship', item: 'Team sponsorship', description: 'Club sponsors',                periods: [[`${C}-11-01`, 2000]] },
    { year: C + 1, cat: 'Facilities',  item: 'Diamond Permits',  description: 'Diamond permits — city fields', periods: [[`${C + 1}-05-01`, 6500]] },
  ];
  for (const [i, p] of PLAN.entries()) {
    const yearId = await one(`calendar club year ${p.year}`, db.rpc('club_fiscal_year_ensure', { p_org: calOrg.id, p_day: `${p.year}-01-01` }));
    const w = calWord(p.cat, p.item);
    const line = await one(`calendar club line ${p.description} ${p.year}`, db.from('org_budget_lines').insert({
      org_id: calOrg.id, fiscal_year_id: yearId, category_id: w.category_id, item_id: w.id,
      description: p.description, total_amount: p.periods.reduce((s, [, a]) => s + a, 0), sort_order: i,
    }).select('id').single());
    die(`calendar club periods ${p.description}`, (await db.from('org_budget_periods').insert(p.periods.map(([date, amount], j) => ({
      budget_line_id: line.id, period_label: date.slice(0, 7), period_date: date, amount, sort_order: j,
    })))).error);
  }
  const book = await one('calendar club ledger', db.from('accounting_ledgers').insert({ org_id: calOrg.id, entity_type: 'org', entity_id: null, name: `${CAL_NAME} — General` }).select('id').single());
  die('calendar club books', (await db.from('accounting_entries').insert([
    { entry_date: `${C}-03-04`, description: 'Club insurance — annual premium', amount: 1180, entry_type: 'expense', payment_method: 'E-Transfer', budget_category_id: calWord('Admin', 'Insurance').category_id, budget_item_id: calWord('Admin', 'Insurance').id },
    { entry_date: `${C}-04-09`, description: 'Diamond permits — spring block', amount: 1950, entry_type: 'expense', payment_method: 'Cheque 301', budget_category_id: calWord('Facilities', 'Diamond Permits').category_id, budget_item_id: calWord('Facilities', 'Diamond Permits').id },
  ].map(e => ({ ledger_id: book.id, status: 'posted', created_by: owner.id, ...e })))).error);
  ok(`${CAL_NAME}: on January (no first month set) · plan ${C} (Diamond permits dated April, June and October; sponsors November only; insurance) and ${C + 1} · two lines on its General book · owner ${CAL_OWNER.email}`);
}

function printCalendarClub() {
  console.log(`  Calendar club: http://localhost:3000/${CAL_SLUG}/admin   (January — walk the move to September)`);
  console.log(`  owner             ${CAL_OWNER.email}  /  ${CAL_OWNER.password}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// Club Tier Stage 6a — the club's venues and a week of bookings on them (the walks of the venue book and the
// clash check; plan §6 Stage 6, hub K4MPu4ni53Ct7yrDcmWJd9 v64). ADDITIVE: it finds what exists, adds what is
// missing, and replaces only the rows it wrote itself (each marked), so it can run on a fixture mid-walk.
// The bookings pin IDENTITIES, never figures: the hub's clash is 13U AAA's Tuesday practice on Lions Park
// Diamond 2 against 14U AA's; the dates are the first Tuesday at least a week out, so they never fall behind.
// ════════════════════════════════════════════════════════════════════════════════════════════════════


/** A Toronto wall clock → the instant to store (the platform's one conversion; lib/timezone.ts's rule). */
function torontoInstant(date, time) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
    const g = Object.fromEntries(parts.map(p => [p.type, p.value]));
    guess += Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute);
  }
  return new Date(guess).toISOString();
}
/** The first `dow` (0 = Sunday) on or after `day`. */
function onOrAfter(day, dow) {
  let d = day;
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== dow) d = addDays(d, 1);
  return d;
}

async function addClubVenues() {
  const org = await one('find org', db.from('organizations').select('id').eq('slug', ORG_SLUG).single());
  const orgId = org.id;

  // 1. The Venue library — found by name, or added.
  const venue = {};
  for (const spec of SIXA_VENUES) {
    let row = await one(`venue ${spec.name}`, db.from('org_venues').select('id, name, address').eq('org_id', orgId).eq('name', spec.name).maybeSingle());
    if (!row) row = await one(`add venue ${spec.name}`, db.from('org_venues').insert({ org_id: orgId, name: spec.name, address: spec.address, notes: SIXA_MARK, is_active: true }).select('id, name, address').single());
    const facs = await one(`facilities ${spec.name}`, db.from('org_venue_facilities').select('id, name').eq('org_venue_id', row.id));
    const fac = Object.fromEntries((facs ?? []).map(f => [f.name, f.id]));
    for (const [i, name] of spec.facilities.entries()) {
      if (fac[name]) continue;
      const f = await one(`add ${spec.name} ${name}`, db.from('org_venue_facilities').insert({ org_venue_id: row.id, org_id: orgId, name, facility_type: 'diamond', display_order: i }).select('id').single());
      fac[name] = f.id;
    }
    venue[spec.name] = { ...row, fac };
  }

  // 2. The teams and their live seasons.
  const teams = await one('teams', db.from('rep_teams').select('id, name').eq('org_id', orgId));
  const teamId = (name) => {
    const t = (teams ?? []).find(x => x.name === name);
    if (!t) { console.error(`✗ ${name} is not in ${ORG_NAME} — build the fixture first.`); process.exit(1); }
    return t.id;
  };
  const liveYear = async (name) => {
    const py = await one(`live season ${name}`, db.from('rep_program_years').select('id').eq('team_id', teamId(name)).eq('status', 'active').maybeSingle());
    if (!py) { console.error(`✗ ${name} has no live season.`); process.exit(1); }
    return py.id;
  };

  // 3. 13U AAA's own places: a "Lions Park" of its own (the same name as the club's — kept, never merged) and
  //    Centennial Park (a park the club doesn't own: the quiet "isn't checked" line).
  const aaa13 = teamId('13U AAA');
  const place = {};
  for (const p of [
    { name: 'Lions Park', address: '41 Lions Park Dr', field_number: 'Diamond 2' },
    { name: 'Centennial Park', address: '77 Centennial Rd', field_number: null },
  ]) {
    let row = await one(`place ${p.name}`, db.from('rep_team_places').select('id').eq('team_id', aaa13).ilike('name', p.name).maybeSingle());
    if (!row) row = await one(`add place ${p.name}`, db.from('rep_team_places').insert({ org_id: orgId, team_id: aaa13, ...p, note: null }).select('id').single());
    place[p.name] = row.id;
  }

  // 4. A week of bookings on them — the earlier run's rows replaced, nothing else touched.
  die('clear earlier 6a events', (await db.from('rep_team_events').delete().eq('org_id', orgId).eq('description', SIXA_MARK)).error);
  const tue = onOrAfter(addDays(TODAY, 7), 2);
  const wed = addDays(tue, 1);
  const thu = addDays(tue, 2);
  const tue2 = addDays(tue, 7);
  sixaDates = { tue, wed, thu, tue2 };
  const onClub = (v, f) => ({
    location: v, location_address: venue[v].address, field_number: f, place_id: null,
    org_venue_id: venue[v].id, org_venue_facility_id: f ? venue[v].fac[f] : null,
  });
  const practice = async (team, day, from, to, where) => ({
    program_year_id: await liveYear(team), team_id: teamId(team), org_id: orgId,
    event_type: 'practice', name: 'Practice', description: SIXA_MARK, status: 'scheduled',
    starts_at: torontoInstant(day, from), ends_at: torontoInstant(day, to), ...where,
  });
  const rows = [
    // The hub's clash: 14U AA holds Lions Park Diamond 2, 5:30–7:30 p.m., two Tuesdays running; 13U AAA's 6:00–8:00
    // that first Tuesday overlaps it.
    await practice('14U AA', tue, '17:30', '19:30', onClub('Lions Park', 'Diamond 2')),
    await practice('14U AA', tue2, '17:30', '19:30', onClub('Lions Park', 'Diamond 2')),
    await practice('13U AAA', tue, '18:00', '20:00', onClub('Lions Park', 'Diamond 2')),
    // The softer line: 11U AA at Lions Park on the Wednesday, no diamond set.
    await practice('11U AA', wed, '18:00', '19:30', onClub('Lions Park', null)),
    // The house-league walk: 11U AA holds Kinsmen Park Diamond B, 6:00–7:30 p.m., both Tuesdays.
    await practice('11U AA', tue, '18:00', '19:30', onClub('Kinsmen Park', 'Diamond B')),
    await practice('11U AA', tue2, '18:00', '19:30', onClub('Kinsmen Park', 'Diamond B')),
    // The team's own place: never compared, and the form says so.
    await practice('13U AAA', thu, '18:00', '20:00', {
      location: 'Centennial Park', location_address: '77 Centennial Rd', field_number: null,
      place_id: place['Centennial Park'], org_venue_id: null, org_venue_facility_id: null,
    }),
  ];
  die('6a events', (await db.from('rep_team_events').insert(rows)).error);

  // 5. House league: two teams in U9 Rookie and one game on Kinsmen Park Diamond B (the Thursday), so a second
  //    league game there is refused under the field, while the Tuesday — held by 11U AA — saves with the line.
  const season = await one('house league season', db.from('league_seasons').select('id, name').eq('org_id', orgId).eq('slug', `${Y}-fall-house-league`).maybeSingle());
  let leagueNote = 'no house-league season in the fixture — skipped';
  if (season) {
    const div = await one('U9 Rookie', db.from('league_divisions').select('id').eq('season_id', season.id).eq('name', 'U9 Rookie').maybeSingle());
    if (div) {
      const lt = {};
      for (const [i, name] of ['Reds', 'Blues'].entries()) {
        let row = await one(`league team ${name}`, db.from('league_teams').select('id').eq('season_id', season.id).eq('name', name).maybeSingle());
        if (!row) row = await one(`add league team ${name}`, db.from('league_teams').insert({ season_id: season.id, division_id: div.id, name, sort_order: i }).select('id').single());
        lt[name] = row.id;
      }
      die('clear earlier 6a league game', (await db.from('league_games').delete().eq('season_id', season.id).eq('notes', SIXA_MARK)).error);
      die('6a league game', (await db.from('league_games').insert({
        org_id: orgId, season_id: season.id, division_id: div.id, home_team_id: lt.Reds, away_team_id: lt.Blues,
        scheduled_at: torontoInstant(thu, '18:00'), ends_at: torontoInstant(thu, '19:30'), status: 'scheduled',
        org_venue_id: venue['Kinsmen Park'].id, org_venue_facility_id: venue['Kinsmen Park'].fac['Diamond B'],
        location: 'Kinsmen Park — Diamond B', notes: SIXA_MARK,
      })).error);
      leagueNote = `${season.name}: Reds and Blues in U9 Rookie · Reds vs Blues on Kinsmen Park Diamond B, ${thu} 6:00–7:30 p.m.`;
    }
  }
  ok('venue library: Lions Park (Diamonds 1–3) · Kinsmen Park (Diamonds A, B) · Westfield School (no facilities)');
  ok('13U AAA\'s own places: Lions Park (same name as the club\'s, never merged) · Centennial Park');
  ok(`bookings: 14U AA Lions Park D2 ${tue} + ${tue2} 5:30–7:30 · 13U AAA Lions Park D2 ${tue} 6:00–8:00 (the clash) · 11U AA Lions Park, no diamond, ${wed} · 11U AA Kinsmen D-B ${tue} + ${tue2} 6:00–7:30 · 13U AAA Centennial Park ${thu}`);
  ok(leagueNote);
}

function printClubVenues() {
  if (!sixaDates) return;
  console.log(`  Stage 6a walks — the seeded Tuesday is ${sixaDates.tue} (and ${sixaDates.tue2}); Wednesday ${sixaDates.wed}; Thursday ${sixaDates.thu}`);
  console.log(`  head coach 13U AAA   uat-club-coach-13aaa@uat-rep-club.local  /  ${DEFAULT_PASSWORD}`);
  console.log('  house league         the OWNER (the house-league schedule saves for the owner or a league admin)');
}
