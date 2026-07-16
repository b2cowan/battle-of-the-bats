/**
 * lib/playoff-picture.ts — pure "Playoff Picture" builder.
 *
 * Turns a division's final/current pool standings + the materialized playoff bracket
 * into a shareable seeding summary: the seed list (with the qualifying cut marked), the
 * opening-round matchups (with `Seed #N` references resolved to real team names), a few
 * key-stat callouts, and a short template narrative — no AI. Seeding order IS the
 * standings tie-breaker order (see lib/tie-breakers.ts); `Seed #N` resolves against the
 * combined division order, which is how the wizard/tiers assign seeds.
 */
import type { Division, Game, PublicTeam, Tournament, PlayoffConfig } from './types';
import type { DivisionStandingRow } from './tie-breakers';
import { bracketGameLabel, fanRoundLabel } from './playoff-bracket';
import { isGameLive, DEFAULT_GAME_DURATION_MINUTES } from './game-status';
import { splitTeamQualifier, relativeDayLabel } from './utils';
import { tournamentToday } from './timezone';

export interface PlayoffSeed {
  seed: number;
  teamId: string;
  teamName: string;
  w: number;
  l: number;
  t: number;
  pts: number;
  /** Seeding-capped run differential (drives the seeding order). */
  rd: number;
  /** True uncapped run differential. */
  rdRaw: number;
  rf: number;
  ra: number;
  poolName?: string;
  qualified: boolean;
}

export interface PlayoffMatchupSide {
  name: string;
  seed?: number;
  score?: number | null;
  isWinner?: boolean;
}

export interface PlayoffMatchup {
  key: string;
  roundLabel: string;
  bracketLabel?: string | null;
  date?: string;
  time?: string;
  venueLabel?: string;
  status: string;
  /** In its live window right now — scores are running, not a decided result. */
  isLive?: boolean;
  home: PlayoffMatchupSide;
  away: PlayoffMatchupSide;
}

export interface PlayoffStatCallout {
  label: string;
  teamName: string;
  value: string;
}

/**
 * A TODAY game whose sides are still "Winner/Loser <code>" feeders — invisible in the
 * matchup list (its teams aren't decided) yet it's the game fans most want the time and
 * place for while its feeders play (A7). Copy stays honest: round names via fanRoundLabel
 * ("Championship"), feeder description in words, never raw bracket codes.
 */
export interface PlayoffPendingMatchup {
  key: string;
  roundLabel: string;
  bracketLabel?: string | null;
  date?: string;
  time?: string;
  venueLabel?: string;
  /** Fan wording for the game's day ("Today") — derived from the same `today`
   *  the pending filter uses, so copy can never desync from the filter window. */
  dayLabel: string;
  /** e.g. "Winner of Semifinal 1 vs Winner of Semifinal 2". */
  feedsFrom: string;
}

export interface DivisionPlayoffPicture {
  divisionId: string;
  divisionName: string;
  formatLabel: string;
  teamsQualifying: number;
  gamesStarted: boolean;
  seeds: PlayoffSeed[];
  matchups: PlayoffMatchup[];
  /** Today's still-undecided games (unresolved feeders) — rendered after the matchups. */
  pending: PlayoffPendingMatchup[];
  narrative: string[];
  callouts: PlayoffStatCallout[];
}

export interface PlayoffPicture {
  hasPlayoffs: boolean;
  divisions: DivisionPlayoffPicture[];
}

function formatLabel(cfg?: PlayoffConfig): string {
  switch (cfg?.format) {
    case 'double':      return 'Double elimination';
    case 'consolation': return 'Single elimination + consolation';
    case 'placement':   return 'Placement bracket';
    default:            return 'Single elimination';
  }
}

const fmtRd = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Extract the seed number from a `Seed #4`-style placeholder (null if not seed-based). */
function seedNumberFrom(placeholder?: string | null): number | null {
  if (!placeholder) return null;
  const m = placeholder.match(/seed\s*#?\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function isWinnerLoserRef(placeholder?: string | null): boolean {
  return /^\s*(winner|loser)\b/i.test(placeholder ?? '');
}

/**
 * Build the picture for one division. `rows` must already be in the engine's
 * tie-breaker (seeding) order. `venueLabelFor` resolves a game's venue display string.
 */
function buildDivisionPicture(
  division: Division,
  rows: DivisionStandingRow[],
  playoffGames: Game[],
  teamName: (id?: string | null) => string,
  venueLabelFor: (g: Game) => string,
  today: string,
): DivisionPlayoffPicture | null {
  if (playoffGames.length === 0) return null;

  const cfg = division.playoffConfig;
  const pools = division.pools ?? [];
  const combinePools = (cfg?.crossover ?? 'none') !== 'none' || pools.length <= 1;
  const teamsQualifying = cfg?.teamsQualifying ?? 0;
  const gamesStarted = rows.some(r => r.gp > 0);

  // Qualifying cut — mirror the standings "on track to advance" logic exactly,
  // including its gate: no team is marked qualified until pool play has started
  // (before then the seed order is arbitrary, so a "qualified" highlight would lie).
  const qualifiedIds = new Set<string>();
  if (teamsQualifying > 0 && gamesStarted) {
    if (combinePools) {
      rows.slice(0, teamsQualifying).forEach(r => qualifiedIds.add(r.teamId));
    } else {
      pools.forEach(p =>
        rows.filter(r => r.poolId === p.id).slice(0, teamsQualifying).forEach(r => qualifiedIds.add(r.teamId)),
      );
    }
  }

  const poolNameOf = (poolId?: string) => pools.find(p => p.id === poolId)?.name;

  const seeds: PlayoffSeed[] = rows.map((r, i) => ({
    seed: i + 1,
    teamId: r.teamId,
    teamName: r.teamName,
    w: r.w, l: r.l, t: r.t,
    pts: r.pts,
    rd: r.rd,
    rdRaw: r.rdRaw ?? r.rd,
    rf: r.rf, ra: r.ra,
    poolName: pools.length >= 2 ? poolNameOf(r.poolId) : undefined,
    qualified: teamsQualifying > 0 ? qualifiedIds.has(r.teamId) : false,
  }));

  const seedByNumber = (n: number): PlayoffSeed | undefined => seeds[n - 1];

  // Opening matchups: both sides are either a locked team or a `Seed #N` (i.e. not a
  // "Winner/Loser <code>" feeder). These are the round-1 games fans want to see.
  const resolveSide = (teamId: string | null, placeholder: string | null): PlayoffMatchupSide | null => {
    if (teamId) return { name: teamName(teamId) };
    const seedNo = seedNumberFrom(placeholder);
    if (seedNo != null) {
      const s = seedByNumber(seedNo);
      return { name: s?.teamName ?? placeholder ?? 'TBD', seed: seedNo };
    }
    return null; // winner/loser feeder → not an opening matchup
  };

  // A feeder side in words: whatever resolveSide can name (locked team / resolved
  // seed), else "Winner of Semifinal 1" via the canonical per-game label.
  const feederSideLabel = (teamId: string | null, placeholder: string | null): string => {
    const side = resolveSide(teamId, placeholder);
    if (side) return side.name;
    const m = (placeholder ?? '').match(/^\s*(winner|loser)\s+(.+?)\s*$/i);
    if (m) {
      const kind = m[1].toLowerCase() === 'loser' ? 'Loser' : 'Winner';
      return `${kind} of ${bracketGameLabel(m[2])}`;
    }
    return placeholder || 'TBD';
  };

  const matchups: PlayoffMatchup[] = [];
  const pending: PlayoffPendingMatchup[] = [];
  for (const g of playoffGames) {
    // A side is unresolved only while it has NO team AND a Winner/Loser feeder ref.
    // Placeholder strings are never cleared when advancement fills the team ids
    // (lib/db.ts), so gating on the placeholder alone would keep a decided
    // championship out of the matchup list forever — it must graduate the moment
    // its feeders resolve.
    const homeUnresolved = !g.homeTeamId && isWinnerLoserRef(g.homePlaceholder);
    const awayUnresolved = !g.awayTeamId && isWinnerLoserRef(g.awayPlaceholder);
    if (homeUnresolved || awayUnresolved) {
      // Undecided feeders drop out of the matchup list — but a TODAY game still gets an
      // honest "pending" stub so the final isn't invisible while its feeders play (A7).
      // Scores present would mean the ref is stale, not a real pending game — skip those.
      if (g.date === today && g.homeScore == null && g.awayScore == null) {
        pending.push({
          key: g.id,
          roundLabel: g.bracketCode ? fanRoundLabel(g.bracketCode) : 'Playoff',
          bracketLabel: g.bracketLabel ?? null,
          date: g.date || undefined,
          time: g.time || undefined,
          venueLabel: venueLabelFor(g) || undefined,
          dayLabel: relativeDayLabel(g.date, today),
          feedsFrom: `${feederSideLabel(g.awayTeamId ?? null, g.awayPlaceholder ?? null)} vs ${feederSideLabel(g.homeTeamId ?? null, g.homePlaceholder ?? null)}`,
        });
      }
      continue;
    }
    const home = resolveSide(g.homeTeamId ?? null, g.homePlaceholder ?? null);
    const away = resolveSide(g.awayTeamId ?? null, g.awayPlaceholder ?? null);
    if (!home || !away) continue;
    const decided = g.homeScore != null && g.awayScore != null;
    if (decided) {
      home.score = g.homeScore; away.score = g.awayScore;
      home.isWinner = (g.homeScore as number) > (g.awayScore as number);
      away.isWinner = (g.awayScore as number) > (g.homeScore as number);
    }
    matchups.push({
      key: g.id,
      // Fan wording — a decided final's chip must read "Championship", not "Final"
      // beside the Final status caption (this is a fan surface, fanRoundLabel rule).
      roundLabel: g.bracketCode ? fanRoundLabel(g.bracketCode) : 'Playoff',
      bracketLabel: g.bracketLabel ?? null,
      date: g.date || undefined,
      time: g.time || undefined,
      venueLabel: venueLabelFor(g) || undefined,
      status: g.status,
      isLive: isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES),
      home, away,
    });
  }
  const byDateTime = (a: { date?: string; time?: string }, b: { date?: string; time?: string }) =>
    (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || '');
  matchups.sort(byDateTime);
  pending.sort(byDateTime);

  // Key-stat callouts — drawn from the qualifying field when known, else all seeds.
  const pool = seeds.filter(s => (teamsQualifying > 0 ? s.qualified : true));
  const callouts: PlayoffStatCallout[] = [];
  const top = seeds[0];
  if (top && gamesStarted) {
    callouts.push({ label: 'Top seed', teamName: top.teamName, value: `${top.w}-${top.l}-${top.t}` });
    const offense = [...pool].sort((a, b) => b.rf - a.rf)[0];
    if (offense && offense.rf > 0) callouts.push({ label: 'Best offense', teamName: offense.teamName, value: `${offense.rf} runs for` });
    const defense = [...pool].sort((a, b) => a.ra - b.ra)[0];
    if (defense) callouts.push({ label: 'Stingiest defense', teamName: defense.teamName, value: `${defense.ra} runs against` });
    const hottest = [...pool].sort((a, b) => b.rdRaw - a.rdRaw)[0];
    if (hottest && hottest.teamId !== top.teamId) callouts.push({ label: 'Best differential', teamName: hottest.teamName, value: `${fmtRd(hottest.rdRaw)} run diff` });
  }

  // ONE-line template narrative (no AI). R2-2: the old three-paragraph version repeated
  // the record the stat cards already carry; the seed list below says the rest.
  const narrative: string[] = [
    top && gamesStarted
      ? `${formatLabel(cfg)}${teamsQualifying > 0 ? `, top ${teamsQualifying} advancing` : ''} — ${splitTeamQualifier(top.teamName).base} enter as the #1 seed.`
      : `The ${division.name} playoffs are set — ${formatLabel(cfg)}${teamsQualifying > 0 ? `, top ${teamsQualifying} advancing` : ''}.`,
  ];

  return {
    divisionId: division.id,
    divisionName: division.name,
    formatLabel: formatLabel(cfg),
    teamsQualifying,
    gamesStarted,
    seeds,
    matchups,
    pending,
    narrative,
    callouts,
  };
}

export function buildPlayoffPicture(
  _tournament: Tournament,
  divisions: Division[],
  _teams: PublicTeam[],
  games: Game[],
  standingsByDivision: Record<string, DivisionStandingRow[]>,
  teamName: (id?: string | null) => string,
  venueLabelFor: (g: Game) => string,
  /** Injectable for tests; defaults to the tournament-timezone "today" (never raw UTC). */
  today: string = tournamentToday(),
): PlayoffPicture {
  const out: DivisionPlayoffPicture[] = [];
  for (const division of divisions) {
    const playoffGames = games.filter(g => g.divisionId === division.id && g.isPlayoff && g.status !== 'cancelled');
    if (playoffGames.length === 0) continue;
    const rows = standingsByDivision[division.id] ?? [];
    const pic = buildDivisionPicture(division, rows, playoffGames, teamName, venueLabelFor, today);
    if (pic) out.push(pic);
  }
  return { hasPlayoffs: out.length > 0, divisions: out };
}
