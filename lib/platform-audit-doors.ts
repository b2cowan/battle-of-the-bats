/**
 * The doors an audit-log entry's window offers (owner, 2026-10-25: "a button for more information" — drawn in
 * `docs/projects/active/PLATFORM_AUDIT_ENTRY_WINDOW_MOCKUP.html`, ruled as recommended).
 *
 * ⚖ AT MOST TWO, and two is a CEILING (the budget report's drill-in rule). A door appears only when the entry carries
 * enough to find its target: an org door needs an org that still exists, and a door to a screen the viewer's role cannot
 * open is dropped rather than left to dead-end (`canView`). An entry with nothing to open gets none.
 * ⚖ A door is named for the console menu's name for the place it opens (Leads, Staff, Bulk changes…), never its old name.
 *   The one ruled exception is "Open org" (owner, 2026-10-25, ask 6): this page's own column says Org.
 * ⚖ There is no Revert door and there never will be one from here: an entry holds the old value of ONE field, not the
 * record around it, so reversing from the log would be a guess. The way back is the org's own screen.
 *
 * Pure (no JSX, no server calls) so `tests/unit/platform-audit-doors.test.ts` can pin it.
 */
import type { PlatformArea } from './platform-areas.ts';

/** The actor the platform's own scheduler writes (the cron routes); a person who runs the same job by hand writes their email. */
export const SCHEDULER_ACTOR = 'cron-scheduler';

export type AuditDoor = { label: string; href: string };

type Target = AuditDoor & { area: PlatformArea };

const FEEDBACK: Target = { label: 'Open Feedback', href: '/platform-admin/feedback', area: 'feedback' };
const LEADS: Target = { label: 'Open Leads', href: '/platform-admin/early-access', area: 'early_access' };
const PLANS: Target = { label: 'Open Plans & pricing', href: '/platform-admin/plans-pricing', area: 'plans_pricing' };
const APPROVALS: Target = { label: 'Open Approval queue', href: '/platform-admin/change-requests', area: 'change_requests' };
const STAFF: Target = { label: 'Open Staff', href: '/platform-admin/users', area: 'platform_users' };
const BULK: Target = { label: 'Open Bulk changes', href: '/platform-admin/bulk-operations', area: 'bulk_operations' };
const ERRORS: Target = { label: 'Open Errors', href: '/platform-admin/observability', area: 'observability' };
const DECKS: Target = { label: 'Open Pitch decks', href: '/platform-admin/pitch-deck-studio', area: 'pitch_deck_studio' };
const CAMPAIGNS: Target = { label: 'Open Campaigns', href: '/platform-admin/email', area: 'email' };
const PEOPLE: Target = { label: 'Open People', href: '/platform-admin/customer-users', area: 'customer_users' };

/** What each kind of entry is ABOUT, when that is a screen rather than an org. */
const TARGET_BY_ACTION: Record<string, Target> = {
  update_feedback_status: FEEDBACK,
  escalate_feedback: FEEDBACK,
  clear_feedback_escalation: FEEDBACK,
  update_early_access_lead: LEADS,
  link_early_access_lead: LEADS,
  unlink_early_access_lead: LEADS,
  dismiss_early_access_offer: LEADS,
  add_early_access_note: LEADS,
  remove_early_access_note: LEADS,
  copy_early_access_emails: LEADS,
  export_early_access_leads: LEADS,
  update_plan_gating: PLANS,
  update_stripe_price_id: PLANS,
  update_plan_config_override: PLANS,
  publish_feature_matrix_entitlements: PLANS,
  create_catalog_campaign: CAMPAIGNS,
  update_catalog_campaign_status: CAMPAIGNS,
  generate_reset_link: PEOPLE,
  create_catalog_change_request: APPROVALS,
  update_catalog_change_request_status: APPROVALS,
  invite_platform_user: STAFF,
  update_platform_user: STAFF,
  remove_platform_user: STAFF,
  run_bulk_operation: BULK,
  update_error_group_status: ERRORS,
  create_pitch_deck: DECKS,
  update_pitch_deck: DECKS,
  save_pitch_deck: DECKS,
  delete_pitch_deck: DECKS,
  clear_pitch_deck: DECKS,
  save_pitch_page_pull: DECKS,
  clear_pitch_page_pull: DECKS,
  update_user: PEOPLE,
  ban_user: PEOPLE,
  unban_user: PEOPLE,
  delete_user: PEOPLE,
  create_user_note: PEOPLE,
  delete_user_note: PEOPLE,
  confirm_email: PEOPLE,
  revoke_sessions: PEOPLE,
};

/**
 * An entry the platform's own scheduler wrote: a tick or sweep that covers every club, so there is nothing to open. The
 * same job run by hand (a super admin's "run now") writes the person's email, and that entry is theirs, not the scheduler's.
 */
export function isScheduledEntry(action: string, actorEmail: string): boolean {
  return /_(tick|sweep)$/.test(action) && actorEmail === SCHEDULER_ACTOR;
}

export function auditDoors({
  action, orgId, orgName, orgEntriesHref, canView, scheduled = false,
}: {
  action: string;
  /** The scheduler's own entry (`isScheduledEntry`): nothing to open. */
  scheduled?: boolean;
  orgId: string | null;
  orgName: string | null;
  /** The audit log filtered to this org (the row's own Filter link), built by the page so it keeps the other filters. */
  orgEntriesHref: string;
  canView: (area: PlatformArea) => boolean;
}): AuditDoor[] {
  if (scheduled) return [];
  const hasOrg = !!orgId && !!orgName && canView('organizations');
  const orgDoor: AuditDoor | null = hasOrg ? { label: 'Open org', href: `/platform-admin/orgs/${orgId}` } : null;
  const target = TARGET_BY_ACTION[action];
  const targetDoor: AuditDoor | null = target && canView(target.area) ? { label: target.label, href: target.href } : null;

  if (target) return [targetDoor, orgDoor].filter((d): d is AuditDoor => d !== null);
  if (orgDoor) return [orgDoor, { label: "Show this org's entries", href: orgEntriesHref }];
  return [];
}
