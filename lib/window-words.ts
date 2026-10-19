/**
 * The one window's own words (One Window Stage 2, owner rulings Q7 2026-10-18, A and B1 2026-10-19): the ask a form
 * makes in its foot when it is closed with something typed. One sentence for every window (B1); a window whose job is
 * not saving says its own (Message a family's "Close without sending?", `lib/families-words.ts`). Keep writing is the
 * ruled word — the older second-window ask (`useDiscardGuard`) still says "Keep editing" until Stage 3 retires it.
 */
export const WINDOW_ASK = {
  sentence: 'Close without saving? What you typed won’t be kept.',
  keep: 'Keep writing',
  discard: 'Discard',
} as const;
