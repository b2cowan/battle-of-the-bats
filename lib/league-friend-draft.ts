import { possessive } from './utils';
import { requestLines, type DraftOutcome, type FriendPlacement, type FriendRequest, type QueueRow } from './league-friend-queue';
import type { FriendLink, LinkOutcome } from './house-league-draft';
import type { LeagueRegistration } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * FRIEND REQUESTS IN THE DRAFT (Board Ready Stage 1 Part 3; drawings BOARD_READY_FRIEND_REQUESTS_DRAWINGS.html tabs 5,
 * 5b and 6, every ask ruled as recommended, owner 2026-11-10). Pure and client-safe: the draft route, the board, the
 * Friend requests view, the registration record and the export read the same answers.
 *
 *   · THE LINKS: every request the registrar's queue reads Confirmed (stored, or covered by the friend's own confirmed
 *     request back), between two live sign-ups of ONE division, is a keep-together link. A Both asked pair is one link.
 *   · THE RESULT IS LIVE (A3): Honoured / Not honoured is read from the teams as they stand, never frozen at the draft.
 *     The reason says why, from the request, the two children's placement and what the last draft did with it (mig 473).
 *     Nothing re-deals by itself.
 *   · Only the seats that read Registrations ever get these (A11). Typed names are used only to place a child on a team.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export interface DivisionLink extends FriendLink {
  /** Every request the link stands for (both directions of a pair): the draft writes its outcome to each. */
  requestIds: string[];
  keptApartBy: string | null;
  keptApartAt: string | null;
}

/** One division's friends as the board reads them (behind the registrations read, A11): ids only, never a typed name. */
export interface DivisionFriends {
  /** The confirmed keep-together links between the division's live sign-ups. */
  links: DivisionLink[];
  /** The division's requests still to confirm (the draft leaves them out; the window says so). */
  waiting: number;
  /** The division's children whose family named a friend (the board's "Has a friend request"). */
  asked: string[];
}

const live = (r: LeagueRegistration) => r.status !== 'declined' && r.status !== 'withdrawn';
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** The confirmed links between live sign-ups of one division, a pair's two requests as one link. */
export function divisionLinks(rows: readonly QueueRow[], divisionId: string): DivisionLink[] {
  const byPair = new Map<string, { lines: { q: FriendRequest; asker: string; both: boolean }[]; a: string; b: string }>();
  for (const line of requestLines(rows)) {
    if (!line.confirmed || !line.match) continue;
    const { asker, match } = line;
    if (asker.id === match.id || asker.divisionId !== divisionId || match.divisionId !== divisionId || !live(asker) || !live(match)) continue;
    const key = pairKey(asker.id, match.id);
    const entry = byPair.get(key) ?? { lines: [], a: asker.id < match.id ? asker.id : match.id, b: asker.id < match.id ? match.id : asker.id };
    entry.lines.push({ q: line.q, asker: asker.id, both: line.row.marks.has('bothAsked') });
    byPair.set(key, entry);
  }
  return [...byPair.values()].map(({ lines, a, b }) => {
    const ids = lines.map(l => l.q.id).sort();
    const apart = lines.find(l => l.q.keptApartAt);
    const when = lines.map(l => l.q.decidedAt ?? l.q.createdAt).sort()[0];
    return {
      id: ids.join('+'), a, b, requestIds: ids,
      bothAsked: new Set(lines.map(l => l.asker)).size === 2 || lines.some(l => l.both),
      code: lines.some(l => !!l.q.code),
      confirmedAt: when,
      apart: !!apart,
      keptApartBy: apart?.q.keptApartBy ?? null,
      keptApartAt: apart?.q.keptApartAt ?? null,
    };
  });
}

/** The outcomes a deal stores (mig 473): each link's requests get its outcome; off, every link not kept apart reads "off". */
export function outcomesToStore(links: readonly DivisionLink[], result: ReadonlyMap<string, LinkOutcome> | null): { ids: string[]; outcomes: DraftOutcome[] } {
  const ids: string[] = [];
  const outcomes: DraftOutcome[] = [];
  const stored: Record<LinkOutcome, DraftOutcome> = { kept: 'kept', overCap: 'over_cap', locked: 'locked', apart: 'apart' };
  for (const l of links) {
    const o = result ? (result.has(l.id) ? stored[result.get(l.id)!] : null) : (l.apart ? 'apart' : 'off');
    if (!o) continue;
    for (const id of l.requestIds) { ids.push(id); outcomes.push(o); }
  }
  return { ids, outcomes };
}

/** A division has drafted when the draft dealt any of its accepted players (draft_team_id; "Take all players off" clears it). */
export function divisionDrafted(divisionId: string | null, regs: readonly LeagueRegistration[], placement: FriendPlacement | undefined): boolean {
  if (!divisionId || !placement) return false;
  return regs.some(r => r.divisionId === divisionId && r.status === 'active' && !!placement[r.id]?.dealt);
}

// ── The live result (tab 6) ───────────────────────────────────────────────────────────────────────

export interface ResultLine {
  q: FriendRequest;
  row: QueueRow;
  asker: LeagueRegistration;
  match: LeagueRegistration | null;
  confirmed: boolean;
}

export interface FriendResult { honoured: boolean; why: string }

export interface ResultContext {
  placement: FriendPlacement;
  teamName: (id: string | null) => string | null;
  /** A stored date or time as the screen says a day ("May 3"). */
  day: (value: string | null) => string;
}

/**
 * Honoured or Not honoured, with the reason (tab 6's list, in the order the drawing gives it where two could apply).
 * Read only for a division that has drafted: before the draft a request reads its queue state instead.
 */
export function friendResult(line: ResultLine, ctx: ResultContext): FriendResult {
  const W = FRIEND_RESULT_WORDS;
  const { q, asker, match } = line;
  const no = (why: string): FriendResult => ({ honoured: false, why });
  if (line.confirmed && match && asker.teamId && match.teamId === asker.teamId) {
    return { honoured: true, why: W.bothOn(ctx.teamName(asker.teamId) ?? '') };
  }
  if (q.state === 'not_signed_up') return no(W.notSignedUp);
  if (q.state === 'cant_honour') return no(q.reason === 'different_division' ? W.differentDivision : W.cantHonour(q.note));
  // Still to confirm: "Not signed up" is the registrar's decision, never a guess from a missing match.
  if (!line.confirmed) return no(line.row.marks.has('differentDivision') ? W.differentDivision : W.notConfirmed);
  if (!match) return no(W.notConfirmed);
  if (!live(match)) return no(W.withdrew(match.playerFirstName, ctx.day(match.endedAt)));
  if (!live(asker)) return no(W.withdrew(asker.playerFirstName, ctx.day(asker.endedAt)));
  if (q.keptApartAt) return no(W.keptApart(q.keptApartBy ?? null, ctx.day(q.keptApartAt)));
  for (const r of [match, asker]) if (!r.teamId) return no(W.notOnTeam(r.playerFirstName));
  for (const r of [match, asker]) if (!ctx.placement[r.id]?.dealt) return no(W.notInDraft(r.playerFirstName));
  switch (q.draftOutcome ?? null) {
    case 'over_cap': return no(W.overCap);
    case 'locked': {
      const held = [match, asker].find(r => ctx.placement[r.id]?.locked) ?? match;
      return no(W.locked(held.playerFirstName, ctx.teamName(held.teamId) ?? ''));
    }
    case 'apart': return no(W.apartInDraft);
    case 'off': return no(W.switchOff);
    case 'kept': return no(W.movedByHand);
    default: return no(W.confirmedAfter);
  }
}

export const FRIEND_RESULT_WORDS = {
  bothOn: (team: string) => `Both on ${team}`,
  overCap: 'The group would pass 3 children',
  differentDivision: 'Different division',
  cantHonour: (note: string | null) => (note ? `Can’t honour · ${note}` : 'Can’t honour'),
  locked: (first: string, team: string) => `${first} is locked to ${team}`,
  withdrew: (first: string, day: string) => `${first} withdrew ${day}`,
  keptApart: (who: string | null, day: string) => (who ? `Kept apart by ${who}, ${day}` : `Kept apart ${day}`),
  movedByHand: 'Moved by hand after the draft',
  confirmedAfter: 'Confirmed after the draft',
  notSignedUp: 'Not signed up',
  notConfirmed: 'Not confirmed before the draft',
  // Not in tab 6's list (build decisions, owner may overrule): a child placed after the draft, a child taken off a team,
  // and a draft run with "Keep friends together" off.
  notInDraft: (first: string) => `${first} wasn’t in the draft`,
  notOnTeam: (first: string) => `${first} isn’t on a team`,
  switchOff: 'Drafted with Keep friends together off',
  // Kept apart at the draft, by this request's own split since undone, or another split in the group (/review 2026-11-12).
  apartInDraft: 'Kept apart in the draft',
  // The view's own words (tab 6)
  band: { notHonoured: 'Not honoured', honoured: 'Honoured' },
  col: { player: 'Player', asked: 'Asked to play with', matched: 'Matched to', inDraft: 'In the draft' },
  foot: (honoured: number, total: number) => `Read from the teams as they stand now. ${honoured} of ${total} honoured.`,
  // The registration record's section (tab 6, bottom)
  record: {
    title: 'Friend requests',
    askedFor: 'Asked for',
    askedForChild: (first: string) => `Asked for ${first}`,
    family: (name: string) => `${possessive(name)} family`,
    parent: (p: string) => `(parent “${p}”)`,
    open: 'Open in Friend requests',
    toConfirm: 'To confirm',
    confirmed: 'Confirmed',
  },
} as const;
