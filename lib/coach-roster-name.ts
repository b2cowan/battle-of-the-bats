// Shared display-name helpers for rep-team roster players. Extracted so the Schedule and the
// standalone Lineups builder render identical names without duplicating the logic.
import type { RepRosterPlayer } from '@/lib/types';

// Defensive: a bad import / seed can leave a name part as the literal string "null"/"undefined"
// (truthy, so a plain filter(Boolean) keeps it) — treat those as blank.
export function cleanNamePart(part: string | null | undefined): string {
  const s = (part ?? '').trim();
  return s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' ? '' : s;
}

export function playerName(player: RepRosterPlayer): string {
  return [cleanNamePart(player.playerFirstName), cleanNamePart(player.playerLastName)].filter(Boolean).join(' ');
}

export function playerDisplayName(player: RepRosterPlayer): string {
  return [player.playerNumber ? `#${player.playerNumber}` : '', playerName(player)].filter(Boolean).join(' ');
}
