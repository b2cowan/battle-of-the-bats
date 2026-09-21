/**
 * lib/coach-opponent-picker.ts
 * The Opponent field's picker over the Scouting Book — pure logic, no I/O
 * (unit tests: tests/unit/coach-opponent-picker.test.ts).
 *
 * THE OPPONENT FIELD READS THE BOOK, AND IT IS NOT A TAG (owner, 2026-09-21; plan
 * COACH_OPPONENT_PICKER_PLAN.md). A game has ONE opponent and that opponent names a record with its
 * own page and its own merge tool, so the field takes the Place grammar (type to find, pick to fill,
 * type over to detach) over the team's book — never a label library.
 *
 * ⚠ CONSISTENCY IS A SPELLING, NOT A KEY (D2). Picking writes the book's DISPLAY spelling into the
 * game and nothing else: three things write an opponent's name and the coach types only one — the
 * league importer and the tournament organizer can only ever supply a name, and the book already
 * resolves a name (the normalizer + the coach's merges). There is no picked id anywhere in here: the
 * "picked" state is DERIVED from whether the field's current text resolves in the book, which is also
 * why typing over the name is the detach and why an edited old game whose name was merged away still
 * resolves — to the OWNING entry, with the whole record.
 */
import { normalizeOpponentName, recordChip, resultLetter, hasMeetings, hasBookContent } from './coach-opponents';
import type { OpponentBookEntry, OpponentMeeting } from './coach-opponents';

/** The slice of a book entry the picker reads (a subset of OpponentBookEntry). */
export type OpponentPickerEntry = Pick<
  OpponentBookEntry,
  'key' | 'displayName' | 'aliasKeys' | 'record' | 'lastMeeting' | 'meetings' | 'observationCount' | 'summary'
>;

/**
 * A spelling one of the club's OTHER teams has notes under (D5) — offered so a sharing team writes the
 * same spelling its siblings use, and the club layer lights up on the first meeting instead of after
 * a merge nobody knew to make. No club record, no link: just the words.
 */
export interface ClubPickerSpelling {
  /** normalized — the same key the club layer matches on */
  key: string;
  displayName: string;
  /** the sibling teams that hold notes under this spelling, by name */
  teamNames: string[];
  observationCount: number;
}

/** How many rows each group shows — the Location field's eight, and a shorter club tail. */
export const OPPONENT_PICKER_OWN_LIMIT = 8;
export const OPPONENT_PICKER_CLUB_LIMIT = 4;

/** Every spelling an entry answers to, normalized: its key, its merged-away names, its display name. */
function spellingsOf(e: OpponentPickerEntry): string[] {
  return [e.key, ...(e.aliasKeys ?? []), normalizeOpponentName(e.displayName)];
}

/** An empty query matches everything; otherwise substring on any normalized spelling. */
function matches(query: string, spellings: readonly string[]): boolean {
  const q = normalizeOpponentName(query);
  if (!q) return true;
  return spellings.some(s => s.includes(q));
}

function lastMetMs(e: OpponentPickerEntry): number | null {
  if (!e.lastMeeting) return null;
  const ms = Date.parse(e.lastMeeting.startsAt);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * The "Your opponents" group: entries the team has met (or written about), matching the query,
 * MOST RECENTLY MET FIRST — the coach is usually re-typing last month's opponent, not one from two
 * seasons ago. Entries with no meeting at all (a minted row with notes and no game) sort last; ties
 * by name so the order is stable across renders.
 */
export function filterOpponentEntries<T extends OpponentPickerEntry>(
  entries: readonly T[], query: string, limit = OPPONENT_PICKER_OWN_LIMIT,
): T[] {
  return entries
    .filter(e => (hasMeetings(e) || hasBookContent(e)) && matches(query, spellingsOf(e)))
    .sort((a, b) => {
      const am = lastMetMs(a), bm = lastMetMs(b);
      if (am !== bm) {
        if (am === null) return 1;
        if (bm === null) return -1;
        return bm - am;
      }
      return a.displayName.localeCompare(b.displayName);
    })
    .slice(0, limit);
}

/** The club group: sibling spellings matching the query, by name. */
export function filterClubSpellings(
  spellings: readonly ClubPickerSpelling[], query: string, limit = OPPONENT_PICKER_CLUB_LIMIT,
): ClubPickerSpelling[] {
  return spellings
    .filter(s => matches(query, [s.key, normalizeOpponentName(s.displayName)]))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, limit);
}

export interface ResolvedOpponent<T extends OpponentPickerEntry = OpponentPickerEntry> {
  entry: T;
  /** true = the text is a merged-away spelling of `entry`, not its own name */
  viaAlias: boolean;
}

/**
 * Does the field's text name an opponent the book knows? Directly (the text normalizes to an entry's
 * key) or through a merge (it normalizes to one of the entry's merged-away spellings). Null = a name
 * the book doesn't know yet — which saves as typed and gets its page after the game (D3).
 */
export function resolveOpponentText<T extends OpponentPickerEntry>(
  entries: readonly T[], text: string | null | undefined,
): ResolvedOpponent<T> | null {
  const k = normalizeOpponentName(text);
  if (!k) return null;
  const direct = entries.find(e => e.key === k);
  if (direct) return { entry: direct, viaAlias: false };
  const owner = entries.find(e => (e.aliasKeys ?? []).includes(k));
  return owner ? { entry: owner, viaAlias: true } : null;
}

/** The club spelling the text names, if any — consulted only after the team's own book. */
export function resolveClubSpelling(
  spellings: readonly ClubPickerSpelling[], text: string | null | undefined,
): ClubPickerSpelling | null {
  const k = normalizeOpponentName(text);
  if (!k) return null;
  return spellings.find(s => s.key === k) ?? null;
}

/** "Last met Jun 14 · W 5–3" — the row's sub-line, the book's own words. */
export function opponentMeetingLine(
  meeting: OpponentMeeting | null, formatDate: (iso: string) => string,
): string {
  if (!meeting) return 'No games yet';
  let line = `Last met ${formatDate(meeting.startsAt)}`;
  if (meeting.result) {
    line += ` · ${resultLetter(meeting.result)}`;
    if (meeting.teamScore != null && meeting.opponentScore != null) line += ` ${meeting.teamScore}–${meeting.opponentScore}`;
  }
  return line;
}

/**
 * The line under a resolved field: "2-1 vs them · last met Jun 14", or for a merged-away spelling
 * "Same team as Oakville Thunder · 2-2 vs them · last met Aug 9" — the game keeps the name the coach
 * gave it; the book reads it as the owner, so the record shown is the WHOLE record, never the fragment.
 */
export function opponentPickedLine(
  resolved: ResolvedOpponent, formatDate: (iso: string) => string,
): string {
  const { entry, viaAlias } = resolved;
  const r = entry.record;
  const played = r.wins + r.losses + r.ties;
  const parts: string[] = [];
  if (viaAlias) parts.push(`Same team as ${entry.displayName}`);
  if (played > 0) parts.push(`${recordChip(r)} vs them`);
  if (entry.lastMeeting) parts.push(`last met ${formatDate(entry.lastMeeting.startsAt)}`);
  else if (played === 0) parts.push('No games yet');
  if (played === 0 && entry.observationCount > 0) {
    parts.push(`${entry.observationCount} observation${entry.observationCount === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

/** The line under a club spelling the team itself has not met: who in the club holds the notes. */
export function clubPickedLine(spelling: ClubPickerSpelling): string {
  return `Your club has notes on them (${spelling.teamNames.join(', ')})`;
}
