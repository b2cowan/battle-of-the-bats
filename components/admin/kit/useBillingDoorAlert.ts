'use client';
/**
 * useBillingDoorAlert — the pill on the Plan & billing door (a plan payment that didn't go through), read ONCE for the rail and
 * the phone bar so they can never say two things. Null unless the person holds the billing door: `billingLink != null` IS the
 * client-side owner test (it is `hasBillingAccess` — `kitBillingLink`). No fetch: it is the org's own
 * `subscriptionStatus`. (Stripe-owned pricing Stage 4 retired the fee-invoice half, and with it the club brief's `feesOwed`.)
 */
import { useOrg } from '@/lib/org-context';
import { billingDoorAlertFor, type BillingDoorAlert } from '@/lib/billing-door-alert';
import { useAdminKitNav } from './useAdminKitNav';

export function useBillingDoorAlert(): BillingDoorAlert | null {
  const { billingLink } = useAdminKitNav();
  const { currentOrg } = useOrg();
  if (!billingLink) return null;
  return billingDoorAlertFor(currentOrg?.subscriptionStatus === 'past_due');
}
