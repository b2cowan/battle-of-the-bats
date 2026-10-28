'use client';
/**
 * SCHEDULE HEALTH'S WINDOW (owner 2026-10-19, A2) — what the header button opens: the product's one form window (the wide
 * 800 at a desk, so the team table fits; the whole screen with ← on a phone), its first line the score with its scale and the caption the row used
 * to carry, then the panel's body unchanged, its rules door at the end (A3). A tap outside does nothing — it holds the
 * rules form — and unsaved rules ask in the foot before it closes (`dirty`).
 *
 * The frame (`HealthWindowFrame`) is also a house-league season's (9d-2a step 6, ruling 9d2·4: the tournament's button
 * and window, a league's rules), so the two windows cannot drift apart in shape.
 */
import type { ComponentProps, ReactNode } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import { SCHEDULE_DAY_WORDS } from '@/lib/schedule-words';
import { ScheduleHealthBody } from './ScheduleHealthPanel';
import styles from '../schedule-admin.module.css';

/** The window and its first line: the score with its scale (or "—"), and the caption. */
export function HealthWindowFrame({ eyebrow, score, tone, caption, dirty, busy, notice, onClose, children }: {
  eyebrow?: string;
  /** Null when there is nothing to score ("—"). */
  score: number | null;
  tone: 'good' | 'warning' | 'danger';
  caption: string;
  dirty?: boolean;
  busy?: boolean;
  notice?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    // The wide window: its team table's seven columns fit without scrolling sideways (owner 2026-10-19).
    <KitDialog kind="form" size="wide" eyebrow={eyebrow} title={GAME_DAY_WORDS.healthTitle} onClose={onClose} dirty={dirty} busy={busy}>
      <div className={styles.healthWindowBody}>
        <p className={styles.healthWindowSummary}>
          <span className={styles.healthWindowScore} data-tone={score != null ? tone : undefined}>
            {score ?? '—'}{score != null && <small>/100</small>}
          </span>
          <span>{caption}</span>
        </p>
        {notice}
        {children}
      </div>
    </KitDialog>
  );
}

export default function ScheduleHealthWindow({ eyebrow, divisionCount, timedGames, dirty, busy, notice, onClose, ...body }: {
  /** The tournament's name, over the title. */
  eyebrow?: string;
  /** Divisions with games, for the caption's scope ("both divisions"). */
  divisionCount: number;
  /** Games with a day and a time; none scores nothing ("—"). */
  timedGames: number;
  /** Unsaved rules: the close asks first. */
  dirty?: boolean;
  /** Rules saving: the window holds until the save lands, so a close cannot cross it (/review 2026-10-19). */
  busy?: boolean;
  /** A refused save, said under the score. */
  notice?: ReactNode;
  onClose: () => void;
} & ComponentProps<typeof ScheduleHealthBody>) {
  const scored = timedGames > 0;
  // "Review · 3 issues · both divisions", or the not-built sentence — worded here, once, for every place that opens it.
  const caption = scored
    ? [GAME_DAY_WORDS.healthCaption(body.metrics.healthTone, body.metrics.issues.length), SCHEDULE_DAY_WORDS.healthScope(divisionCount)].filter(Boolean).join(' · ')
    : GAME_DAY_WORDS.healthNotBuilt;
  return (
    <HealthWindowFrame eyebrow={eyebrow} score={scored ? body.metrics.healthScore : null} tone={body.metrics.healthTone} caption={caption}
      dirty={dirty} busy={busy} notice={notice} onClose={onClose}>
      {/* Unscored, the figures have nothing to say — but the rules stay in reach (/review 2026-10-19). */}
      <ScheduleHealthBody {...body} showFigures={scored} />
    </HealthWindowFrame>
  );
}
