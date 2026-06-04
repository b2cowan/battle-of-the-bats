'use client';

/**
 * NumberStepper (C9) — a number field flanked by − / + buttons so the schedule
 * Generator + Playoff Wizard are thumb-operable on a phone (no numeric keyboard
 * for small adjustments). Buttons hit 44px on mobile; clamps to min/max.
 */

import { Minus, Plus } from 'lucide-react';
import styles from './NumberStepper.module.css';

export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const clamp = (v: number) => {
    let n = Number.isFinite(v) ? v : min;
    n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    return n;
  };

  return (
    <div className={`${styles.stepper} ${className ?? ''}`}>
      <button
        type="button"
        className={styles.stepBtn}
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label="Decrease"
        tabIndex={-1}
      >
        <Minus size={14} aria-hidden />
      </button>
      <input
        type="number"
        className={styles.input}
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        onChange={e => onChange(clamp(Number(e.target.value)))}
      />
      <button
        type="button"
        className={styles.stepBtn}
        onClick={() => onChange(clamp(value + step))}
        disabled={max != null && value >= max}
        aria-label="Increase"
        tabIndex={-1}
      >
        <Plus size={14} aria-hidden />
      </button>
    </div>
  );
}
