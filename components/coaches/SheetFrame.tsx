'use client';
import { useCallback, useRef, type HTMLAttributes, type ReactNode, type Ref, type RefObject } from 'react';
import { rescueFocusTo, usePointerOutside } from '@/lib/overlay-hooks';
import { useOverlayOpenIfAvailable } from '@/lib/coaches-overlay';
import { useDialogFloor } from './useDialogFloor';
import styles from './SheetFrame.module.css';

/**
 * ONE FRAME FOR THE PORTAL'S PHONE SHEETS (Sheet Frame, owner rulings D1–D6, 2026-10-05 — plan
 * docs/projects/active/SHEET_FRAME_PLAN.md, the geometry and its reasons in `SheetFrame.module.css`).
 * The dim and the sheet come together, so neither can be rendered without the other.
 *
 * ⚠⚠ RENDER IT INSIDE THE ELEMENT YOUR DISMISS HOOK WATCHES. The dim is what a tap off the sheet lands
 * on. Outside `useDismissable`'s boundary, the hook's `pointerdown` fires first, unmounts the sheet, and
 * the `click` that follows lands on whatever the dim was covering — on 2026-09-22, under touch, that
 * pressed a button and marked a lineup READY (see `CoachToolbarMenu`'s `drawerOnPhone`); on 2026-10-06 the
 * step-3 captures found the game-day console doing it with its own dim, a tap off Note or End game
 * leaving the game for the Schedule. A mouse passes that test every time; only touch shows it. Inside the
 * boundary the hook reads the tap as "inside" and the dim's own `onClose` closes cleanly.
 *
 * ⚠ TWO LAYERS, SORTED BY ONE TEST (D1): would a stray tap on the bottom bar lose something?
 *   · No → the MENU layer (the default). On top of the bar, the bar lit and live, and NEVER modal: a screen
 *     reader held inside a sheet whose bar a thumb can still reach is told one thing while a sighted coach
 *     is shown another — and the Ledgers' Filter sheet has no close button to leave by.
 *   · Yes → the FORM layer (`form`). Down over the bar, the dim over the bar too, and the bar taken out of
 *     reach of the thumb, the keyboard AND the screen reader (`useOverlayOpenIfAvailable` — the nav goes
 *     `visibility: hidden`; covering a nav is not taking it away, the 2026-09-23 lesson). Modal, and it
 *     keeps the keyboard inside (`useDialogFloor`: Tab trapped, Escape and the phone's Back close it, focus
 *     goes back to `opener`). A form owes its caller's head a 44px × (D2) — the frame cannot see the head,
 *     so `sheet-frame-guard` checks every form consumer for one.
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
 * ⚠ WHO ANSWERS THE KEYS. In the form layer, always the frame (the floor). In the menu layer, by default
 * the CALLER: the Tools menu, the Filter sheet, the switchers and game day each have a trigger that
 * toggles the sheet (and a popover or a card wider), so their dismiss hook watches the trigger AND the
 * sheet. A sheet with no trigger of its own — a RECORD sheet, opened from a row the dim then covers —
 * passes `ownsKeys` (step 4, owner 2026-10-06): the frame stands the floor WITHOUT ITS TRAP (Escape, the
 * phone's Back, focus in on open and home to `opener`; Tab past the last control closes it, as the Tools
 * menu's Tab does, rather than walking under the dim) and closes it on a tap on the bar, before the bar
 * acts — the bar is live under a menu, and More opened over a sheet still standing left two up at once.
 * Never modal. That is the owner's ruling for the menu layer's keys: what the old floor gave a record
 * sheet stays, the hold on the keyboard and the modal claim go.
 *
 * ⚠ THE FLOOR ALSO STANDS ONE HISTORY ENTRY (`useBackStep`, inside `useDialogFloor`). A caller with its
 * own back step must stand it down while its sheet is in the form layer, or Back pops two entries for one
 * sheet. A sheet switching layer hands the entry over in one commit (`useBackStep` takes a dead entry
 * over), so the switch costs no history — and with `ownsKeys` there is nothing to hand over: one floor
 * stands in both layers and only its trap changes.
 *
 * The props type omits `aria-modal`, but TypeScript does not check a HYPHENATED attribute a props type
 * leaves out, so a caller could still pass it — the sheet sets it AFTER the spread, from the layer, which
 * is what actually decides it (/review 2026-10-05).
 *
 * ⚠ The props omit `className` and `style` too: the frame IS the sheet's surface (the stylesheet says why a
 * second class would be settled by bundle order), and a caller's inline geometry is the drift this
 * component exists to stop. A record sheet's own inset is its CONTENT's: a body wrapper inside.
 *
 * The DIM is the frame's, so its answer to "and then where?" is the frame's too: a tap on it blurs
 * whatever held focus, and the frame hands focus back to `opener` when nothing else took it. It is a
 * required prop because it is the contract every sheet owes (plan: "focus returns to what opened it") —
 * the step-2 captures found three of five sheets had written the close and forgotten the hand-back. The
 * floor keeps the same contract wherever it stands.
 */
export default function SheetFrame({
  label, onClose, opener, form = false, busy = false, ownsKeys = false, overWindow = false, grabCloses = false, ref, children, ...sheet
}: Omit<HTMLAttributes<HTMLDivElement>, 'aria-modal' | 'className' | 'style' | 'children'> & {
  /** The menu label (D2): small capitals at the head, because the dim hides the row that opened it. */
  label?: string;
  /** Close the sheet: a tap on the dim, and — wherever the floor stands — Escape and the phone's Back. The
   *  frame returns focus afterwards. */
  onClose: () => void;
  /** What opened the sheet — where focus goes back after it closes. Read when the hand-back runs. */
  opener: RefObject<HTMLElement | null>;
  /** The FORM layer (D1): over the bar, the bar out of reach, modal, the keyboard kept inside. */
  form?: boolean;
  /** A write is in flight — the dim, Escape and Back wait for it (the floor's busy gate). */
  busy?: boolean;
  /** Menu layer: the frame answers Escape, Back and a tap on the bar — a sheet with no trigger of its own.
   *  Temporary by design: when step 5 gives the frame every consumer's dismiss and Back (a trigger joining
   *  the boundary), the floor always stands and this flag goes — `trap: form` is then the only choice left. */
  ownsKeys?: boolean;
  /** Opened from inside a full-screen window: at the screen's foot, above the window, its dim over all. */
  overWindow?: boolean;
  /** The grab line is a 44px Close button — a record head's own way out (D3 keeps it). */
  grabCloses?: boolean;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  // The floor needs the panel, and so do its callers: the Tools menu roves its items and Filter and the two
  // switchers seat focus in it on open — so the frame keeps its own ref and forwards the caller's.
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
  const floor = form || ownsKeys;
  useDialogFloor(floor, panelRef, { onClose, busy, opener, trap: form });
  // A tap on the bar under a menu the frame owns closes it first. The dim and the sheet are the boundary — a
  // dim counted as outside lets the tap fall through. The pointer half of `useDismissable`: the floor owns Escape.
  usePointerOutside(Boolean(ownsKeys) && !form, [panelRef, dimRef], () => { if (!busy) onClose(); });
  const closeToOpener = () => {
    if (busy) return;
    onClose();
    rescueFocusTo(opener);
  };
  const layer = `${form ? ` ${styles.form}` : ''}${overWindow ? ` ${styles.overWindow}` : ''}`;
  return (
    <>
      <div ref={dimRef} className={`${styles.dim}${layer}`} aria-hidden="true" onClick={closeToOpener} />
      <div
        ref={setPanel}
        className={`${styles.sheet}${layer}${grabCloses ? ` ${styles.grabCloses}` : ''}`}
        tabIndex={floor ? -1 : undefined}
        {...sheet}
        aria-modal={form || undefined}
      >
        {grabCloses && (
          <button type="button" className={styles.grab} aria-label="Close" onClick={closeToOpener}>
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
 * The menu LABEL (D2) on its own, for a menu-layer sheet that does not wear the frame YET — the lineup
 * builder's Print panel, whose container is shared with its desktop popover and moves with the builder's
 * other drawers in step 5 (Sheet Frame step 2, 2026-10-05). One head, one home: wear this rather than
 * copying the small capitals into a second stylesheet. Shown at every width it is rendered at.
 */
export function SheetLabel({ children }: { children: ReactNode }) {
  return <div className={styles.label}>{children}</div>;
}
