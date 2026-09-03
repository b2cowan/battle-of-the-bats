'use client';
/**
 * WHO OWNS THIS ESCAPE — the contract between a dismissible menu and the dialog floor beneath it.
 *
 * ⚖ THE PROBLEM. A combobox list, a dropdown, an autocomplete — none of them is an overlay and none
 * has an accessibility floor of its own, but Escape while one is open means "close the list", never
 * "close the record I am filling in". The room around it listens on `document` and closes on any
 * Escape from inside its panel, so without a contract the coach loses the whole record (owner,
 * §134 walk).
 *
 * ⚠⚠ TWO THINGS THAT LOOK LIKE THE FIX AND ARE NOT. Both were tried; the second was tried *here*,
 * shipped, and reproduced in a real browser still failing.
 *
 *  1. `e.stopPropagation()` in the menu's own handler. **Cannot work.** In the App Router React
 *     delegates events from `document`, and `useDialogFloor` listens on `document` too — so the two
 *     handlers are SIBLINGS on one node, and stopping propagation never stops a sibling. (Only
 *     `stopImmediatePropagation` does, and that silently depends on which listener registered
 *     first.)
 *  2. A `data-escape-owner` attribute on the menu's subtree, which the floor checks with
 *     `closest()`. Sound in principle, **and it loses a race**: `keydown` is a DISCRETE event, so
 *     React 18 flushes the menu's `setOpen(false)` SYNCHRONOUSLY at the end of its dispatch — the
 *     menu has already re-rendered and REMOVED the attribute by the time the floor's listener runs
 *     one microtask later. Measured in Chromium against the running app, not reasoned about. Do not
 *     re-derive this: a DOM marker cannot describe a state the DOM has already left.
 *
 * ⚖ SO THE CLAIM RIDES ON THE EVENT ITSELF. The synthetic event React hands the menu wraps the very
 * same native `KeyboardEvent` object the floor's document listener receives, so a flag set on it is
 * still there whatever either component has re-rendered into since. It describes a moment, which is
 * what this actually is, rather than a state of the tree.
 *
 * ⚠ THE `data-escape-owner` MARKER SURVIVES ALONGSIDE IT, and is not redundant. The two cover
 * opposite listener orderings: the claim works when the menu's handler runs FIRST (which it does
 * here — React's delegation is registered at hydration, long before any floor opens), and the
 * attribute works when the floor's handler runs first, since nothing has re-rendered yet. Keep
 * both; a contract that depends on registration order is a contract that breaks the day someone
 * adds an overlay.
 */

/** The flag's home. A symbol, so nothing can collide with it and nothing serialises it by accident. */
const OWNED = Symbol.for('fieldlogic.escape-owned');

/**
 * Claim this Escape for a menu that is closing itself. Call it in the menu's own key handler,
 * ONLY when the menu is actually open — a closed menu must let Escape reach the dialog, which is
 * what a coach means then.
 */
export function claimEscape(event: { nativeEvent: Event } | Event): void {
  const native = 'nativeEvent' in event ? event.nativeEvent : event;
  (native as unknown as Record<symbol, boolean>)[OWNED] = true;
}

/** Has a menu already answered this Escape? Read by `useDialogFloor` before it closes anything. */
export function escapeClaimed(event: Event): boolean {
  return (event as unknown as Record<symbol, boolean | undefined>)[OWNED] === true;
}
