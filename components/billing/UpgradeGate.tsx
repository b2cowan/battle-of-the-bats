'use client';
/**
 * UpgradeGate — wraps a feature or section that requires a higher plan.
 *
 * Driven entirely by a `feature` key: the minimum plan and the upgrade copy are
 * resolved from the single source of truth (`FEATURE_MIN_PLAN` / `requiresPlanCopy`
 * in lib/plan-features.ts). This prevents the gate from drifting out of sync with
 * the actual server-side enforcement when a feature's minimum tier changes.
 *
 * If the org's current plan satisfies the feature, renders children. Otherwise
 * renders a locked-state card with a CTA to the correct billing page.
 *
 * Usage:
 *   <UpgradeGate feature="advanced_tournament_branding" label="Custom branding">
 *     <BrandingSection />
 *   </UpgradeGate>
 */

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { getBillingHref } from '@/lib/billing-urls';
import { FEATURE_MIN_PLAN, hasPlanFeature, requiresPlanCopy, type PlanFeature } from '@/lib/plan-features';
import type { OrgPlan } from '@/lib/types';
import styles from './UpgradeGate.module.css';

interface UpgradeGateProps {
  /** Plan feature key — minimum plan + upgrade copy resolve from FEATURE_MIN_PLAN. */
  feature: PlanFeature;
  /** Short feature name shown in the locked card header, e.g. "Custom branding". */
  label: string;
  /** Optional body override; defaults to requiresPlanCopy(feature). */
  description?: string;
  children: React.ReactNode;
}

export default function UpgradeGate({ feature, label, description, children }: UpgradeGateProps) {
  const { currentOrg } = useOrg();

  if (!currentOrg) return null;

  // Org satisfies the feature's minimum plan — render the feature normally.
  if (hasPlanFeature(currentOrg.planId as OrgPlan, feature)) {
    return <>{children}</>;
  }

  const requiredPlan = FEATURE_MIN_PLAN[feature];
  const planLabel = PLAN_CONFIG[requiredPlan]?.label ?? requiredPlan;
  const billingHref = getBillingHref(currentOrg.slug, currentOrg.planId);

  return (
    <div className={styles.gate}>
      <div className={styles.gateIcon}>
        <Lock size={20} />
      </div>
      <div className={styles.gateBody}>
        <p className={styles.gateTitle}>{label}</p>
        <p className={styles.gateSub}>
          {description ?? requiresPlanCopy(feature)}
        </p>
      </div>
      <Link href={billingHref} className={`btn btn-outline btn-sm ${styles.gateCta}`}>
        Upgrade to {planLabel}
      </Link>
    </div>
  );
}
