'use client';
/**
 * UpgradeGate — wraps a feature or section that requires a higher plan.
 *
 * If the org's current plan meets or exceeds `requiredPlan`, renders children.
 * Otherwise renders a locked-state card explaining what plan unlocks the feature,
 * with a CTA to the billing settings page.
 *
 * Usage:
 *   <UpgradeGate requiredPlan="league" feature="House League">
 *     <HouseLeagueSection />
 *   </UpgradeGate>
 */

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import styles from './UpgradeGate.module.css';

const PLAN_ORDER: OrgPlan[] = ['tournament', 'tournament_plus', 'league', 'club'];

interface UpgradeGateProps {
  /** Minimum plan required to see children. */
  requiredPlan: OrgPlan;
  /** Short feature name shown in the locked card, e.g. "House League" */
  feature: string;
  /** Optional additional context shown in the locked card body */
  description?: string;
  children: React.ReactNode;
}

export default function UpgradeGate({ requiredPlan, feature, description, children }: UpgradeGateProps) {
  const { currentOrg } = useOrg();

  if (!currentOrg) return null;

  const currentIndex  = PLAN_ORDER.indexOf(currentOrg.planId as OrgPlan);
  const requiredIndex = PLAN_ORDER.indexOf(requiredPlan);

  // Org meets the plan requirement — render the feature normally.
  if (currentIndex >= requiredIndex) {
    return <>{children}</>;
  }

  const planLabel = PLAN_CONFIG[requiredPlan]?.label ?? requiredPlan;
  const billingHref = `/${currentOrg.slug}/admin/org/billing`;

  return (
    <div className={styles.gate}>
      <div className={styles.gateIcon}>
        <Lock size={20} />
      </div>
      <div className={styles.gateBody}>
        <p className={styles.gateTitle}>{feature}</p>
        <p className={styles.gateSub}>
          {description ?? `${feature} is available on the ${planLabel} plan and above.`}
        </p>
      </div>
      <Link href={billingHref} className={`btn btn-outline btn-sm ${styles.gateCta}`}>
        Upgrade to {planLabel}
      </Link>
    </div>
  );
}
