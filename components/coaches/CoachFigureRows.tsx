'use client';
import type { ReactNode } from 'react';
import { CoachRow, CoachRowList } from './CoachRowList';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * A DASHBOARD'S FIGURES ON A PHONE — one white frame of rows: the label and one fact on the left,
 * the figure on the right, the chevron that says the row opens its report.
 *
 * First drawn as the Overview's "at a glance" board on a phone (owner rulings B3 · B5 · B6,
 * 2026-09-20/21: rows, one white frame, 52px two-line rows, no icons, a fact-only caption). The
 * Insights scoreboard took the same rows on 2026-09-25 (ruling A1 — "the Overview's rows, in one
 * white frame"), which made it the second consumer and this component the extraction point: the
 * density, the centred figure and the phone-only visibility were a stylesheet block written for
 * one page, and a second page copying the markup would have been a twin.
 *
 * ⚠ PHONE-ONLY BY STYLESHEET. The list is `display: none` above 640 (`.figureRows`); the caller
 * renders its wide form beside it and hides THAT at ≤640 with its own class — never a JS media
 * query, so the server's frame and the first client frame agree (the Overview's grid, the Insights
 * band). Both renderings read the same figures; neither knows the other exists.
 *
 * A row carries ONE qualifier (the walk's S.4): a flag, the W/L pips, or a sub that is a FACT —
 * never a hint ("in the next 7 days"), never a bar (the report it opens has the bar).
 */
export function CoachFigureRows({
  children,
  label,
  labelledBy,
}: {
  children: ReactNode;
  /** What the figures are, for the accessibility tree — or `labelledBy` a visible heading. */
  label?: string;
  labelledBy?: string;
}) {
  return (
    <CoachRowList className={styles.figureRows} label={label} labelledBy={labelledBy} phoneFrame>
      {children}
    </CoachRowList>
  );
}

export function CoachFigureRow({
  href,
  label,
  caption,
  figure,
  tone,
  words,
}: {
  href: string;
  label: ReactNode;
  /** The one qualifier — a fact, a flag or the pips. Omit it for a one-line row. */
  caption?: ReactNode;
  figure: ReactNode;
  /** The figure's verdict ink. Colour never carries it alone: the figure's sign or words say it too. */
  tone?: 'good' | 'danger';
  /** A figure that is words ("None yet") — a step quieter and smaller, the tile's `bigWords`. */
  words?: boolean;
}) {
  return (
    <CoachRow
      as="link"
      href={href}
      title={label}
      caption={caption}
      trail={<span className={styles.figureRowFigure} data-tone={tone} data-words={words || undefined}>{figure}</span>}
      door="chevron"
    />
  );
}
