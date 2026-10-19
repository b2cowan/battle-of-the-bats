import { Check } from 'lucide-react';
import styles from './StartSteps.module.css';

/**
 * The two-step line (owner A2, design review D2, 2026-10-18): "1 Your account · 2 Your team". It says the naming step
 * is coming, which is what makes step 2 read as the second half rather than a repeat. Not a control. Worn by the free
 * start forms (StartDoorForm) and Coach Premium's card (TeamSignupClient, Part 3).
 */
export default function StartSteps({ current, second }: { current: 1 | 2; second: string }) {
  return (
    <ol className={styles.steps} aria-label="Sign-up steps">
      <li className={current === 1 ? styles.stepOn : styles.stepDone} aria-current={current === 1 ? 'step' : undefined}>
        <span className={styles.stepNum}>
          {current === 1 ? '1' : <Check size={12} strokeWidth={3} role="img" aria-label="Done" />}
        </span>
        <span>Your account</span>
      </li>
      <li className={current === 2 ? styles.stepOn : undefined} aria-current={current === 2 ? 'step' : undefined}>
        <span className={styles.stepNum}>2</span>
        <span>{second}</span>
      </li>
    </ol>
  );
}
