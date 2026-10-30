import { Building2 } from 'lucide-react';
import { CoachCard, CoachEyebrow } from '@/components/coaches/kit';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './TeamPlanCoverageCard.module.css';

/** Payer information only. The authenticated settings read supplies the paying club's name. */
export default function TeamPlanCoverageCard({ clubName }: { clubName: string | null }) {
  if (!clubName) return null;
  return (
    <CoachCard>
      <div className={styles.content}>
        <span className={shared.headerIcon}><Building2 size={16} aria-hidden /></span>
        <div className={styles.copy}>
          <CoachEyebrow>{W.coverage.eyebrow}</CoachEyebrow>
          <h2 className={styles.title}>{W.coverage.title(clubName)}</h2>
          <p className={styles.body}>{W.coverage.body}</p>
        </div>
      </div>
    </CoachCard>
  );
}
