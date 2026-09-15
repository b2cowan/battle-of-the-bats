/**
 * What an evaluation session SHOWS, separated from what it lets a coach ENTER (development
 * lifecycle Phase 0, F02; Phase 2: every attempt, the scope, the per-row state; re-evaluation
 * stage 2, 2026-09-15: the count per test, the ONE counting rule, the review's names).
 *
 * ⚠ The session read always returned every saved result, retired tests included — and the screen
 * then filtered the tests to active ones and the players to the current active roster before
 * drawing a single row. Retire a test after a testing day and its results lost their only route
 * through that session; a player who left the team took their row with them. The data was kept;
 * the screen stopped showing it. These helpers draw the session from what is SAVED in it, and keep
 * "new entry starts from today's active list" as a separate question.
 *
 * ⚠ ONE COUNTING RULE (stage 2 housekeeping — the live defect it closes: the grid's foot said a
 * skill had "0 recorded" while the review said "1 recorded", because the foot counted results only
 * and the review mapped observations in). A cell — one player under one metric — is RECORDED when
 * it holds a result OR an observation; it is ACCOUNTED FOR when it is recorded or marked not
 * assessed; it is UNRECORDED when it holds nothing. `recordedCellKeys` is the one place that says
 * what counts as a record; `sessionRows` (the grid, the chips, the review) and `scopeCompleteness`
 * (the sessions reader → the list's state and the Overview's "left unfinished") both read it.
 *
 * Pure module — the session screen reads through it, and every count here is per PLAYER: a
 * player's three attempts are three ENTRIES on one row, never three rows and never three people
 * (owner ruling 2026-09-11; the fundraising lesson of 2026-09-10).
 */

import { MAX_ATTEMPTS } from './development-input';
import { formatWeekdayDate } from './measurable-format';

interface TypeLike { id: string; isActive: boolean; sortOrder: number; name: string; kind?: 'test' | 'skill'; attemptsPerSession?: number }
interface EntryLike { id: string; playerId: string; measurableTypeId: string; attemptNo: number }
interface PlayerLike { id: string }
interface NotAssessedLike { playerId: string; measurableTypeId: string }
interface ObservationLike { playerId: string; measurableTypeId: string }
interface ScopeLike {
  scopeMetricIds: string[] | null;
  scopePlayerIds: string[] | null;
  scopeAttempts?: Record<string, number> | null;
}

export interface SessionMetricChip<T extends TypeLike> {
  type: T;
  /** Retired from new sessions; on this one only because it holds saved rows. Read-only. */
  retired: boolean;
  /** This session holds at least one saved record under this metric. */
  hasRows: boolean;
  /** Recorded here but not in the session's stated scope (a scope drawn after it, or a test dropped from the plan). */
  outsideScope: boolean;
}

/**
 * The chips across the top — the SCOPE (stage 2, C3): the metrics the coach chose for this session
 * in library order, then any ACTIVE metric that holds a record here without being in the scope
 * ("· outside the scope" — a record is never hidden by a plan drawn after it), then any RETIRED one
 * that has a record in THIS session ("· retired", read-only). A session with no stated scope (every
 * one from before 2026-09-13) offers every active metric, as before. `recordedTypeIds` is every
 * type with a result OR an observation OR a not-assessed mark saved here.
 */
export function sessionMetricChips<T extends TypeLike>(
  types: T[], entries: EntryLike[], recordedTypeIds: Iterable<string> = [], scopeMetricIds: string[] | null = null,
): SessionMetricChip<T>[] {
  const byOrder = (a: T, b: T) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const withRows = new Set<string>([...entries.map(e => e.measurableTypeId), ...recordedTypeIds]);
  const scope = scopeMetricIds ? new Set(scopeMetricIds) : null;
  // In scope first (library order), then the outside-the-scope ones — the plan reads before its exceptions.
  const active = types.filter(t => t.isActive && (!scope || scope.has(t.id) || withRows.has(t.id)))
    .map(type => ({ type, retired: false, hasRows: withRows.has(type.id), outsideScope: !!scope && !scope.has(type.id) }))
    .sort((a, b) => Number(a.outsideScope) - Number(b.outsideScope) || byOrder(a.type, b.type));
  const retired = types.filter(t => !t.isActive && withRows.has(t.id)).sort(byOrder)
    .map(type => ({ type, retired: true, hasRows: true, outsideScope: false }));
  return [...active, ...retired];
}

/**
 * Where a session OPENS when nothing is chosen yet. A session WITH a plan opens on the plan: the
 * first planned chip that already holds rows (a resumed session lands on its own work), else the
 * plan's first chip. A session with NO plan (before 2026-09-13) opens on the first metric it holds
 * rows for — even one since retired — else the first active one. Never a chip that is not on the
 * list.
 */
export function defaultSessionChip<T extends TypeLike>(chips: SessionMetricChip<T>[], scoped = false): SessionMetricChip<T> | null {
  if (scoped) {
    const planned = chips.filter(c => !c.retired && !c.outsideScope);
    return planned.find(c => c.hasRows) ?? planned[0] ?? chips.find(c => c.hasRows) ?? chips[0] ?? null;
  }
  return chips.find(c => c.hasRows) ?? chips[0] ?? null;
}

/** The definitions a plan may name — active ones; a retired definition cannot be in a new plan. */
export function planCandidates<T extends TypeLike>(types: T[]): T[] {
  return types.filter(t => t.isActive);
}

export interface SessionRow<P extends PlayerLike, E extends EntryLike, N extends NotAssessedLike = NotAssessedLike, O extends ObservationLike = ObservationLike> {
  player: P;
  /** Every saved attempt for this player under the selected metric, in attempt order. */
  entries: E[];
  /** The observation for this player under the selected skill, if one was recorded. */
  observation: O | null;
  /** The "not assessed" mark for this player under the selected metric, if one was made. */
  notAssessed: N | null;
  /** THE rule: a result or an observation is a record. */
  recorded: boolean;
  /** No longer on the active roster — kept because a record was saved here. Read-only. */
  pastParticipant: boolean;
  /** In the session's stated scope. Always true when the session has no scope. */
  inScope: boolean;
}

/**
 * The grid, ROSTER ORDER ONLY (never re-sorted by result — binding), followed by any past
 * participant who has a record under the selected metric. A departed player with nothing under
 * this metric is not a row: there is nothing to review and nothing may be entered for them.
 *
 * With a SCOPE (Phase 2): the scoped players are the rows; a roster player outside the scope
 * appears only if something was recorded or marked for them here, flagged `inScope: false` — a
 * record is never hidden by a scope drawn after it.
 */
export function sessionRows<P extends PlayerLike, E extends EntryLike, N extends NotAssessedLike = NotAssessedLike, O extends ObservationLike = ObservationLike>(
  roster: P[], pastParticipants: P[], entries: E[], typeId: string,
  opts: { scopePlayerIds?: string[] | null; notAssessed?: N[]; observations?: O[] } = {},
): SessionRow<P, E, N, O>[] {
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
  const seen = new Map<string, O>();
  for (const o of opts.observations ?? []) if (o.measurableTypeId === typeId && !seen.has(o.playerId)) seen.set(o.playerId, o);
  const scope = opts.scopePlayerIds ? new Set(opts.scopePlayerIds) : null;
  const row = (player: P, pastParticipant: boolean): SessionRow<P, E, N, O> => {
    const list = byPlayer.get(player.id) ?? [];
    const observation = seen.get(player.id) ?? null;
    return {
      player,
      entries: list,
      observation,
      notAssessed: marks.get(player.id) ?? null,
      recorded: list.length > 0 || observation !== null,
      pastParticipant,
      inScope: scope ? scope.has(player.id) : true,
    };
  };
  const hasRecord = (id: string) => byPlayer.has(id) || marks.has(id) || seen.has(id);
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
 * never people: a since-deactivated player's result must not produce "15 of 14", and a player's
 * three attempts must not produce "3 of 14" for one child. A past participant's record is listed
 * but never counted (they are not in "M"); a player outside the scope is listed but never counted
 * either. Never a zero invented: "not recorded" is the remainder, not a value.
 */
export function sessionScopeCounts<P extends PlayerLike, E extends EntryLike>(
  rows: SessionRow<P, E>[], scopePlayerIds: string[] | null | undefined,
): SessionScopeCounts {
  const counted = rows.filter(r => !r.pastParticipant && r.inScope);
  const recorded = counted.filter(r => r.recorded).length;
  const notAssessed = counted.filter(r => !r.recorded && r.notAssessed).length;
  const total = counted.length;
  return { scoped: !!scopePlayerIds, recorded, notAssessed, notRecorded: total - recorded - notAssessed, total };
}

/** "3 of 12 recorded — the whole roster" · "4 recorded · 1 not assessed · 1 not recorded — of 6 in scope". */
export function scopeSentence(c: SessionScopeCounts): string {
  if (!c.scoped) return `${c.recorded} of ${c.total} recorded — the whole roster`;
  return `${c.recorded} recorded · ${c.notAssessed} not assessed · ${c.notRecorded} not recorded — of ${c.total} in scope`;
}

/** A chip's done-count (C3): the in-scope players ACCOUNTED FOR — recorded or marked — of those counted. */
export function chipProgress(c: SessionScopeCounts): { done: number; total: number } {
  return { done: c.recorded + c.notAssessed, total: c.total };
}

/**
 * Every chip's done-count in ONE pass — the same figure `chipProgress(sessionScopeCounts(sessionRows(…)))`
 * gives per metric, without materialising the grid's rows once per chip on every render. With a
 * plan: accounted (a result, an observation or a mark) of the planned players still on the active
 * roster. Without one: recorded (a result or an observation) of the active roster — the legacy
 * "N of M entered", where a mark is not an entry.
 */
export function chipProgressByType<P extends PlayerLike>(
  session: Pick<ScopeLike, 'scopePlayerIds'>, metricIds: Iterable<string>, roster: P[],
  entries: Iterable<{ playerId: string; measurableTypeId: string }>,
  notAssessed: Iterable<{ playerId: string; measurableTypeId: string }>,
  observations: Iterable<{ playerId: string; measurableTypeId: string }>,
): Map<string, { done: number; total: number }> {
  const active = new Set(roster.map(p => p.id));
  const counted = session.scopePlayerIds ? session.scopePlayerIds.filter(id => active.has(id)) : roster.map(p => p.id);
  const cells = session.scopePlayerIds ? accountedCellKeys(entries, notAssessed, observations) : accountedCellKeys(entries, [], observations);
  const out = new Map<string, { done: number; total: number }>();
  for (const m of metricIds) {
    let done = 0;
    for (const p of counted) if (cells.has(cellKey(p, m))) done += 1;
    out.set(m, { done, total: counted.length });
  }
  return out;
}

// ── the ONE counting rule, as the sessions reader reads it ────────────────────────────────────────
const cellKey = (playerId: string, metricId: string) => `${playerId}|${metricId}`;

/** Every (player, metric) cell that holds SOMETHING here: a result, an observation, or a not-assessed mark. */
export function accountedCellKeys(
  entries: Iterable<{ playerId: string; measurableTypeId: string }>,
  notAssessed: Iterable<{ playerId: string; measurableTypeId: string }>,
  observations: Iterable<{ playerId: string; measurableTypeId: string }>,
): Set<string> {
  const cells = new Set<string>();
  for (const r of entries) cells.add(cellKey(r.playerId, r.measurableTypeId));
  for (const r of notAssessed) cells.add(cellKey(r.playerId, r.measurableTypeId));
  for (const r of observations) cells.add(cellKey(r.playerId, r.measurableTypeId));
  return cells;
}

/**
 * How much of a scoped session is still to do — the list's state, the Overview's "left unfinished"
 * line and the review all read this. `unrecorded` = in-scope cells holding NOTHING; `total` = the
 * cells that count. A scoped player who has since left the active roster is listed on the session
 * but never counted (the denominator `sessionScopeCounts` uses). Null when no scope was stated —
 * nothing to count against. ⚠ A row with ONE attempt of several is recorded (C9): "fewer than
 * planned" is a glance in the review, never an unfinished session.
 */
export function scopeCompleteness(
  scope: Pick<ScopeLike, 'scopeMetricIds' | 'scopePlayerIds'>, accounted: Set<string>, activePlayerIds: Set<string>,
): { unrecorded: number; total: number } | null {
  if (!scope.scopeMetricIds || !scope.scopePlayerIds) return null;
  const counted = scope.scopePlayerIds.filter(p => activePlayerIds.has(p));
  let unrecorded = 0;
  for (const p of counted) for (const m of scope.scopeMetricIds) if (!accounted.has(cellKey(p, m))) unrecorded += 1;
  return { unrecorded, total: counted.length * scope.scopeMetricIds.length };
}

/**
 * A session's name — the Sessions list's row text AND the session page's title (C6: the coach lands
 * where the list said). "Wed, Jun 10 — Phase 2 probe — scoped".
 */
export function sessionTitle(s: { sessionDate: string; note: string | null }): string {
  return `${formatWeekdayDate(s.sessionDate, 'short')}${s.note ? ` — ${s.note}` : ''}`;
}

/** The list's State column (C5): "unfinished" while a cell holds nothing, "complete" once none does, null with no scope. */
export function sessionState(s: { unrecordedCount?: number | null; scopeCellCount?: number | null }): 'unfinished' | 'complete' | null {
  if (s.unrecordedCount == null || s.scopeCellCount == null) return null;
  return s.unrecordedCount > 0 ? 'unfinished' : 'complete';
}

// ── the count per test (C1, C2) ───────────────────────────────────────────────────────────────────

/** The attempts planned for one test in this session — null on a session from before the count existed. */
export function plannedAttempts(session: Pick<ScopeLike, 'scopeAttempts'>, typeId: string): number | null {
  const n = session.scopeAttempts?.[typeId];
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_ATTEMPTS) : null;
}

/**
 * How many boxes a row shows (C2 — the plan is a FLOOR, never a ceiling): the planned count (one
 * on a session with no count), never fewer than the attempts already saved (a lowered plan never
 * hides a saved attempt), plus what the coach added with the row's "+" — capped at five, the most
 * any row takes on any test. `canAddMore` is whether the "+" is still offered.
 */
export function attemptBoxes(args: { planned: number | null; savedMax: number; extra: number }): { boxes: number; canAddMore: boolean } {
  const floor = Math.max(1, args.planned ?? 1, args.savedMax);
  const boxes = Math.min(MAX_ATTEMPTS, floor + Math.max(0, args.extra));
  return { boxes, canAddMore: boxes < MAX_ATTEMPTS };
}

/**
 * The pre-fill for "What are we running?" (C1): for each test, the count the team used the LAST
 * time it ran that test (the newest session whose plan names it), else the definition's stored
 * count (the seed for a test no session has run since the count moved), else one. `sessions` is
 * newest-first, as the reader returns them. A skill has no count.
 */
export function lastPlannedCounts<T extends TypeLike>(sessions: Pick<ScopeLike, 'scopeAttempts'>[], types: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of types) {
    if (t.kind === 'skill') continue;
    let last: number | null = null;
    for (const s of sessions) { last = plannedAttempts(s, t.id); if (last !== null) break; }
    out[t.id] = last ?? Math.min(MAX_ATTEMPTS, Math.max(1, t.attemptsPerSession ?? 1));
  }
  return out;
}

// ── the plan is a list you BUILD (C11, 2026-09-15) ────────────────────────────────────────────────

/**
 * "Tonight starts as last time" (C11): a new session's plan opens as the metric ids of the newest
 * session that stated a plan — filtered to the definitions on offer (a retired test cannot be on
 * a plan) — never as the whole library ticked. At four metrics "everything" was the right guess;
 * at twenty-four it was a claim the coach took back twenty times, and a missed one put a test
 * nobody ran on the record. Null when no session has stated a plan (or the last plan's tests have
 * all since retired): the sheet then opens as the whole library — the only honest guess for a
 * first session, and today's behaviour. `sessions` newest-first, as the reader returns them.
 */
export function lastPlanMetricIds<T extends TypeLike>(sessions: Pick<ScopeLike, 'scopeMetricIds'>[], types: T[]): string[] | null {
  const offered = new Set(types.map(t => t.id));
  for (const s of sessions) {
    if (!s.scopeMetricIds) continue;
    const ids = s.scopeMetricIds.filter(id => offered.has(id));
    return ids.length > 0 ? ids : null;
  }
  return null;
}

/**
 * The picker's caption per metric (C11): the date of the newest session whose plan named it —
 * "last run 26 Aug" — or null, "never run". Read from the sessions the sheet already holds, so it
 * costs no read; a session from before plans existed states nothing about what it ran, so it says
 * nothing here. It answers a real coaching question — what haven't we measured lately? — where the
 * coach is choosing, without a report.
 */
export function lastRunDates(sessions: (Pick<ScopeLike, 'scopeMetricIds'> & { sessionDate: string })[], types: TypeLike[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const t of types) {
    out[t.id] = sessions.find(s => s.scopeMetricIds?.includes(t.id))?.sessionDate ?? null;
  }
  return out;
}

/**
 * The plan's own sentence — "5 players · 3 tests · 1 skill" — for the when-line, the list's Ran
 * column and the review's subtitle (one builder; one word per kind, B1). Null with no scope.
 * `types` resolves the kind; an id the library no longer knows counts as a test.
 */
export function scopeSummary(scope: Pick<ScopeLike, 'scopeMetricIds' | 'scopePlayerIds'>, types: TypeLike[]): string | null {
  if (!scope.scopeMetricIds || !scope.scopePlayerIds) return null;
  const kinds = new Map(types.map(t => [t.id, t.kind ?? 'test']));
  const skills = scope.scopeMetricIds.filter(id => kinds.get(id) === 'skill').length;
  const tests = scope.scopeMetricIds.length - skills;
  const parts = [`${scope.scopePlayerIds.length} player${scope.scopePlayerIds.length === 1 ? '' : 's'}`];
  if (tests > 0) parts.push(`${tests} test${tests === 1 ? '' : 's'}`);
  if (skills > 0) parts.push(`${skills} skill${skills === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

// ── the review (C8, C9): a table of counts, then the NAMES ────────────────────────────────────────
export interface ReviewNames {
  /** Nothing yet — still to do. */
  notRecorded: string[];
  /** "Casey — absent": accounted for, done. */
  notAssessed: string[];
  /** "Avery (1 of 2)": recorded with fewer attempts than tonight's plan. Empty on a pre-count session. */
  fewer: string[];
}
export interface ReviewRow<T extends TypeLike> {
  type: T;
  retired: boolean;
  outsideScope: boolean;
  counts: SessionScopeCounts;
  names: ReviewNames;
  /** Nothing recorded and nothing marked under this test — "Didn't run it tonight" may drop it (C9). */
  droppable: boolean;
}

/**
 * One row per metric the session touched — the scope, then anything recorded outside it, then the
 * retired — with the counts from the ONE rule and the names a coach acts on before leaving the
 * field. Stores nothing (station 4, as ruled). `name` renders a player; `reason` is the
 * not-assessed mark's word.
 */
export function sessionReview<
  P extends PlayerLike, E extends EntryLike, T extends TypeLike,
  N extends NotAssessedLike & { reason?: string | null } = NotAssessedLike & { reason?: string | null },
  O extends ObservationLike = ObservationLike,
>(args: {
  session: ScopeLike;
  types: T[];
  roster: P[];
  pastParticipants: P[];
  entries: E[];
  notAssessed: N[];
  observations: O[];
  name: (p: P) => string;
}): ReviewRow<T>[] {
  const recordedTypeIds = [...args.observations.map(o => o.measurableTypeId), ...args.notAssessed.map(n => n.measurableTypeId)];
  const chips = sessionMetricChips(args.types, args.entries, recordedTypeIds, args.session.scopeMetricIds);
  // With no scope, every active chip is offered for entry — the review reads only what holds a record.
  const scoped = !!args.session.scopeMetricIds;
  return chips
    .filter(c => scoped ? (!c.outsideScope || c.hasRows) : c.hasRows)
    .map(c => {
      const rows = sessionRows(args.roster, args.pastParticipants, args.entries, c.type.id, {
        scopePlayerIds: args.session.scopePlayerIds, notAssessed: args.notAssessed, observations: args.observations,
      });
      const counts = sessionScopeCounts(rows, args.session.scopePlayerIds);
      const counted = rows.filter(r => !r.pastParticipant && r.inScope);
      const planned = c.type.kind === 'skill' ? null : plannedAttempts(args.session, c.type.id);
      const names: ReviewNames = {
        notRecorded: counted.filter(r => !r.recorded && !r.notAssessed).map(r => args.name(r.player)),
        notAssessed: counted.filter(r => !r.recorded && r.notAssessed).map(r => `${args.name(r.player)}${r.notAssessed?.reason ? ` — ${r.notAssessed.reason}` : ''}`),
        fewer: planned && planned > 1
          ? counted.filter(r => r.entries.length > 0 && r.entries.length < planned).map(r => `${args.name(r.player)} (${r.entries.length} of ${planned})`)
          : [],
      };
      return {
        type: c.type, retired: c.retired, outsideScope: c.outsideScope, counts, names,
        droppable: scoped && !c.outsideScope && !c.retired && !c.hasRows,
      };
    });
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
 * "At a practice" options in the order a coach looks for them (Practice Plans §10.2 ruling 2):
 * practices first, then everything else, each by how close it sits to the anchor date. Nothing is
 * filtered out — a coach who tested at a Saturday scrimmage warm-up must still find it. ONE home:
 * the session sheet reads it in both modes.
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
