'use client';
/**
 * ONE ROW OF TEAMS' "AT A GLANCE" CARD (Tournament admin redesign Stage 2, T1 — Q 6.1 ruled "reshape",
 * the /design review's D2–D4, D11, D12). A closed row of fact that EXPANDS IN PLACE (a down chevron —
 * Ask 8 ruling 3: right opens a place, down opens here), its detail on the paper tone under it
 * (§3.10.8). The three rows share it so they cannot drift: Registration health, Payments, Registration.
 */
import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from '../teams-admin.module.css';

export default function GlanceRow({ lead, title, caption, figure, figureBad = false, open, onToggle, children }: {
  /** The row's one lead mark (health's "78/100"). */
  lead?: ReactNode;
  title: ReactNode;
  caption?: ReactNode;
  /** The one figure the row exists to show ("$1,825 past due"). */
  figure?: ReactNode;
  /** Danger ink — ONLY for genuinely bad news (money past due), never a status. */
  figureBad?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <>
      <button type="button" className={styles.glanceRow} aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        {lead != null && <span className={styles.glanceLead}>{lead}</span>}
        <span className={styles.glanceMain}>
          <span className={styles.glanceTitle}>{title}</span>
          {caption != null && <span className={styles.glanceCaption}>{caption}</span>}
        </span>
        {figure != null && <span className={styles.glanceFigure} data-bad={figureBad || undefined}>{figure}</span>}
        <ChevronDown size={16} aria-hidden className={styles.glanceChevron} />
      </button>
      {open && <div id={bodyId} className={styles.glanceBody}>{children}</div>}
    </>
  );
}
