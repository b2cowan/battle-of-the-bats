// Pure, testable season roll-up of a team's SAVED lineups. No I/O, no React. Every figure is
// derived only from lineups the coach actually saved (games without a saved lineup, or players who
// never appear, simply don't contribute) — so the UI can present it honestly with no invented rows.
// Relative WITH the .ts extension (not `@/`) so the unit tests can run under plain
// `node --test`, which resolves neither the tsconfig path alias nor extension-less
// ESM specifiers (tsconfig has allowImportingTsExtensions).
import { analyzeLineup } from './lineup-analysis.ts';

export interface SeasonLineupInput {
  eventId: string;
  lineupMode: string;
  inningCount: number;
  entries: { playerId: string; battingOrder: number | null; inningPositions: Record<string, string> }[];
}
export interface SeasonPlayer {
  id: string;
  name: string;
  isPitcher: boolean;
  /** Per-game arm-care cap (max innings pitched in ONE game); null = use season default. */
  pitcherCap: number | null;
}
export interface SeasonEventScore {
  eventId: string;
  teamScore: number | null;
  opponentScore: number | null;
}
export interface SeasonTemplate { name: string; battingOrderPlayerIds: string[] }

export interface FairPlayRow { playerId: string; name: string; fieldInnings: number; benchInnings: number; games: number }
export interface BenchBalanceRow { playerId: string; name: string; benchInnings: number; backToBackGames: number }
export interface PositionVarietyRow { playerId: string; name: string; positions: string[]; count: number }
export interface ArmCareRow { playerId: string; name: string; inningsPitched: number; gamesPitched: number; perGameCap: number | null; overCapGames: number }
export interface ReusedLineupRow { label: string; games: number; scoredGames: number; wins: number; losses: number; ties: number }

export interface SeasonLineupAnalytics {
  gamesWithLineup: number;
  fairPlay: FairPlayRow[];
  benchBalance: BenchBalanceRow[];
  positionVariety: PositionVarietyRow[];
  armCare: ArmCareRow[];
  reusedLineups: ReusedLineupRow[];
}

// Ordered batting-order signature = the players in batting order, joined. Only meaningful when a
// batting order is set (everyone_bats: all; nine_player: the 9 starters). '' when none. Well-defined
// because the DB enforces UNIQUE(lineup_id, player_id) + partial-unique (lineup_id, batting_order)
// (mig 070), so within a lineup no player repeats and no two players share a batting slot.
function battingSignature(playerIdsByOrder: { playerId: string; battingOrder: number | null }[]): string {
  return playerIdsByOrder
    .filter(e => e.battingOrder != null)
    .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
    .map(e => e.playerId)
    .join('|');
}

export function computeSeasonLineupAnalytics(opts: {
  lineups: SeasonLineupInput[];
  scores: SeasonEventScore[];
  players: SeasonPlayer[];
  pitcherPosition: string | null;
  seasonPitcherCap: number | null;
  templates: SeasonTemplate[];
  fieldPositions: string[];
}): SeasonLineupAnalytics {
  const { lineups, scores, players, pitcherPosition, seasonPitcherCap, templates, fieldPositions } = opts;
  const nameById = new Map(players.map(p => [p.id, p.name]));
  const pByos = pitcherPosition ?? '';
  const capOf = (id: string): number | null => {
    const p = players.find(pl => pl.id === id);
    return p?.pitcherCap ?? seasonPitcherCap ?? null;
  };

  type Agg = { field: number; bench: number; games: number; backToBack: number; positions: Set<string>; pitchInnings: number; pitchGames: number; overCap: number };
  const byPlayer = new Map<string, Agg>();
  const agg = (id: string): Agg => {
    let a = byPlayer.get(id);
    if (!a) { a = { field: 0, bench: 0, games: 0, backToBack: 0, positions: new Set(), pitchInnings: 0, pitchGames: 0, overCap: 0 }; byPlayer.set(id, a); }
    return a;
  };

  const scoreById = new Map(scores.map(s => [s.eventId, s]));
  const signatureEvents = new Map<string, string[]>(); // signature → eventIds
  let gamesWithLineup = 0;

  for (const lu of lineups) {
    const analysis = analyzeLineup(
      lu.entries.map(e => ({ playerId: e.playerId, inningPositions: e.inningPositions })),
      lu.inningCount, fieldPositions,
    );
    // A lineup counts only if it actually places players (has any on-field OR bench innings).
    const hasPlay = analysis.fairPlay.some(f => f.onField > 0 || f.benched > 0);
    if (!hasPlay) continue;
    gamesWithLineup++;

    for (const f of analysis.fairPlay) {
      const a = agg(f.playerId);
      a.field += f.onField;
      a.bench += f.benched;
      a.games += 1;
      if (f.consecutiveBench) a.backToBack += 1;
      for (const [pos, n] of Object.entries(f.positionCounts)) if (n > 0) a.positions.add(pos);
      const pInn = pByos ? (f.positionCounts[pByos] ?? 0) : 0;
      if (pInn > 0) {
        a.pitchInnings += pInn;
        a.pitchGames += 1;
        const cap = capOf(f.playerId);
        if (cap != null && pInn > cap) a.overCap += 1;
      }
    }

    const sig = battingSignature(lu.entries);
    if (sig) {
      const arr = signatureEvents.get(sig) ?? [];
      arr.push(lu.eventId);
      signatureEvents.set(sig, arr);
    }
  }

  const nm = (id: string) => nameById.get(id) ?? 'Unknown';

  const fairPlay: FairPlayRow[] = [...byPlayer.entries()]
    .map(([id, a]) => ({ playerId: id, name: nm(id), fieldInnings: a.field, benchInnings: a.bench, games: a.games }))
    .sort((x, y) => y.benchInnings - x.benchInnings || x.fieldInnings - y.fieldInnings);

  const benchBalance: BenchBalanceRow[] = [...byPlayer.entries()]
    .map(([id, a]) => ({ playerId: id, name: nm(id), benchInnings: a.bench, backToBackGames: a.backToBack }))
    .sort((x, y) => y.benchInnings - x.benchInnings || y.backToBackGames - x.backToBackGames);

  const positionVariety: PositionVarietyRow[] = [...byPlayer.entries()]
    .map(([id, a]) => {
      const positions = [...a.positions].filter(p => p && p !== 'Bench').sort();
      return { playerId: id, name: nm(id), positions, count: positions.length };
    })
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));

  // "Pitching LOAD" — only pitchers who actually threw an inning this season (a flagged pitcher who
  // never pitched has no load, so no row: keeps the panel to real data, no zero-inning filler).
  const armCare: ArmCareRow[] = [...byPlayer.entries()]
    .filter(([, a]) => a.pitchGames > 0)
    .map(([id, a]) => ({ playerId: id, name: nm(id), inningsPitched: a.pitchInnings, gamesPitched: a.pitchGames, perGameCap: capOf(id), overCapGames: a.overCap }))
    .sort((x, y) => y.inningsPitched - x.inningsPitched || y.overCapGames - x.overCapGames);

  // Records for batting orders run more than once, computed from real scores only.
  const templateBySig = new Map(templates.map(t => [t.battingOrderPlayerIds.join('|'), t.name]));
  const reusedLineups: ReusedLineupRow[] = [...signatureEvents.entries()]
    .filter(([, events]) => events.length >= 2)
    .map(([sig, events]) => {
      let wins = 0, losses = 0, ties = 0, scoredGames = 0;
      for (const ev of events) {
        const s = scoreById.get(ev);
        if (!s || s.teamScore == null || s.opponentScore == null) continue;
        scoredGames += 1;
        if (s.teamScore > s.opponentScore) wins += 1;
        else if (s.teamScore < s.opponentScore) losses += 1;
        else ties += 1;
      }
      const label = templateBySig.get(sig) ?? labelFromSignature(sig, nameById);
      return { label, games: events.length, scoredGames, wins, losses, ties };
    })
    .sort((x, y) => y.games - x.games || (y.wins - y.losses) - (x.wins - x.losses));

  return { gamesWithLineup, fairPlay, benchBalance, positionVariety, armCare, reusedLineups };
}

// A readable fallback label when a reused batting order doesn't match a saved template name.
function labelFromSignature(sig: string, nameById: Map<string, string>): string {
  const ids = sig.split('|');
  const names = ids.slice(0, 3).map(id => (nameById.get(id) ?? 'Unknown').replace(/^#\d+\s*/, ''));
  return names.join(', ') + (ids.length > 3 ? '…' : '');
}
