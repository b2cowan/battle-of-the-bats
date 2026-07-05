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
import { bracketRoundLabel } from './playoff-bracket';

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
  home: PlayoffMatchupSide;
  away: PlayoffMatchupSide;
}

export interface PlayoffStatCallout {
  label: string;
  teamName: string;
  value: string;
}

export interface DivisionPlayoffPicture {
  divisionId: string;
  divisionName: string;
  formatLabel: string;
  teamsQualifying: number;
  gamesStarted: boolean;
  seeds: PlayoffSeed[];
  matchups: PlayoffMatchup[];
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

  const matchups: PlayoffMatchup[] = [];
  for (const g of playoffGames) {
    if (isWinnerLoserRef(g.homePlaceholder) || isWinnerLoserRef(g.awayPlaceholder)) continue;
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
      roundLabel: g.bracketCode ? bracketRoundLabel(g.bracketCode) : 'Playoff',
      bracketLabel: g.bracketLabel ?? null,
      date: g.date || undefined,
      time: g.time || undefined,
      venueLabel: venueLabelFor(g) || undefined,
      status: g.status,
      home, away,
    });
  }
  matchups.sort((a, b) =>
    (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''),
  );

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

  // Short template narrative (no AI).
  const narrative: string[] = [];
  narrative.push(
    `The ${division.name} playoffs are set — ${formatLabel(cfg)}${teamsQualifying > 0 ? `, top ${teamsQualifying} advancing` : ''}.`,
  );
  if (top && gamesStarted) {
    narrative.push(
      `${top.teamName} enter as the #1 seed at ${top.w}-${top.l}-${top.t} with a ${fmtRd(top.rdRaw)} run differential.`,
    );
  }
  if (matchups.length > 0) {
    narrative.push(
      `${matchups.length} opening matchup${matchups.length === 1 ? '' : 's'} ${matchups.length === 1 ? 'is' : 'are'} locked — see the full bracket below.`,
    );
  }

  return {
    divisionId: division.id,
    divisionName: division.name,
    formatLabel: formatLabel(cfg),
    teamsQualifying,
    gamesStarted,
    seeds,
    matchups,
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
): PlayoffPicture {
  const out: DivisionPlayoffPicture[] = [];
  for (const division of divisions) {
    const playoffGames = games.filter(g => g.divisionId === division.id && g.isPlayoff && g.status !== 'cancelled');
    if (playoffGames.length === 0) continue;
    const rows = standingsByDivision[division.id] ?? [];
    const pic = buildDivisionPicture(division, rows, playoffGames, teamName, venueLabelFor);
    if (pic) out.push(pic);
  }
  return { hasPlayoffs: out.length > 0, divisions: out };
}
