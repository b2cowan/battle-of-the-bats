'use client';
/** Admin chrome and destinations only; every plan shares the billing body. */
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { TabPageHeader } from './PlaceFrame';
import BillingBody from '@/components/billing/BillingBody';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { getBillingHref, isTournamentTier } from '@/lib/billing-urls';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import ck from './ClubKit.module.css';
import { NotYours } from './NotYours';

export default function BillingKit() {
  const { currentOrg, userRole } = useOrg();
  usePageTitle(W.page.title);
  const slug = currentOrg?.slug ?? '';
  const eyebrow = currentOrg && !isTournamentTier(currentOrg.planId) && !isTeamWorkspaceOrg(currentOrg)
    ? W.page.eyebrow : undefined;
  // ⚖ Ask 6 = A (Club Tier Stage 13a, F-A5-9): in the admin, the ONE "not yours" screen, the owner's-only voice, in place of
  // the page. The body's own locked card stays for the Coaches Portal's billing, which shares it.
  if (currentOrg && userRole && userRole !== 'owner') return <NotYours page="billing" />;
  return <div className={ck.page}>
    {/* ⚖ Admin header Phase 3 (round 5, Q1): a club's header names Plan & billing, so the paper title goes; a tournament-only
        organization's copy (under Settings & access) keeps it, its header naming the organization (Q6). */}
    <TabPageHeader eyebrow={eyebrow} title={W.page.title} />
    <BillingBody billingBase={getBillingHref({ slug, planId: currentOrg?.planId }, { host: 'admin' })} teamsHref={`/${slug}/admin/rep-teams`} />
  </div>;
}
