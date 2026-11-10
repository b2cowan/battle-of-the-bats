'use client';

import { PLAN_LINE_WORDS as L } from '@/lib/legal-acceptance-rules';
import { useLegalLinks } from './LegalLinksProvider';
import { LinkedLine } from './TermsTickRow';
import styles from './PlanTermsLine.module.css';

/**
 * THE LINE BESIDE A PAID BUTTON (GST/HST Stage 6 step 6.3, Chunk C; §20 (3), drawing tab 5, Ask 6A). "Your plan renews
 * automatically until you cancel…", with the trial sentence first where the screen already says a trial applies.
 *
 * The CALLER decides whether a price is shown: render this only beside a button that shows one (§20 note 3 — a comped or
 * Founding Season button carries no line). Renders NOTHING while the legal pages are off — dark means invisible.
 *
 *   · `place="body"` (default) — a window's body end, or under a table straight after its tax line.
 *   · `place="column"` — an account column, above the main button, at the column's fine-print size.
 *   · `trial` — `'known'`: this purchase starts a trial (the screen says so); a NUMBER: the plan's own trial days, where checkout
 *     decides — above zero it reads "If your plan starts with a trial…" (`/legal` 2026-11-09 — a first subscription only);
 *     absent or 0: no trial sentence.
 */
const LINE_PARTS = [L.lead, L.terms, L.end] as const;

export default function PlanTermsLine({ trial, place = 'body' }: { trial?: 'known' | number; place?: 'body' | 'column' }) {
  const links = useLegalLinks();
  if (!links) return null;
  return (
    <p className={place === 'column' ? styles.column : styles.line} data-plan-terms-line="">
      {trial === 'known' ? L.trial : trial ? L.trialMaybe : null}
      <LinkedLine parts={LINE_PARTS} />
    </p>
  );
}
