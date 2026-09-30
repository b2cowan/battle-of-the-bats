'use client';
/**
 * THE REDESIGNED TOURNAMENT SCREENS' SMALL SHARED PARTS (Tournament admin redesign Stage 2 — Teams and
 * Communications drew the same pieces and the first build wrote each twice, and the two copies had
 * already drifted). Tournament-area parts, not the admin kit: a block of a record opened in the kit's
 * form window, the plain worded button inside one, the drawing's 22px box, the title band's worded
 * button, and a caption's facts joined by the house dot.
 *
 *   <RecordSection title="Payment">…</RecordSection>        — a record's block: a hairline, its 16/700 heading
 *   screenParts.recordText · .recordActions · .plainButton   — its line of facts, its row of buttons
 *   screenParts.check22                                       — the product's checkbox at the drawing's 22px
 *   screenParts.headerButton · .headerButtonLabel             — worded at a desk, a 44px icon on a phone
 *   joinDots([...])                                          — "Jun 13 · On the site · Emailed to 18"
 */
import { Fragment, type ReactNode } from 'react';
import styles from './ScreenParts.module.css';

export { styles as screenParts };

/** A block of a record opened in the kit's form window: a hairline above, its heading inside. */
export function RecordSection({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.recordSection}>
      {title != null && <h3 className={styles.recordHeading}>{title}</h3>}
      {children}
    </div>
  );
}

/** A caption's facts joined by the house dot, skipping any that say nothing. */
export function joinDots(parts: ReactNode[]): ReactNode {
  return parts
    .filter(p => p !== null && p !== undefined && p !== false && p !== '')
    .map((p, i) => <Fragment key={i}>{i > 0 && ' · '}{p}</Fragment>);
}
