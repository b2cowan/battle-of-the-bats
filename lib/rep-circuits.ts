/**
 * Circuits — a saved block WITH STATIONS, the third size of reusable thing (practices re-evaluation
 * stage 4 · The library, owner ruling L9, 2026-09-16; mig 302).
 *
 * ⚠ **THE ONE RULE THIS FILE EXISTS TO HOLD — a circuit is SCAFFOLDING, like a template, ONE LEVEL
 * DOWN. It is NOT a drill.** The seam is the design (plan §7.7):
 *
 * |                | A DRILL (`rep-drills.ts`)           | A CIRCUIT (here)                        | A TEMPLATE (`rep-plan-templates.ts`) |
 * |----------------|-------------------------------------|-----------------------------------------|--------------------------------------|
 * | One of         | a station                           | a block with stations                   | a whole practice                     |
 * | On placement   | **read-only**; editing DETACHES it  | copy, **fully editable**                | copy, **fully editable**             |
 * | Provenance     | CLEARED the moment a word changes   | KEPT through every edit                 | KEPT through every edit              |
 * | Its count says | "these 8 plans contain this drill"  | "this circuit started 8 plans"          | "this template started 8 plans"      |
 *
 * ⚠ **`circuitToBlock` MUST PRESERVE EACH STATION'S `drillId`** — the template's own rule. A
 * drill-backed station inside a placed circuit arrives read-only and still counted; stripping the
 * id would make it editable and silently break every drill's count.
 *
 * ⚠ **A circuit carries NO PEOPLE** (D20, one level up from a drill and one down from a template):
 * no staff, no players, no groups, no "just for tonight", and no hand-arranged grid (D14). The
 * circuit supplies the stations, their teaching and the rotation's clock; the practice supplies the
 * people and draws its own groups. `blockToCircuitShape` runs the plan sanitiser on a one-block
 * plan and then the TEMPLATE's own strip (`blockForTemplate`), so the two sizes can never disagree
 * about what travels.
 *
 * ⚠ **PLANS, never practices.** "Started 8 plans", never "used 8×": nothing records what was
 * actually run (D4). ⚠ **No ranking, ever (§4).** Circuits sort by NAME, never by use.
 *
 * ⚠ **Promotion copies; the tick creates, then points.** "Also save its N written stations as
 * drills" on the save dialog creates the drills through the existing create route BEFORE the circuit
 * row is stored and rewrites the saved shape's station `drillId`s (`pointStationsAtDrills`); tonight's
 * block is left exactly as it was — nothing on the page turns read-only under the coach's hands.
 */
import {
  MAX_TITLE_LEN, PRACTICE_PLAN_VERSION, newPracticePlanId, sanitizePracticePlan,
  type PracticePlan, type PracticePlanBlock, type PracticeStation,
} from './rep-practice-plan';
import { blockForTemplate } from './rep-plan-templates';
import { MAX_TAGS_PER_ITEM, uniqueIds } from './rep-drills';
import type { RepTeamCircuit } from './types';

export type { RepTeamCircuit, RepTeamCircuitWithUsage } from './types';

/** Matches the `rep_team_circuits.name` CHECK in mig 302. */
export const MAX_CIRCUIT_NAME_LEN = 120;
/** How many ACTIVE circuits one team may keep. Retire one to add another, as the other libraries. */
export const MAX_CIRCUITS_PER_TEAM = 60;

/** The editable half of a circuit — what the create and update routes accept. */
export interface CircuitInput {
  name: string;
  /** Tag ids from the team's 'focus' vocabulary. ⚠ IDs, not names — minting is an explicit act. */
  tagIds?: string[] | null;
  /** The block SHAPE. Always run through `blockToCircuitShape` before it reaches storage. */
  block?: PracticePlanBlock | null;
}

/**
 * Validate a circuit payload from the room or from "Save to my circuits…".
 *
 * ⚠ An empty NAME is rejected — an explicit submit, so a nameless one is a mistake worth reporting
 * (the same asymmetry with the plan editor the template's validator explains).
 */
export function validateCircuitInput(input: unknown): { circuit: CircuitInput } | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'Invalid circuit.' };
  const raw = input as Record<string, unknown>;

  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_CIRCUIT_NAME_LEN) : '';
  if (!name) return { error: 'Give the circuit a name.' };

  return {
    circuit: {
      name,
      tagIds: uniqueIds(raw.tagIds, MAX_TAGS_PER_ITEM),
      // `undefined` (key absent) means "not editing the shape" — a rename must not blank a
      // circuit's stations. `null` and a malformed body both collapse to an empty block below.
      block: raw.block === undefined ? undefined : blockToCircuitShape(raw.block),
    },
  };
}

/** An empty circuit — what "Start from blank" makes, so no surface has to null-check a shape. */
export function emptyCircuitBlock(): PracticePlanBlock {
  return { id: 'circuit', title: '', duration: { minutes: 15 } };
}

/**
 * Turn anything block-shaped into what a circuit stores: sanitised, then emptied of people.
 *
 * Runs the shared plan sanitiser FIRST (on a one-block plan) so a circuit's jsonb obeys exactly the
 * same caps and invariants as a practice's block, then the TEMPLATE's own strip — staff, players,
 * groups, tonight's notes, the rotation note and any hand-arranged grid go; `drillId`/`drillTags`
 * and the kit survive. ⚠ `circuitId`/`circuitName` are dropped: a circuit saved from a block that
 * itself came from a circuit is a new circuit, not a reference to the old one (the template's
 * `templateId` rule). A "rest of practice" length is not a length a circuit can promise — it
 * becomes no length, and the coach types one on the plan.
 */
export function blockToCircuitShape(input: unknown): PracticePlanBlock {
  const raw = input && typeof input === 'object' ? { ...(input as Record<string, unknown>) } : null;
  const plan = raw ? sanitizePracticePlan({ version: PRACTICE_PLAN_VERSION, blocks: [raw] }) : null;
  const block = plan?.blocks[0];
  if (!block) return emptyCircuitBlock();
  const next = blockForTemplate(block);
  delete next.circuitId;
  delete next.circuitName;
  if (next.duration.restOfPractice) next.duration = { minutes: null };
  return next;
}

/**
 * Place a circuit on a practice: fresh ids throughout, provenance stamped, groups EMPTY, fully
 * editable — the template's `templateToPlan`, one block down.
 *
 * ⚠ The circuit NAME is snapshotted alongside the id, so the provenance line keeps reading after a
 * rename or a retire. ⚠ Every station's `drillId` and `drillTags` survive — see the module header.
 * The block is TITLED by the circuit (its stored title was the block's title on the night it was
 * saved, which may since have been renamed on the row); the rotation keeps its clock and draws no
 * groups (people never travel).
 */
export function circuitToBlock(
  circuit: Pick<RepTeamCircuit, 'id' | 'name' | 'block'>,
  newId: () => string = newPracticePlanId,
): PracticePlanBlock {
  const shape = blockToCircuitShape(circuit.block);
  return {
    ...shape,
    id: newId(),
    title: circuit.name.slice(0, MAX_TITLE_LEN),
    circuitId: circuit.id,
    circuitName: circuit.name.slice(0, MAX_TITLE_LEN),
    stations: shape.stations?.map(s => ({ ...s, id: newId() })),
    rotation: shape.rotation ? { ...shape.rotation, groups: [] } : shape.rotation,
  };
}

/** The stations a save dialog's tick would create as drills: WRITTEN (not drill-backed), named. */
export function writtenStationsOf(block: Pick<PracticePlanBlock, 'stations'>): PracticeStation[] {
  return (block.stations ?? []).filter(s => !s.drillId && s.name.trim().length > 0);
}

/**
 * Which of a block's written stations the tick would ADD to the library — a station already there
 * by name (active) is not duplicated, and the tick's label names only what it would create.
 */
export function stationsToPromote(
  block: Pick<PracticePlanBlock, 'stations'>,
  existingDrillNames: readonly string[],
): PracticeStation[] {
  const have = new Set(existingDrillNames.map(n => n.trim().toLowerCase()));
  const seen = new Set<string>();
  return writtenStationsOf(block).filter(s => {
    const key = s.name.trim().toLowerCase();
    if (have.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Point a circuit shape's stations at the drills the tick created (by NAME, case-insensitively —
 * the same key the library's unique index uses), snapshotting each drill's tag names as
 * `drillToStation` does. A station the map does not name is left as the coach wrote it. Called
 * AFTER the drills exist and BEFORE the circuit is stored — never the other way round.
 */
export function pointStationsAtDrills(
  block: PracticePlanBlock,
  drillsByName: ReadonlyMap<string, { id: string; tagNames: readonly string[] }>,
): PracticePlanBlock {
  if (!block.stations) return block;
  return {
    ...block,
    stations: block.stations.map(s => {
      if (s.drillId) return s;
      const drill = drillsByName.get(s.name.trim().toLowerCase());
      if (!drill) return s;
      const next: PracticeStation = { ...s, drillId: drill.id };
      if (drill.tagNames.length) next.drillTags = [...drill.tagNames];
      else delete next.drillTags;
      return next;
    }),
  };
}

/** What a circuit's row says about itself, for the room's meta line. */
export interface CircuitUse {
  planCount: number;
  lastPlannedAt: string | null;
}

/**
 * How many PLANS each circuit has been placed on, and when the most recent one was.
 *
 * A plan holding the same circuit twice counts ONCE — the count is "plans started", the template's
 * kind, never the number of blocks. ⚠ "last planned", never "last run" (D4).
 */
export function countCircuitUses(
  plans: readonly { plan: PracticePlan | null; startsAt: string | null }[],
): Map<string, CircuitUse> {
  const uses = new Map<string, CircuitUse>();
  for (const { plan, startsAt } of plans) {
    const ids = new Set((plan?.blocks ?? []).map(b => b.circuitId).filter((id): id is string => !!id));
    for (const id of ids) {
      const seen = uses.get(id);
      if (!seen) {
        uses.set(id, { planCount: 1, lastPlannedAt: startsAt });
        continue;
      }
      seen.planCount += 1;
      // Newest wins, whatever order the caller walked in.
      if (startsAt && (!seen.lastPlannedAt || startsAt > seen.lastPlannedAt)) seen.lastPlannedAt = startsAt;
    }
  }
  return uses;
}

/**
 * The stations' names in order, then how it rotates — the browsable fact about a circuit
 * ("Footwork ladder · Close control · Finishing · rotates every 15 min"). Empty when nothing is
 * written yet; the row says "Nothing in it yet" in words.
 */
export function circuitLine(block: Pick<PracticePlanBlock, 'stations' | 'rotates' | 'rotation'>): string {
  const names = (block.stations ?? []).map((s, i) => s.name.trim() || `Station ${i + 1}`);
  if (names.length === 0) return '';
  const rotates = (block.rotates ?? true) && names.length >= 2;
  const every = block.rotation?.intervalMinutes;
  const parts = [...names];
  if (rotates) parts.push(every ? `rotates every ${every} min` : 'rotates');
  return parts.join(' · ');
}
