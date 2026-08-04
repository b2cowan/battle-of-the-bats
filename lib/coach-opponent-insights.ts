/**
 * lib/coach-opponent-insights.ts
 * "The numbers vs them" — auto-insights derived at read time from data already stored
 * (plan §4.6, mockup 5a). Pure computation, no I/O; the card route assembles the inputs.
 *
 * The honesty rule (the Ask-the-Front-Office precedent) governs every line: each one is
 * provable from records the card itself shows, carries a "from N games" provenance count,
 * and is ABSENT below its confidence floor — never hedged, never padded. Floors:
 * ≥3 counted meetings for the record-derived lines, ≥2 saved lineups vs them for the
 * lineup-join lines.
 */
import { tallyResults, formatRecord } from './coach-season-record';
import type { OpponentMeeting } from './coach-opponents';

export interface OpponentInsightLine {
  id: string;
  text: string;
  /** Provenance: how many games this line is computed from. */
  fromGames: number;
}

/** The slice of a saved lineup entry the insights need (subset of RepTeamLineupEntry). */
export interface InsightLineupEntry {
  playerId: string;
  starter: boolean;
  /** inning/period number (as string) → position code. */
  inningPositions: Record<string, string>;
}

const MEETING_FLOOR = 3;
const LINEUP_FLOOR = 2;

export function computeOpponentInsights(opts: {
  meetings: OpponentMeeting[];
  /** The live season's program year id — the "this season" split. */
  activeYearId: string | null;
  /** Sport-pack score unit, plural ("Runs"). Lower-cased into sentences here. */
  unitPlural: string;
  /** Sport-pack pitcher position code + its prose label; null = sport has no such role. */
  pitcherPosition: string | null;
  pitcherPositionLabel: string | null;
  /** Sport-pack on-field position codes; empty = any assigned position counts as fielded. */
  fieldPositions: string[];
  /** Saved lineups by event id, for the meetings' games (absent = no lineup saved). */
  lineups: Record<string, InsightLineupEntry[]>;
  /** Player id → display name, for the lineup lines. */
  playerNames: Record<string, string>;
}): OpponentInsightLine[] {
  const { meetings, activeYearId, pitcherPosition, pitcherPositionLabel, fieldPositions, lineups, playerNames } = opts;
  const unit = opts.unitPlural.toLowerCase();
  const lines: OpponentInsightLine[] = [];

  // `counted` follows the wrapped rule via the meeting's own flag — scrimmages and
  // undecided games can never leak into a number here.
  const counted = meetings.filter(m => m.counted);
  const scored = counted.filter(m => m.teamScore != null && m.opponentScore != null);

  if (counted.length >= MEETING_FLOOR) {
    // Home/away split — only when it IS a split; "3–0, all at home" is the record chip again.
    const home = counted.filter(m => m.homeAway === 'home');
    const away = counted.filter(m => m.homeAway === 'away');
    if (home.length > 0 && away.length > 0) {
      lines.push({
        id: 'home_away',
        text: `${formatRecord(tallyResults(home))} at home · ${formatRecord(tallyResults(away))} away`,
        fromGames: home.length + away.length,
      });
    }

    // This season vs all-time — only when there IS history beyond this season.
    if (activeYearId) {
      const season = counted.filter(m => m.programYearId === activeYearId);
      if (season.length > 0 && season.length < counted.length) {
        lines.push({
          id: 'season_split',
          text: `${formatRecord(tallyResults(season))} this season · ${formatRecord(tallyResults(counted))} all-time`,
          fromGames: counted.length,
        });
      }
    }

    if (scored.length >= MEETING_FLOOR) {
      const avg = (pick: (m: OpponentMeeting) => number) =>
        (scored.reduce((s, m) => s + pick(m), 0) / scored.length).toFixed(1);
      lines.push({
        id: 'averages',
        text: `Averages ${avg(m => m.teamScore as number)} ${unit} for, ${avg(m => m.opponentScore as number)} against`,
        fromGames: scored.length,
      });

      // Closeness flag — every meeting must have a score, or "all" would be a lie.
      if (scored.length === counted.length && scored.every(m => Math.abs((m.teamScore as number) - (m.opponentScore as number)) <= 2)) {
        lines.push({
          id: 'closeness',
          text: `All ${counted.length} meetings decided by 2 ${unit} or fewer`,
          fromGames: counted.length,
        });
      }

      const margin = (m: OpponentMeeting) => (m.teamScore as number) - (m.opponentScore as number);
      const wins = scored.filter(m => m.result === 'win');
      const losses = scored.filter(m => m.result === 'loss');
      const extremes: string[] = [];
      if (wins.length > 0) {
        const best = wins.reduce((a, b) => (margin(b) > margin(a) ? b : a));
        extremes.push(`Biggest win ${best.teamScore}–${best.opponentScore}`);
      }
      if (losses.length > 0) {
        const worst = losses.reduce((a, b) => (margin(b) < margin(a) ? b : a));
        extremes.push(`worst loss ${worst.teamScore}–${worst.opponentScore}`);
      }
      if (extremes.length > 0) {
        lines.push({ id: 'extremes', text: extremes.join(' · '), fromGames: scored.length });
      }
    }
  }

  // ── "What worked" — joins their meetings to OUR saved lineups (self-scouting) ──
  const withLineup = counted.filter(m => (lineups[m.eventId] ?? []).length > 0);
  if (withLineup.length >= LINEUP_FLOOR) {
    const wins = withLineup.filter(m => m.result === 'win');
    const losses = withLineup.filter(m => m.result === 'loss');
    const isFielded = fieldPositions.length > 0
      ? (pos: string) => fieldPositions.includes(pos)
      : (pos: string) => pos.length > 0;

    // Each meeting's lineup is scanned ONCE into the two sets the questions below ask
    // about — not rebuilt inside every `.every()` pass.
    const openedAtPitcher = new Map<string, Set<string>>();
    const fielded = new Map<string, Set<string>>();
    for (const m of withLineup) {
      const entries = lineups[m.eventId] ?? [];
      openedAtPitcher.set(m.eventId, new Set(
        entries.filter(e => pitcherPosition != null && e.inningPositions['1'] === pitcherPosition).map(e => e.playerId),
      ));
      fielded.set(m.eventId, new Set(
        entries.filter(e => Object.values(e.inningPositions).some(isFielded)).map(e => e.playerId),
      ));
    }
    const pitcherIn = (m: OpponentMeeting) => openedAtPitcher.get(m.eventId) ?? new Set<string>();
    const fieldedIn = (m: OpponentMeeting) => fielded.get(m.eventId) ?? new Set<string>();

    // The pitcher pattern (pitcher-position sports only): someone who opened at the pitcher
    // position in EVERY win and NEVER in a loss. Needs both sides of the contrast to exist.
    if (pitcherPosition && pitcherPositionLabel && wins.length >= 2 && losses.length >= 1) {
      const inEveryWin = [...pitcherIn(wins[0])]
        .filter(id => wins.every(w => pitcherIn(w).has(id)))
        .filter(id => losses.every(l => !pitcherIn(l).has(id)))
        .map(id => playerNames[id])
        .filter((name): name is string => !!name)
        .sort();
      if (inEveryWin.length > 0) {
        const winWord = wins.length === 2 ? 'both wins' : `all ${wins.length} wins`;
        const lossWord = losses.length === 1 ? 'the loss' : 'the losses';
        lines.push({
          id: 'pitcher_pattern',
          text: `In ${winWord}, ${inEveryWin[0]} started at ${pitcherPositionLabel}; in ${lossWord} they didn’t`,
          fromGames: wins.length + losses.length,
        });
      }
    }

    // Rotation depth: players who saw the field in every win.
    if (wins.length >= 2) {
      const everyWin = [...fieldedIn(wins[0])].filter(id => wins.every(w => fieldedIn(w).has(id)));
      if (everyWin.length > 0) {
        lines.push({
          id: 'fielded_every_win',
          text: `${everyWin.length} player${everyWin.length === 1 ? '' : 's'} saw the field in every win`,
          fromGames: wins.length,
        });
      }
    }
  }

  return lines;
}
