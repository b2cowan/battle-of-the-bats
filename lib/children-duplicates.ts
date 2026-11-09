/**
 * THE CHILDREN DUPLICATE RULE — which of a club's child records are proposed as one child (Club Tier Stage 14 S6, Ask 11;
 * drawings tab 6). ONE home: the Children half of Families → Duplicates (its list, its count on the tab and the rail) and the
 * join route's "is this still proposed?" all read `proposeChildDuplicates`. Pure — the server reads the rows
 * (lib/children-duplicates-read.ts) and hands them in; a unit test exercises it directly. Its sibling is the parents' rule,
 * lib/families-duplicates.ts, and it shares that file's union-find and its "exactly one standing proposal" check.
 *
 * ⚖ Ask 4: a match is always a QUESTION, never an answer. A pair is proposed only when
 *   · the FIRST and LAST name are the same (normalised as the returning-player matcher does — `normName`); a different first
 *     name is a different child (twins), a record with no last name is never proposed, and
 *   · the BIRTH DATE is the same on both — or missing on exactly one side AND the two share a PARENT email. (Two missing
 *     dates are never enough; two different dates are never one child.)
 * Never a pair someone already said "no" to (`child_match_rejections`). A pair already on the SAME team in the SAME season is
 * still proposed (it is the commonest duplicate there is — a child typed in twice) but the card says the join cannot be made
 * until the extra entry is removed (`blockedBy`); the server refuses it in the same words.
 *
 * THE KEEPER IS THE REVIEWER'S. Each proposal names a DEFAULT only: the record with the most seasons, then one that has a
 * birth date, then the id. The kept record decides the child's name and birth date.
 */
import { pairKey, unionFind } from './families-duplicates';

export interface ChildRecordIn {
  id: string;
  firstName: string;
  lastName: string | null;
  /** "YYYY-MM-DD" or null. */
  birthDate: string | null;
  /** The parent emails typed on this child's entries, normalised (lowercase, trimmed). */
  parentEmails: readonly string[];
  /** "Grace Chen · grace.chen@example.com" — the newest entry's typed guardian, or null. */
  parentLine: string | null;
  /** One line per season: "Lynx 11U AAA, 2026 Season" / "House league, Summer 2025 · U10 Rookie · Blue Jays", newest first. */
  seasons: readonly string[];
  /** "3 documents · medical note on file" / "Waiver accepted May 2, 2025" — or null. */
  detailLine: string | null;
  /** One key per rep roster entry, `${teamId}|${programYearId}` — two records sharing one cannot be joined. */
  teamSeasons: readonly { key: string; label: string }[];
  /** For the default keeper: how many seasons (rep + house league) the record holds. */
  seasonCount: number;
}

export type ChildReasonKind = 'same_parent' | 'different_parent' | 'missing_birth_date';

export interface ChildSide {
  childId: string;
  name: string;
  birthDate: string | null;
  seasons: string[];
  parentLine: string | null;
  detailLine: string | null;
  /** Stage 4a (Part 8.3): the adults connected to this record in the family app (set by the read only while the tier is on). */
  connectedParents?: string[];
}

export interface ChildProposal {
  /** The sides' ids, sorted and joined — stable across reloads while the proposal stands. */
  id: string;
  sides: ChildSide[];
  reason: ChildReasonKind;
  /** The default keeper's child id (the reviewer may choose another side). */
  keep: string;
  /** "Lynx 12U AAA 2027 Season" when two of the records are on one team in one season — the join is refused until fixed. */
  blockedBy: string | null;
  /** Total seasons across the sides (the consequence line says "all three seasons"). */
  seasonCount: number;
}

/** The strongest reason reads first: same parent, then a different parent, then a missing birth date. */
const REASON_RANK: ChildReasonKind[] = ['same_parent', 'different_parent', 'missing_birth_date'];
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const fullName = (c: Pick<ChildRecordIn, 'firstName' | 'lastName'>) => `${c.firstName} ${c.lastName ?? ''}`.trim();

/** The default keeper: the record with the most seasons, then one with a birth date, then the id (never the read's order). */
export function defaultChildKeeper(children: readonly ChildRecordIn[]): string {
  return [...children].sort((a, b) =>
    b.seasonCount - a.seasonCount
    || Number(!!b.birthDate) - Number(!!a.birthDate)
    || a.id.localeCompare(b.id))[0].id;
}

/** Does this pair satisfy the rule? Returns the reason, or null. (Rejected pairs are the caller's filter.) */
export function childPairReason(a: ChildRecordIn, b: ChildRecordIn): ChildReasonKind | null {
  if (!norm(a.firstName) || norm(a.firstName) !== norm(b.firstName)) return null;
  if (!norm(a.lastName) || norm(a.lastName) !== norm(b.lastName)) return null;
  const sharedParent = a.parentEmails.some(e => b.parentEmails.includes(e));
  if (a.birthDate && b.birthDate) {
    if (a.birthDate !== b.birthDate) return null;
    return sharedParent ? 'same_parent' : 'different_parent';
  }
  // A birth date missing on exactly one side needs the same parent to make it a question at all.
  if (!!a.birthDate !== !!b.birthDate && sharedParent) return 'missing_birth_date';
  return null;
}

/** The team-season two records both sit on (the join is refused there), or null. */
export function sharedTeamSeason(a: ChildRecordIn, b: ChildRecordIn): string | null {
  const keys = new Map(a.teamSeasons.map(t => [t.key, t.label]));
  for (const t of b.teamSeasons) if (keys.has(t.key)) return t.label;
  return null;
}

/**
 * The proposals. `rejected` holds "a|b" keys (a < b) for every pair of children someone called not the same child.
 * Three or more that match are ONE proposal (a group), so a reviewer never joins A into B and then meets B beside C; a group
 * that holds a pair someone said "no" to, or two different birth dates bridged by a record with none, is shown as its matching pairs instead.
 */
export function proposeChildDuplicates(input: {
  children: readonly ChildRecordIn[];
  rejected: ReadonlySet<string>;
}): ChildProposal[] {
  const byId = new Map(input.children.map(c => [c.id, c]));
  type Edge = { a: string; b: string; reason: ChildReasonKind };
  const edges: Edge[] = [];

  // Only records with the same full name can ever match, so the pairing stays inside each name.
  const byName = new Map<string, ChildRecordIn[]>();
  for (const c of input.children) {
    if (!norm(c.firstName) || !norm(c.lastName)) continue;
    const k = `${norm(c.firstName)}|${norm(c.lastName)}`;
    const list = byName.get(k);
    if (list) list.push(c); else byName.set(k, [c]);
  }
  for (const group of byName.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]; const b = group[j];
        if (input.rejected.has(pairKey(a.id, b.id))) continue;
        const reason = childPairReason(a, b);
        if (!reason) continue;
        edges.push({ a: a.id < b.id ? a.id : b.id, b: a.id < b.id ? b.id : a.id, reason });
      }
    }
  }

  const { find, union } = unionFind();
  for (const e of edges) union(e.a, e.b);
  const groups = new Map<string, { ids: Set<string>; edges: Edge[] }>();
  for (const e of edges) {
    const r = find(e.a);
    const g = groups.get(r) ?? { ids: new Set<string>(), edges: [] };
    g.ids.add(e.a); g.ids.add(e.b); g.edges.push(e);
    groups.set(r, g);
  }

  const side = (c: ChildRecordIn): ChildSide => ({
    childId: c.id, name: fullName(c), birthDate: c.birthDate, seasons: [...c.seasons],
    parentLine: c.parentLine, detailLine: c.detailLine,
  });
  const proposal = (ids: string[], es: Edge[]): ChildProposal => {
    const kids = ids.map(id => byId.get(id)!).sort((p, q) => q.seasonCount - p.seasonCount || p.id.localeCompare(q.id));
    const keep = defaultChildKeeper(kids);
    const ordered = [kids.find(c => c.id === keep)!, ...kids.filter(c => c.id !== keep)];
    // The strongest reason among the group's pairs reads first.
    const reason = [...es].sort((x, y) => REASON_RANK.indexOf(x.reason) - REASON_RANK.indexOf(y.reason))[0].reason;
    let blockedBy: string | null = null;
    for (let i = 0; i < kids.length && !blockedBy; i++) {
      for (let j = i + 1; j < kids.length && !blockedBy; j++) blockedBy = sharedTeamSeason(kids[i], kids[j]);
    }
    return {
      id: [...ids].sort().join('|'), sides: ordered.map(side), reason, keep, blockedBy,
      seasonCount: kids.reduce((n, c) => n + c.seasonCount, 0),
    };
  };

  const out: ChildProposal[] = [];
  for (const g of groups.values()) {
    const ids = [...g.ids];
    const holdsRejected = ids.some((x, i) => ids.slice(i + 1).some(y => input.rejected.has(pairKey(x, y))));
    // A record with no birth date can bridge two that disagree (A~B and B~C, but A and C are different dates): never one card.
    const holdsConflict = new Set(ids.map(id => byId.get(id)!.birthDate).filter(Boolean)).size > 1;
    if (ids.length > 2 && (holdsRejected || holdsConflict)) {
      for (const e of g.edges) out.push(proposal([e.a, e.b], [e]));
    } else {
      out.push(proposal(ids, g.edges));
    }
  }
  // Same parent first (the surest), then by surname and name, then the id.
  return out.sort((x, y) => REASON_RANK.indexOf(x.reason) - REASON_RANK.indexOf(y.reason)
    || norm(x.sides[0].name).localeCompare(norm(y.sides[0].name))
    || x.id.localeCompare(y.id));
}

/** Is this set of children EXACTLY one proposal standing NOW — the whole card and nothing else? Never a subset. */
export function childProposalHolding(proposals: readonly ChildProposal[], ids: readonly string[]): ChildProposal | null {
  if (ids.length < 2 || new Set(ids).size !== ids.length) return null;
  return proposals.find(p => p.sides.length === ids.length && ids.every(id => p.sides.some(s => s.childId === id))) ?? null;
}
