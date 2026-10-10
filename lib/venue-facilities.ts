/**
 * A VENUE'S FACILITIES, NAMED ONE WAY (Tournament admin redesign Stage 5, F77 — pure, unit-tested).
 *
 * Every way a tournament gains a venue with a count — the creation wizard, the first run, Venues & facilities' Add a
 * venue — names its lanes "Diamond 1…N" in the event's own word: never "Lions Park — Diamond 1" (the park said twice in
 * the schedule's Venue field), and a count of one is "Diamond 1", never the park's own name. The word comes from the
 * tournament's sport (baseball and softball: Diamond; a field sport: Field; Court, Rink, Gym), so a softball organizer
 * is never asked to choose "Diamond" — the sheet's Kind dropdown opens on it and only a mixed-use park changes it.
 *
 * Also here: "your venues" — each venue a past event used, ONCE (by name and address, the newest copy), the list an
 * organization without a Venue library picks last year's park from (A51).
 */
import { FACILITY_TYPE_LABELS, type FacilityType } from './types.ts';
import { getSportPack } from './sports.ts';

/** The kinds a count can be (the sheet's Kind). `other` is never offered: "Other 1" is not a name. */
export const FACILITY_KINDS: readonly Exclude<FacilityType, 'other'>[] = ['diamond', 'field', 'court', 'rink', 'gym'];

/** The most lanes one venue gets in one step (the first run's old bound). */
export const MAX_FACILITY_COUNT = 30;

/** The kind a venue's lanes take by default: the sport's, with a sport the packs don't tailor reading Field. */
export function facilityKindForSport(sport: string | null | undefined): Exclude<FacilityType, 'other'> {
  const type = getSportPack(sport).defaultFacilityType;
  return type === 'other' ? 'field' : type;
}

/** "Diamond" — the singular word, capitalised (a lane's name). */
export function facilityWord(kind: FacilityType): string {
  return kind === 'other' ? 'Field' : FACILITY_TYPE_LABELS[kind];
}

/** "diamonds" / "diamond" — the word in a sentence. */
export function facilityNoun(kind: FacilityType, count: number): string {
  const word = facilityWord(kind).toLowerCase();
  return count === 1 ? word : `${word}s`;
}

/** "Diamonds" — the Kind dropdown's label for a kind. */
export function facilityKindLabel(kind: FacilityType): string {
  return `${facilityWord(kind)}s`;
}

/** A count from the form, held to 1…30. */
export function clampFacilityCount(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(MAX_FACILITY_COUNT, n);
}

/** The lanes a new venue gets: "Diamond 1", "Diamond 2", … — one is "Diamond 1". */
export function facilityNames(count: number, kind: FacilityType): string[] {
  const word = facilityWord(kind);
  return Array.from({ length: clampFacilityCount(count) }, (_, i) => `${word} ${i + 1}`);
}

/**
 * Names in a sentence, the house's serial comma: "Diamond 1", "Diamond 1 and Diamond 2", "Diamond 1, Diamond 2, and
 * Diamond 3"; four or more read as a range, "Diamond 1 to Diamond 6".
 */
export function listFacilityNames(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
  return `${names[0]} to ${names[names.length - 1]}`;
}

/** One venue a past event used, as the scope=past read returns it. */
export type PastVenueRow = {
  id: string;
  name: string;
  address: string | null;
  sourceTournamentName?: string | null;
  sourceTournamentYear?: number | null;
  facilities?: readonly { name: string }[];
};

const keyOf = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * "Your venues": each venue past events used, ONCE — the same name and address is one park — keeping its newest copy
 * (the latest event's diamonds), then sorted by name. Today's search listed every copy, archived events' included.
 */
export function dedupePastVenues<T extends PastVenueRow>(rows: readonly T[]): T[] {
  const newest = new Map<string, T>();
  for (const row of rows) {
    const key = `${keyOf(row.name)}|${keyOf(row.address)}`;
    const held = newest.get(key);
    if (!held || (row.sourceTournamentYear ?? 0) > (held.sourceTournamentYear ?? 0)) newest.set(key, row);
  }
  return [...newest.values()].sort((a, b) => a.name.localeCompare(b.name, 'en-CA', { numeric: true }));
}
