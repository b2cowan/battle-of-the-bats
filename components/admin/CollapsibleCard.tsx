'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import styles from './CollapsibleCard.module.css';

/**
 * Collapsible admin card built on native <details>/<summary>.
 *
 * - Children stay mounted when collapsed (native details only hides them), so
 *   form state, auto-save timers, and effects inside are unaffected.
 * - `defaultOpen` sets the initial state only; the prop value is stable across
 *   renders, so React never re-writes the `open` attribute and the user's manual
 *   toggle always sticks.
 * - The summary acts as a group header — larger than the body text so each card
 *   clearly reads as a labelled group.
 *
 * Deep-linking: pass `sectionId` and, when the page URL carries a matching
 * `?section=<sectionId>` query param, the card opens, scrolls into view, and
 * briefly highlights — so a checklist/link that targets a specific card lands
 * the user right on the task instead of a wall of collapsed cards. The match
 * only forces the card open; it never closes other cards or fights the user's
 * later toggles.
 *
 * A query param (not a hash) is used on purpose: `useSearchParams()` re-fires
 * the effect on every navigation even when the App Router keeps this page
 * mounted across client-side nav, whereas a hash change would be missed on a
 * repeat visit to the same already-mounted route.
 */
export default function CollapsibleCard({
  title,
  icon,
  meta,
  defaultOpen = true,
  sectionId,
  bodyClassName,
  className,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  /** Optional right-aligned content in the header (status pill, count, etc.). */
  meta?: ReactNode;
  defaultOpen?: boolean;
  /** Deep-link target. When the URL has `?section=<sectionId>`, this card opens + highlights. */
  sectionId?: string;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [highlight, setHighlight] = useState(false);
  const searchParams = useSearchParams();
  // Reactive: changes on every navigation, so the effect re-fires even when the
  // App Router keeps this page mounted across a repeat visit to the same route.
  const targeted = sectionId != null && searchParams.get('section') === sectionId;

  useEffect(() => {
    if (!targeted) return;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const focus = () => {
      const el = ref.current;
      if (!el) {
        // Ref not attached yet on this render pass — retry on the next frame.
        timers.push(setTimeout(focus, 0));
        return;
      }

      // Open imperatively. The `open` attribute stays uncontrolled (driven only
      // by defaultOpen on mount), so the user can freely toggle the card shut
      // afterwards — we just nudge it open on arrival.
      el.open = true;
      setHighlight(true);

      // Scroll on a delay so the expanded card height — including async content
      // like the contact member list — has settled before we compute position.
      // A single rAF can fire against stale layout for cards low on the page;
      // a short timeout is reliable across card positions.
      timers.push(setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120));
      timers.push(setTimeout(() => setHighlight(false), 2000));
    };

    focus();
    return () => { timers.forEach(clearTimeout); };
  }, [targeted]);

  return (
    <details
      ref={ref}
      id={sectionId ? `section-${sectionId}` : undefined}
      className={clsx(styles.card, highlight && styles.highlight, className)}
      open={defaultOpen}
    >
      <summary className={styles.summary}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.title}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
        <ChevronDown size={16} className={styles.chevron} aria-hidden />
      </summary>
      <div className={clsx(styles.body, bodyClassName)}>{children}</div>
    </details>
  );
}
