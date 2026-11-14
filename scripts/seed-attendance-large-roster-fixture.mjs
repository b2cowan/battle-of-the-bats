#!/usr/bin/env node
/**
 * THE LARGE-ROSTER ATTENDANCE FIXTURE — what the One attendance record walk's "stats past 1,000 rows" part needs.
 * Dev Supabase + Stripe TEST only (same refusal as the other walk fixtures).
 *
 * Why: a Supabase select silently stops at 1,000 rows, and the three attendance stat reads used to be single selects, so a team with
 * more than 1,000 started attendance rows lost the rest without an error (S3 step 1 pages them). No dev season is that big (the
 * largest holds ~500), so this adds enough PAST practices to the live season of 15U AAA (org `uat-rep-club`) to push it past 1,000.
 *
 *   setup     adds past practices (named "Large-roster practice N", tagged so teardown removes exactly them) and one attendance row per
 *             ACTIVE player per practice, status cycling In / Out / Late / Not marked per player and day. Enough practices are added
 *             that the season passes TARGET_ROWS started rows. Then prints the status report.
 *   status    prints how many started rows the season holds, whether that passes 1,000, and — read by this script's OWN paged query,
 *             independent of the product's code — three players' figures in the page's own words ("Games 3/4 · Practices 52/80"),
 *             so you can compare them with Roster → Attendance.
 *   teardown  deletes the fixture's practices (their attendance rows go with them).
 *
 *   node --env-file=.env.local scripts/seed-attendance-large-roster-fixture.mjs setup | status | teardown
 *
 * Safe to run setup twice: it clears its own earlier practices first.
 */
import { createClient } from '@supabase/supabase-js';
import { refusal } from './lib/billing-walk-fixture.mjs';

const ORG_SLUG = 'uat-rep-club';
const TEAM_SLUG = '15u-aaa';
const MARK = 'ONE_RECORD_LARGE_ROSTER_FIXTURE';
const TARGET_ROWS = 1300;
const PAGE = 1000;
const HOUR = 3600e3;
const DAY = 24 * HOUR;

const [command] = process.argv.slice(2);
if (!['setup', 'status', 'teardown'].includes(command ?? '')) {
  console.error('Usage: node --env-file=.env.local scripts/seed-attendance-large-roster-fixture.mjs setup | status | teardown');
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
const players = await one('active roster', db.from('rep_roster_players')
  .select('id, player_first_name, player_last_name').eq('program_year_id', year.id).eq('status', 'active').order('display_order'));

async function clearFixture() {
  die('clear earlier fixture practices', (await db.from('rep_team_events').delete().eq('team_id', team.id).eq('description', MARK)).error);
}

/** Every started, scheduled attendance row of the season — this script's OWN pager (never the product's). */
async function startedRows() {
  const now = new Date().toISOString();
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('rep_team_event_attendance')
      .select('id, player_id, status, rep_team_events!inner(event_type)')
      .eq('program_year_id', year.id).eq('rep_team_events.status', 'scheduled').lte('rep_team_events.starts_at', now)
      .order('id').range(from, from + PAGE - 1);
    die('read attendance', error);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

async function report() {
  const rows = await startedRows();
  console.log(`\n  ${team.name} · ${year.name}`);
  console.log(`  Started attendance rows in this season: ${rows.length} — ${rows.length > 1000 ? 'PAST 1,000: a single plain read would have stopped at 1,000' : 'NOT past 1,000 yet: run setup'}`);
  const GAME = ['league_game', 'tournament_game', 'external_tournament'];
  const fig = (list, kinds) => {
    const mine = list.filter(r => kinds(r.rep_team_events.event_type));
    const attended = mine.filter(r => r.status === 'attending' || r.status === 'late').length;
    const known = mine.filter(r => ['attending', 'late', 'absent'].includes(r.status)).length;
    return `${attended}/${known}`;
  };
  console.log('  Figures read by this script, in the page’s words (attended/known), for comparison with Roster → Attendance:');
  for (const p of players.slice(0, 3)) {
    const mine = rows.filter(r => r.player_id === p.id);
    console.log(`    ${`${p.player_first_name} ${p.player_last_name ?? ''}`.trim().padEnd(22)} Games ${fig(mine, t => GAME.includes(t))} · Practices ${fig(mine, t => t === 'practice')}   (${mine.length} rows)`);
  }
  console.log('');
}

if (command === 'status') { await report(); process.exit(0); }

if (command === 'teardown') {
  await clearFixture();
  ok('deleted the fixture practices (and their attendance rows)');
  process.exit(0);
}

// setup
await clearFixture();
const existing = (await startedRows()).length;
if (players.length === 0) die('roster', 'no active players on the team');
const eventsNeeded = Math.max(0, Math.ceil((TARGET_ROWS - existing) / players.length));
if (eventsNeeded === 0) { ok(`the season already holds ${existing} started rows`); await report(); process.exit(0); }

const base = new Date(); base.setUTCHours(23, 0, 0, 0);
const events = Array.from({ length: eventsNeeded }, (_, i) => {
  const start = new Date(base.getTime() - (i + 2) * DAY); // 2..N days ago, all started
  return {
    program_year_id: year.id, team_id: team.id, org_id: org.id, status: 'scheduled', event_type: 'practice',
    name: `Large-roster practice ${i + 1}`, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + HOUR).toISOString(),
    description: MARK, location: 'Lakeshore Dome', location_address: '100 Lakeshore Rd W, Oakville, ON',
  };
});
const made = [];
for (let i = 0; i < events.length; i += 200) {
  const { data, error } = await db.from('rep_team_events').insert(events.slice(i, i + 200)).select('id');
  die('practices', error);
  made.push(...data);
}
ok(`added ${made.length} past practices`);

const STATUSES = ['attending', 'absent', 'late', 'unknown', 'attending'];
const now = new Date().toISOString();
const attendance = made.flatMap((e, ei) => players.map((p, pi) => ({
  event_id: e.id, player_id: p.id, program_year_id: year.id, team_id: team.id, org_id: org.id,
  status: STATUSES[(pi + ei) % STATUSES.length], set_by_kind: 'coach', set_at: now,
})));
for (let i = 0; i < attendance.length; i += 500) {
  die('attendance rows', (await db.from('rep_team_event_attendance').insert(attendance.slice(i, i + 500))).error);
}
ok(`added ${attendance.length} attendance rows (${players.length} active players × ${made.length} practices)`);
await report();
