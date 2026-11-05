/**
 * "BRING BACK A PAST PLAYER" AND "SAME CHILD?" — the words and the one match rule (Club Tier Stage 14 S3, 14b screens;
 * owner rulings 2026-11-04, Asks 4, 5, 9, 12; the drawings' tabs 3, 4 and 8, version 2). Client-safe: the picker, the
 * Add Player question, the paste-a-list check and the tryout accept window all read this, and so do the server routes
 * that re-check what the window asked.
 *
 * ⚖ ONE CHILD, NEVER INFERRED (Ask 4). A match here is always a QUESTION — never a join. Two entries become one child
 * only by a fact (the roll, the picker) or a person's yes ("Same child?"). The question needs the SAME FIRST AND LAST
 * NAME (the continuity matcher's normalising), against THIS team's earlier seasons (Ask 5) — a birth date or a family
 * email never answers it, and twins (two first names) are never asked about. A "no" is stored
 * (`child_match_rejections`, mig 438) and never asked again.
 */
import { normName } from './continuity-match';
import { playerName } from './coach-roster-name';
import { bornFitsDate, bornLine, type BornYears, type Cutoff } from './born-years';
import { formatStoredDate } from './timezone';
import { fmt } from './coach-money-summary';
import { theSeason } from './season-roll-path';
import { pluralize, possessive } from './utils';

/** One past player as the picker lists them: the child, and their LATEST entry on this team. */
export interface PastPlayer {
  childId: string;
  /** The latest entry on this team (the one the picker copies, and the history link's prior side). */
  entryId: string;
  firstName: string;
  lastName: string | null;
  number: string | null;
  /** That entry's status. A call-up appears only when they once played for THIS team. */
  status: 'active' | 'inactive' | 'callup';
  season: { id: string; name: string; year: number };
  /** Games called up, for a call-up's row ("Called up for 3 games in the 2026 Season"). */
  callUpGames: number | null;
  /** ⚠ Null for staff without the roster-details grant (`rosterPii`), as on the roster. */
  dateOfBirth: string | null;
  /** The family on that entry, by name. Null when none on file, or without the grant. */
  family: string | null;
  /** That season's dues, read from that season's book (never recomputed). Null without the grant or money access. */
  dues: { kind: 'settled' | 'owing'; amount: number } | null;
  /** Ask 12: "Born 2014. The team is 2015–2016." when the birth date sits outside the working season's birth years
   *  (warn, never block). Null when it fits, when there is nothing to check, or without the grant. */
  bornWarning: string | null;
}

/** The working season the picker and the questions add to. */
export interface WorkingSeason { id: string; name: string; year: number }

export function pastPlayerName(p: Pick<PastPlayer, 'firstName' | 'lastName'>): string {
  return playerName({ playerFirstName: p.firstName, playerLastName: p.lastName });
}

// ── The match rule ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The past players a typed name may be — SAME first and last name, both present; newest season first. `answered` holds
 * the children the coach has already said "no" to in this window (the stored "no"s are left out by the server).
 */
export function sameNameCandidates<T extends Pick<PastPlayer, 'childId' | 'firstName' | 'lastName' | 'season'>>(
  first: string | null | undefined,
  last: string | null | undefined,
  past: readonly T[],
  answered: ReadonlySet<string> = new Set(),
): T[] {
  return past
    .filter(p => !answered.has(p.childId) && sameName(first, last, p.firstName, p.lastName))
    .sort((a, b) => b.season.year - a.season.year);
}

/** The match rule itself: SAME first and last name once normalised, both present on both sides. */
export function sameName(
  aFirst: string | null | undefined, aLast: string | null | undefined,
  bFirst: string | null | undefined, bLast: string | null | undefined,
): boolean {
  const f = normName(aFirst), l = normName(aLast);
  return !!f && !!l && normName(bFirst) === f && normName(bLast) === l;
}

/** Ask 12 — the warning words, or null when the child fits (or there is nothing to check). Warn, never block. */
export function bornWarning(dob: string | null | undefined, years: BornYears, c: Cutoff): string | null {
  if (!dob || (years.from == null && years.to == null)) return null;
  if (bornFitsDate(years, c, dob)) return null;
  const team = bornLine(years, c);
  if (!team) return null;
  return `Born ${dob.slice(0, 4)}. The team is ${team.replace(/^Born /, '')}.`;
}

// ── The picker (tab 3) ──────────────────────────────────────────────────────────────────────────────────────────────

export const PICKER_TITLE = 'Bring back a past player';
export const PICKER_DOOR = 'Played for this team before? Bring back a past player →';
export const PICKER_SEARCH = 'Search by name';
export function pickerHint(team: string, season: WorkingSeason): string {
  return `Players from ${possessive(team)} earlier seasons who aren’t on ${theSeason(season.name)} roster. They come back with their history. Their contact details come from their last season with the team.`;
}
export const pickerChosen = (n: number) => `${n} chosen`;
export const pickerListedNote = (season: WorkingSeason) => `Players already on the ${season.year} roster aren’t listed.`;
export const pickerFootLine = (season: WorkingSeason) => `They join ${theSeason(season.name)} as active players.`;
export const pickerSubmit = (n: number) => n === 0 ? 'Bring back players' : `Bring back ${pluralize(n, 'player')}`;
export const PICKER_EMPTY_NONE = 'No past players yet.';
export const pickerEmptyNoneHint = (team: string) => `Players from ${possessive(team)} earlier seasons appear here once a season has finished.`;
export const pickerEmptyAll = (team: string, season: WorkingSeason) => `Everyone who played for ${team} is on the ${season.year} roster.`;
export const PICKER_NO_MATCH = 'No past player has that name.';
export const PICKER_READ_FAILED = 'The past players could not be read. Close this and try again.';

/** The row's second line. Desk: season · number · born · family. Phone (`short`): season · number. */
export function pickerRowLine(p: PastPlayer, short = false): string {
  if (p.status === 'callup') {
    const games = p.callUpGames ?? 0;
    const head = short
      ? `${pluralize(games, 'game')} in ${theSeason(p.season.name)}`
      : `Called up for ${pluralize(games, 'game')} in ${theSeason(p.season.name)}`;
    return short ? head : [head, p.family ?? 'no family on file'].join(' · ');
  }
  const parts = [`Last played ${theSeason(p.season.name)}`];
  if (p.number) parts.push(`#${p.number}`);
  if (!short) {
    if (p.dateOfBirth) parts.push(`born ${formatStoredDate(p.dateOfBirth)}`);
    if (p.family) parts.push(p.family);
  }
  return parts.join(' · ');
}

/** The dues chip: "2026 dues settled" (good) · "$120.00 owing from 2025" (warn). */
export function duesChip(p: PastPlayer): { text: string; tone: 'good' | 'warn' } | null {
  if (!p.dues) return null;
  return p.dues.kind === 'owing'
    ? { text: `${fmt(p.dues.amount)} owing from ${p.season.year}`, tone: 'warn' }
    : { text: `${p.season.year} dues settled`, tone: 'good' };
}

/** The birth-year chip on the desk row ("Born 2014"); the phone shows `bornWarning`'s full line instead. */
export const bornChip = (dob: string) => `Born ${dob.slice(0, 4)}`;

// ── Refusals (tab 8) ────────────────────────────────────────────────────────────────────────────────────────────────

export const alreadyOnRoster = (name: string, season: WorkingSeason) => `${name} is already on the ${season.year} roster.`;
export const seasonClosedRefusal = (season: { name: string }) =>
  `${theSeason(season.name).replace(/^the /, 'The ')} is closed, so no one can be added. Reopen it from Settings first.`;
export const SEASON_CLOSED_GENERIC = 'This season is closed, so no one can be added. Reopen it from Settings first.';

// ── "Same child?" (tab 4) ───────────────────────────────────────────────────────────────────────────────────────────

/** The bold first line: "Jonah Ruiz played for the Hawks in the 2026 Season." */
export function sameChildHead(p: PastPlayer, team: string): string {
  return `${pastPlayerName(p)} played for ${team} in ${theSeason(p.season.name)}.`;
}
/** The detail line. Desk: "#9 · born Jan 14, 2015 · Marisol Ruiz. Is this the same child?"; phone: "… Same child?". */
export function sameChildDetail(p: PastPlayer, short = false): string {
  const parts: string[] = [];
  if (p.number) parts.push(`#${p.number}`);
  if (p.dateOfBirth) parts.push(`born ${formatStoredDate(p.dateOfBirth)}`);
  if (!short && p.family) parts.push(p.family);
  const facts = parts.join(' · ');
  const ask = short ? 'Same child?' : 'Is this the same child?';
  return facts ? `${facts}. ${ask}` : ask;
}
export const sameChildYes = (p: PastPlayer) => `Yes, it’s ${p.firstName.trim()}`;
export const SAME_CHILD_YES_ACCEPT = 'Yes, same child';
export const SAME_CHILD_NO = 'No, a different child';
/** The foot's reason while the question is open. */
export const sameChildFoot = (p: PastPlayer) => `Is this ${pastPlayerName(p)} from ${theSeason(p.season.name)}? Answer above.`;
export const SAME_CHILD_FOOT_SHORT = 'Answer the question above first.';
/** After "Yes" on single add: the quiet line where the question was. */
export const sameChildChosen = (p: PastPlayer) => `Same child: ${pastPlayerName(p)} from ${theSeason(p.season.name)}. Their history comes with them.`;
export const SAME_CHILD_CHANGE = 'Change';

// Paste a list (tab 4, the check step)
export const pasteMatchLine = (p: PastPlayer, team: string) =>
  [`Played for ${team} in ${theSeason(p.season.name)}`, p.dateOfBirth ? `born ${formatStoredDate(p.dateOfBirth)}` : null]
    .filter(Boolean).join(' · ');
export const PASTE_SAME = 'Same child';
export const PASTE_NEW = 'New player';
export const pasteNeedsAnswer = (n: number) =>
  `${pluralize(n, 'player')} ${n === 1 ? 'needs' : 'need'} an answer: same child or new?`;

// Tryout accept (tab 4, and the 416 refusal)
export const acceptTitle = (name: string) => `Add ${name} to the roster?`;
export const ACCEPT_SUBMIT = 'Add to roster';
export const acceptRefusalTitle = (name: string, season: WorkingSeason) => `${name} is already on the ${season.year} roster`;
export const acceptRefusalBody = (first: string) => `Accepting would add ${first} twice. Open ${possessive(first)} roster entry instead.`;
export const acceptRefusalOpen = (first: string) => `Open ${possessive(first)} entry`;
/** Owner ruling 2026-11-04 (S3 Part 0): a same NAME on this season's roster that is not provably the same child keeps a
 *  quiet way through — the answer is stored as a "no". */
export const ACCEPT_DIFFERENT_ANYWAY = 'A different child — add anyway';

// Single add "Yes" raced by another door (tab 8)
export const yesAlreadyOnRoster = (name: string, first: string, season: WorkingSeason) =>
  `${name} is already on the ${season.year} roster. Open ${possessive(first)} entry instead.`;

// ── The returning caption on the roster (tab 3, "Back from the 2025 Season") ──────────────────────────────────────
export const backFromCaption = (seasonName: string) => `Back from ${theSeason(seasonName)}`;

/** A board confirm that would join two children BOTH on this season's roster (Ask 11's words; the index refuses it). */
export const joinSameSeasonRefusal = (team: string, seasonName: string) =>
  `Both are on the ${team} ${seasonName} roster. Remove the extra entry first, then join them.`;
