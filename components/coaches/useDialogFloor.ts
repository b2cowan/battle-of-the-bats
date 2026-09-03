'use client';
import { useEffect, useRef, type RefObject } from 'react';

/**
 * THE ACCESSIBILITY FLOOR every overlay stands on (List · Room · Question, D7, 2026-09-02): Escape
 * closes, Tab is trapped inside the panel, focus lands on the panel when it opens and returns to
 * the opener when it closes. Rooms get it from `RoomShell`; a Question modal calls it directly with
 * a ref to its panel. Before this, exactly one money overlay had any of it.
 *
 * ⚠ A STACKED OVERLAY OWNS ITS OWN KEYS. The Record conversation and the confirm dialogs portal to
 * <body> and open OVER a room, so a document-level listener would close the room under them on
 * Escape. The handler only acts when the event comes from inside this panel — or from the bare
 * document, when nothing else holds focus.
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

export function useDialogFloor(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  opts: { onClose: () => void; busy?: boolean; walk?: DialogWalk | null; focusKey?: string | null },
): void {
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Latest-value refs so the one keydown effect (keyed on `open`) never re-binds on render churn
  // and never calls a stale closer or walks a stale list.
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    function onKey(event: KeyboardEvent) {
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target instanceof Node ? event.target : null;
      const inside = target !== null && panel.contains(target);
      const bare = target === document.body || target === document.documentElement;
      if (!inside && !bare) return;

      const { onClose, busy, walk } = optsRef.current;
      if (event.key === 'Escape') {
        if (!busy) onClose();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (!walk || busy) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (target instanceof Element && target.closest(EDITABLE)) return;
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
    panelRef.current?.focus();
    return () => {
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
