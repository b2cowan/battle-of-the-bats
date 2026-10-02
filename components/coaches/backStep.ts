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

/**
 * Does this click LEAVE the page — a link to somewhere else, opened in this tab?
 *
 * ⚠ WHY A STEP ASKS (§239 walk, 2026-09-25). A menu that holds a step closes on an outside
 * pointer-down; the step's exit then consumes its entry with `history.back()`. When that outside
 * press was a tap on a link — the bottom bar's Schedule under the lineup builder's Print menu — the
 * back arrived between the press and its click, the router was mid-traversal when the link asked to
 * navigate, and the tap did nothing. A click that leaves the page must be left to push over the
 * entry instead: the entry becomes a dead one, which `popVerdict` already steps over — the same as
 * a link tapped INSIDE the sheet.
 * A new tab, a download, a modified click, a mailto:/tel: link and a link to where the browser already
 * is all keep the page, so the entry is consumed as usual.
 */
export interface LinkClick {
  /** The link's resolved `href`, or null when the click was not on a link. */
  href: string | null;
  /** Its `target` attribute ('' when absent). */
  target: string;
  download: boolean;
  button: number;
  modified: boolean;
}
export function clickLeavesPage(click: LinkClick, location: { origin: string; pathname: string; search: string; href: string }): boolean {
  if (click.href === null || click.button !== 0 || click.modified || click.download) return false;
  // _top and _parent ARE this tab — the portal is never framed.
  if (!['', '_self', '_top', '_parent'].includes(click.target)) return false;
  let to: URL;
  try { to = new URL(click.href, location.href); } catch { return false; }
  if (to.protocol !== 'http:' && to.protocol !== 'https:') return false; // mailto:, tel: — an app opens, the page stays
  if (to.origin !== location.origin) return true;
  return to.pathname + to.search !== location.pathname + location.search;
}

/**
 * THE PRESS GATE — when a closing step may consume its history entry, and whether the tap that closed
 * it left the page (§239 walk + its /review, 2026-09-25). Pure: the hook hands it the browser's
 * timers and its five listeners; the unit test hands it a fake clock and plays event sequences.
 *
 * An exit taken while a press is under way is HELD — through the pointer-down, the release, and the
 * click's whole dispatch — and settles one macrotask after that click with `left` = did the click
 * leave the page. Every rule below is one way the first build of this got it wrong:
 *   · `leaves()` is called from the click's BUBBLE phase on `document`, never its capture: a click that
 *     something stopped on the way down (the unsaved-changes guard, which asks "Leave without
 *     saving?" and keeps the coach on the page) never reaches it, so the entry IS consumed. Read in
 *     the capture phase, the guard's "Stay" left a dead entry the next Back press did nothing on.
 *     ⚠ `document`, not `window`: a floor's panel stops every click with React's `stopPropagation()`,
 *     which halts the native event AT `document`, so on `window` a door inside a floor was never
 *     heard and its exit's `back()` cancelled the door (§258 walk, 2026-10-02).
 *   · The hold starts at the press and lasts until the click — an exit that arrives a beat late,
 *     after the finger has lifted but before its click, is held too, not run bare.
 *   · A new press SETTLES whatever an earlier one left held, as a stay: that press's click never came
 *     (a drag), or its release was lost. So one press's click can never answer for another's exits.
 *   · `left` lives for ONE click: an exit taken later, by a save or a timer, never reads a stale one.
 *   · With no click at all, the hold ends after `graceMs` (a drag's release) or at once (a cancel).
 * An exit taken with nothing under way — Escape, a save, a timer — settles one macrotask on, as the
 * hook always did, with `left` false.
 */
export type PressExit = (left: boolean) => void;
export interface PressTimers { set(run: () => void, ms: number): unknown; clear(handle: unknown): void }
export const PRESS_CLICK_GRACE_MS = 500;
export interface PressGate {
  press(): void; release(): void; cancel(): void; clicked(): void; leaves(): void;
  exit(fn: PressExit): void;
}
export function createPressGate(timers: PressTimers, graceMs = PRESS_CLICK_GRACE_MS): PressGate {
  let pressing = false;
  let awaitingClick: unknown = null;   // released; the grace timer until its click arrives
  let inClick = false;                 // a click's dispatch is under way; it settles one macrotask on
  let left = false;
  let held: PressExit[] = [];
  const stopWaiting = () => { if (awaitingClick !== null) { timers.clear(awaitingClick); awaitingClick = null; } };
  const settle = (didLeave: boolean) => {
    stopWaiting();
    const exits = held;
    held = [];
    for (const fn of exits) fn(didLeave);
  };
  return {
    press() { settle(false); pressing = true; },
    release() {
      pressing = false;
      stopWaiting();
      awaitingClick = timers.set(() => { awaitingClick = null; settle(false); }, graceMs);
    },
    cancel() {
      pressing = false;
      stopWaiting();
      timers.set(() => settle(false), 0);
    },
    clicked() {
      stopWaiting();
      if (inClick) return;
      inClick = true;
      timers.set(() => { inClick = false; const didLeave = left; left = false; settle(didLeave); }, 0);
    },
    leaves() { left = true; },
    exit(fn) {
      if (pressing || awaitingClick !== null || inClick) held.push(fn);
      else timers.set(() => fn(false), 0);
    },
  };
}
