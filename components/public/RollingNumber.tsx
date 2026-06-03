'use client';
/**
 * components/public/RollingNumber.tsx
 * Scoreboard "odometer" for a single numeric value. When `value` changes the old
 * number slides up and out while the new one rolls in from below — the marquee
 * score treatment used on broadcast cards, the scorebug, and the My-Team dock.
 *
 * Stable by design: the component persists across live polling (it lives inside a
 * stable-key row), tracks the previous value in a ref, and only animates on an
 * actual change — so a 30s poll that returns the same score does nothing. Motion
 * collapses to an instant swap under the global prefers-reduced-motion reset.
 */
import { useEffect, useRef, useState } from 'react';
import styles from './RollingNumber.module.css';

interface Props {
  value: number | null | undefined;
  /** Applied to the outer wrapper (use for color/size, e.g. a winner tint). */
  className?: string;
}

export default function RollingNumber({ value, className }: Props) {
  const next = value ?? 0;
  const prevRef = useRef(next);
  const [rolling, setRolling] = useState(false);
  const [outgoing, setOutgoing] = useState(next);

  useEffect(() => {
    if (next === prevRef.current) return;
    // Capture the value we're rolling away from, then trigger the slide. Guarded
    // by the equality check above, so it only runs on an actual score change.
    setOutgoing(prevRef.current);
    setRolling(true);
    prevRef.current = next;
    const timer = window.setTimeout(() => setRolling(false), 380);
    return () => window.clearTimeout(timer);
  }, [next]);

  return (
    <span className={`${styles.roll} ${className ?? ''}`}>
      {rolling ? (
        <span className={styles.viewport} aria-hidden="true">
          <span className={styles.outgoing}>{outgoing}</span>
          <span className={styles.incoming}>{next}</span>
        </span>
      ) : null}
      {/* Always render the settled value for layout width + screen readers. */}
      <span className={rolling ? styles.hiddenValue : undefined}>{next}</span>
    </span>
  );
}
