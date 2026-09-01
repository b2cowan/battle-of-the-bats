'use client';
/**
 * The band family's shared ROW primitives — the pieces SponsorBand and DriveBand had each
 * hand-copied (/simplify, reuse + altitude lenses, 2026-09-01): a full-width message row (a load
 * failure, a refused act, "Loading…", a state sentence) and the doors row (Record · Edit).
 *
 * ⚠⚠ THE COLUMN COUNT IS THE INVARIANT, AND THIS IS ITS ONE HOME. An expansion is SIBLING ROWS of
 * the parent table, never a table inside it (the §122 alignment lesson): every spanning row must
 * cover exactly the parent's columns, or the table silently re-flows its widths. Both band tables
 * are six columns wide — each table's <thead> is the other half of that promise, so a band that
 * grows a column changes this constant AND its heading row together.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import styles from '../../../../coaches.module.css';

export const BAND_COL_COUNT = 6;

/** One full-width row under an open record. `error` draws the shared alert line (never silent —
 *  owner, §125 walk); `muted` is the quiet voice for "Loading…" and a lone state sentence. */
export function BandMessageRow({
  tone,
  children,
  style,
}: {
  tone: 'error' | 'muted';
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <tr className={styles.tr}>
      <td className={`${styles.td} ${styles.bandSubCell}`} colSpan={BAND_COL_COUNT} style={style}>
        {tone === 'error'
          ? <p className={styles.errorText} role="alert" style={{ margin: 0 }}>{children}</p>
          : <p className={styles.mutedInline} style={{ margin: 0, fontSize: '0.8rem' }}>{children}</p>}
      </td>
    </tr>
  );
}

/** The two doors that close an open record: Record (the ONE recording conversation, locked to
 *  this record) and Edit (its sheet). `onRecord` null = no Record door — a closed drive, or a
 *  mount with no conversation to open. The clicks stop at the row so the toggle above never
 *  hears them. */
export function BandDoorsRow({
  onRecord,
  onEdit,
}: {
  onRecord: (() => void) | null;
  onEdit: () => void;
}) {
  return (
    <tr className={styles.tr}>
      <td className={`${styles.td} ${styles.bandSubCell}`} colSpan={BAND_COL_COUNT}>
        {/* `block640` on both: this row sits OUTSIDE the card-mode rule that gives a row's trailing
            control its 44px on a phone (`.cardActionCell > button`), so without it the doors
            measured 33px at 361 — the rendered sweep caught it (2026-09-01). At ≤640 they share
            the row at full touch height; above it, the portal's compact desktop sizes stand. */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onRecord && (
            <button className={`${styles.btnPrimary} ${styles.block640}`} onClick={e => { e.stopPropagation(); onRecord(); }}>
              Record
            </button>
          )}
          <button className={`${styles.btnSecondary} ${styles.block640}`} onClick={e => { e.stopPropagation(); onEdit(); }}>
            <Pencil size={14} aria-hidden /> Edit
          </button>
        </div>
      </td>
    </tr>
  );
}
