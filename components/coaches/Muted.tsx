import type { ReactNode } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The quiet cell on a development table — a dash, "nothing yet", "Not assessed" — in the tertiary
 * ink (`.devBoardMuted`). One line, shared by the Skills & Goals hub and the Insights reports so the
 * two never spell the quiet ink differently (re-evaluation stage 4 /simplify, 2026-09-16).
 */
export default function Muted({ children }: { children: ReactNode }) {
  return <span className={styles.devBoardMuted}>{children}</span>;
}
