/**
 * The drill library — Practice Plans Phase 2 (`rep_team_drills`, migration 218).
 *
 * A coach retypes the same warm-up every Tuesday. The product already knows the shape of it, so
 * this module is what turns authoring into four taps — and the categories that fall out are what
 * finally let the focus rail filter itself (D16).
 *
 * Four rules from the plan doc and the owner's rulings are load-bearing and live HERE rather than
 * in the UI, so no surface can quietly breach them:
 *
 *  1. **A DRILL CARRIES NO PEOPLE (D20).** No coaches, no players, no groups — `drillToStation`
 *     mints a station with the shape and the teaching and nothing else. This is what keeps one
 *     drill working in April with twelve players and July with nine, and it is also what keeps
 *     the "people live at exactly one level" invariant (§10.4 item 3) intact: a drill can never
 *     introduce a second answer to "who is at this station?".
 *
 *  2. **A DRILL IS ONE ACTIVITY — one station's worth** (owner ruling 2026-08-01, confirming
 *     §10.4 item 6 "a station IS the drill"). Picking one drill while adding a block gives a block
 *     with that activity in it; picking a second into the SAME block produces two stations, which
 *     is exactly when `blockRotates` starts returning true. The carousel is assembled by picking —
 *     there is no second kind of block anywhere in the model.
 *
 *  3. **THE DRILL'S WORDS ARE COPIED, NEVER LINKED** (owner ruling 2026-08-01). `drillToStation`
 *     copies every field into the plan's jsonb and keeps the drill id as provenance only. A plan
 *     therefore never depends on this table to render: editing a drill later cannot rewrite a
 *     practice already written, a retired drill keeps reading for ever, and there is no
 *     dangling-id class of bug of the kind §10.3 refused for staff tags.
 *
 *  4. **NOTHING IS SEEDED, AND NO CATEGORY IS SUPPLIED.** Every drill and every category is
 *     coach-typed. "Hitting / Fielding / Pitching" is one sport talking to a platform that serves
 *     many, and the rule binds placeholders as much as data (design ruling 2026-08-01 §6).
 *
 * ⚠ **No ranking, ever (§4).** `useCount` counts a DRILL. Nothing in this module counts, scores,
 * orders or compares a child, and the library is sorted by NAME — never by use — so the product
 * never quietly tells a coach which of their own ideas is best.
 */
import { newPracticePlanId, type PracticeStation } from './rep-practice-plan';
import type { RepTeamDrill } from './types';

export type { RepTeamDrill, RepTeamDrillWithUsage } from './types';

// ── Caps (app-layer, matched to the CHECK constraints in mig 218) ────────────
export const MAX_DRILL_NAME_LEN = 120;
/** Matches the `rep_team_tags.name` CHECK (mig 181), which now governs the shared vocabulary. */
export const MAX_TAG_NAME_LEN = 40;
/** How many tags one drill / template / plan may carry. A vocabulary, not a description. */
export const MAX_TAGS_PER_ITEM = 6;
export const MAX_DRILL_TEXT_LEN = 600;
export const MAX_DRILL_POINT_LEN = 200;
export const MAX_DRILL_POINTS = 8;
export const MAX_DRILL_EQUIPMENT = 12;
export const MAX_DRILL_MINUTES = 600;

/** How many active drills one team (or one org's shared set) may hold. */
export const MAX_DRILLS_PER_TEAM = 200;
export const MAX_SHARED_DRILLS_PER_ORG = 100;

/** The editable half of a drill — what both the coach route and the admin route accept. */
export interface DrillInput {
  name: string;
  /**
   * Tag IDs from the team's 'focus' vocabulary (Phase 3). ⚠ IDs, not names — a tag is minted by an
   * explicit act on the tag route, so a drill save can never quietly create vocabulary. That is the
   * deliberate friction that keeps the list growing by decision rather than by typo.
   */
  tagIds?: string[] | null;
  usualMinutes?: number | null;
  description?: string | null;
  goal?: string | null;
  coachingPoints?: string[] | null;
  setup?: string | null;
  equipment?: string[] | null;
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function optionalText(v: unknown, max: number): string | null {
  return text(v, max) || null;
}

/**
 * A de-duplicated label list. Case-insensitive, first spelling wins — the same rule the plan's tag
 * lists use, so "Balls" and "balls" can never both appear on one drill.
 */
function labels(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    const s = text(raw, maxLen);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * A de-duplicated list of tag IDs.
 *
 * ⚠ **Shape-checked as uuids, not merely non-empty.** These ids reach PostgREST filters, and
 * `getDrillsForTeam` already carries the scar: interpolating an unvalidated id into an `.or()`
 * string lets it be parsed as filter syntax. Anything that is not a uuid is dropped here so it can
 * never travel further.
 */
export function uniqueIds(v: unknown, maxItems: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (typeof raw !== 'string') continue;
    const s = raw.trim();
    if (!UUID_RE.test(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function positiveInt(v: unknown, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i > 0 && i <= max ? i : null;
}

/**
 * Validate and normalise a drill payload from either write surface.
 *
 * Returns `{ error }` rather than throwing so the routes can answer 400 with a sentence a coach can
 * act on. **The name is the only required field** — a drill a coach has named but not yet described
 * is a perfectly good drill, and demanding more would make saving one feel like paperwork.
 *
 * ⚠ Unlike the practice plan's sanitiser, this one DOES reject an empty name — and that is the
 * right asymmetry, not an inconsistency. A plan row exists because the coach pressed "Add" and is
 * mid-typing under autosave, so discarding it would be data loss (§10.5). A drill is created by an
 * explicit, deliberate submit, so a nameless one is a mistake worth reporting rather than a state
 * worth persisting.
 */
export function validateDrillInput(input: unknown): { drill: DrillInput } | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'Invalid drill.' };
  const raw = input as Record<string, unknown>;

  const name = text(raw.name, MAX_DRILL_NAME_LEN);
  if (!name) return { error: 'Give the drill a name.' };

  const usualMinutes = raw.usualMinutes == null || raw.usualMinutes === ''
    ? null
    : positiveInt(raw.usualMinutes, MAX_DRILL_MINUTES);
  if (raw.usualMinutes != null && raw.usualMinutes !== '' && usualMinutes == null) {
    return { error: `How long it usually runs must be between 1 and ${MAX_DRILL_MINUTES} minutes.` };
  }

  return {
    drill: {
      name,
      tagIds: uniqueIds(raw.tagIds, MAX_TAGS_PER_ITEM),
      usualMinutes,
      description: optionalText(raw.description, MAX_DRILL_TEXT_LEN),
      goal: optionalText(raw.goal, MAX_DRILL_TEXT_LEN),
      coachingPoints: labels(raw.coachingPoints, MAX_DRILL_POINTS, MAX_DRILL_POINT_LEN),
      setup: optionalText(raw.setup, MAX_DRILL_TEXT_LEN),
      equipment: labels(raw.equipment, MAX_DRILL_EQUIPMENT, MAX_DRILL_NAME_LEN),
    },
  };
}

/**
 * Turn a library drill into a station ready to drop into a block.
 *
 * ⚠ **Empty of people, by construction (D20).** No `staff`, no `playerIds`, no groups — the
 * practice supplies those. `note` ("just for tonight") is deliberately absent too: it is the one
 * field that must never travel in either direction.
 *
 * Every word is COPIED. `drillId` rides along as provenance so the library can answer "in 8 plans",
 * and the drill's tag NAMES are snapshotted (the `rep_player_measurables.unit` precedent) so the
 * focus rail can match without a join and a later re-tagging cannot rewrite what a past practice was
 * about — the property that lets a read-only past plan be honest about what the coach saw AT THE
 * TIME.
 */
export function drillToStation(drill: RepTeamDrill, newId: () => string = newPracticePlanId): PracticeStation {
  const station: PracticeStation = { id: newId(), name: drill.name, drillId: drill.id };
  if (drill.tags.length) station.drillTags = drill.tags.map(t => t.name);
  if (drill.description) station.description = drill.description;
  if (drill.goal) station.goal = drill.goal;
  if (drill.coachingPoints.length) station.coachingPoints = [...drill.coachingPoints];
  if (drill.setup) station.setup = drill.setup;
  if (drill.equipment.length) station.equipment = [...drill.equipment];
  return station;
}

/**
 * Detach a station from its drill — what "Edit just for this practice" does.
 *
 * ⚠ **This is the honest act, not a workaround** (owner ruling 2026-08-01). A drill is an identity
 * claim, so the moment a coach changes its words it is no longer that drill: the provenance goes,
 * the station stops counting toward the drill's `useCount`, and every field becomes editable. The
 * words are kept in full — nothing a coach can press here loses their typing.
 *
 * The tag snapshot goes with it. A detached station's words are the coach's now, so claiming it is
 * still "Hitting" on the drill's authority would be a fabrication; if they want it tagged they can
 * save it to their drills, which asks exactly that one question.
 */
export function detachStationFromDrill(station: PracticeStation): PracticeStation {
  const next = { ...station };
  delete next.drillId;
  delete next.drillTags;
  return next;
}

/**
 * The drill fields a station carries, for "Save to my drills…" (D18).
 *
 * ⚠ **Promotion is explicit, never automatic.** Auto-saving every block fills the library with five
 * near-identical "Warm-up" rows inside a season and makes the picker slower than typing — drawn as
 * the rejected option on the round-3 artifact. The people on the station are dropped here, which is
 * the same D20 split pointing the other way, and the caller asks exactly one question (tags).
 */
export function stationToDrillInput(station: PracticeStation, tagIds?: string[] | null): DrillInput {
  return {
    name: station.name,
    tagIds: uniqueIds(tagIds, MAX_TAGS_PER_ITEM),
    usualMinutes: null,
    description: station.description ?? null,
    goal: station.goal ?? null,
    coachingPoints: station.coachingPoints ?? [],
    setup: station.setup ?? null,
    equipment: station.equipment ?? [],
  };
}

/**
 * Is this station currently backed by a library drill?
 *
 * THE single answer, shared by the editor (which renders the drill half read-only), the promotion
 * control (offered only on a station that is NOT from a drill) and the usage count — so "is this a
 * drill?" can never be decided two different ways.
 */
export function stationIsFromDrill(station: Pick<PracticeStation, 'drillId'>): boolean {
  return !!station.drillId;
}

/** The minimum an item must expose to be tag-filtered: drills, plan templates and tagged plans. */
export interface Taggable {
  name: string;
  tags: readonly { id: string; name: string }[];
  description?: string | null;
}

/**
 * Every distinct tag across a set of tagged items, in first-seen order.
 *
 * Used for the filter chips on the drill library, the template room and the looking-back list —
 * ONE vocabulary, so a chip means the same thing wherever it appears.
 */
export function collectTags<T extends Taggable>(items: readonly T[]): { id: string; name: string }[] {
  const seen = new Map<string, { id: string; name: string }>();
  for (const item of items) {
    for (const t of item.tags) if (!seen.has(t.id)) seen.set(t.id, { id: t.id, name: t.name });
  }
  return [...seen.values()];
}

/**
 * The "no tags" filter chip.
 *
 * A sentinel rather than `null` so a single state value can express all three of "everything",
 * "this tag" and "the ones with none". Not a uuid, so it can never collide with a real tag id.
 *
 * ⚠ Always offered when it applies: an item must never become unreachable simply by having no tags.
 */
export const UNTAGGED_FILTER = ' untagged';

/**
 * The ONE search-and-filter rule, shared by the drill library, the in-plan picker, the template
 * room and the looking-back list.
 *
 * Each surface having its own copy of this predicate is exactly how they end up quietly disagreeing
 * about whether the search box looks at the description.
 *
 * ⚠ **Filtering is by tag ID, which is what closed a live Phase 2 defect.** The old free-text
 * version de-duplicated chip labels case-insensitively but compared the filter value EXACTLY, so a
 * coach who typed "Hitting" once and "hitting" later got one chip, an under-count on it, and a set
 * of drills reachable by no chip at all. Ids cannot drift, and `rep_team_tags` enforces
 * case-insensitive uniqueness per team so the two spellings can no longer both exist.
 *
 * @param tagId `null` = everything · `UNTAGGED_FILTER` = only items carrying no tags.
 */
export function filterTagged<T extends Taggable>(
  items: readonly T[],
  query: string,
  tagId: string | null,
): T[] {
  const q = query.trim().toLowerCase();
  return items.filter(item => {
    if (tagId === UNTAGGED_FILTER) {
      if (item.tags.length) return false;
    } else if (tagId != null && !item.tags.some(t => t.id === tagId)) {
      return false;
    }
    if (!q) return true;
    return item.name.toLowerCase().includes(q)
      || item.tags.some(t => t.name.toLowerCase().includes(q))
      || (item.description ?? '').toLowerCase().includes(q);
  });
}

/**
 * Order drills for any picker or list: shared club drills first, then the team's own, each A–Z.
 *
 * ⚠ **Never by use count.** A "most used" ordering is a ranking, and the library should not quietly
 * tell a coach which of their own ideas is best — the same instinct §4 applies to children, applied
 * one level out. Shared drills lead because they are the club's answer and a coach should see the
 * standard before their own variation, which mirrors how shared tags already sort everywhere else.
 */
export function sortDrillsForPicker<T extends { name: string; teamId: string | null }>(drills: readonly T[]): T[] {
  return [...drills].sort((a, b) => {
    const shared = Number(b.teamId === null) - Number(a.teamId === null);
    if (shared !== 0) return shared;
    return a.name.localeCompare(b.name);
  });
}
