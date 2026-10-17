/**
 * THE DUPLICATE RULE — which of a club's family records are proposed as one parent (Club Tier Stage 5b, Asks 7 and 18;
 * hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5 → P3). ONE home: the Duplicates tab's list, its count on the tab and the
 * rail, and the merge route's "is this still proposed?" all read `proposeDuplicates`. Pure — the server reads the rows
 * (lib/families-read.ts `buildDuplicatePairs`) and hands them in; a unit test exercises it directly.
 *
 * ⚖ "Matching too eagerly is worse than leaving duplicates" (Families plan §4): a wrong merge shows one parent another
 * parent's children. So a pair is proposed only when:
 *   · the SURNAMES are the same, and
 *   · the FIRST NAMES AGREE — the same name, or an initial that matches it ("D." and "Dana"). A record with no first name
 *     agrees with nothing (it is named by its address, and its address already differs), and
 *   · they share a PHONE NUMBER, or a CHILD that is the same child: the same name, and the same birth date where both rows
 *     carry one, otherwise the same team and season (a rep roster's team and program year; a house-league season).
 *     UAT Rep Club's 212 proposals were mostly a seed's name pool — seven "Caleb Hughes" guardians on seven different
 *     teams — and none of them meets this rule.
 *   · OR an edited guardian email moved a child from one record to the other (Stage 5a, E02 — `org_person_reattachments`):
 *     proposed whatever the names say, newest first, so a person decides whether it is one parent. Never merged alone.
 * "Not the same person" is remembered (`org_person_match_rejections`) and a remembered pair is never proposed again.
 *
 * THREE OR MORE that match are ONE proposal (a group), so a reviewer never merges A into B and then meets B again beside
 * C. ⚠ A group holding a pair someone already called "not the same person" would ask the reviewer to merge exactly that
 * pair, so such a group is shown as its matching pairs instead.
 *
 * THE KEEPER IS THE REVIEWER'S (Ask 7). Each proposal names a DEFAULT only: the record with children, then the newer one
 * — never the database's order or the address count (today's "D. Cole", with no children, kept over the Dana Cole the
 * club knows). The merge route merges only what this rule proposes NOW, into the keeper the request names.
 */

export interface DuplicateChildIn {
  /** The child's name as typed ("Peyton Cole"). */
  name: string;
  /** "YYYY-MM-DD" where the row carries one. */
  birthDate: string | null;
  /** Where the child is: a rep roster's team + program year, or a league season. Two rows in one context are one child. */
  context: string;
  /** "Fixture Falcons U13 · 2026" / "Summer 2026 · U11" — shown beside the name on the card. */
  where: string;
}

export interface DuplicatePersonIn {
  id: string;
  firstName: string | null;
  lastName: string | null;
  /** The record's display name (the name, or the address when it has none). */
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  addressCount: number;
  optedOut: boolean;
  children: DuplicateChildIn[];
}

export interface DuplicateMoveIn {
  fromPersonId: string;
  toPersonId: string;
  /** The sentence that says what moved ("An email changed on Tatum’s roster row, Oct 12, 2026"). */
  sentence: string;
  at: string;
}

export type DuplicateReasonKind = 'phone' | 'child' | 'email_changed';

export interface DuplicateSide {
  personId: string;
  name: string;
  email: string;
  phone: string | null;
  children: { name: string; where: string }[];
  addressCount: number;
  optedOut: boolean;
  /** When an edited email emptied this record, the day it happened ("None since Oct 12"). */
  emptiedAt: string | null;
}

export interface DuplicateProposal {
  /** The sides' ids, sorted and joined — stable across reloads while the proposal stands. */
  id: string;
  sides: DuplicateSide[];
  /** What made the match: one kind or several, and the shared child's name when a child did. */
  reasons: DuplicateReasonKind[];
  sharedChild: string | null;
  /** E02's sentence, when an edited email is the reason. */
  emailChanged: string | null;
  /** The default keeper's personId (the reviewer may choose another side). */
  keep: string;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/[.\s]+$/, '');
const firstToken = (s: string | null | undefined) => norm(s).split(/\s+/)[0]?.replace(/\./g, '') ?? '';
const normPhone = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

/** "Dana" and "Dana", or "D." and "Dana": the same name, or an initial that is its first letter. Empty agrees with nothing. */
export function firstNamesAgree(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = firstToken(a); const y = firstToken(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length === 1) return y.startsWith(x);
  if (y.length === 1) return x.startsWith(y);
  return false;
}

/** One child: the same name, and the same birth date where both carry one — otherwise the same team and season. */
export function sameChild(a: DuplicateChildIn, b: DuplicateChildIn): boolean {
  if (norm(a.name) !== norm(b.name) || !norm(a.name)) return false;
  if (a.birthDate && b.birthDate) return a.birthDate === b.birthDate;
  return a.context === b.context;
}

/** The default keeper: the record with children, then the newer one (then the id, so it never depends on row order). */
export function defaultKeeper(people: readonly DuplicatePersonIn[]): string {
  return [...people].sort((p, q) =>
    (q.children.length > 0 ? 1 : 0) - (p.children.length > 0 ? 1 : 0)
    || q.createdAt.localeCompare(p.createdAt)
    || p.id.localeCompare(q.id))[0].id;
}

const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

/** Joined sets of ids (path-compressed; the smaller id roots its set, so a set's root never depends on the order of
 *  joins). Shared with lib/families-read.ts's `childKeys` (which roster rows are one child). */
export function unionFind(): { find: (x: string) => string; union: (a: string, b: string) => void } {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.has(c) && parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n; }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  };
  return { find, union };
}

/**
 * The proposals, newest edited-email first, then by surname. `rejected` holds "a|b" keys (a < b) for every pair someone
 * called not the same person.
 */
export function proposeDuplicates(input: {
  people: readonly DuplicatePersonIn[];
  rejected: ReadonlySet<string>;
  moves: readonly DuplicateMoveIn[];
}): DuplicateProposal[] {
  const byId = new Map(input.people.map(p => [p.id, p]));
  type Edge = { a: string; b: string; kinds: Set<DuplicateReasonKind>; child: string | null; move: DuplicateMoveIn | null };
  const edges = new Map<string, Edge>();
  const edge = (a: string, b: string) => {
    const k = pairKey(a, b);
    let e = edges.get(k);
    if (!e) { e = { a: a < b ? a : b, b: a < b ? b : a, kinds: new Set(), child: null, move: null }; edges.set(k, e); }
    return e;
  };

  // (E02) An edited email moved a child from one record to another: proposed whatever the names say, the newest move
  // naming the pair.
  for (const m of [...input.moves].sort((x, y) => y.at.localeCompare(x.at))) {
    if (!byId.has(m.fromPersonId) || !byId.has(m.toPersonId) || m.fromPersonId === m.toPersonId) continue;
    if (input.rejected.has(pairKey(m.fromPersonId, m.toPersonId))) continue;
    const e = edge(m.fromPersonId, m.toPersonId);
    e.kinds.add('email_changed');
    e.move ??= m;
  }

  // Same surname, first names that agree, and a phone or a child in common. Grouped by surname first: only records
  // that share one can ever match, so the pairing stays within each surname.
  const bySurname = new Map<string, DuplicatePersonIn[]>();
  for (const p of input.people) {
    const s = norm(p.lastName);
    if (!s) continue;
    const list = bySurname.get(s);
    if (list) list.push(p); else bySurname.set(s, [p]);
  }
  for (const group of bySurname.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]; const b = group[j];
        if (input.rejected.has(pairKey(a.id, b.id))) continue;
        if (!firstNamesAgree(a.firstName, b.firstName)) continue;
        const phone = normPhone(a.phone).length >= 7 && normPhone(a.phone) === normPhone(b.phone);
        const shared = a.children.find(ca => b.children.some(cb => sameChild(ca, cb))) ?? null;
        if (!phone && !shared) continue;
        const e = edge(a.id, b.id);
        if (phone) e.kinds.add('phone');
        if (shared) { e.kinds.add('child'); e.child ??= shared.name; }
      }
    }
  }

  // Groups: records joined by any proposed pair.
  const { find, union } = unionFind();
  for (const e of edges.values()) union(e.a, e.b);
  const groups = new Map<string, { ids: Set<string>; edges: Edge[] }>();
  for (const e of edges.values()) {
    const r = find(e.a);
    const g = groups.get(r) ?? { ids: new Set<string>(), edges: [] };
    g.ids.add(e.a); g.ids.add(e.b); g.edges.push(e);
    groups.set(r, g);
  }

  const emptied = new Map<string, string>();
  for (const m of input.moves) {
    const p = byId.get(m.fromPersonId);
    if (p && p.children.length === 0) {
      const cur = emptied.get(p.id);
      if (!cur || m.at > cur) emptied.set(p.id, m.at);
    }
  }
  const side = (p: DuplicatePersonIn): DuplicateSide => ({
    personId: p.id, name: p.name, email: p.email, phone: p.phone,
    children: p.children.map(c => ({ name: c.name, where: c.where })),
    addressCount: p.addressCount, optedOut: p.optedOut, emptiedAt: emptied.get(p.id) ?? null,
  });
  /** Each proposal's newest edited-email move (0 for none) — its sort key, read once. */
  const movedAt = new Map<DuplicateProposal, number>();
  const proposal = (ids: string[], es: Edge[]): DuplicateProposal => {
    const people = ids.map(id => byId.get(id)!).sort((p, q) => p.name.localeCompare(q.name) || p.id.localeCompare(q.id));
    const keep = defaultKeeper(people);
    const kinds = new Set<DuplicateReasonKind>();
    for (const e of es) for (const k of e.kinds) kinds.add(k);
    const move = es.map(e => e.move).filter((m): m is DuplicateMoveIn => !!m).sort((x, y) => y.at.localeCompare(x.at))[0] ?? null;
    // The keeper first, so the card reads "Keep this record" on the left by default.
    const ordered = [people.find(p => p.id === keep)!, ...people.filter(p => p.id !== keep)];
    const made: DuplicateProposal = {
      id: [...ids].sort().join('|'),
      sides: ordered.map(side),
      reasons: (['email_changed', 'phone', 'child'] as const).filter(k => kinds.has(k)),
      sharedChild: es.map(e => e.child).find(Boolean) ?? null,
      emailChanged: move?.sentence ?? null,
      keep,
    };
    movedAt.set(made, move ? Date.parse(move.at) || 0 : 0);
    return made;
  };

  const out: DuplicateProposal[] = [];
  for (const g of groups.values()) {
    const ids = [...g.ids];
    const holdsRejected = ids.some((x, i) => ids.slice(i + 1).some(y => input.rejected.has(pairKey(x, y))));
    if (ids.length > 2 && holdsRejected) {
      for (const e of g.edges) out.push(proposal([e.a, e.b], [e]));
    } else {
      out.push(proposal(ids, g.edges));
    }
  }
  return out.sort((x, y) => movedAt.get(y)! - movedAt.get(x)!
    || norm(byId.get(x.keep)?.lastName).localeCompare(norm(byId.get(y.keep)?.lastName))
    || x.id.localeCompare(y.id));
}

/**
 * Is this set of records EXACTLY one proposal standing NOW — the keeper and every record to merge into it, the whole card
 * and nothing else? ⚠ Never a subset (/review 2026-10-17): in a group A–B–C where A and C never matched each other, "A and
 * C" is not a proposal, so neither a merge nor a "not the same person" may be made of it by a crafted request.
 */
export function proposalHolding(proposals: readonly DuplicateProposal[], ids: readonly string[]): DuplicateProposal | null {
  if (ids.length < 2 || new Set(ids).size !== ids.length) return null;
  return proposals.find(p => p.sides.length === ids.length && ids.every(id => p.sides.some(s => s.personId === id))) ?? null;
}
