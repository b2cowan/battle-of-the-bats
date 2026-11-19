'use client';
import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { accountForm } from '@/components/auth/AccountForm';
import styles from './PlanStep.module.css';

/**
 * The pieces Run a tournament's plan step (`PlanStep`) and the paid doors' (`PaidPlanStep`) share word for word. Only
 * these: each step keeps its own cards, so neither door's plan step can change the other's by accident.
 */

/** A card's start button: the card that leads holds the one lime, the other is the white secondary. */
export function PlanStartButton({ lead, busy, starting, onClick, children }: {
  lead: boolean;
  /** Any start is under way: every button waits. */
  busy: boolean;
  /** This card's start is the one under way. */
  starting: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${lead ? accountForm.primary : accountForm.secondary} ${styles.start}`}
      onClick={onClick}
      disabled={busy}
      aria-busy={starting || undefined}
    >
      {starting ? 'Starting…' : children}
    </button>
  );
}

/** "Compare every plan": the pricing page, in a new tab, so the step stays where it is. */
export function ComparePlansLink() {
  return (
    <a href="/pricing" target="_blank" rel="noopener noreferrer" className={accountForm.footLink}>
      Compare every plan <ExternalLink size={14} strokeWidth={2} aria-hidden className={styles.external} />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
