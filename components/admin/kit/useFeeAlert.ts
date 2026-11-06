'use client';
/**
 * useFeeAlert — the pill on the Plan & billing door (Fee invoice alerts, Part 2), read ONCE for the rail and the phone bar
 * so they can never say two things. Null unless the person holds the billing door: `billingLink != null` IS the client-side
 * owner test (it is `hasBillingAccess` and not a sandbox — `kitBillingLink`); the route sends `feesOwed` only to someone with
 * `hasBillingAccess` (a sandbox owner gets the figure from the route but never sees it here).
 * The failed-plan-payment half needs no fetch: it is the org's own `subscriptionStatus`.
 */
import { useOrg } from '@/lib/org-context';
import { feeAlertFor, type FeeAlert } from '@/lib/fee-invoice-alert';
import { useAdminKitNav } from './useAdminKitNav';
import { useClubBrief } from './club/ClubBriefProvider';

export function useFeeAlert(): FeeAlert | null {
  const { billingLink } = useAdminKitNav();
  const { currentOrg } = useOrg();
  const { brief } = useClubBrief();
  if (!billingLink) return null;
  return feeAlertFor(brief?.feesOwed, currentOrg?.subscriptionStatus === 'past_due');
}
