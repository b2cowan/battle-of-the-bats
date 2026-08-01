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
 * ⚠ Sport-neutral by requirement (`lib/sports.ts` Sport Pack rule): no baseball/softball-shaped
 * station names, drills or player names. A fixture is content too.
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

console.log(`\n✓ UAT coach fixture is whole.\n`);
console.log(`  Sign in as : ${coachEmail}`);
console.log(`  Portal     : /${org.slug}/coaches/teams/${team.id}/schedule`);
console.log(`  Run screen : /${org.slug}/coaches/teams/${team.id}/practice/${eventId}/run\n`);
console.log(`  Probes     : PROBE_EVENT_ID=${eventId} npx playwright test --config playwright.config.ts\n`);
