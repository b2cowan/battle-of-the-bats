/**
 * Tournament operational phase (derived — NOT a stored status).
 * See design_decisions.md 2026-06-03.
 *
 *  draft     — status 'draft' (setup; site preview-only)
 *  open      — status 'active' AND not game-day (site + registration live, games not started)
 *  gameday   — status 'active' AND game-day (games underway)
 *  completed — status 'completed'
 *  archived  — status 'archived'
 *
 * Game-day boundary = within event dates OR the first game has started. The
 * "first game started" half needs game data, so surfaces that have it (the
 * dashboard, via its API) pass a full `isGameDay`; shell-wide surfaces that
 * don't (e.g. the mobile top-bar pill) pass the date-only signal — an accepted
 * edge-case difference.
 */

// Explicit `.ts` extensions (repo convention) so this module — and everything that depends on it,
// notably the public-page visibility rules — stays importable from a plain Node test or script.
import type { TournamentFormat } from './types.ts';
import { tournamentToday } from './timezone.ts';

export type TournamentPhase = 'draft' | 'open' | 'gameday' | 'completed' | 'archived';

/**
 * Every tournament style the product knows, in picker order, with the words a customer reads.
 * ONE list for the setup wizard, the org sign-up wizard, Event settings and its confirm dialog —
 * the two wizards used to carry identical copies of the card list, which is how a third card
 * would have reached one and not the other.
 */
export const TOURNAMENT_FORMAT_OPTIONS: ReadonlyArray<{ value: TournamentFormat; title: string; desc: string }> = [
  { value: 'round_robin_playoffs', title: 'Round robin + playoffs', desc: 'Teams play a round robin, then a bracket seeded from the standings.' },
  { value: 'playoff_only', title: 'Bracket only', desc: 'No round robin — seed teams straight into a playoff bracket.' },
  { value: 'exhibition', title: 'Exhibition', desc: 'Games and standings, no playoff bracket — for a scrimmage day or an exhibition weekend.' },
];

export const TOURNAMENT_FORMAT_VALUES: ReadonlyArray<TournamentFormat> = TOURNAMENT_FORMAT_OPTIONS.map(o => o.value);

export function isTournamentFormat(value: unknown): value is TournamentFormat {
  return typeof value === 'string' && (TOURNAMENT_FORMAT_VALUES as readonly string[]).includes(value);
}

/** The picker title for a format — what the settings summary and the confirm dialog print. */
export function tournamentFormatLabel(format: TournamentFormat): string {
  return TOURNAMENT_FORMAT_OPTIONS.find(o => o.value === format)?.title ?? TOURNAMENT_FORMAT_OPTIONS[0].title;
}

/**
 * The longer, settings-page description of a format — a fuller sentence than the picker card's
 * `desc` (which stays compact for the three-across grid), including settings-specific guidance
 * (Exhibition's mentions the Hide Standings switch). A `Record` over every `TournamentFormat` —
 * not a ternary chain — so a fourth format is a TypeScript error here until it gets a sentence,
 * rather than silently falling through to whichever branch happened to be the `else`.
 */
const TOURNAMENT_FORMAT_SETTINGS_DESCRIPTIONS: Record<TournamentFormat, string> = {
  round_robin_playoffs: 'Teams play a round robin, then the top teams advance to a playoff bracket seeded from the standings.',
  playoff_only: 'No round robin — the event starts straight with a playoff bracket. You seed teams into the first round yourself (manually or randomized) in the Playoff Bracket Builder.',
  exhibition: 'No playoffs — every game is a stand-alone game. Standings still run; hide the Standings page under Public pages if you don’t want a table.',
};

export function tournamentFormatSettingsDescription(format: TournamentFormat): string {
  return TOURNAMENT_FORMAT_SETTINGS_DESCRIPTIONS[format];
}

type HasFormat = { settings?: { format?: TournamentFormat | string | null } | null } | null | undefined;

/**
 * Structural format of a tournament; defaults to the standard round robin → playoffs flow.
 * Validated, not trusted: an unknown stored value (a typo, a value from a newer build) reads as
 * the default rather than as whichever branch happened to be the `else`.
 */
export function getTournamentFormat(tournament?: HasFormat): TournamentFormat {
  const raw = tournament?.settings?.format;
  return isTournamentFormat(raw) ? raw : 'round_robin_playoffs';
}

/**
 * The two questions every surface actually asks. `isPlayoffOnly()` used to be the only one, and
 * eleven call sites read "not bracket-only" as "has a round robin AND a bracket" — true for one
 * format, false for Exhibition. Ask the question you mean:
 *
 *  - hasRoundRobin — there is a pool-play stage, so standings exist and the Round-Robin
 *    Generator applies. False only for bracket-only.
 *  - hasPlayoffs   — the event ends in a bracket, so the Playoffs stage, the bracket builders and
 *    "the bracket is decided" apply. False only for Exhibition.
 */
export function hasRoundRobin(tournament?: HasFormat): boolean {
  return getTournamentFormat(tournament) !== 'playoff_only';
}

export function hasPlayoffs(tournament?: HasFormat): boolean {
  return getTournamentFormat(tournament) !== 'exhibition';
}

/**
 * The tournament-create flow's settings PATCH body for a non-default style, or `null` when the
 * default (round robin + playoffs) needs no write. Shared by the setup wizard and the org
 * sign-up wizard so the decision of "what counts as non-default, and what to write" lives in
 * exactly one place — the two wizards used to each carry their own copy of this guard, which is
 * exactly how a third style could reach one door's write and not the other's (see
 * TOURNAMENT_FORMAT_OPTIONS above). Each wizard still makes its own request with its own local
 * fetch helper and query-string variable — this only centralizes the decision, not the I/O.
 */
export function tournamentFormatCreatePatch(
  format: TournamentFormat | undefined,
): { settings: { format: TournamentFormat } } | null {
  if (!format || format === 'round_robin_playoffs') return null;
  return { settings: { format } };
}

/**
 * "Ready to finalize" — every non-cancelled game is in a terminal state AND, for a format that
 * ends in a bracket, at least one playoff game exists (so a round robin whose bracket isn't built
 * yet never trips it early — DASHBOARD_COMPLETION_GUIDANCE_PLAN, decision #2). An Exhibition has
 * no bracket to wait for: every game resolved IS finished, on the day. Pure so the rule is pinned
 * by a unit test rather than by the dashboard's render.
 */
export function isReadyToFinalize(opts: {
  isActive: boolean;
  totalGames: number;
  resolvedGames: number;
  playoffGamesTotal: number;
  hasPlayoffs: boolean;
}): boolean {
  const { isActive, totalGames, resolvedGames, playoffGamesTotal, hasPlayoffs: endsInBracket } = opts;
  if (!isActive) return false;
  if (!(totalGames > 0 && resolvedGames >= totalGames)) return false;
  return endsInBracket ? playoffGamesTotal > 0 : true;
}

/** Date-only game-day signal: today falls within the tournament's start–end window. */
export function isWithinEventDates(
  startDate?: string | null,
  endDate?: string | null,
  today: string = tournamentToday(),
): boolean {
  if (!startDate || !endDate) return false;
  return today >= startDate && today <= endDate;
}

export function resolvePhase(opts: { status?: string | null; isGameDay: boolean }): TournamentPhase {
  const { status, isGameDay } = opts;
  if (status === 'archived') return 'archived';
  if (status === 'completed') return 'completed';
  if (status === 'draft') return 'draft';
  // active (or anything else) → split by game-day
  return isGameDay ? 'gameday' : 'open';
}

export const PHASE_LABEL: Record<TournamentPhase, string> = {
  draft: 'Draft',
  open: 'Open',
  gameday: 'Live',
  completed: 'Completed',
  archived: 'Archived',
};
