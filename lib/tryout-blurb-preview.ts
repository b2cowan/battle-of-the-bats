/**
 * lib/tryout-blurb-preview.ts — what "How families see it" decides, beside the tryout blurb box (drawn and ruled 2026-10-22).
 * Pure, so it is unit-tested (tests/unit/club-tryout-blurb-preview.test.ts); the component only draws it.
 */
import type { TryoutState } from './tryout-season';

/**
 * The state the public tryout page stands in, from what the Sign-ups card already knows (`daysAhead` is null until read).
 * It follows the page's one rule (lib/tryout-season.ts): open · not open yet (the switch is off and a tryout day is still
 * ahead) · otherwise closed. A finished tryout reads as closed here: the page hides the words in both, and "finished on …"
 * needs a day this screen has not loaded.
 */
export function previewStateOf(open: boolean, daysAhead: number | null): TryoutState | null {
  if (open) return 'open';
  if (daysAhead == null) return null; // not known yet: draw nothing rather than the wrong page
  return daysAhead > 0 ? 'notOpenYet' : 'closed';
}

/** The one line under the preview, only where it adds something the picture cannot show. */
export function previewNote(state: TryoutState, text: string): { words: string; warn: boolean } | null {
  if (state === 'closed') return { words: 'Families don’t see your words right now.', warn: true };
  if (!text.trim()) return { words: 'Nothing written yet, so families see the page without a “From the club” section.', warn: false };
  return null;
}
