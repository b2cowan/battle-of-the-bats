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

  test('the Schedule wears health as its header button, opening the one window — never a row at the day\'s foot', () => {
    assert.match(SCHEDULE, /<HealthButton\s+data-sandbox-tour="schedule-health"/, 'the button carries the tour anchor literally');
    assert.doesNotMatch(SCHEDULE, /<HealthRow\b/, 'the foot row is gone');
    assert.match(SCHEDULE, /const \[healthOpen, setHealthOpen\] = useState\(false\);/, 'the window never arrives open, the demo included');
    const WINDOW = read('app/[orgSlug]/admin/tournaments/schedule/components/ScheduleHealthWindow.tsx');
    assert.match(WINDOW, /<KitDialog kind="form" size="wide"[^>]*dirty=\{dirty\}/, 'the one form window; unsaved rules ask first');
    assert.match(SCHEDULE, /<ScheduleHealthWindow[\s\S]{0,200}dirty=\{healthRulesDirty\}/);
  });

  test('the dashboard opens the SAME window, from both boards — never its own panel in place (owner 2026-10-19, A5)', () => {
    const PAGE = read('app/[orgSlug]/admin/tournaments/dashboard/page.tsx');
    const GAME_DAY = read('app/[orgSlug]/admin/tournaments/dashboard/GameDayBoard.tsx');
    const WEEKS = read('app/[orgSlug]/admin/tournaments/dashboard/WeeksBeforeBoard.tsx');
    const LOADER = read('app/[orgSlug]/admin/tournaments/schedule/components/TournamentHealthWindow.tsx');
    assert.match(PAGE, /<TournamentHealthWindow\b/);
    assert.doesNotMatch(PAGE, /renderScheduleHealthBody|healthBody=/, "the board's own copy of the panel is gone");
    assert.match(GAME_DAY, /onOpen=\{onOpenHealth\}/);
    assert.match(WEEKS, /as="button" onClick=\{onOpenHealth\}/);
    assert.match(LOADER, /buildEventScheduleHealth\(/, 'the one number');
    assert.match(LOADER, /<ScheduleHealthWindow\b/, 'the one window');
    assert.match(LOADER, /useScheduleHealthRules\(/, 'the one copy of the rules');
    assert.match(SCHEDULE, /useScheduleHealthRules\(/);
    assert.match(SCHEDULE, /searchParams\.get\('show'\)/, '"Show them" from the dashboard lands filtered');
  });

  test('the window\'s rules door ends its body (A3); the panel\'s gear keeps its editor on top', () => {
    const BODY = read('app/[orgSlug]/admin/tournaments/schedule/components/ScheduleHealthPanel.tsx');
    const content = BODY.indexOf('<ScheduleHealthContent metrics={metrics}');
    assert.ok(content > 0);
    assert.ok(BODY.indexOf('className={styles.healthRulesFoot}') > content, 'the door comes after the figures and issues');
    assert.ok(BODY.indexOf('{rulesAtEnd && editor}') > content);
    assert.ok(BODY.indexOf('{!rulesAtEnd && editor}') < content);
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
