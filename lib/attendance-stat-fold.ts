// The team-wide attendance roll-up's arithmetic, split out of lib/db.ts so a unit test can run it on a roster big enough to pass a
// single read's 1,000-row cut-off (One attendance record, S3 step 1). Pure: it takes the rows the paged read returned.
//
// ⚠ It counts through `classifyAttendanceMark` — the SAME rule the receipts and the month chart use — so "known" and "attended" are
// one definition across the three, not three that "must never quietly disagree" (the old inline twin in db.ts said exactly that).
//
// Relative import WITH the .ts extension so the unit tests run under plain `node --test`.
import { classifyAttendanceMark } from './coach-attendance-receipts.ts';
import type { RepAttendanceStatus } from './types.ts';

export interface AttendanceStatTally {
  attended: number; // showed up (attending OR late)
  known: number;    // a definite yes/no — the fair denominator
  recorded: number; // every counted event, incl. no-reply and a standing Maybe
}

export interface AttendanceReliabilityEntry {
  playerId: string;
  games: AttendanceStatTally;
  practices: AttendanceStatTally;
}

/** One row of the stats read: the answer, and the event it belongs to. */
export interface AttendanceStatRow {
  player_id: string;
  status: RepAttendanceStatus;
  rep_team_events: { event_type: string } | null;
}

const blankTally = (): AttendanceStatTally => ({ attended: 0, known: 0, recorded: 0 });

/** Per-player games / practices tallies. An event that is neither (a team event) is skipped. */
export function foldAttendanceReliability(
  rows: readonly AttendanceStatRow[],
  gameTypes: readonly string[],
): Map<string, AttendanceReliabilityEntry> {
  const byPlayer = new Map<string, AttendanceReliabilityEntry>();
  for (const r of rows) {
    const ev = r.rep_team_events;
    if (!ev) continue;
    const isGame = gameTypes.includes(ev.event_type);
    if (!isGame && ev.event_type !== 'practice') continue;

    let entry = byPlayer.get(r.player_id);
    if (!entry) {
      entry = { playerId: r.player_id, games: blankTally(), practices: blankTally() };
      byPlayer.set(r.player_id, entry);
    }
    const bucket = isGame ? entry.games : entry.practices;
    bucket.recorded++;
    const { known, attended } = classifyAttendanceMark(r.status);
    if (known) bucket.known++;
    if (attended) bucket.attended++;
  }
  return byPlayer;
}
