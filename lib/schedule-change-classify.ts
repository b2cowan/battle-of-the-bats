/**
 * lib/schedule-change-classify.ts — the PURE half of "your game moved" (extracted from
 * lib/schedule-change-notices.ts so the rule is unit-testable; that module is server-only).
 *
 * Which changes are worth a person's attention. Deliberately NOT: notes, bracket codes, the
 * generator-lock flag, duration, team reassignment — none of those change where or when
 * somebody has to be.
 */

export type GameChangeKind = 'moved' | 'cancelled' | 'restored';

export interface GameScheduleSnapshot {
  date: string | null;
  time: string | null;
  location: string | null;
  status: string | null;
  /**
   * Structured venue refs, when the caller has them. With refs on both sides, a venue change
   * is judged on the REFS — the display string is server-derived from the picked venue
   * (Phase 2), so it can change cosmetically (legacy hyphen → canonical em dash, a venue
   * rename) on a save that moved nothing, and that must never message a family. Callers
   * without refs (e.g. the bulk shift, which never touches venues) omit them and the
   * location-string diff applies as before.
   */
  venueId?: string | null;
  venueFacilityId?: string | null;
}

export function classifyScheduleChange(
  before: GameScheduleSnapshot,
  after: GameScheduleSnapshot,
): GameChangeKind | null {
  const wasCancelled = before.status === 'cancelled';
  const isCancelled = after.status === 'cancelled';

  // A game that has been played (or is mid-approval) is bookkeeping, not news.
  const playedStatuses = new Set(['submitted', 'completed', 'forfeit']);
  if (playedStatuses.has(after.status ?? '') || playedStatuses.has(before.status ?? '')) return null;

  if (!wasCancelled && isCancelled) return 'cancelled';
  if (wasCancelled && !isCancelled) return 'restored';
  if (isCancelled) return null; // still cancelled — moving a cancelled game is not news

  // Venue: judged on the structured refs when the caller supplied them (see the snapshot
  // doc comment — the display string can change cosmetically on a save that moved nothing).
  // Two ref-less sides compare their typed text, which is all a text-placed game has.
  const refsKnown = before.venueId !== undefined || after.venueId !== undefined;
  const venueChanged = refsKnown
    ? (before.venueId ?? null) !== (after.venueId ?? null)
      || (before.venueFacilityId ?? null) !== (after.venueFacilityId ?? null)
      || ((before.venueId ?? null) === null && (after.venueId ?? null) === null
          && (before.location ?? null) !== (after.location ?? null))
    : (before.location ?? null) !== (after.location ?? null);

  const moved =
    before.date !== after.date ||
    before.time !== after.time ||
    venueChanged;
  return moved ? 'moved' : null;
}
