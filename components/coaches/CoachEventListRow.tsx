'use client';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { formatOrgDayMonth } from '@/lib/timezone';
import { CoachRow } from '@/components/coaches/CoachRowList';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * One event in a "which of my events still need X?" list — the date, the title and time, an
 * optional readiness chip, and a trailing action.
 *
 * Extracted from the Lineups hub when the Practice plans hub was built (2026-08-15). The two pages
 * are deliberately the same idiom, and a shared CLASS would only have stopped the styling drifting —
 * the markup is the half that drifts (a chip added on one page, a meta line reworded on the other),
 * so the component is the unit, not the class name.
 *
 * ⚠ SINCE 2026-09-16 IT RENDERS THROUGH `CoachRow` — the one row-list recipe (standard §3.10,
 * register F-27). Both hubs' rows were 73px white cards floating on the paper with a 20px
 * display-face day tile — the one row in the portal larger than its own page title — and a hover
 * that lifted. The date is a date column now, the title is `--type-body` 600, the row tints on
 * hover and nothing else. The ruled vocabulary this component carries (stage 0 D3: "Open the plan"
 * / "Plan this practice" / "Open"; the chips) is exactly what it was.
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
  /**
   * `mute` (practices re-evaluation stage 0, D3): a PAST practice with no plan reads "No plan
   * written" in the record's voice — outlined, quiet — never the amber of an upcoming one still
   * waiting for work. Two halves of a list, two vocabularies; one chip shape.
   */
  tone: 'ok' | 'warn' | 'mute';
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
  quietAction,
  note,
  primaryLabel,
  beside,
}: {
  href: string;
  /**
   * The stored instant. The date column is formatted HERE, in the ORG's zone — a game starts when
   * it starts, and a coach reading this on a phone in another province must see the time at the
   * field (`lib/timezone.ts`). Callers pass the instant, never a pre-formatted day, precisely so no
   * hub can quietly put its own clock on this row.
   */
  startsAt: string;
  title: string;
  /** The one-line "when" (and anything the hub wants to add to it), formatted by the caller. */
  meta: string;
  /** `null` for no chip — required rather than optional, so a caller has to say which it means. */
  chip: CoachEventRowChip | null;
  /** Quiet trailing action, used unless this row carries the page's lime action. */
  action: string;
  /**
   * The action in the record's voice (stage 0, D3) — "Open" on a past practice, muted rather than
   * the working blue of "Open the plan" / "Plan this practice". Default false.
   */
  quietAction?: boolean;
  /**
   * One optional line under the meta — a past practice's recap, first line only (D3). `null` or
   * `undefined` renders nothing; the row never draws an empty line.
   */
  note?: string | null;
  /** Set on exactly one row per page, `null` on the rest. */
  primaryLabel: string | null;
  /** A control BESIDE the row (the Game day / Run practice pill inside a live window) — a sibling, never nested. */
  beside?: ReactNode;
}) {
  return (
    <CoachRow
      as="link"
      href={href}
      lead={formatOrgDayMonth(startsAt)}
      leadKind="date"
      title={title}
      caption={meta}
      note={note ? `“${note}”` : undefined}
      trail={
        <>
          {chip && (
            <span className={styles.lineupFrontChip} data-tone={chip.tone}>
              {chip.icon} {chip.label}
            </span>
          )}
          {primaryLabel && (
            <span className={`btn btn-lime btn-sm ${styles.lineupFrontPrimary}`}>
              {primaryLabel} <ArrowRight size={14} aria-hidden />
            </span>
          )}
        </>
      }
      door={primaryLabel ? null : { label: action, quiet: !!quietAction, icon: <ArrowRight size={14} aria-hidden /> }}
      beside={beside}
    />
  );
}
