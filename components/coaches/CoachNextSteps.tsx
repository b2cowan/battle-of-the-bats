import styles from './CoachNextSteps.module.css';

type Step = { title: string; detail: string };

/**
 * Persistent "What happens next" strip shown on the pending/waitlist tournament record.
 *
 * Unlike CoachWelcomeBanner (dismissible, ?welcome=1-gated), this strip never
 * disappears — it's the durable forward-orientation a first-time coach needs:
 * the status hero above answers "where am I"; this strip answers "what now."
 * Rendered as borderless numbered rows on --surface (NOT a card, NOT the lime
 * banner) so it reads as quiet orientation, the same register as the dashboard
 * metric strip — three steps don't warrant hero weight.
 */
export default function CoachNextSteps({ status }: { status: 'pending' | 'waitlist' }) {
  const steps: Step[] =
    status === 'waitlist'
      ? [
          { title: 'You’re on the waitlist', detail: 'The organizer will reach out if a spot opens in your division.' },
          { title: 'We’ll email you', detail: 'You’ll hear from us the moment your status changes.' },
          { title: 'Schedule & payment appear here', detail: 'This page updates automatically — nothing to do right now.' },
        ]
      : [
          { title: 'The organizer reviews your entry', detail: 'Usually within a few days.' },
          { title: 'You’ll get an email', detail: 'We’ll tell you the moment your team is accepted.' },
          { title: 'Schedule & payment appear here', detail: 'This page updates automatically — nothing to do right now.' },
        ];

  return (
    <section className={styles.strip} aria-label="What happens next">
      <p className={styles.label}>What happens next</p>
      <ol className={styles.steps}>
        {steps.map((step, i) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.marker} aria-hidden>{i + 1}</span>
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
