/** Words and data for the preview game page; no browser or database dependencies. */
import type { Division, Game, PublicTeam, Venue } from './types';
import { bracketRoundInfo, fanRoundLabel } from './playoff-bracket';
import { fanPlaceholder, gameSideNames } from './public-game-row';
import { DEFAULT_GAME_DURATION_MINUTES, gameStartMs, hasNoScoreYet, NO_SCORE_YET, publicGameState } from './game-status';
import { directionsHref } from './family-schedule-format';
import { resolveGameFieldLabel, resolveGameVenueLabel } from './venue-label';
import { formatShortWeekdayDate } from './timezone';
import { formatTime } from './utils';

export function publicGameRound(game: Game): string {
  if (!game.isPlayoff) return 'Pool play';
  const label = game.roundLabel?.trim() || fanRoundLabel(game.bracketCode);
  return label.replace(/^(?:Grand )?Final(?=$| \(Game 2\)$)/i, 'Championship');
}

/** Extracted from the old page. Default preserves its wording and matching until Stage 8.
 * The new pages use exact references within one division/bracket, never another tier's SF1 or SF10. */
export function getPlayoffStakes(game: Game, allGames: Game[], fanWords = false): { text: string; gold: boolean } | null {
  if (!game.isPlayoff || !game.bracketCode) return null;
  const code = game.bracketCode.toUpperCase();
  const ref = `Winner ${game.bracketCode}`;
  const myKey = bracketRoundInfo(game.bracketCode).key;
  const winnerReference = (value?: string) => /^Winner\s+(?:of\s+)?(.+)$/i.exec(value?.trim() ?? '')?.[1].toUpperCase() === code;
  const next = allGames.find(other =>
    other.isPlayoff && other.id !== game.id && other.bracketCode &&
    (fanWords
      ? other.divisionId === game.divisionId && (other.bracketId ?? null) === (game.bracketId ?? null) &&
        (winnerReference(other.homePlaceholder) || winnerReference(other.awayPlaceholder))
      : other.homePlaceholder?.includes(ref) || other.awayPlaceholder?.includes(ref)) &&
    bracketRoundInfo(other.bracketCode).key !== myKey,
  );
  if (next?.bracketCode) return { text: `Winner advances to the ${fanWords ? publicGameRound(next) : bracketRoundInfo(next.bracketCode).title}`, gold: false };
  if (code === 'FIN' || code === 'GF' || code === 'GF2') return { text: fanWords ? 'The winner takes the title' : 'Championship — winner takes the title', gold: true };
  if (code === 'P3' || code === '3RD') return { text: 'Battling for 3rd place', gold: false };
  if (code.startsWith('CON')) return { text: 'Consolation final', gold: false };
  return null;
}

/** Derived state is part of the new page's signature: kickoff/end can change the face with no score edit. */
const faceSignature = (game: Game, state: string) => `${game.homeScore ?? ''}:${game.awayScore ?? ''}:${game.status}:${state}`;
export function publicGameRefreshSignature(game: Game | null, requireFinalization: boolean, now: Date = new Date()): string {
  if (!game) return 'missing';
  return faceSignature(game, publicGameState(game, requireFinalization, now));
}

/** Where "Directions" opens: the venue's address, else its name; null when the game has no location at all. */
export function gameDirections(game: Game, venues: Venue[]): string | null {
  const address = venues.find(v => v.id === game.venueId)?.address?.trim();
  return directionsHref(address || resolveGameVenueLabel(game, venues).trim() || null);
}

export function publicGameDetailView(game: Game, { games, teams, divisions, venues, requireFinalization, now = new Date() }: {
  games: Game[]; teams: PublicTeam[]; divisions: Division[]; venues: Venue[]; requireFinalization: boolean; now?: Date;
}) {
  const state = publicGameState(game, requireFinalization, now);
  const cancelled = state === 'cancelled';
  const live = state === 'live';
  const hasScore = !cancelled && (live ? !hasNoScoreYet(game) : (state === 'final' || state === 'unofficial') && game.homeScore != null && game.awayScore != null);
  const teamNames = new Map(teams.map(t => [t.id, t.name]));
  const teamIds = { away: game.awayTeamId, home: game.homeTeamId };
  // A side whose team is not public (withheld or removed) reads as its placeholder, and is not a link.
  const knownTeam = (side: 'away' | 'home') => teamNames.has(teamIds[side]) ? teamIds[side] : null;
  const names = gameSideNames({ ...game, homeTeamId: knownTeam('home') ?? '', awayTeamId: knownTeam('away') ?? '' }, id => teamNames.get(id) ?? 'TBD', fanPlaceholder);
  const venue = venues.find(v => v.id === game.venueId);
  const location = resolveGameVenueLabel(game, venues).trim();
  const field = resolveGameFieldLabel(game, venues).trim();
  const stakes = getPlayoffStakes(game, games, true);
  const start = gameStartMs(game);
  const round = publicGameRound(game);
  const division = divisions.find(d => d.id === game.divisionId)?.name ?? 'Division TBD';
  const scores = { away: hasScore ? game.awayScore ?? 0 : null, home: hasScore ? game.homeScore ?? 0 : null };
  return {
    state, cancelled, live, hasScore, round, division,
    stateLabel: live ? 'Live now' : state === 'final' ? 'Final' : state === 'unofficial' ? 'Unofficial' : null,
    time: game.time ? formatTime(game.time) : 'Time TBD',
    date: game.date ? formatShortWeekdayDate(game.date) : 'Date TBD',
    field: field || 'Location TBD',
    address: venue?.address?.trim() || (location && location !== field ? location : null),
    directions: cancelled ? null : gameDirections(game, venues),
    countdown: state === 'upcoming' && start != null && start > now.getTime() ? new Date(start).toISOString() : null,
    noScore: !cancelled && !hasScore ? NO_SCORE_YET : null,
    foot: cancelled ? 'This game will not be played.' : state === 'unofficial' ? 'Not yet confirmed by the organizer' : stakes?.text ?? null,
    gold: !cancelled && state !== 'unofficial' && Boolean(stakes?.gold),
    sides: (['away', 'home'] as const).map(side => ({
      name: names[side], score: scores[side],
      teamId: knownTeam(side),
      trailing: hasScore && (scores[side] ?? 0) < (scores[side === 'away' ? 'home' : 'away'] ?? 0),
    })),
    facts: [
      { key: 'division', label: 'Division', text: division },
      { key: 'round', label: 'Round', text: round },
      { key: 'length', label: 'Game length', text: `${game.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES} min` },
      ...(game.notes?.trim() ? [{ key: 'notes', label: 'Notes', text: game.notes.trim() }] : []),
    ],
    refreshSignature: faceSignature(game, state),
  };
}
