'use client';
import { useState } from 'react';
import type { TryoutMemoryPair } from '@/lib/tryout-report';
import styles from './TryoutMemoryStrip.module.css';

/**
 * The memory strip — one confirmed returning candidate's prior tryout beside this one
 * (Tryout Insights Phase 3; mockups v1 frame 06 = binding; ruling R7).
 *
 * ⚠ **This component renders ONLY what the server decided.** It computes no delta and holds no
 * threshold: `pair.delta` and `pair.categories` are settled in lib/tryout-report.ts where a unit
 * test holds them, and a null `delta` IS the ruling that no comparison was permitted. A second
 * opinion here is how the two halves of R7 would drift apart.
 *
 * ⚠ It is mounted from ONE place — the decision board, post-reveal, on a confirmed link. Its
 * absence from the scorer, the live scoreboard and check-in is asserted by
 * tests/unit/tryout-report.test.ts (work item C5), not left to convention.
 */
/** ONE sign→colour mapping for both the composite pill and every category row — two copies would
 *  let a theme change land on only half the deltas (/simplify 2026-08-03). */
const deltaClass = (n: number) => (n > 0 ? styles.deltaUp : n < 0 ? styles.deltaDown : '');

export default function TryoutMemoryStrip({ pair }: { pair: TryoutMemoryPair }) {
  const [open, setOpen] = useState(false);
  // A delta EXISTS only when R7 permitted the comparison, so its presence is the only gate this
  // component needs — there is no second "comparable" flag to fall out of step with it.
  const d = pair.delta;
  const canExpand = pair.categories.length > 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.memory}>
        <MemoryCard snapshot={pair.prior} />
        <div className={styles.mid}>
          {d == null ? (
            <span className={styles.sideBySide}>side by side</span>
          ) : (
            <span className={`${styles.delta} ${deltaClass(d)}`}>
              {d > 0 ? `▲ +${d.toFixed(1)}` : d < 0 ? `▼ ${d.toFixed(1)}` : 'level'}
            </span>
          )}
        </div>
        <MemoryCard snapshot={pair.current} />
      </div>

      <p className={styles.note}>
        {d != null
          ? `Both tryouts used the same 1–${pair.current.scaleMax} scorecard.`
          : pair.prior.scaleMax !== pair.current.scaleMax
            // Name the two scales: "different scorecards" alone reads as a bug rather than a fact
            // about the club's own history.
            ? `Different scorecards (1–${pair.prior.scaleMax} vs 1–${pair.current.scaleMax}) — shown side by side, no arithmetic.`
            : 'One of these tryouts has no score yet — shown side by side, no arithmetic.'}
      </p>

      {canExpand && (
        <>
          <button
            type="button"
            className={styles.expandBtn}
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
          >
            {open ? '▾' : '▸'} Compare categories
          </button>
          {open && (
            <div className={styles.catList}>
              {pair.categories.map(row => (
                <div key={row.key} className={styles.catRow}>
                  <span className={styles.catLabel}>{row.label}</span>
                  <span className={styles.catNums}>
                    {row.prior.toFixed(1)} <span className={styles.catArrow}>→</span> {row.current.toFixed(1)}
                  </span>
                  <span className={`${styles.catDelta} ${deltaClass(row.delta)}`}>
                    {row.delta > 0 ? `+${row.delta.toFixed(1)}` : row.delta < 0 ? row.delta.toFixed(1) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MemoryCard({ snapshot }: { snapshot: TryoutMemoryPair['prior'] }) {
  return (
    <div className={styles.card}>
      <div className={styles.season}>{snapshot.seasonLabel}</div>
      <div className={styles.composite}>
        {/* "Not scored" and "scored zero" must not look alike — the same rule the category bars
            keep. An unscored season shows an em-dash and no scale. */}
        {snapshot.composite == null
          ? '—'
          : <>{snapshot.composite.toFixed(1)}<span className={styles.scale}> /{snapshot.scaleMax}</span></>}
      </div>
      <div className={styles.decision}>
        {/* The current side carries no decision — it lives on the buttons in this same row and a
            copy here would go stale the moment the coach taps one (see TryoutMemorySnapshot). */}
        {snapshot.decision}
        {snapshot.evaluatorCount > 0 && (
          <>{snapshot.decision ? ' · ' : ''}{snapshot.evaluatorCount} eval{snapshot.evaluatorCount === 1 ? '' : 's'}</>
        )}
      </div>
    </div>
  );
}
