import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEventScheduleHealth, scheduleMetricGameFromRow } from '../../lib/schedule-metrics.ts';

/**
 * Schedule health is ONE number (owner 2026-10-19). The dashboard scored its own way — pool games only, the
 * tournament's buffer for every division, no bracket wiring — so a playoffs-only event read "No timed schedule
 * generated yet" on the board beside a scored bracket on the Schedule. Both now read `buildEventScheduleHealth`.
 */

const read = (path: string) => readFileSync(path, 'utf8');
const SCHEDULE = read('app/[orgSlug]/admin/tournaments/schedule/page.tsx');
const DASHBOARD = read('app/api/admin/tournament-dashboard/route.ts');

const row = (over: Record<string, unknown>) => ({
  id: 'g', tournament_id: 't', division_id: 'u13', home_team_id: null, away_team_id: null,
  home_slot_id: null, away_slot_id: null, home_placeholder: null, away_placeholder: null,
  game_date: '2026-10-18', game_time: '09:00:00', diamond_id: 'lions', venue_facility_id: null,
  schedule_facility_lane_id: null, location: 'Lions Diamond', status: 'scheduled', is_playoff: true,
  duration_minutes: null, bracket_code: null, bracket_id: null, home_score: null, away_score: null, ...over,
});

describe('schedule health is one number on the Schedule and the dashboard', () => {
  test('both screens call the one event-health function, and neither scores the event its own way', () => {
    assert.match(SCHEDULE, /buildEventScheduleHealth\(/);
    assert.match(DASHBOARD, /buildEventScheduleHealth\(/);
    assert.doesNotMatch(SCHEDULE, /buildScheduleMetrics\(/, 'the Schedule scores the event through the one call');
    assert.doesNotMatch(DASHBOARD, /buildScheduleMetrics\(/, 'the dashboard scores the event through the one call');
    assert.doesNotMatch(DASHBOARD, /includePlayoffs:\s*false/, 'the playoffs count on the board too');
  });

  test('a playoffs-only bracket is scored, not "no timed schedule"', () => {
    const games = [
      row({ id: 'qf1', bracket_code: 'QF1', home_placeholder: 'Seed #1', away_placeholder: 'Seed #8' }),
      row({ id: 'qf2', bracket_code: 'QF2', home_placeholder: 'Seed #4', away_placeholder: 'Seed #5', diamond_id: 'maple' }),
      row({ id: 'sf1', bracket_code: 'SF1', game_time: '12:30:00', home_placeholder: 'Winner QF1', away_placeholder: 'Winner QF2' }),
    ].map(scheduleMetricGameFromRow);
    const health = buildEventScheduleHealth({ games, teams: [], divisions: [{ id: 'u13', settings: undefined, playoffConfig: undefined }], tournament: null });
    assert.equal(health.timedGames, 3);
    assert.ok(health.totalGames > 0, 'the playoff games are scored');
  });

  test('a game still to be timed has no score to give; a cancelled one is not counted', () => {
    const games = [
      row({ id: 'a', game_time: null }),
      row({ id: 'b', status: 'cancelled' }),
    ].map(scheduleMetricGameFromRow);
    const health = buildEventScheduleHealth({ games, teams: [], divisions: [], tournament: null });
    assert.equal(health.timedGames, 0);
  });

  test('the row mapper carries the bracket wiring and the scores the seed walk reads', () => {
    const g = scheduleMetricGameFromRow(row({ bracket_code: 'SF1', bracket_id: 'b1', home_score: 7, away_score: 2, duration_minutes: 75 }));
    assert.equal(g.bracketCode, 'SF1');
    assert.equal(g.bracketId, 'b1');
    assert.equal(g.homeScore, 7);
    assert.equal(g.awayScore, 2);
    assert.equal(g.durationMinutes, 75);
    assert.equal(g.isPlayoff, true);
  });
});
