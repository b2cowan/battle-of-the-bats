'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Shared behaviour for the coach portal's transient overlays.
 *
 * Extracted in Coach Onboarding Quiet Mode Phase C0. `useDismissable` was designed against two real
 * consumers (the season-setup popover and the portal-tour drawer) rather than guessed from one —
 * the Phase A review parked the extraction for exactly that reason.
 */

/**
 * The open/dismiss contract: outside pointer-down closes, Escape closes, listeners exist ONLY while
 * open.
 *
 * Why a hook and not a wrapper component: the two consumers render completely different chrome (an
 * anchored popover vs. a full-height side drawer) and share only this behaviour. A component would
 * have had to own their markup too, which is what let the earlier hand-rolled copies diverge.
 *
 * `onDismiss` is genuinely held in a ref, so (a) an inline arrow from the caller doesn't tear the
 * listeners down and re-add them every render, AND (b) the handler always calls the LATEST closure.
 * (b) matters for the next consumer: a deps-omission version would keep calling whatever closure was
 * captured when the panel opened, so anything reading current-render state inside `onDismiss` would
 * go silently stale for as long as the panel stayed open.
 */
export function useDismissable(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;
    // `mousedown`, not `click`: a gesture that starts inside and ends outside (a drag, or selecting
    // text that runs past the panel edge) must NOT read as "dismiss".
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismissRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismissRef.current();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ref]);
}

/**
 * Keep a CSS-anchored panel inside the viewport. The hand-rolled setup popover shipped without this
 * and could open with its footer — including the hints off-switch — below the fold on a short
 * window; carrying that capability was an explicit Phase C requirement.
 *
 * Publishes `--panel-shift-x` (horizontal nudge) and `--panel-max-h` (height ceiling) for CSS to
 * apply, so placement stays in the stylesheet and this only measures.
 *
 * ⚠ SCOPE, so the parked follow-up isn't underscoped: this NUDGES a panel that CSS has already
 * anchored (`position: absolute` + an edge rule). It deliberately does NOT compute trigger-relative
 * `position: fixed` placement, and has no above/below flip. The three remaining hand-rolled copies
 * (the two admin-tournament menus and the export menu) DO both of those — they hang off scattered
 * toolbar buttons across a wide canvas rather than one edge-anchored header chip. Retiring them
 * needs this hook extended, or a second one; it is not a drop-in.
 *
 * Currently one consumer (the season-setup popover) — the tour drawer is a fixed full-height panel
 * and needs no fit math. Kept beside `useDismissable` because both are the same overlay concern.
 */
export function useViewportFit(open: boolean, ref: RefObject<HTMLElement | null>, margin = 12) {
  useEffect(() => {
    if (!open) return;
    // The shift we last applied, so we can derive the natural position arithmetically instead of
    // writing a reset and re-reading the DOM (which forced a synchronous layout every pass).
    let applied = 0;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Back out the current shift to get where the panel would sit unassisted.
      const naturalLeft = rect.left - applied;
      const naturalRight = rect.right - applied;

      let shift = 0;
      if (naturalRight > window.innerWidth - margin) shift = window.innerWidth - margin - naturalRight;
      if (naturalLeft + shift < margin) shift = margin - naturalLeft;
      shift = Math.round(shift);

      if (shift !== applied) {
        applied = shift;
        el.style.setProperty('--panel-shift-x', `${shift}px`);
      }
      // Cap the height so a long list scrolls INSIDE the panel rather than running off the bottom
      // of the window. CSS supplies the overflow; we only supply the ceiling.
      el.style.setProperty('--panel-max-h', `${Math.max(160, Math.round(window.innerHeight - rect.top - margin))}px`);
    };

    // Coalesce bursts: scroll (especially momentum/touch, and scrolling INSIDE the panel, which the
    // capture-phase listener also sees) can fire at refresh rate, and each pass reads layout.
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open, ref, margin]);
}
