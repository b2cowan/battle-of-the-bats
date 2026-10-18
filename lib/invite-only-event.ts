/**
 * THE INVITE-ONLY EVENT — the one place that says how a tournament runs on the free Tournament plan and on a Premium
 * coach's hosted event (owner 2026-10-12, BUSINESS_DECISIONS.md "The free Tournament plan is the INVITE-ONLY event":
 * R1–R10 and the drawings' M1–M12; built 2026-10-16, FREE_TOURNAMENT_TIER_REVIEW_PLAN.md §12).
 *
 * On a plan without `open_registration` (the free Tournament plan, and `team`, whose event follows free plus PDFs) an
 * event is INVITE-ONLY: the host adds every team, and the coach's email is the invitation to claim it into their
 * Coaches Portal. Whole areas an invite-only event never uses are ABSENT, never locked (R5): public registration and
 * the review queue, the waitlist, fees and payment tracking, check-in and the gate job, the Staff kit and every
 * volunteer job, Tournament Chat, the Summary page's nav row, and a division's spots.
 *
 * No older event is grandfathered (B1, owner 2026-10-16: production held no event on the free plan, verified
 * read-only). What an invite-only event still shows is read from its OWN DATA (R2, M10): an event that took
 * registrations or set fees under a plan that had them (an organization that left Tournament Plus; the Founding Season
 * ends 2027-10-01) keeps those records readable — recorded payments read-only, a team still waiting acceptable or
 * declinable, and "Registration closed" where Teams used to say it was open.
 *
 * "Not tracked here" stays the one way the product says "no payments here" (`tournamentTracksPayments`): a new
 * invite-only event is created with it, and activation fills it in when the fee model is still undecided.
 *
 * Pure — safe on the client and in a plain Node unit test.
 */
import { hasPlanFeature, type PlanFeature } from './plan-features';
import { tournamentTracksPayments } from './tournament-payments-tracked';
import { CHAT_PAUSED } from './chat-pause';
import type { OrgPlan } from './types';

/** A plan id as the org row stores it; an unknown or missing one reads as the free plan (`isFreePlan`'s rule). */
type PlanLike = OrgPlan | string | null | undefined;

function feature(planId: PlanLike, key: PlanFeature): boolean {
  // PLAN_RANK has no entry for an unknown id, so its comparison is false: an unknown plan holds no paid feature.
  return planId ? hasPlanFeature(planId as OrgPlan, key) : false;
}

/** Does this plan run invite-only events (the host adds every team)? The free Tournament plan and the Premium Coaches Portal. */
export function runsInviteOnlyEvents(planId: PlanLike): boolean {
  return !feature(planId, 'open_registration');
}

/** The fee models that track payments ("Not tracked here" is `free`; none chosen yet is `null`). */
const TRACKED_FEE_SCOPES: ReadonlySet<string> = new Set(['tournament', 'allow_override', 'per_division']);

function feeScopeOf(settings: unknown): unknown {
  return settings && typeof settings === 'object' ? (settings as { fee_scope?: unknown }).fee_scope : undefined;
}

/**
 * How an event's payments read:
 *  - `edit` — a plan with payment tracking, on an event that tracks payments (today's behaviour);
 *  - `read` — an invite-only event whose fee model was set under a plan that tracked payments (R2): the Payment column
 *    and the record's figures stay readable, and "Record payments" is the lock where Mark paid was;
 *  - `none` — "Not tracked here", or an invite-only event whose fee model was never chosen: payments are absent.
 */
export type EventPayments = 'edit' | 'read' | 'none';

export function eventPayments(planId: PlanLike, settings: unknown): EventPayments {
  if (feature(planId, 'payment_tracking')) return tournamentTracksPayments(settings) ? 'edit' : 'none';
  return TRACKED_FEE_SCOPES.has(String(feeScopeOf(settings))) ? 'read' : 'none';
}

/** What an event shows. Every field but `payments` is the plan's; `payments` also reads the event's fee model. An
 *  invite-only event also has no public registration, waitlist or spots: `inviteOnly` says all three. */
export type EventAreas = {
  /** The host adds every team; the coach's email is the invitation. */
  inviteOnly: boolean;
  payments: EventPayments;
  /** The organizer's check-in screen and the gate job. */
  checkIn: boolean;
  /** The Staff kit and the volunteer role (scorekeeper and gate). */
  volunteers: boolean;
  /** Tournament Chat: its nav entry, its phone tab, the board's Coaches card. */
  chat: boolean;
  /** The Summary page and its nav row; on free the finished board's lock line is Summary's one door (R5). */
  summaryPage: boolean;
};

/** An area a page can be absent from (the plan decides it; never the event's data). */
export type PlanArea = 'checkIn' | 'volunteers' | 'chat' | 'summaryPage';

export function eventAreas(planId: PlanLike, settings?: unknown): EventAreas {
  return {
    inviteOnly: runsInviteOnlyEvents(planId),
    payments: eventPayments(planId, settings),
    checkIn: feature(planId, 'team_check_in'),
    volunteers: feature(planId, 'tournament_volunteers'),
    // ⚖ Chat is paused (2026-10-18, lib/chat-pause.ts): no event has the area, so the admin's rail and More lose Chat,
    // the phone bar shows Messages in its place (ruling P4 — the existing no-chat fallback) and the chat page redirects
    // to the dashboard (ruling P1). The plan key keeps its value.
    chat: !CHAT_PAUSED && feature(planId, 'tournament_chat'),
    summaryPage: feature(planId, 'post_tournament_summary'),
  };
}

/** A team still waiting for the host's answer: it registered before its event's organization lost registration (M10). */
export function isWaitingStatus(status: string | null | undefined): boolean {
  return status === 'pending' || status === 'waitlist';
}

/**
 * May the host move a team from one status to another? On an open event, as today. On an invite-only event only a team
 * still waiting can be answered — accepted or declined (M10); nothing joins the waitlist, and an added team is undone
 * by removing it (the record has no Registration section).
 */
export function statusChangeAllowed(planId: PlanLike, from: string | null | undefined, to: string): boolean {
  if (!runsInviteOnlyEvents(planId)) return true;
  return isWaitingStatus(from) && (to === 'accepted' || to === 'rejected');
}

/**
 * Is this person a volunteer on a plan without volunteers (R7)? Then the scorekeeper and the gate are shut to them; the
 * host, admins and staff keep Field scores (M3). Every volunteer surface asks this one question.
 */
export function volunteerShut(planId: PlanLike, role: string | null | undefined): boolean {
  return role === 'official' && !feature(planId, 'tournament_volunteers');
}

/** A team write's fields, as the admin routes accept them (camelCase from the screens, snake_case from older callers). */
const PAYMENT_FIELDS = ['paymentStatus', 'payment_status', 'depositPaid', 'deposit_paid', 'totalPaid', 'total_paid', 'paymentCollectedAt', 'payment_collected_at'];
const CHECK_IN_FIELDS = ['checkInStatus', 'check_in_status', 'checkedInAt', 'checked_in_at', 'checkInNotes', 'check_in_notes',
  'checkedInByUserId', 'checked_in_by_user_id', 'checkedInByName', 'checked_in_by_name'];

/**
 * May this update be written to a team (B2: the server holds what the screens hide)? On a plan without payment
 * tracking no payment field moves (an invite-only event's recorded payments stay readable, R2); without check-in no
 * check-in field moves; and a status moves only as `statusChangeAllowed` says. A paid plan's writes are unchanged.
 */
export function teamUpdateAllowed(planId: PlanLike, currentStatus: string | null | undefined, updates: Record<string, unknown>): boolean {
  const sets = (keys: string[]) => keys.some(k => updates[k] !== undefined);
  if (!feature(planId, 'payment_tracking') && sets(PAYMENT_FIELDS)) return false;
  if (!feature(planId, 'team_check_in') && sets(CHECK_IN_FIELDS)) return false;
  const to = updates.status;
  if (typeof to === 'string' && to !== currentStatus && !statusChangeAllowed(planId, currentStatus, to)) return false;
  return true;
}

/**
 * Does an invite-only event hold registration-era records (R2)? A team that registered and is still waiting or was
 * declined, or a fee model set under a plan that tracked payments. Only registration (or Tournament Plus) leaves
 * either behind, so Teams says "Registration closed" — with "Reopen registration" as its lock — only on such an event.
 */
export function holdsRegistrationRecords(settings: unknown, teamStatuses: Iterable<string | null | undefined>): boolean {
  if (TRACKED_FEE_SCOPES.has(String(feeScopeOf(settings)))) return true;
  for (const s of teamStatuses) if (s === 'pending' || s === 'waitlist' || s === 'rejected') return true;
  return false;
}
