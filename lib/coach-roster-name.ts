// Shared display-name helpers for rep-team roster players. Extracted so the Schedule and the
// standalone Lineups builder render identical names without duplicating the logic.
import type { RepRosterPlayer } from '@/lib/types';

/**
 * Split one typed name into a first name and everything else: "Maria de la Cruz" → Maria + de la
 * Cruz, "Sarah Van Der Berg" → Sarah + Van Der Berg. A single word is a first name with no last.
 *
 * ⚠⚠ THE REPO CONTAINS BOTH CONVENTIONS, WHICH IS EXACTLY WHY THIS ONE NEEDS A NAME. The opposite
 * rule — last token is the surname, everything before it is the given name — lives in
 * `splitSingleName` (lib/basic-coach-roster.ts) as a legacy back-compat path, and it mis-splits
 * every multi-word surname. Reach for the wrong one and nothing fails: a family just quietly gets
 * filed under the wrong half of their name. Call this one for anything a person types today.
 *
 * Deliberately does NOT cap length — callers writing to a column apply their own limits, which
 * differ per table.
 */
export function splitTypedName(name: string): { first: string; last: string } {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

// Defensive: a bad import / seed can leave a name part as the literal string "null"/"undefined"
// (truthy, so a plain filter(Boolean) keeps it) — treat those as blank.
export function cleanNamePart(part: string | null | undefined): string {
  const s = (part ?? '').trim();
  return s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' ? '' : s;
}

/** The three fields a name actually needs. Typed structurally so a surface that fetched only an
 *  identity projection — the practice-plan builder deliberately never loads guardian PII — can
 *  still render the same name as a surface holding the whole roster row. `RepRosterPlayer`
 *  satisfies this, so every existing caller is unaffected. */
export type NamedRosterPlayer = Pick<RepRosterPlayer, 'playerFirstName' | 'playerLastName' | 'playerNumber'>;

export function playerName(player: Pick<NamedRosterPlayer, 'playerFirstName' | 'playerLastName'>): string {
  return [cleanNamePart(player.playerFirstName), cleanNamePart(player.playerLastName)].filter(Boolean).join(' ');
}

/**
 * A `tel:` href from a phone number as a coach typed it ("(905) 555-0142" → "tel:9055550142").
 * ⚠ ONE STRIPPING RULE (roster + player page review /simplify, 2026-09-13): it was written inline
 * in four places and NOT at all in a fifth — the roster's desktop Family cell — so one phone number
 * produced two different hrefs on one row.
 */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function playerDisplayName(player: NamedRosterPlayer): string {
  return [player.playerNumber ? `#${player.playerNumber}` : '', playerName(player)].filter(Boolean).join(' ');
}

/**
 * Is this a CALL-UP — a player borrowed for one game rather than on the roster (mig 309)?
 *
 * ⚠ ONE PREDICATE, because the mark has to appear on **every** row a call-up touches: the batting
 * order, the phone's inning list, the row-actions sheet, the bench console, the printed lineup card
 * and the game sheet. A coach must never have to work out whether the ninth name is one of their
 * own players, and a bare `=== 'callup'` written out at each of those sites is a mark that goes
 * missing from whichever one is added next.
 *
 * Structurally typed for the same reason as `NamedRosterPlayer`: a surface holding only an identity
 * projection can still ask the question.
 */
export function isCallUp(player: { status?: string | null } | null | undefined): boolean {
  return player?.status === 'callup';
}

/** What the mark says, everywhere it appears. One spelling, settled by owner ruling R1 (2026-09-22). */
export const CALL_UP_LABEL = 'Call-up';
