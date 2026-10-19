'use client';
/**
 * THE ONE VIEW PILL — Toolbar Rules, Rule 6 (owner ruling 2026-10-17; hub SPjRTAB6kVqd9vJ8x1vuza; plan
 * docs/projects/archive/TOOLBAR_RULES_PLAN.md). A row of views of one list, each with its count: rounded (it picks WHICH
 * list — Rule 4), 38px on a desk and the tap floor at touch widths, the count in the lighter ink beside the word, olive
 * when chosen. Results' lens was the drawing; the Toolbar Rules guard names every wearer (`PILL_HOSTS`).
 * A host places the row (wrapping it, as Check-in's desk slot does); it never restyles a pill.
 */
import styles from './ViewPills.module.css';

export default function ViewPills<V extends string>({ label, views, value, onChange }: {
  /** The group's accessible name: "Which games". */
  label: string;
  /** A view without a `count` shows its word alone (Tryouts counts only All and Pending review). */
  views: readonly { id: V; label: string; count?: number }[];
  value: V;
  onChange: (view: V) => void;
}) {
  return (
    <div className={styles.pills} role="group" aria-label={label}>
      {views.map(v => (
        <button key={v.id} type="button" className={styles.pill} aria-pressed={value === v.id} onClick={() => onChange(v.id)}>
          <span>{v.label}</span>
          {v.count != null && <span className={styles.count}>{v.count}</span>}
        </button>
      ))}
    </div>
  );
}
