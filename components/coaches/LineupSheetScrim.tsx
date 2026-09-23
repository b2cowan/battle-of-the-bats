'use client';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * THE DIM BEHIND A BUILDER DRAWER (stage 3 · D12/D13, owner 2026-09-22). The lineup builder's four
 * phone overlays — Setup, Templates, Print, the player row menu — each raise one of these behind
 * themselves: a tap anywhere off the drawer closes it, and the page dims so the surface reads as
 * owning the screen instead of hovering over it. It stops at the BAR'S top, so the nav is never
 * dimmed, the same choice `.sheetScrim` makes for the portal's other four sheets.
 *
 * ⚠ It renders nothing above 900 — the class is `display: none` until the bottom nav exists — so no
 * call site needs a width branch of its own, and the desktop keeps its popovers undimmed.
 *
 * ⚠ ONE COMPONENT BECAUSE FIVE CALL SITES IS WHERE A COPIED `<div>` STARTS DRIFTING. The five were
 * identical but for their closer, and the FIRST thing that drifted in this family was the scrim's
 * colour: it was written flat black while the portal's other sheets remap to warm, so on the warm
 * theme — the DEFAULT — two drawers on one screen dimmed the page differently. The colour lives in
 * the stylesheet with its warm remap beside it; this exists so the markup cannot be the next thing
 * to diverge (a missed `aria-hidden`, a sixth spelling of the class).
 *
 * ⚠⚠ `overNav` IS THE RULING OF 2026-09-23, AND IT TRAVELS WITH ITS DRAWER OR NOTHING WORKS.
 * A FORM covers the bottom nav; a MENU sits on top of it (the reasoning is at
 * `.lineupDrawerOverNav` in `coaches.module.css`, which is the rule's one home). The drawer and
 * its scrim have to agree: a raised drawer over a scrim that still stops at the bar's top leaves
 * the nav LIT and TAPPABLE in front of the dim — the exact mixed signal the ruling removes. Pass
 * it to both, or to neither.
 */
export default function LineupSheetScrim({ onClose, overNav }: { onClose: () => void; overNav?: boolean }) {
  // ⚠ The class is spelled ONCE here and nowhere else in the app — the guard counts it.
  const className = styles.lineupSheetScrim + (overNav ? ` ${styles.lineupDrawerOverNav}` : '');
  return <div className={className} aria-hidden="true" onClick={onClose} />;
}
