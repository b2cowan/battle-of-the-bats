'use client';
/** Minimal Club host. Other admin plans keep their existing screen until Part 3. */
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import BillingBody from '@/components/billing/BillingBody';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import ck from './ClubKit.module.css';

export default function BillingKit() {
  const { currentOrg } = useOrg();
  usePageTitle(W.page.title);
  const slug = currentOrg?.slug ?? '';
  return <div className={ck.page}>
    <AdminPageHeader eyebrow={W.page.eyebrow} title={W.page.title} />
    <BillingBody billingBase={`/${slug}/admin/org/billing`} teamsHref={`/${slug}/admin/rep-teams`} />
  </div>;
}
