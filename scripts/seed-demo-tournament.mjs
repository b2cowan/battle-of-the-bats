/**
 * Seed the Tournament Admin Sandbox — the fictional demo event a prospect walks into from
 * "See it live" with no login and no email.
 *
 * ── Self-contained by design ────────────────────────────────────────────────────────────────
 *
 * The predecessor (`seed-live-tournament.mjs`) CLONED the dev fixture `dev-tournament-2026`,
 * which dragged its clutter along: stray teams, a test e-transfer payment instruction with a
 * real-looking address and password, and a dependence on `dev-test-org` existing at all. None of
 * that can be in front of a prospect, so this script builds every row from first principles out
 * of `lib/demo-tournament.ts` and touches no other organization.
 *
 * ── What it creates (idempotent) ────────────────────────────────────────────────────────────
 *
 *   • auth user   demo-organizer@example.com   (IANA-reserved domain — can never receive mail;
 *     a random password is set and deliberately NOT printed: the sandbox door mints a session
 *     server-side, so no human or script ever needs it)
 *   • organization  "Riverdale Minor Ball Association"  slug=riverdale-minor-ball
 *     plan_id=tournament_plus (D2: comped, so the sandbox shows the full product)
 *     is_discoverable=false  (hygiene: never listed in /discover)
 *   • tournament    "Riverdale Summer Classic"  slug=summer-classic
 *   • 1 venue + 2 diamonds · 2 divisions (U11 with a bracket, U13 round-robin only) · 8 teams
 *   • pool play scored deterministically, the U11 bracket seeded from the REAL standings engine,
 *     and every game anchored to the current cycle so the event is always live "today"
 *
 * Re-running wipes and recreates the tournament; the org and the demo user are reused, so their
 * ids stay stable across reseeds.
 *
 * ⚠ Refuses to run against the production project unless `--allow-prod` is passed. Creating the
 * production demo org is an explicit release step with the owner, never a side effect.
 *
 * Run: node --env-file=.env.local scripts/seed-demo-tournament.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes } from 'crypto';
import { computeTournamentStandings } from '../lib/tie-breakers.ts';
import { getDemoOrgByKind, DEMO_TOURNAMENT_SLUG } from '../lib/demo-org.ts';
import {
  DEMO_ORG_NAME, DEMO_TOURNAMENT_NAME, DEMO_VENUE_NAME, DEMO_FACILITIES,
  DEMO_DIVISIONS, DEMO_PLAYOFF_CONFIG, DEMO_TOURNAMENT_SETTINGS, DEMO_GAME_DURATION_MINUTES,
  DEMO_BRACKET_CODES, ROUND_ROBIN_PAIRS,
  resolveDemoState, demoCoachEmail, roundRobinFacilityIndex,
} from '../lib/demo-tournament.ts';
import {
  DEMO_OPENER_SLUG, DEMO_OPENER_NAME, OPENER_DIVISIONS, OPENER_REJECTED_TEAM,
  OPENER_PLAYOFF_CONFIG, OPENER_FEE, OPENER_TOURNAMENT_SETTINGS, openerBracketSeeds,
  resolveOpenerState,
  DEMO_INVITATIONAL_SLUG, DEMO_INVITATIONAL_NAME, INVITATIONAL_FEE,
  INVITATIONAL_TOURNAMENT_SETTINGS, resolveInvitationalState,
  registeredAtIsoFor,
} from '../lib/demo-moments.ts';

const PROD_PROJECT_REF = 'qcttcboqysynwcdyghil';
const allowProd = process.argv.includes('--allow-prod');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (supabaseUrl.includes(PROD_PROJECT_REF) && !allowProd) {
  console.error('❌ Refusing to run: this is the PRODUCTION Supabase project.');
  console.error('   Creating the production demo org is a release step to be done with the owner.');
  console.error('   Pass --allow-prod only when that decision has actually been made.');
  process.exit(1);
}

const db = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const demoOrg = getDemoOrgByKind('tournament');
if (!demoOrg) { console.error('❌ No tournament demo org registered in lib/demo-org.ts'); process.exit(1); }

const ORG_SLUG = demoOrg.slug;
const ORGANIZER_EMAIL = demoOrg.organizerEmail;
const nowIso = new Date().toISOString();

function die(label, error) {
  if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); }
}

// ── 1. the one demo organizer ────────────────────────────────────────────────────────────────
// Paged listUsers: the default page size is 50, and a dev project can easily hold more, so a
// single unpaged call would silently miss an existing user and try to recreate it.
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

let organizer = await findUserByEmail(ORGANIZER_EMAIL);
if (!organizer) {
  const { data, error } = await db.auth.admin.createUser({
    email: ORGANIZER_EMAIL,
    // Random and discarded. The sandbox door establishes the session server-side; nothing signs
    // in with a password, so a known one would be a liability with no compensating use.
    password: randomBytes(24).toString('hex'),
    email_confirm: true,
    user_metadata: { full_name: 'Demo Organizer', is_demo_account: true },
  });
  die('createUser', error);
  organizer = data.user;
  console.log(`created demo organizer ${ORGANIZER_EMAIL}`);
} else {
  console.log(`demo organizer exists ${ORGANIZER_EMAIL}`);
}

// ── 2. the demo organization ─────────────────────────────────────────────────────────────────
const orgFields = {
  name: DEMO_ORG_NAME,
  plan_id: 'tournament_plus',   // D2 — comped, so the sandbox shows the full product
  subscription_status: 'active',
  is_public: true,              // its public pages ARE the fan half of the demo
  is_discoverable: false,       // hygiene — never listed in /discover
  theme_preset: 'platform',
};

let org = (await db.from('organizations').select('*').eq('slug', ORG_SLUG).maybeSingle()).data;
if (!org) {
  const row = { id: randomUUID(), slug: ORG_SLUG, ...orgFields };
  die('insert org', (await db.from('organizations').insert(row)).error);
  org = row;
  console.log(`created org ${ORG_SLUG}`);
} else {
  // Reassert the fields that matter even if a prior run or a hand-edit moved them.
  die('update org', (await db.from('organizations').update(orgFields).eq('id', org.id)).error);
  console.log(`org exists ${ORG_SLUG} (fields reasserted)`);
}

// ── 3. membership ────────────────────────────────────────────────────────────────────────────
const membership = (await db.from('organization_members')
  .select('id').eq('organization_id', org.id).eq('user_id', organizer.id).maybeSingle()).data;
if (!membership) {
  die('insert membership', (await db.from('organization_members').insert({
    organization_id: org.id, user_id: organizer.id,
    role: 'owner', status: 'active', accepted_at: nowIso,
  })).error);
  console.log('linked demo organizer as owner');
}

// ── 4. wipe any prior demo tournament ────────────────────────────────────────────────────────
// One wipe routine for all three events — `wipeTournamentBySlug` is declared with the Phase 2
// sections below (function declarations hoist), so the delete order lives in exactly one place.
await wipeTournamentBySlug(DEMO_TOURNAMENT_SLUG);

// ── 5. the state the clock implies right now ─────────────────────────────────────────────────
const state = resolveDemoState(new Date());
const gameStateByKey = new Map(state.games.map(g => [g.key, g]));
const poolDates = state.games.filter(g => g.key.startsWith('RR-')).map(g => g.date).sort();
const startDate = poolDates[0] ?? state.eventDate;

// ── 6. tournament ────────────────────────────────────────────────────────────────────────────
const tournamentId = randomUUID();
die('insert tournament', (await db.from('tournaments').insert({
  id: tournamentId, org_id: org.id,
  slug: DEMO_TOURNAMENT_SLUG, name: DEMO_TOURNAMENT_NAME,
  year: Number(state.eventDate.slice(0, 4)),
  status: 'active', is_active: true,
  start_date: startDate, end_date: state.eventDate,
  sport: 'baseball',
  settings: DEMO_TOURNAMENT_SETTINGS,
  // Hygiene: the demo must never appear in the public directory.
  list_in_directory: false,
  require_score_finalization: false,
  notify_teams_on_complete: false,
})).error);

// ── 7. venue + diamonds ──────────────────────────────────────────────────────────────────────
// Shared with the Phase 2 events below — every demo event plays at the same fictional park.
const { venueId, facilityIds } = await insertDemoVenue(tournamentId);

// ── 8. divisions + teams ─────────────────────────────────────────────────────────────────────
const divisionIds = new Map();     // division name → id
const teamIds = new Map();         // `${division}::${team}` → id
const domainTeams = [];            // for the standings engine

for (let d = 0; d < DEMO_DIVISIONS.length; d++) {
  const division = DEMO_DIVISIONS[d];
  const divisionId = randomUUID();
  divisionIds.set(division.name, divisionId);
  die('insert division', (await db.from('divisions').insert({
    id: divisionId, tournament_id: tournamentId, name: division.name,
    display_order: d, settings: {},
    playoff_config: division.hasBracket ? DEMO_PLAYOFF_CONFIG : null,
  })).error);

  for (const team of division.teams) {
    const teamId = randomUUID();
    teamIds.set(`${division.name}::${team.name}`, teamId);
    die('insert team', (await db.from('teams').insert({
      id: teamId, tournament_id: tournamentId, division_id: divisionId,
      name: team.name, coach: team.coach, email: demoCoachEmail(team.name),
      coach_email: demoCoachEmail(team.name),
      status: 'accepted', payment_status: 'paid', registered_at: nowIso,
    })).error);
    domainTeams.push({ id: teamId, name: team.name, divisionId, status: 'accepted', poolId: null });
  }
}

// ── 9. pool play ─────────────────────────────────────────────────────────────────────────────
const domainGames = [];
let poolInserted = 0;
let unscoredCount = 0;

for (let divisionIndex = 0; divisionIndex < DEMO_DIVISIONS.length; divisionIndex++) {
  const division = DEMO_DIVISIONS[divisionIndex];
  const divisionId = divisionIds.get(division.name);
  for (let index = 0; index < ROUND_ROBIN_PAIRS.length; index++) {
    const [homeIdx, awayIdx] = ROUND_ROBIN_PAIRS[index];
    const home = division.teams[homeIdx];
    const away = division.teams[awayIdx];
    const desired = gameStateByKey.get(`RR-${division.name}-${index}`);
    const homeTeamId = teamIds.get(`${division.name}::${home.name}`);
    const awayTeamId = teamIds.get(`${division.name}::${away.name}`);
    const gameId = randomUUID();

    die('insert pool game', (await db.from('games').insert({
      id: gameId, tournament_id: tournamentId, division_id: divisionId,
      home_team_id: homeTeamId, away_team_id: awayTeamId,
      game_date: desired.date, game_time: desired.time,
      diamond_id: venueId, venue_facility_id: facilityIds[roundRobinFacilityIndex(index, divisionIndex)],
      duration_minutes: DEMO_GAME_DURATION_MINUTES,
      status: desired.status, is_playoff: false,
      home_score: desired.homeScore, away_score: desired.awayScore,
      ...(desired.status === 'completed'
        ? { score_submission_source: 'admin_results', score_submitted_at: nowIso }
        : {}),
    })).error);
    poolInserted++;
    if (desired.status !== 'completed') unscoredCount++;

    if (desired.status === 'completed') {
      domainGames.push({
        id: gameId, divisionId,
        homeTeamId, awayTeamId,
        homeScore: desired.homeScore, awayScore: desired.awayScore,
        status: 'completed', isPlayoff: false,
      });
    }
  }
}

// ── 10. the bracket, seeded by the app's OWN standings engine ────────────────────────────────
// Not by our strength table. Running the real engine is what proves the demo's bracket is the
// bracket the product would actually produce from these results — the same call the app makes
// when the last pool game is scored.
const bracketDivision = DEMO_DIVISIONS.find(d => d.hasBracket);
const bracketDivisionId = divisionIds.get(bracketDivision.name);
const standings = computeTournamentStandings(
  bracketDivisionId, domainTeams, domainGames, DEMO_PLAYOFF_CONFIG, DEMO_TOURNAMENT_SETTINGS,
);
const seedTeamId = (rank) => standings[rank - 1]?.teamId ?? null;

const sf1 = gameStateByKey.get(DEMO_BRACKET_CODES.SF1);
const sf2 = gameStateByKey.get(DEMO_BRACKET_CODES.SF2);
const fin = gameStateByKey.get(DEMO_BRACKET_CODES.FIN);

const bracketRows = [
  {
    code: DEMO_BRACKET_CODES.SF1, desired: sf1, facility: 0,
    homeTeamId: seedTeamId(1), awayTeamId: seedTeamId(4),
    homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4',
  },
  {
    code: DEMO_BRACKET_CODES.SF2, desired: sf2, facility: 1,
    homeTeamId: seedTeamId(2), awayTeamId: seedTeamId(3),
    homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #3',
  },
  {
    code: DEMO_BRACKET_CODES.FIN, desired: fin, facility: 1,
    // "Winner SF1" stays UNRESOLVED until the reconcile job fills it — that unresolved slot
    // becoming a real team is the "the bracket fills itself in" beat the whole demo is built on.
    homeTeamId: state.finalIsSeeded ? seedTeamId(1) : null,
    awayTeamId: seedTeamId(2),
    homePlaceholder: `Winner ${DEMO_BRACKET_CODES.SF1}`,
    awayPlaceholder: `Winner ${DEMO_BRACKET_CODES.SF2}`,
  },
];

for (const row of bracketRows) {
  die('insert bracket game', (await db.from('games').insert({
    id: randomUUID(), tournament_id: tournamentId, division_id: bracketDivisionId,
    home_team_id: row.homeTeamId, away_team_id: row.awayTeamId,
    home_placeholder: row.homePlaceholder, away_placeholder: row.awayPlaceholder,
    bracket_code: row.code,
    game_date: row.desired.date, game_time: row.desired.time,
    diamond_id: venueId, venue_facility_id: facilityIds[row.facility],
    duration_minutes: DEMO_GAME_DURATION_MINUTES,
    status: row.desired.status, is_playoff: true,
    home_score: row.desired.homeScore, away_score: row.desired.awayScore,
    ...(row.desired.status === 'completed'
      ? { score_submission_source: 'admin_results', score_submitted_at: nowIso }
      : {}),
  })).error);
}

// ═════════════════════════ Phase 2 — the two STILL moments of the year ═══════════════════════
// One org, three tournaments (ratified 2026-08-04). The Opener finished yesterday; the
// Invitational is three weeks out. Neither ever ticks — the reconcile job only re-anchors their
// dates — so everything below is written once and stays put until the calendar moves.

/** The one fictional park, with its four diamonds (or none, for an event with nothing scheduled). */
async function insertDemoVenue(tournamentId, { withFacilities = true } = {}) {
  const venueId = randomUUID();
  die('insert venue', (await db.from('diamonds').insert({
    id: venueId, tournament_id: tournamentId, name: DEMO_VENUE_NAME,
    address: '1 Riverdale Park Road, Riverdale ON',
  })).error);
  const facilityIds = [];
  if (withFacilities) {
    for (let i = 0; i < DEMO_FACILITIES.length; i++) {
      const id = randomUUID();
      facilityIds.push(id);
      die('insert facility', (await db.from('venue_facilities').insert({
        id, venue_id: venueId, tournament_id: tournamentId,
        name: DEMO_FACILITIES[i], facility_type: 'diamond', display_order: i,
      })).error);
    }
  }
  return { venueId, facilityIds };
}

/** Wipe a prior demo tournament by slug — the ONE delete order for all three events. */
async function wipeTournamentBySlug(slug) {
  const rows = (await db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', slug)).data;
  if (!rows?.length) return;
  const oldId = rows[0].id;
  const oldDivs = (await db.from('divisions').select('id').eq('tournament_id', oldId)).data ?? [];
  const oldVenues = (await db.from('diamonds').select('id').eq('tournament_id', oldId)).data ?? [];
  await db.from('games').delete().eq('tournament_id', oldId);
  if (oldVenues.length) await db.from('venue_facilities').delete().in('venue_id', oldVenues.map(v => v.id));
  await db.from('diamonds').delete().eq('tournament_id', oldId);
  await db.from('teams').delete().eq('tournament_id', oldId);
  if (oldDivs.length) await db.from('pools').delete().in('division_id', oldDivs.map(d => d.id));
  await db.from('divisions').delete().eq('tournament_id', oldId);
  await db.from('tournaments').delete().eq('id', oldId);
  console.log(`wiped prior ${slug}`);
}

// ── The Season Opener — finished yesterday, champion crowned ────────────────────────────────
await wipeTournamentBySlug(DEMO_OPENER_SLUG);
const opener = resolveOpenerState(new Date());

const openerId = randomUUID();
die('insert opener', (await db.from('tournaments').insert({
  id: openerId, org_id: org.id,
  slug: DEMO_OPENER_SLUG, name: DEMO_OPENER_NAME,
  year: Number(opener.endDate.slice(0, 4)),
  status: 'completed', is_active: false,
  start_date: opener.startDate, end_date: opener.endDate,
  sport: 'baseball',
  settings: OPENER_TOURNAMENT_SETTINGS,
  fee_schedule_mode: 'tournament',
  total_fee_amount: OPENER_FEE.totalFee,
  deposit_amount: OPENER_FEE.deposit,
  list_in_directory: false,
  require_score_finalization: false,
  notify_teams_on_complete: false,
  // Crowned at seed time, directly — NEVER through the scoring path, which is the one that
  // notifies. A set timestamp also means the real announce path could never claim it later.
  champions_crowned_at: `${opener.crownedDate}T21:00:00.000Z`,
})).error);

const { venueId: openerVenueId, facilityIds: openerFacilityIds } = await insertDemoVenue(openerId);

const openerDivisionIds = new Map();
const openerTeamIds = new Map();
const openerDomainTeams = [];
for (let d = 0; d < OPENER_DIVISIONS.length; d++) {
  const division = OPENER_DIVISIONS[d];
  const divisionId = randomUUID();
  openerDivisionIds.set(division.name, divisionId);
  die('insert opener division', (await db.from('divisions').insert({
    id: divisionId, tournament_id: openerId, name: division.name,
    display_order: d, settings: {},
    playoff_config: division.hasBracket ? OPENER_PLAYOFF_CONFIG : null,
  })).error);
  for (const team of division.teams) {
    const teamId = randomUUID();
    openerTeamIds.set(`${division.name}::${team.name}`, teamId);
    // Same clubs as the Summer Classic, same coaches, same contact formula — one invented world.
    die('insert opener team', (await db.from('teams').insert({
      id: teamId, tournament_id: openerId, division_id: divisionId,
      name: team.name, coach: team.coach, email: demoCoachEmail(team.name),
      coach_email: demoCoachEmail(team.name),
      status: 'accepted', payment_status: 'paid',
      deposit_paid: OPENER_FEE.deposit, total_paid: OPENER_FEE.totalFee,
      registered_at: nowIso,
    })).error);
    openerDomainTeams.push({ id: teamId, name: team.name, divisionId, status: 'accepted', poolId: null });
  }
}
// The one turned-away registration, so the Post-Event Summary's "Rejected" row tells the truth.
die('insert opener rejected team', (await db.from('teams').insert({
  id: randomUUID(), tournament_id: openerId,
  division_id: openerDivisionIds.get(OPENER_REJECTED_TEAM.division),
  name: OPENER_REJECTED_TEAM.name, coach: OPENER_REJECTED_TEAM.coach,
  email: demoCoachEmail(OPENER_REJECTED_TEAM.name),
  coach_email: demoCoachEmail(OPENER_REJECTED_TEAM.name),
  status: 'rejected', payment_status: 'pending', deposit_paid: 0, total_paid: 0,
  registered_at: nowIso,
})).error);

const openerGameByKey = new Map(opener.games.map(g => [g.key, g]));
const openerDomainGames = [];
for (let divisionIndex = 0; divisionIndex < OPENER_DIVISIONS.length; divisionIndex++) {
  const division = OPENER_DIVISIONS[divisionIndex];
  const divisionId = openerDivisionIds.get(division.name);
  for (let index = 0; index < ROUND_ROBIN_PAIRS.length; index++) {
    const [homeIdx, awayIdx] = ROUND_ROBIN_PAIRS[index];
    const home = division.teams[homeIdx];
    const away = division.teams[awayIdx];
    const desired = openerGameByKey.get(`RR-${division.name}-${index}`);
    const gameId = randomUUID();
    die('insert opener pool game', (await db.from('games').insert({
      id: gameId, tournament_id: openerId, division_id: divisionId,
      home_team_id: openerTeamIds.get(`${division.name}::${home.name}`),
      away_team_id: openerTeamIds.get(`${division.name}::${away.name}`),
      game_date: desired.date, game_time: desired.time,
      diamond_id: openerVenueId, venue_facility_id: openerFacilityIds[desired.facilityIndex],
      duration_minutes: DEMO_GAME_DURATION_MINUTES,
      status: 'completed', is_playoff: false,
      home_score: desired.homeScore, away_score: desired.awayScore,
      score_submission_source: 'admin_results', score_submitted_at: nowIso,
    })).error);
    openerDomainGames.push({
      id: gameId, divisionId,
      homeTeamId: openerTeamIds.get(`${division.name}::${home.name}`),
      awayTeamId: openerTeamIds.get(`${division.name}::${away.name}`),
      homeScore: desired.homeScore, awayScore: desired.awayScore,
      status: 'completed', isPlayoff: false,
    });
  }
}

// Seed the Opener's bracket through the app's OWN standings engine, exactly like the Classic —
// then verify the engine agrees with the strengths, because the champion depends on it.
const openerBracketDivision = OPENER_DIVISIONS.find(d => d.hasBracket);
const openerBracketDivisionId = openerDivisionIds.get(openerBracketDivision.name);
const openerStandings = computeTournamentStandings(
  openerBracketDivisionId, openerDomainTeams, openerDomainGames,
  OPENER_PLAYOFF_CONFIG, OPENER_TOURNAMENT_SETTINGS,
);
const openerSeeds = openerBracketSeeds();
if (openerStandings[0]?.teamName !== openerSeeds[0].name) {
  console.error(`❌ Opener standings disagree with strengths: engine #1 is ${openerStandings[0]?.teamName}, expected ${openerSeeds[0].name}`);
  process.exit(1);
}
const openerSeedId = (rank) => openerStandings[rank - 1]?.teamId ?? null;

const openerBracketRows = [
  { code: DEMO_BRACKET_CODES.SF1, facility: 0, homeTeamId: openerSeedId(1), awayTeamId: openerSeedId(4),
    homePlaceholder: 'Seed #1', awayPlaceholder: 'Seed #4' },
  { code: DEMO_BRACKET_CODES.SF2, facility: 1, homeTeamId: openerSeedId(2), awayTeamId: openerSeedId(3),
    homePlaceholder: 'Seed #2', awayPlaceholder: 'Seed #3' },
  { code: DEMO_BRACKET_CODES.FIN, facility: 0, homeTeamId: openerSeedId(1), awayTeamId: openerSeedId(2),
    homePlaceholder: `Winner ${DEMO_BRACKET_CODES.SF1}`, awayPlaceholder: `Winner ${DEMO_BRACKET_CODES.SF2}` },
];
for (const row of openerBracketRows) {
  const desired = openerGameByKey.get(row.code);
  die('insert opener bracket game', (await db.from('games').insert({
    id: randomUUID(), tournament_id: openerId, division_id: openerBracketDivisionId,
    home_team_id: row.homeTeamId, away_team_id: row.awayTeamId,
    home_placeholder: row.homePlaceholder, away_placeholder: row.awayPlaceholder,
    bracket_code: row.code,
    game_date: desired.date, game_time: desired.time,
    diamond_id: openerVenueId, venue_facility_id: openerFacilityIds[row.facility],
    duration_minutes: DEMO_GAME_DURATION_MINUTES,
    status: 'completed', is_playoff: true,
    home_score: desired.homeScore, away_score: desired.awayScore,
    score_submission_source: 'admin_results', score_submitted_at: nowIso,
  })).error);
}

// ── The Invitational — three weeks out, mid-registration ────────────────────────────────────
await wipeTournamentBySlug(DEMO_INVITATIONAL_SLUG);
const invitational = resolveInvitationalState(new Date());

const invitationalId = randomUUID();
die('insert invitational', (await db.from('tournaments').insert({
  id: invitationalId, org_id: org.id,
  slug: DEMO_INVITATIONAL_SLUG, name: DEMO_INVITATIONAL_NAME,
  year: Number(invitational.startDate.slice(0, 4)),
  status: 'active', is_active: true,
  start_date: invitational.startDate, end_date: invitational.endDate,
  sport: 'baseball',
  settings: INVITATIONAL_TOURNAMENT_SETTINGS,
  // Fees live on the DIVISIONS (ratified: amounts shown, instructions never) — see demo-moments.
  fee_schedule_mode: 'division',
  list_in_directory: false,
  require_score_finalization: false,
  notify_teams_on_complete: false,
})).error);

// The park without diamonds — nothing is scheduled yet, but the fan page names the venue.
await insertDemoVenue(invitationalId, { withFacilities: false });

const invitationalDivisionIds = new Map();
for (let d = 0; d < invitational.divisions.length; d++) {
  const division = invitational.divisions[d];
  const divisionId = randomUUID();
  invitationalDivisionIds.set(division.name, divisionId);
  die('insert invitational division', (await db.from('divisions').insert({
    id: divisionId, tournament_id: invitationalId, name: division.name,
    display_order: d, settings: {},
    capacity: division.capacity, is_closed: false,
    playoff_config: null,
    deposit_amount: INVITATIONAL_FEE.deposit,
    total_fee_amount: INVITATIONAL_FEE.totalFee,
    deposit_due_date: division.depositDueDate,
    total_fee_due_date: division.balanceDueDate,
  })).error);
}

for (const team of invitational.teams) {
  die('insert invitational team', (await db.from('teams').insert({
    id: randomUUID(), tournament_id: invitationalId,
    division_id: invitationalDivisionIds.get(team.division),
    name: team.name, coach: team.coach,
    email: demoCoachEmail(team.name), coach_email: demoCoachEmail(team.name),
    status: team.status,
    waitlist_position: team.waitlistPosition,
    payment_status: team.totalPaid >= INVITATIONAL_FEE.totalFee ? 'paid' : 'pending',
    deposit_paid: team.depositPaid, total_paid: team.totalPaid,
    registered_at: registeredAtIsoFor(team.registeredDate),
  })).error);
}

// ── report ───────────────────────────────────────────────────────────────────────────────────
console.log(`\n✅ Seeded the sandbox — "${DEMO_TOURNAMENT_NAME}" for ${DEMO_ORG_NAME}`);
console.log(`   Plan: tournament_plus (comped) · not discoverable · not in the directory`);
console.log(`   ${DEMO_DIVISIONS.length} divisions · ${domainTeams.length} teams · ${poolInserted + bracketRows.length} games`);
console.log(`   Window: ${startDate} → ${state.eventDate} (playoff day = today)`);
console.log(`   Cycle phase: ${state.phase} (minute ${state.minuteInCycle} of ${120})`);
console.log(`   ${unscoredCount} pool game(s) intentionally unscored → "Needs a Score" is never empty`);
console.log(`\n   ${bracketDivision.name} seeding from the real standings engine:`);
standings.forEach((s, i) => console.log(`     #${i + 1} ${s.teamName}  (${s.w}-${s.l}${s.t ? '-' + s.t : ''}, ${s.pts} pts, RD ${s.rd >= 0 ? '+' : ''}${s.rd})`));
console.log(`\n✅ Seeded the moments (Phase 2) — one org, three tournaments:`);
console.log(`   "${DEMO_OPENER_NAME}" (${DEMO_OPENER_SLUG}) — completed ${opener.startDate} → ${opener.endDate}, champion ${openerStandings[0]?.teamName}`);
console.log(`   "${DEMO_INVITATIONAL_NAME}" (${DEMO_INVITATIONAL_SLUG}) — registration open, first pitch ${invitational.startDate} (${invitational.teams.length} registrations)`);
console.log(`\n   Fan side:  /${ORG_SLUG}/${DEMO_TOURNAMENT_SLUG}`);
console.log(`   Operator:  /${ORG_SLUG}/admin/tournaments/dashboard`);
console.log(`\n   Next: the reconcile job keeps this live. Nothing here is writable through the app.`);
