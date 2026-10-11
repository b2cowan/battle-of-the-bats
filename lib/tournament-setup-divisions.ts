/**
 * NEW TOURNAMENT, STEP 2 — THE DIVISIONS, AS A TICKED LIST (Tournament admin redesign, walk §290 finding; the owner
 * ruled all seven asks as recommended, 2026-10-11 — sheet https://claude.ai/artifact/L7ddaLNLxucvkZN1vgCLBz). The step's
 * pure rules, so a plain Node unit test reads them:
 *
 *   - THE START (Ask 1): nine common divisions are listed as ready-made rows to tick — U9 … U19, Open, Competitive and
 *     Recreational — and NOTHING is ticked. A one-division event is one tick.
 *   - ⚖ ONE FLAT LIST, NO HEADINGS (owner, 2026-10-11, at the build's review — superseding Ask 5's Youth / Adult /
 *     Other): "a tournament should be allowed to have open, U11, U21, mixed, etc. without our app finding arbitrary
 *     groups for them". The nine are examples, not a structure; a division you add goes at the END, in the order added,
 *     and nothing ever moves a row. (The heading rule put a "U19 Girls" under Other, apart from the U19 preset.)
 *   - ONLY TICKED ROWS ARE CREATED: the payload, the preview's Divisions and Team Spots, and the review step's row all
 *     count ticked rows only. An unticked row is listed and left out — delete is never a row action.
 *   - OPEN AND CLOSE: a cleared name HOLDS a row's arrow or window open (it is never dropped without a word), and a row
 *     unticked with its name cleared takes back the name it opened with.
 *   - THE MISTAKES keep today's words (a name listed twice, Teams it holds under 1, Youngest over Oldest), read over the
 *     TICKED rows; and a ticked division with no name is now refused in words — it used to be dropped without one. Two
 *     names are one name by the house's one rule (`sameKey`: case and spaces aside), as the copy paths read them.
 */
import { CREATE_WORDS as W, typedAge } from './tournament-setup-words.ts';
import { sameKey } from './utils.ts';

/** The nine ready-made divisions, in the list's order. */
export const DIVISION_PRESETS = ['U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Open', 'Competitive', 'Recreational'] as const;
const ADULT_PRESETS: readonly string[] = ['Open', 'Competitive', 'Recreational'];

/** One division as the step holds it: its fields as typed, and whether it is in. */
export type SetupDivision = {
  id: string;
  name: string;
  minAge: string;
  maxAge: string;
  capacity: string;
  usePools: boolean;
  poolCount: number;
  poolNames: string[];
  requiresPoolSelection: boolean;
  ticked: boolean;
  /** UI state only — the name it had when its arrow or window opened. */
  openedName?: string;
};

export const poolLetter = (i: number) => String.fromCharCode(65 + i);

/** The ages a name gives: a name that STARTS with an age group — "U12", "U12 Girls" (or a typed "12U") — is up to age
 *  12; the three adult presets are 18 and up; anything else gives none. */
export function starterAges(name: string): { minAge: string; maxAge: string } {
  const ageGroup = name.trim().match(/^U\s*(\d{1,2})\b/i) || name.trim().match(/^(\d{1,2})\s*U\b/i);
  if (ageGroup) return { minAge: '', maxAge: ageGroup[1] };
  if (ADULT_PRESETS.includes(name.trim())) return { minAge: '18', maxAge: '' };
  return { minAge: '', maxAge: '' };
}

/** A division as the step makes it: 8 teams, no pools, unticked unless said. */
export function setupDivision(id: string, name: string, extra: Partial<SetupDivision> = {}): SetupDivision {
  return {
    id, name, ...starterAges(name), capacity: '8',
    usePools: false, poolCount: 2, poolNames: [W.poolName('A'), W.poolName('B')], requiresPoolSelection: false,
    ticked: false, ...extra,
  };
}

/** The step's start (Ask 1): the nine ready-made divisions, none ticked. */
export function presetDivisions(nextId: () => string): SetupDivision[] {
  return DIVISION_PRESETS.map(n => setupDivision(nextId(), n));
}

/** A row's arrow or window opening: it remembers its name (a cleared one keeps the name it had before). */
export function openDivision(rows: readonly SetupDivision[], id: string): SetupDivision[] {
  return rows.map(r => (r.id === id ? { ...r, openedName: r.name.trim() ? r.name : r.openedName ?? r.name } : r));
}

/** Whether a row's arrow or window may close: a ticked row with no name HOLDS it open. */
export function holdsOpen(rows: readonly SetupDivision[], id: string): boolean {
  const d = rows.find(r => r.id === id);
  return Boolean(d && d.ticked && !d.name.trim());
}

/** Ticking or unticking rows. Unticked with its name cleared, a row takes back the name it opened with — never a blank
 *  row in the list. */
export function tickDivisions(rows: readonly SetupDivision[], ids: readonly string[], on: boolean): SetupDivision[] {
  const these = new Set(ids);
  return rows.map(r => {
    if (!these.has(r.id)) return r;
    const name = !on && !r.name.trim() ? r.openedName ?? r.name : r.name;
    return { ...r, ticked: on, name };
  });
}

export const tickedDivisions = (rows: readonly SetupDivision[]) => rows.filter(r => r.ticked);

/** How many are ticked and how many team spots they hold — the closing row, the phone band, the preview. */
export function divisionTotals(rows: readonly SetupDivision[]): { count: number; spots: number } {
  const on = tickedDivisions(rows);
  return { count: on.length, spots: on.reduce((n, d) => n + (Number(d.capacity) || 0), 0) };
}

/**
 * What is wrong with one TICKED division, in today's words — or null. A name listed twice is the LATER row's mistake
 * (the earlier one is the name it repeats), so renaming either clears it. An unticked row is never wrong: it is not made.
 */
export function divisionMistakeFor(rows: readonly SetupDivision[], id: string): string | null {
  const at = rows.findIndex(r => r.id === id);
  const d = rows[at];
  if (!d || !d.ticked) return null;
  const name = d.name.trim();
  if (!name) return W.divisionNameRequired;
  if (rows.slice(0, at).some(r => r.ticked && sameKey(r.name) === sameKey(name))) return W.divisionDuplicate(name);
  const cap = Number(d.capacity);
  if (!Number.isFinite(cap) || cap < 1) return W.divisionCapacity;
  const min = typedAge(d.minAge);
  const max = typedAge(d.maxAge);
  if (min !== null && max !== null && min > max) return W.divisionAges;
  return null;
}

/** The first mistake among the TICKED rows, and the division it belongs to (Next opens it). */
export function divisionsMistake(rows: readonly SetupDivision[]): { id: string; text: string } | null {
  for (const d of tickedDivisions(rows)) {
    const text = divisionMistakeFor(rows, d.id);
    if (text) return { id: d.id, text };
  }
  return null;
}

/** Why "Add division" can't add this name yet: blank, or already listed (ticked or not). */
export function addDivisionRefusal(rows: readonly SetupDivision[], name: string): string | null {
  const typed = name.trim();
  if (!typed) return W.divisionNameRequired;
  if (rows.some(r => sameKey(r.name) === sameKey(typed))) return W.divisionDuplicate(typed);
  return null;
}

/** One ticked division as the create step sends it. */
export function divisionPayload(d: SetupDivision) {
  const pools = d.usePools ? Math.max(2, Math.min(4, d.poolCount)) : 0;
  return {
    name: d.name.trim(),
    minAge: typedAge(d.minAge),
    maxAge: typedAge(d.maxAge),
    capacity: Math.max(1, Math.floor(Number(d.capacity)) || 8),
    poolCount: pools,
    poolNames: pools >= 2 ? d.poolNames.slice(0, pools).map((n, i) => n.replace(/,/g, ' ').trim() || W.poolName(poolLetter(i))).join(',') : '',
    requiresPoolSelection: pools >= 2 && d.requiresPoolSelection,
  };
}

/** What Create sends: the ticked rows only, or the first mistake among them. */
export function divisionsPayload(rows: readonly SetupDivision[]):
  { rows: ReturnType<typeof divisionPayload>[]; mistake: { id: string; text: string } | null } {
  const mistake = divisionsMistake(rows);
  if (mistake) return { rows: [], mistake };
  return { rows: tickedDivisions(rows).map(divisionPayload), mistake: null };
}
