import { Check } from 'lucide-react';
import styles from './StartSteps.module.css';

/**
 * The step line (owner A2, design review D2, 2026-10-18; The first look D-F5, 2026-10-19): "1 Account · 2 Team", or
 * "Account · Organization · Plan" for Run a tournament. It says what is coming, which is what makes step 2 read as the
 * second half rather than a repeat. Not a control. Single-noun labels, so three steps fit a phone on one line; finished
 * steps at full strength. A screen reader hears "Step 1 of 2: Account".
 */
export default function StartSteps({ current, labels: steps }: {
  current: number;
  /** Every step's one-noun label, in order. */
  labels: readonly string[];
}) {
  return (
    // role="list": the steps are unstyled, and Safari drops list semantics from an unstyled list.
    <ol className={styles.steps} aria-label="Sign-up steps" data-count={steps.length} role="list">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        return (
          <li key={label} className={done ? styles.stepDone : n === current ? styles.stepOn : undefined} aria-current={n === current ? 'step' : undefined}>
            <span className={styles.stepNum} aria-hidden>
              {done ? <Check size={12} strokeWidth={3} /> : n}
            </span>
            <span className="sr-only">Step {n} of {steps.length}: </span>
            <span>{label}</span>
            {done && <span className="sr-only">, done</span>}
          </li>
        );
      })}
    </ol>
  );
}
