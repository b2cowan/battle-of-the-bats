/**
 * Repair/seed the UAT coach fixture on the DEV database.
 *
 * ⚠ WHY THIS EXISTS. Two build sessions in a row could not run the Playwright probes for the
 * coaches portal: every spec signed in as the UAT coach and landed on "Not assigned to any teams".
 *
 * Diagnosed 2026-08-01. The cause was ONE missing row: the UAT coach had **no
 * `organization_members` row for the UAT org**. Everything else was already correct — the team,
 * its active 2026 program year, and the coach's own `rep_team_coaches` head-coach assignment all
 * existed. The portal resolves org context from `organization_members` before it ever looks at
 * coaching assignments, so a coach who is assigned to a team but is not a member of its org
 * resolves no org, and every team lookup then comes back empty.
 *
 * ⚠ Two earlier explanations were WRONG and are recorded here so nobody re-derives them:
 *   · "the `rep_teams` row is orphaned, its org no longer exists" — it is not; the org is there.
 *   · "the coach has no coaching assignment" — they do. That diagnosis came from a query that
 *     selected a column name which does not exist (`rep_team_coaches.rep_team_id`; the real one
 *     is `team_id`) and whose error was not checked, so an errored query read as "zero rows".
 *     ⚠ ALWAYS check `error` on a supabase-js select before believing an empty result.
 *
 * Running this makes the coach fixture whole, so `--grep` probes across the whole portal work:
 *   node scripts/seed-uat-coach-fixture.mjs
 *
 * It is IDEMPOTENT — re-running it repairs whatever is missing and leaves the rest alone. It only
 * ever touches the org named by `UAT_ORG_SLUG`, so it cannot disturb real dev data.
 *
 * ⚠ DEV ONLY. It reads `.env.local`, which points at the dev project. Never point it at prod.
 *
 * The practice it seeds is deliberately shaped to exercise the whole Practice Plans surface in one
 * event: a plain timed block, a rotating block with three stations and three groups (so the field
 * screen's carousel and "My station" both render), and a "rest of practice" block. The practice is
 * anchored a few minutes in the past so the run screen opens INSIDE the rotation, which is the
 * state worth probing. Station staff includes the UAT coach's own display name so the
 * "that's you" pre-selection path is exercised too.
 *
 * It also seeds a GAME that is happening right now, with a saved lineup and attendance, because the
 * Game-Day console has no door outside a live window — a fixture with only a practice cannot reach
 * that screen at all, which is how three phases of it shipped with no rendered layout check.
 *
 * ⚠ Sport-neutral by requirement (`lib/sports.ts` Sport Pack rule): no baseball/softball-shaped
 * station names, drills or player names. A fixture is content too. (The lineup's position codes are
 * the schema's own fixed value domain, not a sport choice — see the note at that block.)
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { insertCommitmentWithRecords, paidOnce } from './lib/seed-commitment-records.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, '..', '.env.local'), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const orgSlug = process.env.UAT_ORG_SLUG;
const coachEmail = process.env.UAT_COACH_EMAIL;

if (!url || !key || !orgSlug || !coachEmail) {
  console.error('✗ Missing env. Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UAT_ORG_SLUG, UAT_COACH_EMAIL.');
  process.exit(1);
}
if (/\.supabase\.co/.test(url) && url.includes('qcttcboqysynwcdyghil')) {
  console.error('✗ Refusing to run: that is the PRODUCTION project.');
  process.exit(1);
}

const db = createClient(url, key);
const COACH_NAME = 'UAT Coach';
const ok = (m) => console.log(`  ✓ ${m}`);

// ── 1. Org ───────────────────────────────────────────────────────────────────
const { data: org } = await db.from('organizations').select('id, slug').eq('slug', orgSlug).maybeSingle();
if (!org) { console.error(`✗ No organization with slug "${orgSlug}".`); process.exit(1); }
ok(`org ${org.slug} (${org.id})`);

// ── 2. Team ──────────────────────────────────────────────────────────────────
let { data: team } = await db.from('rep_teams').select('id, name').eq('org_id', org.id).limit(1).maybeSingle();
if (!team) {
  const ins = await db.from('rep_teams')
    .insert({ org_id: org.id, name: 'UAT Test Team', slug: 'uat-test-team' })
    .select('id, name').single();
  if (ins.error) { console.error('✗ team insert', ins.error.message); process.exit(1); }
  team = ins.data;
}
ok(`team ${team.name} (${team.id})`);

// ── 3. Active program year ───────────────────────────────────────────────────
let { data: py } = await db.from('rep_program_years')
  .select('id, year, status').eq('team_id', team.id).eq('status', 'active')
  .order('year', { ascending: false }).limit(1).maybeSingle();
if (!py) {
  const year = new Date().getFullYear();
  const ins = await db.from('rep_program_years')
    .insert({ team_id: team.id, org_id: org.id, name: `${year} Season`, year, status: 'active' })
    .select('id, year, status').single();
  if (ins.error) { console.error('✗ program year insert', ins.error.message); process.exit(1); }
  py = ins.data;
}
ok(`program year ${py.year} (${py.id})`);

// ── 4. The coach's auth user ─────────────────────────────────────────────────
const { data: userPage, error: uErr } = await db.auth.admin.listUsers({ perPage: 1000 });
if (uErr) { console.error('✗ listUsers', uErr.message); process.exit(1); }
const user = userPage.users.find(u => u.email?.toLowerCase() === coachEmail.toLowerCase());
if (!user) { console.error(`✗ No auth user for ${coachEmail}. Run tests/uat/create-uat-accounts.sql first.`); process.exit(1); }
ok(`auth user ${coachEmail} (${user.id})`);

// ── 5. Org membership — THE FIRST MISSING PIECE ──────────────────────────────
const { data: member } = await db.from('organization_members')
  .select('id, role, status').eq('organization_id', org.id).eq('user_id', user.id).maybeSingle();
if (!member) {
  const ins = await db.from('organization_members').insert({
    organization_id: org.id, user_id: user.id, role: 'coach', status: 'active',
    display_name: COACH_NAME, accepted_at: new Date().toISOString(),
  });
  if (ins.error) { console.error('✗ organization_members insert', ins.error.message); process.exit(1); }
  ok('organization_members row CREATED — this was THE bug');
} else {
  if (member.status !== 'active' || !member.role) {
    await db.from('organization_members').update({ status: 'active', role: member.role ?? 'coach' }).eq('id', member.id);
  }
  ok(`organization_members already present (${member.role}/${member.status})`);
}

// ── 6. Coaching assignment — THE SECOND MISSING PIECE ────────────────────────
// `capabilities: null` = a head coach, who holds everything. That is what the probes need in
// order to reach every surface; an assistant-parity probe sets its own narrower grants.
//
// ⚠ M1 (mig 245, 2026-08-16): access truth is the TEAM MEMBERSHIP; the season row is the record
// + what the legacy write routes read. A fixture with the row but no membership 403s on every
// membership-gated route — the exact "every spec lands on Not assigned" incident this script's
// header describes, wearing the new table.
/** Head-coach membership on a team — idempotent, and the ONE place this fixture writes one. */
async function ensureHeadCoachMembership(teamId) {
  const mem = await db.from('rep_team_staff_memberships').upsert({
    org_id: org.id, team_id: teamId, user_id: user.id,
    coach_role: 'head_coach', capabilities: null,
    status: 'active', revoked_at: null, revoked_by: null,
  }, { onConflict: 'team_id,user_id' });
  if (mem.error) { console.error('✗ rep_team_staff_memberships upsert', mem.error.message); process.exit(1); }
}
await ensureHeadCoachMembership(team.id);
ok('team staff membership present');
const { data: coachRow } = await db.from('rep_team_coaches')
  .select('id, coach_role').eq('program_year_id', py.id).eq('user_id', user.id).maybeSingle();
if (!coachRow) {
  const ins = await db.from('rep_team_coaches').insert({
    program_year_id: py.id, team_id: team.id, org_id: org.id,
    user_id: user.id, coach_role: 'head_coach', capabilities: null,
  });
  if (ins.error) { console.error('✗ rep_team_coaches insert', ins.error.message); process.exit(1); }
  ok('rep_team_coaches row CREATED');
} else {
  ok(`rep_team_coaches already present (${coachRow.coach_role})`);
}

// ── 7. Roster ────────────────────────────────────────────────────────────────
const FIRST_NAMES = ['Avery', 'Blake', 'Casey', 'Devon', 'Emerson', 'Frankie', 'Gray', 'Harper', 'Indigo', 'Jules', 'Kai', 'Logan'];
const { data: existingPlayers } = await db.from('rep_roster_players')
  .select('id, player_first_name').eq('program_year_id', py.id).eq('status', 'active')
  .order('display_order', { ascending: true });
let players = existingPlayers ?? [];
if (players.length === 0) {
  const rows = FIRST_NAMES.map((name, i) => ({
    program_year_id: py.id, team_id: team.id, org_id: org.id,
    player_first_name: name, player_last_name: 'Test', player_number: String(i + 1),
    status: 'active', source: 'admin_manual', display_order: i,
  }));
  const ins = await db.from('rep_roster_players').insert(rows).select('id, player_first_name');
  if (ins.error) { console.error('✗ roster insert', ins.error.message); process.exit(1); }
  players = ins.data;
  ok(`roster seeded (${players.length} players)`);
} else {
  ok(`roster already present (${players.length} active players)`);
}
const ids = players.map(p => p.id);

// ── 8. A practice with a plan that exercises the whole surface ───────────────
// Anchored 20 minutes ago so the run screen opens INSIDE the rotation — the state worth probing.
const startsAt = new Date(Date.now() - 20 * 60_000).toISOString();
const endsAt = new Date(Date.now() + 70 * 60_000).toISOString();
const group = (n, name, slice) => ({ id: `uat-grp-${n}`, name, playerIds: slice });

const plan = {
  version: 1,
  goal: 'Sharper decisions under pressure.',
  practiceTypes: ['Skills'],
  equipment: ['Cones', 'Bibs', 'Spare balls'],
  blocks: [
    {
      id: 'uat-blk-warmup',
      title: 'Warm-up',
      duration: { minutes: 15 },
      description: 'Dynamic warm-up, then partner work at walking pace.',
      goal: 'Everyone moving and talking before the first drill.',
      coachingPoints: ['Heads up', 'Call for it early'],
      staff: [COACH_NAME],
      playerIds: ids.slice(0, 6),
    },
    {
      id: 'uat-blk-circuit',
      title: 'Skills circuit',
      duration: { minutes: 45 },
      description: 'Three stations, groups move on every fifteen minutes.',
      goal: 'Each player gets a full turn at all three.',
      staff: [COACH_NAME],
      stations: [
        {
          id: 'uat-stn-1', name: 'Footwork ladder', count: 2,
          equipment: ['Cones'], setup: 'Two ladders along the sideline, ten steps apart.',
          coachingPoints: ['Short steps', 'Eyes up, not down'],
          staff: [COACH_NAME],
          note: 'Only two ladders tonight — run it in pairs.',
        },
        {
          id: 'uat-stn-2', name: 'Close control', count: 1,
          equipment: ['Cones', 'Spare balls'], setup: 'Ten-metre box marked with cones.',
          coachingPoints: ['Small touches', 'Change of pace out of the turn'],
          staff: ['Sam Assistant'],
        },
        {
          id: 'uat-stn-3', name: 'Finishing', count: 1,
          equipment: ['Bibs'], setup: 'Work from the top of the area, one server.',
          coachingPoints: ['Pick the corner early', 'Follow it in'],
          staff: ['Jordan Helper'],
        },
      ],
      rotation: {
        intervalMinutes: 15,
        groupSource: 'random',
        groups: [
          group(1, 'Group A', ids.slice(0, 4)),
          group(2, 'Group B', ids.slice(4, 8)),
          group(3, 'Group C', ids.slice(8, 12)),
        ],
      },
    },
    {
      id: 'uat-blk-game',
      title: 'Small-sided game',
      duration: { minutes: null, restOfPractice: true },
      description: 'Four-a-side, rolling subs, coaches stay quiet.',
      goal: 'Let them play.',
      playerIds: ids,
    },
  ],
};

const { data: existingEvent } = await db.from('rep_team_events')
  .select('id').eq('program_year_id', py.id).eq('name', 'UAT probe practice').maybeSingle();

let eventId;
if (existingEvent) {
  const upd = await db.from('rep_team_events')
    .update({ starts_at: startsAt, ends_at: endsAt, practice_plan: plan })
    .eq('id', existingEvent.id).select('id').single();
  if (upd.error) { console.error('✗ event update', upd.error.message); process.exit(1); }
  eventId = upd.data.id;
  ok('practice refreshed');
} else {
  const ins = await db.from('rep_team_events').insert({
    program_year_id: py.id, team_id: team.id, org_id: org.id,
    event_type: 'practice', name: 'UAT probe practice',
    starts_at: startsAt, ends_at: endsAt,
    location: 'UAT Fields', field_number: '2', arrival_time: '17:45',
    practice_plan: plan,
  }).select('id').single();
  if (ins.error) { console.error('✗ event insert', ins.error.message); process.exit(1); }
  eventId = ins.data.id;
  ok('practice created');
}

// ── 9. Attendance, so "Who's here tonight" has something true to show ────────
const { data: att } = await db.from('rep_team_event_attendance').select('id').eq('event_id', eventId).limit(1);
if (!att?.length) {
  const rows = ids.map((pid, i) => ({
    event_id: eventId, player_id: pid,
    program_year_id: py.id, team_id: team.id, org_id: org.id,
    status: i < 9 ? 'attending' : i < 10 ? 'late' : i < 11 ? 'absent' : 'unknown',
  }));
  const ins = await db.from('rep_team_event_attendance').insert(rows);
  if (ins.error) console.log(`  ! attendance skipped (${ins.error.message}) — probes still run`);
  else ok('attendance seeded');
} else {
  ok('attendance already present');
}

// ── 10. A GAME that is happening right now, so the Game-Day console can be probed ────
// ⚠ WHY A SEPARATE EVENT. The console only exists inside a live window (roughly two hours before
// the first pitch through three hours after the last), and outside it the door is deliberately
// absent. A fixture with only a practice therefore cannot reach the console AT ALL, which is why
// three phases of Game-Day Mode shipped with no rendered check. This game is the probe surface.
//
// It is anchored 30 minutes in the past so the console opens in LIVE mode mid-first-period — the
// state worth measuring — rather than the read-only recap. `resolveUatContext()` re-anchors it on
// every run, so it cannot rot into review mode overnight and quietly measure the wrong screen.
const gameStarts = new Date(Date.now() - 30 * 60_000).toISOString();
const gameEnds = new Date(Date.now() + 90 * 60_000).toISOString();
const INNINGS = 6;

const { data: existingGame } = await db.from('rep_team_events')
  .select('id').eq('program_year_id', py.id).eq('name', 'UAT probe game').maybeSingle();

let gameId;
if (existingGame) {
  const upd = await db.from('rep_team_events')
    .update({ starts_at: gameStarts, ends_at: gameEnds })
    .eq('id', existingGame.id).select('id').single();
  if (upd.error) { console.error('✗ game update', upd.error.message); process.exit(1); }
  gameId = upd.data.id;
  ok('game refreshed (re-anchored to now)');
} else {
  const ins = await db.from('rep_team_events').insert({
    program_year_id: py.id, team_id: team.id, org_id: org.id,
    event_type: 'league_game', name: 'UAT probe game',
    opponent: 'Probe Rovers', home_away: 'home',
    starts_at: gameStarts, ends_at: gameEnds,
    location: 'UAT Fields', field_number: '1', arrival_time: '17:30',
    uniform: 'Home kit',
  }).select('id').single();
  if (ins.error) { console.error('✗ game insert', ins.error.message); process.exit(1); }
  gameId = ins.data.id;
  ok('game created');
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ **THE LIVE SEASON HAD NO FINISHED GAMES, AND THAT MADE THE WHOLE INSIGHTS PORTAL UNWALKABLE**
 * (added 2026-08-19, found on the first owner walk of §58).
 *
 * The fixture seeded finished games for the PRIOR season and for the between-seasons team, but never
 * for the live one — so the season a coach is actually running had no record, no form, no scoring
 * difference and no game log. Insights reads a season back to the coach; a live season with nothing
 * to read renders every honest empty state and nothing else.
 *
 * ⚠ **AND IT REPORTED GREEN.** `check:layout` renders these screens and measures what it finds, so
 * seven Insights tabs of empty states swept clean and were reported as covered — the exact
 * "green sweep over an EMPTY FIXTURE is not evidence" trap this repo has already written down
 * (memory/project_layout_invariant_sweep.md). The tables, the filter chips and the scoreboard band
 * — the parts most likely to overflow a phone — had never been measured at all.
 *
 * What the shape below is chosen to produce, deliberately:
 *   · a REAL record with all three outcomes (win / loss / tie), so the record chip and form pips render
 *   · a ONE-RUN game, which is the only thing that makes the "Close games" tile appear
 *   · both home and away, so the home/away findings rule has a sample
 *   · two event TYPES, so the Results per-type breakdown has more than one row
 *   · TAGS on some games, so the tag filter chips render — without them there is nothing to filter
 * ⚠ Dates are fixed to the season's own year, never to "now": a rendered baseline keyed on the
 *   screen's text must not drift every time the sweep runs (the same rule the prior season follows).
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */
/**
 * ⚠⚠ **THIS GUARD USED `.maybeSingle()` AND THEREFORE NEVER GUARDED ANYTHING** (found and fixed
 * 2026-08-19, while seeding the P2 reports). "vs Ridgeview" is seeded TWICE on purpose — once as a
 * league game and once as a tournament game, so the Results tab's per-type breakdown has more than
 * one row. `.maybeSingle()` on two rows returns an ERROR, the destructure above discarded it, and
 * `liveFinished` came back null every single time — so **every run of this seeder re-inserted the
 * whole set of six games.** A fixture reseeded four times claimed a 3-2-1 record and held 24 games.
 *
 * The lesson is the one this file's own header states about `error` checks, one level in: a helper
 * that ERRORS on the shape you gave it looks exactly like a helper that found nothing. `.limit(1)`
 * cannot error on multiplicity, so it cannot lie about it.
 */
const { data: liveFinishedRows, error: liveFinishedErr } = await db.from('rep_team_events')
  .select('id').eq('program_year_id', py.id).eq('name', 'vs Ridgeview').limit(1);
if (liveFinishedErr) { console.error('✗ live-season games lookup', liveFinishedErr.message); process.exit(1); }
if (!liveFinishedRows?.length) {
  const at = (m, d) => new Date(Date.UTC(py.year, m, d, 22, 0)).toISOString();
  const liveGames = [
    { result: 'win',  team_score: 6, opponent_score: 3, opponent: 'Ridgeview',  type: 'league_game',     home: true },
    { result: 'win',  team_score: 4, opponent_score: 3, opponent: 'Lakeside',   type: 'league_game',     home: false }, // one-run → Close games tile
    { result: 'loss', team_score: 2, opponent_score: 5, opponent: 'Northgate',  type: 'league_game',     home: false },
    { result: 'tie',  team_score: 3, opponent_score: 3, opponent: 'Fairhaven',  type: 'league_game',     home: true },
    { result: 'win',  team_score: 8, opponent_score: 2, opponent: 'Westbrook',  type: 'tournament_game', home: true },
    { result: 'loss', team_score: 1, opponent_score: 2, opponent: 'Ridgeview',  type: 'tournament_game', home: false }, // one-run
  ].map((g, i) => ({
    program_year_id: py.id, team_id: team.id, org_id: org.id,
    event_type: g.type, name: `vs ${g.opponent}`, opponent: g.opponent,
    home_away: g.home ? 'home' : 'away', starts_at: at(3, 4 + i * 6),
    status: 'scheduled', result: g.result, team_score: g.team_score, opponent_score: g.opponent_score,
  }));
  const insLive = await db.from('rep_team_events').insert(liveGames).select('id, opponent, event_type');
  if (insLive.error) { console.error('✗ live-season games insert', insLive.error.message); process.exit(1); }
  ok(`live-season games seeded (${liveGames.length} finalized, 3-2-1 with two one-run games)`);

  /* Game TAGS — the coach's own vocabulary for grouping games, and the thing the Results tab's
     filter chips are built from. A chip only appears for a tag with at least one FINISHED game, so
     these have to be attached to the rows above rather than to the upcoming probe game. */
  const tagNames = ['Rivalry', 'Playoffs'];
  const tagIds = {};
  for (const name of tagNames) {
    const { data: existingTag } = await db.from('rep_team_tags')
      .select('id').eq('team_id', team.id).eq('kind', 'game').eq('name', name).maybeSingle();
    if (existingTag) { tagIds[name] = existingTag.id; continue; }
    const t = await db.from('rep_team_tags')
      .insert({ org_id: org.id, team_id: team.id, kind: 'game', name })
      .select('id').single();
    if (t.error) { console.error(`✗ tag ${name}`, t.error.message); process.exit(1); }
    tagIds[name] = t.data.id;
  }
  const byOpponent = Object.fromEntries((insLive.data ?? []).map(r => [`${r.opponent}|${r.event_type}`, r.id]));
  const links = [
    { event_id: byOpponent['Ridgeview|league_game'], tag_id: tagIds.Rivalry },
    { event_id: byOpponent['Ridgeview|tournament_game'], tag_id: tagIds.Rivalry },
    { event_id: byOpponent['Westbrook|tournament_game'], tag_id: tagIds.Playoffs },
    { event_id: byOpponent['Northgate|league_game'], tag_id: tagIds.Rivalry },
  ].filter(l => l.event_id);
  const insTags = await db.from('rep_team_event_tags').insert(links);
  if (insTags.error) { console.error('✗ event tag links', insTags.error.message); process.exit(1); }
  ok(`game tags seeded (${tagNames.join(' + ')}, ${links.length} games tagged)`);
} else {
  ok('live-season finished games already present');
}

// ── 11. A saved lineup for it, so the console renders the BOARD ──────────────
// Without a lineup the console renders its no-lineup fallback instead — a legitimate screen, but
// the thin one. The board is where the tap targets, the two-column On field / Bench split and the
// period cursor live, so that is what the sweep should be measuring.
//
// ⚠ The position codes below come from the schema's fixed value domain (`VALID_POSITIONS`), not
// from a chosen sport — there is no neutral alternative to pick. Everything a fixture DOES choose
// (names, opponent, location) stays sport-neutral per the Sport Pack rule.
const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

const { data: lineupRow, error: lErr } = await db.from('rep_team_lineups')
  .upsert({
    event_id: gameId, program_year_id: py.id, team_id: team.id, org_id: org.id,
    lineup_mode: 'everyone_bats', inning_count: INNINGS,
  }, { onConflict: 'event_id' })
  .select('id').single();
if (lErr) { console.error('✗ lineup upsert', lErr.message); process.exit(1); }
ok(`lineup header ready (${INNINGS} innings)`);

const { data: existingEntries } = await db.from('rep_team_lineup_entries')
  .select('id').eq('lineup_id', lineupRow.id).limit(1);
if (!existingEntries?.length) {
  // Three players sit each inning, and the seat rotates — so every inning has a populated bench
  // AND the season roll-up sees an even spread rather than one player carrying it.
  const positionsFor = (playerIdx) => {
    const out = {};
    for (let inning = 1; inning <= INNINGS; inning++) {
      const benchStart = ((inning - 1) * 3) % ids.length;
      const seat = (playerIdx - benchStart + ids.length) % ids.length;
      out[String(inning)] = seat < 3 ? 'Bench' : FIELD_POSITIONS[(seat - 3) % FIELD_POSITIONS.length];
    }
    return out;
  };
  const rows = ids.map((pid, i) => ({
    lineup_id: lineupRow.id, player_id: pid,
    batting_order: i + 1, starter: true,
    inning_positions: positionsFor(i),
  }));
  const ins = await db.from('rep_team_lineup_entries').insert(rows);
  if (ins.error) { console.error('✗ lineup entries insert', ins.error.message); process.exit(1); }
  ok(`lineup entries seeded (${rows.length} players, 3 on the bench each inning)`);
} else {
  ok('lineup entries already present');
}

// ── 12. Attendance on the game, so "Who's here" opens onto something true ────
const { data: gAtt } = await db.from('rep_team_event_attendance').select('id').eq('event_id', gameId).limit(1);
if (!gAtt?.length) {
  const rows = ids.map((pid, i) => ({
    event_id: gameId, player_id: pid,
    program_year_id: py.id, team_id: team.id, org_id: org.id,
    status: i < 10 ? 'attending' : i < 11 ? 'late' : 'absent',
  }));
  const ins = await db.from('rep_team_event_attendance').insert(rows);
  if (ins.error) console.log(`  ! game attendance skipped (${ins.error.message}) — probes still run`);
  else ok('game attendance seeded');
} else {
  ok('game attendance already present');
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   ── 12b. A SEASON OF LINEUPS AND ATTENDANCE, so the two P2 reports have something to say ──────

   ⚠⚠ **THE SAME TRAP AS SECTION 13 AND SECTION 11, ONE MORE TIME.** Until this block existed the
   live season carried exactly ONE saved lineup (the probe game) and attendance on two events. The
   Playing Time report's new position-recency matrix would have rendered a single column of one
   date, and the Attendance report's receipts drill-in would have opened onto "nothing missed" for
   every player — and `check:layout` would have measured both and reported green, having drawn
   neither. A rendered sweep over an empty fixture is not evidence (OWNER_QA_LEDGER §58).

   What the shape below is chosen to produce, deliberately — every line here is load-bearing for a
   surface that would otherwise be blank:
     · SIX games with saved lineups, each rotating the batting order by a different offset, so the
       matrix has real spread: most players have played several positions, and some cells are
       genuinely EMPTY (never played there) — the dash is a state worth rendering.
     · FIVE practices, four of them exactly a week apart and one deliberately NOT, so the receipts'
       "every one of these falls on a Tuesday" note is TRUE for one player and FALSE for another.
       Seeding every practice on the same weekday would have made that note fire for everybody,
       which would have proved nothing.
     · Devon Test misses three aligned practices AND one game, because the receipts list spans both
       and a practices-only fixture cannot show that it does. Devon is the player the layout sweep
       opens (`coach-attendance-receipts`), resolved BY NAME in scripts/uat-fixture-context.mjs.
     · A handful of no-replies, so the "Recorded" tile is not a flat 100% — that tile exists to say
       "these percentages rest on less than you think", and it cannot say it at 100%.
   ⚠ Dates are fixed to the season's own year, never to "now" — same rule as the games above.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
const { data: seasonGames } = await db.from('rep_team_events')
  .select('id, starts_at').eq('program_year_id', py.id).neq('id', gameId)
  .in('event_type', ['league_game', 'tournament_game'])
  .not('result', 'is', null).order('starts_at', { ascending: true });

if (seasonGames?.length) {
  /**
   * ⚠ **THE GUARD IS PER GAME, NOT PER BLOCK — and the block-level version was a real trap.** It
   * asked "does ANY season lineup exist?" and skipped all six if so. Each game does two separate,
   * non-atomic writes (the lineup header, then its entries) in a loop that exits on first error, so
   * a failure on game 4 left three lineups behind — and the next run read those three, called the
   * whole block "already present", and permanently skipped the missing three. The reports would
   * then render partial data forever, which is the same class of quiet-wrong-answer this whole
   * section exists to prevent, just one level down.
   */
  const { data: existingLineups } = await db.from('rep_team_lineups')
    .select('event_id').eq('program_year_id', py.id).neq('event_id', gameId);
  const seeded = new Set((existingLineups ?? []).map(l => l.event_id));
  const missing = seasonGames.filter(g => !seeded.has(g.id));
  if (missing.length) {
    for (const g of missing) {
      /* ⚠ The rotation offset is the game's index in the SEASON, never its index in `missing`.
         Keying it off the repair list would give a game a different grid depending on whether it
         was seeded in the first run or a later repair — a fixture that is not the same fixture. */
      const gi = seasonGames.findIndex(x => x.id === g.id);
      const head = await db.from('rep_team_lineups').upsert({
        event_id: g.id, program_year_id: py.id, team_id: team.id, org_id: org.id,
        lineup_mode: 'everyone_bats', inning_count: INNINGS,
      }, { onConflict: 'event_id' }).select('id').single();
      if (head.error) { console.error('✗ season lineup upsert', head.error.message); process.exit(1); }
      /* Each game shifts the rotation by a different amount, so a player's position history varies
         game to game instead of every game being the same board.

         ⚠⚠ **THE RESTRICTED PLAYERS ARE THE POINT, and the first version had none.** A plain
         rotation over 12 players and 6 innings walks EVERYONE through all nine positions, so the
         matrix came back with 108 filled cells and not one dash — and the "never played here"
         state, which is the one the module's whole honesty rule is about, would have been swept at
         four widths without ever being drawn. Four players are therefore pinned to a small pool,
         the way a real team's are. */
      const RESTRICTED = { 8: ['LF', 'CF', 'RF'], 9: ['LF', 'CF', 'RF'], 10: ['C', '1B'], 11: ['P', 'C'] };
      const rows = ids.map((pid, i) => {
        const pool = RESTRICTED[i] ?? FIELD_POSITIONS;
        const positions = {};
        for (let inning = 1; inning <= INNINGS; inning++) {
          const benchStart = ((inning - 1) * 3 + gi * 2) % ids.length;
          const seat = (i - benchStart + ids.length) % ids.length;
          positions[String(inning)] = seat < 3 ? 'Bench' : pool[(seat - 3 + gi) % pool.length];
        }
        return { lineup_id: head.data.id, player_id: pid, batting_order: i + 1, starter: true, inning_positions: positions };
      });
      const ins = await db.from('rep_team_lineup_entries').insert(rows);
      if (ins.error) { console.error('✗ season lineup entries', ins.error.message); process.exit(1); }
    }
    ok(`season lineups seeded (${missing.length} game(s) — the position-recency matrix has spread)`);
  } else {
    ok('season lineups already present');
  }
}

/**
 * ⚠ **THE ARM-CARE CAPS, without which that panel's two most important states never render.**
 *
 * Arm care shows each pitcher's season workload, their rest, and **the per-game cap the COACH set**
 * — this product has no weekly or season innings ceiling and must never invent one
 * (`lib/coach-arm-care.ts`). With no cap set anywhere the column reads "not set" for every row and
 * the over-cap warning cannot appear at all, so the sweep would measure a panel with its warning
 * state permanently invisible.
 *
 * Both halves of the resolution are exercised deliberately: a SEASON DEFAULT that most pitchers are
 * judged against, and ONE per-player override that beats it (`resolvePlayerPitcherCap` — a coach who
 * sets a team ceiling and then gives one pitcher a different number meant that number). The override
 * is tight enough that that player goes over it, which is the only way the warning is ever drawn.
 */
const { data: pySettings, error: pySettingsErr } = await db.from('rep_program_years')
  .select('lineup_settings').eq('id', py.id).single();
if (pySettingsErr) { console.error('✗ lineup settings lookup', pySettingsErr.message); process.exit(1); }
// ⚠ Read fresh rather than off `py`, which selects only id/year/status — a guard testing a field
// that was never fetched is a guard that is always false, and would re-write on every run.
if (!pySettings.lineup_settings?.pitcherMaxInningsDefault) {
  const upd = await db.from('rep_program_years')
    .update({ lineup_settings: { ...(pySettings.lineup_settings ?? {}), pitcherMaxInningsDefault: 2 } })
    .eq('id', py.id);
  if (upd.error) { console.error('✗ lineup settings update', upd.error.message); process.exit(1); }
  const tight = await db.from('rep_roster_players')
    .update({ lineup_profile: { pitcher: { maxInnings: 1 } } })
    .eq('program_year_id', py.id).eq('player_first_name', 'Avery');
  if (tight.error) { console.error('✗ per-player cap update', tight.error.message); process.exit(1); }
  ok('arm-care caps seeded (season default 2/game, Avery overridden to 1 so the warning renders)');
} else {
  ok('arm-care caps already present');
}

const { data: livePractices } = await db.from('rep_team_events')
  .select('id, starts_at').eq('program_year_id', py.id).eq('event_type', 'practice')
  .like('name', 'Team practice%').order('starts_at', { ascending: true });

let practiceRows = livePractices ?? [];
if (practiceRows.length === 0) {
  /* Four a week apart (same weekday) + one three days later (a different weekday). That last one
     is the whole reason the "same weekday" note can be proven FALSE for someone. */
  const offsets = [0, 7, 14, 21, 24];
  const rows = offsets.map((d, i) => ({
    program_year_id: py.id, team_id: team.id, org_id: org.id,
    event_type: 'practice', name: `Team practice ${i + 1}`,
    starts_at: new Date(Date.UTC(py.year, 4, 5 + d, 23, 0)).toISOString(),
    location: 'UAT Fields', status: 'scheduled',
  }));
  const ins = await db.from('rep_team_events').insert(rows).select('id, starts_at');
  if (ins.error) { console.error('✗ live practices insert', ins.error.message); process.exit(1); }
  practiceRows = ins.data;
  ok(`live-season practices seeded (${rows.length}, four a week apart and one off-cycle)`);
} else {
  ok(`live-season practices already present (${practiceRows.length})`);
}

const attendanceEvents = [...practiceRows.map(p => ({ id: p.id, kind: 'practice' })),
  ...(seasonGames ?? []).map(g => ({ id: g.id, kind: 'game' }))];
if (attendanceEvents.length) {
  const { data: haveMarks } = await db.from('rep_team_event_attendance')
    .select('id').in('event_id', attendanceEvents.map(e => e.id)).limit(1);
  if (!haveMarks?.length) {
    const DEVON = 3;   // absent on practices 0,1,2 AND on one game — ALL on the same weekday
    const OFFCYCLE = 5; // absent on practice 2 and practice 4 — two DIFFERENT weekdays
    const SILENT = 7;   // never marked either way on two events, so "Recorded" is below 100%
    /**
     * ⚠ **DEVON'S GAME ABSENCE MUST FALL ON THE PRACTICE WEEKDAY, and this line is why the note is
     * actually testable.** The first version simply took the last game, which landed on a Monday
     * among three Tuesday practices — so `sameWeekday` came back null and the "every one of these
     * falls on a Tuesday" note would never have rendered for the player the sweep opens. The
     * fixture looked full and proved nothing, which is the failure this whole block exists against.
     * Resolved by MATCHING the weekday rather than hard-coding a date, so re-dating either set
     * cannot quietly break it again.
     */
    const weekdayOf = (iso) => new Date(iso).getUTCDay();
    const practiceWeekday = practiceRows.length ? weekdayOf(practiceRows[0].starts_at) : -1;
    const alignedGameId = (seasonGames ?? []).find(g => weekdayOf(g.starts_at) === practiceWeekday)?.id ?? null;
    const marks = [];
    attendanceEvents.forEach((ev, ei) => {
      const practiceIdx = ev.kind === 'practice' ? ei : -1;
      ids.forEach((pid, i) => {
        let status = 'attending';
        if (i === SILENT && (practiceIdx === 3 || practiceIdx === 4)) status = 'unknown';
        else if (i === DEVON && [0, 1, 2].includes(practiceIdx)) status = 'absent';
        else if (i === DEVON && ev.id === alignedGameId) status = 'absent';
        else if (i === OFFCYCLE && [2, 4].includes(practiceIdx)) status = 'absent';
        else if (i === 10 && practiceIdx === 1) status = 'late';
        marks.push({
          event_id: ev.id, player_id: pid,
          program_year_id: py.id, team_id: team.id, org_id: org.id, status,
        });
      });
    });
    const ins = await db.from('rep_team_event_attendance').insert(marks);
    if (ins.error) { console.error('✗ season attendance insert', ins.error.message); process.exit(1); }
    ok(`season attendance seeded (${marks.length} marks — Devon Test has receipts across both kinds)`);
  } else {
    ok('season attendance already present');
  }
}

// ── 13. MONEY, so the Money hub renders tables instead of empty states ───────
/**
 * ⚠ WHY THIS BLOCK EXISTS, and it is the same reason section 11 seeds a live game.
 *
 * Found 2026-08-13, during the Money-hub table-consistency pass: **every Money screen in the
 * layout sweep was measuring an EMPTY STATE.** Budget lines, dues schedules, expenses, payables,
 * fundraisers and payment requests were all zero on this fixture, so `coach-budget`,
 * `coach-budget-vs-actual`, `coach-dues` and `coach-expenses` had been sweeping four "nothing here
 * yet" cards. The gate reported green on tables it had never drawn — the exact failure the game-day
 * note above records, in a different part of the portal.
 *
 * So the shapes below are chosen to make each surface render its FULL structure in one pass, not
 * to look like a realistic season:
 *   · two cost categories AND an expected-funding line, so the plan's funding section appears;
 *   · period splits on one line, so the outline has sub-rows to expand and the By-period grid has
 *     columns to scroll;
 *   · three dues schedules — paid, part-paid and nothing-paid-and-overdue — so the status column
 *     and the balance colours all appear at once;
 *   · a payable with BOTH a deposit and a balance, one paid and one not, which is the only row in
 *     the hub with real nesting;
 *   · one plain expense, one fundraiser, one payment request per status that changes the row.
 *
 * ⚠ IDEMPOTENT LIKE THE REST: each step checks for its own rows first and leaves whatever is
 * already there alone, so re-running never doubles a season's budget.
 */
const money = { budget: 0, dues: 0, expenses: 0, fundraisers: 0, requests: 0 };

// Categories come from the shared taxonomy — the same rows the coach's picker offers, so Budget
// vs. Actual's name-match join behaves exactly as it does for a real team.
// ⚠ `scope` is `org | team | both` — there is NO 'rep'. This filtered on 'rep' at first, which is
// not a CHECK violation but simply matches nothing, so the query returned [] SILENTLY and every
// seeded line landed in "Uncategorized". The category-grouping surfaces this fixture exists to
// exercise were therefore never populated with named categories — and the probes said so
// ("Uncategorized" everywhere) without anyone reading it. Mirrors the coach-side reader in
// `app/api/coaches/[orgSlug]/budget-items/route.ts`, which uses the same `['team','both']` filter.
const { data: cats, error: catErr } = await db.from('budget_categories')
  .select('id, name').in('scope', ['team', 'both']).order('sort_order');
if (catErr) { console.error('✗ budget_categories read', catErr.message); process.exit(1); }
if (!cats?.length) {
  // Loud, not silent: a fixture that cannot name its categories is not the fixture anyone meant.
  console.error('✗ No team-scoped budget categories found — the Money fixture would seed everything as "Uncategorized".');
  process.exit(1);
}

/* ⚠ EVERY COST LINE NEEDS AN ITEM (mig 240) — the item NAMES the row now, and a fixture seeded
   without one renders the whole plan as "Not itemized", which is what the rendered layout sweep
   was reading until 2026-08-15. Two items are taken from each category so the fixture also
   exercises the shape the redesign exists for: two lines sharing one item, summed into one row. */
const { data: catItems } = await db.from('budget_items')
  .select('id, name, category_id')
  .in('category_id', (cats ?? []).map(c => c.id))
  .is('org_id', null).eq('is_misc', false).order('sort_order');
/** By NAME, never by position — an index picked "Entry Fees" for a dome block, and a fixture a
 *  human reads during QA has to say things that make sense. Falls back to the first item in the
 *  category so the line is still named rather than left blank. */
const catByName = (n) => (cats ?? []).find(c => c.name.toLowerCase() === n.toLowerCase())?.id ?? cats?.[0]?.id ?? null;
const itemFor = (catId, wanted) => {
  const inCat = (catItems ?? []).filter(i => i.category_id === catId);
  const hit = wanted && inCat.find(i => i.name.toLowerCase() === wanted.toLowerCase());
  return (hit ?? inCat[0])?.id ?? null;
};
/** What each seeded line is actually FOR, so the repair below can name an old row correctly. */
const FIXTURE_ITEMS = {
  'Winter dome block':    { category: 'Facilities',  item: 'Dome Time' },
  'Diamond permits':      { category: 'Facilities',  item: 'Diamond Permits' },
  'Spring classic entry': { category: 'Tournaments', item: 'Entry Fees' },
  // ⚠ DELIBERATELY THE SAME ITEM as 'Spring classic entry' — see the TWO-LINE ITEM block below.
  'Regional qualifier entry': { category: 'Tournaments', item: 'Entry Fees' },
};
/** Both halves of a line's taxonomy, resolved by NAME. ⚠ The category has to be right BEFORE the
 *  item can be: an item lives in exactly one category, so a line filed under the wrong heading
 *  cannot find its own item and silently falls back to whatever sits first under that heading. */
const taxonomyFor = (desc) => {
  const want = FIXTURE_ITEMS[desc];
  const categoryId = want ? catByName(want.category) : (cats?.[0]?.id ?? null);
  return { category_id: categoryId, item_id: itemFor(categoryId, want?.item) };
};

const { data: existingLines } = await db.from('rep_budget_lines')
  .select('id').eq('team_id', team.id).eq('program_year_id', py.id).limit(1);

if (!existingLines?.length) {
  const lineRows = [
    { description: 'Winter dome block', total_amount: 5200, notes: '16 sessions, Jan–Mar', line_kind: 'cost',    ...taxonomyFor('Winter dome block'), sort_order: 1 },
    /* ⚠ THIS COMMENT USED TO CLAIM these two lines shared one item — "the ruling this fixture has to
       be able to prove". They never did: `FIXTURE_ITEMS` maps every description to its OWN item, so
       the SUM ruling had no fixture coverage anywhere, for two months. Corrected rather than deleted,
       because the claim was the useful part. The two-line item it describes is seeded below. */
    { description: 'Diamond permits',   total_amount: 3200, notes: null,                   line_kind: 'cost',    ...taxonomyFor('Diamond permits'), sort_order: 2 },
    { description: 'Spring classic entry', total_amount: 1600, notes: null,                line_kind: 'cost',    ...taxonomyFor('Spring classic entry'), sort_order: 3 },
    { description: 'Chocolate sale',    total_amount: 1800, notes: 'Expected team share',  line_kind: 'funding', category_id: null, sort_order: 4 },
  ].map((r) => ({ ...r, org_id: org.id, team_id: team.id, program_year_id: py.id }));

  const ins = await db.from('rep_budget_lines').insert(lineRows).select('id, description');
  if (ins.error) { console.error('✗ budget lines insert', ins.error.message); process.exit(1); }
  money.budget = ins.data.length;

  // Periods on ONE line only: enough for the outline to have something to expand and for the
  // By-period grid to have more than a single column, without every row being expandable.
  const dome = ins.data.find((l) => l.description === 'Winter dome block');
  if (dome) {
    const per = await db.from('rep_budget_periods').insert([
      { budget_line_id: dome.id, period_label: 'January',  period_date: `${py.year}-01-15`, amount: 1733, sort_order: 1 },
      { budget_line_id: dome.id, period_label: 'February', period_date: `${py.year}-02-15`, amount: 1733, sort_order: 2 },
      { budget_line_id: dome.id, period_label: 'March',    period_date: `${py.year}-03-15`, amount: 1734, sort_order: 3 },
    ]);
    if (per.error) { console.error('✗ budget periods insert', per.error.message); process.exit(1); }
  }
  ok(`budget plan seeded (${money.budget} lines, one split across three periods)`);
} else {
  /* ⚠ COST LINES SEEDED BEFORE mig 240 CARRY NO ITEM, and the item is what names a row now — so a
     fixture left as it was renders the whole plan as "Not itemized", which is exactly what the
     rendered layout sweep was reading. Repaired rather than skipped, for the same reason the
     periods below get their own guard: this fixture is what the rendered layout check self-heals
     with, and a half-old fixture reporting green is the silent half-truth this file exists to end. */
  const { data: itemless } = await db.from('rep_budget_lines')
    .select('id, description, category_id')
    .eq('team_id', team.id).eq('program_year_id', py.id)
    .neq('line_kind', 'funding').neq('line_kind', 'sponsorship')
    .is('item_id', null);
  for (const line of itemless ?? []) {
    const taxonomy = taxonomyFor(line.description);
    if (!taxonomy.item_id) continue;
    await db.from('rep_budget_lines').update(taxonomy).eq('id', line.id);
  }
  if ((itemless ?? []).length) {
    console.log(`  repaired ${itemless.length} budget line(s) that carried no item`);
  }

  /* ⚠ THE PERIODS GET THEIR OWN GUARD, not the lines'. Nested under the outer check they could
     never be retried: one failed periods insert used to be logged-and-continued, the run reported
     the fixture "whole", and every later run skipped the whole block because the LINES existed —
     leaving the By-period grid permanently empty on the very fixture built to exercise it. Which
     is the same silent-half-truth this fixture work exists to end (see the plan's §8). */
  const { data: existingPeriods } = await db.from('rep_budget_periods')
    .select('id, rep_budget_lines!inner(team_id, program_year_id)')
    .eq('rep_budget_lines.team_id', team.id)
    .eq('rep_budget_lines.program_year_id', py.id)
    .limit(1);
  if (!existingPeriods?.length) {
    const { data: dome } = await db.from('rep_budget_lines')
      .select('id').eq('team_id', team.id).eq('program_year_id', py.id)
      .eq('description', 'Winter dome block').maybeSingle();
    if (dome) {
      const per = await db.from('rep_budget_periods').insert([
        { budget_line_id: dome.id, period_label: 'January',  period_date: `${py.year}-01-15`, amount: 1733, sort_order: 1 },
        { budget_line_id: dome.id, period_label: 'February', period_date: `${py.year}-02-15`, amount: 1733, sort_order: 2 },
        { budget_line_id: dome.id, period_label: 'March',    period_date: `${py.year}-03-15`, amount: 1734, sort_order: 3 },
      ]);
      if (per.error) { console.error('✗ budget periods repair', per.error.message); process.exit(1); }
      ok('budget plan already present — period split repaired');
    } else {
      ok('budget plan already present');
    }
  } else {
    ok('budget plan already present');
  }
}

// Dues — three players, three different states, so the status column and every balance colour
// render together. The rest of the roster deliberately has no schedule: a partly-set-up team is
// the normal case and the table must read correctly with "—" in it.
const { data: existingDues } = await db.from('rep_player_dues_schedules')
  .select('id').eq('team_id', team.id).eq('program_year_id', py.id).limit(1);

/* ⚠ A ROSTER TOO SMALL IS NOT "ALREADY PRESENT". The two conditions used to share one `else`, so a
   team with fewer than three players and NO dues was told "dues already present" — actively false,
   with nothing explaining why the three states never appeared. */
if (!existingDues?.length && ids.length < 3) {
  console.error(`✗ Only ${ids.length} active player(s) — the Money fixture needs 3 to seed the paid / part-paid / overdue trio.`);
  process.exit(1);
}
if (!existingDues?.length) {
  const PLANS = [
    { paid: 2, overdueDays: null },  // fully paid
    { paid: 1, overdueDays: null },  // part paid
    { paid: 0, overdueDays: 21 },    // nothing paid, and late
  ];
  for (let i = 0; i < PLANS.length; i++) {
    const plan = PLANS[i];
    const sched = await db.from('rep_player_dues_schedules').insert({
      org_id: org.id, team_id: team.id, program_year_id: py.id,
      player_id: ids[i], total_amount: 1250,
    }).select('id').single();
    /* ⚠ FAIL, don't `break`. A break left 1 of 3 states seeded, and the outer guard only asks
       "does ANY schedule exist" — so every later run reported dues complete while the overdue
       player (the one the status column exists to show) was never created. */
    if (sched.error) { console.error('✗ dues schedule insert', sched.error.message); process.exit(1); }

    const dueDay = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + (plan.overdueDays != null ? -plan.overdueDays : 30) + (n - 1) * 30);
      return d.toISOString().slice(0, 10);
    };
    const insts = [1, 2].map((n) => ({
      schedule_id: sched.data.id, player_id: ids[i], org_id: org.id, team_id: team.id,
      installment_number: n, amount: 625, due_date: dueDay(n), source: 'manual',
      paid_at: n <= plan.paid ? new Date().toISOString() : null,
    }));
    const ii = await db.from('rep_player_dues_installments').insert(insts);
    if (ii.error) { console.error('✗ dues instalments insert', ii.error.message); process.exit(1); }
    // Paid stamps are a coverage projection since mig 232 — the dollars the dues readers show
    // live in rep_dues_payments; one payment per stamped instalment keeps the fixture coherent.
    if (plan.paid > 0) {
      const pays = [1, 2].filter((n) => n <= plan.paid).map((n) => ({
        program_year_id: py.id, player_id: ids[i], org_id: org.id, team_id: team.id,
        amount: 625, received_date: new Date().toISOString().slice(0, 10),
        method: 'etransfer', source: 'recorded',
      }));
      const pp = await db.from('rep_dues_payments').insert(pays);
      if (pp.error) { console.error('✗ dues payments insert', pp.error.message); process.exit(1); }
    }
    money.dues++;
  }
  ok(`dues seeded (${money.dues} players — paid, part paid, and overdue)`);
} else {
  ok('dues already present');
}

/* Credits meet the bills (owner model 2026-08-14): the part-paid player carries a fundraiser
   credit that lands on their OPEN instalment, so the sweep renders the credit-era states —
   "$X to send", the covered-by sub-line, and the Credits column with something in it. Without
   this row every new element has ZERO GEOMETRY and a green sweep proves nothing (the
   empty-fixture lesson, again). Guarded separately from the dues block above so existing
   fixtures gain it on re-run. */
const { data: existingCredit } = await db.from('rep_dues_credits')
  .select('id').eq('program_year_id', py.id).limit(1);
if (!existingCredit?.length && ids.length >= 2) {
  const cc = await db.from('rep_dues_credits').insert({
    program_year_id: py.id, player_id: ids[1],
    amount: 150, description: 'Fundraiser rebate — Bottle Drive',
    credit_type: 'fundraiser', credit_date: new Date().toISOString().slice(0, 10),
  });
  if (cc.error) { console.error('✗ dues credit insert', cc.error.message); process.exit(1); }
  ok('fundraiser credit seeded (part-paid player — the "to send" states now render)');
} else {
  ok('dues credit already present (or roster too small)');
}

/* A payout — cash handed BACK to a family (mig 234). `check:money-report`'s strip↔register
   identity (2026-08-23) lists this as a required breaking shape: it was the stream missing from
   the BvA cash strip entirely, so a fixture without one cannot fail the claim and a green run is
   not evidence. Sized UNDER the $150 credit above so "owed back" stays coherent with the payout
   writer's own ceiling ($50 remains owed). Guarded separately so existing fixtures gain it. */
const { data: existingPayout } = await db.from('rep_dues_payouts')
  .select('id').eq('program_year_id', py.id).limit(1);
if (!existingPayout?.length && ids.length >= 2) {
  const po = await db.from('rep_dues_payouts').insert({
    program_year_id: py.id, player_id: ids[1], org_id: org.id, team_id: team.id,
    amount: 100, paid_date: new Date().toISOString().slice(0, 10),
    method: 'etransfer', note: 'Partial credit paid back — Bottle Drive', source: 'recorded',
  });
  if (po.error) { console.error('✗ dues payout insert', po.error.message); process.exit(1); }
  ok('dues payout seeded (cash back to a family — the strip↔register identity can now fail)');
} else {
  ok('dues payout already present (or roster too small)');
}

// Expenses AND payables live in the same table, told apart by `expense_type`. Both sub-tabs need
// a row or half the Expenses screen is still an empty state.
const { data: existingExp } = await db.from('rep_team_expenses')
  .select('id').eq('team_id', team.id).eq('program_year_id', py.id).limit(1);

if (!existingExp?.length) {
  const soon = new Date(); soon.setDate(soon.getDate() + 20);
  const past = new Date(); past.setDate(past.getDate() - 10);
  const todayDay = new Date().toISOString().slice(0, 10);
  /* ⚠ Payables Rebuild P2: a fixture STATES its plan and its payments — the legacy
     deposit/balance/paid columns are dead and nothing writes them. Same three shapes as before,
     now written as the records every money screen reads. */
  try {
    await insertCommitmentWithRecords(db, {
      row: {
        org_id: org.id, team_id: team.id, program_year_id: py.id,
        expense_type: 'expense', description: 'Practice balls and tees',
        category: cats?.[0]?.name ?? null,
      },
      ...paidOnce(240, todayDay),
    });
    await insertCommitmentWithRecords(db, {
      row: {
        org_id: org.id, team_id: team.id, program_year_id: py.id,
        expense_type: 'expense', description: 'Scorekeeping tablet',
        category: cats?.[0]?.name ?? null,
      },
      installments: [{ amount: 310, dueDate: todayDay }],
    });
    // The one genuinely NESTED row in the hub: a first piece already paid and a second still due.
    await insertCommitmentWithRecords(db, {
      row: {
        org_id: org.id, team_id: team.id, program_year_id: py.id,
        expense_type: 'tournament_payable', description: 'Spring classic entry',
        category: cats?.[1]?.name ?? cats?.[0]?.name ?? null,
      },
      installments: [
        { amount: 600, dueDate: past.toISOString().slice(0, 10) },
        { amount: 1000, dueDate: soon.toISOString().slice(0, 10) },
      ],
      payments: [{ amount: 600, paidDate: todayDay, installmentNumber: 1 }],
    });
    money.expenses = 3;
    ok('expenses + a two-part payable seeded');
  } catch (e) {
    console.log(`  ! expenses skipped (${e.message})`);
  }
} else {
  ok('expenses already present');
}

/**
 * ⚠⚠ TWO BUDGET LINES ON ONE ITEM — the owner's SUM ruling, which nothing rendered had ever shown.
 *
 * The line block above carried a comment claiming it seeded this shape. It did not: every description
 * maps to its own item, so **the ruling had no fixture coverage at all** — not on the plan page (where
 * two lines on one item become a group header that opens), not on the report (where the row captions
 * itself "2 lines"), and not on the Months grid.
 *
 * It matters most for the grid. A month cell on a two-line row cannot know whose payment dates a coach
 * means, so it opens a chooser (owner-approved 2026-08-17) — and **that chooser was reachable on no
 * fixture in the repo**, which means the rendered layout sweep could not see it and owner QA could not
 * walk it. A screen swept in its emptiest state is the trap this file exists to end.
 *
 * ⚠ NO PERIODS ON THIS ONE, on purpose. Its sibling "Spring classic entry" is also undated, so the
 * item's row exercises the chooser from the **"No date yet"** cell — the affordance that was dead and
 * matters more, being the grid's only route out of undated budget. The dated path is covered by
 * "Winter dome block", which has three periods.
 *
 * Guarded on its own so fixtures seeded before this block gain the row on a re-run.
 */
const SECOND_LINE_DESC = 'Regional qualifier entry';
const { data: existingSecondLine } = await db.from('rep_budget_lines')
  .select('id').eq('team_id', team.id).eq('program_year_id', py.id)
  .eq('description', SECOND_LINE_DESC).limit(1);
if (!existingSecondLine?.length) {
  const sl = await db.from('rep_budget_lines').insert({
    org_id: org.id, team_id: team.id, program_year_id: py.id,
    description: SECOND_LINE_DESC, total_amount: 900, notes: 'Second line on the same item',
    line_kind: 'cost', ...taxonomyFor(SECOND_LINE_DESC), sort_order: 5,
  });
  if (sl.error) console.log(`  ! second line on one item skipped (${sl.error.message})`);
  else ok('a SECOND budget line on the "Entry Fees" item — the SUM ruling, and the grid\'s line chooser');
} else {
  ok('two-line item already present');
}

/**
 * ⚠⚠ A COMMITMENT PAID ACROSS TWO MONTHS — the shape the money report's arithmetic check needs.
 *
 * The payable above has its balance UNPAID, which is the right fixture for the Expenses screen and
 * the wrong one for `scripts/check-money-report-arithmetic.mjs`. That check asserts the statement,
 * the Months grid and the cumulative chart land on one number, and the way they came apart was a
 * deposit and a balance paid in DIFFERENT MONTHS: the grid split them, the chart and the statement's
 * payment schedule collapsed both into the deposit's month. With nothing on the fixture paid twice,
 * a green run over it proved nothing at all — the same trap `check-register-balance.mjs` guards
 * against with its "derived sources present" gate.
 *
 * ⚠ FIXED DATES, TWO CALENDAR MONTHS APART, both in the past. Relative offsets from "today" would
 * land in one month for most of any given month, so the case the check exists for would vanish and
 * reappear depending on the day it ran.
 *
 * ⚠ THE PAID STAMPS ARE WRITTEN AT ORG NOON, which is the platform's convention for this column
 * family and not a detail to normalise away — see `orgDayAsStoredInstant` in lib/timezone.ts and
 * COACH_MONEY_ONE_ARITHMETIC_PLAN.md §1b. Stored at noon, a naive UTC date slice lands on the
 * coach's own calendar day from any timezone this platform serves. Seeded at midnight, this row
 * would drift a month boundary and the check would fail for a reason that is not a defect.
 *
 * Guarded on its own so fixtures seeded before this block gain the row on a re-run.
 */
const SPLIT_DESC = 'Regional qualifier entry — paid in two parts';
const { data: existingSplit } = await db.from('rep_team_expenses')
  .select('id').eq('team_id', team.id).eq('program_year_id', py.id)
  .eq('description', SPLIT_DESC).limit(1);
if (!existingSplit?.length) {
  /* ⚠ `paid_date` is a bare DATE column (P2) — the org-noon stamp trick the legacy timestamps
     needed has nothing left to apply to. The two payments land in two calendar months, which is
     the whole point of this row. */
  const depDay = `${py.year}-05-14`;
  const balDay = `${py.year}-07-09`;
  try {
    await insertCommitmentWithRecords(db, {
      row: {
        org_id: org.id, team_id: team.id, program_year_id: py.id,
        expense_type: 'tournament_payable', description: SPLIT_DESC,
        category: cats?.[1]?.name ?? cats?.[0]?.name ?? null,
      },
      installments: [
        { amount: 300, dueDate: depDay },
        { amount: 600, dueDate: balDay },
      ],
      payments: [
        { amount: 300, paidDate: depDay, installmentNumber: 1 },
        { amount: 600, paidDate: balDay, installmentNumber: 2 },
      ],
    });
    ok(`split-month payable seeded ($300 ${depDay} + $600 ${balDay}) — the case the report's arithmetic check needs`);
  } catch (e) {
    console.log(`  ! split-month payable skipped (${e.message})`);
  }
} else {
  ok('split-month payable already present');
}

/**
 * ⚠⚠ THE OUT-OF-POCKET COST, AND IT IS HERE FOR THE REGISTER'S ONE HARD CLAIM.
 *
 * A cost a family paid the vendor DIRECTLY is real spending on a real record, but no team cash
 * moved — so it belongs on the dated book with its amount and must NOT move the running balance
 * (money redesign P3). That row is the single most likely way for "the balance IS cash on hand" to
 * come apart, and until this fixture carried one, `scripts/check-register-balance.mjs` could pass
 * without ever having seen the case it exists to guard. Seeded separately from the block above so
 * it lands on fixtures that already have expenses.
 *
 * ⚠ IT CARRIES A `paid_by_player_id`, WHICH IS WHAT MAKES IT THE THING. Without one it is an
 * ordinary paid cost and proves nothing.
 */
const { data: existingOop } = await db.from('rep_team_expenses')
  .select('id').eq('team_id', team.id).eq('program_year_id', py.id).not('paid_by_player_id', 'is', null).limit(1);
if (!existingOop?.length && players?.length) {
  try {
    const todayDay = new Date().toISOString().slice(0, 10);
    const oopId = await insertCommitmentWithRecords(db, {
      row: {
        org_id: org.id, team_id: team.id, program_year_id: py.id,
        expense_type: 'expense', description: 'Umpire fees — a parent paid the association direct',
        category: cats?.[0]?.name ?? null, paid_by_player_id: players[0].id,
      },
      // ⚠ Its payment carries NO accounting entry, ever — the family's money moved, the team's
      // did not (mig 234); `paidOnce` leaves the entry null, which is exactly right here.
      ...paidOnce(180, todayDay),
    });
    /* ⚠ THE CREDIT IS THE OTHER HALF OF THE RECORD (mig 234): an out-of-pocket cost with no
       reimbursement credit is the broken state the app's compensating deletes exist to prevent,
       and P2's payment/undo doors refuse to touch one. Seed both or neither. */
    const cc = await db.from('rep_dues_credits').insert({
      program_year_id: py.id, player_id: players[0].id, expense_id: oopId,
      amount: 180, description: 'Paid out of pocket — Umpire fees — a parent paid the association direct',
      credit_type: 'reimbursement', credit_date: todayDay,
    });
    if (cc.error) console.log(`  ! out-of-pocket credit skipped (${cc.error.message})`);
    ok('out-of-pocket cost seeded — the register row whose balance must NOT move');
  } catch (e) {
    console.log(`  ! out-of-pocket cost skipped (${e.message})`);
  }
} else {
  /* ⚠ REPAIR, not just skip (Payables Rebuild P2): a fixture seeded before this rebuild carries the
     out-of-pocket cost WITHOUT its reimbursement credit — a state the app can no longer create and
     P2's payment/undo doors refuse to touch. Backfill the missing half so the family case in QA
     §64 Part B is walkable on this fixture. */
  const oopRow = existingOop[0];
  const { data: oopFull } = await db.from('rep_team_expenses')
    .select('id, amount, paid_by_player_id').eq('id', oopRow.id).single();
  const { data: oopCredit } = await db.from('rep_dues_credits')
    .select('id').eq('expense_id', oopRow.id).eq('credit_type', 'reimbursement').limit(1);
  if (!oopCredit?.length && oopFull?.paid_by_player_id) {
    const cc = await db.from('rep_dues_credits').insert({
      program_year_id: py.id, player_id: oopFull.paid_by_player_id, expense_id: oopFull.id,
      amount: oopFull.amount, description: 'Paid out of pocket — Umpire fees — a parent paid the association direct',
      credit_type: 'reimbursement', credit_date: new Date().toISOString().slice(0, 10),
    });
    if (cc.error) console.log(`  ! out-of-pocket credit repair skipped (${cc.error.message})`);
    else ok('out-of-pocket credit backfilled — the family case is walkable');
  } else {
    ok('out-of-pocket cost already present (or roster empty)');
  }
}

/**
 * ⚠⚠ ONE INCOME ROW AND ONE REFUND, for the same reason.
 *
 * Recorded arrivals (`rep_team_money_in`, mig 243) reached NO cash figure in the product until
 * 2026-08-17 — the money-summary route never read the table — so a fixture without them lets both
 * the register and Cash on hand agree while both are wrong. These two rows are what make the
 * balance check able to fail.
 */
const { data: existingIn } = await db.from('rep_team_money_in')
  .select('id').eq('program_year_id', py.id).limit(1);
if (!existingIn?.length) {
  const today = new Date().toISOString().slice(0, 10);
  const mi = await db.from('rep_team_money_in').insert([
    {
      org_id: org.id, team_id: team.id, program_year_id: py.id,
      entry_kind: 'income', amount: 400, received_date: today,
      description: 'Concession takings, home opener',
    },
    {
      org_id: org.id, team_id: team.id, program_year_id: py.id,
      entry_kind: 'money_back', amount: 125, received_date: today,
      description: 'Cancelled umpire assignment refunded', received_from: 'vendor',
    },
  ]);
  if (mi.error) console.log(`  ! arrivals skipped (${mi.error.message})`);
  else ok('an income row and a refund seeded — the two the cash figure used to miss entirely');
} else {
  ok('arrivals already present');
}

const { data: existingFr } = await db.from('rep_fundraisers')
  .select('id').eq('team_id', team.id).eq('program_year_id', py.id).limit(1);

if (!existingFr?.length) {
  const fr = await db.from('rep_fundraisers').insert([
    { org_id: org.id, team_id: team.id, program_year_id: py.id, name: 'Chocolate sale', description: 'Boxes of 30 bars', player_rebate_percent: 15, is_active: true },
    { org_id: org.id, team_id: team.id, program_year_id: py.id, name: 'Bottle drive',   description: null,              player_rebate_percent: 20, is_active: false },
  ]);
  if (fr.error) console.log(`  ! fundraisers skipped (${fr.error.message})`);
  else { money.fundraisers = 2; ok('fundraisers seeded (one active, one closed)'); }
} else {
  ok('fundraisers already present');
}

/**
 * A SPONSOR, checked for by KIND rather than by "are there any fundraisers".
 *
 * ⚠ Its own guard on purpose. The block above skips when ANY fundraising record exists, so on
 * every fixture seeded before 2026-08-15 a sponsor would never appear — and `resolveUatContext`
 * would throw for the sweep rather than quietly sweeping the wrong screen, which is the right
 * failure but a tedious one. This heals it in place.
 *
 * Received and ATTRIBUTED, with a real family share: that is the fullest render the sponsor record
 * has — a name in "Brought in by", a plum figure in "Credited to them", and the received chip —
 * and a screen swept in its emptiest state is the trap this repo keeps re-learning.
 */
const { data: existingSponsor } = await db.from('rep_fundraisers')
  .select('id').eq('program_year_id', py.id).eq('kind', 'sponsor').limit(1);

if (!existingSponsor?.length) {
  const sp = await db.from('rep_fundraisers').insert({
    org_id: org.id, team_id: team.id, program_year_id: py.id,
    kind: 'sponsor', sponsor_status: 'received',
    name: 'Northside Physio', description: 'Season sponsor — banner at the diamond.',
    player_rebate_percent: 20, is_active: true,
  }).select('id').single();
  if (sp.error) console.log(`  ! sponsor skipped (${sp.error.message})`);
  else {
    // A sponsor IS its single entry — the record alone reads as $0 raised everywhere.
    const en = await db.from('rep_fundraiser_entries').insert({
      fundraiser_id: sp.data.id, org_id: org.id, team_id: team.id,
      player_id: ids[0] ?? null,
      amount_raised: 500, rebate_percent: 20, rebate_amount: 100,
    });
    if (en.error) console.log(`  ! sponsor entry skipped (${en.error.message})`);
    else ok('sponsor seeded (received, attributed, $500 with a $100 family share)');
  }
} else {
  ok('sponsor already present');
}

/**
 * AND A SPONSOR WHO HAS **PLEDGED AND NOT PAID** (Option D, 2026-08-23).
 *
 * ⚠⚠ SEEDED FOR A CLAIM THAT CANNOT OTHERWISE BE MADE, not for coverage. The Months view's
 * Scheduled lens is the season's forward view, and a pledge is its defining row: money the team has
 * been promised, with **no date at all**, so it belongs in the "No date yet" column — in the Total
 * and in no month. `check:money-report` refuses to call a run evidence without one, because every
 * settled claim in that script passes happily on a fixture where the forward view is empty. A
 * pending club request (the other undated forward row) is seeded just below.
 *
 * ⚠ ITS OWN GUARD, KEYED ON THE STATUS. The block above checks for a sponsor of ANY status, so on
 * every fixture seeded before today this would never appear — the same trap that note records.
 *
 * ⚠ IT MUST NEVER REACH A SETTLED FIGURE. `sponsor_status: 'pledged'` is what keeps it out of Cash
 * on hand, the statement and both bands' Actual — if this row starts showing up there, the guard's
 * register identity fails, which is the point.
 */
const { data: existingPledge } = await db.from('rep_fundraisers')
  .select('id').eq('program_year_id', py.id).eq('kind', 'sponsor').eq('sponsor_status', 'pledged').limit(1);

if (!existingPledge?.length) {
  const pl = await db.from('rep_fundraisers').insert({
    org_id: org.id, team_id: team.id, program_year_id: py.id,
    kind: 'sponsor', sponsor_status: 'pledged',
    name: 'Riverbend Tire', description: 'Promised for the spring — cheque not sent yet.',
    player_rebate_percent: 0, is_active: true,
  }).select('id').single();
  if (pl.error) console.log(`  ! pledged sponsor skipped (${pl.error.message})`);
  else {
    const en = await db.from('rep_fundraiser_entries').insert({
      fundraiser_id: pl.data.id, org_id: org.id, team_id: team.id,
      player_id: null,
      amount_raised: 250, rebate_percent: 0, rebate_amount: 0,
    });
    if (en.error) console.log(`  ! pledged sponsor entry skipped (${en.error.message})`);
    else ok('pledged sponsor seeded ($250 promised, never received — the forward view’s own row)');
  }
} else {
  ok('pledged sponsor already present');
}

// One request per status that changes the row: pending keeps its Cancel button, denied carries a
// reason and therefore an expandable detail row.
const { data: existingPr } = await db.from('rep_team_payment_requests')
  .select('id').eq('team_id', team.id).limit(1);

if (!existingPr?.length) {
  const pr = await db.from('rep_team_payment_requests').insert([
    { org_id: org.id, team_id: team.id, program_year_id: py.id, request_type: 'charge_to_org', amount: 450, description: 'Diamond permit reimbursement', status: 'pending',  created_by: user.id, notes: 'Receipt attached in Documents.' },
    { org_id: org.id, team_id: team.id, program_year_id: py.id, request_type: 'payment_to_org', amount: 200, description: 'Team share of league fee',     status: 'approved', created_by: user.id, reviewed_at: new Date().toISOString() },
    { org_id: org.id, team_id: team.id, program_year_id: py.id, request_type: 'charge_to_org', amount: 90,  description: 'Extra practice jerseys',        status: 'denied',   created_by: user.id, reviewed_at: new Date().toISOString(), denial_reason: 'Outside the approved equipment budget.' },
  ]);
  if (pr.error) console.log(`  ! payment requests skipped (${pr.error.message})`);
  else { money.requests = 3; ok('payment requests seeded (pending, approved, denied)'); }
} else {
  ok('payment requests already present');
}

// ── 13b. A FINISHED season BEHIND the live one — the ROLLED-FORWARD shape ────
/**
 * ⚠⚠ **THE SHAPE NEITHER TEAM HAD, AND THE ONE THE WHOLE HISTORY PROGRAMME EXISTS FOR** (added
 * 2026-08-17, owner QA §53 Phases 1–2).
 *
 * The fixture had two teams and neither could show the feature:
 *   · this team — a LIVE season and no history at all;
 *   · *UAT Between Seasons* — history and no live season.
 *
 * Every history phase (P3's copy-forward picker, P4's money book, the compare list, Season
 * Wrapped) answers the question **"can I still reach last year now that this year has started?"**
 * — which needs BOTH at once. Owner QA §53 found it the honest way on its first walk: "A past
 * season" and the compare list were both correctly, uselessly empty, and the product was behaving
 * perfectly. A fixture that cannot show the feature is indistinguishable from a feature that does
 * not work.
 *
 * ⚠ It goes on THIS team, never on the between-seasons one — that team's whole job is having no
 * live year, and the fixture context resolver REFUSES if it grows one.
 *
 * Seeded with everything the look-back surfaces read, because a half-filled past season is the
 * same trap one level down: practices carrying plans (P3's picker and shelf), finalized games and
 * a roster (Season Wrapped and the compare list's record), and a budget with its actuals (P4's
 * money book).
 */
const priorYearNumber = py.year - 1;
let { data: priorYear } = await db.from('rep_program_years')
  .select('id, year, status').eq('team_id', team.id).eq('year', priorYearNumber).maybeSingle();
if (!priorYear) {
  const ins = await db.from('rep_program_years')
    .insert({ team_id: team.id, org_id: org.id, name: `${priorYearNumber} Season`, year: priorYearNumber, status: 'completed' })
    .select('id, year, status').single();
  if (ins.error) { console.error('✗ prior season insert', ins.error.message); process.exit(1); }
  priorYear = ins.data;
}

/* ⚠ The season's staff RECORD row. Access itself is the TEAM membership (seeded above, and
   team-scoped), so this row grants nothing — it is the "who coached that year" fact the season
   names its staff by, and its absence would make the finished season look unstaffed. */
const { data: priorCoachRow } = await db.from('rep_team_coaches')
  .select('id').eq('program_year_id', priorYear.id).eq('user_id', user.id).maybeSingle();
if (!priorCoachRow) {
  const ins = await db.from('rep_team_coaches').insert({
    program_year_id: priorYear.id, team_id: team.id, org_id: org.id,
    user_id: user.id, coach_role: 'head_coach', capabilities: null,
  });
  if (ins.error) { console.error('✗ prior-season coach row insert', ins.error.message); process.exit(1); }
}
ok(`prior season ${priorYear.year} (completed) sits behind the live ${py.year} — the rolled-forward shape`);

const { data: priorRoster } = await db.from('rep_roster_players')
  .select('id').eq('program_year_id', priorYear.id).limit(1);
if (!priorRoster?.length) {
  const rows = FIRST_NAMES.slice(0, 10).map((name, i) => ({
    program_year_id: priorYear.id, team_id: team.id, org_id: org.id,
    player_first_name: name, player_last_name: 'Prior', player_number: String(i + 1),
    status: 'active', source: 'admin_manual', display_order: i,
  }));
  const ins = await db.from('rep_roster_players').insert(rows);
  if (ins.error) { console.error('✗ prior-season roster insert', ins.error.message); process.exit(1); }
  ok('prior-season roster seeded (10 players)');
}

const { data: priorEvents } = await db.from('rep_team_events')
  .select('id').eq('program_year_id', priorYear.id).limit(1);
if (!priorEvents?.length) {
  /* ⚠ Dates fixed to the SEASON'S OWN year, never to "now" — a rendered baseline keyed on the
     screen's text must not drift every time the sweep runs. */
  const at = (m, d, h) => new Date(Date.UTC(priorYear.year, m, d, h, 0)).toISOString();
  const games = [
    { result: 'win',  team_score: 6, opponent_score: 3, opponent: 'Ridgeview' },
    { result: 'win',  team_score: 4, opponent_score: 1, opponent: 'Lakeside' },
    { result: 'loss', team_score: 2, opponent_score: 5, opponent: 'Northgate' },
  ].map((g, i) => ({
    program_year_id: priorYear.id, team_id: team.id, org_id: org.id,
    event_type: 'league_game', name: `vs ${g.opponent}`, opponent: g.opponent,
    home_away: i % 2 === 0 ? 'home' : 'away', starts_at: at(5, 6 + i * 7, 22),
    status: 'scheduled', result: g.result, team_score: g.team_score, opponent_score: g.opponent_score,
  }));

  /* Two practices carrying plans — the rows the copy picker offers and the shelf lists — plus one
     CALLED OFF, which must appear in neither. It keeps its full plan, which is exactly why it is
     the sharpest check in the walk. */
  const priorPlan = {
    version: 1,
    goal: 'Tighten up the middle infield before playoffs.',
    practiceTypes: ['Fielding'],
    equipment: ['Cones', 'Bibs'],
    blocks: [
      {
        id: 'uat-prior-b1', title: 'Warm-up', duration: { minutes: 15 },
        description: 'Dynamic work, then partner throwing.',
      },
      {
        id: 'uat-prior-b2', title: 'Double plays', duration: { minutes: 35 },
        description: 'Feeds and turns from both sides of the bag.',
        goal: 'Clean exchange, every time.',
      },
    ],
  };
  const practices = [
    { name: 'Prior season — double plays',   month: 5, day: 10, plan: priorPlan, recap: 'Best session of the year. Keep the feeds shorter next time.', status: 'scheduled' },
    { name: 'Prior season — hitting rounds', month: 5, day: 17, plan: priorPlan, recap: null, status: 'scheduled' },
    { name: 'Prior season — rained out',     month: 5, day: 24, plan: priorPlan, recap: null, status: 'cancelled' },
  ].map(p => ({
    program_year_id: priorYear.id, team_id: team.id, org_id: org.id,
    event_type: 'practice', name: p.name, starts_at: at(p.month, p.day, 23),
    location: 'UAT Fields', status: p.status, practice_plan: p.plan, practice_recap: p.recap,
  }));

  const ins = await db.from('rep_team_events').insert([...games, ...practices]);
  if (ins.error) { console.error('✗ prior-season events insert', ins.error.message); process.exit(1); }
  ok('prior-season events seeded (3 finalized games, 2 practices with plans, 1 called off)');
}

const { data: priorLines } = await db.from('rep_budget_lines')
  .select('id').eq('program_year_id', priorYear.id).limit(1);
if (!priorLines?.length) {
  const planned = [
    { description: 'Diamond permits',      total_amount: 2400, sort_order: 1 },
    { description: 'Spring classic entry', total_amount: 1800, sort_order: 2 },
  ].map(r => ({
    ...r, line_kind: 'cost', org_id: org.id, team_id: team.id,
    program_year_id: priorYear.id, ...taxonomyFor(r.description),
  }));
  const insLines = await db.from('rep_budget_lines').insert(planned);
  if (insLines.error) { console.error('✗ prior-season budget insert', insLines.error.message); process.exit(1); }

  // One category UNDER, one OVER — the money book has to say which in words, not colour alone.
  // ⚠ `month` is 0-based (it fed Date.UTC); the day string below spells it 1-based.
  const spent = [
    { under: 'Diamond permits',      description: 'Permits — spring block', amount: 2250, month: 3, day: 8 },
    { under: 'Spring classic entry', description: 'Spring classic entry',   amount: 1950, month: 4, day: 2 },
  ];
  try {
    for (const r of spent) {
      const tax = taxonomyFor(r.under);
      const day = `${priorYear.year}-${String(r.month + 1).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`;
      await insertCommitmentWithRecords(db, {
        row: {
          org_id: org.id, team_id: team.id, program_year_id: priorYear.id,
          expense_type: 'expense', description: r.description,
          budget_category_id: tax.category_id, budget_item_id: tax.item_id,
        },
        ...paidOnce(r.amount, day),
      });
    }
    ok('prior-season money seeded (2 planned lines, 2 costs — one under, one over)');
  } catch (e) {
    console.error('✗ prior-season expenses insert', e.message); process.exit(1);
  }
}


// ── 14. The BETWEEN-SEASONS team ─────────────────────────────────────────────
/**
 * ⚠⚠ **THE FIXTURE GAP THIS CLOSES HID THREE ROUNDS OF DEFECTS.** Until 2026-08-16 the rendered
 * layout sweep had NO completed season anywhere in its world, so Season's End, the compare list and
 * every "this season has finished" state were invisible to it — the guard tests said so in as many
 * words, and every defect on that rail was found by reading source or by owner QA instead.
 *
 * A second TEAM rather than a second season on the first one, deliberately: the state worth
 * rendering is a team whose WORKING season has finished (no live year at all), which the fixture's
 * main team cannot be without losing every other screen.
 *
 * Two finished seasons, not one, so the compare list has a row that is NOT the season on screen —
 * with a single season its per-year "Season Wrapped" link would point at the page already open.
 */
const BETWEEN_TEAM_NAME = 'UAT Between Seasons';
let { data: pastTeam } = await db.from('rep_teams')
  .select('id, name').eq('org_id', org.id).eq('name', BETWEEN_TEAM_NAME).maybeSingle();
if (!pastTeam) {
  const ins = await db.from('rep_teams')
    .insert({ org_id: org.id, name: BETWEEN_TEAM_NAME, slug: 'uat-between-seasons', sport: 'baseball' })
    .select('id, name').single();
  if (ins.error) { console.error('✗ between-seasons team insert', ins.error.message); process.exit(1); }
  pastTeam = ins.data;
}
ok(`between-seasons team ${pastTeam.name} (${pastTeam.id})`);

const thisYear = new Date().getFullYear();
const pastYears = [];
for (const year of [thisYear - 2, thisYear - 1]) {
  let { data: row } = await db.from('rep_program_years')
    .select('id, year').eq('team_id', pastTeam.id).eq('year', year).maybeSingle();
  if (!row) {
    const ins = await db.from('rep_program_years')
      .insert({ team_id: pastTeam.id, org_id: org.id, name: `${year} Season`, year, status: 'completed' })
      .select('id, year').single();
    if (ins.error) { console.error('✗ finished program year insert', ins.error.message); process.exit(1); }
    row = ins.data;
  }
  pastYears.push(row);
}
const finishedYear = pastYears[pastYears.length - 1];
ok(`finished seasons ${pastYears.map(y => y.year).join(' + ')} — no live year on this team`);

// M1: the membership is the access truth; the season rows are the record the year names its staff by.
await ensureHeadCoachMembership(pastTeam.id);
for (const y of pastYears) {
  const { data: row } = await db.from('rep_team_coaches')
    .select('id').eq('program_year_id', y.id).eq('user_id', user.id).maybeSingle();
  if (!row) {
    const ins = await db.from('rep_team_coaches').insert({
      program_year_id: y.id, team_id: pastTeam.id, org_id: org.id,
      user_id: user.id, coach_role: 'head_coach', capabilities: null,
    });
    if (ins.error) { console.error('✗ finished-season coach row insert', ins.error.message); process.exit(1); }
  }
}
ok('between-seasons membership + season record rows present');

// Enough content that the screens have something to draw: a roster, and finished games so the
// scoreboard band, the results table and Season Wrapped all have real figures rather than empties.
const { data: pastRoster } = await db.from('rep_roster_players')
  .select('id').eq('program_year_id', finishedYear.id).limit(1);
if (!pastRoster?.length) {
  const rows = FIRST_NAMES.slice(0, 9).map((name, i) => ({
    program_year_id: finishedYear.id, team_id: pastTeam.id, org_id: org.id,
    player_first_name: name, player_last_name: 'Past', player_number: String(i + 1),
    status: 'active', source: 'admin_manual', display_order: i,
  }));
  const ins = await db.from('rep_roster_players').insert(rows);
  if (ins.error) { console.error('✗ finished-season roster insert', ins.error.message); process.exit(1); }
  ok('finished-season roster seeded (9 players)');
}

const { data: pastGames } = await db.from('rep_team_events')
  .select('id').eq('program_year_id', finishedYear.id).limit(1);
if (!pastGames?.length) {
  // Fixed offsets from the season's own year, never from "now" — a rendered baseline keyed on the
  // screen's text must not drift every time the sweep runs (the probe practice already taught us).
  const rows = [
    { result: 'win',  team_score: 7, opponent_score: 4, opponent: 'Ridgeview' },
    { result: 'win',  team_score: 5, opponent_score: 3, opponent: 'Lakeside' },
    { result: 'loss', team_score: 2, opponent_score: 6, opponent: 'Northgate' },
    { result: 'tie',  team_score: 3, opponent_score: 3, opponent: 'Fairhaven' },
  ].map((g, i) => ({
    program_year_id: finishedYear.id, team_id: pastTeam.id, org_id: org.id,
    event_type: 'league_game', name: `vs ${g.opponent}`, opponent: g.opponent,
    home_away: i % 2 === 0 ? 'home' : 'away',
    starts_at: new Date(Date.UTC(finishedYear.year, 5, 4 + i * 7, 22, 0)).toISOString(),
    status: 'scheduled', result: g.result, team_score: g.team_score, opponent_score: g.opponent_score,
  }));
  const ins = await db.from('rep_team_events').insert(rows);
  if (ins.error) { console.error('✗ finished-season games insert', ins.error.message); process.exit(1); }
  ok('finished-season games seeded (4 finalized, 2-1-1)');
}

/**
 * ── 15. The finished season's PRACTICES (P3 C3) ──────────────────────────────
 *
 * ⚠⚠ **WITHOUT THESE, THE RENDERED SWEEP PROVES NOTHING ABOUT THE PRACTICES SHELF.** Section 14
 * gave the fixture a between-seasons team with finished seasons, a roster and games — enough for
 * Season's End, the compare list and Season Wrapped. The shelf renders only when the season HELD
 * practices carrying a plan or a recap, so on the fixture as it stood the section was absent and a
 * green sweep said only that an empty state draws correctly. That is the same "green over an empty
 * fixture" trap this file's own section-14 header exists to warn about.
 *
 * Three rows, each covering a case the shelf must get right:
 *   · a practice with a plan AND a recap — the ordinary row;
 *   · a practice with a RECAP but no plan — legitimate ("either, not both"), and it must not be
 *     offered under a label that promises a plan;
 *   · a CANCELLED practice carrying a full plan — which must never appear at all. Cancelling only
 *     flips `status`, so a shelf that forgot the exclusion would show a night that never happened,
 *     and it would look perfectly correct doing it.
 *
 * ⚠ Dates are fixed to the SEASON'S OWN year, never to "now" — a rendered baseline keyed on the
 * screen's text must not drift every time the sweep runs (the probe practice taught this already).
 */
const { data: pastPractices } = await db.from('rep_team_events')
  .select('id').eq('program_year_id', finishedYear.id).eq('event_type', 'practice').limit(1);
if (!pastPractices?.length) {
  const pastPlan = {
    version: 1,
    goal: 'Cleaner decisions in the last ten minutes.',
    practiceTypes: ['Skills'],
    equipment: ['Cones', 'Bibs'],
    blocks: [
      {
        id: 'uat-past-blk-1', title: 'Warm-up', duration: { minutes: 15 },
        description: 'Dynamic warm-up, then partner work at walking pace.',
        goal: 'Everyone moving and talking before the first drill.',
        coachingPoints: ['Heads up', 'Call for it early'],
      },
      {
        id: 'uat-past-blk-2', title: 'Decisions under pressure', duration: { minutes: 30 },
        description: 'Small grid, two touches, defenders added every round.',
        goal: 'Pick the pass before the ball arrives.',
      },
    ],
  };
  const rows = [
    {
      name: 'Season practice — plan and notes', day: 4,
      practice_plan: pastPlan, practice_recap: 'Best session of the year. Keep the grid smaller next time.',
      status: 'scheduled',
    },
    {
      name: 'Season practice — notes only', day: 11,
      practice_plan: null, practice_recap: 'No plan written — we ran the warm-up and played.',
      status: 'scheduled',
    },
    {
      name: 'Season practice — called off', day: 18,
      practice_plan: pastPlan, practice_recap: null, status: 'cancelled',
    },
  ].map(r => ({
    program_year_id: finishedYear.id, team_id: pastTeam.id, org_id: org.id,
    event_type: 'practice', name: r.name,
    starts_at: new Date(Date.UTC(finishedYear.year, 6, r.day, 22, 0)).toISOString(),
    location: 'UAT Fields', field_number: '1',
    status: r.status, practice_plan: r.practice_plan, practice_recap: r.practice_recap,
  }));
  const ins = await db.from('rep_team_events').insert(rows);
  if (ins.error) { console.error('✗ finished-season practices insert', ins.error.message); process.exit(1); }
  ok('finished-season practices seeded (plan+recap, recap-only, cancelled)');
} else {
  ok('finished-season practices already present');
}

/**
 * ── 16. The finished season's MONEY (P4) ─────────────────────────────────────
 *
 * ⚠⚠ **WITHOUT THIS, THE CLOSED MONEY BOOK RENDERS EMPTY AND A GREEN SWEEP PROVES NOTHING.** The
 * between-seasons team has finished seasons, games and (since P3) practices — but never a dollar.
 * "How the season added up" only draws when the season HAS a plan and some spending, so on the
 * fixture as it stood the section was simply absent and the sweep would have measured its absence.
 * The identical trap P3's practices seeding documents, one phase later.
 *
 * A plan and its actuals, deliberately NOT equal: one category lands OVER, the other UNDER. A
 * statement where every row is exact would prove the table renders and nothing about whether it
 * tells the truth about a difference — and "over" is the reading the wording has to get right,
 * since the colour alone cannot carry it (olive↔danger is ~1.0 ΔE for a deuteranope).
 */
const { data: pastLines } = await db.from('rep_budget_lines')
  .select('id').eq('program_year_id', finishedYear.id).limit(1);
if (!pastLines?.length) {
  /* ⚠ Descriptions taken from `FIXTURE_ITEMS` above, deliberately. `taxonomyFor` falls back to the
     FIRST category for a name it does not know — silently — so an invented description here would
     file the whole finished season under one arbitrary heading and the statement would look
     plausible while proving nothing about category grouping. */
  const planned = [
    { description: 'Diamond permits',      total_amount: 2800, sort_order: 1 },
    { description: 'Spring classic entry', total_amount: 3000, sort_order: 2 },
    { description: 'Winter dome block',    total_amount: 1600, sort_order: 3 },
  ].map(r => ({
    ...r, line_kind: 'cost', org_id: org.id, team_id: pastTeam.id,
    program_year_id: finishedYear.id, ...taxonomyFor(r.description),
  }));
  const insLines = await db.from('rep_budget_lines').insert(planned);
  if (insLines.error) { console.error('✗ finished-season budget insert', insLines.error.message); process.exit(1); }

  // Actuals: permits came in under, entries exact, uniforms OVER — one of each reading.
  /* ⚠ Each cost names the PLANNED LINE it belongs under, and inherits that line's taxonomy — a cost
     reaches its category through its item, its category id, or a free-text name, and seeding the
     modern shape is what makes the statement's rows land under real headings rather than all
     collapsing into "No category". */
  const spent = [
    // Facilities: planned 2,800 + 1,600 = 4,400 · paid 1,500 + 1,240 + 1,712 = 4,452 → OVER by 52.
    { under: 'Diamond permits',      description: 'Diamond permits — April block', amount: 1500, month: 3, day: 12 },
    { under: 'Diamond permits',      description: 'Diamond permits — June block',  amount: 1240, month: 5, day: 9 },
    { under: 'Winter dome block',    description: 'Dome hire — pre-season',        amount: 1712, month: 2, day: 28 },
    // Tournaments: planned 3,000 · paid 2,900 → UNDER by 100. One of each reading on one statement.
    { under: 'Spring classic entry', description: 'Spring classic entry',          amount: 2900, month: 4, day: 20 },
  ];
  try {
    for (const r of spent) {
      const tax = taxonomyFor(r.under);
      /* ⚠ PAID, and dated to the SEASON'S own year rather than to "now" — a rendered baseline keyed
         on the screen's text must not drift each time the sweep runs. `month` is 0-based (it once
         fed Date.UTC); `paid_date` is a bare date column, so no org-noon stamp is needed (P2). */
      const day = `${finishedYear.year}-${String(r.month + 1).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`;
      await insertCommitmentWithRecords(db, {
        row: {
          org_id: org.id, team_id: pastTeam.id, program_year_id: finishedYear.id,
          // ⚠ 'expense' — the column carries a CHECK of ('expense','tournament_payable'), not free text.
          expense_type: 'expense', description: r.description,
          budget_category_id: tax.category_id, budget_item_id: tax.item_id,
        },
        ...paidOnce(r.amount, day),
      });
    }
    ok('finished-season money seeded (3 planned lines, 4 costs — one category over, one under)');
  } catch (e) {
    console.error('✗ finished-season expenses insert', e.message); process.exit(1);
  }
} else {
  ok('finished-season money already present');
}

// ── 13c. The other three people — assistant, money-less assistant, helper ────
/**
 * ⚠⚠ **OWNER QA CANNOT WALK A REFUSAL IT CANNOT SIGN IN AS** (added 2026-08-17, §53 Phase 6).
 *
 * Six of §53's checks are about who is REFUSED — the money book absent for a coach without money
 * access, the practices door absent for a helper, a typed past-plan URL turned away. Every one of
 * those is covered by an automated test, which creates its people and tears them down again. That
 * proves the lock works; it does not let the owner see the door.
 *
 * Until this block, the UAT world held exactly ONE coach — a head coach — so a third of the walk's
 * personas did not exist. The gap was found the same way the rolled-forward one above it was: by
 * someone starting the walk.
 *
 * ⚠ Each is a MEMBERSHIP on both teams (M1: access is the team membership, not the season row), so
 * they can be signed in as against the live team AND the between-seasons one without further setup.
 *
 * ⚠ **Every grant is spelled out, none left to default.** An assistant's omitted key falls back to
 * ASSISTANT_DEFAULTS, which GRANTS it — so a missing `false` here would quietly hand the money-less
 * assistant the books and turn the sharpest check in Phase 6 green for the wrong reason.
 */
const QA_PEOPLE = [
  {
    email: 'uat-asst-money@uat-test-org.local',
    name: 'UAT Assistant (money)',
    role: 'assistant_coach',
    /* Reads the books, and everything an ordinary assistant reads. Phase 6a: this is the coach who
       proves the widening — money granted TODAY opens a finished season's money. */
    caps: {
      schedule: true, scheduleManage: false, attendance: true, lineups: true, rosterPii: true,
      notes: false, money: 'write', documents: 'read', announcementsSend: false, tryouts: false,
      staffChat: true,
    },
  },
  {
    email: 'uat-asst-nomoney@uat-test-org.local',
    name: 'UAT Assistant (no money)',
    role: 'assistant_coach',
    /* ⚠ THE PAIR THAT MATTERS. Attendance and lineups give this coach record access, so the
       PRACTICES shelf is theirs — and `money: 'off'` means the money book is not. Two shelves on
       one page, two different keys, and only a real sign-in shows it. */
    caps: {
      schedule: true, scheduleManage: false, attendance: true, lineups: true, rosterPii: false,
      notes: false, money: 'off', documents: 'off', announcementsSend: false, tryouts: false,
      staffChat: true,
    },
  },
  {
    email: 'uat-asst-treasurer@uat-test-org.local',
    name: 'UAT Assistant (treasurer only)',
    role: 'assistant_coach',
    /**
     * ⚠⚠ **MONEY AND NOTHING ELSE — the only persona that can walk the Insights gate change**
     * (reports portal P1, owner ruling 3, 2026-08-18: no money in Insights, so a coach whose ONLY
     * duty is money loses that door and keeps the Money hub).
     *
     * ⚠ Added because the walk for that ruling was NOT WALKABLE without it, and nothing said so.
     * `uat-asst-money` looks like the treasurer and is not: it also holds attendance and lineups, so
     * it keeps Insights for reasons that have nothing to do with money. Signing in as it would have
     * shown the Insights door present and read as a PASS — confirming the opposite of the ruling.
     *
     * ⚠ Every grant is spelled out, none left to default: an assistant's omitted key falls back to
     * ASSISTANT_DEFAULTS, which GRANTS attendance and lineups — either one of which would silently
     * hand this persona the door and turn the sharpest check in the walk green for the wrong reason.
     */
    caps: {
      schedule: false, scheduleManage: false, attendance: false, lineups: false, rosterPii: false,
      notes: false, money: 'write', documents: 'off', announcementsSend: false, tryouts: false,
      staffChat: false,
    },
  },
  {
    email: 'uat-helper@uat-test-org.local',
    name: 'UAT Helper',
    role: 'assistant_coach',
    /* The HELPER preset: the schedule and tonight's plan, and nothing that makes a season's record
       theirs. `hasRecordAccess` is false for this bundle, which is what shuts both shelves. */
    caps: {
      schedule: true, scheduleManage: false, attendance: false, lineups: false, rosterPii: false,
      notes: false, money: 'off', documents: 'off', announcementsSend: false, tryouts: false,
      staffChat: false,
    },
  },
];

for (const person of QA_PEOPLE) {
  let qaUser = userPage.users.find(u => u.email?.toLowerCase() === person.email.toLowerCase());
  if (!qaUser) {
    const created = await db.auth.admin.createUser({
      email: person.email, password: process.env.UAT_COACH_PASSWORD, email_confirm: true,
    });
    if (created.error) { console.error(`✗ create ${person.email}`, created.error.message); process.exit(1); }
    qaUser = created.data.user;
  }

  const { data: orgRow } = await db.from('organization_members')
    .select('id, status').eq('organization_id', org.id).eq('user_id', qaUser.id).maybeSingle();
  if (!orgRow) {
    const ins = await db.from('organization_members').insert({
      organization_id: org.id, user_id: qaUser.id, role: 'coach', status: 'active',
      display_name: person.name, accepted_at: new Date().toISOString(),
    });
    if (ins.error) { console.error(`✗ org member ${person.email}`, ins.error.message); process.exit(1); }
  } else if (orgRow.status !== 'active') {
    await db.from('organization_members').update({ status: 'active' }).eq('id', orgRow.id);
  }

  // ⚠ BOTH teams — the walk signs in once per person and visits the live team and the
  // between-seasons one. A membership on only one of them strands half of Phase 6.
  for (const tid of [team.id, pastTeam.id]) {
    const up = await db.from('rep_team_staff_memberships').upsert({
      org_id: org.id, team_id: tid, user_id: qaUser.id,
      coach_role: person.role, capabilities: person.caps,
      status: 'active', revoked_at: null, revoked_by: null,
    }, { onConflict: 'team_id,user_id' });
    if (up.error) { console.error(`✗ membership ${person.email}`, up.error.message); process.exit(1); }
  }
}
ok(`QA personas ready on both teams (${QA_PEOPLE.map(p => p.email.split('@')[0]).join(', ')})`);


/* ⚖ THE END-OF-RUN BACKFILL IS GONE (Payables Rebuild P2). It derived installments and payments
   from the legacy deposit/balance columns — a direction that became dangerous the moment payments
   were real records, because a re-derivation would overwrite them with a deposit-shaped fiction.
   Every commitment above is seeded WITH its records through `insertCommitmentWithRecords`, so
   there is nothing left to derive; `npm run check:money-report` still proves the split-month shape
   is present. */

console.log(`\n✓ UAT coach fixture is whole.\n`);
console.log(`  Sign in as : ${coachEmail}`);
console.log(`  Portal     : /${org.slug}/coaches/teams/${team.id}/schedule`);
console.log(`  Between    : /${org.slug}/coaches/teams/${pastTeam.id}/season-end`);
console.log(`  Run screen : /${org.slug}/coaches/teams/${team.id}/practice/${eventId}/run`);
console.log(`  Console    : /${org.slug}/coaches/teams/${team.id}/game/${gameId}\n`);
console.log(`  Probes     : PROBE_EVENT_ID=${eventId} npx playwright test --config playwright.config.ts\n`);
