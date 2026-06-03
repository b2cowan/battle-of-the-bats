'use client';

/**
 * Layout-matched admin skeletons (Phase A foundation).
 *
 * Geometry mirrors the real flat-list rows / stat cards / analytics panels so
 * the HUD loads into intentional placeholders instead of a blank flash. The
 * shimmer is animated, and freezes static under the global prefers-reduced-motion
 * guard (globals.css).
 */

import styles from './AdminSkeleton.module.css';

export function SkeletonBlock({ w, h, className }: { w?: string; h?: string; className?: string }) {
  return <span className={`${styles.block} ${className ?? ''}`} style={{ width: w, height: h }} aria-hidden />;
}

export function SkeletonStatCard() {
  return (
    <div className={styles.statCard} aria-hidden>
      <span className={styles.statIcon} />
      <div className={styles.statBody}>
        <SkeletonBlock w="55%" h="1.5rem" />
        <SkeletonBlock w="80%" h="0.55rem" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className={styles.row} aria-hidden>
      <SkeletonBlock w="38%" h="0.7rem" />
      <SkeletonBlock w="18%" h="0.7rem" />
    </div>
  );
}

export function SkeletonPanel({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.panel} aria-hidden>
      <SkeletonBlock w="45%" h="0.7rem" />
      <SkeletonBlock w="30%" h="1.9rem" />
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock key={index} w="100%" h="0.7rem" />
      ))}
    </div>
  );
}

/** Composite dashboard placeholder: 4 stat cards + 3 analytics panels. */
export function DashboardSkeleton() {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label="Loading dashboard">
      <div className={styles.statsGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonStatCard key={index} />
        ))}
      </div>
      <div className={styles.panelsGrid}>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonPanel key={index} />
        ))}
      </div>
    </div>
  );
}
