/**
 * What an evaluation session SHOWS, separated from what it lets a coach ENTER (development
 * lifecycle Phase 0, F02).
 *
 * ⚠ The session read always returned every saved reading, retired tests included — and the screen
 * then filtered the tests to active ones and the players to the current active roster before
 * drawing a single row. Retire a test after a testing day and its results lost their only route
 * through that session; a player who left the team took their row with them. The data was kept;
 * the screen stopped showing it. These helpers draw the session from what is SAVED in it, and keep
 * "new entry starts from today's active list" as a separate question.
 *
 * Pure module — the session screen reads through it, and the counts here are already per PLAYER
 * (so three attempts in Phase 2 stay one player).
 */

interface TypeLike { id: string; isActive: boolean; sortOrder: number; name: string }
interface EntryLike { id: string; playerId: string; measurableTypeId: string }
interface PlayerLike { id: string }

export interface SessionMetricChip<T extends TypeLike> {
  type: T;
  /** Retired from new sessions; on this one only because it holds saved rows. Read-only. */
  retired: boolean;
}

/**
 * The chips across the top: every ACTIVE test in library order (the coach may enter under any of
 * them), then any RETIRED test that has a reading in THIS session (read-only review). A retired
 * test with nothing here is not offered — that is what "retire" means for new entry.
 */
export function sessionMetricChips<T extends TypeLike>(types: T[], entries: EntryLike[]): SessionMetricChip<T>[] {
  const byOrder = (a: T, b: T) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const withRows = new Set(entries.map(e => e.measurableTypeId));
  const active = types.filter(t => t.isActive).sort(byOrder).map(type => ({ type, retired: false }));
  const retired = types.filter(t => !t.isActive && withRows.has(t.id)).sort(byOrder).map(type => ({ type, retired: true }));
  return [...active, ...retired];
}

export interface SessionRow<P extends PlayerLike, E extends EntryLike> {
  player: P;
  /** The FIRST saved reading for this player under the selected test (attempt 1 until Phase 2). */
  entry: E | null;
  /** Every saved reading for this player under the selected test, in save order. */
  entries: E[];
  /** No longer on the active roster — kept because a reading was saved here. Read-only. */
  pastParticipant: boolean;
}

/**
 * The grid, ROSTER ORDER ONLY (never re-sorted by result — binding), followed by any past
 * participant who has a reading under the selected test. A departed player with nothing under
 * this test is not a row: there is nothing to review and nothing may be entered for them.
 */
export function sessionRows<P extends PlayerLike, E extends EntryLike>(
  roster: P[], pastParticipants: P[], entries: E[], typeId: string,
): SessionRow<P, E>[] {
  const byPlayer = new Map<string, E[]>();
  for (const e of entries) {
    if (e.measurableTypeId !== typeId) continue;
    const list = byPlayer.get(e.playerId) ?? [];
    list.push(e);
    byPlayer.set(e.playerId, list);
  }
  const row = (player: P, pastParticipant: boolean): SessionRow<P, E> => {
    const list = byPlayer.get(player.id) ?? [];
    return { player, entry: list[0] ?? null, entries: list, pastParticipant };
  };
  return [
    ...roster.map(p => row(p, false)),
    ...pastParticipants.filter(p => byPlayer.has(p.id)).map(p => row(p, true)),
  ];
}

/**
 * "N of M entered" — N counts CURRENT roster players with at least one reading under the test,
 * each once. Rows are never people: a since-deactivated player's reading must not produce
 * "15 of 14", and a player's three attempts must not produce "3 of 14" for one child.
 */
export function sessionEnteredCount(roster: PlayerLike[], entries: EntryLike[], typeId: string): number {
  const entered = new Set(entries.filter(e => e.measurableTypeId === typeId).map(e => e.playerId));
  return roster.filter(p => entered.has(p.id)).length;
}
