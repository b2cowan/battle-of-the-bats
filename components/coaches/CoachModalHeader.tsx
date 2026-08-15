'use client';
import type { ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * Shared modal header: back arrow (mobile-only, base CSS hides it above 640px) + title + X-close.
 * Every coaches-portal modal opened this same three-piece row by hand; this is the single copy.
 * `closeIconSize`/`titleTag` exist only so the two pre-existing call sites that used a slightly
 * different icon size / heading level keep rendering exactly as before — new adopters can ignore
 * both and get the shared defaults (X size 16, <h3>).
 *
 * SHEET modals only. Do not pair this with a `.centeredOnMobile` overlay: centered dialogs keep
 * the pre-flip X-only header (the @640 CSS guards ensure the X survives, but the back arrow would
 * be dead weight in the DOM) — centered dialogs hand-roll their simple title+X row instead.
 */
export default function CoachModalHeader({
  title,
  subtitle,
  onClose,
  children,
  titleTag: TitleTag = 'h3',
  closeIconSize = 16,
  closeAriaLabel,
}: {
  title: ReactNode;
  /**
   * One short line under the title saying what this form records. For the modal PAIRS a coach
   * picks between (Add Expense vs Add Payable) — not a general description slot; a modal that
   * needs a paragraph puts it in the form body.
   */
  subtitle?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  titleTag?: 'h2' | 'h3';
  closeIconSize?: number;
  closeAriaLabel?: string;
}) {
  return (
    <div className={`${styles.modalHeader} ${subtitle ? styles.modalHeaderStacked : ''}`}>
      <button className={styles.modalBackBtn} aria-label="Back" onClick={onClose}><ArrowLeft size={20} /></button>
      {/* The title keeps its own element when there is no subtitle, so every existing caller's
          markup is byte-identical to before; only the two-line form gets a wrapper. */}
      {subtitle ? (
        <div>
          <TitleTag className={styles.modalTitle}>{title}</TitleTag>
          <p className={styles.modalSubtitle}>{subtitle}</p>
        </div>
      ) : (
        <TitleTag className={styles.modalTitle}>{title}</TitleTag>
      )}
      {children}
      <button className={styles.modalCloseBtn} aria-label={closeAriaLabel} onClick={onClose}><X size={closeIconSize} /></button>
    </div>
  );
}
