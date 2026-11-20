import { BILLING_TAX_WORDS } from '@/lib/billing-tax';
import { possessive } from '@/lib/utils';
import kit from './MarketingKit.module.css';
import styles from './HowTheTrialWorks.module.css';

/**
 * "How the trial works" (W68, plan Ask 27; on-sale pages S3) — under the plan cards on /for-clubs and /for-leagues, while
 * the plan is open and its trial exists. A DISCLOSURE, not a selling section: every step is something the product does.
 *
 * ⚠ No trial length is typed here. The one trial sentence above the steps carries the number (`planTrialLine`, from the
 * length checkout will use); the copy rule's "and nowhere else" names this section (PRICING_PAGE_COPY.md).
 * ⚠ Step 3 promises the trial-ending email. `/billing` confirmed 2026-11-20 that production's live webhook receives
 * `customer.subscription.trial_will_end` and the handler emails every owner with the date
 * (`lib/billing-webhook-handler.ts`, `trial_will_end`). If that handler stops emailing every owner, this step is false.
 * `/legal`'s additions: "first paid plan" (step 1) and "renews until you cancel" (step 4).
 */
export default function HowTheTrialWorks({ who, trialLine }: {
  /** Whose plan: the club's or the league's (the steps' only difference besides step 2's last clause). */
  who: 'club' | 'league';
  /** The one trial sentence, with the length checkout will use. */
  trialLine: string;
}) {
  const steps = [
    {
      title: 'Start today.',
      body: `Create your account, name your ${who} and add a payment method at checkout. The trial is for your ${possessive(who)} first paid plan.`,
    },
    {
      title: 'Use all of it.',
      body: `Your whole plan is on from the first day. Set up your season, open registration and ${who === 'club' ? 'bring in your coaches' : 'build your teams'}.`,
    },
    {
      title: 'We email you before it ends.',
      body: 'The owners get an email a few days before the trial ends. It names the date. To stop, cancel in Plan & billing before that date.',
    },
    {
      title: 'Or carry on.',
      body: `Do nothing and your payment method is charged on that date, ${BILLING_TAX_WORDS.plusTax}, monthly or yearly as you chose, and the plan renews until you cancel.`,
    },
  ];
  return (
    <section className={kit.section} aria-labelledby="how-the-trial-works">
      <div className="container">
        <p className={kit.eyebrow}>The trial</p>
        <h2 id="how-the-trial-works" className={kit.heading}>How the trial works</h2>
        <p className={kit.body}>{trialLine}</p>
        {/* A numbered row, not four boxes (`/design` 2026-11-18); a list of rows on a phone. */}
        <ol className={styles.steps}>
          {steps.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.num} aria-hidden="true">{i + 1}</span>
              <div>
                <p className={styles.title}>{step.title}</p>
                <p className={kit.small}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
