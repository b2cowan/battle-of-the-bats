/**
 * NEW TOURNAMENT, STEP 2 — THE DIVISIONS, A LIST OF ONLY YOURS (Tournament admin redesign, walk §290 finding; round 3,
 * ruled 2026-10-12 — the owner: "looks good, build as mocked", all four asks as recommended; sheet
 * https://claude.ai/artifact/L7ddaLNLxucvkZN1vgCLBz version 5). The step's pure rules, so a plain Node unit test reads
 * them:
 *
 *   - THE LIST HOLDS ONLY THIS TOURNAMENT'S DIVISIONS. It starts empty, every row in it is made, and so the totals (the
 *     closing row, the phone band, the preview) and the review step count every row. Round 2 listed the nine common
 *     divisions as rows to tick, and the owner read them as "predetermined groups but they actually are just
 *     suggestions" (§290, 2026-10-12).
 *   - THE NINE ARE SUGGESTIONS (Ask 1): U9 … U19, Open, Competitive and Recreational, offered under the name field while
 *     no listed division has that name. Adding one makes an ordinary row; remove or rename it and it is offered again.
 *     A row whose arrow or window is OPEN still holds the name it opened with, so a suggestion never comes and goes
 *     while its row's name is being typed.
 *   - YOUR OWN NAME (Ask 3): the same field, Add or Enter. A blank name, or one already listed, is refused in words.
 *   - A ROW LEAVES FROM ITS OWN FIELDS (Ask 2): "Remove this division" ends them — never an untick, never a mark on the
 *     row (delete is never a row action; a record's rare door ends its body).
 *   - AGES COME FROM AN AGE-GROUP NAME ONLY (Ask 4): "U12", "U12 Girls" or a typed "12U" is up to age 12; anything else,
 *     Open, Competitive and Recreational included, is Any age until the organizer sets one. (Round 2 made the three
 *     "18 and up" — a meaning the app chose for them.)
 *   - ONE FLAT LIST (owner, 2026-10-11): a division goes at the end in the order added, and nothing ever moves a row.
 *   - OPEN AND CLOSE: a cleared name HOLDS a row's arrow or window open — it is never dropped without a word.
 *   - THE MISTAKES keep their words (a name listed twice, Teams it holds under 1, Youngest over Oldest, no name). Two
 *     names are one name by the house's one rule (`sameKey`: case and spaces aside), as the copy paths read them.
 */
import { CREATE_WORDS as W, typedAge } from './tournament-setup-words.ts';
import { sameKey } from './utils.ts';

/** The nine common divisions, in the order they are suggested. */
export const DIVISION_PRESETS = ['U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Open', 'Competitive', 'Recreational'] as const;

/** One division as the step holds it: its fields as typed. */
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
  /** UI state only — the name it had when its arrow or window opened. */
  openedName?: string;
};

export const poolLetter = (i: number) => String.fromCharCode(65 + i);

/** The ages a name gives: a name that STARTS with an age group — "U12", "U12 Girls" (or a typed "12U") — is up to age
 *  12; anything else gives none (Any age). */
export function starterAges(name: string): { minAge: string; maxAge: string } {
  const ageGroup = name.trim().match(/^U\s*(\d{1,2})\b/i) || name.trim().match(/^(\d{1,2})\s*U\b/i);
  return ageGroup ? { minAge: '', maxAge: ageGroup[1] } : { minAge: '', maxAge: '' };
}

/** A division as the step adds it, at the end of the list: its name, the ages the name gives, 8 teams, no pools. */
export function setupDivision(id: string, name: string): SetupDivision {
  return {
    id, name, ...starterAges(name), capacity: '8',
    usePools: false, poolCount: 2, poolNames: [W.poolName('A'), W.poolName('B')], requiresPoolSelection: false,
  };
}

/**
 * The common divisions still offered: those no listed division is named. A row that is open (`openIds`, its arrow or
 * its window) also holds the name it opened with, so renaming "U11" to "U11 Girls" brings "U11" back when the row
 * closes, never letter by letter while it is typed.
 */
export function suggestedDivisions(rows: readonly SetupDivision[], openIds: ReadonlySet<string> = new Set()): string[] {
  const taken = new Set<string>();
  for (const r of rows) {
    taken.add(sameKey(r.name));
    if (openIds.has(r.id) && r.openedName) taken.add(sameKey(r.openedName));
  }
  return DIVISION_PRESETS.filter(p => !taken.has(sameKey(p)));
}

/** Why this name can't be added (a suggestion or a typed name): blank, or already listed — or null, and the step adds
 *  `setupDivision(id, name.trim())` at the END of the list. */
export function addDivisionRefusal(rows: readonly SetupDivision[], name: string): string | null {
  const typed = name.trim();
  if (!typed) return W.divisionNameRequired;
  if (rows.some(r => sameKey(r.name) === sameKey(typed))) return W.divisionListed(typed);
  return null;
}

/** "Remove this division": the row leaves the list. */
export function removeDivision(rows: readonly SetupDivision[], id: string): SetupDivision[] {
  return rows.filter(r => r.id !== id);
}

/** A row's arrow or window opening: it remembers its name (a cleared one keeps the name it had before). */
export function openDivision(rows: readonly SetupDivision[], id: string): SetupDivision[] {
  return rows.map(r => (r.id === id ? { ...r, openedName: r.name.trim() ? r.name : r.openedName ?? r.name } : r));
}

/** Whether a row's arrow or window must stay open: a row with no name HOLDS it. */
export function holdsOpen(rows: readonly SetupDivision[], id: string): boolean {
  const d = rows.find(r => r.id === id);
  return Boolean(d && !d.name.trim());
}

/** How many divisions and how many team spots they hold — the closing row, the phone band, the preview. */
export function divisionTotals(rows: readonly SetupDivision[]): { count: number; spots: number } {
  return { count: rows.length, spots: rows.reduce((n, d) => n + (Number(d.capacity) || 0), 0) };
}

/**
 * What is wrong with one division, in the step's words — or null. A name listed twice is the LATER row's mistake (the
 * earlier one is the name it repeats), so renaming either clears it.
 */
export function divisionMistakeFor(rows: readonly SetupDivision[], id: string): string | null {
  const at = rows.findIndex(r => r.id === id);
  const d = rows[at];
  if (!d) return null;
  const name = d.name.trim();
  if (!name) return W.divisionNameRequired;
  if (rows.slice(0, at).some(r => sameKey(r.name) === sameKey(name))) return W.divisionDuplicate(name);
  const cap = Number(d.capacity);
  if (!Number.isFinite(cap) || cap < 1) return W.divisionCapacity;
  const min = typedAge(d.minAge);
  const max = typedAge(d.maxAge);
  if (min !== null && max !== null && min > max) return W.divisionAges;
  return null;
}

/** The first mistake in the list, and the division it belongs to (Next opens it). */
export function divisionsMistake(rows: readonly SetupDivision[]): { id: string; text: string } | null {
  for (const d of rows) {
    const text = divisionMistakeFor(rows, d.id);
    if (text) return { id: d.id, text };
  }
  return null;
}

/** One division as the create step sends it. */
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

/** What Create sends: every listed division, or the first mistake among them. */
export function divisionsPayload(rows: readonly SetupDivision[]):
  { rows: ReturnType<typeof divisionPayload>[]; mistake: { id: string; text: string } | null } {
  const mistake = divisionsMistake(rows);
  if (mistake) return { rows: [], mistake };
  return { rows: rows.map(divisionPayload), mistake: null };
}
