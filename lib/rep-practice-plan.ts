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
/** "How it went" — matched to the CHECK constraint in mig 221. */
export const MAX_RECAP_LEN = 2000;

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
  return !plan.goal?.trim() && !plan.equipment?.length && !plan.equipmentTagIds?.length
    && !plan.practiceTypes?.length && plan.blocks.length === 0;
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
  // ⚠ A legacy `count` is deliberately DROPPED, not carried (owner ruling 2026-08-01). It read as
  // "how many times" or "how long", and a coach wanting three of something adds the drill three
  // times or says so in `note`. Any 1a value simply stops being stored on the next save.
  const description = optionalStr(raw.description, MAX_TEXT_LEN);
  if (description) station.description = description;
  const goal = optionalStr(raw.goal, MAX_TEXT_LEN);
  if (goal) station.goal = goal;
  const equipment = tagList(raw.equipment, MAX_TAGS_PER_ITEM, MAX_TITLE_LEN);
  if (equipment) station.equipment = equipment;
  // Structural only (opaque id shape, capped/deduped) — LIVE membership in the team's 'equipment'
  // vocabulary is re-checked by `restrictTagIds` below, the same two-step `playerIds` already uses.
  const equipmentTagIds = strList(raw.equipmentTagIds, MAX_TAGS_PER_ITEM, 64);
  if (equipmentTagIds) station.equipmentTagIds = equipmentTagIds;
  const setup = optionalStr(raw.setup, MAX_TEXT_LEN);
  if (setup) station.setup = setup;
  const points = strList(raw.coachingPoints, MAX_COACHING_POINTS, MAX_SHORT_TEXT_LEN);
  if (points) station.coachingPoints = points;
  const staff = strList(raw.staff, MAX_STAFF_PER_ITEM, MAX_TITLE_LEN);
  if (staff) station.staff = staff;
  const staffTagIds = strList(raw.staffTagIds, MAX_STAFF_PER_ITEM, 64);
  if (staffTagIds) station.staffTagIds = staffTagIds;
  const playerIds = strList(raw.playerIds, 60, 64);
  if (playerIds) station.playerIds = playerIds;
  const rotationNote = optionalStr(raw.rotationNote, MAX_SHORT_TEXT_LEN);
  if (rotationNote) station.rotationNote = rotationNote;
  const note = optionalStr(raw.note, MAX_TEXT_LEN);
  if (note) station.note = note;
  // Provenance only — nothing renders from these (see PracticeStation.drillId). Kept opaque and
  // capped like any other client-supplied id.
  const drillId = optionalStr(raw.drillId, 64);
  if (drillId) station.drillId = drillId;
  // Tag NAMES, snapshotted at add time — never ids, so a plan renders with no dependency on the
  // tag table and a merged-away tag still reads correctly in every practice already written.
  const drillTags = strList(raw.drillTags, 6, MAX_TITLE_LEN);
  if (drillTags) station.drillTags = drillTags;
  // Kept even when nothing has been typed yet — the coach pressed "Add a station", and autosave
  // must not delete what they are in the middle of creating. See isRowLike.
  return station;
}

/**
 * What a station SAYS, resolving the drill half against the block's (Phase 2).
 *
 * ⚠ **FALL BACK, NEVER REPLACE, AND NEVER MIGRATE.** Slice 1a put the teaching on the BLOCK, so
 * every plan written before the drill library existed has block-level `description`/`goal` and no
 * station-level anything. Those plans must keep reading correctly for ever — there is no "convert
 * my old plans" story and none is wanted. A station's own words win when it has them; otherwise
 * the block's are used exactly as they were before.
 *
 * ONE resolver, shared by "My station", the run screen's block view and the printed sheet, so the
 * three surfaces can never drift apart on what a station is teaching — the same discipline
 * `blockRotates` and `computeBlockClocks` already enforce elsewhere in this module.
 */
export function resolveStationTeaching(
  station: Pick<PracticeStation, 'description' | 'goal' | 'coachingPoints'>,
  block: Pick<PracticePlanBlock, 'description' | 'goal' | 'coachingPoints'>,
): { description?: string; goal?: string; coachingPoints: string[] } {
  return {
    description: station.description ?? block.description,
    goal: station.goal ?? block.goal,
    // Length-checked, not presence-checked: an empty array on the station must not blank out the
    // block's points, which is what a plain `??` would do.
    coachingPoints: station.coachingPoints?.length ? station.coachingPoints : block.coachingPoints ?? [],
  };
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
  const staffTagIds = strList(raw.staffTagIds, MAX_STAFF_PER_ITEM, 64);
  if (staffTagIds) block.staffTagIds = staffTagIds;
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
  validStaffTagIds?: ReadonlySet<string>,
  validEquipmentTagIds?: ReadonlySet<string>,
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
  // Provenance only — which TEMPLATE this plan started from, plus the name snapshotted at load
  // time so the line keeps reading after a rename. Kept opaque and capped like `station.drillId`.
  // ⚠ Unlike a drill's id this SURVIVES editing: a template is scaffolding, so "started from
  // Standard Tuesday" stays true however much the coach then changes (see PracticePlan.templateId).
  const templateId = optionalStr(raw.templateId, 64);
  if (templateId) plan.templateId = templateId;
  const templateName = optionalStr(raw.templateName, MAX_TITLE_LEN);
  if (templateName) plan.templateName = templateName;
  const goal = optionalStr(raw.goal, MAX_TEXT_LEN);
  if (goal) plan.goal = goal;
  const practiceTypes = tagList(raw.practiceTypes, MAX_TAGS_PER_ITEM, MAX_TITLE_LEN);
  if (practiceTypes) plan.practiceTypes = practiceTypes;
  // "kit" was the pre-2026-08-01 free-text spelling of the same idea.
  const equipment = tagList(raw.equipment ?? raw.kit, MAX_TAGS_PER_ITEM, MAX_TITLE_LEN);
  if (equipment) plan.equipment = equipment;
  const equipmentTagIds = strList(raw.equipmentTagIds, MAX_TAGS_PER_ITEM, 64);
  if (equipmentTagIds) plan.equipmentTagIds = equipmentTagIds;

  let scoped = rosterPlayerIds ? restrictToRoster(plan, rosterPlayerIds) : plan;
  if (validStaffTagIds || validEquipmentTagIds) {
    scoped = restrictTagIds(scoped, validStaffTagIds, validEquipmentTagIds);
  }
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

/**
 * Drop every staff/equipment tag reference that isn't currently in the team's library, at every
 * level it appears (plan, block, station) — the same "structural sanitize, then live re-check
 * against the source of truth" split `restrictToRoster` already uses for `playerIds`.
 *
 * ⚠ `undefined` for either set means "don't touch that kind" (the PUT route only fetches the sets
 * it needs), NOT "nothing is valid" — an empty `Set` is what actually strips everything.
 */
function restrictTagIds(
  plan: PracticePlan,
  validStaffTagIds: ReadonlySet<string> | undefined,
  validEquipmentTagIds: ReadonlySet<string> | undefined,
): PracticePlan {
  const keep = (ids: string[] | undefined, valid: ReadonlySet<string> | undefined) => {
    if (!ids || !valid) return ids;
    const filtered = ids.filter(tid => valid.has(tid));
    return filtered.length ? filtered : undefined;
  };
  return {
    ...plan,
    equipmentTagIds: keep(plan.equipmentTagIds, validEquipmentTagIds),
    blocks: plan.blocks.map(block => ({
      ...block,
      staffTagIds: keep(block.staffTagIds, validStaffTagIds),
      stations: block.stations?.map(s => ({
        ...s,
        staffTagIds: keep(s.staffTagIds, validStaffTagIds),
        equipmentTagIds: keep(s.equipmentTagIds, validEquipmentTagIds),
      })),
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

// ── The field run (slice 1b) ─────────────────────────────────────────────────

/**
 * ONE stop on the run screen: a block, or a single round inside a rotating block.
 *
 * The run screen's whole job is "what's happening now, and when does it change", so the ninety
 * minutes are flattened into a list of stops and the screen is a cursor over it. A rotation is
 * therefore NOT a mode the coach enters and leaves (D26) — it is simply a stretch of the same
 * list where several consecutive stops share a block.
 *
 * ⚠ NOTHING HERE IS EVER STORED (D4). A step is derived from the plan and the event's start time
 * on every render; there is no "where did we get to" record, no elapsed-time store, and no
 * completion flag. `startMs` is the PLANNED instant, not an observed one.
 */
export interface RunStep {
  blockId: string;
  /** Index into `plan.blocks` — several steps share it across a rotation's rounds. */
  blockIndex: number;
  /** 1-based round within this block's rotation; null when the block doesn't rotate. */
  round: number | null;
  /** How many rounds this block's rotation has; 0 when it isn't one. */
  rounds: number;
  /** How long this stop is planned to run. Null when it genuinely can't be known. */
  minutes: number | null;
  /** The stop's planned start as a real instant (epoch ms). */
  startMs: number;
  /** True for the single "rest of practice" block. */
  restOfPractice: boolean;
}

/**
 * Flatten a plan into the stops the field screen walks through.
 *
 * A rotating block contributes one step PER ROUND (so "Rotate now" is the same class of tap as
 * "Next block", per D26); every other block contributes exactly one. A rotation whose arithmetic
 * isn't computable yet — no groups, no stations, no interval — degrades to a single plain stop
 * rather than vanishing from the run, because a half-written block is still ninety seconds of a
 * real practice and the coach still has to get past it.
 *
 * A "rest of practice" block's length is the time to the event's END, which is the only honest
 * number available; with no end time it stays null and the screen shows no clock rather than
 * inventing one (D13).
 */
export function buildRunSteps(
  blocks: readonly PracticePlanBlock[],
  eventStartsAt: string | null | undefined,
  eventEndsAt: string | null | undefined,
): RunStep[] {
  // The SAME clock walk the builder, the summary and the printed sheet use — never a second copy
  // of how "rest of practice" advances the cursor. An earlier duplicate of that arithmetic had
  // already drifted once, and the sheet and the screen disagreed about when a block started.
  //
  // ⚠ Indexed BY POSITION, not by block id. `computeBlockClocks` returns one entry per block in
  // order, and ids are client-minted with no uniqueness enforced anywhere — keying a Map on them
  // meant two blocks that happened to share an id silently collapsed onto one clock, giving the
  // earlier block the later one's start time.
  const clocks = computeBlockClocks(blocks, eventStartsAt, eventEndsAt);
  if (clocks.length === 0) return [];
  const endMs = eventEndsAt ? new Date(eventEndsAt).getTime() : NaN;

  const steps: RunStep[] = [];
  blocks.forEach((block, blockIndex) => {
    const clock = clocks[blockIndex];
    if (!clock) return;

    if (blockRotates(block) && block.rotation) {
      const grid = computeRotation(block.rotation, block.stations, block.duration.minutes ?? null, clock.startMs);
      if (grid.rounds > 0 && grid.intervalMinutes) {
        for (let r = 0; r < grid.rounds; r++) {
          steps.push({
            blockId: block.id,
            blockIndex,
            round: r + 1,
            rounds: grid.rounds,
            minutes: grid.intervalMinutes,
            startMs: clock.startMs + r * grid.intervalMinutes * 60_000,
            restOfPractice: false,
          });
        }
        return;
      }
    }

    // FLOOR, never round: the same "never invent precision" rule `defaultIntervalMinutes` follows.
    // Rounding up would let the countdown claim time that the practice does not actually have.
    const minutes = block.duration.restOfPractice
      ? (!Number.isNaN(endMs) && endMs > clock.startMs ? Math.floor((endMs - clock.startMs) / 60_000) : null)
      : (block.duration.minutes ?? null);
    steps.push({
      blockId: block.id,
      blockIndex,
      round: null,
      rounds: 0,
      minutes,
      startMs: clock.startMs,
      restOfPractice: !!block.duration.restOfPractice,
    });
  });
  return steps;
}

/**
 * Which stop the PLANNED clock says is running at `nowMs` — where the screen opens.
 *
 * This is what makes opening a phone mid-practice useful: the coach lands on the block that is
 * actually running rather than at the top of a list they then have to tap through. Before the
 * practice it answers the first stop; after it, the last. Returns -1 for an empty plan.
 *
 * ⚠ A TIE GOES TO THE EARLIER STOP, and that is the whole subtlety here. Two stops share a start
 * instant exactly when the first of them cannot advance the clock — a "rest of practice" block on
 * an event with no end time, or a block whose minutes were never filled in. Those are precisely
 * the stops that are still running (their length is unbounded, not zero), so preferring the later
 * one would skip the coach straight past the block actually in front of them and start the next
 * block's countdown from a time that has already gone.
 */
export function runStepAt(steps: readonly RunStep[], nowMs: number): number {
  if (steps.length === 0) return -1;
  let index = 0;
  for (let i = 1; i < steps.length; i++) {
    // Strictly later, so a shared start instant never displaces the stop that owns it.
    if (steps[i].startMs <= nowMs && steps[i].startMs > steps[index].startMs) index = i;
  }
  return index;
}

/**
 * Seconds left in a stop that began at `anchorMs`. Negative once it has run over; null when the
 * stop has no known length, so the screen can show nothing rather than a made-up number.
 *
 * ⚠ THE ANCHOR IS THE WHOLE DESIGN (owner ruling 2026-08-01). On open it is the stop's PLANNED
 * start, so a practice running to time reads true. The moment the coach taps — "Next block" or
 * "Rotate now" — the caller re-anchors to that instant and the stop gets its full planned length
 * from there. A practice that starts eight minutes late therefore does not spend the rest of the
 * night showing every block as overdue, which is what anchoring purely to the schedule would do.
 */
export function runRemainingSeconds(
  minutes: number | null | undefined,
  anchorMs: number,
  nowMs: number,
): number | null {
  if (minutes == null) return null;
  return minutes * 60 - Math.floor((nowMs - anchorMs) / 1000);
}

/**
 * "12:40" · "0:07" · "+1:20" — the clock as it reads at arm's length, in tabular numerals.
 *
 * Overrun is a plain "+", never a colour word or an alarm: a drill that is going well should be
 * allowed to run long, and the screen's job is to stop pretending it isn't (D26). Hours appear
 * only if a stop somehow runs past sixty minutes, so the common case stays two groups of digits.
 */
export function formatRunClock(seconds: number): string {
  const over = seconds < 0;
  const total = Math.abs(Math.trunc(seconds));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const body = hours > 0
    ? `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${mins}:${String(secs).padStart(2, '0')}`;
  return over ? `+${body}` : body;
}

// ── Reuse helpers (copy-from-previous) ─────────────────────────────────────────

/**
 * Copy a plan onto a different practice: fresh ids throughout, and every player reference
 * re-checked against the CURRENT roster (a plan copied forward in October must not carry a
 * player who left in September).
 *
 * ⚠ Copying is the ONLY reuse path in slice 1a, and it is deliberately a copy — a plan belongs
 * to ONE practice (D7). Nothing here writes to a series, and no caller may pass this through the
 * recurrence edit-scope machinery.
 *
 * ⚠ **`templateId` is deliberately NOT carried forward** (Phase 3). Provenance records the
 * IMMEDIATE source, and this coach started from a PRACTICE, not from a template. Carrying it would
 * inflate "Started 8 plans" with plans nobody started from that template, and the provenance line
 * would claim a template the coach never opened.
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
    // ⚠ Real tag ids (mig 266) carry forward too — `...block`/`...s` below already copy
    // `staffTagIds`/`equipmentTagIds` at the block/station level for the same reason.
    ...(scoped.equipmentTagIds ? { equipmentTagIds: scoped.equipmentTagIds } : {}),
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

/**
 * Every READ-ONLY consumer of a plan — the run screen, `_PracticeStationView`, the printed sheet —
 * still just reads `station.staff`/`.equipment` as plain strings; none of them hold the team's tag
 * library, and none of them should have to. This resolves the current names for display, WITHOUT
 * touching the ids: a `staffTagIds`/`equipmentTagIds` present at a level overrides that level's
 * legacy string field with the tags' CURRENT names (so a rename is visible everywhere at once,
 * which is the entire point of storing ids); a level with no ids keeps reading whatever legacy
 * text it already had. An id with no match in the library (deleted, or a cross-team stale read)
 * is silently dropped rather than shown as a blank/undefined name.
 *
 * ⚠ The return value is for DISPLAY ONLY — never feed it back into a save. It intentionally loses
 * the distinction between "no ids, legacy text" and "ids, resolved text" that the sanitiser and the
 * editor still need.
 */
export function resolvePracticePlanTagNames(
  plan: PracticePlan,
  staffTags: readonly { id: string; name: string }[],
  equipmentTags: readonly { id: string; name: string }[],
): PracticePlan {
  const staffById = new Map(staffTags.map(t => [t.id, t.name]));
  const equipmentById = new Map(equipmentTags.map(t => [t.id, t.name]));
  const resolve = (ids: string[] | undefined, byId: Map<string, string>, fallback: string[] | undefined) =>
    ids?.length ? ids.map(id => byId.get(id)).filter((n): n is string => !!n) : fallback;

  return {
    ...plan,
    equipment: resolve(plan.equipmentTagIds, equipmentById, plan.equipment),
    blocks: plan.blocks.map(block => ({
      ...block,
      staff: resolve(block.staffTagIds, staffById, block.staff),
      stations: block.stations?.map(s => ({
        ...s,
        staff: resolve(s.staffTagIds, staffById, s.staff),
        equipment: resolve(s.equipmentTagIds, equipmentById, s.equipment),
      })),
    })),
  };
}

/* ==============================================================================================
 * RE-POINTING staff/equipment TAG IDS INSIDE A PLAN (migration 266)
 *
 * ⚠ Lives here, not beside the DB round-trips that call it, because it is pure plan-shape logic
 * and `rep-practice-plan-tag-repoint.ts` carries `server-only` — which would make the walk
 * untestable. The four surfaces it must reach are the practice’s own equipment line, each
 * block’s staff, and each station’s who-runs-it and equipment.
 */

const NESTED_KIND_FIELD: Record<'staff' | 'equipment', 'staffTagIds' | 'equipmentTagIds'> = {
  staff: 'staffTagIds',
  equipment: 'equipmentTagIds',
};

function repointIds(ids: string[] | undefined, transform: (id: string) => string | null): string[] | undefined {
  if (!ids?.length) return ids;
  const next: string[] = [];
  const seen = new Set<string>();
  let changed = false;
  for (const id of ids) {
    const mapped = transform(id);
    if (mapped !== id) changed = true;
    if (mapped === null) continue;
    if (seen.has(mapped)) { changed = true; continue; } // merge can collapse two picks into one
    seen.add(mapped);
    next.push(mapped);
  }
  if (!changed) return ids;
  return next;
}

/**
 * Walk one plan, applying `transform` to every id in the given kind's field at every level it
 * appears. Returns the same object reference when nothing changed, so callers can skip a write.
 */
export function repointPracticePlanTags(
  plan: PracticePlan,
  kind: 'staff' | 'equipment',
  transform: (id: string) => string | null,
): { plan: PracticePlan; changed: boolean } {
  const field = NESTED_KIND_FIELD[kind];
  let changed = false;

  const nextStation = (s: PracticeStation): PracticeStation => {
    if (kind !== 'staff' && kind !== 'equipment') return s;
    const before = s[field];
    const after = repointIds(before, transform);
    if (after === before) return s;
    changed = true;
    return { ...s, [field]: after };
  };

  const nextBlock = (b: PracticePlanBlock): PracticePlanBlock => {
    let block = b;
    if (kind === 'staff') {
      const after = repointIds(b.staffTagIds, transform);
      if (after !== b.staffTagIds) { changed = true; block = { ...block, staffTagIds: after }; }
    }
    if (b.stations?.length) {
      const stations = b.stations.map(nextStation);
      if (stations.some((s, i) => s !== b.stations![i])) block = { ...block, stations };
    }
    return block;
  };

  let next = plan;
  if (kind === 'equipment') {
    const after = repointIds(plan.equipmentTagIds, transform);
    if (after !== plan.equipmentTagIds) { changed = true; next = { ...next, equipmentTagIds: after }; }
  }
  const blocks = plan.blocks.map(nextBlock);
  if (blocks.some((b, i) => b !== plan.blocks[i])) next = { ...next, blocks };

  return { plan: next, changed };
}

/**
 * Every distinct staff/equipment tag id ONE plan references, at every level the kind appears
 * (usage counts — One Tag Idiom P0, COACH_TAGGING_PLAN.md 2026-09-01). Reuses the repoint walk
 * with an identity transform: the walk above already knows every home an id can live in, and a
 * second hand-written walk would drift from it the next time a surface is added.
 */
export function collectPracticePlanTagIds(plan: PracticePlan, kind: 'staff' | 'equipment'): Set<string> {
  const seen = new Set<string>();
  repointPracticePlanTags(plan, kind, id => { seen.add(id); return id; });
  return seen;
}
