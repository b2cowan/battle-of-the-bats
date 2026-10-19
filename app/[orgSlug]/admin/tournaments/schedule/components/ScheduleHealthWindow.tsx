'use client';
/**
 * SCHEDULE HEALTH'S WINDOW (owner 2026-10-19, A2) — what the header button opens: the product's one form window (the wide
 * 800 at a desk, so the team table fits; the whole screen with ← on a phone), its first line the score with its scale and the caption the row used
 * to carry, then the panel's body unchanged, its rules door at the end (A3). A tap outside does nothing — it holds the
 * rules form — and unsaved rules ask in the foot before it closes (`dirty`).
 */
import type { ComponentProps } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import { ScheduleHealthBody } from './ScheduleHealthPanel';
import styles from '../schedule-admin.module.css';

export default function ScheduleHealthWindow({ eyebrow, caption, timedGames, dirty, busy, onClose, ...body }: {
  /** The tournament's name, over the title. */
  eyebrow?: string;
  /** "Review · 3 issues · both divisions", or the not-built sentence. */
  caption: string;
  /** Games with a day and a time; none scores nothing ("—"). */
  timedGames: number;
  /** Unsaved rules: the close asks first. */
  dirty?: boolean;
  /** Rules saving: the window holds until the save lands, so a close cannot cross it (/review 2026-10-19). */
  busy?: boolean;
  onClose: () => void;
} & ComponentProps<typeof ScheduleHealthBody>) {
  const scored = timedGames > 0;
  return (
    // The wide window: its team table's seven columns fit without scrolling sideways (owner 2026-10-19).
    <KitDialog kind="form" size="wide" eyebrow={eyebrow} title={GAME_DAY_WORDS.healthTitle} onClose={onClose} dirty={dirty} busy={busy}>
      <div className={styles.healthWindowBody}>
        <p className={styles.healthWindowSummary}>
          <span className={styles.healthWindowScore} data-tone={scored ? body.metrics.healthTone : undefined}>
            {scored ? body.metrics.healthScore : '—'}{scored && <small>/100</small>}
          </span>
          <span>{caption}</span>
        </p>
        {/* Unscored, the figures have nothing to say — but the rules stay in reach (/review 2026-10-19). */}
        <ScheduleHealthBody {...body} showFigures={scored} />
      </div>
    </KitDialog>
  );
}
