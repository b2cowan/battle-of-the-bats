'use client';
/**
 * THE LINE UNDER THE FIELD, for every door that places a game by hand (Tournament admin redesign Stage 3, A37): the
 * game window and the phone's move sheet. One rule (`lib/tournament-overlap.ts`) checked as the form changes, against
 * every game of the tournament the page holds — the server refuses the same thing in the same words.
 *
 *   red ("refuse")  — another game of the tournament on that diamond then: Save waits until it is fixed;
 *   busy            — the same TYPED place (not checked, so not refused), or a gap shorter than the buffer.
 * The club's amber line (6a) is not here: it comes from the save's own reply.
 */
import { useMemo, type ReactNode } from 'react';
import { WhereLine } from '@/components/venue/WhereField';
import type { Division, Game, Team, Tournament } from '@/lib/types';
import { checkVenueConflict, resolveGameTiming, toConflictGame, type ConflictResult } from '@/lib/schedule-conflict';
import { hasKnownPlacement } from '@/lib/venue-identity';
import { isRefusedOverlap, overlapOtherName, overlapOtherTimes, overlapPool, overlapRefusalWords, type OverlapGame } from '@/lib/tournament-overlap';
import { placeOfWhere } from '@/lib/tournament-where';
import type { WhereValue } from '@/lib/where-field';
import { GAME_WINDOW_WORDS as G } from '@/lib/schedule-words';

export function useOverlapLine(args: {
  /** Off while the form is not being edited: nothing is checked. */
  active: boolean;
  id: string;
  /** The game's status: a cancelled game holds no diamond, so it is never refused (the server's rule). */
  status?: string | null;
  date: string;
  time: string;
  where: WhereValue;
  divisionId: string | null;
  /** The game's own length, or null for the chain. */
  durationMinutes: number | null;
  games: readonly Game[];
  teams: readonly Team[];
  divisions: Division[];
  tournament: Tournament | null;
  /** The sport's surface word ("Diamond"). */
  noun: string;
}): { conflict: ConflictResult | null; refused: boolean; line: ReactNode } {
  const { active, id, status, date, time, where, divisionId, durationMinutes, games, teams, divisions, tournament, noun } = args;
  const pool = useMemo(() => overlapPool(games, teams), [games, teams]);
  const conflict = useMemo((): ConflictResult | null => {
    // A cancelled game holds no diamond — the server's walk skips it too.
    if (!active || status === 'cancelled' || !date || !time) return null;
    const place = placeOfWhere(where);
    const proposed = toConflictGame({
      id, date, time, status: 'scheduled', venueId: place.venueId, venueFacilityId: place.venueFacilityId,
      location: place.location ?? '', divisionId, durationMinutes,
    });
    if (!hasKnownPlacement(proposed)) return null;
    return checkVenueConflict({ proposedGame: proposed, allGames: pool, divisions, tournament });
  }, [active, id, status, date, time, where, divisionId, durationMinutes, pool, divisions, tournament]);

  const refused = isRefusedOverlap(conflict);
  let line: ReactNode = null;
  if (conflict) {
    // The surface in the form's own words: the diamond picked or typed, else the venue.
    const field = where.fieldNumber.trim() || where.location.trim() || noun;
    const other = conflict.conflictingGame as OverlapGame;
    const name = overlapOtherName(other, divisions);
    const times = overlapOtherTimes(other, divisions, tournament);
    if (refused) {
      const r = overlapRefusalWords(conflict, { field, noun, divisions, tournament });
      line = <WhereLine tone="refuse" lead={r.lead} rest={r.rest} />;
    } else if (conflict.kind === 'overlap') {
      const r = G.typedOverlap(field, name, times.range);
      line = <WhereLine tone="busy" lead={r.lead} rest={r.rest} />;
    } else {
      const gap = resolveGameTiming(divisions.find(d => d.id === divisionId), tournament, durationMinutes).bufferMinutes;
      const r = G.buffer(field, name, times.end, gap);
      line = <WhereLine tone="busy" lead={r.lead} rest={r.rest} />;
    }
  }
  return { conflict, refused, line };
}
