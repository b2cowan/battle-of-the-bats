'use client';
import { useCallback, useRef, type HTMLAttributes, type ReactNode, type Ref, type RefObject } from 'react';
import { usePointerOutside } from '@/lib/overlay-hooks';
import { useOverlayOpenIfAvailable } from '@/lib/coaches-overlay';
import { useDialogFloor } from './useDialogFloor';
import styles from './SheetFrame.module.css';

/**
 * ONE FRAME FOR THE PORTAL'S PHONE SHEETS (Sheet Frame, owner rulings D1–D6, 2026-10-05 — plan
 * docs/projects/active/SHEET_FRAME_PLAN.md, the geometry and its reasons in `SheetFrame.module.css`).
 * The dim and the sheet come together, so neither can be rendered without the other.
 *
 * ⚠⚠ THE DIM IS INSIDE THE BOUNDARY THE FRAME WATCHES. The dim is what a tap off the sheet lands on. A
 * dim outside the "tap outside" boundary lets the listener's `pointerdown` fire first and unmount the
 * sheet, and the `click` that follows lands on whatever the dim was covering — on 2026-09-22, under
 * touch, that pressed a button and marked a lineup READY; on 2026-10-06 the step-3 captures found the
 * game-day console doing it with its own dim, a tap off Note or End game leaving the game for the
 * Schedule. A mouse passes that test every time; only touch shows it. The frame's boundary is its sheet,
 * its dim and its opener, so a tap on the dim closes cleanly through the dim's own `onClick`.
 *
 * ⚠ TWO LAYERS, SORTED BY ONE TEST (D1): would a stray tap on the bottom bar lose something?
 *   · No → the MENU layer (the default). On top of the bar, the bar lit and live, and NEVER modal: a screen
 *     reader held inside a sheet whose bar a thumb can still reach is told one thing while a sighted coach
 *     is shown another — and the Ledgers' Filter sheet has no close button to leave by.
 *   · Yes → the FORM layer (`form`). Down over the bar, the dim over the bar too, and the bar taken out of
 *     reach of the thumb, the keyboard AND the screen reader (`useOverlayOpenIfAvailable` — the nav goes
 *     `visibility: hidden`; covering a nav is not taking it away, the 2026-09-23 lesson). Modal, and it
 *     keeps the keyboard inside. A form owes its caller's head a 44px × (D2) — the frame cannot see the
 *     head, so `sheet-frame-guard` checks every form consumer for one.
 *   The layer may change while the sheet is open — the Award sheet's switch (D3), and the game day's
 *   Scouting while an observation is being typed. Hand the layer a value, not a fixed flag.
 *
 * ⚠ OVER A WINDOW (`overWindow`, step 4, 2026-10-06). A sheet opened from inside a full-screen window —
 * a player's RSVP over the event window, the depth chart's row menu over its player — has no bar under
 * it to sort by: the window already took it. It sits at the SCREEN'S foot, above the window (410, over
 * `.modalOverlay`'s 400), its dim over everything, and it registers no overlay of its own (the window
 * holds the lock). The layer still says what it is: RSVP is a form there (it is a sibling of a MODAL
 * window, so it must be modal itself, or the keyboard walks out behind both); the row menu, inside its
 * window's own DOM, stays a menu.
 *
 * ⚠⚠ THE FRAME ANSWERS THE KEYS FOR EVERY SHEET (Sheet Frame step 5, 2026-10-06). It stands the dialog
 * floor whatever the layer: Escape and the phone's Back close the sheet, focus moves into it when it opens
 * and goes home to `opener` however it closes. The layer decides only the HOLD on the keyboard: a form
 * keeps Tab inside; a menu lets Tab past its last control close it (the owner's ruling for the menu layer,
 * 2026-10-06), as the Tools menu's Tab does, rather than walking under the dim. In the menu layer a
 * pointer-down outside the sheet, its dim and its opener — a tap on the bar — closes it first, before the
 * bar acts (More opened over a sheet still standing left two up at once). The opener is inside that
 * boundary so the button that opened a menu stays a toggle: a second tap closes it, never closes and
 * reopens it.
 *   Until step 5 a sheet with a trigger of its own (Tools, Filter, the switchers, game day, the row menus)
 *   answered its own keys with `useDismissable`, and Tools, Filter and the switchers stood NO back step:
 *   on a phone, Back with one open left the page (measured on all seven, 2026-10-06). A caller must not
 *   answer them again — no dismiss hook, no back step for the sheet — or Escape closes twice and Back pops
 *   two history entries for one sheet. Its own card or popover above the bar's breakpoint keeps its own.
 *
 * ⚠ THE FLOOR STANDS ONE HISTORY ENTRY (`useBackStep`, inside `useDialogFloor`). A sheet switching layer
 * keeps it: one floor stands in both layers and only its hold changes. A sheet that hands off to another
 * in one commit (Tools › Copy from) costs no history either — the new step takes the closing one's entry
 * over. ⚠ A button inside a sheet that LEAVES THE PAGE must be a link (`a[href]`): the back step knows a
 * link click left the page and keeps its entry for the navigation; a `router.push` from a button is not
 * seen, and the step's own `history.back()` cancels it (the §258 failure). The two Tools items that did
 * so became links in step 5.
 *
 * ⚠ THE SHEET MARKS ITSELF `data-escape-owner`. A floor the sheet opens over — a window, a block editor —
 * hears the same Escape from inside its panel and would close too; the marker makes it yield, and the
 * floor reads a marker on its OWN panel as its own claim (`useDialogFloor`).
 *
 * The props type omits `aria-modal`, but TypeScript does not check a HYPHENATED attribute a props type
 * leaves out, so a caller could still pass it — the sheet sets it AFTER the spread, from the layer, which
 * is what actually decides it (/review 2026-10-05).
 *
 * ⚠ The props omit `className` and `style` too: the frame IS the sheet's surface (the stylesheet says why a
 * second class would be settled by bundle order), and a caller's inline geometry is the drift this
 * component exists to stop. A sheet's own inset is its CONTENT's: a body wrapper inside.
 *
 * `opener` is required because it is the contract every sheet owes (plan: "focus returns to what opened
 * it") — the step-2 captures found three of five sheets had written the close and forgotten the hand-back.
 * Name it from the tap (`e.currentTarget`): iOS Safari does not focus a tapped button, so nothing else
 * knows what opened the sheet.
 */
export default function SheetFrame({
  label, onClose, opener, form = false, busy = false, overWindow = false, grabCloses = false, full = false, ref, children, ...sheet
}: Omit<HTMLAttributes<HTMLDivElement>, 'aria-modal' | 'className' | 'style' | 'children'> & {
  /** The menu label (D2): small capitals at the head, because the dim hides the row that opened it. */
  label?: string;
  /** Close the sheet: a tap on the dim or outside it, Escape, the phone's Back. The frame returns focus. */
  onClose: () => void;
  /** What opened the sheet — where focus goes back after it closes, and part of the "tap outside" boundary. */
  opener: RefObject<HTMLElement | null>;
  /** The FORM layer (D1): over the bar, the bar out of reach, modal, the keyboard kept inside. */
  form?: boolean;
  /** A write is in flight — the dim, a tap outside, Escape and Back wait for it. */
  busy?: boolean;
  /** Opened from inside a full-screen window: at the screen's foot, above the window, its dim over all. */
  overWindow?: boolean;
  /** The grab line is a 44px Close button — a record head's own way out (D3 keeps it). */
  grabCloses?: boolean;
  /** On a phone (≤640) the sheet fills the screen above the bar — Copy from's list (2026-10-02 D7, kept by D3). */
  full?: boolean;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  // The floor needs the panel, and so do its callers: the Tools menu roves its items and Filter, the two
  // switchers and the row menus seat focus in it on open — so the frame keeps its own ref and forwards the caller's.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const setPanel = useCallback((el: HTMLDivElement | null) => {
    panelRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }, [ref]);
  // Tolerant: the Tools menu's frame also renders on admin pages, outside the portal's overlay provider.
  // Over a window, the window already took the bar.
  useOverlayOpenIfAvailable(form && !overWindow);
  useDialogFloor(true, panelRef, { onClose, busy, opener, trap: form });
  // A tap on the dim or past a menu, never while a write is in flight. The floor hands focus home as the sheet
  // unmounts, however it closed.
  const close = () => { if (!busy) onClose(); };
  // A form's dim covers the bar, so only a menu can be tapped past. The pointer half of `useDismissable`: the
  // floor owns Escape.
  usePointerOutside(!form, [panelRef, dimRef, opener], close);
  const layer = `${form ? ` ${styles.form}` : ''}${overWindow ? ` ${styles.overWindow}` : ''}`;
  return (
    <>
      <div ref={dimRef} className={`${styles.dim}${layer}`} aria-hidden="true" onClick={close} />
      <div
        ref={setPanel}
        className={`${styles.sheet}${layer}${grabCloses ? ` ${styles.grabCloses}` : ''}${full ? ` ${styles.full}` : ''}`}
        tabIndex={-1}
        {...sheet}
        data-escape-owner=""
        aria-modal={form || undefined}
      >
        {grabCloses && (
          <button type="button" className={styles.grab} aria-label="Close" onClick={close}>
            <span aria-hidden />
          </button>
        )}
        {label && <SheetLabel>{label}</SheetLabel>}
        {children}
      </div>
    </>
  );
}

/**
 * The menu LABEL (D2) on its own, for a menu that is not a sheet at the width it is drawn at — the lineup
 * builder's Print popover on a computer (Sheet Frame step 2, 2026-10-05; on a phone Print is on the frame,
 * which draws the same label). One head, one home: wear this rather than copying the small capitals into
 * a second stylesheet. Shown at every width it is rendered at.
 */
export function SheetLabel({ children }: { children: ReactNode }) {
  return <div className={styles.label}>{children}</div>;
}
