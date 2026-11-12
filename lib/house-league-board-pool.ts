import { keepTogetherGroups, type LinkOutcome } from './house-league-draft';
import type { DivisionLink } from './league-friend-draft';

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

export type PoolFilter = 'notRated' | 'notes' | 'owing' | 'sibling' | 'friend';

export interface PoolFacts {
  ratings: ReadonlyMap<string, number>;
  /** Present only for a reader who can open registrations (A8); absent, the Notes option is absent too. */
  notes: Readonly<Record<string, string>> | null;
  families: ReadonlyMap<string, readonly unknown[]>;
  /** Board Ready Stage 1 Part 3: the children whose family named a friend — present only for a reader of Registrations (A11). */
  friends?: ReadonlySet<string> | null;
}

export function hasFilter(p: PoolPlayer, f: PoolFilter, facts: PoolFacts): boolean {
  switch (f) {
    case 'notRated': return !facts.ratings.has(p.id);
    case 'notes': return !!facts.notes?.[p.id];
    case 'owing': return p.owes != null;
    case 'sibling': { const key = householdKey(p.guardianEmail); return !!key && facts.families.has(key); }
    case 'friend': return !!facts.friends?.has(p.id);
  }
}

/** The pool, narrowed by the search and the ticked filters (any one of them). */
export function narrowPool<P extends PoolPlayer>(pool: readonly P[], query: string, picks: readonly PoolFilter[], facts: PoolFacts): P[] {
  return pool.filter(p => matchesSearch(p, query) && (picks.length === 0 || picks.some(f => hasFilter(p, f, facts))));
}

/** How many of the pool each option would show, at the row's end (A4). */
export function filterCounts(pool: readonly PoolPlayer[], options: readonly PoolFilter[], facts: PoolFacts): Record<PoolFilter, number> {
  const out = { notRated: 0, notes: 0, owing: 0, sibling: 0, friend: 0 } as Record<PoolFilter, number>;
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
 *
 * `reverse` flips the order the sort opens in (owner, 2026-10-26: one arrow beside the Sort pick). A not-rated or no-age
 * player stays last either way, and a household's children stay in name order, so brothers and sisters never read
 * backwards. Family opens with the children who have a sibling in the division (`households`, the Filter's own
 * definition; a pool with none passed falls back to its own households of two or more), then everyone else.
 */
export function sortPool<P extends PoolPlayer>(
  pool: readonly P[], sort: PoolSort, ratings: ReadonlyMap<string, number>,
  opts: { reverse?: boolean; households?: ReadonlyMap<string, unknown> } = {},
): P[] {
  const out = [...pool];
  const dir = opts.reverse ? -1 : 1;
  if (sort === 'last') return out.sort((a, b) => dir * byName(a, b));
  if (sort === 'rating') {
    return out.sort((a, b) => {
      const ra = ratings.get(a.id), rb = ratings.get(b.id);
      if (ra === undefined || rb === undefined) return (ra === undefined ? 1 : 0) - (rb === undefined ? 1 : 0) || byName(a, b);
      return dir * (rb - ra) || byName(a, b);
    });
  }
  if (sort === 'age') {
    return out.sort((a, b) => {
      if (a.age == null || b.age == null) return (a.age == null ? 1 : 0) - (b.age == null ? 1 : 0) || byName(a, b);
      return dir * (a.age - b.age) || byName(a, b);
    });
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
  const sizes = new Map<string, number>();
  for (const p of pool) { const key = householdKey(p.guardianEmail); if (key) sizes.set(key, (sizes.get(key) ?? 0) + 1); }
  const hasSibling = (p: PoolPlayer) => {
    const key = householdKey(p.guardianEmail);
    return !!key && (opts.households ? opts.households.has(key) : (sizes.get(key) ?? 0) > 1);
  };
  return out.sort((a, b) =>
    dir * ((hasSibling(b) ? 1 : 0) - (hasSibling(a) ? 1 : 0)
      || nameOf(a).localeCompare(nameOf(b), 'en-CA')
      || (homeOf(a) < homeOf(b) ? -1 : homeOf(a) > homeOf(b) ? 1 : 0))
    || byName(a, b));
}

// ── TOGETHER (Board Ready Stage 1 Part 3; drawing 5b option B, ruling A14) ─────────────────────────────────────────

export interface TogetherPerson {
  id: string;
  /** A brother or sister (one parent email), or a friend — a confirmed one, or the friend of someone in the group. */
  kind: 'family' | 'friend';
  /** The player's own link to this friend, when they asked or were asked (null for family, or a friend's friend). */
  link: DivisionLink | null;
  /** What the draft would do with that link today: the board reads the same groups the draft deals. */
  outcome: LinkOutcome | null;
}

export interface TogetherPlayer {
  id: string;
  teamId: string | null;
  locked: boolean;
  guardianEmail: string;
}

/**
 * Who each child is to be kept with: their group (brothers and sisters, plus the friends the draft keeps with them, at
 * most 3 children) and every friend they have a confirmed link to, kept or not — so a friend kept apart, or over the
 * cap, still shows, in amber, on the player who asked. Without links (a reader who can't open Registrations, or a
 * season with no friend requests) it is the family alone, as the family mark was.
 */
export function togetherOf<P extends TogetherPlayer>(players: readonly P[], teamIds: readonly string[], links: readonly DivisionLink[] | null): Map<string, TogetherPerson[]> {
  const draftPlayers = players.map(p => ({ id: p.id, rating: null, lockedTeamId: p.locked ? p.teamId : null, household: p.guardianEmail }));
  const groups = keepTogetherGroups(draftPlayers, teamIds, { together: true, friends: links ?? [] });
  const home = new Map(players.map(p => [p.id, householdKey(p.guardianEmail)]));
  const out = new Map<string, TogetherPerson[]>();
  for (const p of players) {
    const mine = home.get(p.id);
    const people = new Map<string, TogetherPerson>();
    for (const id of groups.groupOf.get(p.id)!.ids) {
      if (id === p.id) continue;
      people.set(id, { id, kind: mine && home.get(id) === mine ? 'family' : 'friend', link: null, outcome: null });
    }
    // Every brother and sister in the division, even one a lock put on another team (the family mark's own rule).
    if (mine) for (const k of players) if (k.id !== p.id && home.get(k.id) === mine && !people.has(k.id)) people.set(k.id, { id: k.id, kind: 'family', link: null, outcome: null });
    for (const l of links ?? []) {
      if (l.a !== p.id && l.b !== p.id) continue;
      const other = l.a === p.id ? l.b : l.a;
      if (!home.has(other)) continue;
      const kind = mine && home.get(other) === mine ? 'family' : 'friend';
      people.set(other, { id: other, kind, link: l, outcome: groups.links.get(l.id) ?? null });
    }
    if (people.size) out.set(p.id, [...people.values()]);
  }
  return out;
}
