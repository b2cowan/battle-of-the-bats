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
 */
export default function LineupSheetScrim({ onClose }: { onClose: () => void }) {
  return <div className={styles.lineupSheetScrim} aria-hidden="true" onClick={onClose} />;
}
