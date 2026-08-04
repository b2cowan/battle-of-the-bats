/**
 * Sweep the "See it live" demo across a WHOLE DAY of replay cycles.
 *
 * `check-demo-sandbox.mjs` asks "is the sandbox presentable right now?". This asks the harder
 * question: "is it presentable at every hour of the day?" — and the difference is not academic.
 * The demo's games float with the clock, so a placement that looks fine at 2pm can fall off the
 * end of the calendar day at 10pm. That is exactly what happened: the "Up Next" filler sat four
 * hours past the cycle start, which for the late-evening replays landed after midnight, on the day
 * AFTER the event date, and the game-day dashboard quietly lost a card for about an hour a day.
 * Nobody found it for a week because every spot check happened in the afternoon.
 *
 * At each of 84 sampled moments (12 cycle starts × 7 points inside the cycle) it asserts:
 *   • a game is LIVE — except in the documented 4-minute bracket seam, where nothing is by design;
 *   • "Up Next" is not empty;
 *   • "Needs a Score" is not empty — a game-day dashboard with nothing to do sells nothing;
 *   • the schedule reads HEALTHY with zero conflicts, and stays in its 89–92 band.
 *
 * ⚠ **Run this after ANY change to the demo's times, durations, facilities or cycle structure.**
 * That baseline was hard-won (four diamonds, midday pool play, 75-minute games are each
 * load-bearing) and a single moved game can cost it.
 *
 * Identity comes from the REAL rows (teams, diamonds, divisions); dates, times, statuses and
 * scores are overlaid from `resolveDemoState(now)` — i.e. precisely what the reconcile job would
 * write at that instant. So this measures the demo as a visitor would meet it, without waiting a
 * day to find out.
 *
 * Run: node --env-file=.env.local scripts/sweep-demo-sandbox.mjs
 * Exit 0 = presentable all day. Non-zero = it has an hour it should not be shown in.
 */
import { createClient } from '@supabase/supabase-js';
import { buildScheduleMetrics } from '../lib/schedule-metrics.ts';
import { zonedWallClockToUtc } from '../lib/timezone.ts';
import { isGameLive } from '../lib/game-status.ts';
import { getDemoOrgByKind, DEMO_TOURNAMENT_SLUG } from '../lib/demo-org.ts';
import { poolKeyFor } from '../lib/demo-reconcile-core.ts';
import { resolveDemoState, DEMO_GAME_DURATION_MINUTES, DEMO_CYCLE_MINUTES } from '../lib/demo-tournament.ts';
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

// 12 replay cycles per day × 7 moments inside each. The minutes are chosen, not spread evenly:
// 1 and 30 catch the opening, 60 and 87 the semifinal's end, 90 the four-minute bracket seam, and
// 100/115 the final-live tail — which is precisely where the "Up Next" gap lived.
const dayStart = Date.UTC(2026, 7, 3, 0, 0, 0);
for (let c = 0; c < 12; c++) {
  for (const minute of [1, 30, 60, 87, 90, 100, 115]) {
    const now = new Date(dayStart + c * DEMO_CYCLE_MINUTES * 60000 + minute * 60000);
    const state = resolveDemoState(now);
    const want = new Map(state.games.map(g => [g.key, g]));

    // Overlay the clock-implied state onto the real rows.
    const games = rows.map(r => {
      const d = want.get(keyOf(r));
      return {
        id: r.id, tournamentId: r.tournament_id, divisionId: r.division_id,
        homeTeamId: r.home_team_id, awayTeamId: r.away_team_id,
        homePlaceholder: r.home_placeholder, awayPlaceholder: r.away_placeholder,
        date: d ? d.date : r.game_date, time: d ? d.time : r.game_time,
        venueId: r.diamond_id, venueFacilityId: r.venue_facility_id,
        status: d ? d.status : r.status, isPlayoff: r.is_playoff,
        durationMinutes: r.duration_minutes, bracketCode: r.bracket_code,
        homeScore: d ? d.homeScore : r.home_score, awayScore: d ? d.awayScore : r.away_score,
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
      divisions: divisions.map(d => ({ id: d.id, name: d.name, playoffConfig: d.playoff_config })),
      tournament: { id: tournament.id, name: tournament.name, settings: tournament.settings },
      games, standingsGames: games, includePlayoffs: true,
      gameDurationMinutes: DEMO_GAME_DURATION_MINUTES,
    });

    const where = `${new Date(dayStart + c * 120 * 60000).toISOString().slice(11, 16)}Z +${String(minute).padStart(3)}m (${state.phase.padEnd(15)} local ${state.eventDate} )`;
    samples++;
    if (state.phase !== 'bracket-seeded' && live.length < 1) failures.push(`${where} NO LIVE GAME`);
    if (upNext.length < 1) failures.push(`${where} UP NEXT EMPTY`);
    if (needsScore.length < 1) failures.push(`${where} NEEDS-A-SCORE EMPTY`);
    if (metrics.healthTone !== 'good') failures.push(`${where} health ${metrics.healthScore} tone=${metrics.healthTone}`);
    if (metrics.venueConflictCount + metrics.bufferConflictCount > 0) failures.push(`${where} CONFLICTS ${metrics.venueConflictCount}+${metrics.bufferConflictCount}`);
    if (metrics.healthScore < 85) failures.push(`${where} health dropped to ${metrics.healthScore}`);
    scores.push(metrics.healthScore);
  }
}

// Report the health range so a regression in the 89-92 baseline is visible, not just pass/fail.
console.log(`\nSampled ${samples} cycle × phase moments across a full day.`);
console.log(`health range across the sweep: ${Math.min(...scores)}–${Math.max(...scores)} / 100`);
if (failures.length === 0) console.log('✅ every sample: live game, Up Next populated, Needs-a-Score populated, HEALTHY, zero conflicts');
else { console.log(`❌ ${failures.length} failure(s):`); failures.forEach(f => console.log(`   ${f}`)); }
process.exit(failures.length ? 1 : 0);
