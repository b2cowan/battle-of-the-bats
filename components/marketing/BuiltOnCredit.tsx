import Link from 'next/link';
import styles from './tournament-growth.module.css';

/**
 * The paid-tier attribution line (Desktop Public UX Phase 1, WI-10 · BUSINESS_DECISIONS
 * 2026-07-30 "Paid-tier public tournament pages carry a subtle Built on FieldLogicHQ credit").
 *
 * Paid orgs' public pages carried ZERO FieldLogicHQ presence — the platform's busiest, best
 * looking surfaces were the only class with no path back, which inverts the funnel (the
 * weakest events did all the selling). This closes that with the quietest thing that still
 * works.
 *
 * The binding constraint is SUBTLE, and every choice here is that constraint:
 *  • text only — no badge, no card, no banner, nothing to dismiss;
 *  • the NAME is the link, not a call to action. `/marketing` ruled 2026-07-30 that a labelled
 *    action ("Run your own tournament →") is the FREE tier's move, and repeating it here would
 *    collapse the distinction between the tiers. Free asks; paid just says;
 *  • no view/click tracking and no dismissal — instrumenting a colophon turns it into a
 *    campaign, and a credit you can dismiss was never a credit;
 *  • it renders in the ORG's own theme tokens, so it defers to their branding in both colour
 *    modes rather than importing ours.
 *
 * NOT rendered on free-plan events: those keep the richer PoweredByBadge + acquisition banner,
 * and stacking this under them would say the same thing twice. Callers gate on the plan.
 */
export default function BuiltOnCredit() {
  return (
    <div className={styles.builtOn}>
      Built on <Link href="/">FieldLogicHQ</Link>
    </div>
  );
}
