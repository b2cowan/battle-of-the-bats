'use client';

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

/**
 * Shared behaviour for transient overlays — panels that open, dismiss, and need to fit on screen.
 *
 * Shell-neutral by design: consumers span the coach portal (season-setup popover, portal tour) and
 * the tournament admin bundle (toolbar menu, status legend, export menu). It lived under
 * `components/coaches/` while the coach portal was its only consumer; the absence of a neutral home
 * is what deferred the admin conversion twice, so the move came first, on its own. It sits in `lib/`
 * rather than `components/shared/` because it is headless — `components/shared/` holds cross-shell
 * things you *render*, while `lib/` is where this repo's hook modules already live.
 *
 * Near neighbour, different question: `lib/coaches-overlay.tsx` answers "is ANY overlay open?" (for
 * nav-hide and scroll-lock). This file answers "how does THIS one overlay dismiss and position
 * itself?". A panel commonly wants both.
 *
 * What does NOT belong here: full modals (`components/admin/BottomSheet.tsx`,
 * `components/help/HelpDrawer.tsx`). Those add a portal, a backdrop, scroll-lock, and a focus trap —
 * a different contract, correctly not reduced to these hooks.
 */

/**
 * The open/dismiss contract: outside pointer-down closes, Escape closes, listeners exist ONLY while
 * open.
 *
 * Why a hook and not a wrapper component: the two consumers render completely different chrome (an
 * anchored popover vs. a full-height side drawer) and share only this behaviour. A component would
 * have had to own their markup too, which is what let the earlier hand-rolled copies diverge.
 *
 * Re-checked when the admin menus were converted, since two of them DO now converge on the same
 * `position: fixed` + `overflowY: auto` panel shape: still hooks, because they diverge either side of
 * that panel — one has a single trigger button and a generic `children` slot, the other a split
 * primary+chevron trigger and ~200 lines of individually plan-gated items, and they close on select
 * by different means (delegation vs. explicit per-item). Two structurally different consumers is the
 * bar for extracting behaviour, not for committing to a component API. Revisit at a third.
 *
 * `onDismiss` is genuinely held in a ref, so (a) an inline arrow from the caller doesn't tear the
 * listeners down and re-add them every render, AND (b) the handler always calls the LATEST closure.
 * (b) matters for the next consumer: a deps-omission version would keep calling whatever closure was
 * captured when the panel opened, so anything reading current-render state inside `onDismiss` would
 * go silently stale for as long as the panel stayed open.
 *
 * The array-of-refs and `onEscape` parameters were added when the repo-wide sweep reached two
 * consumers a single ref couldn't express (a portaled notification panel, and a picker that returns
 * focus to its trigger on Escape only). Both are additive with backwards-compatible defaults — every
 * prior call site keeps its exact behaviour and none of them changed.
 */
export function useDismissable(
  open: boolean,
  /**
   * The boundary: a pointer-down outside it dismisses. Pass an ARRAY when the panel isn't inside its
   * own trigger's DOM subtree — a portaled panel's wrapper and panel are two disjoint boundaries, and
   * "outside" means outside *both*. Single-ref callers are unaffected.
   */
  ref: RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>,
  onDismiss: () => void,
  /**
   * What Escape does, when it must differ from a click-away. Defaults to `onDismiss`.
   * Exists because a consumer that returns focus to its trigger should do so on Escape (the user is
   * still driving from the keyboard) but NOT on a click elsewhere (the user has already moved on, and
   * yanking focus back would fight them).
   *
   * ⚠ It REPLACES `onDismiss` on the Escape path rather than running alongside it — so it must close
   * the panel itself. If `onDismiss` ever grows side effects, an `onEscape` that forgets to mirror
   * them will silently skip them.
   */
  onEscape?: () => void,
) {
  const onDismissRef = useRef(onDismiss);
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onDismissRef.current = onDismiss;
    onEscapeRef.current = onEscape;
  }, [onDismiss, onEscape]);

  // Arrays are re-created every render by callers writing `[a, b]` inline. Depending on the array
  // itself would tear the listeners down and re-add them on every render — the exact churn the
  // `onDismiss` ref exists to avoid — so hold it in a ref and depend on nothing.
  const refsRef = useRef(ref);
  useEffect(() => {
    refsRef.current = ref;
  }, [ref]);

  // Who had focus when this opened — so Escape can hand it back.
  //
  // Without this, Escape is a keyboard TRAP DOOR rather than an escape: the panel unmounts with focus
  // still inside it, the browser falls back to <body>, and someone who tabbed into the panel to read
  // it is dumped at the top of the document with no way back except tabbing the whole page again.
  // That is arguably worse than having no Escape at all, which is what a `/review` accessibility pass
  // found across six freshly-converted panels — the sweep that existed to CLOSE a keyboard gap had
  // opened a different one.
  //
  // Captured on open (the trigger is focused by the click that opened it, so that's what comes back)
  // and only restored on the Escape path: a user who clicked elsewhere has already chosen where they
  // are going, and yanking focus back would fight them.
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    return () => { restoreFocusRef.current = null; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // `mousedown`, not `click`: a gesture that starts inside and ends outside (a drag, or selecting
    // text that runs past the panel edge) must NOT read as "dismiss".
    const onPointer = (e: MouseEvent) => {
      const current = refsRef.current;
      const boundaries = Array.isArray(current) ? current : [current];
      // An unmounted boundary is not a reason to dismiss — it's absent, not "outside". Requiring at
      // least one live boundary keeps a portaled panel from dismissing itself on the frame before its
      // own node lands.
      const live = boundaries.filter(r => r.current);
      if (!live.length) return;
      if (live.every(r => !r.current!.contains(e.target as Node))) onDismissRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      // Never hijack Escape mid-IME-composition: for someone typing Japanese/Chinese/Korean, that
      // Escape is cancelling the composition, not asking to close the panel they're typing into.
      // Came from the chat emoji picker, the only hand-rolled copy that got this right — it is
      // correct for every consumer, so it lives here now rather than in one of them.
      // (Costs an IME user one extra Escape: the first ends the composition, the second closes.)
      if (e.isComposing) return;
      if (e.key !== 'Escape') return;

      // A caller that supplied `onEscape` owns focus itself — don't fight it.
      const custom = onEscapeRef.current;
      if (custom) { custom(); return; }

      onDismissRef.current();
      // Synchronously, BEFORE React unmounts the panel: the target is outside the panel, so moving
      // focus there first means the unmount can't strand it on <body>.
      const prev = restoreFocusRef.current;
      if (prev?.isConnected) prev.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
}

/**
 * Keep a CSS-anchored panel inside the viewport. The hand-rolled setup popover shipped without this
 * and could open with its footer — including the hints off-switch — below the fold on a short
 * window; carrying that capability was an explicit Phase C requirement.
 *
 * Publishes `--panel-shift-x` (horizontal nudge) and `--panel-max-h` (height ceiling) for CSS to
 * apply, so placement stays in the stylesheet and this only measures.
 *
 * ⚠ SCOPE — pick the right one of the two fit hooks: this NUDGES a panel that CSS has already
 * anchored (`position: absolute` + an edge rule). It deliberately does NOT compute trigger-relative
 * `position: fixed` placement, and has no above/below flip. Panels that hang off a scattered toolbar
 * button rather than one edge-anchored chip want `useAnchoredMenu` instead.
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

export interface AnchoredMenuOptions {
  /**
   * Floor for the panel's own measured width. Differs per consumer and is preserved verbatim:
   * the toolbar menu uses 240, the export menu 220.
   *
   * ⚠ NOT the only place a width for these panels lives — each panel's CSS module also carries one,
   * and the toolbar menu's (`width: min(18rem, …)`, i.e. 288) does NOT agree with its 240 here. That
   * predates this hook and is harmless because CSS only governs the single frame before the first
   * measurement lands, but do not read these four numbers as the sole source of truth.
   */
  minWidth: number;
  /**
   * Floor for the width once the viewport is too narrow to grant `minWidth` — the point at which the
   * panel is allowed to overhang the margins rather than collapse further. Also per-consumer and
   * verbatim (toolbar menu 180, export menu 160).
   *
   * Two different thresholds are in play, so to be exact: the panel drops below `minWidth` once the
   * viewport is under `minWidth + 2 * margin` (264 / 244), and this value becomes the literal width
   * only under `narrowMinWidth + 2 * margin` (204 / 184). Unreachable in practice on any real
   * device; consolidating two copies is not the pass to change it in.
   */
  narrowMinWidth: number;
  /** Which trigger edge the panel lines up with before clamping. Default `'end'` (right edges flush). */
  align?: 'start' | 'end';
  /** Keep-out distance from every viewport edge. */
  margin?: number;
}

/**
 * Trigger-anchored `position: fixed` placement for a menu panel, with an above/below flip.
 *
 * Returns the `CSSProperties` to spread onto the panel — placement is genuinely dynamic (it depends
 * on where the trigger happens to have landed and how much room is left), so unlike `useViewportFit`
 * it cannot be expressed as a CSS nudge and legitimately owns the panel's `top`/`left`.
 *
 * Consolidates two near-identical hand-rolled copies (`ToolbarMenu`, `ExportMenu`) that differed
 * only in the two width floors above and in alignment. The math below is the union of the two,
 * transcribed rather than rewritten: `/simplify`-style improvements to it are a separate pass, since
 * the whole point of this one is that nothing on screen moves.
 *
 * ⚠ THE FLIP IS THE FRAGILE PART. It is what stops a menu near the bottom of the window from
 * opening off the bottom of the screen, and it is invisible in any test that opens a menu at the
 * top. Anything that touches this function must be re-verified against a trigger low in the window.
 *
 * Pair with `useDismissable` — this hook only places the panel, it does not close it.
 */
export function useAnchoredMenu(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  { minWidth, narrowMinWidth, align = 'end', margin = 12 }: AnchoredMenuOptions,
): CSSProperties | undefined {
  // Deliberately NOT cleared when `open` goes false: both originals kept the last placement, so a
  // reopen paints at the old spot for one frame and is corrected below. Clearing it would be a
  // first-paint change, which is a visible change.
  const [style, setStyle] = useState<CSSProperties | undefined>();

  useEffect(() => {
    if (!open) return;

    function place() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const triggerRect = trigger.getBoundingClientRect();
      // `documentElement.client*`, not `window.inner*`: these exclude the scrollbar gutter, so the
      // right-hand clamp doesn't park the panel underneath a visible scrollbar.
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;

      const width = Math.min(
        Math.max(panel.offsetWidth, minWidth),
        Math.max(viewportWidth - margin * 2, narrowMinWidth),
      );
      const desiredLeft = align === 'start' ? triggerRect.left : triggerRect.right - width;
      const left = Math.max(margin, Math.min(desiredLeft, viewportWidth - width - margin));

      const panelHeight = panel.offsetHeight;
      // "Useful" = the whole panel, or 160px of it, whichever is SMALLER — so a short menu that
      // fits below never flips just because it can't have its full preferred height.
      const minimumUsefulHeight = Math.min(panelHeight, 160);
      let top = triggerRect.bottom + 6;
      let maxHeight = viewportHeight - top - margin;

      if (maxHeight < minimumUsefulHeight) {
        const availableAbove = triggerRect.top - margin - 6;
        if (availableAbove > maxHeight) {
          // FLIP ABOVE — the behaviour to protect.
          const visibleHeight = Math.min(panelHeight, availableAbove);
          top = Math.max(margin, triggerRect.top - visibleHeight - 6);
          maxHeight = visibleHeight;
        } else {
          // Neither side has room: a full-height scrolling panel from the top margin.
          top = margin;
          maxHeight = viewportHeight - margin * 2;
        }
      }

      setStyle({ position: 'fixed', top, left, width, maxHeight, overflowY: 'auto' });
    }

    // A frame, not a synchronous call: the panel has just mounted, so `offsetWidth`/`offsetHeight`
    // need a layout pass before they mean anything.
    const frame = window.requestAnimationFrame(place);
    // Capture phase, so scrolling an ancestor pane — not just the window — re-places the panel.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, triggerRef, panelRef, minWidth, narrowMinWidth, align, margin]);

  return style;
}
