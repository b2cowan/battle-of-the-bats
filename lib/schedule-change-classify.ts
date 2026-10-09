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

/** Empty-slot sentinel some games use instead of NULL for an unassigned team. */
export const NIL_TEAM_ID = '00000000-0000-0000-0000-000000000000';

export interface GameChangeInput {
  gameId: string;
  divisionId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** Who was in the game BEFORE the edit. When this differs from home/awayTeamId the edit
   *  restructured the matchup, and no "your game moved" message can be told truthfully — see
   *  `classifiedChanges`. */
  beforeHomeTeamId?: string | null;
  beforeAwayTeamId?: string | null;
  before: GameScheduleSnapshot;
  after: GameScheduleSnapshot;
}

/**
 * The changes a person can be told about, each with its kind. Drops a change that is no news (see
 * `classifyScheduleChange`) and one that ALSO reassigned the matchup: the incoming team was never scheduled at the
 * old time, and the outgoing team is no longer in this game at all — telling either a time is stating something
 * false, and a false notification is worse than none. Restructures stay silent; the schedule shows the truth.
 */
export function classifiedChanges(changes: GameChangeInput[]): Array<{ change: GameChangeInput; kind: GameChangeKind }> {
  const out: Array<{ change: GameChangeInput; kind: GameChangeKind }> = [];
  for (const change of changes) {
    const teamsChanged =
      (change.beforeHomeTeamId !== undefined && change.beforeHomeTeamId !== change.homeTeamId) ||
      (change.beforeAwayTeamId !== undefined && change.beforeAwayTeamId !== change.awayTeamId);
    if (teamsChanged) continue;
    const kind = classifyScheduleChange(change.before, change.after);
    if (kind) out.push({ change, kind });
  }
  return out;
}

/**
 * THE PUBLISH GATE, and who each change reaches. A division that hasn't published its schedule has shown nobody these
 * times, so there is nothing to correct; a game with no division was never on a published schedule either. Each
 * surviving change reaches its real teams (an empty slot or the nil sentinel reaches no one).
 */
export function noticeTargets(
  classified: Array<{ change: GameChangeInput; kind: GameChangeKind }>,
  publishedDivisionIds: ReadonlySet<string>,
): Array<{ change: GameChangeInput; kind: GameChangeKind; teamIds: string[] }> {
  return classified
    .filter(({ change }) => !!change.divisionId && publishedDivisionIds.has(change.divisionId))
    .map(({ change, kind }) => ({
      change,
      kind,
      teamIds: [change.homeTeamId, change.awayTeamId].filter(
        (t): t is string => typeof t === 'string' && t.length > 0 && t !== NIL_TEAM_ID,
      ),
    }));
}

/** The `games` columns a schedule change is measured on, plus what decides who hears about it. */
export interface ScheduleSnapshotRow {
  game_date: string | null;
  game_time: string | null;
  location: string | null;
  diamond_id: string | null;
  venue_facility_id: string | null;
  status: string | null;
  division_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
}

export const SCHEDULE_SNAPSHOT_COLUMNS =
  'game_date, game_time, location, diamond_id, venue_facility_id, status, division_id, home_team_id, away_team_id';

export function snapshotOfRow(row: ScheduleSnapshotRow): GameScheduleSnapshot {
  return {
    date: row.game_date, time: row.game_time, location: row.location, status: row.status,
    // The structured refs let classify tell a real venue change from a cosmetic rewrite of the derived display
    // string (Phase 2 canonicalizes legacy labels on ordinary saves).
    venueId: row.diamond_id, venueFacilityId: row.venue_facility_id,
  };
}

/**
 * The changes a write made to a batch of games, from each game's row read immediately BEFORE the write and the
 * committed row read AFTER it — never from what the client believed. A game with no "before" (inserted by the
 * write) or no "after" (removed by it) is not a schedule change of an existing game.
 */
export function scheduleChangesFromRows(
  beforeById: ReadonlyMap<string, ScheduleSnapshotRow>,
  afterRows: Array<ScheduleSnapshotRow & { id: string }>,
): GameChangeInput[] {
  const changes: GameChangeInput[] = [];
  for (const after of afterRows) {
    const before = beforeById.get(after.id);
    if (!before) continue;
    changes.push({
      gameId: after.id,
      divisionId: after.division_id ?? before.division_id,
      homeTeamId: after.home_team_id,
      awayTeamId: after.away_team_id,
      beforeHomeTeamId: before.home_team_id,
      beforeAwayTeamId: before.away_team_id,
      before: snapshotOfRow(before),
      after: snapshotOfRow(after),
    });
  }
  return changes;
}
