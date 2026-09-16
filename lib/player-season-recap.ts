/**
 * lib/player-season-recap.ts
 * Pure per-player season recap computation (Chunk D slice 3, item 3.2). No I/O, unit-tested —
 * the server assembly lives in lib/rep-player-season-recap.ts.
 *
 * This is the per-player sibling of `lib/season-wrapped.ts`, and it inherits that file's
 * honesty rule with the volume turned up, because this one is about somebody's child:
 *
 *   ⚠ A BLOCK THIS FILE CANNOT FILL FROM RECORDED DATA IS ABSENT, NOT EMPTY.
 *
 * Absent means `null`, and a null block renders nothing at all — no placeholder, no "no data
 * yet", no encouraging sentence. Two failures are equally bad and this file exists to prevent
 * both: telling a family something that did not happen, and implying the coach neglected
 * something because a section they never used renders as a gap.
 *
 * ⚠ THERE ARE NO PER-PLAYER GAME STATISTICS AND THERE CANNOT BE. The platform captures
 * team-level scores only (discovery G2, re-verified at build time), and capturing per-player
 * in-game stats is forbidden by owner ruling 3. This is a GROWTH recap — attendance, what the
 * coach worked on, awards, playing time, the team's season — which is the differentiated
 * version, not a consolation prize. Do not add a stats block.
 *
 * ⚠ THE RECAP IS THE SECOND FAMILY SURFACE FOR DEVELOPMENT (re-evaluation stage 4, owner ruling
 * G6, 2026-09-16) — the handout is the first. Its "Worked on this season" tile reads each test
 * through `progressSeries`, the one series the chart, the Player progress report and the handout
 * read: the headline per result, the change in words, "N results". It was the seventh reader of a
 * child's sprint and the only one not through the module — the only one that could disagree.
 */
import { progressSeries, type ReportDefinition } from './development-report.ts';
import type { AttemptReading } from './measurable-series.ts';

/** One player's attendance tallies for a bucket (games or practices). */
export interface RecapAttendanceInput {
  attended: number;
  /** attended + absent. A no-reply is never counted against a child. */
  known: number;
  /** Rows recorded at all, including no-replies — how we tell "never tracked" from "0%". */
  recorded: number;
}

/** A development goal the coach set with this player. */
export interface RecapGoalInput {
  focusArea: string;
  status: 'working' | 'achieved' | 'parked';
}

/**
 * One TEST the player has results under, as the reports read it (re-evaluation stage 4, owner
 * ruling G6, 2026-09-16): the definition — its aim, headline and range, which decide what the line
 * follows — and the player's every attempt under it, any order. The recap builds each test's line
 * through `progressSeries`, the ONE series the chart, the Player progress report and the handout
 * read, so the keepsake and the paper cannot disagree about a child's number.
 *
 * ⚠ The definition's ID is the grouping key, NOT the name. Type names are unique only among ACTIVE
 * types (`rep_team_measurable_types` carries a partial unique index on `lower(name) WHERE
 * is_active`), so a coach who retires "Sprint" and later creates a new "Sprint" has two genuinely
 * different tests wearing one label. Grouping by name would splice them into a single before/after
 * and show a family a change that never happened.
 */
export interface RecapTestInput {
  def: ReportDefinition;
  readings: AttemptReading[];
}

export interface RecapAwardInput {
  name: string;
  emoji: string | null;
  /** A plain calendar date (YYYY-MM-DD) — `rep_player_awards.awarded_at` is a DATE, not an
   *  instant. Parsing it into a Date to sort would read it as UTC midnight, which is the
   *  repo's documented date trap; string comparison is correct and timezone-free here. */
  awardedAt: string;
}

/** This player's share of the season's field/bench innings, and the team's median for scale. */
export interface RecapPlayingTimeInput {
  fieldInnings: number;
  benchInnings: number;
  gamesWithLineup: number;
  /** Every rostered player's field innings this season, INCLUDING this player's. */
  teamFieldInnings: number[];
}

export interface PlayerSeasonRecapInput {
  attendanceGames: RecapAttendanceInput;
  attendancePractices: RecapAttendanceInput;
  goals: RecapGoalInput[];
  tests: RecapTestInput[];
  awards: RecapAwardInput[];
  playingTime: RecapPlayingTimeInput | null;
}

/**
 * One test, the first result to the latest — in the paper's own words (G6): stated as a CHANGE,
 * never judged as an improvement. "60-yd sprint · 8.62 → 8.28 seconds · 0.34 seconds lower since
 * 6 May · 4 results"; a range test "2 of 3 in range · moved into the range since 27 May (0 of 3)".
 * Every string comes from the series module, so the family's line and the coach's chart agree to
 * the decimal.
 */
export interface RecapMeasurableTrend {
  typeName: string;
  /** "8.62 → 8.28 seconds" — the first and latest points' headlines; a range test, the latest's "2 of 3 in range". */
  line: string;
  /** The change in words — `statedChange`: arithmetic in the unit, or the range's "moved into …"; never a verdict. */
  change: string | null;
  firstOn: string;
  latestOn: string;
  /** Points on the line — RESULTS (a session's or a day's attempts are one), never attempts. ≥2 by construction. */
  results: number;
}

export interface PlayerSeasonRecapStats {
  /**
   * Attendance across games AND practices, known responses only. Null when the coach never
   * recorded attendance for this player — which is different from 0%, and must read that way.
   */
  attendance: {
    pct: number;
    attended: number;
    known: number;
    games: { attended: number; known: number } | null;
    practices: { attended: number; known: number } | null;
  } | null;
  /** What the coach worked on. Null when nothing that prints was ever logged for this player. */
  workedOn: {
    /**
     * Goals by ONE rule (G6): a goal being worked on and a goal achieved print with their status
     * word — a goal is set WITH the player, and the recap is a keepsake. A PARKED goal does not:
     * on a season keepsake it reads as a failure. Observations stay off the recap.
     */
    focusAreas: { focusArea: string; status: 'working' | 'achieved' }[];
    /**
     * Tests with at least TWO results on the line, so a change can be stated as a fact — through
     * the same series the coach's chart and the handout read (G6).
     *
     * ⚠ NEVER labelled an improvement. The change is `statedChange`'s arithmetic in the unit
     * ("0.34 seconds lower since 6 May") or the range's "moved into the range" — never faster,
     * better or an arrow. The family (who knows the sport) reads it.
     */
    trends: RecapMeasurableTrend[];
  } | null;
  /** Awards earned, newest first. Null when none — never "0 awards". */
  awards: { count: number; items: RecapAwardInput[] } | null;
  /**
   * Playing time, expressed against the TEAM's own band rather than as a raw number a family
   * has no scale for. Null when no lineup was ever set: a coach who does not use the lineup
   * tool has not given the product an opinion about playing time, and it must not invent one.
   */
  playingTime: {
    fieldInnings: number;
    gamesWithLineup: number;
    /** Where this player sits against the roster's median field innings. */
    band: 'in_band' | 'above_band' | 'below_band';
  } | null;
}

/** Within ±20% of the roster median reads as "in the team's typical range". Deliberately
 *  generous: this number goes to a parent, and a rotation is not a stopwatch. */
const BAND_TOLERANCE = 0.2;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computePlayerSeasonRecap(input: PlayerSeasonRecapInput): PlayerSeasonRecapStats {
  // ── Attendance (games + practices together; no-replies excluded from the rate) ──
  let attendance: PlayerSeasonRecapStats['attendance'] = null;
  {
    const g = input.attendanceGames;
    const p = input.attendancePractices;
    const known = g.known + p.known;
    const recorded = g.recorded + p.recorded;
    // `known === 0` with rows recorded means every single one was a no-reply — a real state,
    // and one where a percentage would be a lie in either direction. Absent, not zero.
    if (recorded > 0 && known > 0) {
      const attended = g.attended + p.attended;
      attendance = {
        pct: Math.round((attended / known) * 100),
        attended,
        known,
        games: g.known > 0 ? { attended: g.attended, known: g.known } : null,
        practices: p.known > 0 ? { attended: p.attended, known: p.known } : null,
      };
    }
  }

  // ── Worked on this season (the goals that print + one line per test, through the one series) ──
  let workedOn: PlayerSeasonRecapStats['workedOn'] = null;
  {
    const trends: RecapMeasurableTrend[] = [];
    for (const { def, readings } of input.tests) {
      // The paper's own reading of the record: the headline per result, this season, in the
      // test's one unit (fixed once a result exists — a unit that differed between two ends of
      // the line cannot happen any more, so nothing here checks for it).
      const series = progressSeries(readings, def, { show: 'headline', compare: 'season' });
      const first = series.points[0];
      const latest = series.points[series.points.length - 1];
      // One result is a measurement, not a story — and a session's three attempts, or a day's from
      // the bench, are ONE result here as they are everywhere (correct by construction: the old
      // "two readings on one day" rule is what `groupBySession` does).
      if (!first || first === latest) continue;
      trends.push({
        typeName: def.name,
        line: series.band ? latest.label : `${first.label} → ${latest.label} ${series.unit}`,
        change: series.change,
        firstOn: first.row.recordedOn,
        latestOn: latest.row.recordedOn,
        results: series.points.length,
      });
    }
    trends.sort((a, b) => a.typeName.localeCompare(b.typeName));

    // Goals by one rule: working and achieved print; parked does not (G6).
    const focusAreas = input.goals.flatMap(g => (g.status === 'parked' ? [] : [{ focusArea: g.focusArea, status: g.status }]));

    // The block exists only if the coach put something in it that prints. A player with goals but
    // no results gets the goals; a player with results but no goals gets the lines; a player with
    // neither has no "worked on this season" heading at all.
    if (focusAreas.length > 0 || trends.length > 0) {
      workedOn = { focusAreas, trends };
    }
  }

  // ── Awards ──
  const sortedAwards = [...input.awards]
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt));
  const awards = sortedAwards.length > 0
    ? { count: sortedAwards.length, items: sortedAwards }
    : null;

  // ── Playing time, against the team's own band ──
  let playingTime: PlayerSeasonRecapStats['playingTime'] = null;
  {
    const pt = input.playingTime;
    // No lineup was ever set (or this player was never placed in one) ⇒ the product has no
    // opinion to offer. A "0 innings" line would read as a benched season, which it is not.
    if (pt && pt.gamesWithLineup > 0 && pt.teamFieldInnings.length > 0
        && (pt.fieldInnings > 0 || pt.benchInnings > 0)) {
      const mid = median(pt.teamFieldInnings);
      const tolerance = mid * BAND_TOLERANCE;
      const band: 'in_band' | 'above_band' | 'below_band' =
        mid === 0 ? 'in_band'
          : pt.fieldInnings > mid + tolerance ? 'above_band'
            : pt.fieldInnings < mid - tolerance ? 'below_band'
              : 'in_band';
      playingTime = { fieldInnings: pt.fieldInnings, gamesWithLineup: pt.gamesWithLineup, band };
    }
  }

  return { attendance, workedOn, awards, playingTime };
}

/** True when the recap has nothing truthful to say. The surface shows an honest "the season's
 *  record is thin" state rather than a hero with four missing blocks under it. */
export function isRecapEmpty(stats: PlayerSeasonRecapStats): boolean {
  return !stats.attendance && !stats.workedOn && !stats.awards && !stats.playingTime;
}
