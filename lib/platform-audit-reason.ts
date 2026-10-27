/**
 * Which audit entries never carry a reason (Support console Stage 3, owner Q6 2026-10-26): the product's own jobs and the
 * console's work tools. Every other entry is a staff change that asks why, so one without a reason reads "Not recorded"
 * (an entry written before Stage 2 asked) rather than "—". Plain, with no database client, so the audit screen and its
 * export share it. The writers' side of the same list is `tests/unit/platform-audit-reason-guard.test.ts`.
 */
const NO_REASON = new Set([
  // The product's own jobs (and the same job run by hand).
  'club_domains_tick', 'coach_sandbox_tick', 'demo_sandbox_tick', 'dues_reminders_sweep', 'club_hand_back_sweep',
  'insights_digest_sweep', 'schedule_change_notices_sweep', 'observability_sweep', 'create_platform_metric_snapshot',
  'process_billing_retention_expiry', 'team_workspace_created', 'demo_world_seeded',
  // The console's work tools: the record is its own reason.
  'create_internal_note', 'update_internal_note', 'delete_internal_note', 'create_user_note', 'delete_user_note',
  'save_pitch_deck', 'update_pitch_deck', 'create_pitch_deck', 'clear_pitch_deck', 'delete_pitch_deck',
  'save_pitch_page_pull', 'clear_pitch_page_pull', 'create_catalog_campaign', 'update_catalog_campaign_status',
  'create_catalog_change_request', 'update_catalog_change_request_status', 'escalate_feedback',
  'clear_feedback_escalation', 'update_feedback_status', 'update_error_group_status', 'update_early_access_lead',
  // Staff roles: a reason arrives when Stage 8 draws Staff.
  'invite_platform_user', 'update_platform_user', 'remove_platform_user',
  // 12d-1 Part 4: the Stripe-fees job, and a retry of a fee that couldn't be billed (the fee's own error is its reason).
  'stripe_fees_sweep', 'retry_stripe_fee',
]);

/**
 * A refund's entries (Stage 3): money, so their reason and details are read only by the roles that read Stripe (A2:
 * Super admin, Billing, Support). The typed reason can hold a customer's details. Every other role sees that one was made.
 */
export function isMoneyEntry(action: string): boolean {
  return action.startsWith('refund_charge');
}
export const MONEY_ENTRY_HIDDEN = 'Shown to Super admin, Billing and Support';

/**
 * A lead's entries (Stage 7 Part 0, owner Q10 2026-10-27): entries written before Part 0 hold the whole lead (a
 * stranger's name, address, organization and words, and staff notes), so every lead entry's details are read only by the
 * growth power (Super admin, Product, Growth). Every other role sees the entry, its action, actor and time.
 */
export function isLeadEntry(action: string): boolean {
  return action === 'update_early_access_lead';
}
export const LEAD_ENTRY_HIDDEN = 'Lead details are shown to the roles that work leads.';

/** The one line that stands in for an entry's reason and details when this reader may not see them, else null. */
export function hiddenEntryLine(action: string, reads: { money: boolean; leads: boolean }): string | null {
  if (!reads.money && isMoneyEntry(action)) return MONEY_ENTRY_HIDDEN;
  if (!reads.leads && isLeadEntry(action)) return LEAD_ENTRY_HIDDEN;
  return null;
}

/** The words in an entry's Reason cell: the reason, "Not recorded" for a staff change without one, else null ("—"). */
export function auditReasonText(action: string, reason: string | null | undefined): { text: string | null; notRecorded: boolean } {
  const r = typeof reason === 'string' ? reason.trim() : '';
  if (r) return { text: r, notRecorded: false };
  if (NO_REASON.has(action)) return { text: null, notRecorded: false };
  return { text: 'Not recorded', notRecorded: true };
}
