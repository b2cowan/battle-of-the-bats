#!/usr/bin/env node
/**
 * THE STAGE 4b WALK FIXTURE — the schedule and roster Part 0 of SIGNED_IN_FAMILY_STAGE4B_WALK.html needs.
 * Dev Supabase + Stripe TEST only (same refusal as the other walk fixtures).
 *
 * Team: 15U AAA on the Lakeshore Lynx club fixture (org `uat-rep-club`, head coach uat-club-coach-15aaa@uat-rep-club.local).
 *
 *   setup     adds five games, each tagged so teardown removes exactly these:
 *               Game A–D   4 games, 4 to 7 days away (more than 48 hours)
 *               Game E     1 game about 30 hours away (inside the next 48 hours)
 *             and trims the ACTIVE roster to 11 by setting the surplus players inactive (their ids are saved in
 *             .probe/4b-walk-fixture.json so teardown puts exactly them back). The practices are already in the club fixture.
 *   status    prints what is in place and what the walk will see.
 *   teardown  deletes the five games and re-activates the players setup set inactive.
 *
 *   node --env-file=.env.local scripts/seed-4b-walk-fixture.mjs setup | status | teardown
 *
 *           It also fills in the club's mailing address on its public site (About us) if that is empty — without one the app
 *           refuses every parent invitation ("the club needs a contact email and a mailing address"). Teardown blanks it again
 *           only if setup was the one that filled it.
 *
 * Safe to run setup twice: it clears its own earlier games first and never inactivates a player a second time.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { refusal } from './lib/billing-walk-fixture.mjs';

const ORG_SLUG = 'uat-rep-club';
const TEAM_SLUG = '15u-aaa';
const MARK = '4B_WALK_FIXTURE';
const ACTIVE_TARGET = 11;
const STATE_FILE = '.probe/4b-walk-fixture.json';
const HOUR = 3600e3;
const DAY = 24 * HOUR;

const [command] = process.argv.slice(2);
if (!['setup', 'status', 'teardown'].includes(command ?? '')) {
  console.error('Usage: node --env-file=.env.local scripts/seed-4b-walk-fixture.mjs setup | status | teardown');
  process.exit(2);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const refused = refusal({ stripeKey: process.env.STRIPE_SECRET_KEY, supabaseUrl: url });
if (refused) { console.error(refused); process.exit(2); }
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = msg => console.log(`  ✓ ${msg}`);
const die = (what, error) => { if (error) { console.error(`  ✗ ${what}: ${error.message ?? error}`); process.exit(1); } };
const one = async (what, q) => { const { data, error } = await q; die(what, error); if (!data) die(what, 'not found'); return data; };

const org = await one('org', db.from('organizations').select('id').eq('slug', ORG_SLUG).single());
const team = await one('team', db.from('rep_teams').select('id, name').eq('org_id', org.id).eq('slug', TEAM_SLUG).single());
const year = await one('live season', db.from('rep_program_years').select('id, name').eq('team_id', team.id).eq('status', 'active').single());

const readState = () => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { inactivated: [], addressSetByFixture: false });
const writeState = (s) => { mkdirSync('.probe', { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); };

const rosterActive = async () => (await one('roster', db.from('rep_roster_players')
  .select('id, player_first_name, player_last_name, display_order').eq('program_year_id', year.id).eq('status', 'active')
  .order('display_order', { ascending: false }))) ;

async function clearGames() {
  die('clear earlier games', (await db.from('rep_team_events').delete().eq('team_id', team.id).eq('description', MARK)).error);
}

async function report() {
  const now = Date.now();
  const { data: games, error } = await db.from('rep_team_events').select('name, starts_at, status, event_type')
    .eq('program_year_id', year.id).eq('status', 'scheduled').gt('starts_at', new Date(now).toISOString()).order('starts_at');
  die('read schedule', error);
  const hrs = g => (new Date(g.starts_at).getTime() - now) / HOUR;
  const g = games.filter(e => e.event_type === 'league_game');
  console.log(`\n  ${team.name} · ${year.name}`);
  console.log(`  Games more than 48 hours away: ${g.filter(e => hrs(e) > 48).length} (walk needs at least 4: A–D)`);
  console.log(`  Games inside the next 48 hours: ${g.filter(e => hrs(e) <= 48).length} (walk needs exactly 1: E)`);
  console.log(`  Upcoming practices: ${games.filter(e => e.event_type === 'practice').length} (walk needs at least 2)`);
  const { data: site } = await db.from('org_public_site_content').select('contact_email, mailing_address').eq('org_id', org.id).maybeSingle();
  console.log(`  Club can send invitations (contact email + mailing address on its public site): ${site?.contact_email && site?.mailing_address ? 'yes' : 'NO — invitations will be refused'}`);
  console.log(`  Active players: ${(await rosterActive()).length} (walk needs 10 or 11)\n`);
}

if (command === 'status') { await report(); process.exit(0); }

if (command === 'teardown') {
  await clearGames();
  ok('deleted the five walk games');
  const { data: sib } = await db.from('rep_roster_players').select('id').eq('program_year_id', year.id).eq('admin_notes', MARK);
  if (sib?.length) {
    const del = await db.from('rep_roster_players').delete().in('id', sib.map(p => p.id));
    if (del.error) { die('make Noah inactive', (await db.from('rep_roster_players').update({ status: 'inactive' }).in('id', sib.map(p => p.id))).error); ok('Noah has an invitation on file, so he is set inactive instead of deleted'); }
    else ok('removed Noah Martin');
  }
  const state = readState();
  if (state.inactivated.length) {
    die('re-activate players', (await db.from('rep_roster_players').update({ status: 'active' }).in('id', state.inactivated)).error);
    ok(`put ${state.inactivated.length} player(s) back to active`);
  }
  if (state.addressSetByFixture) {
    die('blank the mailing address', (await db.from('org_public_site_content').update({ mailing_address: null }).eq('org_id', org.id)).error);
    ok('blanked the club mailing address setup had filled in');
  }
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
  process.exit(0);
}

// setup — games first
await clearGames();
const hourAhead = (ms) => { const t = new Date(Date.now() + ms); t.setUTCMinutes(0, 0, 0); return t; };
const where = { location: 'Lakeshore Dome', location_address: '100 Lakeshore Rd W, Oakville, ON' };
const specs = [
  ['Game A', 'Ancaster Aces', 4 * DAY + 3 * HOUR],
  ['Game B', 'Brantford Bats', 5 * DAY + 3 * HOUR],
  ['Game C', 'Cambridge Cardinals', 6 * DAY + 3 * HOUR],
  ['Game D', 'Dundas Dingers', 7 * DAY + 3 * HOUR],
  ['Game E', 'Elmira Eagles', 30 * HOUR],
];
const rows = specs.map(([label, opponent, ahead], i) => {
  const start = hourAhead(ahead);
  return {
    program_year_id: year.id, team_id: team.id, org_id: org.id, status: 'scheduled',
    event_type: 'league_game', name: `vs ${opponent} (${label})`, opponent, home_away: i % 2 ? 'away' : 'home',
    starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 2 * HOUR).toISOString(),
    description: MARK, ...where,
  };
});
die('games', (await db.from('rep_team_events').insert(rows)).error);
ok('added Games A–E (named on the schedule, e.g. “vs Ancaster Aces (Game A)”)');

// the club's public contact + mailing address (the app refuses parent invitations without both)
const { data: site0 } = await db.from('org_public_site_content').select('contact_email, mailing_address').eq('org_id', org.id).maybeSingle();
if (!site0) die('club public site row', 'uat-rep-club has no public-site row; open the club public site editor once, then re-run');
const fill = {};
if (!site0.contact_email) fill.contact_email = 'info@uat-rep-club.local';
if (!site0.mailing_address) fill.mailing_address = '100 Lakeshore Rd W, Oakville, ON L6K 1E1';
if (Object.keys(fill).length) {
  die('club contact', (await db.from('org_public_site_content').update(fill).eq('org_id', org.id)).error);
  const st = readState(); if (fill.mailing_address) st.addressSetByFixture = true; writeState(st);
  ok(`filled the club's public-site ${Object.keys(fill).join(' and ').replaceAll('_', ' ')} so invitations can go out`);
} else ok('the club already has a contact email and mailing address');

// then the roster. The walk's three test children are named in Part 0: Child A = Ada Okafor, Child B = Liam Martin,
// Child C = Noah Martin — a brother added here (same surname and parent as Liam), because no player on this team has a sibling.
const { data: earlier } = await db.from('rep_roster_players').select('id').eq('program_year_id', year.id).eq('admin_notes', MARK);
if (earlier?.length) die('clear earlier sibling', (await db.from('rep_roster_players').delete().in('id', earlier.map(p => p.id))).error);
const liam = await one('Liam Martin', db.from('rep_roster_players').select('*').eq('program_year_id', year.id)
  .eq('player_first_name', 'Liam').eq('player_last_name', 'Martin').single());
const { id: _id, created_at: _c, updated_at: _u, org_child_id: _oc, child_id: _ci, ...liamCopy } = liam;
const noah = await one('add Noah Martin', db.from('rep_roster_players').insert({
  ...liamCopy, player_first_name: 'Noah', player_number: '40', admin_notes: MARK, status: 'active',
  player_date_of_birth: null, primary_position: null, secondary_position: null, lineup_profile: null,
}).select('id').single());
ok('added Noah Martin, Liam’s brother (Child C) — teardown removes him');
const protectedIds = new Set([noah.id, liam.id]);

// set the surplus inactive, remembering exactly who
const active = await rosterActive();
const state = readState();
if (active.length > ACTIVE_TARGET) {
  const surplus = active.filter(p => !protectedIds.has(p.id) && !/^Ada$/.test(p.player_first_name)).slice(0, active.length - ACTIVE_TARGET); // highest display_order first
  die('trim roster', (await db.from('rep_roster_players').update({ status: 'inactive' }).in('id', surplus.map(p => p.id))).error);
  state.inactivated.push(...surplus.map(p => p.id));
  writeState(state);
  ok(`set ${surplus.length} player(s) inactive (${surplus.map(p => `${p.player_first_name} ${p.player_last_name ?? ''}`.trim()).join(', ')}) — teardown puts them back`);
} else {
  ok(`active roster already ${active.length}; nothing to trim`);
}
await report();
