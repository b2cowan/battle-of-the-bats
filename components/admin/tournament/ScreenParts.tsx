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
 *   <CheckRow checked onChange title caption />               — a TICKED row inside a row list (Stage 5's venue list)
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

/**
 * A titled checkbox choice — the composer's row (Stage 2's C2), lifted here when the reuse step drew the
 * same row (Stage 4, D2): the 22px box on a 44px line, a title, and one caption under it. Rows stack with
 * a hairline between them. ⚠ The composer still draws its rows from its own stylesheet; moving it onto
 * this part is owed (a measured change to a walked screen, not a drive-by).
 */
export function CheckChoice({ checked, onChange, title, caption, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  caption?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={styles.choice}>
      <input type="checkbox" className={styles.check22} checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className={styles.choiceText}>
        <b>{title}</b>
        {caption != null && <span>{caption}</span>}
      </span>
    </label>
  );
}

/**
 * A ROW THAT IS TICKED, inside the kit's row list (`ClubRowList inset` in a `ClubRowFrame`) — the ticked list the
 * New tournament window picks its venues from (Stage 5, E1; Add a venue too). Teams' Select many drew the same row in
 * its own stylesheet (Stage 2): the 22px box first, the title and its caption, the whole row the target, never tinted —
 * a chosen row is marked by its tick alone (standard §3.3). ⚠ Teams still draws its own copy: moving it onto this part
 * is owed (a walked screen). A row whose tick can't change (a venue already in the tournament) is `disabled`.
 */
export function CheckRow({ checked, onChange, title, caption, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  caption?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <li className={styles.checkRowItem} data-row-list-row>
      <label className={styles.checkRow} data-disabled={disabled || undefined}>
        <input type="checkbox" className={styles.check22} checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
        <span className={styles.checkRowMain}>
          <span className={styles.checkRowTitle}>{title}</span>
          {caption != null && <span className={styles.checkRowCaption}>{caption}</span>}
        </span>
      </label>
    </li>
  );
}

/** A caption's facts joined by the house dot, skipping any that say nothing. */
export function joinDots(parts: ReactNode[]): ReactNode {
  return parts
    .filter(p => p !== null && p !== undefined && p !== false && p !== '')
    .map((p, i) => <Fragment key={i}>{i > 0 && ' · '}{p}</Fragment>);
}
