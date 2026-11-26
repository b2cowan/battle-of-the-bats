/**
 * field-parts.ts — THE one home for a field's parts (Club schedules Stage 2, mig 541). Pure and client-safe: no server
 * imports, ever (the venue list, the builder's tick list and the grid all read it in the browser).
 *
 * The storage (plan §5, the `/dba` re-pass, Finding #55)
 * -------------------------------------------------------
 *   A field carries `sections`: 1 (not split), 2 (two sides) or 4 (four quarters).
 *   A booking names its ground with `section_mask`, ALWAYS in quarter units whatever the split:
 *     1 = quarter A · 2 = B · 4 = C · 8 = D · 3 = A+B · 12 = C+D · 0 = the whole field (never 15).
 *   Side A of a two-sided field IS quarters A–B of a quartered one (3): the same ground, the same value.
 *   Legal by `sections`: 1 → {0} · 2 → {0, 3, 12} · 4 → {0, 1, 2, 4, 8, 3, 12}. B–C (6) is never legal.
 *
 * Why every reader imports this and none writes its own
 * ------------------------------------------------------
 * Overlap is one expression (`partsOverlap`) and the size is bits ÷ 4 (`partFactor`). A reader that copies either and
 * gets it wrong double-books or misprices, so there is one copy. The database mirrors the same two facts
 * (`section_range`, `section_mask_legal`); the unit test holds both tables.
 *
 * A reader that only carries a facility id reads 0, the whole field, and stays safe: it sees a clash where two sides
 * would have shared the field, never the reverse.
 *
 * The words are WORKING words (round 1 and 2 drawings; `/marketing` settles them once, in Session 2E).
 */

/** How a field splits. */
export type FieldSections = 1 | 2 | 4;

/** Whole field. */
export const WHOLE = 0;

/** Every mask a field split this way offers, the whole field first (the order the tick list and the grid use). */
const LEGAL: Record<FieldSections, readonly number[]> = {
  1: [0],
  2: [0, 3, 12],
  4: [0, 3, 12, 1, 2, 4, 8],
};

/** The four quarters, one bit each. */
const QUARTERS: readonly number[] = [1, 2, 4, 8];

/**
 * A field's time counted BY PART (the permit's Used, Session 2D): `minutesOn(q)` is the time on quarter q — a reader
 * filters its bookings with `partsOverlap(mask, q)` — and the field's time is their sum ÷ 4. So a part counts its share
 * (bits ÷ 4, as `partFactor`), and two parts that overlap count their ground once.
 */
export function byQuarter(minutesOn: (quarter: number) => number): number {
  return QUARTERS.reduce((t, q) => t + minutesOn(q), 0) / 4;
}

/** Every mask any field can store (the database CHECK's list). */
export const STORABLE_MASKS: readonly number[] = [0, 1, 2, 3, 4, 8, 12];

/** A stored or typed `sections` read safely: anything but 2 or 4 is "not split". */
export function sectionsOf(value: unknown): FieldSections {
  const n = typeof value === 'string' ? Number(value) : value;
  return n === 2 || n === 4 ? n : 1;
}

/** A stored mask read safely: anything the database could not hold reads as the whole field (the safe answer). */
export function maskOf(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && STORABLE_MASKS.includes(n) ? n : WHOLE;
}

/** The masks a field split this way offers, the whole field first. */
export function legalMasks(sections: FieldSections): readonly number[] {
  return LEGAL[sections];
}

/** The parts alone (no whole field): what a split field adds to a list. */
export function partMasks(sections: FieldSections): readonly number[] {
  return LEGAL[sections].filter(m => m !== WHOLE);
}

export function isLegalMask(mask: number, sections: FieldSections): boolean {
  return LEGAL[sections].includes(mask);
}

/**
 * Do two bookings ON THE SAME FIELD hold overlapping ground? The whole field meets every part; two parts meet when
 * they share a quarter. The caller compares the field first — two different fields never overlap here.
 */
export function partsOverlap(a: number | null | undefined, b: number | null | undefined): boolean {
  const x = maskOf(a);
  const y = maskOf(b);
  return x === WHOLE || y === WHOLE || (x & y) !== 0;
}

/** Does `outer` hold ALL of `inner`'s ground on one field? The whole field holds every part; side A holds quarters A and B;
 *  a part never holds the whole field (Find the time's "larger ground", Session 2D). */
export function holdsAll(outer: number | null | undefined, inner: number | null | undefined): boolean {
  const o = maskOf(outer);
  const i = maskOf(inner);
  return o === WHOLE || (i !== WHOLE && (o & i) === i);
}

/** Same field and overlapping ground: the one "same place?" a clash reader asks once both sides name a field. */
export function samePlace(
  a: { facilityId: string | null | undefined; sectionMask?: number | null },
  b: { facilityId: string | null | undefined; sectionMask?: number | null },
): boolean {
  return !!a.facilityId && a.facilityId === b.facilityId && partsOverlap(a.sectionMask, b.sectionMask);
}

function bits(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

/**
 * How much of the field the mask holds: 1 for the whole field, else quarters ÷ 4 (a side or a half 0.5, a quarter
 * 0.25). The slot's weight is the field's permit share × this (Session 2B's one `weightOf`).
 */
export function partFactor(mask: number | null | undefined): number {
  const m = maskOf(mask);
  return m === WHOLE ? 1 : bits(m) / 4;
}

/** The quarter run as letters: 1 → "A", 3 → "A–B", 12 → "C–D". */
function letters(mask: number): string {
  const ls = ['A', 'B', 'C', 'D'].filter((_, i) => (mask & (1 << i)) !== 0);
  return ls.length === 1 ? ls[0] : `${ls[0]}–${ls[ls.length - 1]}`;
}

/**
 * The part in words, from (mask, sections) at read time: "side A" on a two-sided field, "quarter C" or "quarters A–B"
 * on a quartered one. Null for the whole field. A mask the field's CURRENT split doesn't offer (a past booking made
 * before the split changed, owner 2026-11-25) reads in quarter words, which are true whatever the split.
 */
export function partWords(mask: number | null | undefined, sections: FieldSections): string | null {
  const m = maskOf(mask);
  if (m === WHOLE) return null;
  if (sections === 2 && (m === 3 || m === 12)) return `side ${m === 3 ? 'A' : 'B'}`;
  return bits(m) === 1 ? `quarter ${letters(m)}` : `quarters ${letters(m)}`;
}

/** The field with its part, joined by `sep`: "Field 1 side A" (a list), "Field 1, side A" (the calendar). */
export function fieldPartName(name: string, mask: number | null | undefined, sections: FieldSections, sep = ' '): string {
  const part = partWords(mask, sections);
  return part ? `${name}${sep}${part}` : name;
}

/** The part an event carries and how its field splits, both read with the event (2C part 2) — never stored as text. */
export interface EventPart { sectionMask?: number | null; fieldSections?: number | null }

/**
 * A coach's or family's field words with the part the event carries (2C part 2): "Diamond 1, side A" — a coach line joins
 * with a comma. The name alone for the whole field; '' with no name (a part said without its field means nothing).
 */
export function eventFieldName(name: string | null | undefined, at: EventPart): string {
  // The name exactly as stored (a whole field reads byte-for-byte as before parts); blank says nothing.
  return name?.trim() ? fieldPartName(name, at.sectionMask, sectionsOf(at.fieldSections), ', ') : '';
}

/** A split field said whole: "Field 1 in two sides", "Field 1 in four quarters". The name alone when not split. */
export function splitFieldWords(name: string, sections: FieldSections): string {
  return sections === 2 ? `${name} in two sides` : sections === 4 ? `${name} in four quarters` : name;
}

/** The venue list's split choices, in order. */
export const SPLIT_CHOICES: readonly { value: FieldSections; label: string }[] = [
  { value: 1, label: 'Not split' },
  { value: 2, label: 'Two sides' },
  { value: 4, label: 'Four quarters' },
];

export function splitLabel(sections: FieldSections): string {
  return SPLIT_CHOICES.find(c => c.value === sections)?.label ?? 'Not split';
}

/** The venue's read card, under a split field's name: "Four quarters, A to D", "Two sides, A and B". Null when whole. */
export function splitReadWords(sections: FieldSections): string | null {
  return sections === 4 ? 'Four quarters, A to D' : sections === 2 ? 'Two sides, A and B' : null;
}

// ── The tick list (Session 2B, round 2 tab 3) ───────────────────────────────────────────────────────

/** A field the tick list offers: its id, its name, how it splits. */
export interface PickableField { id: string; name: string; sections: FieldSections }

/** A tick's value: the field's own id for the whole field, "id:mask" for a part. */
export const tickValue = (facilityId: string, mask: number): string => (maskOf(mask) === WHOLE ? facilityId : `${facilityId}:${mask}`);

/** A tick's value read back: the field and the ground it names. */
export function readTick(value: string): { facilityId: string; mask: number } {
  const at = value.indexOf(':');
  return at < 0 ? { facilityId: value, mask: WHOLE } : { facilityId: value.slice(0, at), mask: maskOf(Number(value.slice(at + 1))) };
}

/** The part as the tick list's option names it, capitalised for a row label: "Side A", "Quarter C", "Quarters A–B". */
export function partLabel(mask: number, sections: FieldSections): string | null {
  const w = partWords(mask, sections);
  return w ? w[0].toUpperCase() + w.slice(1) : null;
}

/**
 * The tick list's options for a venue's fields, in the venue's order (round 2 tab 3, "with halves"): a split field is
 * "Field 1 (whole)" then each part ("Field 1, quarters A–B", "Field 1, quarter A" …), flat, no indent; a field not split
 * keeps its plain name.
 */
export function tickOptions(fields: readonly PickableField[]): { id: string; label: string }[] {
  return fields.flatMap(f => (f.sections === 1
    ? [{ id: f.id, label: f.name }]
    : legalMasks(f.sections).map(m => ({ id: tickValue(f.id, m), label: tickLabel(f.name, m, f.sections) }))));
}

/** One tick's words: a field not split is its name; a split field is "Field 1 (whole)" or "Field 1, side B". The tick list
 *  and Find the time's rows (2D design check F5) say a choice of ground the same way. */
export function tickLabel(name: string, mask: number | null | undefined, sections: FieldSections): string {
  if (sections === 1) return name;
  return maskOf(mask) === WHOLE ? `${name} (whole)` : fieldPartName(name, mask, sections, ', ');
}

/**
 * A place and a place inside it are never both ticked: each value newly ticked (in `next`, not in `prev`) unticks every
 * other tick on its field whose ground it overlaps — a quarter unticks the whole field and its half, a half unticks the
 * whole field and its two quarters, the whole field unticks every part. The last one ticked wins.
 */
export function resolveTicks(prev: readonly string[], next: readonly string[]): string[] {
  let out = [...next];
  for (const v of next) {
    if (prev.includes(v) || !out.includes(v)) continue;
    const t = readTick(v);
    out = out.filter(x => {
      if (x === v) return true;
      const o = readTick(x);
      return o.facilityId !== t.facilityId || !partsOverlap(o.mask, t.mask);
    });
  }
  return out;
}

/** A row's places as the schedule stores them: its fields (once each, in `order`) and, for a field ticked in parts, which. */
export interface RowPlaces { facilityIds: string[]; parts?: Record<string, number[]> }

/** Ticks → the row's places. A field with only its whole tick names no parts. */
export function placesOfTicks(ticks: readonly string[], order: readonly string[]): RowPlaces {
  const masks = new Map<string, number[]>();
  for (const v of ticks) {
    const t = readTick(v);
    const list = masks.get(t.facilityId) ?? [];
    if (!list.includes(t.mask)) list.push(t.mask);
    masks.set(t.facilityId, list);
  }
  const facilityIds = order.filter(id => masks.has(id));
  const parts: Record<string, number[]> = {};
  for (const id of facilityIds) {
    const list = masks.get(id)!;
    if (list.some(m => m !== WHOLE)) parts[id] = sortMasks(list.filter(m => m !== WHOLE));
  }
  return Object.keys(parts).length ? { facilityIds, parts } : { facilityIds };
}

/** The row's places → its ticks. */
export function ticksOfPlaces(p: RowPlaces): string[] {
  return p.facilityIds.flatMap(id => (p.parts?.[id]?.length ? p.parts[id].map(m => tickValue(id, m)) : [id]));
}

/** The masks a row names on a field: its parts, else the whole field. */
export const masksOn = (p: { parts?: Readonly<Record<string, readonly number[]>> | null }, facilityId: string): readonly number[] =>
  p.parts?.[facilityId]?.length ? p.parts[facilityId] : [WHOLE];

/** A mask's place in the order a field lists them: whole, A–B, C–D, A, B, C, D (the cut, the kept merge and the grid). */
export const maskRank = (mask: number | null | undefined): number => LEGAL[4].indexOf(maskOf(mask));

/** Masks in the order a field lists them: whole, A–B, C–D, A, B, C, D. */
export function sortMasks(masks: readonly number[]): number[] {
  return [...masks].sort((a, b) => maskRank(a) - maskRank(b));
}

/** "A", "B and C", "A–B, C and D" — `joinWithAnd` (lib/utils), copied: this module imports nothing (its test holds it). */
function joinAnd(items: readonly string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** A key's part suffix: nothing for the whole field (so a whole field keys exactly as before parts), else `sep` + mask. */
export const maskSuffix = (mask: number | null | undefined, sep = '|'): string => {
  const m = maskOf(mask);
  return m === WHOLE ? '' : `${sep}${m}`;
};

/** A slot's optional part: no property for the whole field (so a whole-field slot is the object it was), else the mask. */
export const maskProp = (mask: number | null | undefined): { sectionMask?: number } => {
  const m = maskOf(mask);
  return m === WHOLE ? {} : { sectionMask: m };
};

/**
 * ONE FIELD's ticks in words, for the row's box: "Field 1 in four quarters" (every quarter), "Field 2 in two sides" (both
 * sides), "Field 2 side A", "Field 1 quarters A–B, C and D", "Field 1 quarters A and C", "Field 1" (whole).
 */
export function fieldTicksWords(name: string, masks: readonly number[], sections: FieldSections): string {
  const parts = sortMasks(masks.filter(m => m !== WHOLE));
  if (!parts.length) return name;
  if (sections === 2 && parts.length === 2 && parts.every(m => partFactor(m) === 0.5)) return splitFieldWords(name, 2);
  if (sections === 4 && parts.length === 4 && parts.every(m => partFactor(m) === 0.25)) return splitFieldWords(name, 4);
  if (parts.length === 1) return fieldPartName(name, parts[0], sections);
  if (sections === 2) return `${name} ${joinAnd(parts.map(m => partWords(m, 2)!))}`;
  // Low quarter first: A–B before C, C before D.
  const byGround = [...parts].sort((a, b) => sectionRange(a)[0] - sectionRange(b)[0]);
  return `${name} quarters ${joinAnd(byGround.map(letters))}`;
}

/** The database's `section_range` (mig 541), mirrored for the test: the mask as a run of quarters [lo, hi). */
export function sectionRange(mask: number): [number, number] {
  switch (maskOf(mask)) {
    case 1: return [0, 1];
    case 2: return [1, 2];
    case 4: return [2, 3];
    case 8: return [3, 4];
    case 3: return [0, 2];
    case 12: return [2, 4];
    default: return [0, 4];
  }
}
