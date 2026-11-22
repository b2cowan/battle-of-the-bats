/**
 * prospect-demo-rep.mjs — PHASE B of the prospect demo world: the rep side, built so ONE club carries all five presentation
 * demos (plan docs/projects/active/MILTON_DEMO_WORLD_PLAN.md §1 and §8; owner's go 2026-11-20, "option A").
 *
 *   resetRep(ctx)   called by scripts/seed-prospect-demo.mjs inside its reset, before the children go
 *   buildRep(ctx)   called after the house-league build, before families are attached
 *
 * Only runs when the club config has `repTeams` (Milton does; Kestrel Bay does not).
 *
 * ⚖ WHAT IT WRITES, and through what:
 *   · The dome's permit through `org_permit_save`, the dome schedule's part 1 through `club_schedule_save`, its bill terms as
 *     the Bill step writes them, a send row, then `club_schedule_finalize_priced` — the product's own send-and-bill step,
 *     which writes every team's practices, the allocation, its splits and installments. The bill's figures come from the
 *     product's pure bill code (`lib/club-schedule-bill.ts`), so the coach sees what the scheduler would have billed.
 *   · The dressed team's book follows the public coach sandbox's recipe (`scripts/seed-demo-coach.mjs`): the coach-side writers
 *     live in server-only code a script cannot load (plan §8.2). The derived columns are kept in step the same way.
 *   · The tournament follows the public tournament sandbox (`scripts/seed-demo-tournament.mjs`); its playoff teams are seeded
 *     by the product's own standings engine.
 *
 * ⚖ WHAT A RESET CLEARS: every rep team of the club (which takes its seasons, rosters, events, money, drills and staff rows
 * with it), the club's shared drills and tags, its schedules, permits and club bills, its bank checks and tournaments.
 * Auth users and the club's memberships are never touched; venues are kept (the dome's included).
 *
 * Team and season ids are DERIVED from the club's slug and the team's slug, so a team's Coaches Portal address survives every
 * rebuild (the run sheet links to them).
 */
import crypto from 'node:crypto';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { insertCommitmentWithRecords } from './seed-commitment-records.mjs';
import { addDays, onOrAfter, torontoInstant, minutesLater, NAME_GROUPS } from './prospect-demo-world.mjs';

export const repConfigured = (cfg) => Array.isArray(cfg.repTeams) && cfg.repTeams.length > 0;

/** A stable id for `key` inside this club (a v4-shaped uuid from a hash), so addresses survive a rebuild. */
export function stableId(cfg, key) {
  const h = crypto.createHash('sha1').update(`${cfg.slug}:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** The app's TypeScript modules import each other without extensions; the unit tests' resolver lets a script load them. */
let resolverOn = false;
async function appModule(rel) {
  if (!resolverOn) {
    register(new URL('../../tests/ts-resolver-hooks.mjs', import.meta.url), pathToFileURL('./'));
    // Node says once per .ts file that it re-parsed it as a module; true, harmless, and noise in a seed's report.
    const emit = process.emitWarning;
    process.emitWarning = (w, ...rest) => (String(w?.message ?? w).includes('Reparsing as ES module') || rest.includes('MODULE_TYPELESS_PACKAGE_JSON') || rest[0]?.code === 'MODULE_TYPELESS_PACKAGE_JSON' ? undefined : emit.call(process, w, ...rest));
    resolverOn = true;
  }
  return import(new URL(`../../${rel}`, import.meta.url).href);
}

const slugOf = (age, tier) => `${age}-${tier}`.toLowerCase();
const teamName = (age, tier) => `Milton Bats ${age} ${tier}`;
const TEAM_COLORS = ['#47156C', '#5E2B8A', '#3B1259', '#6A3D9A', '#2F0F4A', '#7B4FA6'];
const money = (n) => `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ascii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── the dressed team's softball world (generic content; the club's names and amounts are in the config) ───────────────
const DRESSED_ROSTER = [
  { first: 'Ava', last: 'Mendoza', number: '7', primary: 'SS', secondary: '2B', bats: 'R', throws: 'R' },
  { first: 'Chloe', last: 'Tremblay', number: '12', primary: 'P', secondary: '1B', bats: 'R', throws: 'R' },
  { first: 'Maya', last: 'Okafor', number: '3', primary: 'C', secondary: '3B', bats: 'R', throws: 'R' },
  { first: 'Harper', last: 'Lindqvist', number: '22', primary: '1B', secondary: 'LF', bats: 'L', throws: 'L' },
  { first: 'Sofia', last: 'Rossi', number: '5', primary: '2B', secondary: 'SS', bats: 'R', throws: 'R' },
  { first: 'Zoe', last: 'Nguyen', number: '9', primary: 'CF', secondary: 'LF', bats: 'L', throws: 'R' },
  { first: 'Ella', last: 'Sinclair', number: '15', primary: '3B', secondary: 'SS', bats: 'R', throws: 'R' },
  { first: 'Priya', last: 'Dhillon', number: '18', primary: 'LF', secondary: 'CF', bats: 'R', throws: 'R' },
  { first: 'Nora', last: 'Haddad', number: '11', primary: 'RF', secondary: '1B', bats: 'R', throws: 'R' },
  { first: 'Isabella', last: 'Costa', number: '2', primary: 'P', secondary: 'RF', bats: 'L', throws: 'L' },
  { first: 'Leah', last: 'Kowalski', number: '24', primary: 'OF', secondary: '2B', bats: 'R', throws: 'R' },
  { first: 'Amara', last: 'Mensah', number: '6', primary: 'C', secondary: '1B', bats: 'R', throws: 'R' },
];
const GUARDIAN_FIRSTS = ['Sarah', 'Marc', 'Adaeze', 'Greg', 'Gina', 'Linh', 'Julie', 'Harpreet', 'Rania', 'Elena', 'Piotr', 'Kwame'];
const OPPONENTS = ['Kelso Ridge Raptors', 'Twelve Mile Cyclones', 'Harrison Hollow Hornets', 'Cedar Line Storm'];
/** Fall ball: [days from the demo day, home/away, team score, opponent score]. Eight games, a W-L-T record with a story. */
const FALL_GAMES = [[-84, 'home', 7, 3], [-80, 'away', 2, 5], [-77, 'home', 9, 8], [-73, 'away', 4, 4], [-70, 'home', 6, 1], [-66, 'away', 3, 6], [-63, 'home', 10, 2], [-56, 'away', 5, 4]];
/** Fall practices at Sherwood Park (rep only), Tuesday evenings: days from the demo day. The first is testing day 1. */
const FALL_PRACTICES = [-86, -79, -72, -65, -58, -51];

const TEAM_DRILLS = [
  { name: 'Tee work: inside, middle, outside', minutes: 10, goal: 'Barrel to the ball on every part of the plate.', setup: 'Three tees, one per lane, a bucket each.', points: ['Hands inside the ball', 'Finish high'], equipment: ['Tees (3)', 'Balls (36)'] },
  { name: 'Front toss', minutes: 10, goal: 'Timing and a short, quick swing.', setup: 'L-screen 25 feet out, feeder kneeling.', points: ['Load early', 'Eyes on the release'], equipment: ['L-screen', 'Balls (24)'] },
  { name: 'Soft toss into the net', minutes: 10, goal: 'Hands through the zone.', setup: 'Feeder at 45 degrees, hitter into the net.', points: ['Short to the ball', 'Stay closed'], equipment: ['Hitting net', 'Balls (24)'] },
  { name: 'Bunting ladder', minutes: 10, goal: 'Put the ball down in the right zone.', setup: 'Three cones down each line.', points: ['Square early', 'Catch the ball with the bat'], equipment: ['Cones (6)'] },
  { name: 'Two-knee throwing', minutes: 5, goal: 'Upper-body mechanics without the legs.', setup: 'Partners 20 feet apart on both knees.', points: ['Elbow at shoulder height', 'Follow through to the target'], equipment: [] },
  { name: 'Long toss progression', minutes: 10, goal: 'Build arm strength gradually.', setup: 'Partners start at 30 feet and move back.', points: ['Crow hop', 'Throw on a line'], equipment: [] },
  { name: 'Short-hop ground balls', minutes: 10, goal: 'Soft hands on the short hop.', setup: 'Partners 15 feet apart, one feeds short hops.', points: ['Glove out front', 'Funnel to the belly'], equipment: ['Balls (12)'] },
  { name: 'Fly ball communication', minutes: 10, goal: 'Call it, take it, back each other up.', setup: 'Two lines in the outfield, a coach throwing high.', points: ['Call it three times', 'Centre fielder has priority'], equipment: ['Balls (12)'] },
  { name: 'Relay race', minutes: 10, goal: 'Quick catch-and-throw on the relay.', setup: 'Two lines of four, 40 feet between players.', points: ['Turn to the glove side', 'Hit the chest'], equipment: ['Balls (4)'] },
  { name: 'Base running: first to third', minutes: 10, goal: 'Round first hard and read the coach.', setup: 'Runners at home, a coach at third.', points: ['Banana turn', 'Pick up the coach early'], equipment: [] },
  { name: 'Pitcher spin drill', minutes: 10, goal: 'Tight spin from the wrist.', setup: 'Pitchers in pairs, 15 feet apart.', points: ['Snap through', 'Watch the seams'], equipment: ['Balls (6)'] },
  { name: 'Catcher blocking', minutes: 10, goal: 'Keep the ball in front.', setup: 'Catcher in full gear, coach feeding balls in the dirt.', points: ['Drop to the knees', 'Chin down, chest over the ball'], equipment: ['Catcher gear', 'Balls (12)'] },
];
const SHARED_DRILLS = [
  { name: 'Milton Bats dynamic warm-up', minutes: 10, goal: 'The club’s standard start to every practice.', setup: 'Two lines, 30 yards.', points: ['High knees, butt kicks, carioca', 'Arm circles before any throwing'], equipment: ['Cones (4)'] },
  { name: 'Club throwing progression', minutes: 10, goal: 'Every team warms its arms up the same way.', setup: 'Partners, wrist snaps to full throws at 60 feet.', points: ['Wrist, then elbow, then full', 'No long toss before the progression'], equipment: [] },
  { name: 'Four-corner throwing', minutes: 10, goal: 'Catch, turn and throw on the move.', setup: 'A player at each base, ball around the horn.', points: ['Feet before the ball arrives', 'Throw to the chest'], equipment: ['Balls (2)'] },
  { name: 'Rundowns', minutes: 10, goal: 'Get the out in one throw or fewer.', setup: 'Runner between first and second, two fielders.', points: ['Run the runner back', 'Ball held high'], equipment: [] },
  { name: 'Pop-up priorities', minutes: 10, goal: 'Who takes it, every time.', setup: 'Full infield, coach throwing pop-ups.', points: ['Shortstop is the captain', 'Catcher takes behind the plate'], equipment: ['Balls (12)'] },
  { name: 'Tee contact for beginners', minutes: 10, goal: 'Level swing and contact for U9 and U11.', setup: 'One tee per two players.', points: ['Feet set before the swing', 'Hit the back of the ball'], equipment: ['Tees', 'Balls'] },
  { name: 'Pitching wrist snaps', minutes: 5, goal: 'The base of the windmill.', setup: 'Pitchers in pairs, 10 feet apart.', points: ['Elbow at the hip', 'Snap, don’t push'], equipment: ['Balls (6)'] },
  { name: 'Cool-down and stretch', minutes: 5, goal: 'End every practice the same way.', setup: 'A circle in the outfield.', points: ['Hold each stretch for 20 seconds', 'Shoulders and hamstrings'], equipment: [] },
];
/** The skills tests (Demo 4) and the observed skill. Values: a base per player and a gain by the second testing day. */
const TESTS = [
  { name: 'Home to first', unit: 'sec', aim: 'lower', method: 'From the box on contact to the bag, timed by the coach at first.', attempts: 2, base: 3.55, spread: 0.45, gain: -0.09, digits: 2 },
  { name: '60 ft sprint', unit: 'sec', aim: 'lower', method: 'Standing start, 60 feet, timed.', attempts: 2, base: 2.85, spread: 0.4, gain: -0.06, digits: 2 },
  { name: 'Throwing velocity', unit: 'km/h', aim: 'higher', method: 'Crow hop and throw to the catcher; radar gun behind the plate.', attempts: 3, base: 66, spread: 14, gain: 3, digits: 0 },
  { name: 'Exit velocity off the tee', unit: 'km/h', aim: 'higher', method: 'Three swings off the tee into the net; radar from behind.', attempts: 3, base: 78, spread: 16, gain: 4, digits: 0 },
];
const SKILL = { name: 'Fielding ground balls', method: 'Watched during the ground-ball circuit.', descriptors: ['Getting there', 'Steady', 'Strong'] };
const FOCUS = ['Stay through the ball', 'Footwork on ground balls', 'Leads and reading the pitcher', 'Throwing accuracy to first', 'Pitch location low in the zone',
  'Blocking pitches in the dirt', 'Reading the fly ball off the bat', 'Two-strike approach', 'Quick release on the relay', 'Bunting for a hit', 'First step on the steal', 'Calling the ball in the outfield'];

/** Practice-plan blocks. `stations` rotate (two or more do by default); each station names a drill of the library. */
function planOf(kind, drillId, playerIds) {
  const st = (id, name) => ({ id, name, drillId: drillId(name) ?? undefined, ...(TEAM_DRILLS.find(d => d.name === name) ? {
    goal: TEAM_DRILLS.find(d => d.name === name).goal, setup: TEAM_DRILLS.find(d => d.name === name).setup,
    coachingPoints: TEAM_DRILLS.find(d => d.name === name).points, equipment: TEAM_DRILLS.find(d => d.name === name).equipment } : {}) });
  const groups = playerIds.length ? [0, 1, 2].map(g => ({ id: `g${g + 1}`, name: `Group ${'ABC'[g]}`, playerIds: playerIds.filter((_, i) => i % 3 === g) })) : [];
  const rotation = (minutes) => ({ intervalMinutes: minutes, groupSource: 'manual', groups });
  if (kind === 'dome-hitting') return { version: 1, goal: 'Short, quick swings and putting the ball in play.', practiceTypes: ['Hitting'], equipment: ['Tees (3)', 'L-screen', 'Hitting net'],
    blocks: [
      { id: 'b1', title: 'Milton Bats dynamic warm-up', duration: { minutes: 10 }, description: 'Club warm-up, then the throwing progression.' },
      { id: 'b2', title: 'Hitting circuit', duration: { minutes: 30 }, stations: [st('s1', 'Tee work: inside, middle, outside'), st('s2', 'Front toss'), st('s3', 'Soft toss into the net')], rotation: rotation(10) },
      { id: 'b3', title: 'Bunting ladder', duration: { minutes: 10 }, description: 'Sacrifice, then drag bunts.' },
      { id: 'b4', title: 'Base running: first to third', duration: { minutes: null, restOfPractice: true } },
    ] };
  if (kind === 'dome-defence') return { version: 1, goal: 'Clean hands and quick feet on every ground ball.', practiceTypes: ['Defence'], equipment: ['Balls (36)', 'Catcher gear'],
    blocks: [
      { id: 'b1', title: 'Throwing progression', duration: { minutes: 10 }, description: 'Two-knee throwing, then the club progression.' },
      { id: 'b2', title: 'Ground-ball circuit', duration: { minutes: 30 }, stations: [st('s1', 'Short-hop ground balls'), st('s2', 'Relay race'), st('s3', 'Catcher blocking')], rotation: rotation(10) },
      { id: 'b3', title: 'Pitchers: spin drill', duration: { minutes: 15 }, description: 'Pitchers and catchers together; fielders on fly ball communication.' },
      { id: 'b4', title: 'Cool-down and stretch', duration: { minutes: 5 } },
    ] };
  return { version: 1, goal: 'Game situations before the weekend.', practiceTypes: ['Team defence', 'Hitting'], equipment: ['Balls (48)', 'Bases'],
    blocks: [
      { id: 'b1', title: 'Warm-up and long toss', duration: { minutes: 15 }, description: 'Club warm-up, then long toss to 120 feet.' },
      { id: 'b2', title: 'Infield and outfield', duration: { minutes: 25 }, stations: [st('s1', 'Short-hop ground balls'), st('s2', 'Fly ball communication')], rotation: rotation(12) },
      { id: 'b3', title: 'Situations', duration: { minutes: 25 }, description: 'Runner on first, nobody out: bunt coverage and the throw to second.' },
      { id: 'b4', title: 'Live batting practice', duration: { minutes: null, restOfPractice: true } },
    ] };
}
const stripPeople = (plan) => ({ ...plan, blocks: plan.blocks.map(b => (b.rotation ? { ...b, rotation: { ...b.rotation, groups: [] } } : b)) });

/** The lineup grid for fall game `g`: 7 innings, 12 players, 9 in the field and 3 on the bench, rotating fairly. */
function lineupGrid(g) {
  const P = g % 2 === 0 ? [1, 9] : [9, 1];
  const FIELD = ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  return Array.from({ length: 7 }, (_, n) => {
    const pitcher = n < 4 ? P[0] : P[1];
    const catcher = n < 5 ? 2 : 11;
    const others = [...Array(12).keys()].filter(i => i !== pitcher && i !== catcher);
    const r = (g * 7 + n * 3) % others.length;
    const rot = [...others.slice(r), ...others.slice(0, r)];
    const row = Array(12).fill('Bench');
    row[pitcher] = 'P'; row[catcher] = 'C';
    rot.slice(3).forEach((i, k) => { row[i] = FIELD[k]; });
    return row;
  });
}

// ═══ RESET ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
export async function resetRep(ctx) {
  const { db, ORG, die, one } = ctx;
  const del = async (table, col = 'org_id', extra = (x) => x) => die(`delete ${table}`, (await extra(db.from(table).delete().eq(col, ORG))).error);
  // Schedules first (a final one holds its bill), then the club's bills; payouts before the credits they settle (RESTRICT).
  await del('club_schedules');
  await del('rep_dues_payouts');
  await del('rep_cost_allocations');
  await del('rep_team_payment_requests');
  await del('org_permits');
  // A balance check done in a rehearsal: its checks, then the bank accounts they were done on.
  const accounts = (await one('bank accounts', db.from('bank_accounts').select('id').eq('org_id', ORG))).map(r => r.id);
  if (accounts.length) die('delete bank_checks', (await db.from('bank_checks').delete().in('bank_account_id', accounts)).error);
  await del('bank_accounts');
  await del('rep_teams');
  await del('rep_team_groups');
  await del('rep_team_drills');
  await del('rep_team_tags');
  // Tournaments: games, fields, venues and teams with them; then any tournament book (a walk that charged a fee).
  const tours = (await one('tournaments', db.from('tournaments').select('id').eq('org_id', ORG))).map(r => r.id);
  for (const id of tours) {
    for (const t of ['games', 'venue_facilities', 'diamonds', 'teams']) die(`delete ${t}`, (await db.from(t).delete().eq('tournament_id', id)).error);
    const divs = (await one('divisions', db.from('divisions').select('id').eq('tournament_id', id))).map(r => r.id);
    if (divs.length) die('delete pools', (await db.from('pools').delete().in('division_id', divs)).error);
    die('delete divisions', (await db.from('divisions').delete().eq('tournament_id', id)).error);
  }
  await del('tournaments');
  die('delete tournament books', (await db.from('accounting_ledgers').delete().eq('org_id', ORG).in('entity_type', ['tournament', 'rep_team', 'team'])).error);
  await del('org_payees');
}

// ═══ BUILD ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
export async function buildRep(ctx) {
  const { db, cfg, ORG, DEMO_DAY, die, one, ok, head, insertAll, sql, q, account, nowIso } = ctx;
  const D = DEMO_DAY;
  const S = cfg.repSeason;

  // ── B1 · accounts, teams, seasons, coaches, rosters ─────────────────────────────────────────────────────────────
  head('Rep teams, seasons, coaches, rosters (Phase B)');
  const dressedKey = cfg.dressed.team;
  const headUser = await account(cfg.repPeople.headCoach.email, cfg.repPeople.headCoach.name);
  const assistantUser = await account(cfg.repPeople.assistant.email, cfg.repPeople.assistant.name);
  const teams = [];
  for (const [i, [age, tier, coachName]] of cfg.repTeams.entries()) {
    const key = `${age} ${tier}`;
    const isDressed = key === dressedKey;
    const coach = isDressed ? { ...cfg.repPeople.headCoach, user: headUser }
      : { name: coachName, email: `${ascii(coachName).toLowerCase().replace(/[^a-z]+/g, '.')}@milton-bats.local` };
    if (!coach.user) coach.user = await account(coach.email, coach.name);
    teams.push({ key, age, tier, i, isDressed, coach, id: stableId(cfg, `rep:${slugOf(age, tier)}`), slug: slugOf(age, tier), name: teamName(age, tier),
      pyId: stableId(cfg, `rep:${slugOf(age, tier)}:${S.year}`) });
  }
  const dressed = teams.find(t => t.isDressed);
  if (!dressed) die('dressed team', { message: `the config's dressed team "${dressedKey}" is not in repTeams` });

  // Club memberships: only the missing ones (a reset never edits a membership).
  const members = await one('members', db.from('organization_members').select('user_id').eq('organization_id', ORG));
  const have = new Set(members.map(m => m.user_id));
  const memberRows = [...teams.map(t => t.coach), { ...cfg.repPeople.assistant, user: assistantUser }]
    .filter((c, k, all) => !have.has(c.user.id) && all.findIndex(x => x.user.id === c.user.id) === k)
    .map(c => ({ organization_id: ORG, user_id: c.user.id, role: 'coach', status: 'active', display_name: c.name, invited_at: nowIso, accepted_at: nowIso }));
  if (memberRows.length) await insertAll('organization_members', memberRows, 'user_id');

  const ages = [...new Set(teams.map(t => t.age))];
  const groupId = Object.fromEntries(ages.map(a => [a, stableId(cfg, `group:${a}`)]));
  await insertAll('rep_team_groups', ages.map((a, k) => ({ id: groupId[a], org_id: ORG, name: a, display_order: k })));
  await insertAll('rep_teams', teams.map(t => ({ id: t.id, org_id: ORG, name: t.name, slug: t.slug, sport: cfg.sport, division: t.age,
    color: TEAM_COLORS[t.i % TEAM_COLORS.length], group_id: groupId[t.age], is_archived: false,
    description: t.isDressed ? 'Our U15 A team: fall ball in September and October, Sunday dome practices all winter, three spring tournaments.' : null })));
  const tryouts = new Set(cfg.repTryoutsOpen?.teams ?? []);
  await insertAll('rep_program_years', teams.map(t => {
    const [from, to] = cfg.repBirthYears[t.age];
    return { id: t.pyId, team_id: t.id, org_id: ORG, name: S.name, year: S.year, status: 'active', born_from_year: from, born_to_year: to,
      tryout_open: tryouts.has(t.key), tryout_description: tryouts.has(t.key) ? cfg.repTryoutsOpen.description : null };
  }));
  // The dressed team's finished season (its plans feed "start from a past season").
  const prevPyId = stableId(cfg, `rep:${dressed.slug}:${S.previousYear}`);
  die('previous season', (await db.from('rep_program_years').insert({ id: prevPyId, team_id: dressed.id, org_id: ORG, name: S.previousName, year: S.previousYear, status: 'completed' })).error);
  await insertAll('rep_team_staff_memberships', teams.map(t => ({ org_id: ORG, team_id: t.id, user_id: t.coach.user.id, coach_role: 'head_coach', status: 'active', capabilities: null })));
  await insertAll('rep_team_coaches', teams.map(t => ({ program_year_id: t.pyId, team_id: t.id, org_id: ORG, user_id: t.coach.user.id, coach_role: 'head_coach', capabilities: null })));
  die('previous season coach', (await db.from('rep_team_coaches').insert({ program_year_id: prevPyId, team_id: dressed.id, org_id: ORG, user_id: headUser.id, coach_role: 'head_coach', capabilities: null })).error);
  const grants = { schedule: true, scheduleManage: false, registerTournaments: false, tournaments: false };
  die('assistant seat', (await db.from('rep_team_staff_memberships').insert({ org_id: ORG, team_id: dressed.id, user_id: assistantUser.id, coach_role: 'assistant_coach', status: 'active', staff_kind: 'assistant', capabilities: grants })).error);
  die('assistant season', (await db.from('rep_team_coaches').insert({ program_year_id: dressed.pyId, team_id: dressed.id, org_id: ORG, user_id: assistantUser.id, coach_role: 'assistant_coach', capabilities: grants })).error);

  // Rosters. The dressed team's twelve are named; the others are drawn from the world's name pool, deterministically.
  const guardianEmail = (first, last) => `${ascii(first).toLowerCase()}.${ascii(last).toLowerCase().replace(/[^a-z]/g, '')}@miltonfamilies.local`;
  const rosterRows = [];
  const dob = (age, k) => { const [from, to] = cfg.repBirthYears[age]; const y = k % 2 ? from : to; return `${y}-${String(1 + (k * 5) % 12).padStart(2, '0')}-${String(1 + (k * 7) % 27).padStart(2, '0')}`; };
  dressed.playerIds = DRESSED_ROSTER.map((_, k) => stableId(cfg, `rep:${dressed.slug}:player:${k}`));
  DRESSED_ROSTER.forEach((p, k) => rosterRows.push({ id: dressed.playerIds[k], program_year_id: dressed.pyId, team_id: dressed.id, org_id: ORG,
    player_first_name: p.first, player_last_name: p.last, player_date_of_birth: dob('U15', k), player_number: p.number, primary_position: p.primary, secondary_position: p.secondary,
    bats: p.bats, throws: p.throws, guardian_first_name: GUARDIAN_FIRSTS[k], guardian_last_name: p.last, guardian_email: guardianEmail(GUARDIAN_FIRSTS[k], p.last),
    guardian_phone: `905-555-02${String(10 + k).padStart(2, '0')}`, status: 'active', source: 'admin_manual', display_order: k }));
  const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'P', 'C'];
  for (const t of teams.filter(x => !x.isDressed)) {
    const size = cfg.repRosterSize[t.i % 2];
    for (let k = 0; k < size; k++) {
      const g = NAME_GROUPS[(t.i * 3 + k) % NAME_GROUPS.length];
      const first = g.kids[(t.i * 5 + k * 3) % g.kids.length];
      const last = g.last[(t.i * 7 + k) % g.last.length];
      const parent = g.parents[(t.i + k) % g.parents.length];
      rosterRows.push({ id: crypto.randomUUID(), program_year_id: t.pyId, team_id: t.id, org_id: ORG, player_first_name: first, player_last_name: last, player_date_of_birth: dob(t.age, k + t.i),
        player_number: String(1 + ((k * 7 + t.i) % 40)), primary_position: POSITIONS[k % POSITIONS.length], guardian_first_name: parent, guardian_last_name: last,
        guardian_email: guardianEmail(parent, last), status: 'active', source: 'admin_manual', display_order: k });
    }
  }
  await insertAll('rep_roster_players', rosterRows);
  ok(`${teams.length} rep teams in ${ages.length} age groups (each on a live "${S.name}" with an accepted head coach) · ${rosterRows.length} players`);
  ok(`${dressed.name}: ${cfg.repPeople.headCoach.email} head coach · ${cfg.repPeople.assistant.email} assistant · "${S.previousName}" finished behind it`);
  if (tryouts.size) ok(`tryouts open on the public site: ${[...tryouts].map(k => teamName(...k.split(' '))).join(', ')}`);

  // ── the dome (a venue: kept across resets) and its permit ────────────────────────────────────────────────────────
  head('The dome and its winter permit');
  const DM = cfg.dome;
  let domeVenue = await one('dome', db.from('org_venues').select('id, name, address').eq('org_id', ORG).eq('name', DM.venue.name).maybeSingle());
  if (!domeVenue) domeVenue = await one('add dome', db.from('org_venues').insert({ org_id: ORG, name: DM.venue.name, address: DM.venue.address, notes: 'Indoor dome. Rep teams in the winter.', is_active: true }).select('id, name, address').single());
  const facs = await one('dome fields', db.from('org_venue_facilities').select('id, name').eq('org_venue_id', domeVenue.id));
  const field = Object.fromEntries(facs.map(f => [f.name, f.id]));
  for (const [k, name] of DM.venue.fields.entries()) {
    if (!field[name]) field[name] = (await one(`add ${name}`, db.from('org_venue_facilities').insert({ org_venue_id: domeVenue.id, org_id: ORG, name, facility_type: 'field', display_order: k }).select('id').single())).id;
  }
  const P = DM.permit;
  const firstSunday = onOrAfter(addDays(D, -P.firstSundayBefore), 0);
  const sundays = Array.from({ length: P.sundays }, (_, k) => addDays(firstSunday, 7 * k));
  const offDays = sundays.slice(P.offAfter, P.offAfter + P.offCount);
  const heldSundays = sundays.filter(d => !offDays.includes(d));
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const blockHours = (toMin(P.end) - toMin(P.start)) / 60;
  const halfSet = new Set(DM.venue.halfFields ?? []);
  const weightOf = (name) => (halfSet.has(name) ? 0.5 : 1);
  const fullFieldHours = heldSundays.length * blockHours * DM.venue.fields.reduce((n, f) => n + weightOf(f), 0);
  const cost = Math.round(fullFieldHours * P.costPerFullFieldHour * 100) / 100;
  const permitId = await one('permit', db.rpc('org_permit_save', { p_org: ORG, p_permit: null, p_actor: null, p_data: {
    name: P.name, issuerName: P.issuer, reference: P.reference, heldFor: 'club', startsOn: sundays[0], endsOn: sundays[sundays.length - 1], cost,
    notes: 'PLACEHOLDER until the club sends its permit (scripts/prospect-demo.milton.config.mjs › dome).',
    blocks: [{ venueId: domeVenue.id, facilityIds: DM.venue.fields.map(f => field[f]), weekdays: [P.weekday], startTime: P.start, endTime: P.end }],
    shares: [...halfSet].map(f => ({ facilityId: field[f], share: 0.5 })),
    datesOff: offDays.map(day => ({ day, note: P.offNote })),
  } }));
  ok(`${DM.venue.name}: ${DM.venue.fields.join(', ')}${halfSet.size ? ` (${[...halfSet].join(', ')} half)` : ''} · permit "${P.name}" ${sundays[0]} – ${sundays.at(-1)}, Sundays ${P.start}–${P.end}, ${offDays.join(' and ')} off · ${money(cost)} (${money(P.costPerFullFieldHour)} a full-field hour)`);

  // ── B2 · dome schedule part 1: sent and billed through the product's own send-and-bill step ───────────────────────
  head('Dome schedule part 1 — sent and billed');
  const part1 = heldSundays.slice(0, P.offAfter);
  const hours = Array.from({ length: blockHours * 60 / DM.slotMinutes }, (_, h) => { const m = toMin(P.start) + h * DM.slotMinutes; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
  const cells = hours.flatMap(t => DM.venue.fields.map(f => ({ t, f }))); // 18 a Sunday
  const slots = []; // { day, t, f, teamIdx|null }
  part1.forEach((day, w) => cells.forEach((c, s) => {
    const teamIdx = (s - 5 * w + cells.length * 10) % cells.length; // each team moves five places a week: new hour, new field
    slots.push({ day, t: c.t, f: c.f, teamIdx: teamIdx < teams.length ? teamIdx : null });
  }));
  const settings = { v: 2, slotMinutes: DM.slotMinutes, changeoverMinutes: 0, teamsAtOnce: 1, teamIds: teams.map(t => t.id),
    split: { method: 'even', values: {} }, timeMode: 'same', prime: null,
    rules: { windows: [], maxPerDay: 1, maxPerWeek: 1, avoidGameDays: true, avoidBookings: true, noBackToBack: false, daysOff: [], fieldsBy: [], sharing: [] } };
  const saved = await one('schedule save', db.rpc('club_schedule_save', { p_org: ORG, p_schedule: null, p_actor: ctx.OWNER, p_version: 1, p_data: {
    name: DM.part1.name, startsOn: part1[0], endsOn: part1.at(-1), settings, startedFromPermitId: permitId,
    blocks: [{ permitId, venueId: domeVenue.id, facilityIds: DM.venue.fields.map(f => field[f]), weekdays: [P.weekday], startTime: P.start, endTime: P.end }],
    datesOff: [],
    slots: slots.map(s => ({ venueId: domeVenue.id, facilityId: field[s.f], startsAt: torontoInstant(s.day, s.t), endsAt: torontoInstant(s.day, addMinutes(s.t, DM.slotMinutes)), blockIndex: 0,
      teamIds: s.teamIdx == null ? [] : [teams[s.teamIdx].id] })),
  } }));
  if (!saved?.ok) die('schedule save', { message: JSON.stringify(saved) });
  const scheduleId = saved.id;
  const billDates = DM.billDates.map(o => addDays(D, o));
  die('bill terms', (await db.from('club_schedules').update({ bill_permit_id: permitId, bill_plan: 'dates', bill_dates: billDates, bill_price_mode: 'each_permit' }).eq('id', scheduleId).eq('org_id', ORG)).error);
  const sched = await one('schedule row', db.from('club_schedules').select('id, version').eq('id', scheduleId).single());
  const slotRows = await one('slots', db.from('club_schedule_slots').select('id, starts_at, facility_id').eq('schedule_id', scheduleId));
  const slotTeams = await one('slot teams', db.from('club_schedule_slot_teams').select('slot_id, team_id').eq('org_id', ORG).in('slot_id', slotRows.map(r => r.id)));
  const teamsOf = new Map(); for (const st of slotTeams) teamsOf.set(st.slot_id, [...(teamsOf.get(st.slot_id) ?? []), st.team_id]);
  const facName = Object.fromEntries(Object.entries(field).map(([n, id]) => [id, n]));
  // The bill, as the scheduler prices it: each slot's priced minutes × its field's share, at the permit's hour.
  const bill = await appModule('lib/club-schedule-bill.ts');
  const dayOf = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date(iso));
  const billSlots = slotRows.map(r => ({ day: dayOf(r.starts_at), startMs: Date.parse(r.starts_at), endMs: Date.parse(r.starts_at) + DM.slotMinutes * 60000,
    weight: weightOf(facName[r.facility_id]), teamIds: teamsOf.get(r.id) ?? [], permitId }));
  const fullHour = cost / fullFieldHours;
  const shares = bill.priceTheBill(billSlots, { hourOf: () => fullHour, mode: 'each_permit', amount: null, teamOrder: teams.map(t => t.id) });
  const periods = bill.paymentPeriods('dates', { firstDue: null, dates: billDates, lastDay: part1.at(-1) });
  const splits = bill.timeSplits({ slots: billSlots, shares, periods, seasons: new Map(teams.map(t => [t.id, t.pyId])), priced: bill.pricedMinutes(billSlots) });
  const send = await one('send row', db.from('club_schedule_sends').insert({ org_id: ORG, schedule_id: scheduleId, kind: 'final' }).select('id').single());
  const pyOf = new Map(teams.map(t => [t.id, t.pyId]));
  const rows = slotRows.flatMap(r => (teamsOf.get(r.id) ?? []).map(teamId => ({ slotId: r.id, teamId, programYearId: pyOf.get(teamId), startsAt: r.starts_at,
    endsAt: new Date(Date.parse(r.starts_at) + DM.slotMinutes * 60000).toISOString(), venueId: domeVenue.id, facilityId: r.facility_id, name: 'Practice',
    location: DM.venue.name, locationAddress: DM.venue.address, fieldNumber: facName[r.facility_id] })));
  const fin = await one('finalize', db.rpc('club_schedule_finalize_priced', { p_org: ORG, p_schedule: scheduleId, p_actor: ctx.OWNER, p_version: sched.version, p_rows: rows,
    p_bill: { description: DM.part1.name, lineId: null, notes: null, splits }, p_scale: shares.rate, p_send: send.id,
    p_log: { teamValues: Object.fromEntries(shares.shares) }, p_rates: [...shares.rates].map(([pid, scale]) => ({ permitId: pid, permitName: P.name, scale })) }));
  if (!fin?.ok) die('finalize', { message: JSON.stringify(fin) });
  // Dated as sent weeks ago (the step stamps now).
  const sentAt = torontoInstant(addDays(D, -DM.part1.sentDaysBefore), '20:10');
  sql(`UPDATE club_schedules SET finalized_at = ${q(sentAt)}, finalized_by = ${q(ctx.OWNER)}, sent_at = ${q(sentAt)}, sent_by = ${q(ctx.OWNER)}, created_at = ${q(minutesLater(sentAt, -60 * 24 * 5))} WHERE id = ${q(scheduleId)} AND org_id = ${q(ORG)};
       UPDATE club_schedule_sends SET sent_at = ${q(sentAt)}, sent_by = ${q(ctx.OWNER)}, people_count = ${teams.length}, failed_count = 0, landed_at = ${q(minutesLater(sentAt, 1))} WHERE schedule_id = ${q(scheduleId)} AND org_id = ${q(ORG)};
       UPDATE rep_cost_allocations SET created_at = ${q(sentAt)} WHERE id = ${q(fin.allocationId)} AND org_id = ${q(ORG)};`);
  // Ten of the seventeen coaches have paid the club's first payment; the dressed team is one of them.
  const firstPaid = new Set([dressed.id, ...teams.filter(t => !t.isDressed).slice(0, 9).map(t => t.id)]);
  const allocSplits = await one('splits', db.from('rep_allocation_splits').select('id, team_id, amount').eq('allocation_id', fin.allocationId));
  const inst1 = await one('installments', db.from('rep_allocation_installments').select('id, team_id, installment_number, amount, due_date').eq('org_id', ORG).in('split_id', allocSplits.map(s => s.id)));
  const paidIds = inst1.filter(i => i.installment_number === 1 && firstPaid.has(i.team_id)).map(i => i.id);
  const coachOfTeam = new Map(teams.map(t => [t.id, t.coach.user.id]));
  for (const i of inst1.filter(x => paidIds.includes(x.id))) {
    die('club installment paid', (await db.from('rep_allocation_installments').update({ paid_at: torontoInstant(addDays(i.due_date, -2), '19:30'), paid_by: coachOfTeam.get(i.team_id) }).eq('id', i.id)).error);
  }
  const dressedSplit = allocSplits.find(s => s.team_id === dressed.id);
  const dressedInst = inst1.filter(i => i.team_id === dressed.id).sort((a, b) => a.installment_number - b.installment_number);
  const pastDome = part1.filter(d => d < D).length;
  ok(`"${DM.part1.name}": ${part1[0]} – ${part1.at(-1)} (${pastDome} Sundays played, ${part1.length - pastDome} to come) · ${rows.length} practices on ${teams.length} team schedules · one hour open each Sunday`);
  ok(`billed ${money(shares.totalCents / 100)} (the time's price; the open hour is the club's) · ${dressed.name}'s share ${money(dressedSplit.amount)} in ${dressedInst.length} payments (${dressedInst.map(i => `${money(i.amount)} ${i.due_date}`).join(', ')}) · ${firstPaid.size} teams have paid the first`);
  ok(`Demo 1 builds part 2 live: start a schedule from "${P.name}" dated from ${heldSundays[P.offAfter]} (the first Sunday after ${offDays.join(' and ')})`);

  // ── B3 · the dressed team's book ──────────────────────────────────────────────────────────────────────────────────
  head(`${dressed.name} — the books`);
  const T = { team_id: dressed.id, org_id: ORG, program_year_id: dressed.pyId };
  const pids = dressed.playerIds;
  const coachId = headUser.id;
  const { budgetLineKindForItem } = await appModule('lib/coach-budget-totals.ts');
  // Every word below is a platform word (none is invented), so no word source is derived here.
  const cats = await one('budget categories', db.from('budget_categories').select('id, name, income_source').is('org_id', null).in('scope', ['team', 'both']));
  const catId = new Map(cats.map(c => [c.name, c.id]));
  const words = await one('budget words', db.from('budget_items').select('id, name, category_id, direction, actual_source').is('org_id', null).in('category_id', cats.map(c => c.id)));
  const word = (cat, item) => {
    const w = words.find(x => x.category_id === catId.get(cat) && x.name === item);
    if (!w) die('budget word', { message: `${cat} / ${item} is not a platform word` });
    return { budget_category_id: w.category_id, budget_item_id: w.id, kind: budgetLineKindForItem({ direction: w.direction, actualSource: w.actual_source }) };
  };
  const PLAN = [
    { cat: 'Facilities', item: 'Dome Time', description: 'Winter dome (the club’s bill)', total: 1800, month: 0 },
    { cat: 'League & Fees', item: 'League registration', description: 'Fall ball league', total: 1450, month: -3 },
    { cat: 'Officials', item: 'Umpire Fees', description: 'Umpires, fall and spring', total: 1400, month: -2 },
    { cat: 'Team Gear', item: 'Jerseys', description: 'Jerseys and pants', total: 1560, month: -2 },
    { cat: 'Team Gear', item: 'Balls', description: 'Practice and game balls', total: 400, month: -3 },
    { cat: 'Training', item: 'Practice equipment', description: 'Hitting net and tees', total: 350, month: -1 },
    { cat: 'Tournaments', item: 'Entry Fees', description: 'Three spring tournaments', total: 1950, month: 4 },
    { cat: 'Fundraising', item: 'Fundraising drive', description: 'Bottle drive and spring raffle', total: 1800, month: -2 },
    { cat: 'Sponsorship', item: 'Team sponsorship', description: 'Team sponsors', total: 1500, month: -1 },
    { cat: 'Events', item: 'Year-End Party', description: 'Season-end party', total: 600, month: null },
  ];
  const lineRows = PLAN.map((l, k) => { const w = word(l.cat, l.item); return { id: crypto.randomUUID(), ...T, category_id: w.budget_category_id, item_id: w.budget_item_id, description: l.description, total_amount: l.total, sort_order: k, line_kind: w.kind }; });
  await insertAll('rep_budget_lines', lineRows);
  const monthOf = (offsetMonths) => { const d = new Date(`${D.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + offsetMonths); return d.toISOString().slice(0, 7); };
  await insertAll('rep_budget_periods', PLAN.map((l, k) => (l.month == null ? null : { budget_line_id: lineRows[k].id, period_label: monthOf(l.month), period_date: `${monthOf(l.month)}-01`, amount: l.total, sort_order: 0 })).filter(Boolean), 'id');
  const costTotal = PLAN.filter((_, k) => lineRows[k].line_kind === 'cost').reduce((n, l) => n + l.total, 0);
  die('season estimate', (await db.from('rep_program_years').update({ budget_amount: costTotal }).eq('id', dressed.pyId)).error);
  // The club's dome bill filed under the team's own Dome Time line (the coach files a club bill on its split).
  const dome = word('Facilities', 'Dome Time');
  die('file the dome bill', (await db.from('rep_allocation_splits').update({ budget_category_id: dome.budget_category_id, budget_item_id: dome.budget_item_id }).eq('id', dressedSplit.id)).error);

  // Player dues: four payments; the first paid by all but one family (overdue), the second paid early by four and half
  // paid by one, the last two still ahead.
  const DU = cfg.dressed.dues;
  const each = DU.total / DU.installments;
  const dueDates = DU.dueOffsets.map(o => addDays(D, o));
  const OVERDUE = 8, PART = 6, EARLY = [0, 3, 5, 10];
  let duesIn = 0;
  for (const [k, pid] of pids.entries()) {
    const scheduleRow = await one('dues schedule', db.from('rep_player_dues_schedules').insert({ program_year_id: dressed.pyId, player_id: pid, team_id: dressed.id, org_id: ORG, total_amount: DU.total }).select('id').single());
    const paid = (n) => (n === 0 ? k !== OVERDUE : n === 1 ? EARLY.includes(k) : false);
    const paidDay = (n) => addDays(dueDates[n], n === 0 ? -(k % 5) : -(3 + (k % 6)));
    await insertAll('rep_player_dues_installments', dueDates.map((due, n) => ({ schedule_id: scheduleRow.id, player_id: pid, installment_number: n + 1, amount: each, due_date: due,
      paid_at: paid(n) ? `${paidDay(n)}T17:00:00.000Z` : null, org_id: ORG, team_id: dressed.id, source: 'manual' })));
    const pays = dueDates.map((_, n) => n).filter(paid).map(n => ({ amount: each, day: paidDay(n) }));
    if (k === PART) pays.push({ amount: 150, day: addDays(D, -20) }, { amount: 100, day: addDays(D, -6) });
    if (pays.length) await insertAll('rep_dues_payments', pays.map(p => ({ program_year_id: dressed.pyId, player_id: pid, org_id: ORG, team_id: dressed.id, amount: p.amount, received_date: p.day,
      method: 'etransfer', source: 'recorded', created_at: `${p.day}T17:00:00.000Z` })));
    duesIn += pays.reduce((n, p) => n + p.amount, 0);
  }
  // The bottle drive: closed; half of what each family raised comes off its dues.
  const FR = cfg.dressed.fundraiser;
  const fr = word('Fundraising', 'Fundraising drive');
  const frId = crypto.randomUUID();
  die('fundraiser', (await db.from('rep_fundraisers').insert({ id: frId, ...T, name: FR.name, description: 'Bottles and cans collected door to door, two Saturdays.', player_rebate_percent: FR.rebatePercent,
    start_date: addDays(D, FR.startOffset), end_date: addDays(D, FR.endOffset), is_active: false, budget_category_id: fr.budget_category_id, budget_item_id: fr.budget_item_id })).error);
  const RAISED = [[0, 140], [1, 95], [2, 180], [3, 60], [4, 120], [5, 85], [7, 150], [9, 110], [11, 75]];
  let raised = 0;
  for (const [k, amt] of RAISED) {
    const rebate = Math.round(amt * FR.rebatePercent) / 100;
    const day = addDays(D, FR.endOffset + (k % 3));
    const entryId = crypto.randomUUID();
    die('fundraiser entry', (await db.from('rep_fundraiser_entries').insert({ id: entryId, fundraiser_id: frId, org_id: ORG, team_id: dressed.id, player_id: pids[k], amount_raised: amt,
      rebate_percent: FR.rebatePercent, rebate_amount: rebate, received_date: day })).error);
    const creditId = crypto.randomUUID();
    die('rebate credit', (await db.from('rep_dues_credits').insert({ id: creditId, program_year_id: dressed.pyId, player_id: pids[k], amount: rebate, description: `Fundraiser rebate — ${FR.name}`,
      credit_type: 'fundraiser', credit_date: day, fundraiser_entry_id: entryId })).error);
    die('link credit', (await db.from('rep_fundraiser_entries').update({ credit_id: creditId }).eq('id', entryId)).error);
    raised += amt;
  }
  // The sponsor: promised, half received. ⚠ The stored status is 'received' from the FIRST cheque (the product's own
  // Record door flips it); "part received" is worked out from the money. A 'pledged' row with an arrival is a state the
  // product never makes, and its register then counts none of the cheque.
  const SP = cfg.dressed.sponsor;
  const sp = word('Sponsorship', 'Team sponsorship');
  const spId = crypto.randomUUID();
  die('sponsor', (await db.from('rep_fundraisers').insert({ id: spId, ...T, kind: 'sponsor', sponsor_status: SP.received > 0 ? 'received' : 'pledged', pledged_amount: SP.pledged, name: SP.name,
    description: 'Jersey sleeve patch and the banner at the dome.', player_rebate_percent: 0, start_date: addDays(D, SP.receivedOffset - 10), end_date: null, is_active: true,
    budget_category_id: sp.budget_category_id, budget_item_id: sp.budget_item_id })).error);
  die('sponsor arrival', (await db.from('rep_fundraiser_entries').insert({ fundraiser_id: spId, org_id: ORG, team_id: dressed.id, player_id: null, amount_raised: SP.received, rebate_percent: 0,
    rebate_amount: 0, received_date: addDays(D, SP.receivedOffset), method: 'cheque' })).error);
  die('sponsor invoice details', (await db.from('rep_teams').update({ sponsor_payment_details: { payTo: 'Milton Bats U15 A', instructions: 'E-transfer to the team treasurer, or a cheque payable to Milton Bats Softball Association with "U15 A" on the memo line.' } }).eq('id', dressed.id)).error);
  // Costs and bills: paid, part-paid, one a family paid out of pocket, one still ahead.
  const COSTS = [
    { cat: 'League & Fees', item: 'League registration', description: 'Fall ball league fee', payee: 'Halton Fall Ball League', pieces: [{ amount: 1450, due: -88, paid: -86 }] },
    { cat: 'Officials', item: 'Umpire Fees', description: 'Fall ball umpires', payee: 'Milton Umpires Association', pieces: [{ amount: 360, due: -63, paid: -63 }, { amount: 360, due: -42, paid: -41 }] },
    { cat: 'Team Gear', item: 'Jerseys', description: 'Jerseys and pants', payee: 'Halton Sportswear', pieces: [{ amount: 780, due: -75, paid: -75 }, { amount: 780, due: 20, paid: null }] },
    { cat: 'Team Gear', item: 'Balls', description: 'Two dozen softballs', payee: 'Halton Hardware & Supply', pieces: [{ amount: 310, due: -82, paid: -82, frontedBy: 4 }] },
    { cat: 'Training', item: 'Practice equipment', description: 'Hitting net and two tees', payee: 'Halton Hardware & Supply', pieces: [{ amount: 289.5, due: -33, paid: -33 }] },
    { cat: 'Tournaments', item: 'Entry Fees', description: 'Spring Opener entry', payee: 'Spring Opener (Kelso Ridge)', type: 'tournament_payable', pieces: [{ amount: 200, due: -20, paid: -19 }, { amount: 450, due: 75, paid: null }] },
  ];
  let spent = 0;
  for (const c of COSTS) {
    const w = word(c.cat, c.item);
    const expenseId = await insertCommitmentWithRecords(db, {
      row: { ...T, expense_type: c.type ?? 'expense', description: c.description, category: c.cat, budget_category_id: w.budget_category_id, budget_item_id: w.budget_item_id, payee_payer: c.payee, created_by: coachId },
      installments: c.pieces.map(p => ({ amount: p.amount, dueDate: addDays(D, p.due) })),
      payments: c.pieces.map((p, n) => (p.paid == null ? null : { amount: p.amount, paidDate: addDays(D, p.paid), installmentNumber: n + 1, paidByPlayerId: p.frontedBy != null ? pids[p.frontedBy] : null, method: 'etransfer' })).filter(Boolean),
    });
    for (const p of c.pieces.filter(x => x.frontedBy != null)) {
      die('out-of-pocket credit', (await db.from('rep_dues_credits').insert({ program_year_id: dressed.pyId, player_id: pids[p.frontedBy], expense_id: expenseId, amount: p.amount,
        description: `Paid out of pocket — ${c.description}`, credit_type: 'reimbursement', credit_date: addDays(D, p.paid), created_by: coachId })).error);
    }
    spent += c.pieces.filter(p => p.paid != null && p.frontedBy == null).reduce((n, p) => n + p.amount, 0);
  }
  const clubPaid = dressedInst.filter(i => i.installment_number === 1).reduce((n, i) => n + Number(i.amount), 0);
  const cashEstimate = Math.round((duesIn + raised + SP.received - spent - clubPaid) * 100) / 100;
  ok(`budget ${lineRows.length} lines (costs ${money(costTotal)}) · dues ${money(DU.total)} in ${DU.installments} (one family overdue, one part-paid, four paid the second early) · ${money(duesIn)} received`);
  ok(`"${FR.name}" raised ${money(raised)} (half to the families) · ${SP.name} ${money(SP.received)} of ${money(SP.pledged)} · ${COSTS.length} costs, ${money(spent)} paid by the team · club dome bill filed under Dome Time, first payment paid`);
  ok(`cash on hand should read about ${money(cashEstimate)} (check it on the team's Money page before the balance check)`);

  // ── B4 · events, practice plans, drills, templates, the club's shared set ─────────────────────────────────────────
  head(`${dressed.name} — practices, plans and drills`);
  const sherwood = await one('Sherwood Park', db.from('org_venues').select('id, address').eq('org_id', ORG).eq('name', 'Sherwood Park').maybeSingle());
  const sherwoodFac = sherwood ? (await one('Sherwood diamond', db.from('org_venue_facilities').select('id').eq('org_venue_id', sherwood.id).limit(1).maybeSingle()))?.id : null;
  const drillRows = TEAM_DRILLS.map(d => ({ id: crypto.randomUUID(), org_id: ORG, team_id: dressed.id, name: d.name, usual_minutes: d.minutes, goal: d.goal, setup: d.setup,
    coaching_points: d.points, equipment: d.equipment, is_active: true, created_by: coachId }));
  await insertAll('rep_team_drills', drillRows);
  await insertAll('rep_team_drills', SHARED_DRILLS.map(d => ({ org_id: ORG, team_id: null, name: d.name, usual_minutes: d.minutes, goal: d.goal, setup: d.setup,
    coaching_points: d.points, equipment: d.equipment, is_active: true, created_by: ctx.OWNER })));
  const drillId = (name) => drillRows.find(d => d.name === name)?.id ?? null;
  await insertAll('rep_team_plan_templates', [
    { org_id: ORG, team_id: dressed.id, name: 'Dome hour: hitting', plan: stripPeople(planOf('dome-hitting', drillId, [])), is_active: true, created_by: coachId },
    { org_id: ORG, team_id: dressed.id, name: 'Dome hour: defence', plan: stripPeople(planOf('dome-defence', drillId, [])), is_active: true, created_by: coachId },
  ]);
  const circuit = planOf('dome-hitting', drillId, []).blocks[1];
  die('saved circuit', (await db.from('rep_team_circuits').insert({ org_id: ORG, team_id: dressed.id, name: 'Three-station hitting circuit', block: { ...circuit, rotation: { ...circuit.rotation, groups: [] } }, is_active: true, created_by: coachId })).error);

  // Fall ball: games and practices (Sherwood Park, rep only); then the dome practices the club's schedule wrote.
  const evRows = [];
  const games = FALL_GAMES.map(([o, ha, us, them], g) => {
    const day = addDays(D, o);
    const start = torontoInstant(day, o % 7 === 0 ? '10:00' : '18:30');
    const id = crypto.randomUUID();
    evRows.push({ id, ...T, event_type: 'league_game', name: `${ha === 'home' ? 'vs' : 'at'} ${OPPONENTS[g % 4]}`, starts_at: start, ends_at: minutesLater(start, 105),
      location: ha === 'home' ? 'Sherwood Park · Diamond 1' : `${OPPONENTS[g % 4].split(' ')[0]} Park`, org_venue_id: ha === 'home' ? sherwood?.id ?? null : null,
      org_venue_facility_id: ha === 'home' ? sherwoodFac ?? null : null, opponent: OPPONENTS[g % 4], home_away: ha, team_score: us, opponent_score: them,
      result: us > them ? 'win' : us < them ? 'loss' : 'tie', status: 'scheduled', arrival_time: null });
    return { id, g, past: true };
  });
  const fallPractices = FALL_PRACTICES.map((o, k) => {
    const start = torontoInstant(addDays(D, o), '18:30');
    const id = crypto.randomUUID();
    evRows.push({ id, ...T, event_type: 'practice', name: 'Practice', starts_at: start, ends_at: minutesLater(start, 90), location: 'Sherwood Park · Diamond 1',
      org_venue_id: sherwood?.id ?? null, org_venue_facility_id: sherwoodFac ?? null, status: 'scheduled',
      practice_plan: k === 1 ? null : planOf('field', drillId, pids), practice_recap: k === 1 ? 'Rained out after 40 minutes. We got through the infield work.' : null });
    return { id, k };
  });
  await insertAll('rep_team_events', evRows);
  const domeEvents = (await one('dome practices', db.from('rep_team_events').select('id, starts_at').eq('team_id', dressed.id).eq('program_year_id', dressed.pyId).not('club_schedule_slot_id', 'is', null)))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const nowMs = Date.now();
  const pastDomeEv = domeEvents.filter(e => Date.parse(e.starts_at) < nowMs);
  for (const [k, e] of pastDomeEv.entries()) {
    die('dome plan', (await db.from('rep_team_events').update({ practice_plan: planOf(k % 2 ? 'dome-defence' : 'dome-hitting', drillId, pids) }).eq('id', e.id)).error);
  }
  // The finished season's practices with plans (summer), so "start from a past season" has something to offer.
  const prevPlans = [-170, -156, -142, -128].map((o, k) => { const s = torontoInstant(addDays(D, o), '18:30'); return { program_year_id: prevPyId, team_id: dressed.id, org_id: ORG, event_type: 'practice', name: 'Practice',
    starts_at: s, ends_at: minutesLater(s, 90), location: 'Sherwood Park · Diamond 1', status: 'scheduled', practice_plan: planOf(k % 2 ? 'dome-defence' : 'field', () => null, []) }; });
  await insertAll('rep_team_events', prevPlans);
  const nextDome = domeEvents.find(e => Date.parse(e.starts_at) >= nowMs);
  ok(`${TEAM_DRILLS.length} drills in the coach's library · ${SHARED_DRILLS.length} in the club's shared set · 2 templates · 1 saved circuit`);
  ok(`${FALL_GAMES.length} fall-ball games and ${FALL_PRACTICES.length} practices at Sherwood Park (${FALL_PRACTICES.length - 1} with plans) · ${pastDomeEv.length} past dome practices with plans · ${S.previousName}: ${prevPlans.length} practices with plans`);
  ok(`the next dome practice (${nextDome ? dayOf(nextDome.starts_at) : 'none'}) has NO plan: Demo 3 starts it from a past practice and sends it to ${cfg.repPeople.assistant.name}`);

  // ── B5 · attendance, lineups, skills, goals ───────────────────────────────────────────────────────────────────────
  head(`${dressed.name} — attendance, lineups, skills`);
  const att = [];
  const attOf = (eventId, n) => pids.forEach((pid, i) => att.push({ event_id: eventId, player_id: pid, program_year_id: dressed.pyId, team_id: dressed.id, org_id: ORG,
    status: (i * 3 + n) % 11 === 0 ? 'absent' : (i + n * 2) % 13 === 0 ? 'late' : 'attending' }));
  games.forEach(g => attOf(g.id, g.g));
  fallPractices.forEach(p => attOf(p.id, p.k + 20));
  pastDomeEv.forEach((e, k) => attOf(e.id, k + 40));
  await insertAll('rep_team_event_attendance', att, 'event_id');
  for (const g of games) {
    const lineupId = crypto.randomUUID();
    die('lineup', (await db.from('rep_team_lineups').insert({ id: lineupId, event_id: g.id, ...T, lineup_mode: 'everyone_bats', inning_count: 7 })).error);
    const grid = lineupGrid(g.g);
    const order = [...Array(12).keys()].map(i => (i + g.g) % 12);
    await insertAll('rep_team_lineup_entries', order.map((i, pos) => ({ lineup_id: lineupId, player_id: pids[i], batting_order: pos + 1, starter: true,
      inning_positions: Object.fromEntries(grid.map((inning, n) => [String(n + 1), inning[i]])) })), 'lineup_id');
  }
  die('arm care', (await db.from('rep_program_years').update({ lineup_settings: { maxInningsPerPosition: null, pitcherMaxInningsDefault: 4, minInningsPerPlayer: 4 } }).eq('id', dressed.pyId)).error);
  // Two testing days: the first fall practice, and the third dome Sunday.
  const typeIds = TESTS.map(() => crypto.randomUUID());
  await insertAll('rep_team_measurable_types', TESTS.map((t, k) => ({ id: typeIds[k], org_id: ORG, team_id: dressed.id, name: t.name, unit: t.unit, kind: 'test', aim: t.aim, method: t.method,
    attempts_per_session: t.attempts, headline: 'best', sort_order: k, is_active: true, created_by: coachId })));
  const skillId = crypto.randomUUID();
  die('observed skill', (await db.from('rep_team_measurable_types').insert({ id: skillId, org_id: ORG, team_id: dressed.id, name: SKILL.name, unit: null, kind: 'skill', aim: 'record', method: SKILL.method,
    attempts_per_session: 1, headline: 'last', descriptors: SKILL.descriptors, sort_order: TESTS.length, is_active: true, created_by: coachId })).error);
  const testing = [
    { date: addDays(D, FALL_PRACTICES[0]), event: fallPractices[0].id, note: 'Fall baseline', absent: [10] },
    { date: pastDomeEv[2] ? dayOf(pastDomeEv[2].starts_at) : addDays(D, -14), event: pastDomeEv[2]?.id ?? null, note: 'Winter re-test in the dome', absent: [4] },
  ];
  const sessionIds = testing.map(() => crypto.randomUUID());
  await insertAll('rep_team_evaluation_sessions', testing.map((s, k) => ({ id: sessionIds[k], org_id: ORG, team_id: dressed.id, program_year_id: dressed.pyId, session_date: s.date, event_id: s.event,
    note: s.note, created_by: coachId, scope_metric_ids: [...typeIds, skillId], scope_player_ids: pids.filter((_, i) => !s.absent.includes(i)),
    scope_attempts: Object.fromEntries(typeIds.map((id, t) => [id, TESTS[t].attempts])) })));
  const readings = [];
  testing.forEach((s, si) => pids.forEach((pid, i) => {
    if (s.absent.includes(i)) return;
    TESTS.forEach((t, ti) => {
      const base = t.base + (((i * 37 + ti * 11) % 100) / 100 - 0.5) * t.spread;
      for (let a = 0; a < t.attempts; a++) {
        const v = base + si * t.gain * (1 + ((i + ti) % 3) / 2) + (a - 1) * (t.digits ? 1.5 : 0.04) * (t.aim === 'lower' ? -1 : 1) * ((a + i) % 2 ? 1 : -1);
        readings.push({ org_id: ORG, team_id: dressed.id, player_id: pid, measurable_type_id: typeIds[ti], value: Number(v.toFixed(t.digits)), attempt_no: a + 1, unit: t.unit,
          recorded_on: s.date, session_id: sessionIds[si], created_by: coachId });
      }
    });
  }));
  await insertAll('rep_player_measurables', readings);
  const goalIds = pids.map(() => crypto.randomUUID());
  await insertAll('rep_player_development_goals', pids.map((pid, i) => ({ id: goalIds[i], org_id: ORG, team_id: dressed.id, player_id: pid, focus_area: FOCUS[i % FOCUS.length],
    note: i === 0 ? 'Gets under the ball on the outside pitch. Working the tee lane every Sunday.' : null, status: i === 6 || i === 9 ? 'achieved' : 'working', origin: 'coach', created_by: coachId })));
  const obs = [];
  testing.forEach((s, si) => pids.forEach((pid, i) => {
    if (s.absent.includes(i) || i % 2 !== si % 2 && i !== 0) return;
    obs.push({ org_id: ORG, team_id: dressed.id, player_id: pid, measurable_type_id: skillId, metric_kind: 'skill', observed_on: s.date, descriptor: SKILL.descriptors[Math.min(2, (i % 3) + si)],
      note: i === 0 ? (si ? 'Glove out front now; still rushing the throw.' : 'Fields it cleanly; feet stop early.') : null, goal_id: i === 1 ? goalIds[1] : null, session_id: sessionIds[si], created_by: coachId });
  }));
  await insertAll('rep_player_observations', obs);
  ok(`attendance on ${games.length} games and ${fallPractices.length + pastDomeEv.length} practices · ${games.length} lineups (7 innings, everyone bats, two pitchers)`);
  ok(`${TESTS.length} tests over 2 testing days (${testing.map(s => s.date).join(', ')}) · ${readings.length} readings · ${obs.length} observations · a goal for every player`);

  // ── B6 · the tournament, the site's notice and sponsors ───────────────────────────────────────────────────────────
  head('The tournament and the public site');
  const TN = cfg.tournament;
  const { computeTournamentStandings } = await import(new URL('../../lib/tie-breakers.ts', import.meta.url).href);
  let sat = addDays(D, -1); while (new Date(`${sat}T12:00:00Z`).getUTCDay() !== 6) sat = addDays(sat, -1);
  const tSettings = { format: 'round_robin_playoffs', fee_scope: 'tournament', tie_breakers: ['h2h', 'rd', 'rf', 'ra'], tie_breaker_scope: 'tournament', buffer_minutes: 15,
    game_timing_scope: 'tournament', game_duration_minutes: 75, show_fees_on_register: false, payment_instructions_on_form: false, roster_require: false };
  const playoff = { type: 'single', crossover: 'reseed', tieBreakers: ['h2h', 'rd', 'rf', 'ra'], hasThirdPlace: false, teamsQualifying: 4 };
  const tid = crypto.randomUUID();
  die('tournament', (await db.from('tournaments').insert({ id: tid, org_id: ORG, slug: TN.slug, name: TN.name, year: Number(sat.slice(0, 4)), status: 'active', is_active: true,
    start_date: sat, end_date: sat, sport: cfg.sport, settings: tSettings, contact_email: TN.contactEmail, list_in_directory: false, require_score_finalization: false, notify_teams_on_complete: false,
    theme_preset: cfg.branding.themePreset, theme_primary: cfg.branding.themePrimary, theme_accent: cfg.branding.themeAccent })).error);
  const venueId = crypto.randomUUID();
  die('tournament venue', (await db.from('diamonds').insert({ id: venueId, tournament_id: tid, name: DM.venue.name, address: DM.venue.address })).error);
  const tFields = DM.venue.fields.map(() => crypto.randomUUID());
  await insertAll('venue_facilities', DM.venue.fields.map((n, k) => ({ id: tFields[k], venue_id: venueId, tournament_id: tid, name: n, facility_type: 'diamond', display_order: k })));
  const RR = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
  const SCORES = { U11: [[8, 6], [5, 7], [9, 3], [4, 4], [6, 2], [3, 8]], U15: [[5, 2], [3, 1], [7, 4], [2, 6], [4, 3], [1, 5]] };
  // A visitor takes the U11 title: a club's own tournament where its teams win everything reads as staged.
  const PLAYOFF_SCORES = { U11: [[7, 5], [6, 9], [4, 8]], U15: [[4, 3], [2, 5], [6, 2]] };
  const TIMES = ['08:00', '09:30', '11:00', '12:30'];
  const divs = [];
  for (const [di, dv] of TN.divisions.entries()) {
    const divId = crypto.randomUUID();
    die('division', (await db.from('divisions').insert({ id: divId, tournament_id: tid, name: dv.name, display_order: di, settings: {}, schedule_visibility: 'published', playoff_config: playoff })).error);
    const tIds = dv.teams.map(() => crypto.randomUUID());
    await insertAll('teams', dv.teams.map((n, k) => ({ id: tIds[k], tournament_id: tid, division_id: divId, name: n, coach: n.startsWith('Milton') ? 'Milton Bats coach' : `${n.split(' ')[0]} coach`,
      email: `${n.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@winter-classic.local`, coach_email: `${n.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@winter-classic.local`, status: 'accepted', payment_status: 'paid', registered_at: torontoInstant(addDays(sat, -30), '19:00') })));
    divs.push({ ...dv, divId, tIds });
  }
  // Pool play: 12 games in 4 rounds of 3 fields (no team twice in a round), then semifinals and finals.
  const order = [['U11', 0], ['U11', 1], ['U15', 0], ['U15', 1], ['U11', 2], ['U11', 3], ['U15', 2], ['U15', 3], ['U11', 4], ['U11', 5], ['U15', 4], ['U15', 5]];
  const gameRows = []; const done = [];
  order.forEach(([dn, gi], n) => {
    const dv = divs.find(x => x.name === dn);
    const [h, a] = RR[gi]; const [hs, as] = SCORES[dn][gi];
    const id = crypto.randomUUID();
    gameRows.push({ id, tournament_id: tid, division_id: dv.divId, home_team_id: dv.tIds[h], away_team_id: dv.tIds[a], game_date: sat, game_time: TIMES[Math.floor(n / 3)], diamond_id: venueId,
      venue_facility_id: tFields[n % 3], duration_minutes: 75, status: 'completed', is_playoff: false, home_score: hs, away_score: as, score_submission_source: 'admin_results', score_submitted_at: torontoInstant(sat, '16:00') });
    done.push({ id, divisionId: dv.divId, homeTeamId: dv.tIds[h], awayTeamId: dv.tIds[a], homeScore: hs, awayScore: as, status: 'completed', isPlayoff: false });
  });
  const champions = [];
  for (const [di, dv] of divs.entries()) {
    const st = computeTournamentStandings(dv.divId, dv.tIds.map(id => ({ id, name: '', divisionId: dv.divId, status: 'accepted', poolId: null })), done.filter(g => g.divisionId === dv.divId), playoff, tSettings);
    const seed = (r) => st[r - 1]?.teamId ?? null;
    const [s1, s2, f] = PLAYOFF_SCORES[dv.name];
    const w1 = s1[0] > s1[1] ? seed(1) : seed(4); const w2 = s2[0] > s2[1] ? seed(2) : seed(3);
    const pg = (code, home, away, hp, ap, time, fieldIdx, [hs, as]) => ({ id: crypto.randomUUID(), tournament_id: tid, division_id: dv.divId, home_team_id: home, away_team_id: away,
      home_placeholder: hp, away_placeholder: ap, bracket_code: code, game_date: sat, game_time: time, diamond_id: venueId, venue_facility_id: tFields[fieldIdx], duration_minutes: 75,
      status: 'completed', is_playoff: true, home_score: hs, away_score: as, score_submission_source: 'admin_results', score_submitted_at: torontoInstant(sat, '18:30') });
    gameRows.push(pg('SF1', seed(1), seed(4), 'Seed #1', 'Seed #4', di === 0 ? '14:00' : '14:00', di === 0 ? 0 : 2, s1));
    gameRows.push(pg('SF2', seed(2), seed(3), 'Seed #2', 'Seed #3', di === 0 ? '14:00' : '15:30', di === 0 ? 1 : 0, s2));
    gameRows.push(pg('FIN', w1, w2, 'Winner SF1', 'Winner SF2', '17:00', di, f));
    const champ = f[0] > f[1] ? w1 : w2;
    champions.push(`${dv.name}: ${dv.teams[dv.tIds.indexOf(champ)]}`);
  }
  await insertAll('games', gameRows);
  die('tournament crowned', (await db.from('tournaments').update({ playoffs_published_at: torontoInstant(sat, '13:15'), champions_crowned_at: torontoInstant(sat, '18:45') }).eq('id', tid)).error);
  ok(`"${TN.name}" ${sat} at ${DM.venue.name}: ${divs.length} divisions of 4, ${order.length} pool games, semifinals and finals, all final · champions ${champions.join(' · ')} · free (no fee book)`);

  // The site: the notice (re-posted every rebuild), sponsors filled only when the club has none.
  const NX = cfg.siteExtras;
  if (NX?.notice) die('notice', (await db.from('org_site_notices').insert({ org_id: ORG, notice: NX.notice.text, detail: NX.notice.detail, posted_at: torontoInstant(addDays(D, -3), '09:00'),
    posted_by_user_id: ctx.OWNER, posted_by_email: cfg.people.owner.email, ends_at: torontoInstant(addDays(D, 30), '23:59') })).error);
  const site = await one('site', db.from('org_public_site_content').select('id, sponsors').eq('org_id', ORG).maybeSingle());
  if (site && (!Array.isArray(site.sponsors) || site.sponsors.length === 0) && NX?.sponsors?.length) {
    die('sponsors', (await db.from('org_public_site_content').update({ sponsors: NX.sponsors.map(s => ({ id: crypto.randomUUID(), name: s.name, ...(s.link ? { link: s.link } : {}) })) }).eq('id', site.id)).error);
    ok(`sponsors on the site: ${NX.sponsors.map(s => s.name).join(', ')}`);
  } else ok('sponsors already on the site (left alone)');
  ok('a notice on every public page until it ends');

  return {
    dressed: { id: dressed.id, name: dressed.name, slug: dressed.slug, nextDome: nextDome ? dayOf(nextDome.starts_at) : null, cashEstimate, overdue: DRESSED_ROSTER[OVERDUE], part: DRESSED_ROSTER[PART] },
    dome: { permit: P.name, part1: [part1[0], part1.at(-1)], part2From: heldSundays[P.offAfter], datesOff: offDays, total: shares.totalCents / 100 },
    tournament: { slug: TN.slug, day: sat, champions },
  };
}

function addMinutes(t, m) { const [h, mi] = t.split(':').map(Number); const total = h * 60 + mi + m; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
