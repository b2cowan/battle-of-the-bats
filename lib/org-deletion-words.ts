/**
 * THE DELETION REQUEST — every word the owner reads (Settings in both workspaces, Session 1; owner "as recommended",
 * 2026-11-20). Wording v0.2 from /legal: `docs/agents/legal/ORG_DELETION_REQUEST_WINDOW.md` § Recommendation (L-A and L-B
 * ruled 2026-11-20). One window and one text for the Premium Coaches Portal, the Tournament plans and the club's Settings
 * card (gate 4). Change a sentence here only through /legal: the window is where a customer reads what deletion means.
 *
 * Client-safe: plain words and one small rule (`deletionPaidUntil`). The record and the route live in
 * `lib/org-deletion-requests.ts`.
 */
import { formatStoredDate } from './timezone';
import { PLAN_CONFIG } from './plan-config';
import { possessive } from './utils';
import type { OrgPlan, SubscriptionStatus } from './types';

/** Which "What is deleted" an organization reads. */
export type DeletionWorkspace = 'premium' | 'tournament' | 'club';

/** Where the payments part sends the owner to export (`LEAVING_WORDS.delete.export`, the build check on "from Accounting"). */
export type DeletionExportFrom = 'accounting' | 'tournament_payouts' | 'settings_payouts';

export const PRIVACY_EMAIL = 'privacy@fieldlogichq.ca';

/** The request as the owner's page reads it (the open one, or none). */
export type OpenDeletionRequest = { id: string; sentAt: string; requesterEmail: string };

const date = (iso: string) => formatStoredDate(iso);

export const ORG_DELETION_WORDS = {
  section: {
    title: (name: string) => `Delete ${name}`,
    /** {what}: the team's Coaches Portal for Premium; the organization's name otherwise. */
    body: (what: string) => `Ask us to delete ${what} and everything in it. Nothing is deleted until you confirm by email.`,
    premiumWhat: 'this team’s Coaches Portal',
    door: 'Request deletion…',
    /** Until staff close it. With more than one owner the reply goes to all of them. */
    sent: (sentAt: string, to: string) => `Request sent ${date(sentAt)}. We’ll reply to ${to} within 30 days.`,
    owners: (name: string) => `${possessive(name)} owners`,
    loadFailed: 'We couldn’t check for a deletion request. Reload the page to try again.',
  },
  window: {
    title: (name: string) => `Ask us to delete ${name}?`,
    reply: (email: string) => `We’ll reply by email to ${email} within 30 days. Nothing is deleted until you confirm.`,
    replyOwners: (name: string) => `We’ll reply to ${possessive(name)} owners within 30 days. Nothing is deleted until you confirm.`,
    deletedHeading: 'What is deleted',
    deleted: {
      premium: 'The team’s Coaches Portal and everything in it: every season, the roster and families’ contact details, money records, documents, and the tournaments you run.',
      tournament: 'The organization and everything in it: every tournament with its teams, schedule, results and registrations, your staff list, and the payment records here.',
      club: 'The organization and everything in it: its seasons and teams, players’ and families’ contact details, registrations, money records, documents, and its tournaments.',
    } satisfies Record<DeletionWorkspace, string>,
    keepFirst: 'Download or print anything you need to keep first.',
    keptHeading: 'What isn’t',
    people: { premium: 'your coaches’', tournament: 'your staff’s', club: 'your staff’s and coaches’' } satisfies Record<DeletionWorkspace, string>,
    signIns: (people: string, name: string) =>
      `Your own sign-in, and ${people}. They lose access to ${name}. To close your own account, or to ask what we hold about you, email ${PRIVACY_EMAIL}.`,
    records: (name: string) => `Our records of what you bought, and a note that ${name} was deleted, by whom, when and why (our privacy policy, section 9).`,
    backups: 'Copies in our backups, which expire on their own.',
    /** The club's window only (owner 2026-11-20, call 2, /legal addendum): a coach's own linked Premium workspace survives. */
    coachPortalStays: (name: string) => `A coach’s own Coaches Portal stays theirs; it loses its link to ${name}.`,
    /** L-A, ruled 2026-11-20: only while a paid period runs. */
    paid: (plan: string, until: string, name: string) =>
      `${plan} is paid until ${date(until)}. We can delete ${name} then, or now. Deleting now ends ${plan} early, and the time left isn’t refunded. Tell us which when we reply.`,
    reasonLabel: 'Why are you leaving?',
    reasonOptional: '(optional)',
    // /legal 2026-11-20 addendum: the reason is kept after deletion (§9), and free text can name a person.
    reasonHint: 'For our records. Please don’t name anyone. You can leave it empty.',
    dismiss: 'Don’t send',
    send: 'Send deletion request',
    sending: 'Sending…',
    sendFailed: 'Your request wasn’t sent. Try again.',
  },
  /** The acknowledgement to every active owner (L-B). A reply to the owner's own request: nothing commercial (CASL). */
  email: {
    subject: (name: string) => `We received a request to delete ${name}`,
    asked: (requester: string, sentAt: string, name: string, slug: string) =>
      `${requester} asked us on ${date(sentAt)} to delete ${name} (fieldlogichq.ca/${slug}) and everything in it.`,
    // /legal 2026-11-20 addendum: "in answer to our reply" — "replying to that email" read as the email in front of them.
    reply: 'We’ll reply to the owners within 30 days. Nothing is deleted until an owner confirms in answer to our reply.',
    object: (name: string) => `If you’re an owner of ${name} and didn’t agree to this, reply to this email and tell us.`,
    signature: `FieldLogicHQ · ${PRIVACY_EMAIL}`,
  },
} as const;

/** The plan's name in the paid line: Premium's door says "Premium" ("Cancel Premium…"); other plans their own label. */
export function deletionPlanName(plan: OrgPlan): string {
  return plan === 'team' ? 'Premium' : PLAN_CONFIG[plan]?.label ?? plan;
}

/**
 * L-A: the paid line shows only while money paid for time that is still left — an active subscription on a paid plan with
 * a renewal date. Not in a trial, staff free time (stored cancelled), a failed payment, or once cancelled. A cancel that
 * waits for the period end is still active, and its time is still paid: the line shows.
 */
export function deletionPaidUntil(org: { subscriptionStatus: SubscriptionStatus | string; currentPeriodEnd?: string | null }, plan: OrgPlan): string | null {
  if (org.subscriptionStatus !== 'active' || !org.currentPeriodEnd) return null;
  return (PLAN_CONFIG[plan]?.monthlyPrice ?? 0) > 0 ? org.currentPeriodEnd : null;
}

/** Who the reply goes to: the one owner by email, or "{name}'s owners". */
export function deletionReplyTo(name: string, ownerCount: number, email: string): string {
  return ownerCount > 1 ? ORG_DELETION_WORDS.section.owners(name) : email;
}
