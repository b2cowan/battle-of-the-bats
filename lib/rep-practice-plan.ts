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
import { roomNeighbours, type RoomNeighbours } from './room-neighbours';
import type {
  PracticeDuration, PracticeGroup, PracticeGroupSource,
  PracticePlan, PracticePlanBlock, PracticeRotation, PracticeRotationArrangement, PracticeStation,
} from './types';

// Re-exported so a caller can take the model and its types from one place.
export type {
  PracticeDuration, PracticeGroup, PracticeGroupSource,
  PracticePlan, PracticePlanBlock, PracticeRotation, PracticeRotationArrangement, PracticeStation,
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
 * Does this block ask for teaching of its own — What you're doing · What you're watching for ·
 * Coaching points? (Practices re-evaluation stage 2, owner ruling D7, 2026-09-15.)
 *
 * A block placed from a drill has no words of its own: the drill IS its single station, and the
 * run screen already reads such a block through the station ("with one station the station is
 * the block"). So a block with EXACTLY ONE station and nothing written on itself asks for none —
 * it opens onto the station's read-only text instead. With no stations it is the activity; with
 * two or more its own line is the circuit's intro. A block that HAD words before its station
 * arrived keeps showing them (content is always shown).
 *
 * ONE predicate, read by both the closed row (its first line) and the open body (which fields it
 * offers), so the two can never disagree about what a block is.
 */
export function blockAsksForTeaching(
  block: Pick<PracticePlanBlock, 'stations' | 'description' | 'goal' | 'coachingPoints'>,
): boolean {
  if ((block.stations?.length ?? 0) !== 1) return true;
  return blockHasOwnWords(block);
}

/** Does the block hold teaching of its OWN — a Doing line, a Watching-for line or a coaching point?
 *  The one predicate behind "the block is the activity" (D1, D13): a written block with words and
 *  no stations is one activity; the same block with words AND a circuit has an intro. */
export function blockHasOwnWords(
  block: Pick<PracticePlanBlock, 'description' | 'goal' | 'coachingPoints'>,
): boolean {
  return !!(block.description?.trim() || block.goal?.trim() || block.coachingPoints?.some(p => p.trim()));
}

/**
 * D13 (owner ruling 2026-09-16) — "+ Stations" on a WRITTEN block with no stations makes TWO.
 * The activity the coach wrote becomes station 1 — its Doing, Watching-for and coaching points
 * move down, and it takes the block's title as its name — and `second` (the blank or drill
 * station just added) stands beside it. The block keeps the high-level things: title, minutes,
 * staff, and an intro line that is now empty. Kit and people are NOT moved here: `settlePlanLevels`
 * already moves both onto a first station the moment one exists (D8 · D11), and one pass owning
 * that move is the whole point of the pass.
 *
 * ⚠ "+ Stations" ALWAYS makes two (owner, on the built split, 2026-09-16 — twice: a titled block
 * with nothing typed under it folded its first station in and the form doubled; then "why can't an
 * empty block split into stations? I should be able to open a block, split stations, then start
 * typing details including title"). So: a block with a title or words → its activity is station 1
 * and `second` stands beside it; a block with NOTHING of its own → `second` is station 1 and a
 * blank station 2 stands beside it, ready to type into. The one-station shape is never made here.
 * (A drill that should BE the block arrives through the ghost row's "a drill from your library",
 * which builds that shape directly — D7 — not through this door.)
 */
export function splitBlockIntoStations(
  block: PracticePlanBlock,
  second: PracticeStation,
  newId: () => string = newPracticePlanId,
): PracticePlanBlock {
  if ((block.stations?.length ?? 0) > 0) {
    return { ...block, stations: [...(block.stations ?? []), second] };
  }
  const isActivity = block.title.trim().length > 0 || blockHasOwnWords(block);
  if (!isActivity) {
    return { ...block, stations: [second, { id: newId(), name: '' }] };
  }
  const first: PracticeStation = { id: newId(), name: block.title.trim() };
  if (block.description?.trim()) first.description = block.description;
  if (block.goal?.trim()) first.goal = block.goal;
  const points = (block.coachingPoints ?? []).filter(p => p.trim());
  if (points.length) first.coachingPoints = points;
  const rest: PracticePlanBlock = { ...block };
  delete rest.description; delete rest.goal; delete rest.coachingPoints;
  return { ...rest, stations: [first, second] };
}

/**
 * D13's reverse — the block is down to ONE written station and has no words of its own: the
 * station's words come back up and the station goes, so the coach is where they started (the
 * activity, no stations). Nothing merges and nothing is dropped: if the block has intro words of
 * its own, or the survivor is a drill (its words are the drill's, read-only), or the survivor
 * holds something the block has no field for (a setup, a "just for tonight" note, a rotation
 * note), the station STAYS as the block's one station — D1's shape. "Nothing typed vanishes"
 * (D8) decides it, not tidiness. Kit and people are carried up here so the settle pass finds
 * them at home, as it does whenever the last station goes.
 */
export function collapseSoleStation(block: PracticePlanBlock): PracticePlanBlock {
  const stations = block.stations ?? [];
  if (stations.length !== 1) return block;
  const [s] = stations;
  if (s.drillId || blockHasOwnWords(block)) return block;
  // A setup, a "just for tonight" note, a rotation note or pre-tag kit NAMES have no field on the
  // block — the station stays rather than lose a word of them.
  if (s.setup?.trim() || s.note?.trim() || s.rotationNote?.trim() || s.equipment?.length) return block;
  const next: PracticePlanBlock = { ...block };
  delete next.stations;
  if (s.description?.trim()) next.description = s.description;
  if (s.goal?.trim()) next.goal = s.goal;
  const points = (s.coachingPoints ?? []).filter(p => p.trim());
  if (points.length) next.coachingPoints = points;
  // Who ran the station runs the block — the block has the same two staff fields.
  const staff = unionIds(block.staff, s.staff);
  const staffTagIds = unionIds(block.staffTagIds, s.staffTagIds);
  if (staff) next.staff = staff;
  if (staffTagIds) next.staffTagIds = staffTagIds;
  const kitIds = strList([...(block.equipmentTagIds ?? []), ...(s.equipmentTagIds ?? [])], MAX_TAGS_PER_ITEM, 64);
  if (kitIds) next.equipmentTagIds = kitIds;
  const people = unionIds(block.playerIds, s.playerIds);
  if (people) next.playerIds = people;
  return next;
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
/** A player list (a block's, a station's, a group's) holds at most one roster's worth. */
export const MAX_PLAYERS_PER_LIST = 60;
export const MAX_TITLE_LEN = 120;
export const MAX_TEXT_LEN = 600;
/** The plan's free-text description — a paragraph, not a line. */
export const MAX_DESCRIPTION_LEN = 2000;
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
  // Every plan-level field that counts as content, one per line — appending the next one is one
  // entry, not a `!` and an `&&` in the right place. The focus section counts: a coach who adds it
  // and saves must find it there on reload.
  const hasContent = [
    plan.goal?.trim(), plan.description?.trim(), plan.practiceTypes?.length,
    plan.equipment?.length, plan.equipmentTagIds?.length, plan.includeFocusAreas,
  ].some(Boolean);
  return !hasContent && plan.blocks.length === 0;
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
  const playerIds = strList(raw.playerIds, MAX_PLAYERS_PER_LIST, 64);
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
      const playerIds = (strList(gr.playerIds, MAX_PLAYERS_PER_LIST, 64) ?? []).filter(pid => {
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
  const rotation: PracticeRotation = {
    intervalMinutes: posInt(raw.intervalMinutes, MAX_MINUTES),
    groups,
    groupSource: source,
  };
  // A hand-arranged grid (D14): its SHAPE is read here; whether it still FITS the block's
  // stations and clock is the block sanitiser's question (`settleArrangements`, once the stations
  // and minutes are known). Anything malformed is simply not an arrangement.
  const arrangement = sanitizeArrangement(raw.arrangement, new Set(groups.map(g => g.id)));
  if (arrangement) rotation.arrangement = arrangement;
  return rotation;
}

function sanitizeArrangement(v: unknown, groupIds: ReadonlySet<string>): PracticeRotationArrangement | null {
  if (!v || typeof v !== 'object') return null;
  const raw = v as Record<string, unknown>;
  const stationIds = strList(raw.stationIds, MAX_STATIONS_PER_BLOCK, 64);
  const groupIdsListed = strList(raw.groupIds, MAX_GROUPS, 64);
  const rounds = posInt(raw.rounds, 200);
  if (!stationIds || !groupIdsListed || !rounds || !Array.isArray(raw.placements)) return null;
  if (raw.placements.length !== rounds) return null;
  const placements: Record<string, string | null>[] = [];
  for (const row of raw.placements) {
    if (!row || typeof row !== 'object') return null;
    const clean: Record<string, string | null> = {};
    for (const [gid, sid] of Object.entries(row as Record<string, unknown>)) {
      if (!groupIds.has(gid)) continue;
      if (sid === null) clean[gid] = null;
      else if (typeof sid === 'string' && sid.length <= 64) clean[gid] = sid;
    }
    placements.push(clean);
  }
  return { stationIds, groupIds: groupIdsListed, rounds, placements };
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
  const playerIds = strList(raw.playerIds, MAX_PLAYERS_PER_LIST, 64);
  if (playerIds) block.playerIds = playerIds;
  const points = strList(raw.coachingPoints, MAX_COACHING_POINTS, MAX_SHORT_TEXT_LEN);
  if (points) block.coachingPoints = points;
  if (stations.length) block.stations = stations;

  // The block's own kit (D11) — read structurally here like any id list; WHERE it lives is settled
  // by `settleBlockKit` after the library check, so a stale id never takes a slot a live one needed.
  const blockKit = strList(raw.equipmentTagIds, MAX_TAGS_PER_ITEM, 64);
  if (blockKit) block.equipmentTagIds = blockKit;

  /**
   * People are read STRUCTURALLY here, at every level they arrive on — the block's list, each
   * station's, the rotation's groups. WHERE they live is settled by `settleBlockPeople` after the
   * roster check (stage 3, D8): a list at the wrong level for the block's shape is MOVED to the
   * right one, never deleted. The rotation is therefore read whenever it is present (its groups
   * hold people even on a block that has stopped rotating); a rotating block with none stored gets
   * the empty shape so the editor's controls have something to hold.
   */
  const rotation = sanitizeRotation(raw.rotation);
  if (rotation) block.rotation = rotation;
  else if (blockRotates(block as PracticePlanBlock)) {
    block.rotation = { intervalMinutes: null, groups: [], groupSource: 'manual' };
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
  const description = optionalStr(raw.description, MAX_DESCRIPTION_LEN);
  if (description) plan.description = description;
  const practiceTypes = tagList(raw.practiceTypes, MAX_TAGS_PER_ITEM, MAX_TITLE_LEN);
  if (practiceTypes) plan.practiceTypes = practiceTypes;
  // "kit" was the pre-2026-08-01 free-text spelling of the same idea.
  const equipment = tagList(raw.equipment ?? raw.kit, MAX_TAGS_PER_ITEM, MAX_TITLE_LEN);
  if (equipment) plan.equipment = equipment;
  const equipmentTagIds = strList(raw.equipmentTagIds, MAX_TAGS_PER_ITEM, 64);
  if (equipmentTagIds) plan.equipmentTagIds = equipmentTagIds;
  // "What everyone's working on" — a shape flag, stored only when true (see PracticePlan).
  if (raw.includeFocusAreas === true) plan.includeFocusAreas = true;

  let scoped = rosterPlayerIds ? restrictToRoster(plan, rosterPlayerIds) : plan;
  if (validStaffTagIds || validEquipmentTagIds) {
    scoped = restrictTagIds(scoped, validStaffTagIds, validEquipmentTagIds);
  }
  // Kit and people settle to the activity's level LAST (D11 · D8) — after the roster and library
  // checks, so a stale id can never take a slot a live one needed when two capped lists meet
  // (/review, 2026-09-15).
  scoped = settlePlanLevels(scoped);
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
      equipmentTagIds: keep(block.equipmentTagIds, validEquipmentTagIds),
      stations: block.stations?.map(s => ({
        ...s,
        staffTagIds: keep(s.staffTagIds, validStaffTagIds),
        equipmentTagIds: keep(s.equipmentTagIds, validEquipmentTagIds),
      })),
    })),
  };
}

/**
 * ⚠ KIT LIVES AT EXACTLY ONE LEVEL — the activity's (stage 2, owner ruling D11, 2026-09-15), the
 * same law as people. A block with no stations IS the activity and keeps its kit; once it has
 * stations, each station carries its own and the block's list MOVES rather than vanishing:
 *   · the first station is written → onto that station (its own kit first, then the block's)
 *   · the first station is a drill → up into the plan's list, the bag (a drill's kit is the drill's)
 * People follow the same law one pass over (`settleBlockPeople`, stage 3 D8); `settlePlanLevels`
 * runs the two together.
 *
 * ONE pure pass, run in two places so the screen and the column agree: the sanitiser runs it
 * last (after the library check — every read and every write), and the editor runs it on every
 * change to the blocks, so the coach SEES the kit move the moment a station arrives rather than
 * watching it vanish until a reload (the save's response is not applied to local state; /review,
 * 2026-09-15). Idempotent by construction: after the move the block holds no kit, so a second pass
 * finds nothing to move. Two capped lists can exceed the cap when unioned; the tail is dropped,
 * as any list here is. The same object comes back when nothing moved.
 */
export function settleBlockKit(plan: PracticePlan): PracticePlan {
  const lifted: string[] = [];
  let moved = false;
  const blocks = plan.blocks.map(block => {
    if (!block.equipmentTagIds?.length || !block.stations?.length) return block;
    moved = true;
    const { equipmentTagIds: kit, ...rest } = block;
    const [first, ...others] = block.stations;
    if (first.drillId) {
      lifted.push(...kit);
      return { ...rest, stations: block.stations };
    }
    const merged = strList([...(first.equipmentTagIds ?? []), ...kit], MAX_TAGS_PER_ITEM, 64);
    return { ...rest, stations: [{ ...first, equipmentTagIds: merged }, ...others] };
  });
  if (!moved) return plan;
  const equipmentTagIds = strList([...(plan.equipmentTagIds ?? []), ...lifted], MAX_TAGS_PER_ITEM, 64);
  const next: PracticePlan = { ...plan, blocks };
  if (equipmentTagIds) next.equipmentTagIds = equipmentTagIds;
  return next;
}

/** The station without its people — the level they are leaving. */
function withoutPlayers(station: PracticeStation): PracticeStation {
  const copy = { ...station };
  delete copy.playerIds;
  return copy;
}
const unionIds =(...lists: (readonly string[] | undefined)[]): string[] | undefined =>
  strList(lists.flatMap(l => l ?? []), MAX_PLAYERS_PER_LIST, 64);

/**
 * ⚠ PEOPLE LIVE AT EXACTLY ONE LEVEL (owner ruling 2026-08-01) — AND THEY MOVE WHEN THE LEVEL
 * MOVES (practices re-evaluation stage 3, owner ruling D8, 2026-09-15). The block's shape says
 * where its people live, and every other level is emptied INTO that one, never deleted:
 *   · no stations        → the block's own list
 *   · stations, separate → each station's list
 *   · stations, rotating → the rotation's groups, and nothing else
 * Enforced here rather than trusted to the UI, so a stale client or a hand-rolled payload can
 * never produce two disagreeing answers to "who is at this station?" — and so the printed sheet
 * renders one list without choosing. Until this stage the sanitiser enforced it by DELETING what
 * sat at the wrong level: six names chosen on a block vanished the moment a station arrived.
 * Now they follow the level, the way kit does (D11):
 *   · a station arrives      → the block's names land on the FIRST station (a drill station holds
 *                              people too — people are the practice's half, never the drill's)
 *   · rotating turns on      → every name on the block or a station becomes the FIRST DRAW: dealt
 *                              in stored order into one group per station (fewer when there are
 *                              fewer names); with groups already standing, a stray name joins them
 *                              round-robin from the first. Not shuffled — a deal the coach did not
 *                              ask for should at least be one they can read; Draw shuffles.
 *   · rotating turns off     → each group lands on the station it started at (group i → station i)
 *   · the last station goes  → everyone comes back to the block's own list
 * A player belongs to exactly one group and is listed once at the level they land on; a
 * rotation on a block that does not rotate is dropped once its people have moved (the shape a
 * reader expects — `blockRotates` decides, not the key's presence).
 *
 * ONE pure pass, run in two places so the screen and the column agree: the sanitiser runs it
 * last (after the roster check — every read and every write) and the editor runs it on every
 * change to the blocks, so the coach SEES the names move rather than watching them vanish until
 * a reload. Idempotent by construction: after the move nothing sits at a wrong level, so a
 * second pass finds nothing to move and hands the same object back. Deterministic on purpose
 * (no shuffle, fixed group ids) — a sanitiser that rolled dice would save a different plan than
 * the one it was shown.
 */
export function settleBlockPeople(plan: PracticePlan): PracticePlan {
  let moved = false;
  const blocks = plan.blocks.map(block => {
    const stations = block.stations ?? [];
    const rotating = blockRotates(block);
    const strayOnBlock = block.playerIds !== undefined && stations.length > 0;
    const strayOnStations = rotating && stations.some(s => s.playerIds !== undefined);
    const strayRotation = block.rotation !== undefined && !rotating;
    if (!strayOnBlock && !strayOnStations && !strayRotation) return block;
    moved = true;

    const { playerIds: blockNames, rotation, ...rest } = block;
    const groups = rotation?.groups ?? [];
    const next: PracticePlanBlock = { ...rest };

    if (stations.length === 0) {
      // The block is the activity again (its stations were removed): the groups come home.
      const home = unionIds(blockNames, ...groups.map(g => g.playerIds));
      if (home) next.playerIds = home;
      return next;
    }

    if (!rotating) {
      // Separate stations: the block's names onto the first; each group onto the station it
      // STARTED at (the grid's own first row — `startingGroupsForStation`, so the two answers
      // agree). The rotation itself goes with its people. What a station already holds is the
      // coach's own placement and stands first; a name that moves lands on ONE station — the
      // first it is due at — never on two (a stale rotation beside a hand-placed list must not
      // book one child at two stations of a block that does not rotate — /review, 2026-09-15).
      const placed = new Set(stations.flatMap(s => s.playerIds ?? []));
      next.stations = stations.map((s, i) => {
        const station = withoutPlayers(s);
        const arriving = (unionIds(
          i === 0 ? blockNames : undefined,
          ...startingGroupsForStation(rotation, stations.length, i).map(g => g.playerIds),
        ) ?? []).filter(pid => !placed.has(pid));
        arriving.forEach(pid => placed.add(pid));
        const settled = unionIds(s.playerIds, arriving);
        return settled ? { ...station, playerIds: settled } : station;
      });
      return next;
    }

    // Rotating: everyone named on the block or a station joins the groups — the first draw.
    const placed = new Set(groups.flatMap(g => g.playerIds));
    const strays = (unionIds(blockNames, ...stations.map(s => s.playerIds)) ?? []).filter(pid => !placed.has(pid));
    next.stations = stations.map(withoutPlayers);
    const base: PracticeRotation = rotation ?? { intervalMinutes: null, groups: [], groupSource: 'manual' };
    if (strays.length === 0) {
      next.rotation = base;
    } else if (groups.length === 0) {
      next.rotation = { ...base, groups: dealGroups(strays, stations.length), groupSource: 'manual' };
    } else {
      // Standing groups keep their source — a stray joining them is the sanitiser's move, not a
      // coach's hand on a drawn group (which is what turns 'random' into 'manual' in the editor).
      // Capped as every list here is, so a read after the write sees exactly what was written.
      const joined = groups.map(g => ({ ...g, playerIds: g.playerIds.slice() }));
      strays.forEach((pid, i) => { joined[i % joined.length].playerIds.push(pid); });
      next.rotation = { ...base, groups: joined.map(g => ({ ...g, playerIds: unionIds(g.playerIds) ?? [] })) };
    }
    return next;
  });
  return moved ? { ...plan, blocks } : plan;
}

/**
 * Everything that lives at "the activity's level" — kit (D11) then people (D8) — settled in one
 * call, so the sanitiser and the editor cannot run one pass and forget the other.
 */
export function settlePlanLevels(plan: PracticePlan): PracticePlan {
  return settleArrangements(settleBlockPeople(settleBlockKit(plan)));
}

/**
 * D14's one rule: a hand-arranged grid that no longer FITS — a station or a group added or
 * removed, the clock changed so the round count moved — goes back to the standard rotation.
 * Dropped here (the same pure pass the sanitiser and the editor both run) so the two agree; the
 * editor notices the drop and SAYS SO under the grid. A block whose minutes are not known here
 * (rest of practice — its length is the clock walk's) is checked on stations and groups only;
 * `computeRotation` re-checks the round count with the real minutes at read time.
 */
export function settleArrangements(plan: PracticePlan): PracticePlan {
  let dropped = false;
  const blocks = plan.blocks.map(block => {
    const rotation = block.rotation;
    if (!rotation?.arrangement) return block;
    const { stops, groups, rounds } = rotationShape(rotation, block.stations, block.duration.minutes ?? null);
    const minutesKnown = block.duration.minutes != null;
    const fits = minutesKnown
      ? arrangementFits(rotation.arrangement, stops, groups, rounds)
      : arrangementFits(rotation.arrangement, stops, groups, rotation.arrangement.rounds);
    if (fits) return block;
    dropped = true;
    return { ...block, rotation: forgetArrangement(rotation) };
  });
  return dropped ? { ...plan, blocks } : plan;
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

/** The clock walk's whole answer: one clock per block, and where the walk STOPPED. */
export type BlockClockWalk = {
  clocks: BlockClock[];
  /** Where the next block would start — the cursor after the last block. Null with no start time. */
  nextStartMs: number | null;
  nextStartLabel: string | null;
};

/**
 * The running time column: the coach types minutes, the product does the clock.
 *
 * All arithmetic is elapsed-minutes on a real INSTANT, formatted in the org's zone through
 * `lib/timezone.ts` — never raw UTC date math on a naive string, which is the guardrail this
 * codebase has paid for twice (J3-047, J6-056).
 *
 * A "rest of practice" block runs from its start to the event's end time; with no end time set,
 * its end is honestly unknown and renders as null rather than a guess.
 *
 * `walkBlockClocks` also reports where the walk ENDED (`nextStartMs`) — the sheet's ghost row
 * says when the next block would start, and that answer belongs to the one walk rather than to a
 * caller smuggling a fake block through it (/simplify, 2026-09-14). `computeBlockClocks` is the
 * same walk, clocks only.
 */
export function walkBlockClocks(
  blocks: readonly PracticePlanBlock[],
  eventStartsAt: string | null | undefined,
  eventEndsAt: string | null | undefined,
): BlockClockWalk {
  const none: BlockClockWalk = { clocks: [], nextStartMs: null, nextStartLabel: null };
  if (!eventStartsAt) return none;
  const startMs = new Date(eventStartsAt).getTime();
  if (Number.isNaN(startMs)) return none;
  const endMs = eventEndsAt ? new Date(eventEndsAt).getTime() : NaN;
  const at = (ms: number) => formatInOrgZone(new Date(ms).toISOString(), CLOCK_FORMAT);

  let cursor = startMs;
  const clocks = blocks.map(block => {
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
  return { clocks, nextStartMs: cursor, nextStartLabel: at(cursor) };
}

export function computeBlockClocks(
  blocks: readonly PracticePlanBlock[],
  eventStartsAt: string | null | undefined,
  eventEndsAt: string | null | undefined,
): BlockClock[] {
  return walkBlockClocks(blocks, eventStartsAt, eventEndsAt).clocks;
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
 *
 * `fit` (practices re-evaluation stage 0, D4): the Practice plans room reads the plan AGAINST
 * the practice — "6 blocks · 60 of 90 min · 1 rotation" when the practice's length is known,
 * "6 blocks · 60 min · 1 rotation" when it is not ("of 90" says what "planned" said, better; the
 * frame reads "60 min" without it). One builder for the parts, so the two readings cannot drift.
 * With zero timed minutes the fit is unknowable and the line falls back to the count.
 *
 * ⚠ Deliberately says nothing about a "rest of practice" block — a row is one line. The SHEET's
 * own line (`practicePlanFit` in lib/practice-state.ts) has the room to name the remainder ("30
 * of 90 min planned · 60 rest of practice"); both count the same timed minutes, so the figures
 * agree even where the phrasing differs.
 */
export function summarizePracticePlan(
  plan: PracticePlan,
  fit?: { length: number | null },
): string {
  const blocks = plan.blocks.length;
  const parts = [`${blocks} block${blocks === 1 ? '' : 's'}`];
  const minutes = totalPlannedMinutes(plan);
  if (minutes > 0) {
    parts.push(!fit ? `${minutes} min planned` : fit.length != null ? `${minutes} of ${fit.length} min` : `${minutes} min`);
  }
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

  return dealGroups(shuffle(players, rng), count);
}

/**
 * The DEAL: names into `count` groups in the order given — consecutive runs, the first groups one
 * larger when it does not divide (an uneven split produced honestly, never rounded away). The one
 * step `drawGroups` (after its shuffle) and `settleBlockPeople` (in stored order, no shuffle) share.
 */
function dealGroups(playerIds: readonly string[], count: number): PracticeGroup[] {
  const n = Math.max(1, Math.min(count, MAX_GROUPS, playerIds.length));
  const base = Math.floor(playerIds.length / n);
  const remainder = playerIds.length % n;
  const groups: PracticeGroup[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < remainder ? 1 : 0);
    groups.push({ id: `grp-${i}-${cursor}`, name: groupLabel(i), playerIds: playerIds.slice(cursor, cursor + size) });
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

/**
 * The groups room (stage 3 revision — owner rulings D9 · D10 · D11, 2026-09-16): ONE player lands
 * in ONE group, or in none when `groupId` is null. A player belongs to exactly one group (the
 * sanitiser's rule too), so landing in a group leaves every other; the landing position is
 * ROSTER order, never where the chip was let go (§4 — no list anywhere may imply a ranking).
 * Placing by hand makes the groups chosen (`groupSource: 'manual'`), as the picker did.
 * Returns the same object when nothing would change — an unknown target, or a player already
 * where they were asked to go — so a caller can skip the write.
 */
export function movePlayerToGroup(
  rotation: PracticeRotation,
  playerId: string,
  groupId: string | null,
  rosterOrder: readonly string[],
): PracticeRotation {
  if (groupId !== null && !rotation.groups.some(g => g.id === groupId)) return rotation;
  const holder = rotation.groups.find(g => g.playerIds.includes(playerId));
  if ((holder?.id ?? null) === groupId) return rotation;
  // A stale id (a player since removed from the roster) sorts last, in the order it already had.
  const rank = new Map(rosterOrder.map((id, i) => [id, i] as const));
  const inRosterOrder = (ids: readonly string[]) =>
    [...ids].sort((a, b) => (rank.get(a) ?? rosterOrder.length) - (rank.get(b) ?? rosterOrder.length));
  return {
    ...rotation,
    groupSource: 'manual',
    groups: rotation.groups.map(g => {
      if (g.id === groupId) return { ...g, playerIds: inRosterOrder([...g.playerIds, playerId]) };
      return g.playerIds.includes(playerId) ? { ...g, playerIds: g.playerIds.filter(p => p !== playerId) } : g;
    }),
  };
}

/**
 * Who is on tonight's roster and in NO group — the room's "Not in a group" column and the block's
 * read-out line (D11): computed from the roster and the groups, never stored, in roster order.
 * It is where a binned group's players reappear, which is what keeps D21's "named, never silently
 * dropped" true for the bin as well as the draw.
 */
export function unplacedPlayers<T extends { id: string }>(
  roster: readonly T[],
  groups: readonly PracticeGroup[],
): T[] {
  const placed = new Set(groups.flatMap(g => g.playerIds));
  return roster.filter(p => !placed.has(p.id));
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
  /** Groups SITTING THIS ROUND OUT (D14) — a hand-arranged grid only; empty for the carousel. */
  out: { groupId: string; groupName: string }[];
}

export interface RotationGrid {
  rounds: number;
  intervalMinutes: number | null;
  totalMinutes: number | null;
  /** Minutes left over after whole rounds — STATED, never silently rounded away (D24). */
  spareMinutes: number;
  roundsList: RotationRound[];
  /** True when the cells came from the coach's own arrangement (D14), not the carousel. */
  arranged: boolean;
  /**
   * Plain-language statements about what this rotation does and doesn't cover (D25).
   * Every one of these is a fact about the arithmetic, never a suggestion to change it —
   * the product NEVER invents a round or drops a station to make the numbers tidy.
   */
  notes: string[];
  /**
   * The first of the `notes` — the rounds line ("3 rounds of 15 min.") — named on its own so a
   * surface that already states the clock elsewhere (the editor's rotation strip, stage 3 D3)
   * can leave it out of the list by identity rather than by guessing its words. Still IN `notes`:
   * the printed sheet and the run screen read the list whole and are untouched. Null when the
   * rotation could not be computed.
   */
  roundsNote: string | null;
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
/**
 * The four facts a rotation is computed from — the named stops, the groups with anyone in them,
 * the interval (derived when unset) and the round count — in ONE place, so `computeRotation`, the
 * fit check on a hand-arranged grid (D14) and the sanitiser cannot count rounds three ways.
 * `rounds` is 0 when any fact is missing.
 */
export function rotationShape(
  rotation: PracticeRotation | null | undefined,
  stations: readonly PracticeStation[] | undefined,
  blockMinutes: number | null | undefined,
): { stops: PracticeStation[]; groups: PracticeGroup[]; intervalMinutes: number | null; totalMinutes: number | null; rounds: number } {
  const stops = (stations ?? []).filter(s => s.name.trim().length > 0);
  // Unset means "one turn each" — see defaultIntervalMinutes.
  const intervalMinutes = rotation?.intervalMinutes ?? defaultIntervalMinutes(blockMinutes, stops.length);
  const totalMinutes = blockMinutes ?? null;
  const groups = rotation?.groups.filter(g => g.playerIds.length > 0 || g.name.trim()) ?? [];
  const rounds = stops.length && groups.length && totalMinutes && intervalMinutes ? Math.floor(totalMinutes / intervalMinutes) : 0;
  return { stops, groups, intervalMinutes, totalMinutes, rounds };
}

const sortedIds = (items: readonly { id: string }[]) => items.map(i => i.id).sort();
const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Does a hand-arranged grid (D14) still describe THIS rotation? The same named stations (by id —
 * a rename or a reorder keeps it), the same groups, the same round count, and every placement a
 * station that exists or "sits out". Anything else and the arrangement is dropped, by the
 * sanitiser and the editor alike, and the editor says so.
 */
export function arrangementFits(
  arrangement: PracticeRotationArrangement | null | undefined,
  stops: readonly PracticeStation[],
  groups: readonly PracticeGroup[],
  rounds: number,
): arrangement is PracticeRotationArrangement {
  if (!arrangement || rounds <= 0) return false;
  if (!sameIds([...arrangement.stationIds].sort(), sortedIds(stops))) return false;
  if (!sameIds([...arrangement.groupIds].sort(), sortedIds(groups))) return false;
  if (arrangement.rounds !== rounds || arrangement.placements.length !== rounds) return false;
  const stopIds = new Set(stops.map(s => s.id));
  return arrangement.placements.every(row =>
    Object.values(row).every(stationId => stationId === null || stopIds.has(stationId)));
}

/** The carousel's own answer for one cell — group `i` in round `r` stands at station `(i + r) mod S`. */
const standardStop = (stops: readonly PracticeStation[], groupIndex: number, round: number) =>
  stops[(groupIndex + round) % stops.length];

/**
 * D14 (owner ruling 2026-09-16) — one hand move on the grid: group `groupId` stands at
 * `stationId` in round `round` (1-based), or sits that round out when `stationId` is null. The
 * first move turns the carousel into a remembered arrangement (every other cell keeps its
 * standard place); later moves edit it. Returns the same rotation when the move changes nothing
 * or names a round, group or station the rotation does not have.
 */
export function arrangeGroup(
  rotation: PracticeRotation,
  stations: readonly PracticeStation[] | undefined,
  blockMinutes: number | null | undefined,
  round: number,
  groupId: string,
  stationId: string | null,
): PracticeRotation {
  const { stops, groups, rounds } = rotationShape(rotation, stations, blockMinutes);
  if (rounds <= 0 || round < 1 || round > rounds) return rotation;
  if (!groups.some(g => g.id === groupId)) return rotation;
  if (stationId !== null && !stops.some(s => s.id === stationId)) return rotation;
  const base: PracticeRotationArrangement = arrangementFits(rotation.arrangement, stops, groups, rounds)
    ? rotation.arrangement
    : {
      stationIds: sortedIds(stops), groupIds: sortedIds(groups), rounds,
      placements: Array.from({ length: rounds }, (_, r) =>
        Object.fromEntries(groups.map((g, i) => [g.id, standardStop(stops, i, r).id]))),
    };
  if (base.placements[round - 1][groupId] === stationId) return rotation;
  const placements = base.placements.map((row, r) => (r === round - 1 ? { ...row, [groupId]: stationId } : row));
  return { ...rotation, arrangement: { ...base, placements } };
}

/** "Back to the standard rotation ›" — the carousel again. The same object back when there was nothing to forget. */
export function forgetArrangement(rotation: PracticeRotation): PracticeRotation {
  if (rotation.arrangement == null) return rotation;
  const rest: PracticeRotation = { ...rotation };
  delete rest.arrangement;
  return rest;
}

export function computeRotation(
  rotation: PracticeRotation | null | undefined,
  stations: readonly PracticeStation[] | undefined,
  blockMinutes: number | null | undefined,
  blockStartMs?: number,
): RotationGrid {
  const { stops, groups, intervalMinutes, totalMinutes, rounds } = rotationShape(rotation, stations, blockMinutes);
  const empty: RotationGrid = {
    rounds: 0, intervalMinutes, totalMinutes,
    spareMinutes: 0, roundsList: [], arranged: false, notes: [], roundsNote: null, incomplete: true,
  };
  if (!rotation) return empty;

  const notes: string[] = [];
  if (stops.length === 0 || groups.length === 0 || !totalMinutes || !intervalMinutes) {
    const missing: string[] = [];
    if (stops.length === 0) missing.push('at least one station');
    if (groups.length === 0) missing.push('at least one group');
    if (!totalMinutes) missing.push('how long the block runs');
    if (!intervalMinutes) missing.push('how often groups move');
    return { ...empty, notes: [`Add ${listNames(missing)} to see the rotation.`] };
  }

  const spareMinutes = totalMinutes - rounds * intervalMinutes;

  if (rounds === 0) {
    return {
      rounds: 0, intervalMinutes, totalMinutes, spareMinutes: totalMinutes, roundsList: [], arranged: false, incomplete: true, roundsNote: null,
      notes: [`${totalMinutes} minutes doesn't fit a single ${intervalMinutes}-minute round. Lower the interval or lengthen the block.`],
    };
  }

  // The coach's own arrangement (D14) is read INSTEAD of the carousel while it still fits — a
  // cell it does not name keeps its standard place; null is a round sat out.
  const arranged = arrangementFits(rotation.arrangement, stops, groups, rounds) ? rotation.arrangement : null;
  const S = stops.length;
  const roundsList: RotationRound[] = [];
  for (let r = 0; r < rounds; r++) {
    const cells: RotationCell[] = [];
    const out: RotationRound['out'] = [];
    groups.forEach((g, i) => {
      const placed = arranged ? arranged.placements[r][g.id] : undefined;
      if (placed === null) { out.push({ groupId: g.id, groupName: g.name }); return; }
      const stop = (placed !== undefined ? stops.find(s => s.id === placed) : undefined) ?? standardStop(stops, i, r);
      cells.push({ groupId: g.id, groupName: g.name, stationId: stop.id, stationName: stop.name });
    });
    roundsList.push({
      round: r + 1,
      startLabel: blockStartMs != null
        ? formatInOrgZone(new Date(blockStartMs + r * intervalMinutes * 60_000).toISOString(), CLOCK_FORMAT)
        : undefined,
      cells,
      out,
    });
  }

  // ── The statements (D25) — facts about THESE cells, dealt or arranged; never a suggestion ──
  const roundsNote = `${rounds} round${rounds === 1 ? '' : 's'} of ${intervalMinutes} min`
    + (spareMinutes > 0 ? `, with ${spareMinutes} min spare.` : '.');
  notes.push(roundsNote);

  // Two groups at one station ⇒ they share. A station with nobody, a group sitting out ⇒ said.
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
    if (arranged) {
      const idle = stops.filter(s => !byStation.has(s.id)).map(s => s.name);
      if (idle.length > 0) notes.push(`${listNames(idle)} ${idle.length === 1 ? 'has' : 'have'} nobody in round ${round.round}.`);
      if (round.out.length > 0) {
        notes.push(`${listNames(round.out.map(o => o.groupName))} ${round.out.length === 1 ? 'sits' : 'sit'} round ${round.round} out.`);
      }
    }
  }

  // A group that never reaches a station — because there are fewer rounds than stations, or
  // because the coach arranged it so. Named either way.
  const visited = new Map<string, Set<string>>(groups.map(g => [g.id, new Set<string>()]));
  for (const round of roundsList) for (const cell of round.cells) visited.get(cell.groupId)?.add(cell.stationId);
  let everyoneEverything = true;
  for (const g of groups) {
    const missed = stops.filter(s => !visited.get(g.id)?.has(s.id)).map(s => s.name);
    if (missed.length > 0) { notes.push(`${g.name} won't reach ${listNames(missed)}.`); everyoneEverything = false; }
  }
  if (everyoneEverything) {
    notes.push(!arranged && rounds > S
      ? `Everyone does everything, then starts round ${S + 1} again at their first station.`
      : 'Everyone does everything.');
  }

  return { rounds, intervalMinutes, totalMinutes, spareMinutes, roundsList, arranged: !!arranged, notes, roundsNote, incomplete: false };
}

// ── The rotation as the editor lays it out (practices re-evaluation stage 3, 2026-09-15) ────
// Presentation over `computeRotation`'s cells — the same arithmetic, said on one line and turned
// to the station columns. Nothing here recomputes a round.

/**
 * The strip's one honest line about the clock (D3): "3 rounds of 15 = 45 min", or, when the
 * block's length does not divide, "45 does not divide by 20 — 2 rounds and 5 min over". Never
 * tidied: a spare five minutes is stated, not rounded into a fourth round or out of existence.
 * Empty until both numbers exist (the notes under the grid say what is missing).
 *
 * ⚠ The two lines of arithmetic deliberately MIRROR `computeRotation`'s (`rounds` · `spareMinutes`)
 * rather than read them off a grid: the strip says the clock before a single group exists, and
 * the grid does not compute past "add at least one group". Change the rounding in one, change it
 * in both.
 */
export function describeRounds(totalMinutes: number | null | undefined, intervalMinutes: number | null | undefined): string {
  if (!totalMinutes || !intervalMinutes) return '';
  const rounds = Math.floor(totalMinutes / intervalMinutes);
  const spare = totalMinutes - rounds * intervalMinutes;
  if (rounds === 0) return `${totalMinutes} min is less than one ${intervalMinutes}-min round`;
  if (spare === 0) return `${rounds} round${rounds === 1 ? '' : 's'} of ${intervalMinutes} = ${totalMinutes} min`;
  return `${totalMinutes} does not divide by ${intervalMinutes} — ${rounds} round${rounds === 1 ? '' : 's'} and ${spare} min over`;
}

export interface StationRoundRow {
  round: number;
  startLabel?: string;
  /** One cell per station column, in station order: the group(s) there that round. */
  cells: string[][];
  /** The same cells with the groups' ids — what the editor's pills move by (D14). */
  cellGroups: { id: string; name: string }[][];
  /** Groups sitting this round out (D14). */
  out: { id: string; name: string }[];
}

/**
 * The grid TURNED to the station columns (D6): rounds as rows, the block's named stations as
 * columns in their own order, each cell the group name(s) at that station in that round — two
 * when more groups than stations share one, none when a station sits idle that round. Reading
 * down a column is one station's evening; the first row is who starts there, so a station never
 * repeats it. The same cells `computeRotation` produced, re-keyed; an unnamed station is not a
 * stop in the arithmetic and has no column here either.
 */
export function rotationByStation(grid: RotationGrid, stations: readonly PracticeStation[] | undefined): {
  stations: { id: string; name: string }[];
  rows: StationRoundRow[];
} {
  const stops = (stations ?? []).filter(s => s.name.trim().length > 0).map(s => ({ id: s.id, name: s.name }));
  const rows = grid.roundsList.map(round => {
    const byStation = new Map<string, { id: string; name: string }[]>();
    for (const cell of round.cells) {
      const here = byStation.get(cell.stationId) ?? [];
      here.push({ id: cell.groupId, name: cell.groupName });
      byStation.set(cell.stationId, here);
    }
    const cellGroups = stops.map(s => byStation.get(s.id) ?? []);
    return {
      round: round.round, startLabel: round.startLabel,
      cells: cellGroups.map(cell => cell.map(g => g.name)),
      cellGroups,
      out: round.out.map(o => ({ id: o.groupId, name: o.groupName })),
    };
  });
  return { stations: stops, rows };
}

/** A station's name as the sheet reads it aloud — "Station 2" in the quiet voice until it has one. */
export function stationLabel(station: Pick<PracticeStation, 'name'>, index: number): string {
  return station.name.trim() || `Station ${index + 1}`;
}

/**
 * The station modal's stepper (D4) — the room's own Prev / Next answer over the block's stations
 * in their order (`roomNeighbours`, so the two walks can never disagree on what an edge does): at
 * the first station there is no previous and at the last no next — the arrows STOP, they do not
 * wrap. Named destinations, and a position count.
 */
export function stationWalk(stations: readonly PracticeStation[], stationId: string | null): RoomNeighbours {
  return roomNeighbours(stations, stationId, s => s.id, (s) => stationLabel(s, stations.indexOf(s)));
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
    ...(scoped.description ? { description: scoped.description } : {}),
    ...(scoped.practiceTypes ? { practiceTypes: scoped.practiceTypes } : {}),
    ...(scoped.equipment ? { equipment: scoped.equipment } : {}),
    // ⚠ Real tag ids (mig 266) carry forward too — `...block`/`...s` below already copy
    // `staffTagIds`/`equipmentTagIds` at the block/station level for the same reason.
    ...(scoped.equipmentTagIds ? { equipmentTagIds: scoped.equipmentTagIds } : {}),
    // Shape, like kit: a template that carries the focus section hands it to every plan started
    // from it (owner ruling 2026-09-14). The section still reads only for those who may see goals.
    ...(scoped.includeFocusAreas ? { includeFocusAreas: true } : {}),
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
/**
 * The CURRENT names for a list of tag ids, in the list's order, dropping any id the library no
 * longer holds (merged away, retired, a stale read). The one id→name walk every display of a
 * tag list shares — the sheet's "About this practice" line, the printed sheet's practice types.
 */
type TagLookup = readonly { id: string; name: string }[] | ReadonlyMap<string, string>;

/** A tag list as its id→name map — or the map a caller already built, handed straight back. */
function toTagMap(tags: TagLookup): ReadonlyMap<string, string> {
  return Array.isArray(tags)
    ? new Map((tags as readonly { id: string; name: string }[]).map(t => [t.id, t.name]))
    : (tags as ReadonlyMap<string, string>);
}

export function tagNamesById(ids: readonly string[] | undefined, tags: TagLookup): string[] {
  if (!ids?.length) return [];
  const byId = toTagMap(tags);
  return ids.map(id => byId.get(id)).filter((n): n is string => !!n);
}

/**
 * A station's staff or kit AS THE EDITOR SHOWS IT: the legacy names it still carries ∪ the
 * library ids resolved to current names, each once — a station can be pre-library (names only),
 * post-library (ids only), or mid-migration (both, until the picker's adopt rows are taken), and
 * the editor shows everything the coach has said rather than choosing (the printed sheet, which
 * must print one list, prefers ids and falls back — `resolvePracticePlanTagNames`). Read-only:
 * never written back.
 */
export function mergedTagNames(
  legacy: readonly string[] | undefined,
  ids: readonly string[] | undefined,
  tags: TagLookup,
): string[] {
  return [...new Set([...(legacy ?? []), ...tagNamesById(ids, tags)])];
}

/**
 * The BAG — what the practice needs tonight (stage 2, owner ruling D11, 2026-09-15): the plan's
 * own list (the coach's extras — water, the first-aid kit) ∪ every block's kit ∪ every station's
 * kit, as CURRENT names, in that order, each name once. Derived at read time and never written
 * down: the plan's stored list stays the extras, and what rose from a block is removed on the
 * block, not at the top — the rule the practice's tags already follow. A level with no ids reads
 * its legacy names, exactly as `resolvePracticePlanTagNames` does.
 *
 * `all` is what the About line shows and the printed sheet's head prints; `fromBlocks` is the
 * part that rose from below, so the About fold can say where it came from.
 */
export function practiceKitBag(
  plan: PracticePlan,
  equipmentTags: TagLookup,
): { all: string[]; fromBlocks: string[] } {
  // Built once for the whole walk, then handed to `tagNamesById` level by level.
  const byId = toTagMap(equipmentTags);
  const seen = new Set<string>();
  const all: string[] = [];
  const fromBlocks: string[] = [];
  const add = (names: readonly string[], below: boolean) => {
    for (const raw of names) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push(name);
      if (below) fromBlocks.push(name);
    }
  };
  const level = (ids: readonly string[] | undefined, legacy: readonly string[] | undefined, below: boolean) =>
    add(ids?.length ? tagNamesById(ids, byId) : legacy ?? [], below);
  level(plan.equipmentTagIds, plan.equipment, false);
  for (const block of plan.blocks) {
    level(block.equipmentTagIds, undefined, true);
    for (const station of block.stations ?? []) level(station.equipmentTagIds, station.equipment, true);
  }
  return { all, fromBlocks };
}

export function resolvePracticePlanTagNames(
  plan: PracticePlan,
  staffTags: readonly { id: string; name: string }[],
  equipmentTags: readonly { id: string; name: string }[],
): PracticePlan {
  // The maps are built once and handed to the ONE id→name walk (`tagNamesById`), which used to
  // have a private twin here (/simplify, 2026-09-14).
  const staffById = new Map(staffTags.map(t => [t.id, t.name]));
  const equipmentById = new Map(equipmentTags.map(t => [t.id, t.name]));
  const resolve = (ids: string[] | undefined, byId: Map<string, string>, fallback: string[] | undefined) =>
    ids?.length ? tagNamesById(ids, byId) : fallback;

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
 * untestable. The five surfaces it must reach are the practice’s own equipment line, each
 * block’s staff and (while it has no stations) its kit, and each station’s who-runs-it and
 * equipment.
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
    // A block carries staff at every age and kit only while it has no stations (D11) — the walk
    // reads whichever field the kind names, so a merged tag reaches a block's kit too.
    const after = repointIds(b[field], transform);
    if (after !== b[field]) { changed = true; block = { ...block, [field]: after }; }
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
