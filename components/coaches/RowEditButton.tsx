'use client';
import { Pencil } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Open this record to edit it" — the one row-level edit affordance in the coaches portal.
 *
 * Owner ruling 2026-08-15. A survey of the Money hub found five different idioms doing this job
 * (pencil, bare chevron, chevron+label, plain text button, and an icon-only pencil next to an
 * unstyled trash) with no recorded rule to choose between them. Budget Plan's pencil won because
 * it was already the clearest statement of intent; this is that button, extracted so the next
 * surface adopts it instead of inventing a sixth.
 *
 * ⚠ IT IS A COMPONENT AND NOT JUST A CLASS ON PURPOSE. A shared class stops the styling drifting;
 * it does not stop the MARKUP drifting, and the markup is where this control actually went wrong —
 * the same survey found row buttons shipping with no accessible name at all. An icon-only button's
 * name is invisible by definition, so `label` is required here and there is no way to render one
 * without it.
 *
 * Pair it with `styles.rowTappable` on the row and an onClick that ignores text selections.
 *
 * ⚠ On a phone this is a LABELLED button, not a hidden one. The `.cardActionLabel` span shows only
 * at the card breakpoint — the same mechanism "Payment details" uses one cell over — so the control
 * reads as icon-only on a desktop and icon + "Edit" once the row stacks. An earlier draft borrowed
 * Budget Plan's clip-to-zero treatment instead and produced 30px of sideways page scroll; see the
 * note on `.rowEditBtn` in coaches.module.css for why the two idioms are not interchangeable.
 */
export default function RowEditButton({
  label,
  onClick,
  title = 'Edit',
  onPhone = 'label',
}: {
  /** What this edits, as a screen reader will read it — e.g. `Edit Team pizza night`. */
  label: string;
  onClick: () => void;
  title?: string;
  /**
   * What happens to this button at the phone breakpoint. The row is the visible door either way;
   * the difference is what the surrounding table does, and there are exactly two answers:
   *
   * - `'label'` (default) — a LIST TABLE that stacks into cards. The button becomes a full-width
   *   control at the foot of the card with the word "Edit" beside the pencil, matching every other
   *   trailing control there ("Payment details", "Mark Paid").
   * - `'clip'` — a LEDGER GRID, which does not stack. The pencil leaves the layout so rows read
   *   clean and the money column reaches the edge (owner ruling on Budget Plan), but stays
   *   focusable so a keyboard or screen reader still has a real, named control.
   *
   * ⚠ Not interchangeable, and picking the wrong one is not cosmetic: `'clip'` inside a card table
   * produced 30px of sideways page scroll (2026-08-15), because the card rules stretch a trailing
   * button to full width and a clipped button has nothing to be full width *of*.
   */
  onPhone?: 'label' | 'clip';
}) {
  return (
    <button
      type="button"
      className={`${styles.rowEditBtn} ${onPhone === 'clip' ? styles.rowEditBtnClip : ''}`}
      title={title}
      aria-label={label}
      // Stops the row's own click handler firing a second time behind this one.
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      <Pencil size={13} aria-hidden />
      {onPhone === 'label' && <span className={styles.cardActionLabel}>Edit</span>}
    </button>
  );
}
