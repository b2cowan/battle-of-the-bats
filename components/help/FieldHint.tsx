import type { ReactNode } from 'react';
import styles from './help.module.css';

/**
 * Always-visible, muted one-or-two-sentence hint shown directly under a form
 * field's label. It is never a click target and never dismissible — it's a label
 * clarifier, not a nag. Associate it with its input via `aria-describedby={id}`
 * so screen readers announce it when the field gains focus.
 *
 * Use only on genuinely non-obvious controls — a hint must earn its place.
 */
export default function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className={styles.fieldHint}>
      {children}
    </p>
  );
}
