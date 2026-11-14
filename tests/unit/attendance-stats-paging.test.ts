/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ATTENDANCE STATS READ EVERY ROW (One attendance record, S3 step 1, owner-approved 2026-11-14)
 *
 * A Supabase select stops at 1,000 rows WITHOUT AN ERROR. The three attendance stat reads (the per-player summary, the team
 * roll-up behind the Roster → Attendance totals, and the marks read behind the receipts and the month chart) were single selects,
 * so a team with ~25 players × 40+ started events lost every row past the thousandth — and, with no ORDER BY, could lose DIFFERENT
 * rows in each read, so a total, a receipt list and a chart could quietly disagree.
 *
 * Two things are protected:
 *   1. SOURCE — all three reads go through ONE helper that carries the STARTED bound AND pages with a stable order.
 *   2. BEHAVIOUR — on a roster big enough to pass 1,000 rows, the totals, the receipts and the month chart agree.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fetchAll } from '../../lib/supabase-paging.ts';
import { foldAttendanceReliability, type AttendanceStatRow } from '../../lib/attendance-stat-fold.ts';
import { computeAttendanceReceipts, type AttendanceMarkRecord } from '../../lib/coach-attendance-receipts.ts';
import { computeMonthlyAttendance } from '../../lib/coach-monthly-attendance.ts';
import type { RepAttendanceStatus } from '../../lib/types.ts';
import { between, readCode } from './_source-code.ts';

// Comments stripped first (the repo's guard idiom): a comment that merely describes the old design can neither satisfy nor trip these.
const DB = readCode('lib/db.ts');

const THREE_READS = ['getRepPlayerAttendanceSummary', 'getRepTeamAttendanceReliability', 'getRepTeamAttendanceMarks'];

describe('the three attendance stat reads share one bounded, paged read', () => {
  const helper = between(DB, 'async function readStartedAttendanceRows<', '\n}\n');

  it('the helper carries the started bound, the cancelled-event exclusion, paging and a stable order', () => {
    assert.match(helper, /fetchAll</, 'a stat read that is not paged stops silently at 1,000 rows');
    assert.match(helper, /\.lte\('rep_team_events\.starts_at', now\)/, 'the STARTED bound (ruling: started events only)');
    assert.match(helper, /\.eq\('rep_team_events\.status', 'scheduled'\)/, 'cancelled events never count');
    assert.match(helper, /\.order\('id', \{ ascending: true \}\)\s*\.range\(from, to\)/, 'a stable order under .range(), or pages skip and repeat rows');
    // One instant for every page: reading the clock inside the page builder would let a long read straddle an event's start.
    assert.match(helper, /const now = new Date\(\)\.toISOString\(\);\s*return fetchAll/, 'the bound is taken ONCE, before the pages');
  });

  for (const name of THREE_READS) {
    it(`${name} reads through the helper and never opens its own unbounded select`, () => {
      const body = between(DB, `export async function ${name}(`, '\n}\n');
      assert.match(body, /readStartedAttendanceRows(<\w+>)?\(/, `${name} must use the shared bounded, paged read`);
      assert.doesNotMatch(body, /supabaseAdmin/, `${name} must not open a second, unpaged select on the book`);
    });
  }

  it('only the helper reads the attendance book for the stats (no fourth single select slips in beside it)', () => {
    const region = between(DB, 'export interface RepPlayerAttendanceSummary', 'export interface RepPlayerDuesSummary');
    assert.equal((region.match(/\.from\('rep_team_event_attendance'\)/g) ?? []).length, 1, 'one read of the book in the stats region');
  });
});

describe('a roster past 1,000 rows: totals, receipts and the month chart agree', () => {
  // 30 players × 45 started events (30 practices + 15 games) = 1,350 rows — past one select's 1,000-row cut-off.
  const PLAYERS = Array.from({ length: 30 }, (_, i) => `p${String(i).padStart(2, '0')}`);
  const EVENTS = Array.from({ length: 45 }, (_, i) => ({
    id: `e${String(i).padStart(2, '0')}`,
    type: i % 3 === 0 ? 'league_game' : 'practice',
    // one event a week, three months — both an early and a late month are present, so a truncated read is visible on the chart
    day: new Date(Date.UTC(2026, 3, 1 + i * 3)).toISOString().slice(0, 10),
  }));
  const STATUSES: RepAttendanceStatus[] = ['attending', 'late', 'absent', 'unknown', 'attending', 'maybe' as RepAttendanceStatus];

  const book = PLAYERS.flatMap((p, pi) =>
    EVENTS.map((ev, ei) => ({
      id: `${String(pi).padStart(3, '0')}-${String(ei).padStart(3, '0')}`,
      player_id: p,
      status: STATUSES[(pi + ei) % STATUSES.length],
      rep_team_events: { id: ev.id, event_type: ev.type, starts_at: `${ev.day}T18:00:00Z` },
    })),
  ).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(book.length, 1350);

  /** A server that does what Supabase does: honours .range() but never returns more than 1,000 rows, with no error. */
  const server = (from: number, to: number) => {
    const wanted = book.slice(from, to + 1);
    return Promise.resolve({ data: wanted.slice(0, 1000), error: null });
  };

  it('the fake server really does stop at 1,000 (so the test could catch the bug)', async () => {
    const single = await server(0, 99_999);
    assert.equal((single.data as unknown[]).length, 1000);
  });

  it('fetchAll gets every row the book holds', async () => {
    const rows = await fetchAll<(typeof book)[number]>(server);
    assert.equal(rows.length, 1350);
    assert.equal(new Set(rows.map(r => r.id)).size, 1350, 'no row repeated or skipped between pages');
  });

  it('the roll-up totals, the receipt lists and the month chart count the same marks', async () => {
    const rows = await fetchAll<(typeof book)[number]>(server);
    const totals = foldAttendanceReliability(rows as unknown as AttendanceStatRow[], ['league_game', 'tournament_game', 'external_tournament']);

    const records: AttendanceMarkRecord[] = rows.map(r => ({
      eventId: r.rep_team_events.id,
      day: r.rep_team_events.starts_at.slice(0, 10),
      label: r.rep_team_events.event_type === 'practice' ? 'Practice' : 'Game',
      kind: r.rep_team_events.event_type === 'practice' ? 'practice' : 'game',
      playerId: r.player_id,
      status: r.status,
    }));
    const receipts = computeAttendanceReceipts({ records, players: PLAYERS.map(id => ({ id })) });
    const months = computeMonthlyAttendance(records.map(r => ({ month: r.day.slice(0, 7), kind: r.kind, status: r.status })));

    // Every row reached every consumer.
    const recordedTotal = [...totals.values()].reduce((n, t) => n + t.games.recorded + t.practices.recorded, 0);
    assert.equal(recordedTotal, 1350);
    const chartRecorded = months.reduce((n, m) => n + m.games.recorded + m.practices.recorded, 0);
    assert.equal(chartRecorded, 1350, 'the month chart counts the same marks as the totals');

    // Per player: an absence on the roll-up is a line on the receipt (known − attended = absent).
    for (const p of PLAYERS) {
      const t = totals.get(p)!;
      const absentOnTotals = (t.games.known - t.games.attended) + (t.practices.known - t.practices.attended);
      assert.equal(receipts.get(p)!.absences.length, absentOnTotals, `${p}: receipts and totals disagree`);
    }

    // And across the team: chart attended/known equal the totals' sums.
    const sum = (pick: (t: ReturnType<typeof totals.get> & object) => number) => [...totals.values()].reduce((n, t) => n + pick(t), 0);
    assert.equal(months.reduce((n, m) => n + m.games.attended + m.practices.attended, 0), sum(t => t.games.attended + t.practices.attended));
    assert.equal(months.reduce((n, m) => n + m.games.known + m.practices.known, 0), sum(t => t.games.known + t.practices.known));
  });

  it('a standing Maybe counts as Not marked: recorded, never known, never attended (ruling 2)', () => {
    const t = foldAttendanceReliability(
      [{ player_id: 'x', status: 'maybe' as RepAttendanceStatus, rep_team_events: { event_type: 'practice' } }],
      ['league_game'],
    ).get('x')!;
    assert.deepEqual(t.practices, { attended: 0, known: 0, recorded: 1 });
  });
});
