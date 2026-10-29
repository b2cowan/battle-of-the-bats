'use client';
/** Admin chrome and destinations only; every plan shares the billing body. */
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import BillingBody from '@/components/billing/BillingBody';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { getBillingHref, isTournamentTier } from '@/lib/billing-urls';
import ck from './ClubKit.module.css';

export default function BillingKit() {
  const { currentOrg } = useOrg();
  usePageTitle(W.page.title);
  const slug = currentOrg?.slug ?? '';
  const eyebrow = currentOrg && !isTournamentTier(currentOrg.planId) && currentOrg.planId !== 'team'
    ? W.page.eyebrow : undefined;
  return <div className={ck.page}>
    <AdminPageHeader eyebrow={eyebrow} title={W.page.title} />
    <BillingBody billingBase={getBillingHref(slug, currentOrg?.planId)} teamsHref={`/${slug}/admin/rep-teams`} />
  </div>;
}
