'use client';
import { useSectionArrival } from '@/components/coaches/useSectionArrival';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * A FLAT, deep-linkable page section — the card, the heading and the `?section=` arrival of
 * `CoachCollapseSection`, without the fold.
 *
 * ⚠ WHY THIS EXISTS (roster + player page review, hub F09, owner 2026-09-13): a tab is already a
 * grouping. A fold INSIDE a tab hides the thing the tab was opened for behind a second click — the
 * player page's Details tab was one accordion titled "Player" with nothing to fold against, and a
 * coach who chose Family & paperwork to check an allergy still had to open Safety. So the page's
 * tabs hold sections, not drawers. What the fold did well is kept: a real `<h3>` for AT outline
 * navigation, a right-aligned meta slot, and an arrival on `?section=<id>` that scrolls the section
 * into view and flashes it once (`useSectionArrival` — the one copy, shared with the fold).
 *
 * Use `CoachCollapseSection` where the coach's open/closed state is worth remembering (a settings
 * page, a room's shelves). Use this where the section IS the content of the tab.
 */
export default function CoachPageSection({
  sectionId,
  title,
  meta,
  children,
}: {
  /** Stable anchor for `?section=` deep links; also the element id. Omit for a card that is not
   *  an address (a transient form, a month group). */
  sectionId?: string;
  /** Omit when the tab's own name is the heading (the Skills & Goals tab holds one section). */
  title?: string;
  /** Right-aligned summary annotation (a rate, a count, a balance). */
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { ref, flash } = useSectionArrival<HTMLElement>(sectionId);
  return (
    <section
      ref={ref}
      id={sectionId}
      className={`${styles.pageSection}${flash ? ` ${styles.collapseFlash}` : ''}`}
      aria-labelledby={title && sectionId ? `${sectionId}-heading` : undefined}
    >
      {title && (
        <div className={styles.pageSectionHead}>
          <h3 id={sectionId ? `${sectionId}-heading` : undefined} className={styles.pageSectionTitle}>{title}</h3>
          {meta && <span className={styles.pageSectionMeta}>{meta}</span>}
        </div>
      )}
      <div className={`${styles.pageSectionBody}${title ? '' : ` ${styles.pageSectionBodyBare}`}`}>{children}</div>
    </section>
  );
}
