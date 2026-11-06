'use client';

import { ExternalLink } from 'lucide-react';
import { feeLineFor, type FeesRead } from '@/lib/fee-invoice-line';
import styles from './Billing.module.css';

/**
 * The ONE line at the top of Plan & billing while the club owes FieldLogicHQ a fee invoice (Fee invoice alerts Part 3, owner
 * drawings 2026-11-05, asks 4 and 6). The white callout the page already uses for waits: amber edge while the invoice is open and
 * not yet due, red once overdue. One invoice names itself, its day and its total and carries Pay invoice (a new tab, as in the
 * list); two or more say how many and point at the list, which has a Pay invoice on each. Absent when nothing is owed, and in the
 * coaches portal (its read has no fee invoices). Owner only because the page and the read behind it are. Words:
 * `STRIPE_FEE_WORDS.alert*`; the figure is the invoice's own total, never added up here.
 */
export default function FeeInvoiceLine({ read }: { read: FeesRead | null }) {
  const line = feeLineFor(read);
  if (!line) return null;
  const { action } = line;
  return (
    <div className={`${styles.waitCallout} ${styles.lineBar}${line.tone === 'red' ? ` ${styles.calloutDanger}` : ''}`} role="status" id="billing-fee-line">
      <p className={styles.lineText}><strong>{line.lead}</strong>{line.detail && <> {line.detail}</>}</p>
      {action.kind === 'pay'
        ? <a className={`btn btn-lime ${styles.lineButton}`} href={action.href} target="_blank" rel="noopener noreferrer" aria-label={action.aria}>
            {action.label}<ExternalLink size={13} aria-hidden />
          </a>
        : <button type="button" className={`btn btn-outline ${styles.lineButton}`} aria-label={action.aria} onClick={seeInvoices}>{action.label}</button>}
    </div>
  );
}

/** Takes the owner to the list below, which has a Pay invoice on each invoice, and moves keyboard focus to its heading. */
function seeInvoices() {
  const heading = document.getElementById('billing-stripe-fees');
  if (!heading) return;
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  heading.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  heading.focus({ preventScroll: true });
}
