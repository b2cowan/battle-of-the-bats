/**
 * THE PURE HALF OF `useBackStep` — what a popstate means, given where the browser landed and which
 * step is on top. Framework-free so the unit test can pin the outcomes without a DOM.
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
 *
 * ⚠ UNLESS THE DEAD ENTRY HAS AN ADDRESS AND NOTHING IS OPEN (owner, 2026-09-22 — "back from the
 * lineup skips the game"). A step that names a place — the schedule's game sheet is
 * `?event=<id>&tab=<tab>` — left its address on its entry when the coach walked out of the page
 * through one of its doors. That entry is not a placeholder: it is the game. Landing on it is the
 * whole point, so it is NOT stepped over; the page it belongs to reopens the sheet from the
 * address on mount. An UNaddressed dead entry still is, because nothing about it can be restored
 * and the press would read as dead. A step strips its own address as it closes, so the only
 * addressed leftovers are the ones the coach left a page from — never a sheet they closed behind
 * them.
 * ⚠ The exception is deliberately confined to `top === null`: with a level still OPEN, what is on
 * screen is the truth, and an address left ABOVE it is a leftover to be undone like any other —
 * landing there would leave the coach reading one thing at the address of another. (Unreachable
 * today, since a push truncates the forward stack; pinned so it stays a decision rather than a
 * gap someone closes by guessing.)
 */
export type PopVerdict = 'stay' | 'close-top' | 'step-back';

export function popVerdict(landed: number | null, top: number | null, landedAddressed = false): PopVerdict {
  if (top === null) return landed === null || landedAddressed ? 'stay' : 'step-back';
  if (landed === null || landed < top) return 'close-top';
  if (landed === top) return 'stay';
  return 'step-back';
}

/** The step number an entry carries, or null for a page entry (or no state at all). */
export function stepOf(state: unknown): number | null {
  const seq = (state as { __step?: unknown } | null | undefined)?.__step;
  return typeof seq === 'number' ? seq : null;
}

/** The address an entry names — `pathname + search` — or null for a step that names no place. */
export function addressOf(state: unknown): string | null {
  const at = (state as { __stepAt?: unknown } | null | undefined)?.__stepAt;
  return typeof at === 'string' && at !== '' ? at : null;
}

/** The address of the view BEHIND an addressed step — what the entry reverts to as it closes. */
export function homeOf(state: unknown): string | null {
  const home = (state as { __stepHome?: unknown } | null | undefined)?.__stepHome;
  return typeof home === 'string' && home !== '' ? home : null;
}
