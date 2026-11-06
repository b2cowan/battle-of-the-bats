'use client';
/** Admin chrome and destinations only; every plan shares the billing body. */
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useClubBrief } from './ClubBriefProvider';
import { overdueBannerFor } from '@/lib/fee-invoice-line';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import BillingBody from '@/components/billing/BillingBody';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { getBillingHref, isTournamentTier } from '@/lib/billing-urls';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import ck from './ClubKit.module.css';

export default function BillingKit() {
  const { currentOrg } = useOrg();
  // After the owner pays in Stripe's tab, the line and the list re-read on return and the door's pill follows (Fee invoice alerts Part 3).
  const { reload, status, brief } = useClubBrief();
  // The pinned banner speaks for anything overdue once the brief says so (or while it is still on its way); if the brief failed or is out
  // of date there is no banner, and the page draws the red line itself.
  const bannerCoversOverdue = status === 'loading' || overdueBannerFor(brief?.feesOwed) != null;
  usePageTitle(W.page.title);
  const slug = currentOrg?.slug ?? '';
  const eyebrow = currentOrg && !isTournamentTier(currentOrg.planId) && !isTeamWorkspaceOrg(currentOrg)
    ? W.page.eyebrow : undefined;
  return <div className={ck.page}>
    <AdminPageHeader eyebrow={eyebrow} title={W.page.title} />
    <BillingBody billingBase={getBillingHref({ slug, planId: currentOrg?.planId }, { host: 'admin' })} teamsHref={`/${slug}/admin/rep-teams`} onFeesMayHaveChanged={reload} bannerCoversOverdue={bannerCoversOverdue} />
  </div>;
}
