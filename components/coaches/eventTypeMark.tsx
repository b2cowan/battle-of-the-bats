'use client';
import { Trophy, Swords, Shield, Dumbbell, Users } from 'lucide-react';
import type { RepEventType } from '@/lib/types';
import { EVENT_COLORS } from '@/lib/coach-schedule-vocab';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **HOW AN EVENT TYPE LOOKS — the icon and the colour, in ONE place.**
 *
 * A coach reads these four marks every week on their own schedule: a shield is a league game, a
 * trophy is a tournament, swords are a scrimmage, a dumbbell is a practice. Extracted from the
 * schedule page on 2026-08-18, when the closed-season page's Results shelf needed the same
 * vocabulary — and inventing a second one there would have been the worst possible place to do it,
 * since that page is the one a coach opens least often.
 *
 * ⚠ **THE PAIR MOVES TOGETHER, WHICH IS WHY IT IS ONE MODULE AND NOT TWO CONSTANTS.** The icon
 * says which type; the colour reinforces it. A surface that took the icon map and hand-picked its
 * own colours would drift on exactly the axis a coach reads fastest, and it would drift silently —
 * both screens render perfectly while disagreeing about what amber means.
 *
 * ⚠ **ONLY THE ICONS LIVE HERE** (`/simplify`, 2026-08-18). `EVENT_COLORS` is pure data and sits
 * with the rest of the event vocabulary in `lib/coach-schedule-vocab.ts` — testable under plain
 * `node --test`, and in the one place a reader already looks for "what is this event type called
 * and how does it read". It is RE-EXPORTED below so a caller still gets the pair from one import,
 * which is what stops the two drifting apart.
 *
 * ⚠⚠ **THE COLOUR NEVER CARRIES THE MEANING ON ITS OWN.** League-green and tournament-amber sit
 * close enough to be a coin-flip for a red-green colour-blind coach. Every caller must keep the
 * WORD beside the mark, or keep the facts that make the row readable without it (opponent, score,
 * result). The mark is reinforcement, not the message — the same rule the money shelf follows with
 * "under" / "over".
 *
 * ⚠ The admin portal keeps its own copy. That is deliberate: it is a different product surface with
 * its own palette, and merging them would couple two shells that have never had to agree.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export const EVENT_ICONS: Record<RepEventType, React.ElementType> = {
  external_tournament: Trophy,
  tournament_game:     Trophy,
  scrimmage:           Swords,
  league_game:         Shield,
  practice:            Dumbbell,
  team_event:          Users,
};

/** Re-exported so a caller gets the icon and the colour from ONE import — see the note above. */
export { EVENT_COLORS };

/** The mark on its own — used wherever a row or a summary line names an event type. */
export function EventTypeMark({ type, size = 13 }: { type: RepEventType; size?: number }) {
  const Icon = EVENT_ICONS[type];
  return <Icon size={size} style={{ color: EVENT_COLORS[type], flexShrink: 0 }} aria-hidden />;
}
