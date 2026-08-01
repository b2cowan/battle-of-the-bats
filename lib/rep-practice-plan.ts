/**
 * Practice Plans — the plan that lives on a practice event (Player Development Phase 4, slice 1a).
 *
 * Stored as one additive nullable `jsonb` column, `rep_team_events.practice_plan` — the exact
 * precedent set by mig 162's `resources`. Validity and every cap are enforced HERE (app layer),
 * not by DB constraints, and `sanitizePracticePlan` runs on every write path.
 *
 * Three rules from the plan doc are load-bearing and are implemented in this file rather than
 * left to the UI, so no surface can quietly breach them:
 *
 *  1. **Supportive, never ranking (§4).** `drawGroups` is DELIBERATELY dumb — a shuffle and a
 *     deal. There is no balancing by ability, no grouping by focus area, and no sort of any
 *     kind. "Draw again" re-draws; it never optimises. Any future "smarter" draw is a design
 *     decision, not an implementation detail.
 *  2. **"Planned", never "done" (§4).** Nothing in this module records what happened. There is
 *     no completion flag, no tick, no elapsed-time store — only intent.
 *  3. **Never tidy the arithmetic (D25).** `computeRotation` never invents a round and never
 *     drops a station to make the numbers divide. A mismatch is STATED in plain words and the
 *     grid is rendered as it truly falls out.
 *
 * Clock arithmetic runs through `lib/timezone.ts` (binding guardrail — never raw UTC date math).
 */
import { formatInOrgZone } from './timezone';
import type {
  PracticeDuration, PracticeGroup, PracticeGroupSource,
  PracticePlan, PracticePlanBlock, PracticeRotation, PracticeStation,
} from './types';

// Re-exported so a caller can take the model and its types from one place.
export type {
  PracticeDuration, PracticeGroup, PracticeGroupSource,
  PracticePlan, PracticePlanBlock, PracticeRotation, PracticeStation,
} from './types';

/**
 * Do this block's stations rotate?
 *
 * THE single answer, used by the sanitiser, the builder, the printed sheet and the grid — so
 * "does this rotate?" can never be decided two different ways. Rotation defaults ON (the owner's
 * reference practice is a carousel) but needs at least two stations to mean anything: one station
 * with three groups queued behind it is not a rotation, it is a queue.
 */
export function blockRotates(block: Pick<PracticePlanBlock, 'rotates' | 'stations'>): boolean {
  return (block.rotates ?? true) && (block.stations?.length ?? 0) >= 2;
}

/**
 * Which group(s) START at a given station (round 1 of the carousel).
 *
 * Groups move forward one station per round, so in round 1 group *i* is at station *i*. With more
 * groups than stations, two groups share a start — both are returned rather than one silently
 * winning, because the station card has to be able to say so.
 */
export function startingGroupsForStation(
  rotation: PracticeRotation | null | undefined,
  stationCount: number,
  stationIndex: number,
): PracticeGroup[] {
  if (!rotation || stationCount <= 0) return [];
  return rotation.groups.filter((_, i) => i % stationCount === stationIndex);
}

// ── Caps (app-layer; there are no DB constraints on the jsonb) ───────────────
export const MAX_BLOCKS = 30;
export const MAX_STATIONS_PER_BLOCK = 12;
export const MAX_GROUPS = 12;
export const MAX_STAFF_PER_ITEM = 8;
export const MAX_TAGS_PER_ITEM = 12;
export const MAX_COACHING_POINTS = 8;
export const MAX_TITLE_LEN = 120;
export const MAX_TEXT_LEN = 600;
export const MAX_SHORT_TEXT_LEN = 200;
export const MAX_MINUTES = 600;

/** Practice plan schema version — bump only for a shape change that needs a read-time migration. */
export const PRACTICE_PLAN_VERSION = 1;

// ── Shape ────────────────────────────────────────────────────────────────────
// The interfaces live in `lib/types.ts` (a pure leaf with no imports) and every RULE lives here —
// the same split as `RepEventResource` / `lib/rep-event-resources.ts`. Each field's reasoning, and
// the owner decision it implements (D12 staff-as-labels, D13 durations, D21 groups, D22–D26 the
// rotation, D27 the station's drill/practice split), is documented on the declarations there.

/** An empty plan — what "no plan yet" means in code, so no surface has to null-check a shape. */
export function emptyPracticePlan(): PracticePlan {
  return { version: PRACTICE_PLAN_VERSION, blocks: [] };
}

/** True when a plan holds nothing worth storing (so the column goes back to NULL). */
export function isPracticePlanEmpty(plan: PracticePlan | null | undefined): boolean {
  if (!plan) return true;
  return !plan.goal?.trim() && !plan.equipment?.length && !plan.practiceTypes?.length && plan.blocks.length === 0;
}

// ── Sanitiser ────────────────────────────────────────────────────────────────

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function optionalStr(v: unknown, max: number): string | undefined {
  const s = str(v, max);
  return s || undefined;
}

/** A positive whole number within `max`, or null. Rejects NaN/Infinity/negatives outright. */
function posInt(v: unknown, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i > 0 && i <= max ? i : null;
}

function strList(v: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    const s = str(raw, maxLen);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue; // a name twice on one station is a mis-tap, not an intent
    seen.add(key);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out.length ? out : undefined;
}

/** Ids are client-generated (crypto.randomUUID) — accept any short opaque string, or mint one. */
function id(v: unknown, fallback: string): string {
  const s = str(v, 64);
  return s || fallback;
}

function sanitizeDuration(v: unknown): PracticeDuration {
  const raw = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  if (raw.restOfPractice === true) return { minutes: null, restOfPractice: true };
  // A legacy `toMinutes` is simply dropped — ranges were removed (see PracticeDuration).
  return { minutes: posInt(raw.minutes, MAX_MINUTES) };
}

/**
 * How long each round runs when the coach hasn't said: the block's length shared evenly across
 * its stations, so everyone gets exactly one turn at each.
 *
 * Derived rather than written on creation, so it keeps following the block's length and the
 * number of stations while the coach is still moving them around. The moment they type a number
 * it becomes theirs and stops moving.
 */
export function defaultIntervalMinutes(
  totalMinutes: number | null | undefined,
  stationCount: number,
): number | null {
  if (!totalMinutes || stationCount <= 0) return null;
  const each = Math.floor(totalMinutes / stationCount);
  return each > 0 ? each : null;
}

/**
 * Is this even a row, as opposed to junk in the array?
 *
 * ⚠ This is the ONLY thing that discards a block or a station. Emptiness deliberately is NOT:
 * a row exists because the coach pressed "Add", and that press is the intent. Judging a row on
 * whether it had been typed into yet meant autosave — which fires about a second after you stop —
 * could delete the station you had just created and were about to name. It looked fine on screen
 * (the response isn't applied) and was simply gone on reload: three stations added, one left.
 *
 * Abandoned rows are the coach's to delete, and every one carries a visible bin. The plan as a
 * whole still collapses to NULL when there is genuinely nothing in it (`isPracticePlanEmpty`).
 */
function isRowLike(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** A tag list that tolerates a legacy single string (equipment used to be free text). */
function tagList(v: unknown, maxItems: number, maxLen: number): string[] | undefined {
  if (typeof v === 'string') return strList([v], maxItems, maxLen);
  return strList(v, maxItems, maxLen);
}

function sanitizeStation(v: unknown, index: number): PracticeStation | null {
  if (!isRowLike(v)) return null;
  const raw = v;
  const station: PracticeStation = { id: id(raw.id, `s${index}`), name: str(raw.name, MAX_TITLE_LEN) };
  const count = posInt(raw.count, 99);
  if (count != null) station.count = count;
  const equipment = tagList(raw.equipment, MAX_TAGS_PER_ITEM, MAX_TITLE_LEN);
  if (equipment) station.equipment = equipment;
  const setup = optionalStr(raw.setup, MAX_TEXT_LEN);
  if (setup) station.setup = setup;
  const points = strList(raw.coachingPoints, MAX_COACHING_POINTS, MAX_SHORT_TEXT_LEN);
  if (points) station.coachingPoints = points;
  const staff = strList(raw.staff, MAX_STAFF_PER_ITEM, MAX_TITLE_LEN);
  if (staff) station.staff = staff;
  const playerIds = strList(raw.playerIds, 60, 64);
  if (playerIds) station.playerIds = playerIds;
  const rotationNote = optionalStr(raw.rotationNote, MAX_SHORT_TEXT_LEN);
  if (rotationNote) station.rotationNote = rotationNote;
  const note = optionalStr(raw.note, MAX_TEXT_LEN);
  if (note) station.note = note;
  // Kept even when nothing has been typed yet — the coach pressed "Add a station", and autosave
  // must not delete what they are in the middle of creating. See isRowLike.
  return station;
}

const GROUP_SOURCES: PracticeGroupSource[] = ['manual', 'random', 'previous'];

function sanitizeRotation(v: unknown): PracticeRotation | null {
  if (!v || typeof v !== 'object') return null;
  const raw = v as Record<string, unknown>;
  const groups: PracticeGroup[] = [];
  /**
   * ⚠ A PLAYER BELONGS TO EXACTLY ONE GROUP. Tracked across the whole rotation, so a player who
   * appears in a second group is dropped from it rather than being in two places at once — which
   * the grid would then render as one child standing at two stations in the same round.
   */
  const placed = new Set<string>();
  if (Array.isArray(raw.groups)) {
    for (const g of raw.groups) {
      const gr = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>;
      const playerIds = (strList(gr.playerIds, 60, 64) ?? []).filter(pid => {
        if (placed.has(pid)) return false;
        placed.add(pid);
        return true;
      });
      // groupLabel(), not a second inline copy of it: the inline version stopped at Z, so
      // raising MAX_GROUPS past 26 would have produced garbage characters here while the draw
      // produced "Group A2". One naming rule, one place.
      const name = str(gr.name, 60) || groupLabel(groups.length);
      groups.push({ id: id(gr.id, `g${groups.length}`), name, playerIds });
      if (groups.length >= MAX_GROUPS) break;
    }
  }
  const source = typeof raw.groupSource === 'string' && GROUP_SOURCES.includes(raw.groupSource as PracticeGroupSource)
    ? raw.groupSource as PracticeGroupSource
    : 'manual';
  return {
    intervalMinutes: posInt(raw.intervalMinutes, MAX_MINUTES),
    groups,
    groupSource: source,
  };
}

/**
 * @param restAlreadyUsed another block in this plan already claims "rest of practice" (D13 allows
 *   exactly one). Applied BEFORE the substance gate, deliberately: downgrading the duration
 *   afterwards could hollow a block out and leave it in the array anyway, so the write kept a
 *   block that the very next read then dropped — a block vanishing in the same breath that saved it.
 */
function sanitizeBlock(v: unknown, index: number, restAlreadyUsed: boolean): PracticePlanBlock | null {
  if (!isRowLike(v)) return null;
  const raw = v;
  // Rotation defaults ON. `shape: 'activity'` is the pre-2026-08-01 spelling of "don't rotate".
  const rotates = typeof raw.rotates === 'boolean' ? raw.rotates : raw.shape !== 'activity';
  const title = str(raw.title, MAX_TITLE_LEN);

  const stations: PracticeStation[] = [];
  if (Array.isArray(raw.stations)) {
    for (const s of raw.stations) {
      const station = sanitizeStation(s, stations.length);
      if (station) stations.push(station);
      if (stations.length >= MAX_STATIONS_PER_BLOCK) break;
    }
  }

  const parsedDuration = sanitizeDuration(raw.duration);
  // A second "rest of practice" claim loses the flag; the block keeps everything else.
  const duration: PracticeDuration = parsedDuration.restOfPractice && restAlreadyUsed
    ? { minutes: null }
    : parsedDuration;
  const block: PracticePlanBlock = { id: id(raw.id, `b${index}`), title, duration };
  // Only written when it differs from the default, which keeps an untouched block small.
  if (!rotates) block.rotates = false;
  const description = optionalStr(raw.description, MAX_TEXT_LEN);
  if (description) block.description = description;
  const goal = optionalStr(raw.goal, MAX_TEXT_LEN);
  if (goal) block.goal = goal;
  const staff = strList(raw.staff, MAX_STAFF_PER_ITEM, MAX_TITLE_LEN);
  if (staff) block.staff = staff;
  const playerIds = strList(raw.playerIds, 60, 64);
  if (playerIds) block.playerIds = playerIds;
  const points = strList(raw.coachingPoints, MAX_COACHING_POINTS, MAX_SHORT_TEXT_LEN);
  if (points) block.coachingPoints = points;
  if (stations.length) block.stations = stations;

  /**
   * ⚠ PEOPLE LIVE AT EXACTLY ONE LEVEL (owner ruling 2026-08-01). Enforced here rather than trusted
   * to the UI, so a stale client or a hand-rolled payload can never produce two disagreeing answers
   * to "who is at this station?" — and so the printed sheet can render one list without choosing.
   *   · no stations        → the block's own player list
   *   · stations, separate → each station's list
   *   · stations, rotating → the rotation's groups, and nothing else
   */
  const rotating = blockRotates(block as PracticePlanBlock);
  if (rotating) {
    block.rotation = sanitizeRotation(raw.rotation)
      ?? { intervalMinutes: null, groups: [], groupSource: 'manual' };
  }
  if (stations.length > 0) delete block.playerIds;
  if (rotating && block.stations) {
    block.stations = block.stations.map((station) => {
      const stripped = { ...station };
      delete stripped.playerIds;
      return stripped;
    });
  }

  // Kept even when nothing has been typed yet — the coach pressed "Add a block". See isRowLike.
  return block;
}

/**
 * Server-side cleanup: the ONLY gate on what reaches the column. Caps every list and length, and
 * enforces the one structural invariant a coach can otherwise breach — **at most one "rest of
 * practice" block per plan** (D13); a later claim loses the flag but keeps everything else.
 *
 * ⚠ It does NOT discard rows for being empty. Autosave fires about a second after typing stops,
 * so a rule like that would delete the station the coach had just added and was about to name.
 * See `isRowLike`.
 *
 * ⚠ IDEMPOTENT BY REQUIREMENT, not by accident: this runs on every write AND on every read
 * (`parsePracticePlan` in the event mapper). If sanitising twice could produce a different
 * result, a plan would change shape between being saved and being read back.
 *
 * `rosterPlayerIds`, when supplied, restricts every player reference to the CURRENT roster, so a
 * stale client (or a hand-rolled request) can't attach a player from another team.
 */
export function sanitizePracticePlan(
  input: unknown,
  rosterPlayerIds?: ReadonlySet<string>,
): PracticePlan | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;

  const blocks: PracticePlanBlock[] = [];
  let restUsed = false;
  if (Array.isArray(raw.blocks)) {
    for (const b of raw.blocks) {
      const block = sanitizeBlock(b, blocks.length, restUsed);
      if (!block) continue;
      if (block.duration.restOfPractice) restUsed = true;
      blocks.push(block);
      if (blocks.length >= MAX_BLOCKS) break;
    }
  }

  const plan: PracticePlan = { version: PRACTICE_PLAN_VERSION, blocks };
  const goal = optionalStr(raw.goal, MAX_TEXT_LEN);
  if (goal) plan.goal = goal;
  const practiceTypes = tagList(raw.practiceTypes, MAX_TAGS_PER_ITEM, MAX_TITLE_LEN);
  if (practiceTypes) plan.practiceTypes = practiceTypes;
  // "kit" was the pre-2026-08-01 free-text spelling of the same idea.
  const equipment = tagList(raw.equipment ?? raw.kit, MAX_TAGS_PER_ITEM, MAX_TITLE_LEN);
  if (equipment) plan.equipment = equipment;

  const scoped = rosterPlayerIds ? restrictToRoster(plan, rosterPlayerIds) : plan;
  return isPracticePlanEmpty(scoped) ? null : scoped;
}

/**
 * A fresh id for a block, station or group.
 *
 * Ids are minted client-side (they only have to be unique within one plan's jsonb, never across
 * rows), and this lives here so the builder, the copy-forward path and `copyPracticePlanForReuse`
 * all mint them the same way rather than each carrying its own copy of the fallback.
 */
export function newPracticePlanId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `pp-${Math.random().toString(36).slice(2)}`;
}

/** Drop every player reference that isn't a current roster id (blocks, stations, groups). */
function restrictToRoster(plan: PracticePlan, rosterPlayerIds: ReadonlySet<string>): PracticePlan {
  const keep = (ids?: string[]) => {
    if (!ids) return undefined;
    const filtered = ids.filter(pid => rosterPlayerIds.has(pid));
    return filtered.length ? filtered : undefined;
  };
  return {
    ...plan,
    blocks: plan.blocks.map(block => ({
      ...block,
      playerIds: keep(block.playerIds),
      stations: block.stations?.map(s => ({ ...s, playerIds: keep(s.playerIds) })),
      rotation: block.rotation
        ? { ...block.rotation, groups: block.rotation.groups.map(g => ({ ...g, playerIds: g.playerIds.filter(pid => rosterPlayerIds.has(pid)) })) }
        : block.rotation,
    })),
  };
}

/** Read a stored value back into a plan, tolerating a pre-migration `undefined`/null column. */
export function parsePracticePlan(value: unknown): PracticePlan | null {
  if (value == null) return null;
  return sanitizePracticePlan(value);
}

// ── The running clock (D13) ──────────────────────────────────────────────────

export interface BlockClock {
  blockId: string;
  /**
   * The block's start as a real instant (epoch ms).
   *
   * Returned alongside the label so no caller has to re-walk the block list to recover it — the
   * rotation grid needs it to time its rounds, and the printed sheet needs it too. One walk, one
   * place that knows how "rest of practice" affects the running clock.
   */
  startMs: number;
  /** "6:00 PM" — the block's start, in the ORG's timezone (never the reader's). */
  startLabel: string;
  /** The block's end at its FLOOR duration, or null when it can't be known. */
  endLabel: string | null;
  /** True for the single "rest of practice" block. */
  restOfPractice: boolean;
}

const CLOCK_FORMAT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

/**
 * The running time column: the coach types minutes, the product does the clock.
 *
 * All arithmetic is elapsed-minutes on a real INSTANT, formatted in the org's zone through
 * `lib/timezone.ts` — never raw UTC date math on a naive string, which is the guardrail this
 * codebase has paid for twice (J3-047, J6-056).
 *
 * A "rest of practice" block runs from its start to the event's end time; with no end time set,
 * its end is honestly unknown and renders as null rather than a guess.
 */
export function computeBlockClocks(
  blocks: readonly PracticePlanBlock[],
  eventStartsAt: string | null | undefined,
  eventEndsAt: string | null | undefined,
): BlockClock[] {
  if (!eventStartsAt) return [];
  const startMs = new Date(eventStartsAt).getTime();
  if (Number.isNaN(startMs)) return [];
  const endMs = eventEndsAt ? new Date(eventEndsAt).getTime() : NaN;
  const at = (ms: number) => formatInOrgZone(new Date(ms).toISOString(), CLOCK_FORMAT);

  let cursor = startMs;
  return blocks.map(block => {
    const blockStart = cursor;
    if (block.duration.restOfPractice) {
      const hasEnd = !Number.isNaN(endMs) && endMs > blockStart;
      if (hasEnd) cursor = endMs;
      return {
        blockId: block.id,
        startMs: blockStart,
        startLabel: at(blockStart),
        endLabel: hasEnd ? at(endMs) : null,
        restOfPractice: true,
      };
    }
    const minutes = block.duration.minutes;
    const blockEnd = minutes != null ? blockStart + minutes * 60_000 : blockStart;
    if (minutes != null) cursor = blockEnd;
    return {
      blockId: block.id,
      startMs: blockStart,
      startLabel: at(blockStart),
      endLabel: minutes != null ? at(blockEnd) : null,
      restOfPractice: false,
    };
  });
}

/** "25 min" · "Rest of practice" · "" — the one duration phrasing, used by the
 *  builder, the summary and the printed sheet so they can't drift apart. */
export function formatDuration(duration: PracticeDuration): string {
  if (duration.restOfPractice) return 'Rest of practice';
  if (duration.minutes == null) return '';
  return `${duration.minutes} min`;
}

/**
 * A one-line read of a plan — "6 blocks · 90 min planned · 1 rotation".
 *
 * ⚠ The vocabulary is "planned", never "done" (§4). This summary appears on the schedule beside
 * an event that may already be in the past, which is exactly where a word like "completed" would
 * slip in and start describing something the product does not know.
 */
export function summarizePracticePlan(plan: PracticePlan): string {
  const blocks = plan.blocks.length;
  const parts = [`${blocks} block${blocks === 1 ? '' : 's'}`];
  const minutes = totalPlannedMinutes(plan);
  if (minutes > 0) parts.push(`${minutes} min planned`);
  const rotations = plan.blocks.filter(blockRotates).length;
  if (rotations > 0) parts.push(`${rotations} rotation${rotations === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** Total planned minutes at the FLOOR of every block. "Rest of practice" contributes nothing —
 *  it is unbounded by definition, and inventing a number for it would be the fake precision D13
 *  exists to refuse. */
export function totalPlannedMinutes(plan: PracticePlan): number {
  return plan.blocks.reduce((sum, b) => sum + (b.duration.restOfPractice ? 0 : (b.duration.minutes ?? 0)), 0);
}

// ── Grouping (D21) ───────────────────────────────────────────────────────────

export type DrawMode = 'groups' | 'perGroup';

/** Fisher–Yates. `rng` is injectable so the draw is testable; production passes `Math.random`. */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function groupLabel(index: number): string {
  // A..Z then A2, B2… — sport-neutral, never a position or a skill label.
  const letter = String.fromCharCode(65 + (index % 26));
  const cycle = Math.floor(index / 26);
  return `Group ${letter}${cycle > 0 ? cycle + 1 : ''}`;
}

/**
 * D21 — draw groups at random from the players who replied yes.
 *
 * ⚠ **Deliberately dumb, and that is the design.** No balancing by ability, no grouping by focus
 * area, no "even out the strong ones". Any of those would rank children against each other, which
 * §4 forbids by construction. "Draw again" re-draws; it never optimises.
 *
 * Uneven splits are produced honestly (some groups get one more) and stated by `describeSplit` —
 * never silently rounded away.
 */
export function drawGroups(
  playerIds: readonly string[],
  mode: DrawMode,
  n: number,
  rng: () => number = Math.random,
): PracticeGroup[] {
  const players = playerIds.filter(Boolean);
  if (players.length === 0 || n < 1) return [];
  const groupCount = mode === 'groups'
    ? Math.min(Math.floor(n), players.length)
    : Math.ceil(players.length / Math.floor(n));
  const count = Math.max(1, Math.min(groupCount, MAX_GROUPS, players.length));

  const shuffled = shuffle(players, rng);
  const base = Math.floor(shuffled.length / count);
  const remainder = shuffled.length % count;

  const groups: PracticeGroup[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const size = base + (i < remainder ? 1 : 0);
    groups.push({
      id: `grp-${i}-${cursor}`,
      name: groupLabel(i),
      playerIds: shuffled.slice(cursor, cursor + size),
    });
    cursor += size;
  }
  return groups;
}

/** "3 groups from 10 — one of 4, two of 3." Stated up front so an uneven split is never a
 *  surprise the coach discovers at the field (D21). */
export function describeSplit(groups: readonly PracticeGroup[]): string {
  if (groups.length === 0) return '';
  const total = groups.reduce((s, g) => s + g.playerIds.length, 0);
  const bySize = new Map<number, number>();
  for (const g of groups) bySize.set(g.playerIds.length, (bySize.get(g.playerIds.length) ?? 0) + 1);
  const sizes = [...bySize.entries()].sort((a, b) => b[0] - a[0]);
  const word = (n: number) => (n === 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : String(n));
  const parts = sizes.map(([size, count]) => `${word(count)} of ${size}`);
  return `${groups.length} group${groups.length === 1 ? '' : 's'} from ${total} — ${parts.join(', ')}.`;
}

// ── The rotation grid (D22–D26) ──────────────────────────────────────────────

export interface RotationCell {
  groupId: string;
  groupName: string;
  stationId: string;
  stationName: string;
}

export interface RotationRound {
  /** 1-based, as a coach counts them. */
  round: number;
  /** Clock label for the round's start, when the block's start time is known. */
  startLabel?: string;
  cells: RotationCell[];
}

export interface RotationGrid {
  rounds: number;
  intervalMinutes: number | null;
  totalMinutes: number | null;
  /** Minutes left over after whole rounds — STATED, never silently rounded away (D24). */
  spareMinutes: number;
  roundsList: RotationRound[];
  /**
   * Plain-language statements about what this rotation does and doesn't cover (D25).
   * Every one of these is a fact about the arithmetic, never a suggestion to change it —
   * the product NEVER invents a round or drops a station to make the numbers tidy.
   */
  notes: string[];
  /** True when there isn't enough information yet to compute anything. */
  incomplete: boolean;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Compute the group × round grid: groups move forward one station per round, coaches stay put.
 *
 * **The honest-arithmetic rule (D25) is enforced here.** When groups and stations don't match,
 * this returns the grid as it truly falls out and STATES the consequence — "Group C won't reach
 * Front toss", "Groups A and D share Tee work in round 2". It never invents a round to give
 * everyone a turn and never drops a station to make the division come out even.
 *
 * @param blockMinutes how long the BLOCK runs. The rotation has no length of its own — storing it
 *   twice only let the two numbers disagree.
 * @param blockStartMs the block's start instant, so each round can carry a clock label.
 */
export function computeRotation(
  rotation: PracticeRotation | null | undefined,
  stations: readonly PracticeStation[] | undefined,
  blockMinutes: number | null | undefined,
  blockStartMs?: number,
): RotationGrid {
  const stops = (stations ?? []).filter(s => s.name.trim().length > 0);
  // Unset means "one turn each" — see defaultIntervalMinutes.
  const intervalMinutes = rotation?.intervalMinutes ?? defaultIntervalMinutes(blockMinutes, stops.length);
  const totalMinutes = blockMinutes ?? null;
  const empty: RotationGrid = {
    rounds: 0, intervalMinutes, totalMinutes,
    spareMinutes: 0, roundsList: [], notes: [], incomplete: true,
  };
  if (!rotation) return empty;

  const groups = rotation.groups.filter(g => g.playerIds.length > 0 || g.name.trim());

  const notes: string[] = [];
  if (stops.length === 0 || groups.length === 0 || !totalMinutes || !intervalMinutes) {
    const missing: string[] = [];
    if (stops.length === 0) missing.push('at least one station');
    if (groups.length === 0) missing.push('at least one group');
    if (!totalMinutes) missing.push('how long the block runs');
    if (!intervalMinutes) missing.push('how often groups move');
    return { ...empty, notes: [`Add ${listNames(missing)} to see the rotation.`] };
  }

  const rounds = Math.floor(totalMinutes / intervalMinutes);
  const spareMinutes = totalMinutes - rounds * intervalMinutes;

  if (rounds === 0) {
    return {
      rounds: 0, intervalMinutes, totalMinutes, spareMinutes: totalMinutes, roundsList: [], incomplete: true,
      notes: [`${totalMinutes} minutes doesn't fit a single ${intervalMinutes}-minute round. Lower the interval or lengthen the block.`],
    };
  }

  const S = stops.length;
  const roundsList: RotationRound[] = [];
  for (let r = 0; r < rounds; r++) {
    const cells: RotationCell[] = groups.map((g, i) => {
      const stop = stops[(i + r) % S];
      return { groupId: g.id, groupName: g.name, stationId: stop.id, stationName: stop.name };
    });
    roundsList.push({
      round: r + 1,
      startLabel: blockStartMs != null
        ? formatInOrgZone(new Date(blockStartMs + r * intervalMinutes * 60_000).toISOString(), CLOCK_FORMAT)
        : undefined,
      cells,
    });
  }

  // ── The statements (D25) ──
  notes.push(
    `${rounds} round${rounds === 1 ? '' : 's'} of ${intervalMinutes} min`
    + (spareMinutes > 0 ? `, with ${spareMinutes} min spare.` : '.'),
  );

  // More groups than stations ⇒ two share. Say which, and when.
  for (const round of roundsList) {
    const byStation = new Map<string, string[]>();
    for (const cell of round.cells) {
      const names = byStation.get(cell.stationId) ?? [];
      names.push(cell.groupName);
      byStation.set(cell.stationId, names);
    }
    for (const [stationId, names] of byStation) {
      if (names.length > 1) {
        const stationName = stops.find(s => s.id === stationId)?.name ?? 'a station';
        notes.push(`${listNames(names)} share ${stationName} in round ${round.round}.`);
      }
    }
  }

  // Fewer rounds than stations ⇒ some groups never reach some stations. Name them.
  if (rounds < S) {
    for (let i = 0; i < groups.length; i++) {
      const visited = new Set<string>();
      for (let r = 0; r < rounds; r++) visited.add(stops[(i + r) % S].id);
      const missed = stops.filter(s => !visited.has(s.id)).map(s => s.name);
      if (missed.length > 0) notes.push(`${groups[i].name} won't reach ${listNames(missed)}.`);
    }
  } else if (rounds > S) {
    notes.push(`Everyone does everything, then starts round ${S + 1} again at their first station.`);
  } else {
    notes.push('Everyone does everything.');
  }

  return { rounds, intervalMinutes, totalMinutes, spareMinutes, roundsList, notes, incomplete: false };
}

// ── Reuse helpers (copy-from-previous + the staff vocabulary) ─────────────────

/**
 * The team's whole reusable staff vocabulary, in offer order: the coaching staff first, then every
 * distinct name already used on a previous plan, newest practice first.
 *
 * This IS D12's "team coaches offered automatically; anyone else created on the spot and
 * reusable". A name typed once appears as a suggestion on every later plan, and a typo stops
 * being suggested as soon as no plan uses it — the list self-heals rather than needing curation.
 *
 * ⚠ Every name here is a LABEL. Nothing in this list confers an account, an invitation or any
 * capability whatsoever.
 *
 * The case-insensitive, first-occurrence-wins merge lives here (one answer) rather than being
 * half-implemented again in the route that assembles the two sources.
 */
export interface PracticeTagSuggestions {
  staff: string[];
  equipment: string[];
  practiceTypes: string[];
}

export function collectStaffSuggestions(
  plans: readonly (PracticePlan | null)[],
  leadingNames: readonly string[] = [],
): string[] {
  return collectPracticeTagSuggestions(plans, leadingNames).staff;
}

/**
 * Every reusable label this team has already used — staff, equipment and practice types — in
 * offer order, gathered in ONE walk of the plans.
 *
 * ⚠ Practice types are coach-typed for a reason: "Hitting / Fielding / Pitching" is softball
 * talking. A fixed list would hard-code one sport into a platform that serves many, so the
 * vocabulary comes from what this team itself has typed before.
 */
export function collectPracticeTagSuggestions(
  plans: readonly (PracticePlan | null)[],
  leadingStaff: readonly string[] = [],
): PracticeTagSuggestions {
  const staff = new Map<string, string>();
  const equipment = new Map<string, string>();
  const types = new Map<string, string>();
  const add = (into: Map<string, string>, value: string | undefined) => {
    const v = (value ?? '').trim();
    if (v && !into.has(v.toLowerCase())) into.set(v.toLowerCase(), v);
  };

  for (const name of leadingStaff) add(staff, name);
  for (const plan of plans) {
    if (!plan) continue;
    for (const t of plan.practiceTypes ?? []) add(types, t);
    for (const e of plan.equipment ?? []) add(equipment, e);
    for (const block of plan.blocks) {
      for (const name of block.staff ?? []) add(staff, name);
      for (const station of block.stations ?? []) {
        for (const name of station.staff ?? []) add(staff, name);
        for (const e of station.equipment ?? []) add(equipment, e);
      }
    }
  }
  return {
    staff: [...staff.values()],
    equipment: [...equipment.values()],
    practiceTypes: [...types.values()],
  };
}

/**
 * Copy a plan onto a different practice: fresh ids throughout, and every player reference
 * re-checked against the CURRENT roster (a plan copied forward in October must not carry a
 * player who left in September).
 *
 * ⚠ Copying is the ONLY reuse path in slice 1a, and it is deliberately a copy — a plan belongs
 * to ONE practice (D7). Nothing here writes to a series, and no caller may pass this through the
 * recurrence edit-scope machinery.
 */
export function copyPracticePlanForReuse(
  plan: PracticePlan,
  rosterPlayerIds: ReadonlySet<string>,
  newId: () => string,
): PracticePlan {
  const scoped = restrictToRoster(plan, rosterPlayerIds);
  return {
    version: PRACTICE_PLAN_VERSION,
    ...(scoped.goal ? { goal: scoped.goal } : {}),
    ...(scoped.practiceTypes ? { practiceTypes: scoped.practiceTypes } : {}),
    ...(scoped.equipment ? { equipment: scoped.equipment } : {}),
    blocks: scoped.blocks.map(block => ({
      ...block,
      id: newId(),
      stations: block.stations?.map(s => ({ ...s, id: newId() })),
      rotation: block.rotation
        ? { ...block.rotation, groups: block.rotation.groups.map(g => ({ ...g, id: newId() })) }
        : block.rotation,
    })),
  };
}
