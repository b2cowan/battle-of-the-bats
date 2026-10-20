'use client';
import { Check } from 'lucide-react';
import styles from './ChoicePair.module.css';

/**
 * THE CHOICE PAIR (The first look, design review D-F3, 2026-10-19): two options side by side, 44px, 14/600, the picked
 * one with a check and a 2px olive edge. A choice, not a toggle switch: one is always picked. Coach Premium's billing
 * ("$29/month" / "$290/year") and the join page's "Existing team" / "New team" wear it; built once so the pricing
 * page's monthly / annual toggle can adopt it too (The public face, S4).
 * It reads the warm vocabulary (--home-*) of whatever ground hosts it.
 */
export default function ChoicePair<V extends string>({ labelledBy, describedBy, value, options, onChange, disabled = false }: {
  /** The id of the visible label the host shows above it, which names the group (never a second copy of its words). */
  labelledBy: string;
  /** The id of the line under it, when there is one. */
  describedBy?: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.choice} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {options.map(option => {
        const picked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            // Pressed buttons in a group (as the toggle it replaces): a radio group would owe arrow-key movement.
            aria-pressed={picked}
            className={picked ? styles.picked : styles.option}
            onClick={() => onChange(option.value)}
            disabled={disabled}
          >
            {picked && <Check size={15} strokeWidth={3} aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
