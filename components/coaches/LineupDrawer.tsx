'use client';
import type { HTMLAttributes, ReactNode, Ref, RefObject } from 'react';
import SheetFrame from '@/components/coaches/SheetFrame';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * ONE OF THE LINEUP BUILDER'S DRAWERS — Setup, Call up, Save as template, Copy from, Print (Sheet Frame step 5).
 * Wherever the bar shows (≤900) the body rides the portal's sheet frame, which answers its keys; above 900 it is
 * the builder's own popover (`.lineupAutoMenu`, or Setup's centred window), and the popover's keys stay the
 * CALLER's — each gated off at ≤900, so a drawer never has two answers to Escape. The name is said once here, so
 * the two widths cannot call one drawer two things.
 */
export default function LineupDrawer({
  label, onClose, opener, form, full, busy, id, ref, popover, bodyClassName, children,
}: {
  label: string;
  onClose: () => void;
  /** Where focus goes home when the sheet closes, and part of a menu sheet's "tap outside" boundary. */
  opener: RefObject<HTMLElement | null>;
  /** The frame's form layer (Setup, Call up, Save as template). */
  form?: boolean;
  /** The whole screen above the bar on a phone (Copy from). */
  full?: boolean;
  busy?: boolean;
  id?: string;
  /** The drawer's own element at either width — the sheet, or the popover. */
  ref?: Ref<HTMLDivElement>;
  /** The popover's own box beside `.lineupAutoMenu`, and whether it takes focus or is a modal window. */
  popover?: Pick<HTMLAttributes<HTMLDivElement>, 'className' | 'tabIndex' | 'aria-modal'>;
  /** Beside `.lineupSheetBody` on the frame (Copy from's full-screen column). */
  bodyClassName?: string;
  children: ReactNode;
}) {
  const isPhoneNav = useIsPhoneNav();
  if (isPhoneNav) {
    return (
      <SheetFrame ref={ref} form={form} full={full} busy={busy} id={id} role="dialog" aria-label={label} onClose={onClose} opener={opener}>
        <div className={bodyClassName ? `${shared.lineupSheetBody} ${bodyClassName}` : shared.lineupSheetBody}>{children}</div>
      </SheetFrame>
    );
  }
  const { className, ...attrs } = popover ?? {};
  return (
    <div ref={ref} id={id} {...attrs} className={className ? `${shared.lineupAutoMenu} ${className}` : shared.lineupAutoMenu} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}
