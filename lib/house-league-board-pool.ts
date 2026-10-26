/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE DRAFT BOARD'S POOL TOOLS AND FAMILIES (HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE, rulings A3–A6). Pure and client-safe:
 * the board computes every mark, count and order from its one read, never a fetch per row (build prompt argument 5).
 *
 *   · A household is the same guardian email (trimmed, lower-cased), NEVER a surname (A6). A child with no email is a
 *     household of one. The count is the household's children in THIS division: the board holds one division.
 *   · Search finds a player, or a family by the parent's name or email (A3).
 *   · The filter's ticks are OR'd, as one group of Registrations' filter is; its counts are over the whole pool (A4).
 *   · Sort is a pick-one (A5): Last name · Rating (strongest first) · Age (youngest first) · Family.
 * Tests: tests/unit/house-league-board-pool.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface PoolPlayer {
  id: string;
  firstName: string;
  lastName: string;
  age: number | null;
  owes: number | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
}

/** The household a child belongs to, or null when the sign-up gave no email (then they stand alone). */
export function householdKey(guardianEmail: string | null | undefined): string | null {
  const key = (guardianEmail ?? '').trim().toLowerCase();
  return key || null;
}

/** Every household of two or more children in the given players (one division's), by key. */
export function familiesOf<P extends { guardianEmail: string }>(players: readonly P[]): Map<string, P[]> {
  const all = new Map<string, P[]>();
  for (const p of players) {
    const key = householdKey(p.guardianEmail);
    if (!key) continue;
    const list = all.get(key);
    if (list) list.push(p); else all.set(key, [p]);
  }
  for (const [key, list] of all) if (list.length < 2) all.delete(key);
  return all;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** A player matches when every word typed is in their name, or in their parent's name or email. */
export function matchesSearch(p: PoolPlayer, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fold(`${p.firstName} ${p.lastName} ${p.guardianFirstName} ${p.guardianLastName} ${p.guardianEmail}`);
  return words.every(w => hay.includes(w));
}

export type PoolFilter = 'notRated' | 'notes' | 'owing' | 'sibling';

export interface PoolFacts {
  ratings: ReadonlyMap<string, number>;
  /** Present only for a reader who can open registrations (A8); absent, the Notes option is absent too. */
  notes: Readonly<Record<string, string>> | null;
  families: ReadonlyMap<string, readonly unknown[]>;
}

export function hasFilter(p: PoolPlayer, f: PoolFilter, facts: PoolFacts): boolean {
  switch (f) {
    case 'notRated': return !facts.ratings.has(p.id);
    case 'notes': return !!facts.notes?.[p.id];
    case 'owing': return p.owes != null;
    case 'sibling': { const key = householdKey(p.guardianEmail); return !!key && facts.families.has(key); }
  }
}

/** The pool, narrowed by the search and the ticked filters (any one of them). */
export function narrowPool<P extends PoolPlayer>(pool: readonly P[], query: string, picks: readonly PoolFilter[], facts: PoolFacts): P[] {
  return pool.filter(p => matchesSearch(p, query) && (picks.length === 0 || picks.some(f => hasFilter(p, f, facts))));
}

/** How many of the pool each option would show, at the row's end (A4). */
export function filterCounts(pool: readonly PoolPlayer[], options: readonly PoolFilter[], facts: PoolFacts): Record<PoolFilter, number> {
  const out = { notRated: 0, notes: 0, owing: 0, sibling: 0 } as Record<PoolFilter, number>;
  for (const f of options) out[f] = pool.filter(p => hasFilter(p, f, facts)).length;
  return out;
}

export type PoolSort = 'last' | 'rating' | 'age' | 'family';

const byName = (a: PoolPlayer, b: PoolPlayer) =>
  a.lastName.localeCompare(b.lastName, 'en-CA', { sensitivity: 'base' })
  || a.firstName.localeCompare(b.firstName, 'en-CA', { sensitivity: 'base' })
  || a.id.localeCompare(b.id);

/**
 * The pool in the chosen order. Rating: strongest first, a not-rated player after every rated one (the draft counts them
 * as a 3, but by hand a convenor takes the best player they know). Age: youngest first, no age last. Family: households
 * together — ordered by the parent's last name, then the email — each child by name; a child on their own sits in the
 * same alphabet by their parent's name. Every order breaks a tie by name, so nothing jumps between renders.
 */
export function sortPool<P extends PoolPlayer>(pool: readonly P[], sort: PoolSort, ratings: ReadonlyMap<string, number>): P[] {
  const out = [...pool];
  if (sort === 'last') return out.sort(byName);
  if (sort === 'rating') {
    return out.sort((a, b) => (ratings.get(b.id) ?? 0) - (ratings.get(a.id) ?? 0) || byName(a, b));
  }
  if (sort === 'age') {
    return out.sort((a, b) => (a.age ?? Infinity) - (b.age ?? Infinity) || byName(a, b));
  }
  // One surname a household: the first one its children carry (by id, so it never depends on the incoming order) — a
  // parent's name typed two ways on two sign-ups must not split the family it sorts together.
  const surname = new Map<string, string>();
  for (const p of [...pool].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = householdKey(p.guardianEmail);
    if (key && !surname.has(key)) surname.set(key, fold(p.guardianLastName || p.lastName));
  }
  const nameOf = (p: PoolPlayer) => { const key = householdKey(p.guardianEmail); return key ? surname.get(key)! : fold(p.guardianLastName || p.lastName); };
  const homeOf = (p: PoolPlayer) => householdKey(p.guardianEmail) ?? `~${p.id}`;
  return out.sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'en-CA') || (homeOf(a) < homeOf(b) ? -1 : homeOf(a) > homeOf(b) ? 1 : 0) || byName(a, b));
}
