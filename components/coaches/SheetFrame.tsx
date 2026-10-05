'use client';
import type { HTMLAttributes, ReactNode, Ref, RefObject } from 'react';
import { rescueFocusTo } from '@/lib/overlay-hooks';
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
 * Escape and a click elsewhere stay with the caller, whose dismiss boundary holds its trigger as well as this
 * sheet. The DIM is the frame's, so its answer to "and then where?" is the frame's too: a tap on it blurs
 * whatever held focus, and the frame hands focus back to `opener` when nothing else took it. It is a
 * required prop because it is the contract every sheet owes (plan: "focus returns to what opened it") — the
 * step-2 captures found three of five sheets had written the close and forgotten the hand-back.
 */
export default function SheetFrame({ label, onClose, opener, ref, children, ...sheet }: Omit<HTMLAttributes<HTMLDivElement>, 'aria-modal' | 'className' | 'style' | 'children'> & {
  /** The menu label (D2): small capitals at the head, because the dim hides the row that opened it. */
  label?: string;
  /** A tap on the dim: close the sheet. The frame returns focus afterwards. */
  onClose: () => void;
  /** What opened the sheet — where focus goes back after a tap on the dim. Read when the net runs. */
  opener: RefObject<HTMLElement | null>;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <>
      <LineupSheetScrim onClose={() => { onClose(); rescueFocusTo(opener); }} />
      <div ref={ref} className={styles.sheet} {...sheet} aria-modal={undefined}>
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
