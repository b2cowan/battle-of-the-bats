/**
 * Sweep the "See it live" demo across a long run of CALENDAR DAYS.
 *
 * Until the 2026-09-02 daily-snapshot rewrite (see
 * docs/projects/active/TOURNAMENT_SANDBOX_DAILY_SNAPSHOT_PLAN.md), `resolveDemoState(now)`
 * depended on the HOUR of `now` — a rolling 2-hour replay cycle — and this sweep existed to catch
 * placement bugs that only showed up at certain hours of the day (the "Up Next" filler landing
 * after midnight for a late-evening replay is the bug that justified building it). That whole
 * class of bug is gone: the daily-snapshot design ignores the hour and minute of `now` entirely,
 * so every hour of a given calendar day produces byte-identical output. `check-demo-sandbox.mjs`
 * already proves that once, for the one instant it runs at.
 *
 * What is left worth sweeping is CALENDAR DAYS, not hours — specifically the two DST transitions
 * each year, where date-shift arithmetic across a changed UTC offset is the one place a
 * day-only design can still get a date wrong, plus a broad daily sample to catch anything else
 * (a leap day, a year boundary, a month-length edge case). Each sampled day is evaluated at
 * 12:00 UTC — early morning to midday in the org's zone in either DST state, comfortably before
 * every one of the day's fixed game hours (see lib/demo-tournament.ts's own "fixed daily story"
 * table — noon through 5pm local, as of this writing) and never at risk of straddling a
 * calendar-day boundary on its own account. Deliberately not hardcoding the actual hours here a
 * second time: this comment listed them once already and drifted out of sync with a same-session
 * change to one of them, which is exactly the kind of doc/code split this sweep exists to avoid
 * elsewhere — better to point at the one definition than restate it.
 *
 * At each sampled day it asserts:
 *   • the bracket is complete, correctly seeded, and nothing reads as live (nothing ever does, in
 *     the daily-snapshot design, at a sampling instant safely before every game's hour);
 *   • "Up Next" and "Needs a Score" are both populated;
 *   • the schedule reads HEALTHY with zero conflicts;
 *   • the two still moments (the Season Opener, the Invitational) hold their year-order and their
 *     exact payment-attention counts — every one of their dates is a fixed OFFSET from `now`
 *     (see lib/demo-moments.ts), so a correct implementation holds these identically on every
 *     sampled day; a day where they don't is exactly the DST/date-arithmetic bug this sweep is
 *     for.
 *
 * ⚠ Run this after ANY change to the demo's fixed hours, durations, facilities or date offsets.
 *
 * Run: node --env-file=.env.local scripts/sweep-demo-sandbox.mjs
 * Exit 0 = presentable on every sampled day. Non-zero = it has a day it should not be shown on.
 */
import { createClient } from '@supabase/supabase-js';
import { buildScheduleMetrics } from '../lib/schedule-metrics.ts';
import { zonedWallClockToUtc } from '../lib/timezone.ts';
import { isGameLive } from '../lib/game-status.ts';
import { getDemoOrgByKind, DEMO_TOURNAMENT_SLUG } from '../lib/demo-org.ts';
import { poolKeyFor } from '../lib/demo-reconcile-core.ts';
import { resolveDemoState, DEMO_GAME_DURATION_MINUTES } from '../lib/demo-tournament.ts';
import { resolveOpenerState, resolveInvitationalState, invitationalAttentionBuckets } from '../lib/demo-moments.ts';
import { utcToZonedInputs, ORG_TIME_ZONE } from '../lib/timezone.ts';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const demoOrg = getDemoOrgByKind('tournament');

const { data: org } = await db.from('organizations').select('id').eq('slug', demoOrg.slug).single();
const { data: tournament } = await db.from('tournaments').select('*').eq('org_id', org.id).eq('slug', DEMO_TOURNAMENT_SLUG).single();
const { data: divisions } = await db.from('divisions').select('*').eq('tournament_id', tournament.id);
const { data: teams } = await db.from('teams').select('*').eq('tournament_id', tournament.id);
const { data: rows } = await db.from('games').select('*').eq('tournament_id', tournament.id);

const divName = new Map(divisions.map(d => [d.id, d.name]));
const teamName = new Map(teams.map(t => [t.id, t.name]));

const keyOf = (g) => g.bracket_code ?? poolKeyFor(divName.get(g.division_id) ?? '', teamName.get(g.home_team_id ?? '') ?? '', teamName.get(g.away_team_id ?? '') ?? '');

const failures = []; const scores = [];
let samples = 0;

// A bit over two years, daily — comfortably spans four DST transitions (spring-forward and
// fall-back, twice each) plus a leap day (2028-02-29) and every month/year boundary in between.
const DAYS_TO_SWEEP = 800;
const dayStart = Date.UTC(2026, 0, 1, 12, 0, 0); // 2026-01-01 12:00 UTC
for (let d = 0; d < DAYS_TO_SWEEP; d++) {
  const now = new Date(dayStart + d * 86_400_000);
  const state = resolveDemoState(now);
  const want = new Map(state.games.map(g => [g.key, g]));

  // Overlay the clock-implied state onto the real rows.
  const games = rows.map(r => {
    const g = want.get(keyOf(r));
    return {
      id: r.id, tournamentId: r.tournament_id, divisionId: r.division_id,
      homeTeamId: r.home_team_id, awayTeamId: r.away_team_id,
      homePlaceholder: r.home_placeholder, awayPlaceholder: r.away_placeholder,
      date: g ? g.date : r.game_date, time: g ? g.time : r.game_time,
      venueId: r.diamond_id, venueFacilityId: r.venue_facility_id,
      status: g ? g.status : r.status, isPlayoff: r.is_playoff,
      durationMinutes: r.duration_minutes, bracketCode: r.bracket_code,
      homeScore: g ? g.homeScore : r.home_score, awayScore: g ? g.awayScore : r.away_score,
    };
  });

  const startMs = (g) => Date.parse(zonedWallClockToUtc(g.date, g.time) ?? 0);
  // The app's OWN liveness rule, imported rather than mirrored — the whole point of this sweep is
  // to measure what a visitor meets, and a hand-copied time window would drift from what the
  // pages actually render.
  const isLive = (g) => isGameLive(g, g.durationMinutes ?? DEMO_GAME_DURATION_MINUTES, now);

  const live = games.filter(isLive);
  const upNext = games.filter(g => g.date === state.eventDate && g.status !== 'completed' && !isLive(g) && startMs(g) > now.getTime());
  const needsScore = games.filter(g => g.status !== 'completed' && g.status !== 'cancelled' && g.homeScore == null && !isLive(g) && startMs(g) < now.getTime());

  const metrics = buildScheduleMetrics({
    teams: teams.map(t => ({ id: t.id, name: t.name, divisionId: t.division_id, status: t.status, seed: t.seed })),
    divisions: divisions.map(dv => ({ id: dv.id, name: dv.name, playoffConfig: dv.playoff_config })),
    tournament: { id: tournament.id, name: tournament.name, settings: tournament.settings },
    games, standingsGames: games, includePlayoffs: true,
    gameDurationMinutes: DEMO_GAME_DURATION_MINUTES,
  });

  const where = `${state.eventDate} (day ${d})`;
  samples++;
  // Nothing is ever live at 12:00 UTC — every fixed game hour (noon/2pm/3pm/4pm local) sits later
  // in the org's day than this sampling instant, in both DST states.
  if (live.length > 0) failures.push(`${where} UNEXPECTED LIVE GAME (${live.length})`);
  if (upNext.length < 1) failures.push(`${where} UP NEXT EMPTY`);
  if (needsScore.length < 1) failures.push(`${where} NEEDS-A-SCORE EMPTY`);
  if (metrics.healthTone !== 'good') failures.push(`${where} health ${metrics.healthScore} tone=${metrics.healthTone}`);
  if (metrics.venueConflictCount + metrics.bufferConflictCount > 0) failures.push(`${where} CONFLICTS ${metrics.venueConflictCount}+${metrics.bufferConflictCount}`);
  if (metrics.healthScore < 85) failures.push(`${where} health dropped to ${metrics.healthScore}`);
  scores.push(metrics.healthScore);

  // ── The two still moments, at this same instant (Phase 2) ──────────────────────────────────
  // Their dates are pure functions of the clock, so the seams to guard are midnight and DST:
  // the year must stay in order at every sampled day (morning-after strictly before game day's
  // date, registration week strictly after), the Opener must always read "over", and the
  // Invitational's payment buckets must hold their exact counts — the U13 deposit deadline
  // sits in the past and U11's in the future BY CONSTRUCTION, and a date-arithmetic slip at a
  // boundary would silently change who reads Past Due.
  const opener = resolveOpenerState(now);
  const invitational = resolveInvitationalState(now);
  const localToday = utcToZonedInputs(now.toISOString(), ORG_TIME_ZONE).date;
  if (!(opener.endDate < localToday)) failures.push(`${where} OPENER NOT OVER (${opener.endDate} vs today ${localToday})`);
  if (!(opener.startDate < opener.endDate)) failures.push(`${where} OPENER WINDOW INVERTED`);
  if (!(invitational.startDate > localToday)) failures.push(`${where} INVITATIONAL NOT AHEAD (${invitational.startDate})`);
  if (opener.games.some(g => g.status !== 'completed')) failures.push(`${where} OPENER GAME DANGLING`);

  // The shared mapping in lib/demo-moments.ts — the same buckets the unit tests pin, computed
  // through the app's real attention engine (an inline copy here had already drifted onto
  // hardcoded fee literals).
  const buckets = invitationalAttentionBuckets(invitational, localToday);
  const wantBuckets = { pending_review: 2, waitlist: 2, unpaid: 3, past_due: 1, missing_email: 0 };
  for (const [key, want] of Object.entries(wantBuckets)) {
    if ((buckets[key] ?? -1) !== want) failures.push(`${where} INVITATIONAL ${key.toUpperCase()} = ${buckets[key]}, want ${want}`);
  }
}

// Report the health range so a regression in the 89-92 baseline is visible, not just pass/fail.
console.log(`\nSampled ${samples} calendar day(s), spanning multiple DST transitions.`);
console.log(`health range across the sweep: ${Math.min(...scores)}–${Math.max(...scores)} / 100`);
if (failures.length === 0) console.log('✅ every sampled day: no unexpected live game, Up Next populated, Needs-a-Score populated, HEALTHY, zero conflicts');
else { console.log(`❌ ${failures.length} failure(s):`); failures.forEach(f => console.log(`   ${f}`)); }
process.exit(failures.length ? 1 : 0);
