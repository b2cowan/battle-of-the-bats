'use client';

import { CreditCard } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import BillingBody from '@/components/billing/BillingBody';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { getBillingHref } from '@/lib/billing-urls';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { COACHES_TEAMS_PATH } from '@/lib/coaches-portal-routes';
import styles from '../coaches.module.css';

/** Workspace-level: no team/season gate and no tournament context. The standard page column (960px,
 *  centred) — the same width the club's own Plan & billing page takes; there is no table here to earn `pageWide`. */
export default function CoachBillingPage() {
  const { currentOrg } = useOrg();
  usePageTitle(W.page.title);
  const slug = currentOrg?.slug ?? '';
  return <div className={styles.page}>
    <CoachPageHeader icon={CreditCard} title={W.page.title} help={{
      module: 'coaches', sectionIds: ['premium'],
      fullGuideHref: `/${slug}/coaches/help#faq-premium-plan-billing`,
    }} />
    <BillingBody billingBase={getBillingHref({ ...currentOrg, slug }, { host: 'coach', purpose: 'return' })} teamsHref={COACHES_TEAMS_PATH} />
  </div>;
}
