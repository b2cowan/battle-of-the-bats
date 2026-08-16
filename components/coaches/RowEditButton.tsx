'use client';
import { Pencil, Eye } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Open this record" — the one row-level affordance for that job in the coaches portal.
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
  title,
  onPhone = 'label',
  mode = 'edit',
}: {
  /** What this opens, as a screen reader will read it — e.g. `Edit Team pizza night`. */
  label: string;
  onClick: () => void;
  title?: string;
  /**
   * Whether the record behind this row can still be changed.
   *
   * - `'edit'` (default) — a pencil. The row opens a form the coach can save.
   * - `'view'` — an eye. The row opens the same record read-only, because something has happened
   *   to it that a coach may not undo (Payment Requests: the club has approved or declined it).
   *
   * ⚠ IT LIVES HERE RATHER THAN AS A SECOND COMPONENT because the two states appear IN THE SAME
   * COLUMN OF THE SAME TABLE, one row apart, and the icon is the only thing telling a coach which
   * they'll get before they tap. Two components would be two places for that column to drift —
   * which is the exact failure this component was extracted to end.
   */
  mode?: 'edit' | 'view';
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
  const isView = mode === 'view';
  const Icon = isView ? Eye : Pencil;
  return (
    <button
      type="button"
      className={`${styles.rowEditBtn} ${onPhone === 'clip' ? styles.rowEditBtnClip : ''}`}
      title={title ?? (isView ? 'View' : 'Edit')}
      aria-label={label}
      // Stops the row's own click handler firing a second time behind this one.
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      <Icon size={13} aria-hidden />
      {onPhone === 'label' && <span className={styles.cardActionLabel}>{isView ? 'View' : 'Edit'}</span>}
    </button>
  );
}
