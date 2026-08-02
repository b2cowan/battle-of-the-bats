'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * Collapsible, deep-linkable page section — the portal-styled adoption of admin
 * CollapsibleCard's behavior (D3/D4, owner-ratified 2026-08-01). Native <details> so
 * children STAY MOUNTED while collapsed (form state and timers survive), and a
 * `?section=<sectionId>` arrival opens the section, scrolls it into view and flashes it
 * once — the same orientation cue admin uses.
 *
 * Deliberately NOT the admin component: that one wears the dark 2px-radius terminal
 * skin; this one wears the portal's card idiom and warm-gated tokens.
 */
export default function CoachCollapseSection({
  sectionId,
  title,
  meta,
  defaultOpen = true,
  children,
}: {
  /** Stable anchor for `?section=` deep links; also the element id. */
  sectionId: string;
  title: string;
  /** Right-aligned summary annotation (a count, a status word). */
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [flash, setFlash] = useState(false);
  const targeted = searchParams.get('section') === sectionId;

  useEffect(() => {
    if (!targeted || !ref.current) return;
    setOpen(true);
    // Scroll after the open state paints so the section has its full height.
    const t = requestAnimationFrame(() => {
      // An explicit JS 'smooth' overrides the global reduced-motion CSS kill-switch
      // (CSSOM View), so honor the preference here directly (/review 2026-08-02).
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      ref.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      setFlash(true);
    });
    return () => cancelAnimationFrame(t);
  }, [targeted]);

  return (
    <details
      ref={ref}
      id={sectionId}
      className={`${styles.collapseSection}${flash ? ` ${styles.collapseFlash}` : ''}`}
      open={open}
      onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className={styles.collapseSummary}>
        {/* A real heading: six collapsible sections organizing a page's primary content is
            exactly where heading-based AT navigation matters (/review 2026-08-02). */}
        <h3 className={styles.collapseTitle}>{title}</h3>
        <span className={styles.collapseMeta}>
          {meta}
          <ChevronDown size={16} className={styles.collapseChevron} aria-hidden />
        </span>
      </summary>
      <div className={styles.collapseBody}>{children}</div>
    </details>
  );
}
