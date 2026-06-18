import { Check } from 'lucide-react';
import styles from './CoachNextSteps.module.css';

export type CoachNextStep = { title: string; detail: string; done?: boolean };

/**
 * Persistent "What happens next" strip shown on the tournament record.
 *
 * Unlike CoachWelcomeBanner (dismissible, ?welcome=1-gated), this strip never
 * disappears — it's the durable forward-orientation a coach needs: the status
 * hero above answers "where am I"; this strip answers "what now."
 *
 * Two modes:
 *  - `status` ('pending' | 'waitlist') → the built-in waiting-on-the-organizer copy.
 *  - `steps` → an explicit list (used by the ACCEPTED phase, where the steps are
 *    data-driven: pay your fee → submit your roster → watch for the schedule, with
 *    finished steps shown muted + checked so a returning coach sees what's outstanding).
 *
 * Rendered as borderless numbered rows on --surface (NOT a card, NOT the lime banner)
 * so it reads as quiet orientation, the same register as the dashboard metric strip.
 */
export default function CoachNextSteps({
  status,
  steps,
  label = 'What happens next',
}: {
  status?: 'pending' | 'waitlist';
  steps?: CoachNextStep[];
  label?: string;
}) {
  const resolved: CoachNextStep[] =
    steps ??
    (status === 'waitlist'
      ? [
          { title: 'You’re on the waitlist', detail: 'The organizer will reach out if a spot opens in your division.' },
          { title: 'We’ll email you', detail: 'You’ll hear from us the moment your status changes.' },
          { title: 'Schedule & payment appear here', detail: 'This page updates automatically — nothing to do right now.' },
        ]
      : [
          { title: 'The organizer reviews your entry', detail: 'Usually within a few days.' },
          { title: 'You’ll get an email', detail: 'We’ll tell you the moment your team is accepted.' },
          { title: 'Schedule & payment appear here', detail: 'This page updates automatically — nothing to do right now.' },
        ]);

  return (
    <section className={styles.strip} aria-label={label}>
      <p className={styles.label}>{label}</p>
      <ol className={styles.steps}>
        {resolved.map((step, i) => (
          <li key={step.title} className={`${styles.step} ${step.done ? styles.stepDone : ''}`}>
            <span className={styles.marker} aria-hidden>
              {step.done ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>{step.title}</span>
              <span className={styles.stepDetail}>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
