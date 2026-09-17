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
 * row is stored and rewrites the saved shape's stations (`pointStationsAtDrills`); tonight's block
 * is left exactly as it was — nothing on the page turns read-only under the coach's hands.
 *
 * ⚠ **The tick is a list, and a linked station IS its drill** (the save-dialog follow-up, owner
 * rulings S1–S3, 2026-09-17). Once the tick is on, every TYPED station is a row the coach can
 * untick (`tickRowsFor`); a typed station whose name the library already holds is SHOWN with a
 * note, never hidden (S2); the stations that came from drills are named in one line and stay
 * linked (S3, `fromDrillsLine`). Pointing a station at a drill — created or existing — rebuilds
 * it FROM the drill (`drillToStation`), because a drill-backed station is read-only and counted
 * as that drill: the words it shows must be the drill's, not whatever was typed under the same
 * name tonight.
 */
import {
  MAX_TITLE_LEN, PRACTICE_PLAN_VERSION, newPracticePlanId, sanitizePracticePlan,
  type PracticePlan, type PracticePlanBlock, type PracticeStation,
} from './rep-practice-plan';
import { blockForTemplate } from './rep-plan-templates';
import { MAX_TAGS_PER_ITEM, drillToStation, uniqueIds } from './rep-drills';
import type { RepTeamCircuit, RepTeamDrill } from './types';

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

/** The key the library's unique index uses — a name, trimmed, case-folded. */
function drillNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * One row of the tick (S1): a TYPED station, and the active drill of the same name when the
 * library already holds one (S2 — shown with a note, never hidden). One row per distinct name —
 * two typed stations called "Passing" share a row, because the library can hold only one drill
 * of that name; the row IS the first of them, and the save touches that station alone
 * (`pointStationsAtDrills` links by station id) — the twin stays as typed.
 */
export interface TickRow {
  station: PracticeStation;
  existing: RepTeamDrill | null;
}

export function tickRowsFor(
  block: Pick<PracticePlanBlock, 'stations'>,
  drills: readonly RepTeamDrill[],
): TickRow[] {
  // ACTIVE only — the library's unique index is partial on active names, so a retired "Ladder"
  // neither blocks a new one nor is a drill a station should be pointed at. The index is per
  // scope, so the team's own drill and a club-shared one may share a name: the team's own wins,
  // deterministically, rather than whichever the list happened to carry last.
  const have = new Map<string, RepTeamDrill>();
  for (const d of drills) {
    if (!d.isActive) continue;
    const key = drillNameKey(d.name);
    const held = have.get(key);
    if (!held || (held.teamId === null && d.teamId !== null)) have.set(key, d);
  }
  const seen = new Set<string>();
  const rows: TickRow[] = [];
  for (const station of writtenStationsOf(block)) {
    const key = drillNameKey(station.name);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ station, existing: have.get(key) ?? null });
  }
  return rows;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * S3 — the one quiet line under the tick naming the stations that came from drills. Null when
 * every station was typed; "All N stations…" when none was, so the line reads alone where the
 * tick is absent.
 */
export function fromDrillsLine(block: Pick<PracticePlanBlock, 'stations'>): string | null {
  const stations = block.stations ?? [];
  const from = stations.filter(s => s.drillId && s.name.trim().length > 0);
  if (from.length === 0) return null;
  if (from.length === stations.length) {
    return from.length === 1
      ? 'Its one station came from your drills and stays linked.'
      : `All ${from.length} stations came from your drills and stay linked.`;
  }
  const names = listNames(from.map(s => s.name.trim()));
  return `${names} came from your drills and ${from.length === 1 ? 'stays' : 'stay'} linked.`;
}

/**
 * Point a circuit shape's typed stations at drills — the ones the tick CREATED and the ones the
 * coach kept linked to an existing drill (S2) — by STATION ID: the row's own station and no other.
 * ⚠ Not by name (`/review` 2026-09-17): `tickRowsFor` gives two same-named typed stations ONE row,
 * and pointing by name would rebuild the hidden twin too — its own words gone with no row to say
 * so. The twin is left exactly as typed. ⚠ A pointed station is REBUILT FROM THE DRILL
 * (`drillToStation`, its id kept): a drill-backed station is read-only and labelled as that drill,
 * so it must read the drill's words, not tonight's under the same name. A station the map does
 * not name is left exactly as the coach wrote it; a station already drill-backed is never touched.
 * Called AFTER the drills exist and BEFORE the circuit is stored — never the other way round.
 */
export function pointStationsAtDrills(
  block: PracticePlanBlock,
  drillsByStationId: ReadonlyMap<string, RepTeamDrill>,
): PracticePlanBlock {
  if (!block.stations) return block;
  return {
    ...block,
    stations: block.stations.map(s => {
      if (s.drillId) return s;
      const drill = drillsByStationId.get(s.id);
      if (!drill) return s;
      return drillToStation(drill, () => s.id);
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
