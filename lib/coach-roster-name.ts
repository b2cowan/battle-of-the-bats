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

export function playerDisplayName(player: NamedRosterPlayer): string {
  return [player.playerNumber ? `#${player.playerNumber}` : '', playerName(player)].filter(Boolean).join(' ');
}
