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
 */

/** One player's attendance tallies for a bucket (games or practices). */
export interface RecapAttendanceInput {
  attended: number;
  /** attended + absent. A no-reply is never counted against a child. */
  known: number;
  /** Rows recorded at all, including no-replies — how we tell "never tracked" from "0%". */
  recorded: number;
}

/** A development focus area the coach logged for this player. */
export interface RecapGoalInput {
  focusArea: string;
  status: 'working' | 'achieved' | 'parked';
}

/** One measurable reading. `recordedOn` is a plain calendar date (YYYY-MM-DD). */
export interface RecapMeasurableInput {
  /**
   * The measurable TYPE's id — the grouping key.
   *
   * ⚠ NOT the name. Type names are unique only among ACTIVE types (`rep_team_measurable_types`
   * carries a partial unique index on `lower(name) WHERE is_active`), so a coach who retires
   * "Sprint" and later creates a new "Sprint" has two genuinely different tests wearing one
   * label. Grouping by name would splice them into a single before/after and show a family a
   * change that never happened.
   */
  typeId: string;
  typeName: string;
  value: number;
  unit: string;
  recordedOn: string;
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
  measurables: RecapMeasurableInput[];
  awards: RecapAwardInput[];
  playingTime: RecapPlayingTimeInput | null;
}

/** One test, first reading to latest — stated as a CHANGE, never judged as an improvement. */
export interface RecapMeasurableTrend {
  typeName: string;
  unit: string;
  firstValue: number;
  firstOn: string;
  latestValue: number;
  latestOn: string;
  /** How many readings the coach logged for this test. ≥2 by construction. */
  readings: number;
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
  /** What the coach worked on. Null when no focus area was ever logged for this player. */
  workedOn: {
    focusAreas: { focusArea: string; status: 'working' | 'achieved' | 'parked' }[];
    /**
     * Tests with at least TWO readings, so a change can be stated as a fact.
     *
     * ⚠ NEVER labelled an improvement. A coach's test type carries a name and a free-text
     * unit and nothing else — the product has no idea whether lower is better for "seconds",
     * "reps" or "mph". Rendering an arrow or a colour here would be the recap inventing a
     * judgement it has no basis for. First reading → latest reading, and the family (who
     * knows the sport) reads it.
     */
    trends: RecapMeasurableTrend[];
    /** Evaluation dates touched — "across N sessions" in the mockup. */
    sessionCount: number;
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

/** Sorts plain YYYY-MM-DD dates. String comparison is correct and timezone-free for this
 *  format — parsing them into Date objects is the repo's documented date trap. */
function byRecordedOn(a: RecapMeasurableInput, b: RecapMeasurableInput): number {
  return a.recordedOn.localeCompare(b.recordedOn);
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

  // ── Worked on this season (focus areas + measurable trends) ──
  let workedOn: PlayerSeasonRecapStats['workedOn'] = null;
  {
    // Keyed on the type ID — see `RecapMeasurableInput.typeId`. Two tests that happen to
    // share a name are two tests.
    const byType = new Map<string, RecapMeasurableInput[]>();
    for (const m of input.measurables) {
      let list = byType.get(m.typeId);
      if (!list) { list = []; byType.set(m.typeId, list); }
      list.push(m);
    }

    const trends: RecapMeasurableTrend[] = [];
    for (const readings of byType.values()) {
      if (readings.length < 2) continue; // one reading is a measurement, not a story
      const sorted = [...readings].sort(byRecordedOn);
      const first = sorted[0];
      const latest = sorted[sorted.length - 1];
      // Two readings on the SAME day are a repeat measurement, not a change over a season.
      if (first.recordedOn === latest.recordedOn) continue;
      // ⚠ The unit is snapshotted onto each reading AT LOG TIME, and a coach can edit a test's
      // unit mid-season. When the two ends of the trend were measured in different units,
      // "60 → 1" is not a change, it is a unit conversion wearing a change's clothes. There is
      // no honest way to state it, so the trend is dropped — the absent-not-wrong rule.
      if (first.unit !== latest.unit) continue;
      trends.push({
        typeName: latest.typeName,
        unit: latest.unit,
        firstValue: first.value,
        firstOn: first.recordedOn,
        latestValue: latest.value,
        latestOn: latest.recordedOn,
        readings: sorted.length,
      });
    }
    trends.sort((a, b) => a.typeName.localeCompare(b.typeName));

    const focusAreas = input.goals.map(g => ({ focusArea: g.focusArea, status: g.status }));
    const sessionCount = new Set(input.measurables.map(m => m.recordedOn)).size;

    // The block exists only if the coach put something in it. A player with goals but no
    // readings gets the goals; a player with readings but no goals gets the trends; a player
    // with neither has no "worked on this season" heading at all.
    if (focusAreas.length > 0 || trends.length > 0) {
      workedOn = { focusAreas, trends, sessionCount };
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
