'use client';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import LineupSheetScrim from './LineupSheetScrim';
import styles from './SheetFrame.module.css';

/**
 * ONE FRAME FOR THE PORTAL'S PHONE SHEETS (Sheet Frame, owner rulings D1–D6, 2026-10-05 — plan
 * docs/projects/active/SHEET_FRAME_PLAN.md, the geometry and its reasons in `SheetFrame.module.css`).
 * The dim and the sheet come together, so neither can be rendered without the other.
 *
 * ⚠⚠ RENDER IT INSIDE THE ELEMENT YOUR DISMISS HOOK WATCHES. The dim is what a tap off the sheet lands
 * on. Outside `useDismissable`'s boundary, the hook's `pointerdown` fires first, unmounts the sheet, and
 * the `click` that follows lands on whatever the dim was covering — on 2026-09-22, under touch, that
 * pressed a button and marked a lineup READY (see `CoachToolbarMenu`'s `drawerOnPhone`). A mouse passes
 * that test every time; only touch shows it. Inside the boundary the hook reads the tap as "inside" and
 * the dim's own `onClose` closes cleanly.
 *
 * ⚠ THE MENU LAYER, AND THEREFORE NEVER MODAL (D1). A sheet that loses nothing to a stray tap on the bar
 * sits on top of the bar with the bar live, so it does not claim `aria-modal`: a screen reader held inside
 * a sheet whose bar a thumb can still reach is told one thing while a sighted coach is shown another —
 * and the Ledgers' Filter sheet has no close button to leave by. The props type omits `aria-modal`, but
 * TypeScript does not check a HYPHENATED attribute a props type leaves out, so a caller could still pass it
 * — the sheet sets it to `undefined` AFTER the spread, which is what actually keeps it off (/review
 * 2026-10-05). The FORM layer (over the bar, modal, the keyboard kept inside) arrives with its first
 * consumer, the game day's Note (step 3).
 *
 * ⚠ The props omit `className` and `style` too: the frame IS the sheet's surface (the stylesheet says why a
 * second class would be settled by bundle order), and a caller's inline geometry is the drift this
 * component exists to stop.
 *
 * The frame is PRESENTATION. Escape, a click elsewhere and where focus goes afterwards stay with the caller,
 * whose dismiss boundary holds its trigger as well as this sheet; `onClose` is the dim's tap — and it owes
 * the same answer to "and then where?" (hand focus back to the opener when nothing else took it).
 */
export default function SheetFrame({ label, onClose, ref, children, ...sheet }: Omit<HTMLAttributes<HTMLDivElement>, 'aria-modal' | 'className' | 'style' | 'children'> & {
  /** The menu label (D2): small capitals at the head, because the dim hides the row that opened it. */
  label?: string;
  /** A tap on the dim. */
  onClose: () => void;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <>
      <LineupSheetScrim onClose={onClose} />
      <div ref={ref} className={styles.sheet} {...sheet} aria-modal={undefined}>
        {label && <div className={styles.label}>{label}</div>}
        {children}
      </div>
    </>
  );
}
