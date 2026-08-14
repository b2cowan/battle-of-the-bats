'use client';

import type { ReactNode } from 'react';
import styles from './help.module.css';

/**
 * Scannable-format primitives for help content (format standard 2026-08-14 —
 * `.claude/commands/docs.md`). Content modules import these instead of hand-rolling
 * markup so every guide's steps/definitions/notes render identically in both the
 * full guide and the in-context drawer:
 *
 *   - HelpSteps / plain <li> children — numbered procedure ("how do I…")
 *   - HelpDefs + HelpDef            — term | meaning rows ("what does X mean")
 *   - HelpNote                      — the ONE tip/caution of a sub-topic (max one)
 *
 * These are presentation-only (no state, no handlers). The 'use client' directive
 * is LOAD-BEARING even so: the help page shells are SERVER components, and a
 * function component inside content ReactNode only crosses the server→client prop
 * seam as a client-module reference — remove the directive and every guide page
 * that renders a converted section crashes at request time (typecheck can't see
 * it). NOTE: HelpCallout is the page-embedded dismissible banner;
 * HelpNote is the inline, never-dismissed guide note — they are different tools.
 */

export function HelpSteps({ children }: { children: ReactNode }) {
  return <ol className={styles.helpSteps}>{children}</ol>;
}

export function HelpDefs({ children }: { children: ReactNode }) {
  return <dl className={styles.helpDefs}>{children}</dl>;
}

export function HelpDef({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.helpDefRow}>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function HelpNote({
  variant = 'tip',
  title,
  children,
}: {
  variant?: 'tip' | 'warning' | 'info';
  title?: string;
  children: ReactNode;
}) {
  const variantClass =
    variant === 'warning' ? styles.helpNoteWarning
    : variant === 'info' ? styles.helpNoteInfo
    : styles.helpNoteTip;
  return (
    <div className={`${styles.helpNote} ${variantClass}`}>
      {title && <p className={styles.helpNoteTitle}>{title}</p>}
      <div className={styles.helpNoteBody}>{children}</div>
    </div>
  );
}
