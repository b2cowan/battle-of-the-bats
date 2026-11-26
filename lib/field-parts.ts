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
