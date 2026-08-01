// Shared display-name helpers for rep-team roster players. Extracted so the Schedule and the
// standalone Lineups builder render identical names without duplicating the logic.
import type { RepRosterPlayer } from '@/lib/types';

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
