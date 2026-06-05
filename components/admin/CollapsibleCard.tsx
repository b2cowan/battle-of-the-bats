'use client';

import { type ReactNode } from 'react';
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
 */
export default function CollapsibleCard({
  title,
  icon,
  meta,
  defaultOpen = true,
  bodyClassName,
  className,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  /** Optional right-aligned content in the header (status pill, count, etc.). */
  meta?: ReactNode;
  defaultOpen?: boolean;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={clsx(styles.card, className)} open={defaultOpen}>
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
