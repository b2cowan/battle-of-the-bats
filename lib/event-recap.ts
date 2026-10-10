/**
 * HOW IT FINISHED, AND THE EVENT IN NUMBERS — one definition each (Tournament admin redesign Stage 4,
 * Part 0, 2026-10-06). The finished board, Summary and Summary's printed page all read THIS, so a
 * figure can no longer mean one thing on the board and another on Summary: before, the board's route
 * and Summary's each built their own champion list (the board passed the name only), the board's
 * "teams" was every registration (9 on the demo, one never accepted) while 8 played, and the two
 * money sums skipped different teams.
 *
 * The definitions, word for word, are in TOURNAMENT_ADMIN_REDESIGN_PLAN.md §6d ("The definitions").
 * The owner's rulings they follow (2026-10-06): P1 a tiered division names its TOP tier's champion,
 * the tier named only when the division has tiers · P2 a final never scored names where the top team
 * finished, "final not scored", no trophy · P3 the link to share follows what the public champions
 * page will actually show · P4 "teams" are the teams that played, but the money counts every
 * accepted team (as Teams' payments do) · A24 an Exhibition names no winner.
 *
 * Pure (no reads): `lib/event-recap-read.ts` does the reads and both routes return its result.
 */
import type { Division, Game, Team, TournamentSettings } from './types';
import { decidedFinalFor, deriveTierChampions, isTournamentPlayoffsComplete } from './champions';
import { groupGamesByBracketId } from './playoff-bracket';
import { computeTournamentStandings, type DivisionStandingRow } from './tie-breakers';
import { getTournamentFormat } from './tournament-phase';
import { isPublicPageEnabled, normalizeHiddenPublicPages, type PublicPageKey } from './public-pages';
import { getEffectiveFee, owedAmount, type FeeMode, type FeeSchedule } from './tournament-teams';

/** How one division finished — the board's and Summary's row, and the printed page's. */
export type DivisionFinish =
  | {
      kind: 'champion';
      divisionId: string;
      divisionName: string;
      teamName: string;
      /** The top tier's name ("Tier 1", "Gold") — only when the division has more than one bracket (P1). */
      tierLabel: string | null;
      runnerUpName: string | null;
      /** The final's score, winner first ("5–4"). A forfeit's recorded score is nominal: never shown. */
      winnerScore: number;
      loserScore: number;
      byForfeit: boolean;
      /** YYYY-MM-DD, as stored. */
      finalDate: string | null;
    }
  | {
      kind: 'standings';
      divisionId: string;
      divisionName: string;
      teamName: string;
      w: number;
      l: number;
      t: number;
      /** `unscored` — the division has playoff games but no decided final (P2); `none` — no playoffs. */
      final: 'none' | 'unscored';
    };

/** Which public page a finished event's copy action shares (P3); null = no action. */
export type RecapShareLink = 'champions' | 'standings' | null;

/** One division's final standings, in the published order (Summary's printed page). */
export interface RecapStandings {
  divisionId: string;
  divisionName: string;
  rows: Array<{ teamName: string; w: number; l: number; t: number }>;
}

export interface EventRecap {
  /** One per division in the event's division order; empty for an Exhibition (A24). */
  finishes: DivisionFinish[];
  /** Every division with a ranked game, in the event's division order (an Exhibition's too). */
  standings: RecapStandings[];
  /** The teams that played: on either side of at least one game with a final result. */
  teamsPlayed: number;
  /** Games with a final result (completed or forfeit), playoffs included. */
  gamesPlayed: number;
  /** Of `gamesPlayed`, the playoff games. */
  playoffGamesPlayed: number;
  money: {
    /** Any accepted team has a fee. */
    charged: boolean;
    /** What every accepted team has paid. */
    collected: number;
    /** Every accepted team's unpaid balance against its own fee. */
    owed: number;
    /** How many accepted teams still owe. */
    teamsOwing: number;
  };
  shareLink: RecapShareLink;
  /** The public page `shareLink` names, from the site's root (`/org/event/champions`); null with no link. */
  sharePath: string | null;
  /** No link because the organizer HID Standings on a public site — the card says so in one sentence.
   *  (No link for any other reason — a site offline, a bracket-only event — is simply absent.) */
  shareHidden: boolean;
  isExhibition: boolean;
}

/** The money a team row carries (the raw `teams` row: the domain `Team` has no payments). */
export interface RecapPayment {
  divisionId: string | null;
  status: string | null;
  totalPaid: number | null;
}

export interface RecapInput {
  tournament: {
    status: string | null;
    settings: TournamentSettings | null;
    publicHiddenPages: unknown;
    feeScheduleMode: string | null;
    fee: FeeSchedule;
  };
  /** The published readers' rows (getDivisions / getTeams / getGames) — the public standings' reads. */
  divisions: Division[];
  teams: Team[];
  games: Game[];
  payments: RecapPayment[];
  /** `/${orgSlug}/${tournamentSlug}`, or null when the event has no public link yet. */
  publicBase: string | null;
}

/** A game with a final result: completed or forfeit (a submitted score is not final yet). */
const hasFinalResult = (g: { status?: string | null }) => g.status === 'completed' || g.status === 'forfeit';

/** "Teams" and "games played", the one definition: games with a final result (completed or forfeit), and
 *  every team on either side of one; of those games, the playoff ones. The recap counts an event's; the
 *  lists count each event's from the same rule. */
export function playedCounts(
  games: Array<{ status?: string | null; isPlayoff?: boolean | null; homeTeamId?: string | null; awayTeamId?: string | null }>,
): { teamsPlayed: number; gamesPlayed: number; playoffGamesPlayed: number } {
  const teams = new Set<string>();
  let gamesPlayed = 0;
  let playoffGamesPlayed = 0;
  for (const g of games) {
    if (!hasFinalResult(g)) continue;
    gamesPlayed++;
    if (g.isPlayoff) playoffGamesPlayed++;
    if (g.homeTeamId) teams.add(g.homeTeamId);
    if (g.awayTeamId) teams.add(g.awayTeamId);
  }
  return { teamsPlayed: teams.size, gamesPlayed, playoffGamesPlayed };
}
// The public statuses (lib/public-tournament-data's own set, which lives beside the server reads and
// cannot be imported into this pure module): a draft or archived site is offline.
const PUBLIC_STATUSES = new Set(['active', 'completed']);
const byOrder = (a: Division, b: Division) => (a.order ?? 0) - (b.order ?? 0);
/** Before any game counts, a division's table is every team at 0-0 in name order: that ranks nobody. */
const hasRankedGame = (rows: DivisionStandingRow[]) => rows.some(row => row.gp > 0);

/**
 * A division's champion, when its top tier's final is decided (P1) — the finished board's row, and the schedule's
 * Bracket view's champion card (Tournament admin redesign Stage 3, S6: "one sentence in two places"). Null while
 * the final waits, or when the winner is not a named team.
 */
export function championFinish(
  div: Pick<Division, 'id' | 'name'>,
  games: readonly Game[],
  teamName: (id?: string | null) => string | null,
): Extract<DivisionFinish, { kind: 'champion' }> | null {
  const final = decidedFinalFor([...games], div.id);
  if (!final) return null;
  const homeWon = (final.homeScore ?? 0) > (final.awayScore ?? 0);
  const champion = teamName(homeWon ? final.homeTeamId : final.awayTeamId);
  if (!champion) return null;
  const groups = groupGamesByBracketId(games.filter(g => g.isPlayoff && g.divisionId === div.id));
  return {
    kind: 'champion',
    divisionId: div.id,
    divisionName: div.name,
    teamName: champion,
    tierLabel: groups.length > 1 ? (groups[0].label ?? 'Bracket 1') : null,
    runnerUpName: teamName(homeWon ? final.awayTeamId : final.homeTeamId),
    winnerScore: Math.max(final.homeScore ?? 0, final.awayScore ?? 0),
    loserScore: Math.min(final.homeScore ?? 0, final.awayScore ?? 0),
    byForfeit: final.status === 'forfeit',
    finalDate: final.date || null,
  };
}

function divisionFinish(
  div: Division,
  input: RecapInput,
  standings: DivisionStandingRow[],
  /** The division's standings rank someone on a final result (`ranks` below). */
  ranked: boolean,
  teamName: (id?: string | null) => string | null,
): DivisionFinish | null {
  const playoffGames = input.games.filter(g => g.isPlayoff && g.divisionId === div.id);
  const champion = championFinish(div, input.games, teamName);
  if (champion) return champion;
  // The published standings' first team — the same engine and reads as the public Standings page.
  const top = ranked ? standings[0] : null;
  if (!top) return null; // nothing to rank: no final result, or a bracket-only division with no decided final
  const hasFinal = playoffGames.some(g => g.status !== 'cancelled');
  return {
    kind: 'standings',
    divisionId: div.id,
    divisionName: div.name,
    teamName: top.teamName,
    w: top.w,
    l: top.l,
    t: top.t,
    final: hasFinal ? 'unscored' : 'none',
  };
}

/** P3: the champions page when it will name a champion (its own two checks, on its own reads),
 *  else the Standings page; nothing when Standings is unavailable or the site isn't public. */
function shareLinkFor(input: RecapInput, divisions: Division[], isExhibition: boolean): RecapShareLink {
  const { tournament } = input;
  if (!PUBLIC_STATUSES.has(tournament.status ?? '')) return null;
  // The champions page inherits Standings' visibility (app/[orgSlug]/[tournamentSlug]/champions), so
  // when Standings is unavailable both pages say the results are hidden: share neither.
  if (!isPublicPageEnabled({ settings: tournament.settings ?? undefined, publicHiddenPages: tournament.publicHiddenPages as PublicPageKey[] }, 'standings')) return null;
  if (isExhibition) return 'standings';
  const accepted = input.teams.filter(t => t.status === 'accepted');
  const namesChampion = isTournamentPlayoffsComplete(input.games, divisions)
    && deriveTierChampions(input.games, accepted, divisions).length > 0;
  return namesChampion ? 'champions' : 'standings';
}

export function computeEventRecap(input: RecapInput): EventRecap {
  const isExhibition = getTournamentFormat({ settings: input.tournament.settings }) === 'exhibition';
  const names = new Map(input.teams.map(t => [t.id, t.name] as const));
  const teamName = (id?: string | null) => (id ? names.get(id) ?? null : null);

  const divisions = [...input.divisions].sort(byOrder);
  const settings = input.tournament.settings ?? undefined;
  // A division ranks someone when its standings count a game AND it has a game with a final result: the
  // standings also count a submitted score, which "games played" leaves out (the definitions, §6d).
  const playedIn = new Set(input.games.filter(hasFinalResult).map(g => g.divisionId));
  const tables = divisions.map(div => {
    const rows = computeTournamentStandings(div.id, input.teams, input.games, div.playoffConfig, settings);
    return { div, rows, ranked: playedIn.has(div.id) && hasRankedGame(rows) };
  });
  const finishes = isExhibition
    ? []
    : tables
        .map(({ div, rows, ranked }) => divisionFinish(div, input, rows, ranked, teamName))
        .filter((f): f is DivisionFinish => f !== null);
  const standings: RecapStandings[] = tables
    .filter(({ ranked }) => ranked)
    .map(({ div, rows }) => ({
      divisionId: div.id,
      divisionName: div.name,
      rows: rows.map(r => ({ teamName: r.teamName, w: r.w, l: r.l, t: r.t })),
    }));

  const { teamsPlayed, gamesPlayed, playoffGamesPlayed } = playedCounts(input.games);

  const feeMode: FeeMode = input.tournament.feeScheduleMode === 'division' ? 'division' : 'tournament';
  const money = { charged: false, collected: 0, owed: 0, teamsOwing: 0 };
  for (const p of input.payments) {
    if (p.status !== 'accepted') continue;
    const totalPaid = Number(p.totalPaid ?? 0);
    money.collected += totalPaid;
    const fee = getEffectiveFee({ division_id: p.divisionId ?? '' }, input.divisions, feeMode, input.tournament.fee);
    if (!fee.totalFeeAmount) continue;
    money.charged = true;
    const owed = owedAmount({ totalPaid }, fee);
    if (owed > 0) {
      money.owed += owed;
      money.teamsOwing++;
    }
  }

  const shareLink = shareLinkFor(input, divisions, isExhibition);
  const shareHidden = shareLink === null
    && PUBLIC_STATUSES.has(input.tournament.status ?? '')
    && normalizeHiddenPublicPages(input.tournament.publicHiddenPages).includes('standings');
  return {
    finishes,
    standings,
    teamsPlayed,
    gamesPlayed,
    playoffGamesPlayed,
    money,
    shareLink,
    sharePath: shareLink && input.publicBase ? `${input.publicBase}/${shareLink}` : null,
    shareHidden,
    isExhibition,
  };
}
