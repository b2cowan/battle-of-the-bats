import Link from 'next/link';
import type { ReactNode } from 'react';
import CoachCard, { CoachEyebrow } from './CoachCard';
import kit from './CoachKit.module.css';

export type CoachRailDot = 'good' | 'blue' | 'rust' | 'plum' | 'olive';

export type CoachRailRowSpec = {
  key: string;
  href: string;
  /** ⚠ A dot is the colour of the CHIP you'll see when you arrive (owner 2026-08-15), never a
   *  lane; the name carries the information and the dot only reinforces it (deutan ruling). */
  dot: CoachRailDot;
  name: ReactNode;
  /** A quiet qualifier after the name ("in Insights"). */
  note?: ReactNode;
  /** A few words — the rail is the 1fr column and a long stat squeezes the NAME to nothing. */
  stat: ReactNode;
};

export type CoachRailGroupSpec = {
  /** The step marker above a group ("Plan", "Collect") — the setup rail; the operate rail has
   *  one unlabelled group. */
  step?: string;
  rows: CoachRailRowSpec[];
};

const DOT: Record<CoachRailDot, string> = {
  good: kit.railDotGood,
  blue: kit.railDotBlue,
  rust: kit.railDotRust,
  plum: kit.railDotPlum,
  olive: kit.railDotOlive,
};

/**
 * THE RAIL (plan §4, decision G) — "More in Money" · "Everything in Skills & Goals": a rail of
 * doors, one live line each, in a report card. dot · name · note · stat · chevron, 44px rows, the
 * two-column fold when the CARD is wider than 940px (a container query — the operating dashboard
 * hands it a ~362px slot beside the ledger where one column is right, the setup Overview the full
 * page column where it is not).
 *
 * A labelled GROUP, not a heading: the owner ruling that removed the four headed sections was
 * about visual weight, but the rows really are grouped, and a screen reader lost that when the
 * <h2>s went. `role="group"` restores the structure without restoring the headings.
 *
 * Navigation belongs to the tab bar. A row's job is the STAT; the chevron is a convenience, not a
 * second set of doors.
 */
export default function CoachRail({
  title,
  groups,
  idPrefix = 'rail',
}: {
  title: ReactNode;
  groups: CoachRailGroupSpec[];
  /** Prefix for the step markers' ids (`aria-labelledby`). */
  idPrefix?: string;
}) {
  return (
    <CoachCard className={kit.railCard}>
      <CoachEyebrow>{title}</CoachEyebrow>
      <div className={kit.railCols}>
        {groups.map((g, gi) => {
          const stepId = g.step ? `${idPrefix}-step-${g.step.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined;
          return (
            <div
              key={g.step ?? `group-${gi}`}
              className={kit.railGroup}
              {...(stepId ? { role: 'group', 'aria-labelledby': stepId } : {})}
            >
              {g.step && <p className={kit.railStep} id={stepId}>{g.step}</p>}
              {g.rows.map(row => (
                <Link key={row.key} href={row.href} className={kit.railRow}>
                  <span className={`${kit.railDot} ${DOT[row.dot]}`} aria-hidden />
                  <span className={kit.railName}>
                    {row.name}
                    {row.note != null && <> <span className={kit.railNote}>{row.note}</span></>}
                  </span>
                  <span className={kit.railStat}>{row.stat}</span>
                  <span className={kit.railChev} aria-hidden>›</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </CoachCard>
  );
}
