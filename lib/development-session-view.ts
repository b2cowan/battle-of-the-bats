/**
 * What an evaluation session SHOWS, separated from what it lets a coach ENTER (development
 * lifecycle Phase 0, F02; Phase 2: every attempt, the scope, the per-row state).
 *
 * ⚠ The session read always returned every saved reading, retired tests included — and the screen
 * then filtered the tests to active ones and the players to the current active roster before
 * drawing a single row. Retire a test after a testing day and its results lost their only route
 * through that session; a player who left the team took their row with them. The data was kept;
 * the screen stopped showing it. These helpers draw the session from what is SAVED in it, and keep
 * "new entry starts from today's active list" as a separate question.
 *
 * Pure module — the session screen reads through it, and every count here is per PLAYER: a
 * player's three attempts are three ENTRIES on one row, never three rows and never three people
 * (owner ruling 2026-09-11; the fundraising lesson of 2026-09-10).
 */

interface TypeLike { id: string; isActive: boolean; sortOrder: number; name: string }
interface EntryLike { id: string; playerId: string; measurableTypeId: string; attemptNo: number }
interface PlayerLike { id: string }
interface NotAssessedLike { playerId: string; measurableTypeId: string }

export interface SessionMetricChip<T extends TypeLike> {
  type: T;
  /** Retired from new sessions; on this one only because it holds saved rows. Read-only. */
  retired: boolean;
  /** This session holds at least one saved reading under this test. */
  hasRows: boolean;
}

/**
 * The chips across the top: every ACTIVE metric in library order (the coach may record under any
 * of them — a test takes attempts, a skill takes an observation), then any RETIRED one that has a
 * record in THIS session (read-only review). A retired metric with nothing here is not offered —
 * that is what "retire" means for new entry. `recordedTypeIds` is every type with a reading OR an
 * observation saved here.
 */
export function sessionMetricChips<T extends TypeLike>(types: T[], entries: EntryLike[], recordedTypeIds: Iterable<string> = []): SessionMetricChip<T>[] {
  const byOrder = (a: T, b: T) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const withRows = new Set<string>([...entries.map(e => e.measurableTypeId), ...recordedTypeIds]);
  const active = types.filter(t => t.isActive).sort(byOrder)
    .map(type => ({ type, retired: false, hasRows: withRows.has(type.id) }));
  const retired = types.filter(t => !t.isActive && withRows.has(t.id)).sort(byOrder)
    .map(type => ({ type, retired: true, hasRows: true }));
  return [...active, ...retired];
}

/**
 * Where a session OPENS when nothing is chosen yet: the first metric this session already holds
 * rows for (a resumed session lands on its own data — even when that metric has since been
 * retired), else the first active one (a fresh session starts from the current list). Never a chip
 * that is not on the list.
 */
export function defaultSessionChip<T extends TypeLike>(chips: SessionMetricChip<T>[]): SessionMetricChip<T> | null {
  return chips.find(c => c.hasRows) ?? chips[0] ?? null;
}

export interface SessionRow<P extends PlayerLike, E extends EntryLike, N extends NotAssessedLike = NotAssessedLike> {
  player: P;
  /** Every saved attempt for this player under the selected metric, in attempt order. */
  entries: E[];
  /** The "not assessed" mark for this player under the selected metric, if one was made. */
  notAssessed: N | null;
  /** No longer on the active roster — kept because a record was saved here. Read-only. */
  pastParticipant: boolean;
  /** In the session's stated scope. Always true when the session has no scope. */
  inScope: boolean;
}

/**
 * The grid, ROSTER ORDER ONLY (never re-sorted by result — binding), followed by any past
 * participant who has a reading under the selected metric. A departed player with nothing under
 * this metric is not a row: there is nothing to review and nothing may be entered for them.
 *
 * With a SCOPE (Phase 2): the scoped players are the rows; a roster player outside the scope
 * appears only if something was recorded or marked for them here, flagged `inScope: false` — a
 * record is never hidden by a scope drawn after it.
 */
export function sessionRows<P extends PlayerLike, E extends EntryLike, N extends NotAssessedLike = NotAssessedLike>(
  roster: P[], pastParticipants: P[], entries: E[], typeId: string,
  opts: { scopePlayerIds?: string[] | null; notAssessed?: N[] } = {},
): SessionRow<P, E, N>[] {
  const byPlayer = new Map<string, E[]>();
  for (const e of entries) {
    if (e.measurableTypeId !== typeId) continue;
    const list = byPlayer.get(e.playerId) ?? [];
    list.push(e);
    byPlayer.set(e.playerId, list);
  }
  for (const list of byPlayer.values()) list.sort((a, b) => a.attemptNo - b.attemptNo);
  const marks = new Map<string, N>();
  for (const m of opts.notAssessed ?? []) if (m.measurableTypeId === typeId) marks.set(m.playerId, m);
  const scope = opts.scopePlayerIds ? new Set(opts.scopePlayerIds) : null;
  const row = (player: P, pastParticipant: boolean): SessionRow<P, E, N> => ({
    player,
    entries: byPlayer.get(player.id) ?? [],
    notAssessed: marks.get(player.id) ?? null,
    pastParticipant,
    inScope: scope ? scope.has(player.id) : true,
  });
  const hasRecord = (id: string) => byPlayer.has(id) || marks.has(id);
  return [
    ...roster.filter(p => !scope || scope.has(p.id) || hasRecord(p.id)).map(p => row(p, false)),
    ...pastParticipants.filter(p => hasRecord(p.id)).map(p => row(p, true)),
  ];
}

export interface SessionScopeCounts {
  scoped: boolean;
  recorded: number;
  notAssessed: number;
  notRecorded: number;
  total: number;
}

/**
 * The counts under the chips, measured against the SCOPE when one was stated and against the
 * active roster when none was (the Phase 0 "N of M entered"). Per PLAYER, once each — rows are
 * never people: a since-deactivated player's reading must not produce "15 of 14", and a player's
 * three attempts must not produce "3 of 14" for one child. A past participant's record is listed
 * but never counted (they are not in "M"); a player outside the scope is listed but never counted
 * either. Never a zero invented: "not recorded" is the remainder, not a value.
 */
export function sessionScopeCounts<P extends PlayerLike, E extends EntryLike>(
  rows: SessionRow<P, E>[], scopePlayerIds: string[] | null | undefined,
): SessionScopeCounts {
  const counted = rows.filter(r => !r.pastParticipant && r.inScope);
  const recorded = counted.filter(r => r.entries.length > 0).length;
  const notAssessed = counted.filter(r => r.entries.length === 0 && r.notAssessed).length;
  const total = counted.length;
  return { scoped: !!scopePlayerIds, recorded, notAssessed, notRecorded: total - recorded - notAssessed, total };
}

/** "3 of 12 entered" · "4 recorded · 1 not assessed · 1 not recorded — of 6 in scope". */
export function scopeSentence(c: SessionScopeCounts): string {
  if (!c.scoped) return `${c.recorded} of ${c.total} entered`;
  return `${c.recorded} recorded · ${c.notAssessed} not assessed · ${c.notRecorded} not recorded — of ${c.total} in scope`;
}

/**
 * The per-row state machine, ONE home (mockup screen 3: Saved · Saving · Not saved — retry ·
 * Not recorded · Not assessed). Priority: an in-flight save, then a failed one (the typed value
 * survives on screen beside its error — it never disappears), then what the record holds.
 */
export type SessionRowState = 'saving' | 'error' | 'saved' | 'not_assessed' | 'not_recorded';
export function rowState(s: { hasEntries: boolean; notAssessed: boolean; saving: boolean; error: boolean }): SessionRowState {
  if (s.saving) return 'saving';
  if (s.error) return 'error';
  if (s.hasEntries) return 'saved';
  if (s.notAssessed) return 'not_assessed';
  return 'not_recorded';
}
/**
 * "Taken at" options in the order a coach looks for them (Practice Plans §10.2 ruling 2): practices
 * first, then everything else, each by how close it sits to the anchor date. Nothing is filtered
 * out — a coach who tested at a Saturday scrimmage warm-up must still find it. ONE home: the
 * session's picker and the Start-session scope step both read it.
 */
export function orderEventsByAnchor<E extends { eventType: string; startsAt: string }>(events: E[], anchorDate: string): E[] {
  const anchor = new Date(`${anchorDate}T12:00:00Z`).getTime();
  return [...events].sort((a, b) => {
    const ap = a.eventType === 'practice' ? 0 : 1, bp = b.eventType === 'practice' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return Math.abs(new Date(a.startsAt).getTime() - anchor) - Math.abs(new Date(b.startsAt).getTime() - anchor);
  });
}

export const ROW_STATE_LABELS: Readonly<Record<SessionRowState, string>> = {
  saving: 'Saving…',
  error: 'Not saved — retry',
  saved: 'Saved',
  not_assessed: 'Not assessed',
  not_recorded: 'Not recorded',
};
