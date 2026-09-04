'use client';
import { useEffect, useRef, type RefObject } from 'react';
import { useLatestRef } from './useLatestRef';
import { escapeClaimed } from './escapeOwnership';

/**
 * THE ACCESSIBILITY FLOOR every overlay stands on (List · Room · Question, D7, 2026-09-02): Escape
 * closes, Tab is trapped inside the panel, focus lands on the panel when it opens and returns to
 * the opener when it closes. Rooms get it from `RoomShell`; a Question modal calls it directly with
 * a ref to its panel (`QuestionShell`, the request window, the Record conversation). Before this,
 * exactly one money overlay had any of it.
 *
 * ⚠ A STACKED OVERLAY OWNS ITS OWN KEYS. The Record conversation and the confirm dialogs portal to
 * <body> and open OVER a room, so a document-level listener would close the room under them on
 * Escape. The handler only acts when the event comes from inside this panel — or from the bare
 * document, when nothing else holds focus.
 *
 * ⚠⚠ AN OPEN MENU INSIDE THE PANEL OWNS ESCAPE, AND IT SAYS SO IN THE DOM (§134 walk,
 * 2026-09-03 — the owner found the room closing when a Files-under suggestion list was dismissed).
 * A combobox's list is not an overlay and has no floor of its own, but Escape while it is open
 * means "close the list", never "close the record I am filling in". The picker already called
 * React's `stopPropagation()` and it could not work: in the App Router React delegates from
 * `document`, this floor listens on `document` too, and stopping propagation never stops a
 * SIBLING listener on the same node — only `stopImmediatePropagation` does, and that would depend
 * on which listener happened to register first.
 * ⚠⚠ AND THE OBVIOUS SECOND FIX FAILED TOO — a `data-escape-owner` attribute checked with
 * `closest()`. It is sound in principle and LOSES A RACE: `keydown` is a DISCRETE event, so React
 * 18 flushes the menu's own `setOpen(false)` SYNCHRONOUSLY at the end of its dispatch, and the
 * attribute is already gone by the time this listener runs. That version shipped and was
 * reproduced still failing in Chromium against the running app. **Do not re-derive it: a DOM
 * marker cannot describe a state the DOM has already left.**
 * So the claim rides on the native EVENT (`escapeClaimed`), which describes a moment rather than a
 * state of the tree — and the attribute survives beside it as the belt for the opposite listener
 * ordering. Both checks below, both deliberate; the reasoning lives in `escapeOwnership.ts`.
 * ⚠ Only Escape. Tab must still be trapped and the arrow keys still belong to the list's own
 * handler, which takes them by `preventDefault` in the ordinary way.
 *
 * ⚠⚠ AND THE BARE DOCUMENT BELONGS TO THE MOST RECENTLY OPENED FLOOR (Phase B, 2026-09-02 — the
 * first genuinely stacked pair, the drive's Record window over the drive's room). With two floors
 * armed, an Escape arriving with focus on <body> reached BOTH: the Question closed, and the room
 * closed underneath it. Every open floor now registers in `openFloors`, oldest first, and a bare
 * key is answered only by the last one in. Not an overlay stack in `lib/coaches-overlay` — that is
 * a counter for scroll-lock and nav-hiding and stays one; this is a list of who may answer a key.
 *
 * ⚠ THE TRAP HOLDS EVEN WHEN FOCUS HAS FALLEN OUT (`/review`, 2026-09-02). A room's Prev/Next swaps
 * the record while the panel stays open, and the button that had focus unmounts with the old
 * record — the browser then parks focus on <body>. A trap that only wraps at the panel's first and
 * last control would let the next Tab walk straight out of the dialog. So: a Tab that arrives with
 * focus outside the panel is pulled back to its first (or, shifted, its last) control, and
 * `focusKey` — the record the panel shows — re-seats focus on the panel whenever it changes.
 *
 * ⚠ CLOSE IS BUSY-GATED: while a write is in flight the panel refuses to be dismissed (the club
 * fold's /review lesson — a write surface must not be torn down under its own request).
 *
 * `walk`, when given, binds ← / → to the room's Prev / Next — never while an input has focus.
 */
export interface DialogWalk {
  prev: string | null;
  next: string | null;
  onSelect: (id: string) => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])';
const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

/** Every floor currently open, oldest first. A key from the bare document is the last one's. */
const openFloors: symbol[] = [];

export function useDialogFloor(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  opts: { onClose: () => void; busy?: boolean; walk?: DialogWalk | null; focusKey?: string | null },
): void {
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // The latest options, so the one keydown effect (keyed on `open`) never re-binds on render churn
  // and never calls a stale closer or walks a stale list.
  const optsRef = useLatestRef(opts);

  useEffect(() => {
    if (!open) return;
    const token = Symbol('dialog-floor');
    openFloors.push(token);
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    function onKey(event: KeyboardEvent) {
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target instanceof Node ? event.target : null;
      const inside = target !== null && panel.contains(target);
      const bare = target === document.body || target === document.documentElement;
      if (!inside && !bare) return;
      // Nothing has focus: only the floor that opened LAST may answer, or a stacked Question's
      // Escape would also close the room beneath it.
      if (bare && openFloors[openFloors.length - 1] !== token) return;

      const { onClose, busy, walk } = optsRef.current;
      if (event.key === 'Escape') {
        /* A menu inside this panel already answered this Escape: it closes, the record stays open.
           TWO checks for two listener orderings, and the first is the one that actually fires here
           — see `escapeOwnership.ts` for why the DOM marker alone lost the race. */
        if (escapeClaimed(event)) return;
        if (target instanceof Element && target.closest('[data-escape-owner]')) return;
        if (!busy) onClose();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (!walk || busy) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (target instanceof Element && target.closest(EDITABLE)) return;
        /* ⚠⚠ AN UNANSWERED QUESTION SUSPENDS THE WALK (`/review`, 2026-09-04). A confirmation
           docked in a room's foot — "Remove the $200.00 payment?", "Delete this bill?" — is a
           question about the record ON SCREEN. Stepping to the next record answers it by
           abandoning it: the dialog vanishes, nothing is written, and nothing tells the coach their
           question was dropped. The foot's own CSS hides the arrows while a question owns the band,
           which takes them out of the tap and tab order; this is the same rule for the KEYS, which
           no stylesheet can reach.
           ⚠ It reads the DOM rather than a flag because the question can belong to the shell's
           consumer (a payment's Remove) or to a control INSIDE the foot that owns its own state
           (`GuardedDelete`) — an `alertdialog` in the panel is the one fact both share. */
        if (panel.querySelector('[role="alertdialog"]')) return;
        const dest = event.key === 'ArrowLeft' ? walk.prev : walk.next;
        if (dest) {
          event.preventDefault();
          walk.onSelect(dest);
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!(active instanceof Node) || !panel.contains(active)) {
        // Focus fell out of the panel (a control unmounted under it) — pull it back in.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    // Seat focus on the panel — unless a field inside it already took it (an `autoFocus` input
    // mounts before this effect runs, and the coach's cursor belongs there, not on the frame).
    const panel = panelRef.current;
    const active = document.activeElement;
    if (panel && !(active instanceof Node && panel.contains(active))) panel.focus();
    return () => {
      const at = openFloors.indexOf(token);
      if (at >= 0) openFloors.splice(at, 1);
      document.removeEventListener('keydown', onKey);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, panelRef]);

  // The record changed while the panel stayed open (Prev/Next): if the control that had focus went
  // with the old record, seat focus on the panel again so the trap and the arrow keys keep working.
  const focusKey = opts.focusKey ?? null;
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const active = document.activeElement;
    if (panel && !(active instanceof Node && panel.contains(active))) panel.focus();
  }, [open, focusKey, panelRef]);
}
