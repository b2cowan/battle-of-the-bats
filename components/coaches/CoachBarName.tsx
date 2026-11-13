'use client';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useCoachDeskTitle } from '@/components/coaches/CoachDeskTitle';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * ⚖ THE PHONE'S BAR NAMES THE PLACE YOU ARE IN (owner, 2026-11-12: "the general rule for all of these screens is the arrow is the
 * only thing representing back and the bar always names the place you are in. I can't think of a reason for an exception").
 * One level down — a game's lineup, a player, a practice plan, an opponent — the team bar's first line is the RECORD'S name
 * ("vs Westbrook"), not the list it came from; the arrow beside it is the only way back (the destination is its spoken name).
 * The strip does the same on a computer (`recordSlot`, "← │ vs Westbrook").
 *
 * A PORTAL, as the strip's is: the title stays the page's own element — a live-typed name, the player's switcher BUTTON (its ref and
 * its sheet's state live in the page) — and nothing is copied through state. The bar draws an empty slot (`barSlot`) and, until a
 * page fills it, the KIND of place from the address ("Lineup", `coachDrillBack().here`), so the first paint is never blank and
 * never names the place you left.
 *
 * `CoachPageHeader` renders this for every page that has one; a drill-in with no standard header (the game console) renders it
 * itself. It draws nothing at any other width, on any other address, or before the bar has mounted its slot — the header then
 * keeps its own title, so a page is never left unnamed.
 */
export function useCoachBarNameSlot(): HTMLElement | null {
  const { title: desk, barSlot } = useCoachDeskTitle();
  const phone = useIsPhoneNav();
  return phone && desk?.kind === 'back' ? barSlot : null;
}

/**
 * The strip's slot, one level down, on a computer — the mirror of the bar's: each answers only at the widths its bar shows, so the
 * page header never decides the chrome's split (navigation Phase 5b, /simplify 2026-11-12).
 */
export function useCoachRecordSlot(): HTMLElement | null {
  const { title: desk, recordSlot } = useCoachDeskTitle();
  const phone = useIsPhoneNav();
  return !phone && desk?.kind === 'back' ? recordSlot : null;
}

export default function CoachBarName({ title, chips }: { title: ReactNode; chips?: ReactNode }) {
  const slot = useCoachBarNameSlot();
  // A blank name (a first name cleared mid-edit) draws nothing, so the bar keeps its kind-of-place stand-in rather than an empty
  // heading that hides it (/review 2026-11-12).
  if (!slot || title == null || (typeof title === 'string' && !title.trim())) return null;
  return createPortal(
    <>
      <h1 className={styles.teamBarName}>{title}</h1>
      {chips}
    </>,
    slot,
  );
}
