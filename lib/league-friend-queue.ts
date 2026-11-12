import { possessive } from './utils';
import { showFriendCode } from './league-friend-code';
import type { LeagueRegistration } from './types';

/**
 * THE REGISTRAR'S FRIEND REQUESTS (Board Ready Stage 1 Part 2; drawings BOARD_READY_FRIEND_REQUESTS_DRAWINGS.html tab 4
 * and the export half of tab 7, every ask ruled as recommended, owner 2026-11-10; plan BOARD_READY_PLAN.md §5 Stage 1).
 *
 * Pure and client-safe: the Registrations screen, its exports and the tests read the same answer.
 *
 *   · A NAME MATCH IS A SUGGESTION. Matching runs on read, against this season's live sign-ups (never a declined or
 *     withdrawn one). Names are compared ignoring capitals, accents, hyphens, apostrophes and spaces (José = Jose,
 *     O'Brien = OBrien, Mary-Jane = Mary Jane); a first name that starts the other ("Jon", "Jonathan") is similar. Same
 *     division ranks first; the typed parent's name ranks the rest and is said as the reason. Nothing confirms itself.
 *     ⚠ `normName` in lib/continuity-match.ts is NOT this: continuity and duplicates depend on it as it is.
 *   · A CODE IS EXACT. It resolved when the family saved (mig 461): the same division arrived Confirmed, another division
 *     waits marked Different division.
 *   · BOTH ASKED: each family typed the other child. The pair is ONE row and ONE Confirm (A13's drawn-in proposal).
 *     A code covers the other direction too: a typed request whose friend already holds a confirmed request back to
 *     this child (by code or by the registrar) reads Confirmed.
 *   · Requests of a child whose sign-up ended (declined, withdrawn) are not in the queue: that child is not drafted.
 *   · Only the seats that read Registrations ever get these rows (A11). Typed names are used only to place a child on
 *     a team (/legal): nothing here feeds a family, people or prospect list.
 */

// ── The rows as the server reads them ───────────────────────────────────────────────────────────────

export type FriendState = 'to_confirm' | 'confirmed' | 'not_signed_up' | 'cant_honour';
export type CantHonourReason = 'different_division' | 'other';

export interface FriendRequest {
  id: string;
  registrationId: string;
  slot: number;
  typedFirst: string | null;
  typedLast: string | null;
  typedParent: string | null;
  /** The code the family entered, as stored (no space). */
  code: string | null;
  state: FriendState;
  /** Stored on a code that matched a child in another division. */
  mark: 'different_division' | null;
  matchedRegistrationId: string | null;
  reason: CantHonourReason | null;
  note: string | null;
  /** The person who decided it, by name (null when nobody did: a code match, or a person since removed). */
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

/** What the GET returns. `on` is false when the plan has no friend requests or the season asks for none. */
export interface FriendsRead { on: boolean; requests: FriendRequest[] }

// ── The normaliser ──────────────────────────────────────────────────────────────────────────────────

/** A name folded for comparing: no accents, capitals, apostrophes, hyphens, dots or spaces. */
export function friendFold(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`´.\-‐‑–—\s]+/g, '')
    .trim();
}

type Part = 'same' | 'similar' | null;

/** One name part against another: equal, one starting the other (at least 2 letters), or no match. */
function partMatch(typed: string, actual: string): Part {
  const t = friendFold(typed), a = friendFold(actual);
  if (!t || !a) return null;
  if (t === a) return 'same';
  if ((t.length >= 2 && a.startsWith(t)) || (a.length >= 2 && t.startsWith(a))) return 'similar';
  // A last name typed as an initial ("Ruby T").
  if (t.length === 1 && a.startsWith(t)) return 'similar';
  return null;
}

/** Does the typed parent's name fit this sign-up's guardian (the whole name, the first or the last)? */
function parentMatches(typed: string | null, r: Pick<LeagueRegistration, 'guardianFirstName' | 'guardianLastName'>): boolean {
  const t = friendFold(typed);
  if (!t) return false;
  const first = friendFold(r.guardianFirstName), last = friendFold(r.guardianLastName);
  return t === first + last || t === first || t === last;
}

// ── Matching one request ────────────────────────────────────────────────────────────────────────────

export interface Candidate {
  reg: LeagueRegistration;
  first: Part;
  last: Part;
  parent: boolean;
  sameDivision: boolean;
  score: number;
}

const live = (r: Pick<LeagueRegistration, 'status'>) => r.status !== 'declined' && r.status !== 'withdrawn';

/**
 * Every live sign-up this typed request could mean, best first: same division first, then the names, then the parent.
 * A first name alone matches by first name; a last name alone by an equal last name; both need both.
 */
export function candidatesFor(
  req: Pick<FriendRequest, 'typedFirst' | 'typedLast' | 'typedParent' | 'registrationId'>,
  asker: Pick<LeagueRegistration, 'divisionId'> | null,
  regs: readonly LeagueRegistration[],
): Candidate[] {
  const out: Candidate[] = [];
  for (const r of regs) {
    if (r.id === req.registrationId || !live(r)) continue;
    const first = req.typedFirst ? partMatch(req.typedFirst, r.playerFirstName) : null;
    const last = req.typedLast ? partMatch(req.typedLast, r.playerLastName) : null;
    if (req.typedFirst && req.typedLast) { if (!first || !last) continue; }
    else if (req.typedFirst) { if (!first) continue; }
    else if (last !== 'same') continue;
    const parent = parentMatches(req.typedParent, r);
    const sameDivision = !!asker?.divisionId && r.divisionId === asker.divisionId;
    const score = (sameDivision ? 100 : 0) + (first === 'same' ? 4 : first === 'similar' ? 2 : 0)
      + (last === 'same' ? 4 : last === 'similar' ? 1 : 0) + (parent ? 3 : 0);
    out.push({ reg: r, first, last, parent, sameDivision, score });
  }
  return out.sort((a, b) => b.score - a.score || Date.parse(a.reg.registeredAt) - Date.parse(b.reg.registeredAt));
}

/** Why a candidate was suggested, in words: "Same name · parent matches", "Similar first name · same last name". */
export function reasonOf(c: Pick<Candidate, 'first' | 'last' | 'parent'>): string {
  const W = FRIEND_QUEUE_WORDS.why;
  const names = c.first === 'same' && c.last === 'same' ? W.sameName
    : c.first && c.last ? [c.first === 'same' ? W.firstSame : W.firstSimilar, c.last === 'same' ? W.lastSame : W.lastSimilar].join(' · ')
      : c.first ? (c.first === 'same' ? W.firstMatches : W.firstIsSimilar)
        : W.lastSameLead;
  return c.parent ? `${names} · ${W.parentMatches}` : names;
}

/**
 * The row's ONE action (drawing tab 4): Confirm for a single best match in the same division, Pick one… where several
 * fit or only a first name was typed, Can't honour where the only match is in another division, Not signed up where
 * nobody fits. A single best match needs a last name that matches and a lead over the next.
 */
export type QueueAction = 'confirm' | 'pick' | 'cantHonour' | 'notSignedUp';

// ── The queue ───────────────────────────────────────────────────────────────────────────────────────

export type Band = 'toConfirm' | 'confirmed' | 'closed';
export const BANDS: readonly Band[] = ['toConfirm', 'confirmed', 'closed'];

export type QueueMark = 'code' | 'bothAsked' | 'differentDivision' | 'noMatch';

export interface QueueRow {
  /** The row's key: the request's id, or both ids joined for a pair. */
  key: string;
  band: Band;
  /** One request, or the pair (A's then B's) when both families asked. */
  requests: FriendRequest[];
  asker: LeagueRegistration;
  /** The pair's other child (Both asked). */
  partner: LeagueRegistration | null;
  /** The match shown (the stored one when decided or by code, else the best suggestion). */
  match: LeagueRegistration | null;
  /** Every suggestion, best first (typed requests only). */
  candidates: Candidate[];
  marks: Set<QueueMark>;
  action: QueueAction | null;
  /** Confirmed because the friend's own confirmed request covers this one (not stored). */
  covered: boolean;
  /** The best match a "Confirm best match" press would send, when there is exactly one. */
  best: { id: string; matchId: string }[] | null;
}

const isCode = (q: FriendRequest) => !!q.code;
/** A name that is surely this child: the last name matches (with a first name), or only a first name was typed and it is the same. */
const strong = (c: Candidate) => (c.last === 'same' && !!c.first) || (c.last == null && c.first === 'same');

/**
 * Every request of the season as the registrar's queue reads it. `regs` is the season's whole registration list (the
 * screen already holds it). Ordered within a band as the drawing draws them: the pairs, then Confirm, Pick one…,
 * Can't honour, Not signed up; Confirmed and Closed newest decision first.
 */
export function buildQueue(requests: readonly FriendRequest[], regs: readonly LeagueRegistration[]): QueueRow[] {
  const byId = new Map(regs.map(r => [r.id, r]));
  const open = requests.filter(q => { const a = byId.get(q.registrationId); return !!a && live(a); });
  // The confirmed links, both ways looked up by (asker → friend).
  const confirmedTo = new Set(open.filter(q => q.state === 'confirmed' && q.matchedRegistrationId).map(q => `${q.registrationId}>${q.matchedRegistrationId}`));

  type Draft = { q: FriendRequest; asker: LeagueRegistration; candidates: Candidate[]; top: LeagueRegistration | null };
  const drafts: Draft[] = open.map(q => {
    const asker = byId.get(q.registrationId)!;
    const candidates = isCode(q) ? [] : candidatesFor(q, asker, regs);
    const stored = q.matchedRegistrationId ? byId.get(q.matchedRegistrationId) ?? null : null;
    // A code's match stands only while that sign-up is live; a confirmed request keeps showing who it named.
    const storedLive = stored && (q.state !== 'to_confirm' || live(stored)) ? stored : null;
    // The pair test needs a CONFIDENT pointer (/review 2026-11-11): a code, or a same-division match whose last name
    // matches — never a first name alone, which can mean two children.
    const lead = candidates.find(c => c.sameDivision);
    const top = q.state === 'to_confirm' && !isCode(q) ? (lead && lead.last === 'same' && lead.first ? lead.reg : null) : storedLive;
    return { q, asker, candidates, top };
  });

  const rows: QueueRow[] = [];
  const used = new Set<string>();

  // Both asked: two requests of the same band, each pointing at the other's child.
  const bandOf = (q: FriendRequest): Band => (q.state === 'to_confirm' ? 'toConfirm' : q.state === 'confirmed' ? 'confirmed' : 'closed');
  for (const a of drafts) {
    if (used.has(a.q.id) || !a.top || bandOf(a.q) === 'closed') continue;
    // Only children of one division can be kept together (A2): a pair across divisions is two Can't honour rows.
    if (!a.asker.divisionId || a.top.divisionId !== a.asker.divisionId) continue;
    const b = drafts.find(d => !used.has(d.q.id) && d.q.id !== a.q.id && d.asker.id === a.top!.id && d.top?.id === a.asker.id && bandOf(d.q) === bandOf(a.q));
    if (!b) continue;
    used.add(a.q.id); used.add(b.q.id);
    const band = bandOf(a.q);
    const marks = new Set<QueueMark>(['bothAsked']);
    if (isCode(a.q) || isCode(b.q)) marks.add('code');
    rows.push({
      key: `${a.q.id}+${b.q.id}`, band, requests: [a.q, b.q], asker: a.asker, partner: b.asker, match: a.top,
      candidates: a.candidates, marks, action: band === 'toConfirm' ? 'confirm' : null, covered: false,
      best: band === 'toConfirm' ? [{ id: a.q.id, matchId: b.asker.id }, { id: b.q.id, matchId: a.asker.id }] : null,
    });
  }

  for (const d of drafts) {
    if (used.has(d.q.id)) continue;
    const { q, asker, candidates } = d;
    const marks = new Set<QueueMark>();
    let band = bandOf(q);
    let action: QueueAction | null = null;
    let match: LeagueRegistration | null = d.top;
    let covered = false;
    let best: QueueRow['best'] = null;
    if (isCode(q)) marks.add('code');
    if (band === 'toConfirm') {
      const same = candidates.filter(c => c.sameDivision);
      if (isCode(q)) {
        if (!q.matchedRegistrationId || !match) { marks.add('noMatch'); action = 'notSignedUp'; match = null; }
        else if (!asker.divisionId) action = 'pick'; // the asking child has no division yet: nothing can be confirmed
        else if (q.mark === 'different_division' || match.divisionId !== asker.divisionId) { marks.add('differentDivision'); action = 'cantHonour'; }
        else { action = 'confirm'; best = [{ id: q.id, matchId: match.id }]; }
      } else if (same.length > 0) {
        const lead = same[0];
        // Covered by the friend's own confirmed request back (a code covers the other direction too): a candidate whose
        // last name matches, holding a confirmed request to this child.
        const back = same.find(c => c.last === 'same' && !!c.first && confirmedTo.has(`${c.reg.id}>${asker.id}`));
        if (back) {
          band = 'confirmed'; covered = true; marks.add('bothAsked'); match = back.reg;
        } else {
          const single = lead.last === 'same' && !!lead.first && (same.length === 1 || lead.score > same[1].score);
          action = single ? 'confirm' : 'pick';
          if (single) best = [{ id: q.id, matchId: lead.reg.id }];
          match = single ? lead.reg : null;
        }
      } else if (candidates.some(strong)) {
        // Another division, only on a name that is surely them; a loose first name elsewhere is nobody (/review).
        marks.add('differentDivision'); action = 'cantHonour'; match = candidates.find(strong)!.reg;
      } else {
        marks.add('noMatch'); action = 'notSignedUp'; match = null;
      }
    } else if (band === 'confirmed' && match && confirmedTo.has(`${match.id}>${asker.id}`)) {
      marks.add('bothAsked');
    }
    rows.push({ key: q.id, band, requests: [q], asker, partner: null, match, candidates, marks, action, covered, best });
  }

  const ORDER: Record<string, number> = { pair: 0, confirm: 1, pick: 2, cantHonour: 3, notSignedUp: 4 };
  const rank = (r: QueueRow) => (r.partner ? ORDER.pair : ORDER[r.action ?? 'confirm']);
  const decided = (r: QueueRow) => Date.parse(r.requests[0].decidedAt ?? r.requests[0].createdAt);
  const made = (r: QueueRow) => Date.parse(r.requests[0].createdAt);
  return rows.sort((a, b) => BANDS.indexOf(a.band) - BANDS.indexOf(b.band)
    || (a.band === 'toConfirm' ? rank(a) - rank(b) || made(a) - made(b) : decided(b) - decided(a)));
}

/** Each request of the queue on its own: who asked, whom it names, and whether it reads Confirmed (a covered one too). */
export function requestLines(rows: readonly QueueRow[]): { q: FriendRequest; row: QueueRow; asker: LeagueRegistration; match: LeagueRegistration | null; confirmed: boolean }[] {
  return rows.flatMap(row => row.requests.map((q, i) => ({
    q, row,
    asker: i === 0 ? row.asker : row.partner!,
    match: i === 0 ? row.match : row.asker,
    confirmed: q.state === 'confirmed' || (i === 0 && row.covered),
  })));
}

/** The amber count: the rows still to confirm. */
export const toConfirmCount = (rows: readonly QueueRow[]) => rows.filter(r => r.band === 'toConfirm').length;

// ── The registrations list's two friend columns and its Flags filter (tab 7) ───────────────────────────

/**
 * Per asking child: how many friends the family named, and how many of the confirmed ones are on the same team now
 * (A3: read from the teams as they stand). `honoured` is null until the child is on a team.
 */
export function friendTallies(requests: readonly FriendRequest[], regs: readonly LeagueRegistration[], rows: readonly QueueRow[] = buildQueue(requests, regs)): Map<string, { asked: number; honoured: number | null }> {
  const byId = new Map(regs.map(r => [r.id, r]));
  const out = new Map<string, { asked: number; honoured: number | null }>();
  for (const q of requests) {
    const asker = byId.get(q.registrationId);
    if (!asker) continue;
    const t = out.get(asker.id) ?? { asked: 0, honoured: asker.teamId ? 0 : null };
    t.asked += 1;
    out.set(asker.id, t);
  }
  // Honoured: a request the queue reads Confirmed (stored, or covered by the friend's own), both on one team now.
  for (const line of requestLines(rows)) {
    const t = out.get(line.asker.id);
    if (t?.honoured == null || !line.confirmed || !line.match?.teamId || line.match.teamId !== line.asker.teamId) continue;
    t.honoured += 1;
  }
  return out;
}

/** "1 of 2" — blank until the child is on a team, or when the family named nobody. */
export function honouredText(t: { asked: number; honoured: number | null } | undefined): string {
  return t && t.honoured != null ? `${t.honoured} of ${t.asked}` : '';
}

// ── Words ───────────────────────────────────────────────────────────────────────────────────────────

/** What the family typed, quoted: "“Liam Chen”" — or the code, "Code R2X 8HN". */
export function askedText(q: FriendRequest): string {
  if (q.code) return FRIEND_QUEUE_WORDS.codeLine(showFriendCode(q.code));
  return `“${[q.typedFirst, q.typedLast].filter(Boolean).join(' ')}”`;
}

/** What the family asked, inside a sentence: "“Liam Chen”" — or "friend code R2X 8HN". */
export function askedPhrase(q: FriendRequest): string {
  return q.code ? `friend code ${showFriendCode(q.code)}` : askedText(q);
}

/** The asked cell's sub-line: "parent “Grace Chen”", "no last name · parent “Ryan”", "no parent named". */
export function askedSub(q: FriendRequest): string | null {
  const W = FRIEND_QUEUE_WORDS;
  if (q.code) return null;
  const bits: string[] = [];
  if (!q.typedLast) bits.push(W.noLast);
  if (!q.typedFirst) bits.push(W.noFirst);
  bits.push(q.typedParent ? W.parentTyped(q.typedParent) : W.noParent);
  return bits.join(' · ');
}

export const FRIEND_QUEUE_WORDS = {
  view: 'Friend requests',
  viewAria: (n: number) => `${n} friend ${n === 1 ? 'request' : 'requests'} to confirm`,
  band: { toConfirm: 'To confirm', confirmed: 'Confirmed', closed: 'Closed' } as Record<Band, string>,
  col: { player: 'Player', asked: 'Asked to play with', match: 'Best match this season', actions: 'Actions' },
  search: 'Search players or friends',
  scopeElsewhere: 'Friend requests to confirm in another division',
  askedFor: (asked: string) => `Asked for ${asked}`,
  filterTitle: 'Show only',
  mark: { code: 'Code match', bothAsked: 'Both asked', differentDivision: 'Different division', noMatch: 'No match found' } as Record<QueueMark, string>,
  act: { confirm: 'Confirm', pick: 'Pick one…', cantHonour: 'Can’t honour', notSignedUp: 'Not signed up' } as Record<QueueAction, string>,
  stateWord: { confirmed: 'Confirmed', closed: 'Closed' },
  signedUp: (division: string | null, day: string) => [division, `signed up ${day}`].filter(Boolean).join(' · '),
  pairName: (a: string, b: string) => `${a} ⇄ ${b}`,
  // Just the division, like every other row: the Both asked chip (and the ⇄) already say both families asked.
  pairSub: (division: string | null) => division ?? '',
  pairAsked: (a: string) => `and ${a}`,
  codeLine: (code: string) => `Code ${code}`,
  noLast: 'no last name',
  noFirst: 'no first name',
  noParent: 'no parent named',
  parentTyped: (p: string) => `parent “${p}”`,
  matchLine: (name: string, division: string | null) => (division ? `${name} · ${division}` : name),
  possible: (n: number) => `${n} possible matches`,
  noOne: 'No one by that name has signed up',
  checkedAll: 'Checked every division',
  noCodeMatch: 'No sign-up has that code',
  otherMatches: (n: number) => (n === 1 ? '1 other match' : `${n} other matches`),
  confirmedWhenEntered: 'Confirmed when entered',
  confirmedBy: (who: string | null, day: string) => (who ? `Confirmed by ${who}, ${day}` : `Confirmed ${day}`),
  coveredLine: (first: string) => `${possessive(first)} family entered this child’s friend code`,
  markedBy: (who: string | null, day: string) => (who ? `Marked by ${who}, ${day}` : `Marked ${day}`),
  notSignedUpWord: 'Not signed up',
  cantHonourWord: (reason: CantHonourReason | null, note: string | null) =>
    (reason === 'different_division' ? 'Can’t honour · Different division' : note ? `Can’t honour · ${note}` : 'Can’t honour'),
  withdrew: (first: string, day: string) => `${first} withdrew ${day}`,
  why: {
    sameName: 'Same name', firstSame: 'Same first name', firstSimilar: 'Similar first name', lastSame: 'same last name',
    lastSimilar: 'similar last name', lastSameLead: 'Same last name', firstMatches: 'First name matches', firstIsSimilar: 'First name is similar',
    parentMatches: 'parent matches',
  },
  bothWhy: (names: string, parentOf: string | null) => (parentOf ? `${names} · ${possessive(parentOf)} parent matches` : names),
  sameNames: 'Same names',
  more: (n: number) => `… ${n} more`,
  foot: 'Each request is what a parent typed. Nothing is kept together in the draft until you confirm it. Code matches arrive confirmed. FieldLogicHQ deletes friend requests after the season; a file you export is yours to keep private and to delete.',
  empty: { title: 'No friend requests yet', body: 'They appear here as families sign up and name friends.' },
  emptySearch: 'No friend requests match that search.',
  emptyFilter: 'No friend requests match the filter.',
  emptyDivision: 'No friend requests in this division.',
  menu: {
    pickAnother: 'Pick another…',
    notSignedUp: 'Not signed up',
    cantHonour: 'Can’t honour…',
    reopen: 'Move back to To confirm',
    open: (first: string) => `Open ${possessive(first)} registration`,
    delete: 'Delete request…',
    deleteOf: (first: string) => `Delete ${possessive(first)} request…`,
  },
  moreFor: (name: string) => `More for ${possessive(name)} friend request`,
  selectRow: (name: string) => `Select ${possessive(name)} friend request`,
  selectAll: 'Select every friend request shown',
  bulk: {
    confirmBest: 'Confirm best match',
    done: (n: number) => (n === 1 ? '1 friend request confirmed.' : `${n} friend requests confirmed.`),
    skipped: (n: number) => (n === 1 ? '1 had no single best match and was left in To confirm.' : `${n} had no single best match and were left in To confirm.`),
  },
  done: {
    confirmed: (a: string, b: string) => `${a} and ${b} are confirmed. The draft keeps them together when the group has room.`,
    notSignedUp: 'Marked Not signed up.',
    cantHonour: 'Marked Can’t honour.',
    reopened: 'Moved back to To confirm.',
    deleted: 'Friend request deleted.',
  },
  failed: 'That didn’t go through. Please try again.',
  // The request window (Pick one…, Pick another…, or the row)
  win: {
    eyebrow: (division: string | null) => (division ? `Friend request · ${division}` : 'Friend request'),
    title: (asker: string, asked: string) => `${asker} asked to play with ${asked}`,
    parentGiven: (p: string) => `Parent’s name given: “${p}”.`,
    signedUpBy: (day: string, guardian: string) => `Signed up ${day} by ${guardian}.`,
    lead: 'Who did they mean?',
    parentOf: (name: string) => `Parent ${name}`,
    otherDivision: 'Different division · can’t be kept together',
    none: 'No sign-up this season matches this request.',
    searchLabel: 'Someone else? Search this division’s sign-ups',
    searchNone: 'No sign-up in this division by that name.',
    foot: (a: string, b: string) => `Confirming keeps ${a} and ${b} together in the draft when the group has room.`,
    footNone: 'Pick who they meant to confirm.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    working: 'Confirming…',
  },
  cant: {
    title: (first: string) => `Can’t honour ${possessive(first)} request?`,
    sub: (asker: string, asked: string) => `${asker} asked for ${asked}.`,
    why: 'Why',
    reasons: { different_division: 'Different division', other: 'Other' } as Record<CantHonourReason, string>,
    note: 'Note',
    notePlaceholder: 'A few words for the record',
    noteNeeded: 'Add a short note.',
    hint: 'Only people who can open Registrations see this. The family is not told.',
    cancel: 'Cancel',
    go: 'Can’t honour',
    working: 'Saving…',
  },
  del: {
    title: (first: string) => `Delete ${possessive(first)} friend request?`,
    body: (first: string, asked: string) => `This permanently removes ${possessive(first)} request for ${asked} and its match. It can’t be undone. If a family asks to have a child’s name removed, delete every request that names that child. The family is not told.`,
    cancel: 'Keep request',
    go: 'Delete request',
    working: 'Deleting…',
  },
  // The registrations list (tab 7)
  flag: 'Has a friend request',
  exportCols: { requests: 'Friend Requests', honoured: 'Friends Honoured' },
  /** The Friend requests view's own file (tab 7): children's names only, never a parent's name or a contact. */
  fileCols: {
    player: 'Player', division: 'Division', team: 'Team', asked: 'Asked To Play With', code: 'Code', matched: 'Matched To',
    mark: 'Mark', state: 'State', inDraft: 'In The Draft', reason: 'Reason', decidedBy: 'Decided By',
  },
  fileState: { toConfirm: 'To confirm', confirmed: 'Confirmed', not_signed_up: 'Not signed up', cant_honour: 'Can’t honour' },
  honoured: 'Honoured',
  notHonoured: 'Not honoured',
} as const;
