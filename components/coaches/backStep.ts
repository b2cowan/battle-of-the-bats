/**
 * THE PURE HALF OF `useBackStep` — what a popstate means, given where the browser landed and which
 * step is on top. Framework-free so the unit test can pin the four outcomes without a DOM.
 *
 * A step's history entry carries its sequence number (`__step`); a page entry carries none. The
 * browser has just moved to an entry (`landed`); the topmost ACTIVE step is `top` (null when no
 * step is open). Then:
 *   · `stay`      — we are on the top step's own entry (a forward back onto it, or a deeper pop
 *                   some other listener owns): nothing to do.
 *   · `close-top` — the top step's entry was popped (Back): hold the line by re-pushing its entry,
 *                   then ask the step to go back one level. The step's own exit consumes the entry.
 *   · `step-back` — a DEAD entry: one a step left behind when the page was navigated away from
 *                   inside it, or a forward onto a step that has since closed. A Back that lands
 *                   here would otherwise be a press that does nothing, so it is stepped over.
 */
export type PopVerdict = 'stay' | 'close-top' | 'step-back';

export function popVerdict(landed: number | null, top: number | null): PopVerdict {
  if (top === null) return landed === null ? 'stay' : 'step-back';
  if (landed === null || landed < top) return 'close-top';
  if (landed === top) return 'stay';
  return 'step-back';
}

/** The step number an entry carries, or null for a page entry (or no state at all). */
export function stepOf(state: unknown): number | null {
  const seq = (state as { __step?: unknown } | null | undefined)?.__step;
  return typeof seq === 'number' ? seq : null;
}
