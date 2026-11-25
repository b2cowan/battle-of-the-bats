/**
 * seed-on-sale-pictures-extras.mjs — three more things for the INVENTED club the on-sale pages' pictures are shot from
 * (Kestrel Bay Softball Association, `kestrel-bay`; plan docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md S3b).
 *
 *   (a) a PUBLIC tournament the club hosts — "Kestrel Bay Fall Classic", dated TODAY (America/Toronto), published, two divisions
 *       (U11, U13) of six invented visiting teams, two venues with diamonds, and games anchored to the moment this script runs:
 *       several finished earlier today with scores, exactly TWO live right now (one per division, with a partial score), and six
 *       more later today — so /kestrel-bay/kestrel-bay-fall-classic shows "Live now", "Up next" and "Latest results" — plus one
 *       short announcement (a row only; nothing is emailed).
 *   (b) a rep team in the Coaches Portal — "Kestrel Bay U13 Ospreys" — with a head coach (rep.coach@kestrel-bay.example.test) and a
 *       13-player roster (numbers, positions, bats/throws, a guardian contact each). NO birth dates, NO medical field, NO notes.
 *   (c) the club's books for Budget vs. Actual — the current fiscal year's plan (income and expense lines, some on budget, some
 *       over, some under, one off-plan) with the year's actual lines part-way through, and last year's plan and lines so
 *       Compare › Against last year fills. Entries go on the club's own General book; the house-league fees already on the season
 *       books (made by seed-prospect-demo.mjs) are budgeted against, not re-typed.
 *
 * RUN ORDER (always in this order; each step re-runs safely):
 *   1. node --env-file=.env.local scripts/seed-prospect-demo.mjs --club=kestrel      (the club, its season, its books' fee words)
 *   2. node --env-file=.env.local scripts/seed-on-sale-pictures-extras.mjs            (this file)
 *   3. node --env-file=.env.local scripts/capture-on-sale-pictures.mjs
 * Step 1 deletes the club's budget lines, so this script is ALWAYS run after it.
 *
 * ⚠ "LIVE NOW" DEPENDS ON THE CLOCK. A game is live from its start until start + its length + 30 minutes (lib/game-status.ts
 * `isGameLive`). The two live games here start 30 and 34 minutes before the script ran and last 90 minutes, so they read "live"
 * for about 85 minutes — RUN THE CAPTURE WITHIN ABOUT AN HOUR OF THIS SCRIPT. Run it in the daytime: the games span roughly
 * -5.5 hours to +5 hours around "now" and must all land on today's date.
 *
 * ⚖ /legal conditions for a picture on a public page (same as the club's seed): every name is invented, every address ends in
 * a reserved example.test name (kestrel-bay.example.test here; families kb.example.test), phones are 555-01xx, no birth date, no medical or allergy field, no real logo or photo.
 *
 * ⚠ DEV ONLY. Refuses any database that is not the dev project, any organization that is not `kestrel-bay`, and any whose
 * internal_notes lacks [ON_SALE_PICTURES]. No email is sent (rows only; nothing here calls the mailer). Every delete is scoped by
 * that organization's id. A password is set only when an account is first created (a random one nobody keeps).
 *
 * Re-running first removes ONLY what this script made: the tournament (by slug), the rep team (by slug) with its roster and
 * staff rows, the budget lines on sort_order >= 900, and the General book's lines carrying this script's marker.
 */
import { createClient } from '@supabase/supabase-js';
import { ensureFixtureUser } from './lib/fixture-user.mjs';

const DEV_REF = 'npgnrxaitgbtbtvvykto';
const PROD_REF = 'qcttcboqysynwcdyghil';
const SLUG = 'kestrel-bay';
const NOTES_MARKER = '[ON_SALE_PICTURES]';
const D = 'kestrel-bay.example.test';
const TOURNAMENT_SLUG = 'kestrel-bay-fall-classic';
const TEAM_SLUG = 'u13-ospreys';
const COACH = { email: `rep.coach@${D}`, name: 'Nadia Kowalczyk' };
/** Stamped on this script's lines in the General book (source_entity_id, with no source_module: invisible on every screen). */
const LINE_MARK = '5a1e0000-0000-4000-8000-00000000e001';
const PLAN_SORT_BASE = 900;
/** (d)'s house league games today, by fixed id, so a re-run removes exactly them. */
const GAME_DAY_IDS = Array.from({ length: 6 }, (_, i) => `5a1e0000-0000-4000-8000-0000000d00${String(i + 1).padStart(2, '0')}`);
const TZ = 'America/Toronto';

// ── safety 1: the dev project only ───────────────────────────────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local.'); process.exit(1); }
let host = '';
try { host = new URL(url).host; } catch { /* handled below */ }
if (url.includes(PROD_REF) || host !== `${DEV_REF}.supabase.co`) {
  console.error(`✗ Refusing to run: ${url.includes(PROD_REF) ? 'that is the PRODUCTION project' : 'the Supabase URL is not the dev project'}. This seed runs on dev only.`);
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const die = (label, error) => { if (error) { console.error(`✗ ${label}: ${error.message ?? error}`); process.exit(1); } };
const ok = (m) => console.log(`  ✓ ${m}`);
const head = (m) => console.log(`\n── ${m} ${'─'.repeat(Math.max(0, 74 - m.length))}`);
async function one(label, q) { const { data, error } = await q; die(label, error); return data; }

// ── safety 2: only Kestrel Bay, only the pictures club ───────────────────────────────────────────────────────────
const org = await one('find org', db.from('organizations').select('id, name, internal_notes, fiscal_first_month').eq('slug', SLUG).maybeSingle());
if (!org) { console.error(`✗ Refusing to run: no organization "${SLUG}". Run scripts/seed-prospect-demo.mjs --club=kestrel first.`); process.exit(1); }
if (!String(org.internal_notes ?? '').includes(NOTES_MARKER)) { console.error(`✗ Refusing to touch ${SLUG}: its internal_notes lack ${NOTES_MARKER}.`); process.exit(1); }
const ORG = org.id;
const owner = await one('owner seat', db.from('organization_members').select('user_id').eq('organization_id', ORG).eq('role', 'owner').eq('status', 'active').limit(1).maybeSingle());
if (!owner) { console.error('✗ The club has no active owner seat. Run seed-prospect-demo.mjs --club=kestrel first.'); process.exit(1); }
const OWNER = owner.user_id;
head(`Kestrel Bay extras · ${org.name} (${ORG}) · database ${host} (dev)`);

// ── clocks ───────────────────────────────────────────────────────────────────────────────────────────────────────
const NOW = new Date();
const pad2 = (n) => String(n).padStart(2, '0');
/** A UTC instant as the club's wall clock: { date: 'YYYY-MM-DD', time: 'HH:MM:00' }. */
function wall(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:00` };
}
const TODAY = wall(NOW.getTime()).date;
const YEAR = Number(TODAY.slice(0, 4));
const MIN = 60_000;

// ══ RESET — only what this script made ═══════════════════════════════════════════════════════════════════════════
head('Reset — only rows this script made');
// 1. the tournament
for (const t of await one('old tournament', db.from('tournaments').select('id').eq('org_id', ORG).eq('slug', TOURNAMENT_SLUG))) {
  const divs = (await one('old divisions', db.from('divisions').select('id').eq('tournament_id', t.id))).map(d => d.id);
  const venues = (await one('old diamonds', db.from('diamonds').select('id').eq('tournament_id', t.id))).map(v => v.id);
  die('old announcements', (await db.from('announcements').delete().eq('tournament_id', t.id)).error);
  die('old games', (await db.from('games').delete().eq('tournament_id', t.id)).error);
  if (venues.length) die('old facilities', (await db.from('venue_facilities').delete().in('venue_id', venues)).error);
  die('old diamonds', (await db.from('diamonds').delete().eq('tournament_id', t.id)).error);
  die('old teams', (await db.from('teams').delete().eq('tournament_id', t.id)).error);
  if (divs.length) die('old pools', (await db.from('pools').delete().in('division_id', divs)).error);
  die('old divisions', (await db.from('divisions').delete().eq('tournament_id', t.id)).error);
  die('old tournament', (await db.from('tournaments').delete().eq('id', t.id).eq('org_id', ORG)).error);
  ok('previous Fall Classic removed');
}
// 2. the rep team (the roster's children go with it, when nothing else holds them)
for (const t of await one('old rep team', db.from('rep_teams').select('id').eq('org_id', ORG).eq('slug', TEAM_SLUG))) {
  const kids = (await one('old roster', db.from('rep_roster_players').select('child_id').eq('team_id', t.id).eq('org_id', ORG))).map(r => r.child_id).filter(Boolean);
  die('old roster', (await db.from('rep_roster_players').delete().eq('team_id', t.id).eq('org_id', ORG)).error);
  die('old team games', (await db.from('rep_team_events').delete().eq('team_id', t.id).eq('org_id', ORG)).error);
  die('old coach rows', (await db.from('rep_team_coaches').delete().eq('team_id', t.id).eq('org_id', ORG)).error);
  die('old staff rows', (await db.from('rep_team_staff_memberships').delete().eq('team_id', t.id).eq('org_id', ORG)).error);
  die('old years', (await db.from('rep_program_years').delete().eq('team_id', t.id).eq('org_id', ORG)).error);
  die('old team', (await db.from('rep_teams').delete().eq('id', t.id).eq('org_id', ORG)).error);
  for (const id of kids) {
    const { error } = await db.from('org_children').delete().eq('id', id).eq('org_id', ORG);
    if (error) console.warn(`  ⚠ child ${id} kept (${error.message})`);
  }
  ok('previous U13 Ospreys removed');
}
// 3. the plan and the General book's lines
const generalBooks = await one('general books', db.from('accounting_ledgers').select('id').eq('org_id', ORG).eq('entity_type', 'org'));
if (generalBooks.length) die('old lines', (await db.from('accounting_entries').delete().in('ledger_id', generalBooks.map(l => l.id)).eq('source_entity_id', LINE_MARK)).error);
const oldPlan = await one('old plan', db.from('org_budget_lines').select('id').eq('org_id', ORG).gte('sort_order', PLAN_SORT_BASE));
if (oldPlan.length) {
  die('old periods', (await db.from('org_budget_periods').delete().in('budget_line_id', oldPlan.map(l => l.id))).error);
  die('old plan lines', (await db.from('org_budget_lines').delete().eq('org_id', ORG).gte('sort_order', PLAN_SORT_BASE)).error);
}
ok('previous plan lines and General book lines removed');
// 4. today's house league games (d): by their fixed ids, with the change rows their insert recorded
die('old game-day changes', (await db.from('league_game_changes').delete().eq('org_id', ORG).in('game_id', GAME_DAY_IDS)).error);
die('old game-day games', (await db.from('league_games').delete().eq('org_id', ORG).in('id', GAME_DAY_IDS)).error);
ok('previous game-day house league games removed');

// ══ (a) THE TOURNAMENT ═══════════════════════════════════════════════════════════════════════════════════════════
head('(a) Kestrel Bay Fall Classic');
const LIVE_AGO = [30, 34];           // minutes before now that each division's live game started
const LENGTH = 90;                   // minutes a game runs
const SPACING = 105;                 // minutes between a division's games
const DIVISIONS = [
  { name: 'U11', venue: 0, liveAgo: LIVE_AGO[0], teams: ['Ashgrove Aces', 'Port Merrin Pilots', 'Cedar Hollow Cardinals', 'Greywater Gulls', 'Briar Ridge Bandits', 'Oakhaven Orioles'],
    live: [3, 2], done: [[9, 4], [6, 2], [5, 8]] },
  { name: 'U13', venue: 1, liveAgo: LIVE_AGO[1], teams: ['Fenwick Bay Foxes', 'Silverbrook Sluggers', 'Marlow Heights Mavericks', 'Tamarack Thunder', 'Whitecliff Wolves', 'Dunmore Park Drifters'],
    live: [1, 4], done: [[7, 3], [4, 10], [8, 5]] },
];
// [home, away] by team index, in time order: three finished, the live one, three to come
const PAIRS = [[0, 1], [2, 3], [4, 5], [0, 2], [1, 4], [3, 5], [0, 3]];
const SLOT_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];

const orgVenues = await one('club venues', db.from('org_venues').select('id, name, address').eq('org_id', ORG).in('name', ['Harbourview Park', 'Alder Fields']));
const orgFacilities = await one('club facilities', db.from('org_venue_facilities').select('id, name, org_venue_id, display_order').eq('org_id', ORG).order('display_order'));
const venueSpec = ['Harbourview Park', 'Alder Fields'].map(n => orgVenues.find(v => v.name === n));
if (venueSpec.some(v => !v)) { console.error('✗ The club venues Harbourview Park / Alder Fields are missing. Run seed-prospect-demo.mjs --club=kestrel first.'); process.exit(1); }

// the games' instants, checked against today before anything is written
const slotMs = (div, k) => NOW.getTime() - div.liveAgo * MIN + k * SPACING * MIN;
const earliest = Math.min(...DIVISIONS.map(d => slotMs(d, SLOT_OFFSETS[0])));
const latest = Math.max(...DIVISIONS.map(d => slotMs(d, SLOT_OFFSETS[SLOT_OFFSETS.length - 1])));
if (wall(earliest).date !== TODAY) { console.error(`✗ It is too early in the day (${wall(NOW.getTime()).time.slice(0, 5)} ${TZ}): the first finished game would start yesterday. Run this after about 6:00 a.m.`); process.exit(1); }
if (wall(latest).date !== TODAY) console.warn(`  ⚠ It is late in the day: the last games start after midnight and read as tomorrow's. Up next still lists them; "dated today" holds for the rest.`);

const tournament = await one('tournament', db.from('tournaments').insert({
  org_id: ORG, year: YEAR, name: 'Kestrel Bay Fall Classic', slug: TOURNAMENT_SLUG,
  status: 'active', is_active: true, start_date: TODAY, end_date: TODAY, sport: 'softball',
  contact_email: `tournaments@${D}`, list_in_directory: false,
  require_score_finalization: false, notify_teams_on_complete: false,
  settings: { format: 'round_robin', fee_scope: 'tournament', tie_breakers: ['h2h', 'rd', 'rf', 'ra'], tie_breaker_scope: 'tournament', buffer_minutes: 15,
    game_timing_scope: 'tournament', game_duration_minutes: LENGTH, show_fees_on_register: false, payment_instructions_on_form: false, roster_require: false },
}).select('id').single());
const TID = tournament.id;
ok(`tournament ${TID} (slug ${TOURNAMENT_SLUG}, ${TODAY}, active)`);

// venues for the event (copied from the club's own, with their facilities)
const eventVenues = [];
for (const v of venueSpec) {
  const dm = await one(`diamond ${v.name}`, db.from('diamonds').insert({ tournament_id: TID, name: v.name, address: v.address, source_org_venue_id: v.id }).select('id').single());
  const facs = [];
  for (const [i, f] of orgFacilities.filter(x => x.org_venue_id === v.id).slice(0, 2).entries()) {
    const fr = await one(`facility ${f.name}`, db.from('venue_facilities').insert({ venue_id: dm.id, tournament_id: TID, name: f.name, facility_type: 'diamond', display_order: i, source_org_facility_id: f.id }).select('id, name').single());
    facs.push(fr);
  }
  eventVenues.push({ id: dm.id, name: v.name, facs });
}

let nGames = 0, nLive = 0, nDone = 0, nNext = 0;
for (const [di, div] of DIVISIONS.entries()) {
  const row = await one(`division ${div.name}`, db.from('divisions').insert({
    tournament_id: TID, name: div.name, display_order: di, capacity: 8, schedule_visibility: 'published',
  }).select('id').single());
  const teams = [];
  for (const [i, name] of div.teams.entries()) {
    teams.push(await one(`team ${name}`, db.from('teams').insert({
      tournament_id: TID, division_id: row.id, name, status: 'accepted', payment_status: 'paid', registered_at: new Date(NOW.getTime() - (20 - i) * 86400000).toISOString(),
    }).select('id').single()));
  }
  const venue = eventVenues[div.venue];
  const games = PAIRS.map(([h, a], i) => {
    const k = SLOT_OFFSETS[i];
    const w = wall(slotMs(div, k));
    const fac = venue.facs[i % venue.facs.length];
    const finished = k < 0, live = k === 0;
    if (finished) nDone++; else if (live) nLive++; else nNext++;
    nGames++;
    const score = finished ? div.done[i] : live ? div.live : [null, null];
    return {
      tournament_id: TID, division_id: row.id, home_team_id: teams[h].id, away_team_id: teams[a].id,
      game_date: w.date, game_time: w.time, duration_minutes: LENGTH, is_playoff: false,
      location: `${venue.name} — ${fac.name}`, diamond_id: venue.id, venue_facility_id: fac.id,
      // a live game is a scheduled game inside its window (never `completed`) with a running score
      status: finished ? 'completed' : 'scheduled', home_score: score[0], away_score: score[1],
    };
  });
  die(`games ${div.name}`, (await db.from('games').insert(games)).error);
}
ok(`2 divisions × 6 teams · ${nGames} games: ${nDone} finished, ${nLive} live now, ${nNext} later today (spacing ${SPACING} min, ${LENGTH}-minute games)`);
die('announcement', (await db.from('announcements').insert({
  tournament_id: TID, title: 'Welcome to the Fall Classic',
  body: 'Thanks for coming out to Harbourview Park and Alder Fields. Games start on time; please check in with your coordinator 30 minutes before your first game.',
  published_at: new Date(NOW.getTime() - 3 * 3600_000).toISOString(), pinned: false, channel_site: true, channel_email: false,
})).error);
ok('one announcement (site only; no email)');

// ══ (b) THE REP TEAM ═════════════════════════════════════════════════════════════════════════════════════════════
head('(b) Kestrel Bay U13 Ospreys');
const coach = (await ensureFixtureUser(db, { email: COACH.email, password: 'UATPassword2026!', userMetadata: { full_name: COACH.name }, resetPassword: false })).user;
const nowIso = NOW.toISOString();
const seat = await one('coach seat', db.from('organization_members').select('id').eq('organization_id', ORG).eq('user_id', coach.id).maybeSingle());
if (!seat) die('coach member', (await db.from('organization_members').insert({ organization_id: ORG, user_id: coach.id, role: 'coach', status: 'active', display_name: COACH.name, invited_at: nowIso, accepted_at: nowIso })).error);
const team = await one('rep team', db.from('rep_teams').insert({
  // Public (Club Website Stage 1's walk): its games reach the club home's Today. Its coach's setting, as in the product.
  org_id: ORG, name: 'Kestrel Bay U13 Ospreys', slug: TEAM_SLUG, sport: 'softball', division: 'U13', color: '#00695C', is_archived: false, schedule_visibility: 'public_link',
}).select('id').single());
const py = await one('program year', db.from('rep_program_years').insert({
  team_id: team.id, org_id: ORG, name: `${YEAR} Season`, year: YEAR, status: 'active', tryout_open: false, born_from_year: YEAR - 12, born_to_year: YEAR - 11,
}).select('id').single());
die('staff membership', (await db.from('rep_team_staff_memberships').insert({ org_id: ORG, team_id: team.id, user_id: coach.id, coach_role: 'head_coach', status: 'active', staff_kind: null })).error);
die('coach projection', (await db.from('rep_team_coaches').insert({ program_year_id: py.id, team_id: team.id, org_id: ORG, user_id: coach.id, coach_role: 'head_coach' })).error);
// [first, last, number, primary, secondary, bats, throws, guardian first]
const ROSTER = [
  ['Ava', 'Brennan', '2', 'P', 'SS', 'R', 'R', 'Colleen'], ['Maya', 'Okonkwo', '7', 'C', '1B', 'R', 'R', 'Emeka'],
  ['Chloe', 'Desrosiers', '9', '1B', 'LF', 'L', 'L', 'Marc'], ['Priya', 'Venkataraman', '11', '2B', 'SS', 'R', 'R', 'Anand'],
  ['Harper', 'Lindqvist', '12', 'SS', '3B', 'R', 'R', 'Karin'], ['Ella', 'Marchetti', '14', '3B', '2B', 'L', 'R', 'Gianna'],
  ['Zoe', 'Abernathy', '17', 'LF', 'RF', 'R', 'R', 'Todd'], ['Nora', 'Haldane', '21', 'CF', 'LF', 'L', 'L', 'Fiona'],
  ['Isla', 'Teixeira', '23', 'RF', 'CF', 'R', 'R', 'Paulo'], ['Quinn', 'Sorensen', '24', 'P', 'RF', 'R', 'R', 'Erik'],
  ['Lucia', 'Fontaine', '27', 'P', '1B', 'L', 'L', 'Mireille'], ['Tessa', 'Whitlock', '30', 'C', 'LF', 'R', 'R', 'Dana'],
  ['Mira', 'Castellano', '33', 'CF', 'RF', 'R', 'R', 'Rosa'],
];
const rosterRows = ROSTER.map(([first, last, num, pos, pos2, bats, throws, g], i) => ({
  program_year_id: py.id, team_id: team.id, org_id: ORG,
  player_first_name: first, player_last_name: last, player_number: num, primary_position: pos, secondary_position: pos2, bats, throws,
  status: 'active', source: 'admin_manual', display_order: i,
  guardian_first_name: g, guardian_last_name: last, guardian_email: `${g}.${last}@${D}`.toLowerCase(), guardian_phone: `905-555-01${pad2(10 + i * 3)}`,
}));
die('roster', (await db.from('rep_roster_players').insert(rosterRows)).error);
// Three games for the club home (Club Website Stage 1's walk): one under way with the coach's running score (no result:
// it reads "Live now 2–1", never a finished tie), one away later today with no address (no Directions), one won two
// days ago (a Latest results row with its day).
const repAt = (ms) => new Date(ms).toISOString();
// 6:30 p.m. on the club's day two days back, whatever the season's offset (EST −5, EDT −4) and whatever the hour now.
const twoDaysBack = wall(NOW.getTime() - 2 * 24 * 60 * MIN).date;
const twoDaysAgo = [`${twoDaysBack}T18:30:00-05:00`, `${twoDaysBack}T18:30:00-04:00`].map(s => new Date(s))
  .find(d => wall(d.getTime()).time === '18:30:00');
if (!twoDaysAgo) die('rep games', { message: 'could not place the game two days back' });
if (wall(NOW.getTime() + 180 * MIN).date !== TODAY) die('rep games', { message: 'the away game would fall on tomorrow: run this before about 9:00 p.m.' });
const repGames = [
  { starts: NOW.getTime() - 25 * MIN, opponent: 'Marlow Heights', home_away: 'home', location: 'Harbourview Park · Diamond 2', location_address: '12 Harbourview Rd', team_score: 2, opponent_score: 1, result: null },
  { starts: NOW.getTime() + 180 * MIN, opponent: 'Whitecliff', home_away: 'away', location: 'Whitecliff Community Park · Diamond 3', location_address: null, team_score: null, opponent_score: null, result: null },
  { starts: twoDaysAgo.getTime(), opponent: 'Whitecliff', home_away: 'home', location: 'Harbourview Park · Diamond 2', location_address: '12 Harbourview Rd', team_score: 5, opponent_score: 3, result: 'win' },
].map(g => ({
  org_id: ORG, team_id: team.id, program_year_id: py.id, event_type: 'league_game', name: `${g.home_away === 'away' ? 'at' : 'vs'} ${g.opponent}`,
  starts_at: repAt(g.starts), ends_at: repAt(g.starts + 90 * MIN), location: g.location, location_address: g.location_address,
  opponent: g.opponent, home_away: g.home_away, team_score: g.team_score, opponent_score: g.opponent_score, result: g.result, status: 'scheduled', arrival_time: null,
}));
die('rep games', (await db.from('rep_team_events').insert(repGames)).error);
ok(`${repGames.length} rep games: one live (2–1, no result), one away later today, one won two days ago · schedule Public`);
ok(`team ${team.id} · head coach ${COACH.email} · ${rosterRows.length} players (number, position, bats/throws, guardian contact; no birth date, no medical, no notes)`);

// ══ (c) THE BOOKS ════════════════════════════════════════════════════════════════════════════════════════════════
head('(c) Budget vs. Actual');
const words = await one('platform words', db.from('budget_items').select('id, name, category_id, budget_categories!inner(name, org_id)').is('org_id', null).is('budget_categories.org_id', null));
const word = (cat, item) => {
  const w = words.find(x => x.name === item && x.budget_categories?.name === cat);
  if (!w) die(`word ${cat} › ${item}`, { message: 'not in the platform library' });
  return { category_id: w.category_id, item_id: w.id };
};
const fee = async (name) => {
  const w = await one(`fee word ${name}`, db.from('budget_items').select('id, category_id').eq('org_id', ORG).eq('name', name).maybeSingle());
  return w ? { category_id: w.category_id, item_id: w.id } : null;
};
const MONTHS_IN = (y, m, d = 1) => `${y}-${pad2(m)}-${pad2(d)}`;
/**
 * The plan, by the club's year. `plan`: [month, amount] periods. `lines`: the year's actual lines [month, day, description, amount, method, payee].
 * `cur` is this year (to the day before today); `prev` is last year, scaled by `prevFactor` so Against last year shows growth and decline.
 */
const PLAN = [
  // ── money in
  { dir: 'in', w: () => fee(`${YEAR} House League`), wPrev: () => fee(`${YEAR - 1} House League`), description: 'House league registration fees', plan: [[9, 9000], [10, 4500], [11, 2000]], planPrev: [[10, 2000], [11, 1000]], book: 'season' },
  { dir: 'in', w: () => word('Tournaments', 'Registration revenue'), description: 'Tournament entry fees', plan: [[6, 2800], [10, 2800]], f: 0.9, lines: [
    [6, 12, 'Spring Invitational — eight team entries', 2880, 'E-transfer', 'Spring Invitational teams'],
    [10, 3, 'Fall Classic — twelve team entries', 3120, 'E-transfer', 'Fall Classic teams'],
  ] },
  { dir: 'in', w: () => word('Sponsorship', 'Team sponsorship'), description: 'Club sponsors', plan: [[3, 4500], [9, 4500]], f: 0.88, lines: [
    [3, 5, 'Sponsorship — Harbourview Hardware', 2500, 'Cheque 1041', 'Harbourview Hardware'],
    [3, 18, 'Sponsorship — Kestrel Bay Marina', 2500, 'Cheque 1046', 'Kestrel Bay Marina'],
    [4, 2, 'Sponsorship — Lakeside Dental', 2500, 'E-transfer', 'Lakeside Dental'],
    [9, 9, 'Sponsorship — Fenwick Family Pharmacy', 1000, 'Cheque 1058', 'Fenwick Family Pharmacy'],
  ] },
  { dir: 'in', w: () => word('Fundraising', 'Fundraising drive'), description: 'Fundraisers', plan: [[5, 1800], [10, 2200]], f: 1.3, lines: [
    [5, 24, 'Spring bottle drive', 1860, 'Cash deposit', null],
    [10, 17, 'Fall raffle — ticket sales', 3350, 'E-transfer', null],
  ] },
  { dir: 'in', w: () => word('Other Income', 'Donation'), description: 'Donations', plan: [[12, 1000]], f: 0.8, lines: [
    [6, 21, 'Donation — Kestrel Bay Lions Club', 850, 'Cheque 1049', 'Kestrel Bay Lions Club'],
    [11, 8, 'Donation — Ashby family', 500, 'E-transfer', null],
  ] },
  // Last year only: a one-time grant the club did not get this year (an Against last year row with a blank this-year side)
  { dir: 'in', prevOnly: true, w: () => word('Sponsorship', 'Grant'), description: 'Town recreation grant', plan: [[5, 4000]], planPrev: [[5, 4000]], f: 1, lines: [
    [5, 15, 'Town recreation grant', 4000, 'E-transfer', 'Town of Kestrel Bay'],
  ] },
  // ── money out
  { dir: 'out', w: () => word('Facilities', 'Diamond Permits'), description: 'Diamond permits', plan: [[4, 3000], [5, 3000], [8, 3000]], f: 0.93, lines: [
    [4, 6, 'Diamond permits — spring block', 3000, 'Cheque 2201', 'Town of Kestrel Bay'],
    [6, 3, 'Diamond permits — summer block', 3000, 'Cheque 2209', 'Town of Kestrel Bay'],
    [8, 29, 'Diamond permits — fall block', 2950, 'Cheque 2218', 'Town of Kestrel Bay'],
  ] },
  { dir: 'out', w: () => word('Officials', 'Umpire Fees'), description: 'Umpire fees', plan: [[5, 1500], [6, 1500], [7, 1500], [9, 1000], [10, 1000]], f: 0.9, lines: [
    [5, 31, 'Umpire fees — May', 1480, 'E-transfer', 'Kestrel Bay Umpires Association'],
    [6, 28, 'Umpire fees — June', 1620, 'E-transfer', 'Kestrel Bay Umpires Association'],
    [7, 26, 'Umpire fees — July', 1505, 'E-transfer', 'Kestrel Bay Umpires Association'],
    [9, 27, 'Umpire fees — September', 1320, 'E-transfer', 'Kestrel Bay Umpires Association'],
    [10, 25, 'Umpire fees — October', 1315, 'E-transfer', 'Kestrel Bay Umpires Association'],
  ] },
  { dir: 'out', w: () => word('Team Gear', 'Balls'), description: 'Game and practice balls', plan: [[4, 1800]], f: 1.05, lines: [
    [4, 10, 'Practice balls — six dozen', 640, 'Card', 'Larchwood Sports Supply'],
    [6, 2, 'Game balls — two cases', 785, 'Card', 'Larchwood Sports Supply'],
  ] },
  { dir: 'out', w: () => word('Facilities', 'Field Equipment'), description: 'Field equipment and bases', plan: [[4, 1500]], f: 0.8, lines: [
    [4, 14, 'Bases and home plates', 1240, 'Cheque 2205', 'Larchwood Sports Supply'],
  ] },
  { dir: 'out', w: () => word('Admin', 'Insurance'), description: 'Club insurance', plan: [[3, 2400]], f: 0.95, lines: [
    [3, 4, 'Club insurance — annual premium', 2380, 'E-transfer', 'Northgate Sport Insurance'],
  ] },
  { dir: 'out', w: () => word('Team Gear', 'Jerseys'), description: 'Uniforms — jerseys', plan: [[3, 4200]], f: 0.92, lines: [
    [3, 21, 'Jerseys — U9 to U15', 3980, 'Cheque 2203', 'Pinewood Team Wear'],
  ] },
  { dir: 'out', w: () => word('Team Gear', 'Hats'), description: 'Uniforms — hats', plan: [[3, 700]], f: 0.9, lines: [
    [3, 21, 'Team hats', 745, 'Cheque 2204', 'Pinewood Team Wear'],
  ] },
  { dir: 'out', w: () => word('Tournaments', 'Officials'), description: 'Tournament umpires', plan: [[6, 900], [10, 900]], f: 0.85, lines: [
    [6, 14, 'Spring Invitational — umpires', 880, 'E-transfer', 'Kestrel Bay Umpires Association'],
    [10, 18, 'Fall Classic — umpires', 1270, 'E-transfer', 'Kestrel Bay Umpires Association'],
  ] },
  { dir: 'out', w: () => word('Tournaments', 'Misc'), description: 'Tournament supplies and awards', plan: [[6, 300], [10, 300]], f: 1.1, lines: [
    [6, 13, 'Spring Invitational — ribbons and trophies', 235, 'Card', 'Larchwood Sports Supply'],
    [10, 14, 'Fall Classic — ribbons and water', 175, 'Card', 'Larchwood Sports Supply'],
  ] },
  { dir: 'out', w: () => word('Training', 'Coaching Clinics'), description: 'Coaching clinics', plan: [[4, 900]], f: 0.9, lines: [
    [4, 20, 'Coach certification clinic — six coaches', 900, 'E-transfer', null],
  ] },
  { dir: 'out', w: () => word('Admin', 'Software'), description: 'Registration software', plan: [[1, 600]], f: 0.95, lines: [
    [1, 12, 'Registration software — annual', 540, 'Card', null],
  ] },
  { dir: 'out', w: () => word('Events', 'Year-End Party'), description: 'Year-end party', plan: [[12, 1500]], f: 0.9, lines: [] },
  // Off-plan: money spent on a word with no plan line (the Off-plan tile)
  { dir: 'out', w: () => word('Facilities', 'Lighting Fees'), description: null, plan: null, f: 1, lines: [
    [9, 16, 'Field lights — Pinecrest evening games', 420, 'Cheque 2221', 'Town of Kestrel Bay'],
  ] },
];

// the club's General book (the one this script writes to), and the two fiscal years
let general = (await one('general book', db.from('accounting_ledgers').select('id').eq('org_id', ORG).eq('entity_type', 'org').is('entity_id', null).maybeSingle()));
if (!general) general = await one('general book', db.from('accounting_ledgers').insert({ org_id: ORG, entity_type: 'org', entity_id: null, name: `${org.name} — General` }).select('id').single());
const yearId = async (first) => one(`fiscal year ${first}`, db.rpc('club_fiscal_year_ensure', { p_org: ORG, p_day: first }));
const CUR_FIRST = `${YEAR}-01-01`, PREV_FIRST = `${YEAR - 1}-01-01`;
if (Number(org.fiscal_first_month) !== 1) console.warn(`  ⚠ the club's fiscal year starts in month ${org.fiscal_first_month}, not January: the dates below assume January–December.`);
const curYear = await yearId(CUR_FIRST);
const prevYear = await yearId(PREV_FIRST);
/** Last year's spending ran lighter than this year's (a growing club), so the books carry a healthy balance forward. */
const PREV_OUT = 0.9;
const round5 = (n) => Math.round(n / 5) * 5;
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const clampDay = (y, m, d) => Math.min(d, lastDay(y, m));

let nLines = 0, nEntries = 0, order = PLAN_SORT_BASE;
for (const spec of PLAN) {
  for (const which of ['cur', 'prev']) {
    const y = which === 'cur' ? YEAR : YEAR - 1;
    const isPrev = which === 'prev';
    const w = await (isPrev && spec.wPrev ? spec.wPrev() : spec.w());
    if (!w) { console.warn(`  ⚠ no budget word for "${spec.description}" (${which}): skipped`); continue; }
    const periods = isPrev ? (spec.planPrev ?? (spec.plan ? spec.plan.map(([m, a]) => [m, round5(a * 0.9)]) : null)) : spec.plan;
    if (spec.prevOnly && !isPrev) continue;
    if (periods) {
      const total = periods.reduce((s, [, a]) => s + a, 0);
      const line = await one(`line ${spec.description}`, db.from('org_budget_lines').insert({
        org_id: ORG, fiscal_year_id: isPrev ? prevYear : curYear, season_year: y, category_id: w.category_id, item_id: w.item_id,
        description: spec.description, total_amount: total, sort_order: order++,
      }).select('id').single());
      nLines++;
      die(`periods ${spec.description}`, (await db.from('org_budget_periods').insert(periods.map(([m, amount], j) => ({
        budget_line_id: line.id, period_label: MONTHS_IN(y, m).slice(0, 7), period_date: MONTHS_IN(y, m, 1), amount, sort_order: j,
      })))).error);
    }
    if (spec.book === 'season') continue;   // the house-league fees are already on the season books, filed to their fee word
    const rows = [];
    for (const [m, d, text, amount, method, payee] of spec.lines ?? []) {
      const entryDay = MONTHS_IN(y, m, clampDay(y, m, d));
      if (!isPrev && entryDay >= TODAY) continue;                 // nothing is recorded in the future
      rows.push({
        ledger_id: general.id, entry_date: entryDay, description: text, amount: isPrev ? round5(amount * (spec.f ?? 0.9) * (spec.dir === 'out' ? PREV_OUT : 1)) : amount,
        entry_type: spec.dir === 'in' ? 'income' : 'expense', status: 'posted', payment_method: method, payee_payer: payee,
        budget_category_id: w.category_id, budget_item_id: w.item_id, created_by: OWNER, source_entity_id: LINE_MARK,
      });
    }
    if (rows.length) { die(`entries ${spec.description}`, (await db.from('accounting_entries').insert(rows)).error); nEntries += rows.length; }
  }
}
ok(`${nLines} plan lines (this year and last, ${(PLAN.filter(p => p.plan).length)} each) · ${nEntries} lines on the General book`);

// what the screen will read: the year's totals off the books, for the report-back
const yearTotals = async (first, last) => {
  const lines = await one('totals', db.from('accounting_entries').select('entry_type, amount, status, accounting_ledgers!inner(org_id, entity_type)')
    .eq('accounting_ledgers.org_id', ORG).eq('status', 'posted').gte('entry_date', first).lte('entry_date', last).limit(5000));
  const sum = (t) => lines.filter(l => l.entry_type === t).reduce((s, l) => s + Number(l.amount), 0);
  return { in: sum('income'), out: sum('expense') };
};
const t = await yearTotals(`${YEAR}-01-01`, `${YEAR}-12-31`);
ok(`${YEAR} so far: money in $${t.in.toFixed(2)}, money out $${t.out.toFixed(2)}, net $${(t.in - t.out).toFixed(2)} (all club books)`);

// ══ (d) HOUSE LEAGUE GAMES TODAY (Club Website Stage 1's walk) ═══════════════════════════════════════════════════
// The club's season (seed-prospect-demo.mjs) plays on Saturdays; the walk needs games on the day it runs. Six games in
// its two published divisions, around the moment this runs: a final, a game past its window with no score yet, two live
// ("Score after the game"), one later today and one postponed. Inserted into a PUBLISHED division, each records an
// unsent "added" change (the house league's change recorder), which keeps it off the public pages until sent. These are
// invented games that stand for ones published with the schedule, so the seed removes exactly those change rows (never
// marks them sent: only the club's Send the changes sends, and it would queue family emails a seed must never make;
// tests/unit/league-game-changes-guard.test.ts holds that no code writes the table by hand).
head('(d) House league games today');
const hlSeason = await one('house league season', db.from('league_seasons').select('id').eq('org_id', ORG).eq('slug', `${YEAR}-house-league`).maybeSingle());
if (!hlSeason) die('house league season', { message: `no ${YEAR}-house-league season: run seed-prospect-demo.mjs --club=kestrel first` });
const hlDivs = await one('divisions', db.from('league_divisions').select('id, name').eq('season_id', hlSeason.id).in('name', ['U11', 'U15']));
const hlTeams = await one('teams', db.from('league_teams').select('id, name, division_id').eq('season_id', hlSeason.id));
const placeOf = await one('places', db.from('org_venues').select('id, name, org_venue_facilities(id, name)').eq('org_id', ORG).in('name', ['Harbourview Park', 'Alder Fields']));
const divId = (name) => hlDivs.find(d => d.name === name)?.id ?? die('division', { message: `no ${name}` });
const teamId = (name) => hlTeams.find(t => t.name === name)?.id ?? die('team', { message: `no ${name}` });
const diamond = (venue, fac) => {
  const v = placeOf.find(p => p.name === venue) ?? die('venue', { message: `no ${venue}` });
  return { org_venue_id: v.id, org_venue_facility_id: v.org_venue_facilities.find(f => f.name === fac)?.id ?? null, location: `${venue} · ${fac}` };
};
const hlGames = [
  { div: 'U11', home: 'Foxes', away: 'Ospreys', ago: 180, status: 'completed', score: [7, 5], at: diamond('Harbourview Park', 'Diamond 1') },
  { div: 'U11', home: 'Mariners', away: 'Lynx', ago: 150, status: 'scheduled', score: null, at: diamond('Harbourview Park', 'Diamond 3') },
  { div: 'U11', home: 'Lynx', away: 'Foxes', ago: 30, status: 'scheduled', score: null, at: diamond('Harbourview Park', 'Diamond 1') },
  { div: 'U15', home: 'Tides', away: 'Ravens', ago: 20, status: 'scheduled', score: null, at: diamond('Alder Fields', 'Diamond 1') },
  { div: 'U11', home: 'Ospreys', away: 'Mariners', ago: -90, status: 'scheduled', score: null, at: diamond('Harbourview Park', 'Diamond 1') },
  { div: 'U15', home: 'Ravens', away: 'Tides', ago: -150, status: 'postponed', score: null, at: diamond('Alder Fields', 'Diamond 1') },
].map((g, i) => {
  const start = NOW.getTime() - g.ago * MIN;
  return {
    id: GAME_DAY_IDS[i], org_id: ORG, season_id: hlSeason.id, division_id: divId(g.div), home_team_id: teamId(g.home), away_team_id: teamId(g.away),
    scheduled_at: new Date(start).toISOString(), ends_at: new Date(start + 90 * MIN).toISOString(), ...g.at, status: g.status,
    home_score: g.score ? g.score[0] : null, away_score: g.score ? g.score[1] : null,
  };
});
if (hlGames.some(g => wall(Date.parse(g.scheduled_at)).date !== TODAY)) die('house league games', { message: 'a game would fall off today: run this between about 5:00 a.m. and 9:00 p.m.' });
die('house league games', (await db.from('league_games').insert(hlGames)).error);
die('added changes', (await db.from('league_game_changes').delete().eq('org_id', ORG).in('game_id', GAME_DAY_IDS).is('sent_at', null)).error);
ok(`${hlGames.length} house league games today in U11 and U15: a final, one past its window with no score, two live, one later, one postponed (as published)`);

head('Done');
console.log(`  Tournament   /${SLUG}/${TOURNAMENT_SLUG}   ("Live now" holds until about ${wall(NOW.getTime() + (LENGTH + 30 - Math.max(...LIVE_AGO)) * MIN).time.slice(0, 5)} ${TZ}: capture before then)`);
console.log(`  Roster       /${SLUG}/coaches/teams/${team.id}/roster   (sign in as ${COACH.email})`);
console.log(`  Books        /${SLUG}/admin/accounting/budget-vs-actual   (sign in as president@${D})`);
