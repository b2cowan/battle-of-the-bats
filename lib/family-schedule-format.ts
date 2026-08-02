import { formatInOrgZone } from './timezone';
import type { FamilyScheduleEntry } from './family-view';

/**
 * lib/family-schedule-format.ts — how ONE schedule row reads, in one place.
 *
 * Two surfaces render the same `FamilyScheduleEntry`: the connected family's view (warm
 * consumer tokens) and the standing public team page (dark public tokens). Their MARKUP and
 * CSS are deliberately different — they live on opposite sides of the platform's warm/dark
 * tokenization boundary — but the LABELS are the same product decision and were forked by
 * hand, which is how "vs Falcons" and "at Falcons" quietly stop agreeing a release later.
 *
 * Only the pure labelling lives here. Nothing in this file knows about CSS or React, so
 * neither surface is constrained by the other's styling.
 *
 * Not `server-only` — a client component imports it. The type import is erased at compile
 * time, so pulling `FamilyScheduleEntry` from the server-only read plane is safe.
 */

/** "Sat, Aug 9" — always in the ORG's timezone, never the viewer's device zone. */
export function scheduleDayLabel(iso: string): string {
  return formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "2:00 p.m." — same zone rule. */
export function scheduleTimeLabel(iso: string): string {
  return formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit' });
}

/**
 * "vs Falcons" / "at Falcons" — which preposition a matchup reads with.
 *
 * Exported because the postgame family-email draft (Chunk D 3.1) states the same matchup in
 * prose and had hand-written the identical ternary. One sentence of duplication is how "vs"
 * and "at" quietly stop agreeing between the schedule a family reads and the email they were
 * sent about the same game.
 */
export function opponentPhrase(opponent: string, homeAway: string | null): string {
  return `${homeAway === 'away' ? 'at' : 'vs'} ${opponent}`;
}

/**
 * The row's headline. `fallbackName` is what an unnamed, opponent-less event shows: the
 * family view passes the team name (their own team is the subject), the public page passes
 * nothing (the team name is already the page heading, so repeating it reads as a stutter).
 */
export function scheduleRowTitle(entry: FamilyScheduleEntry, fallbackName?: string): string {
  if (entry.eventType === 'practice') return 'Practice';
  if (entry.opponent) return opponentPhrase(entry.opponent, entry.homeAway);
  return entry.name || fallbackName || '';
}

/** "W 4–2", or null when there is no score to show. Reads the SERVER's `hasScore` rather than
 *  re-deriving it, so this can never disagree with what the DTO decided. */
export function scheduleScoreText(entry: FamilyScheduleEntry): string | null {
  if (!entry.hasScore || entry.teamScore === null || entry.opponentScore === null) return null;
  const letter = entry.result === 'win' ? 'W' : entry.result === 'loss' ? 'L' : 'T';
  return `${letter} ${entry.teamScore}–${entry.opponentScore}`;
}

/** Which tone a result reads in. Returned as a NAME, not a class — each surface maps it to
 *  its own token set. */
export function scheduleResultTone(entry: FamilyScheduleEntry): 'win' | 'loss' | 'neutral' {
  if (entry.result === 'win') return 'win';
  if (entry.result === 'loss') return 'loss';
  return 'neutral';
}

/**
 * Is this row finished? Reads the SERVER's decision rather than re-deriving one.
 *
 * This previously guessed from `teamScore !== null` while the DTO used a broader rule, so a
 * game with a result but no scores read as finished on one surface and upcoming on another.
 * The single definition now lives in `lib/family-view.ts` and rides on the entry.
 */
export function isScheduleEntryCompleted(entry: FamilyScheduleEntry): boolean {
  return entry.completed;
}

/** A Google Maps search link for an address, or null. Both surfaces offer "Directions →". */
export function directionsHref(address: string | null): string | null {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
