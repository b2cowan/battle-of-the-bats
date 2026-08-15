'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { formatInOrgZone } from '@/lib/timezone';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * One event in a "which of my events still need X?" list — the date tile, the title and time, an
 * optional readiness chip, and a trailing action.
 *
 * Extracted from the Lineups hub when the Practice plans hub was built (2026-08-15). The two pages
 * are deliberately the same idiom, and a shared CLASS would only have stopped the styling drifting —
 * the markup is the half that drifts (a chip added on one page, a meta line reworded on the other),
 * so the component is the unit, not the class name.
 *
 * ⚠ Lineups' date tile and "when" line were rendered in the READER's timezone until this extraction
 * (a bare `toLocaleDateString`, the exact call `lib/timezone.ts` exists to replace). Both were
 * corrected to the org's zone in the same change: a coach reading the schedule from another
 * province was being shown a start time that is not the one at the field.
 *
 * ⚠ The lime `primaryLabel` is the page's ONE earned action, not a per-row decoration. Each hub
 * decides which single row gets it (the nearest upcoming event still missing the thing the page is
 * about); passing it on several rows would spend the page's only emphasis on nothing.
 */
export type CoachEventRowChip = {
  tone: 'ok' | 'warn';
  label: string;
  icon?: ReactNode;
};

export default function CoachEventListRow({
  href,
  startsAt,
  title,
  meta,
  chip,
  action,
  primaryLabel,
}: {
  href: string;
  /**
   * The stored instant. The date tile is formatted HERE, in the ORG's zone — a game starts when it
   * starts, and a coach reading this on a phone in another province must see the time at the field
   * (`lib/timezone.ts`). Callers pass the instant, never a pre-formatted day, precisely so no hub
   * can quietly put its own clock on this tile.
   */
  startsAt: string;
  title: string;
  /** The one-line "when" (and anything the hub wants to add to it), formatted by the caller. */
  meta: string;
  /** `null` for no chip — required rather than optional, so a caller has to say which it means. */
  chip: CoachEventRowChip | null;
  /** Quiet trailing action, used unless this row carries the page's lime action. */
  action: string;
  /** Set on exactly one row per page, `null` on the rest. */
  primaryLabel: string | null;
}) {
  return (
    <Link href={href} className={styles.lineupFrontRow}>
      <span className={styles.lineupFrontDate}>
        <span className={styles.lineupFrontDay}>{formatInOrgZone(startsAt, { day: 'numeric' })}</span>
        <span className={styles.lineupFrontMonth}>{formatInOrgZone(startsAt, { month: 'short' })}</span>
      </span>
      <span className={styles.lineupFrontMain}>
        <span className={styles.lineupFrontTitle}>{title}</span>
        <span className={styles.lineupFrontMeta}>{meta}</span>
      </span>
      {chip && (
        <span className={styles.lineupFrontChip} data-tone={chip.tone}>
          {chip.icon} {chip.label}
        </span>
      )}
      {primaryLabel ? (
        <span className={`btn btn-lime btn-sm ${styles.lineupFrontPrimary}`}>
          {primaryLabel} <ArrowRight size={14} aria-hidden />
        </span>
      ) : (
        <span className={styles.lineupFrontAction}>
          {action}
          <ArrowRight size={14} aria-hidden />
        </span>
      )}
    </Link>
  );
}
