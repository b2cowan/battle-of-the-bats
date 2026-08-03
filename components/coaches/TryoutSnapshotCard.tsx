'use client';
import { ClipboardList } from 'lucide-react';
import CategoryBars from './CategoryBars';
import { isEmptyBaselineSnapshot } from '@/lib/tryout-baseline';
import type { RepTryoutBaselineSnapshot } from '@/lib/types';
import styles from './TryoutSnapshotCard.module.css';

/**
 * ONE renderer for the tryout snapshot, used by BOTH places it is allowed to appear (Tryout
 * Insights Phase 2, mockups v1 frames 04 + 05):
 *
 *   · `variant="inline"` — inside the seeding walkthrough, where card chrome already exists.
 *   · `variant="card"`   — the dashed CONTEXT card on a player's development page.
 *
 * ⚠ **It is CONTEXT, never a measurable** (R4). The dashed border and the audience line below are
 * the ruling made visible; a second copy of this markup that dropped either would quietly turn a
 * subjective panel rating into something that looks measured. That is why there is one component
 * and not two similar blocks.
 *
 * ⚠ **The audience line renders on the CARD variant**, matching the practice-recap precedent of
 * stating who a surface is for on the surface itself (R3). Inside the walkthrough the coach is
 * already being told, in the step's own copy, that nothing is saved without them.
 *
 * ⚠ **The "thin" threshold is the SAME strictly-below-midpoint rule `suggestBaselineFocus` uses**,
 * so what the coach sees flagged is exactly what gets suggested. Two thresholds would drift.
 */
export default function TryoutSnapshotCard({
  snapshot, variant,
}: {
  snapshot: RepTryoutBaselineSnapshot;
  variant: 'card' | 'inline';
}) {
  // Nothing truthful to draw — callers decide what to say instead ("no snapshot — set focus
  // manually"), because the honest copy differs between the walkthrough and the profile page.
  // Emptiness is the module's definition, not a second opinion restated here.
  if (isEmptyBaselineSnapshot(snapshot)) return null;

  const midpoint = snapshot.scaleMax / 2;
  const evaluators = snapshot.evaluatorCount === 1 ? '1 evaluator' : `${snapshot.evaluatorCount} evaluators`;
  const metaLine = [
    snapshot.dateLabel,
    snapshot.evaluatorCount > 0 ? evaluators : null,
    // Only claimed when it was true at the moment the snapshot was taken.
    variant === 'inline' && snapshot.blindUsed ? 'blind' : null,
  ].filter(Boolean).join(' · ');

  const bars = (
    <CategoryBars
      scaleMax={snapshot.scaleMax}
      rows={snapshot.categories.map(c => ({ ...c, thin: c.avg != null && c.avg < midpoint }))}
    />
  );

  const compositeLine = snapshot.composite != null ? (
    <p className={styles.composite}>
      <span className={styles.compositeValue}>{snapshot.composite.toFixed(1)}</span>
      <span>overall, out of {snapshot.scaleMax}</span>
    </p>
  ) : null;

  if (variant === 'inline') {
    return (
      <div>
        <div className={styles.inlineLabel}>
          Tryout snapshot{metaLine ? ` — ${metaLine}` : ''}
        </div>
        {bars}
        {compositeLine}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h4 className={styles.title}><ClipboardList size={14} aria-hidden /> Tryout snapshot</h4>
        {metaLine && <span className={styles.meta}>{metaLine}</span>}
      </div>
      {bars}
      {compositeLine}
      <p className={styles.note}>
        Where the season started. Coach-eyes-only — families never see tryout evaluations, and this
        snapshot never counts as a measurable or a trend.
      </p>
    </div>
  );
}
