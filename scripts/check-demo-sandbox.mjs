/**
 * Verify the Tournament Admin Sandbox is in the state a prospect should find it in.
 *
 * This is the demo's smoke test AND its staleness detector. A sandbox that has quietly stopped
 * ticking still renders — it just shows a tournament whose "live" semifinal finished six hours
 * ago, which is worse than showing nothing, because it is the one surface we point strangers at
 * as proof the product works.
 *
 * It asserts, against the live database and the app's OWN engines:
 *   1. the demo org and event exist, are comped, and are excluded from the public directory;
 *   2. the bracket seeding matches what the real standings engine produces;
 *   3. exactly one game is LIVE by the app's own time-window rule (`lib/game-status.ts`);
 *   4. "Needs a Score" and "Up Next" are both non-empty — the dashboard has a job in it;
 *   5. the schedule is HEALTHY with zero conflicts, using the real schedule-health engine —
 *      the "try to break it" beat needs something intact to break;
 *   6. the rows agree with what `resolveDemoState(now)` says they should be, i.e. the reconcile
 *      job has run recently enough that the demo is not stale.
 *
 * Exit code 0 = the sandbox is presentable. Non-zero = do not point anyone at it.
 *
 * Run: node --env-file=.env.local scripts/check-demo-sandbox.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { buildScheduleMetrics } from '../lib/schedule-metrics.ts';
import { computeTournamentStandings } from '../lib/tie-breakers.ts';
import { zonedWallClockToUtc } from '../lib/timezone.ts';
import { getDemoOrgByKind, DEMO_TOURNAMENT_SLUG } from '../lib/demo-org.ts';
import {
  resolveDemoState, demoBracketSeeds, DEMO_GAME_DURATION_MINUTES,
  DEMO_BRACKET_CODES, DEMO_PLAYOFF_CONFIG, DEMO_TOURNAMENT_SETTINGS,
} from '../lib/demo-tournament.ts';

const LIVE_GRACE_MINUTES = 30;   // mirrors lib/game-status.ts
const failures = [];
const notes = [];
const ok = (label) => console.log(`  ✓ ${label}`);
function check(condition, label, detail) {
  if (condition) { ok(label); return true; }
  failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const demoOrg = getDemoOrgByKind('tournament');
if (!demoOrg) { console.error('No tournament demo org registered in lib/demo-org.ts'); process.exit(1); }

console.log(`\nSandbox check — ${demoOrg.label}\n`);

// ── 1. org + event ───────────────────────────────────────────────────────────────────────────
console.log('Organization and event');
const { data: org } = await db.from('organizations').select('*').eq('slug', demoOrg.slug).maybeSingle();
if (!check(!!org, 'demo org exists', `no org with slug "${demoOrg.slug}" — run scripts/seed-demo-tournament.mjs`)) {
  process.exit(1);
}
check(org.plan_id === 'tournament_plus', 'comped to Tournament Plus (D2)', `plan_id=${org.plan_id}`);
check(org.is_discoverable === false, 'excluded from /discover', `is_discoverable=${org.is_discoverable}`);
check(org.is_public === true, 'public pages render', `is_public=${org.is_public}`);

const { data: tournament } = await db.from('tournaments')
  .select('*').eq('org_id', org.id).eq('slug', DEMO_TOURNAMENT_SLUG).maybeSingle();
if (!check(!!tournament, 'demo tournament exists')) process.exit(1);
check(tournament.list_in_directory === false, 'excluded from the tournament directory', `list_in_directory=${tournament.list_in_directory}`);
check(
  !JSON.stringify(tournament.settings ?? {}).toLowerCase().includes('e-transfer'),
  'no payment instructions in front of a prospect',
);

const [{ data: divisions }, { data: teams }, { data: games }] = await Promise.all([
  db.from('divisions').select('*').eq('tournament_id', tournament.id),
  db.from('teams').select('*').eq('tournament_id', tournament.id),
  db.from('games').select('*').eq('tournament_id', tournament.id),
]);

const teamName = Object.fromEntries(teams.map(t => [t.id, t.name]));
const byCode = Object.fromEntries(games.filter(g => g.bracket_code).map(g => [g.bracket_code, g]));

// ── 2. contacts are fictional ────────────────────────────────────────────────────────────────
console.log('\nContacts');
const realLookingContact = teams.find(t =>
  (t.email && !t.email.endsWith('@example.com')) || (t.coach_email && !t.coach_email.endsWith('@example.com')));
check(!realLookingContact, 'every team contact is an unreachable example.com address',
  realLookingContact ? `${realLookingContact.name} → ${realLookingContact.email ?? realLookingContact.coach_email}` : undefined);

// ── 3. the bracket matches the real standings engine ─────────────────────────────────────────
console.log('\nBracket seeding');
const bracketDivision = divisions.find(d => d.playoff_config);
check(!!bracketDivision, 'one division carries a playoff bracket');
const domainTeams = teams.map(t => ({ id: t.id, name: t.name, divisionId: t.division_id, status: t.status, poolId: t.pool_id }));
const domainGames = games
  .filter(g => !g.is_playoff && g.status === 'completed')
  .map(g => ({
    id: g.id, divisionId: g.division_id,
    homeTeamId: g.home_team_id, awayTeamId: g.away_team_id,
    homeScore: g.home_score, awayScore: g.away_score,
    status: 'completed', isPlayoff: false,
  }));
const standings = computeTournamentStandings(
  bracketDivision.id, domainTeams, domainGames, DEMO_PLAYOFF_CONFIG, DEMO_TOURNAMENT_SETTINGS,
);
const expectedSeeds = demoBracketSeeds().map(t => t.name);
const actualSeeds = standings.map(s => s.teamName);
check(
  JSON.stringify(actualSeeds) === JSON.stringify(expectedSeeds),
  'standings order is deterministic and matches the canonical seeding',
  `engine says ${actualSeeds.join(' > ')}`,
);

const sf1 = byCode[DEMO_BRACKET_CODES.SF1];
const sf2 = byCode[DEMO_BRACKET_CODES.SF2];
const fin = byCode[DEMO_BRACKET_CODES.FIN];
check(!!sf1 && !!sf2 && !!fin, 'all three bracket games exist');
check(
  teamName[sf1.home_team_id] === expectedSeeds[0] && teamName[sf1.away_team_id] === expectedSeeds[3],
  'SF1 is #1 vs #4',
);
check(
  teamName[sf2.home_team_id] === expectedSeeds[1] && teamName[sf2.away_team_id] === expectedSeeds[2],
  'SF2 is #2 vs #3',
);

// ── 4. the clock ─────────────────────────────────────────────────────────────────────────────
console.log('\nLive state');
const now = new Date();
const state = resolveDemoState(now);
console.log(`  (phase ${state.phase}, minute ${state.minuteInCycle} of the cycle)`);

const isLive = (g) => {
  if (['completed', 'forfeit', 'cancelled'].includes(g.status)) return false;
  const startIso = zonedWallClockToUtc(g.game_date, g.game_time);
  if (!startIso) return false;
  const start = Date.parse(startIso);
  const end = start + ((g.duration_minutes ?? DEMO_GAME_DURATION_MINUTES) + LIVE_GRACE_MINUTES) * 60_000;
  return now.getTime() >= start && now.getTime() < end;
};

const liveGames = games.filter(isLive);
// The 'bracket-seeded' phase is the four-minute seam between the semifinal ending and the Final
// starting, where nothing is live by design (the Final needs a legal rest gap). Everywhere else,
// a demo with no live game is a demo that looks like a screenshot, and that IS a failure.
if (state.phase === 'bracket-seeded') {
  ok(`no live game — expected during the ${state.phase} seam (4 min of every 120)`);
  notes.push('sampled during the bracket-seeded seam; re-run in a minute to see a live game');
} else {
  check(liveGames.length >= 1, 'at least one game is LIVE right now',
    `${liveGames.length} live — the demo would look like a recording`);
}
check(liveGames.length <= 2, 'not implausibly many games live at once', `${liveGames.length} live`);

// Staleness: the rows must agree with what the clock says they should be. If they don't, the
// reconcile job has not run recently and the demo is drifting toward looking abandoned.
//
// ⚠ Both checks here USED to pass on a demo that was a full cycle behind, which is how a frozen
// sandbox reached an owner QA pass on 2026-08-03 with a clean bill of health:
//   • the date check compared only `game_date`, and the drift is in the TIME — a demo exactly one
//     120-minute cycle stale still falls on the same calendar day for most of the day;
//   • the score check tolerated ±2, and a stale row SATURATES at the game's final score, which is
//     always within 2 of the late-cycle partial it is being compared against.
// They now compare the semifinal's full timestamp and its STATUS, which is what actually moves.
const expectedSf1 = state.games.find(g => g.key === DEMO_BRACKET_CODES.SF1);
const sf1Time = (sf1.game_time ?? '').slice(0, 8);
check(
  sf1.game_date === expectedSf1.date && sf1Time === expectedSf1.time,
  'the semifinal is anchored to the current cycle',
  `row says ${sf1.game_date} ${sf1Time}, the clock says ${expectedSf1.date} ${expectedSf1.time}`,
);
// Status is the honest staleness signal: it flips exactly once per cycle, at minute 88, and a
// stale row therefore disagrees for most of the cycle rather than coincidentally matching.
check(
  sf1.status === expectedSf1.status,
  'the reconcile job is actually running (semifinal status matches the clock)',
  `row is ${sf1.status}, the clock says ${expectedSf1.status} at minute ${state.minuteInCycle}`,
);
const scoreDrift = Math.abs((sf1.home_score ?? 0) - (expectedSf1.homeScore ?? 0));
check(scoreDrift <= 2, 'the live score is current',
  `row ${sf1.home_score}-${sf1.away_score}, clock expects ${expectedSf1.homeScore}-${expectedSf1.awayScore}`);

// Who is at fault when the demo IS stale? The scheduler heartbeats on dispatch and the reconcile
// heartbeats on arrival, so comparing the two separates "nothing is scheduled" from "the schedule
// fires but never reaches the app" — the failure that actually happened.
const { data: beats } = await db
  .from('observability_cron_heartbeat')
  .select('job_name, last_run_at')
  .in('job_name', ['demo_sandbox_tick', 'demo_sandbox_reconcile']);
const minutesAgo = (name) => {
  const row = (beats ?? []).find(b => b.job_name === name);
  if (!row?.last_run_at) return null;
  return Math.round((now.getTime() - Date.parse(row.last_run_at)) / 60_000);
};
const dispatched = minutesAgo('demo_sandbox_tick');
const arrived = minutesAgo('demo_sandbox_reconcile');
if (dispatched !== null && (arrived === null || arrived > dispatched + 10)) {
  notes.push(
    `the scheduler dispatched ${dispatched} min ago but the app last reconciled ` +
    `${arrived === null ? 'never' : `${arrived} min ago`} — the schedule is firing and not ` +
    'arriving. Check the Vault base URL for this environment (migration 183).',
  );
}
check(
  state.finalIsSeeded ? !!fin.home_team_id : !fin.home_team_id,
  state.finalIsSeeded ? 'the Final has seeded itself' : 'the Final still reads "Winner SF1"',
);

// ── 5. the dashboard has a job in it ─────────────────────────────────────────────────────────
console.log('\nGame-day dashboard');
const todayKey = state.eventDate;
const needsScore = games.filter(g =>
  g.status !== 'completed' && g.status !== 'cancelled' && g.home_score == null && !isLive(g) &&
  Date.parse(zonedWallClockToUtc(g.game_date, g.game_time) ?? 0) < now.getTime());
check(needsScore.length >= 1, '"Needs a Score" is not empty', 'a dashboard with nothing to do sells nothing');

const upNext = games.filter(g =>
  g.game_date === todayKey && g.status !== 'completed' && !isLive(g) &&
  Date.parse(zonedWallClockToUtc(g.game_date, g.game_time) ?? 0) > now.getTime());
check(upNext.length >= 1, '"Up Next" is not empty');

// ── 6. the schedule is healthy (the beat needs something intact to break) ────────────────────
console.log('\nSchedule health (the real engine)');
const metricGames = games.map(g => ({
  id: g.id, tournamentId: g.tournament_id, divisionId: g.division_id,
  homeTeamId: g.home_team_id, awayTeamId: g.away_team_id,
  homePlaceholder: g.home_placeholder, awayPlaceholder: g.away_placeholder,
  date: g.game_date, time: g.game_time,
  venueId: g.diamond_id, venueFacilityId: g.venue_facility_id,
  status: g.status, isPlayoff: g.is_playoff, durationMinutes: g.duration_minutes,
  bracketCode: g.bracket_code, homeScore: g.home_score, awayScore: g.away_score,
}));
const metrics = buildScheduleMetrics({
  teams: teams.map(t => ({ id: t.id, name: t.name, divisionId: t.division_id, status: t.status, seed: t.seed })),
  divisions: divisions.map(d => ({ id: d.id, name: d.name, playoffConfig: d.playoff_config })),
  tournament: { id: tournament.id, name: tournament.name, settings: tournament.settings },
  games: metricGames,
  standingsGames: metricGames,
  includePlayoffs: true,
  gameDurationMinutes: DEMO_GAME_DURATION_MINUTES,
});
console.log(`  health ${metrics.healthScore}/100 (${metrics.healthTone})`);
check(metrics.venueConflictCount === 0, 'no venue double-bookings', `${metrics.venueConflictCount} found`);
check(metrics.bufferConflictCount === 0, 'no rest-buffer violations', `${metrics.bufferConflictCount} found`);
check(metrics.backToBackCount === 0, 'nobody plays back-to-back', `${metrics.backToBackCount} found`);
check(metrics.healthScore >= 85, 'schedule reads HEALTHY, so there is something to break',
  `score ${metrics.healthScore} (${metrics.healthTone})`);
if (metrics.issues?.length) {
  metrics.issues.forEach(i => notes.push(`schedule issue: ${i.message ?? JSON.stringify(i)}`));
}

// ── verdict ──────────────────────────────────────────────────────────────────────────────────
console.log('');
if (notes.length) { notes.forEach(n => console.log(`  · ${n}`)); console.log(''); }
if (failures.length) {
  console.error(`❌ ${failures.length} problem(s) — do not point anyone at the sandbox:`);
  failures.forEach(f => console.error(`   • ${f}`));
  process.exit(1);
}
console.log('✅ The sandbox is presentable.');
console.log(`   Fan side:  /${demoOrg.slug}/${DEMO_TOURNAMENT_SLUG}`);
console.log(`   Operator:  /${demoOrg.slug}/admin/tournaments/dashboard`);
