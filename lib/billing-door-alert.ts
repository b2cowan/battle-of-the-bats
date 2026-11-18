/**
 * The pill on the Plan & billing door (rail + phone More): a plan payment that didn't go through (Fee invoice alerts Part 2,
 * Ask 7), read from the org's own `subscriptionStatus` — no fetch.
 *
 * ONE small, client-safe module so the rail and the phone's More pill can never say two things, and the rail's bundle does not
 * pull the whole plan-billing words file. Components never type the label (`plan-billing-source-guard`);
 * `PLAN_BILLING_WORDS.billingDoorAlert` is this same object.
 *
 * Stripe-owned pricing Stage 4 (2026-11-18) retired the other half of this pill — FieldLogicHQ's own monthly invoice for
 * Stripe's fees, amber while open and red once overdue — with the invoice itself: Stripe now takes those fees from the club's
 * own balance. What is left is always amber, and always one.
 */
export const BILLING_DOOR_ALERT_WORDS = {
  planPaymentFailed: 'Plan payment didn’t go through',
} as const;

export type BillingDoorAlert = { count: 1; tone: 'amber'; label: string };

/** The pill, or null when nothing waits. `planPastDue` is an owner-only fact: the caller passes it only when the person has the
 *  billing door (`billingLink != null`). */
export function billingDoorAlertFor(planPastDue: boolean): BillingDoorAlert | null {
  return planPastDue ? { count: 1, tone: 'amber', label: BILLING_DOOR_ALERT_WORDS.planPaymentFailed } : null;
}
