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
  .select('id, name').in('scope', ['team', 'both']).order('sort_order').limit(2);
if (catErr) { console.error('✗ budget_categories read', catErr.message); process.exit(1); }
if (!cats?.length) {
  // Loud, not silent: a fixture that cannot name its categories is not the fixture anyone meant.
  console.error('✗ No team-scoped budget categories found — the Money fixture would seed everything as "Uncategorized".');
  process.exit(1);
}

const { data: existingLines } = await db.from('rep_budget_lines')
  .select('id').eq('team_id', team.id).eq('program_year_id', py.id).limit(1);

if (!existingLines?.length) {
  const lineRows = [
    { description: 'Winter dome block', total_amount: 5200, notes: '16 sessions, Jan–Mar', line_kind: 'cost',    category_id: cats?.[0]?.id ?? null, sort_order: 1 },
    { description: 'Diamond permits',   total_amount: 3200, notes: null,                   line_kind: 'cost',    category_id: cats?.[0]?.id ?? null, sort_order: 2 },
    { description: 'Spring classic entry', total_amount: 1600, notes: null,                line_kind: 'cost',    category_id: cats?.[1]?.id ?? cats?.[0]?.id ?? null, sort_order: 3 },
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

// Expenses AND payables live in the same table, told apart by `expense_type`. Both sub-tabs need
// a row or half the Expenses screen is still an empty state.
const { data: existingExp } = await db.from('rep_team_expenses')
  .select('id').eq('team_id', team.id).eq('program_year_id', py.id).limit(1);

if (!existingExp?.length) {
  const soon = new Date(); soon.setDate(soon.getDate() + 20);
  const past = new Date(); past.setDate(past.getDate() - 10);
  const exp = await db.from('rep_team_expenses').insert([
    {
      org_id: org.id, team_id: team.id, program_year_id: py.id,
      expense_type: 'expense', description: 'Practice balls and tees',
      category: cats?.[0]?.name ?? null, amount: 240, expense_paid_at: new Date().toISOString(),
    },
    {
      org_id: org.id, team_id: team.id, program_year_id: py.id,
      expense_type: 'expense', description: 'Scorekeeping tablet',
      category: cats?.[0]?.name ?? null, amount: 310, expense_paid_at: null,
    },
    // The one genuinely NESTED row in the hub: a deposit already paid and a balance still due.
    {
      org_id: org.id, team_id: team.id, program_year_id: py.id,
      expense_type: 'tournament_payable', description: 'Spring classic entry',
      category: cats?.[1]?.name ?? cats?.[0]?.name ?? null, amount: 1600,
      deposit_amount: 600, deposit_due_date: past.toISOString().slice(0, 10), deposit_paid_at: new Date().toISOString(),
      balance_amount: 1000, balance_due_date: soon.toISOString().slice(0, 10), balance_paid_at: null,
    },
  ]);
  if (exp.error) console.log(`  ! expenses skipped (${exp.error.message})`);
  else { money.expenses = 3; ok('expenses + a two-part payable seeded'); }
} else {
  ok('expenses already present');
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

// One request per status that changes the row: pending keeps its Cancel button, denied carries a
// reason and therefore an expandable detail row.
const { data: existingPr } = await db.from('rep_team_payment_requests')
  .select('id').eq('team_id', team.id).limit(1);

if (!existingPr?.length) {
  const pr = await db.from('rep_team_payment_requests').insert([
    { org_id: org.id, team_id: team.id, request_type: 'charge_to_org', amount: 450, description: 'Diamond permit reimbursement', status: 'pending',  created_by: user.id, notes: 'Receipt attached in Documents.' },
    { org_id: org.id, team_id: team.id, request_type: 'payment_to_org', amount: 200, description: 'Team share of league fee',     status: 'approved', created_by: user.id, reviewed_at: new Date().toISOString() },
    { org_id: org.id, team_id: team.id, request_type: 'charge_to_org', amount: 90,  description: 'Extra practice jerseys',        status: 'denied',   created_by: user.id, reviewed_at: new Date().toISOString(), denial_reason: 'Outside the approved equipment budget.' },
  ]);
  if (pr.error) console.log(`  ! payment requests skipped (${pr.error.message})`);
  else { money.requests = 3; ok('payment requests seeded (pending, approved, denied)'); }
} else {
  ok('payment requests already present');
}

console.log(`\n✓ UAT coach fixture is whole.\n`);
console.log(`  Sign in as : ${coachEmail}`);
console.log(`  Portal     : /${org.slug}/coaches/teams/${team.id}/schedule`);
console.log(`  Run screen : /${org.slug}/coaches/teams/${team.id}/practice/${eventId}/run`);
console.log(`  Console    : /${org.slug}/coaches/teams/${team.id}/game/${gameId}\n`);
console.log(`  Probes     : PROBE_EVENT_ID=${eventId} npx playwright test --config playwright.config.ts\n`);
