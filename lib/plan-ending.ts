/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A PLAN ENDS ON ITS RENEWAL DATE (owner ruling 2026-10-31; PLAN_ENDS_AT_RENEWAL_PLAN.md, Stage 1).
 *
 * The customer paid ahead and there is no refund, so nothing they paid for is taken away early. A cancel — by the owner,
 * by us, or in Stripe's own portal — is SCHEDULED: Stripe holds `cancel_at_period_end`, and a `billing_retention_intents`
 * row with status 'pending' and effective_at = the end date records it. Nothing is archived, suspended, hidden or closed
 * at the click. On the end date Stripe deletes the subscription and the ONE ending below (`applyEnding`) runs. Keep {Plan}
 * withdraws the row ('canceled'). A platform admin's End now and an account with no real Stripe subscription (comped,
 * Founding Season, a dev `mock_…` id) end at once — through the same ending.
 *
 * This module is the logic only. Every database, Stripe and email step is a dependency (`EndingDeps`), so the rules are
 * tested with an in-memory store (tests/unit/plan-ending.test.ts); lib/plan-ending-server.ts wires the real ones.
 *
 * ⚠⚠ THE ENDING IS SAFE TO RUN TWICE (gap review G7). A Stripe event that dies part-way is sent again whole. Every step
 * checks what the first run did — records are inserted only where this intent has none, only un-archived tournaments are
 * archived, the event and the email are keyed to the intent — and the row flips pending → applied LAST, so a replay after
 * a crash finishes the work and a replay after success does nothing.
 *
 * ⚠⚠ ONE RULE FOR A SUBSCRIPTION'S FUTURE (Plans & pricing G5, owner sequence ruling 3). A cheaper-plan move waiting at
 * renewal is CARRIED by a cancel (remembered on the row), PUT BACK by Keep, DROPPED on the record when the plan ends, and
 * any other change while a cancel waits is REFUSED in plain words. `futureMoveAnswer` is that rule, in one place.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import type Stripe from 'stripe';
import type { OrgPlan } from './types';
import type { BillingTournamentSummary } from './billing-retention-types';
import { PLAN_BILLING_WORDS as W } from './plan-billing-words';

/** Stripe retries a failed webhook for up to three days; a waiting cancel still pending after that has been missed (G3). */
export const OVERDUE_GRACE_DAYS = 3;
export const DAY_MS = 86_400_000;

/** Who acted. `stripe_portal` is the customer in Stripe's own billing portal; `stripe` is Stripe ending it by itself. */
export type EndingDoor = 'owner' | 'operator' | 'stripe_portal' | 'stripe' | 'system';
export type EndingStatus = 'pending' | 'applied' | 'canceled' | 'restored' | 'purged';

export type EndingLogEntry = {
  at: string;
  action: 'scheduled' | 'rescheduled' | 'kept' | 'withdrawn' | 'ended';
  door: EndingDoor;
  by: string | null;
  /** What happened to a cheaper-plan move waiting at renewal (the one rule above). */
  move?: 'carried' | 'restored' | 'restore_failed' | 'dropped';
  plan?: OrgPlan | null;
  note?: string;
};

export type EndingIntent = {
  id: string;
  orgId: string;
  status: EndingStatus;
  effectiveAt: string;
  retentionUntil: string;
  reason: string | null;
  fromPlan: string | null;
  createdBy: string | null;
  createdByEmail: string | null;
  appliedAt: string | null;
  stripeSubscriptionId: string | null;
  heldMovePlan: OrgPlan | null;
  notifyOwner: boolean;
  endedEmailSentAt: string | null;
  /** The once-only stamps of the three Part C emails (G6): set when the email was claimed and went. */
  endsOnEmailSentAt: string | null;
  reminderEmailSentAt: string | null;
  keptEmailSentAt: string | null;
  createdAt: string;
  changeLog: EndingLogEntry[];
};

export type NewEndingIntent = Omit<EndingIntent,
  'id' | 'status' | 'appliedAt' | 'endedEmailSentAt' | 'endsOnEmailSentAt' | 'reminderEmailSentAt' | 'keptEmailSentAt' | 'createdAt'> & { status: 'pending' };
export type EndingIntentPatch = Partial<Omit<EndingIntent, 'id' | 'orgId'>>;

/** The account a cancel is about. A Coaches Portal's subscription may sit only on its workspace row. */
export type EndingAccount = {
  orgId: string;
  name: string;
  slug: string;
  ownPlan: OrgPlan;
  accountKind: string | null;
  enabledAddons: string[];
  isCoachesPortal: boolean;
  teamWorkspaceId: string | null;
  subscriptionStatus: string | null;
  /** The org's subscription id, else the workspace's. May be a dev `mock_…` id — never a test for "has one" on its own. */
  subscriptionId: string | null;
};

export type EndingActor = { door: EndingDoor; userId: string | null; email: string | null };

export type RetainedRecordRow = {
  intentId: string;
  orgId: string;
  recordType: 'tournament' | 'account';
  recordId: string | null;
  displayName: string;
  retentionUntil: string;
  metadata: Record<string, unknown>;
};

export type CancelClear = 'period_end' | 'cancel_at';

export interface EndingDeps {
  now(): Date;
  retentionDays(account: EndingAccount): number;

  findPending(orgId: string): Promise<EndingIntent | null>;
  /** The applied ending of THIS subscription: its own id on the row, or (older rows, no id) applied after it was created. */
  findAppliedFor(orgId: string, subscriptionId: string, subscriptionCreatedAt: string | null): Promise<(EndingIntent & { intentType: 'cancellation' | 'downgrade' }) | null>;
  /** Resolves 'conflict' when the one-pending-cancel index refused it (someone else's row landed first). */
  insertIntent(row: NewEndingIntent): Promise<EndingIntent | 'conflict'>;
  /** Writes only while the row's status is one of `onlyIf`; null when it was not (another writer moved it). */
  updateIntent(id: string, patch: EndingIntentPatch, onlyIf: EndingStatus[]): Promise<EndingIntent | null>;

  /** Read at the END date, never the click: what is still un-archived and what the plan switches off. */
  preflight(account: EndingAccount): Promise<{ tournaments: BillingTournamentSummary[]; shutsDown: string[] }>;
  recordedFor(intentId: string): Promise<Array<{ recordType: string; recordId: string | null }>>;
  /** Supersedes OTHER intents' live records for these tournaments (a stale one would break the unique index). */
  supersedeOthers(orgId: string, tournamentIds: string[], intentId: string): Promise<void>;
  insertRecords(rows: RetainedRecordRow[]): Promise<void>;
  archive(orgId: string, tournamentIds: string[]): Promise<void>;
  suspend(account: EndingAccount, p: { endedAt: string; reason: string | null }): Promise<void>;
  closePayPages(orgId: string, where: PayPagesWhere): Promise<void>;
  writeEndedEvent(p: EndedEvent): Promise<void>;
  sendEndedEmail(p: { account: EndingAccount; intentId: string; retentionUntil: string; retainedTournaments: number; askedBy: string | null }): Promise<void>;

  /**
   * The once-only claim of a Part C email (G6): stamps it only while it is unstamped and the row's status is one of
   * `onlyIf`, and resolves the stamp written — null when another run (or the webhook) had already claimed it.
   */
  claimEmail(intentId: string, stamp: EndingEmailStamp, onlyIf: EndingStatus[]): Promise<string | null>;
  /** Hands a claim back after a send that did not go, so a later run tries again (only while the stamp is still ours). */
  releaseEmail(intentId: string, stamp: EndingEmailStamp, claimedAt: string): Promise<void>;
  /** 'sent' (or the email service is switched off here); 'not_sent' when nothing went — refused outright, nobody to send to,
   *  or it failed before the send; 'unknown' when it may have gone (no answer, a 5xx, a 429, a key still in flight). */
  sendEndingEmail(email: EndingEmail): Promise<EmailSendOutcome>;
  /** What our record does once Stripe confirms a deletion (the webhook's own, after its ending): the subscription fields cleared. */
  clearEndedSubscription(account: EndingAccount, sub: Stripe.Subscription): Promise<void>;

  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  scheduleCancel(id: string): Promise<Stripe.Subscription>;
  clearCancel(id: string, clear: CancelClear): Promise<Stripe.Subscription>;
  releaseSchedule(scheduleId: string): Promise<void>;
  /** Puts a cheaper-plan move back at renewal through the ordinary move (never a hand-built schedule). */
  rescheduleMove(account: EndingAccount, plan: OrgPlan, actor: string): Promise<{ ok: true } | { ok: false; error: string }>;
}

export type PayPagesWhere = 'owner cancel' | 'operator cancel' | 'stripe suspension';

/** The three Part C emails (G6), each stamped once on its row. The "cancelled" email on the end date is `sendEndedEmail`. */
export type EndingEmailStamp = 'ends_on' | 'reminder' | 'kept';
export type EmailSendOutcome = 'sent' | 'not_sent' | 'unknown';
export type EndingEmail =
  /** "Your plan ends on {date}" — once per waiting cancel, whichever door it came through. */
  | { kind: 'ends_on'; account: EndingAccount; intent: EndingIntent }
  /** Seven days before the end, from the daily job. */
  | { kind: 'reminder'; account: EndingAccount; intent: EndingIntent }
  /** Keep {Plan}: "renews on {date}", or "renews as {cheaper plan}" when the move came back (G1). */
  | { kind: 'kept'; account: EndingAccount; intent: EndingIntent; door: EndingDoor; renewsOn: string | null; renewsAs: OrgPlan | null };

export type EndedEvent = {
  account: EndingAccount;
  intentId: string;
  source: 'app' | 'stripe';
  requestedBy: EndingDoor;
  actorUserId: string | null;
  actorEmail: string | null;
  reason: string | null;
  endedAt: string;
  retentionUntil: string;
  retainedTournamentIds: string[];
  /** The idempotency key: one `subscription_canceled` per ending, whichever door, whichever replay. */
  sourceEventId: string;
};

// ── Pure rules ───────────────────────────────────────────────────────────────────────────────────

const PAYING = new Set(['active', 'trialing', 'past_due']);
const ENDED = new Set(['canceled', 'incomplete_expired']);
const MOVE_PLANS: ReadonlySet<string> = new Set(['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large']);

function iso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

/** A real Stripe subscription the account is paying on: a `sub_…` id in a paying status. A `mock_…` id is not one. */
export function hasRealSubscription(account: Pick<EndingAccount, 'subscriptionId' | 'subscriptionStatus'>): boolean {
  return !!account.subscriptionId?.startsWith('sub_') && PAYING.has(account.subscriptionStatus ?? '');
}

/**
 * A real Stripe subscription that is NOT paying (unpaid, incomplete, paused) has no date to wait for, so a cancel ends the plan
 * now — and Stripe must be told to stop it too, or it stays open and a late payment could switch the plan back on. Null for
 * a paying one (it waits, or End now stops it by name), for one Stripe already ended, and for a dev `mock_…` id.
 */
export function stripeIdToStopNow(account: Pick<EndingAccount, 'subscriptionId' | 'subscriptionStatus'>): string | null {
  if (hasRealSubscription(account) || ENDED.has(account.subscriptionStatus ?? '')) return null;
  return account.subscriptionId?.startsWith('sub_') ? account.subscriptionId : null;
}

/**
 * G8 · Stripe says a cancel is scheduled two ways: `cancel_at_period_end`, or a dated `cancel_at` (a Dashboard "custom
 * date", flexible billing). Either one is a waiting cancel; it is withdrawn only when BOTH are clear. The date is
 * `cancel_at` when set, else the item's period end (a trial's end while trialing, which Stripe keeps there too).
 */
export function stripeCancelSignal(sub: Pick<Stripe.Subscription, 'cancel_at' | 'cancel_at_period_end' | 'status' | 'trial_end' | 'items'>): {
  scheduled: boolean; endsAt: string | null; clear: CancelClear;
} {
  const scheduled = !!sub.cancel_at_period_end || !!sub.cancel_at;
  const itemEnd = sub.items?.data?.[0]?.current_period_end ?? null;
  const endsAt = iso(sub.cancel_at) ?? (sub.status === 'trialing' ? iso(sub.trial_end) ?? iso(itemEnd) : iso(itemEnd));
  return { scheduled, endsAt, clear: sub.cancel_at_period_end ? 'period_end' : 'cancel_at' };
}

/** G3 · A waiting cancel past its date by more than Stripe's retry window: the deletion was missed. */
export function isOverdueEnding(intent: Pick<EndingIntent, 'status' | 'effectiveAt'>, now: Date): boolean {
  if (intent.status !== 'pending') return false;
  return new Date(intent.effectiveAt).getTime() + OVERDUE_GRACE_DAYS * DAY_MS < now.getTime();
}

/**
 * When the plan ENDED — the instant the data clock (the retention window) starts. Stripe's own `ended_at` when it has one;
 * otherwise the earlier of the scheduled date and now: an early end (End now, a card that failed for good) starts the
 * clock now, and an overdue one starts it on the day it should have ended (Stage 0 ruling 6), not the day it was finished.
 */
export function endedAtFor(intent: Pick<EndingIntent, 'effectiveAt'> | null, now: Date, stripeEndedAt?: string | null): string {
  if (stripeEndedAt) return stripeEndedAt;
  if (!intent) return now.toISOString();
  return new Date(intent.effectiveAt).getTime() < now.getTime() ? intent.effectiveAt : now.toISOString();
}

/**
 * `retentionDeadline` in lib/billing-retention.ts, from the instant the plan ended. Whole UTC days, so the stored date is the
 * same on any host and equals the sum the billing words show (`retainedUntil` in lib/plan-billing-words.ts).
 */
export function retentionUntilFrom(endedAt: string, days: number): string {
  const d = new Date(endedAt);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/**
 * A stored renewal date the page may promise as an end date: only one still ahead. A date already past (an invoice webhook
 * that never landed) is treated like a missing one (Part B review, owner 2026-11-02) — never "ends on" a day already gone.
 */
export function upcomingDate(iso: string | null | undefined, now: Date): string | null {
  return iso && new Date(iso).getTime() > now.getTime() ? iso : null;
}

/** The seven-day reminder (G6 c). */
export const REMINDER_DAYS = 7;
/** How long a keep that is putting a cheaper move back owns its row against Stripe's own "renewed" event. */
export const KEEP_IN_PROGRESS_MS = 15 * 60_000;

/**
 * A Keep {Plan} under way: the row's last entry is a person's keep, minutes old, and the row still waits. Keep marks the
 * row so before the slow calls that put a cheaper move back; Stripe's "renewed" event (fired by Keep's own clear) then
 * leaves the row alone instead of reading it as a Renew in its portal — and a keep that died part-way leaves the row
 * waiting, so Keep again finishes it, the move included (/review 2026-11-02).
 */
export function keepInProgress(intent: Pick<EndingIntent, 'status' | 'changeLog'>, now: Date): boolean {
  const last = intent.changeLog.at(-1);
  return intent.status === 'pending' && last?.action === 'kept' && last.door !== 'stripe_portal'
    && now.getTime() - new Date(last.at).getTime() < KEEP_IN_PROGRESS_MS;
}

/** Whole days past an overdue ending's date (the record's band, the retention page's "Days over"). */
export function daysOverdue(intent: Pick<EndingIntent, 'effectiveAt'>, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(intent.effectiveAt).getTime()) / DAY_MS));
}

/** The door a waiting cancel came through: its first log entry (the ends-on email's first sentence, the reminder's). */
export function askingDoor(intent: Pick<EndingIntent, 'changeLog'>): EndingDoor {
  return intent.changeLog[0]?.door ?? 'owner';
}

/** What an ends-on or reminder email says about time: whether the reminder is still to come, and the days left. */
export function endingEmailTiming(intent: Pick<EndingIntent, 'effectiveAt'>, now: Date): { remindLater: boolean; daysLeft: number } {
  const left = new Date(intent.effectiveAt).getTime() - now.getTime();
  return { remindLater: left >= REMINDER_DAYS * DAY_MS, daysLeft: Math.max(1, Math.ceil(left / DAY_MS)) };
}

/** When the cancel was made: its first "scheduled" entry (a later Stripe date move is not a new click), else the row's birth. */
export function clickedAt(intent: Pick<EndingIntent, 'changeLog' | 'createdAt'>): string {
  return intent.changeLog.find(e => e.action === 'scheduled')?.at ?? intent.createdAt;
}

/**
 * G6 c · the reminder is due once the end is seven days away or less — never for a withdrawn row, one the owner is not to
 * be told about, one already reminded, one whose date has passed, or one made with under seven days left at the click.
 */
export function reminderDue(
  intent: Pick<EndingIntent, 'status' | 'effectiveAt' | 'notifyOwner' | 'reminderEmailSentAt' | 'changeLog' | 'createdAt'>, now: Date,
): boolean {
  if (intent.status !== 'pending' || !intent.notifyOwner || intent.reminderEmailSentAt) return false;
  const end = new Date(intent.effectiveAt).getTime();
  if (end <= now.getTime() || end - now.getTime() > REMINDER_DAYS * DAY_MS) return false;
  return end - new Date(clickedAt(intent)).getTime() >= REMINDER_DAYS * DAY_MS;
}

/** The click's "ends on" email that never went (a send that failed): the daily job sends it, once, while the date is ahead. */
export function endsOnEmailOwed(intent: Pick<EndingIntent, 'status' | 'effectiveAt' | 'notifyOwner' | 'endsOnEmailSentAt'>, now: Date): boolean {
  return intent.status === 'pending' && intent.notifyOwner && !intent.endsOnEmailSentAt && new Date(intent.effectiveAt).getTime() > now.getTime();
}

const STAMP_STATUS: Record<EndingEmailStamp, EndingStatus[]> = { ends_on: ['pending'], reminder: ['pending'], kept: ['canceled'] };

/**
 * ⚠⚠ ONE EMAIL, NOT TWO (G6, G7). The email service forgets a repeat after 24 hours — exactly the daily job's beat — so
 * the row is the guard: claim the stamp FIRST (only one run, door or webhook wins it), then send. Only a send that
 * certainly did NOT go hands the claim back for the next run; one that MAY have gone (no answer, a 5xx) keeps it — and so
 * does the process dying between the claim and the send. Either way that one email is lost rather than sent twice (owner
 * ruled 2026-11-02: a missed reminder beats two; /review 2026-11-02). Never throws: an email never fails the cancel, the
 * keep or the job step that carries it.
 */
export async function sendEndingEmailOnce(email: EndingEmail, notify: boolean, deps: EndingDeps): Promise<'sent' | 'off' | 'already' | 'failed'> {
  if (!notify) return 'off';
  const stamp: EndingEmailStamp = email.kind;
  try {
    const claimedAt = await deps.claimEmail(email.intent.id, stamp, STAMP_STATUS[stamp]);
    if (!claimedAt) return 'already';
    const went = await deps.sendEndingEmail(email).catch((): EmailSendOutcome => 'unknown');
    if (went === 'sent') return 'sent';
    if (went === 'not_sent') await deps.releaseEmail(email.intent.id, stamp, claimedAt).catch(() => undefined);
    return 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Review S4 · the applied ending that belongs to THIS subscription, from an account's applied rows (newest first): its own
 * id on the row, or — older rows, written before the id was kept — applied after the subscription was created. A downgrade
 * counts only when it was to the free plan (a paid→paid one never ended a subscription).
 */
export function pickAppliedEnding<T extends { intentType: 'cancellation' | 'downgrade'; targetPlan: string | null; stripeSubscriptionId: string | null; appliedAt: string | null }>(
  rows: T[], subscriptionId: string, subscriptionCreatedAt: string | null,
): T | null {
  return rows.find(r => (r.intentType === 'cancellation' || r.targetPlan === 'tournament')
    && (r.stripeSubscriptionId
      ? r.stripeSubscriptionId === subscriptionId
      : !subscriptionCreatedAt || (!!r.appliedAt && new Date(r.appliedAt).getTime() >= new Date(subscriptionCreatedAt).getTime()))) ?? null;
}

/** The cheaper-plan move a Stripe schedule holds: ours (a down move with a known plan), someone else's, or none. */
export function waitingMoveOf(sub: Pick<Stripe.Subscription, 'schedule'>): { plan: OrgPlan; scheduleId: string } | 'foreign' | null {
  const schedule = sub.schedule && typeof sub.schedule !== 'string' ? sub.schedule : null;
  if (!sub.schedule) return null;
  if (!schedule) return 'foreign';
  // An ended or released schedule no longer manages the subscription.
  if (schedule.status && !['active', 'not_started'].includes(schedule.status)) return null;
  const plan = schedule.metadata?.planKey;
  if (schedule.metadata?.flhq_plan_move !== 'down' || !plan || !MOVE_PLANS.has(plan)) return 'foreign';
  return { plan: plan as OrgPlan, scheduleId: schedule.id };
}

export type FutureMoveAction =
  | 'schedule_cancel' | 'keep' | 'end'
  | 'plan_move' | 'downgrade' | 'operator_plan_change'
  | 'replace_subscription' | 'reactivation';

export type FutureMoveAnswer =
  | { answer: 'carry'; plan: OrgPlan }
  | { answer: 'restore'; plan: OrgPlan }
  | { answer: 'drop'; plan: OrgPlan; why: string }
  | { answer: 'refuse'; reason: string }
  | { answer: 'withdraw' }
  | { answer: 'none' };

/**
 * THE ONE RULE FOR A SUBSCRIPTION'S FUTURE, as data. Given the action and the state — a move waiting in Stripe, a move
 * remembered on a waiting cancel, a waiting cancel's date — it says what the action must do. Nothing may leave a customer
 * on a price or plan they did not choose with no screen saying so.
 *
 *   schedule_cancel  a move waiting → CARRY it (remember it on the row); a schedule that isn't ours → REFUSE
 *   keep             a remembered move → RESTORE it at renewal
 *   end              a remembered move → DROP it, on the record, because the plan it would apply to has ended
 *   plan_move / downgrade / operator_plan_change   while a cancel waits → REFUSE ("Keep {Plan} first")
 *   replace_subscription / reactivation            while a cancel waits → WITHDRAW it (the old subscription is going)
 */
export function futureMoveAnswer(action: FutureMoveAction, state: {
  ownPlan: OrgPlan;
  waitingMove?: { plan: OrgPlan } | 'foreign' | null;
  heldMovePlan?: OrgPlan | null;
  pendingEndsAt?: string | null;
  pending?: boolean;
}): FutureMoveAnswer {
  switch (action) {
    case 'schedule_cancel':
      if (state.waitingMove === 'foreign') return { answer: 'refuse', reason: W.cancel.foreignSchedule };
      return state.waitingMove ? { answer: 'carry', plan: state.waitingMove.plan } : { answer: 'none' };
    case 'keep':
      return state.heldMovePlan ? { answer: 'restore', plan: state.heldMovePlan } : { answer: 'none' };
    case 'end':
      return state.heldMovePlan
        ? { answer: 'drop', plan: state.heldMovePlan, why: 'The plan ended before the move’s date, so there was no plan left to move.' }
        : { answer: 'none' };
    case 'plan_move':
    case 'downgrade':
    case 'operator_plan_change':
      return state.pending || state.pendingEndsAt
        ? { answer: 'refuse', reason: W.cancel.endingRefusal(state.ownPlan, state.pendingEndsAt ?? null) }
        : { answer: 'none' };
    case 'replace_subscription':
    case 'reactivation':
      return state.pending || state.pendingEndsAt ? { answer: 'withdraw' } : { answer: 'none' };
  }
}

function payPagesWhere(door: EndingDoor): PayPagesWhere {
  if (door === 'operator') return 'operator cancel';
  if (door === 'owner' || door === 'stripe_portal') return 'owner cancel';
  return 'stripe suspension';
}

function logEntry(now: Date, actor: EndingActor, action: EndingLogEntry['action'], extra: Partial<EndingLogEntry> = {}): EndingLogEntry {
  return { at: now.toISOString(), action, door: actor.door, by: actor.email ?? actor.userId, ...extra };
}

// ── Schedule (the click) ─────────────────────────────────────────────────────────────────────────

export type ScheduleResult =
  | { outcome: 'scheduled'; endsAt: string | null; intentId: string | null; recorded: boolean; heldMovePlan: OrgPlan | null }
  | { outcome: 'ended'; ended: ApplyResult }
  | { outcome: 'refused'; error: string; status: number };

/**
 * The click. A paying Stripe subscription: Stripe FIRST (release a waiting move's schedule — Stripe will not set
 * `cancel_at_period_end` on a schedule-managed subscription — then set it), then record the waiting row. If Stripe
 * refuses, nothing is scheduled. With no real subscription there is no date to wait for: the plan ends now.
 */
export async function scheduleEnding(
  account: EndingAccount,
  actor: EndingActor,
  opts: { reason: string | null; notifyOwner: boolean },
  deps: EndingDeps,
): Promise<ScheduleResult> {
  if (!hasRealSubscription(account)) {
    return { outcome: 'ended', ended: await applyEnding(account, { actor, reason: opts.reason, notifyOwner: opts.notifyOwner, origin: 'request' }, deps) };
  }
  const subscriptionId = account.subscriptionId!;

  let sub: Stripe.Subscription;
  try {
    sub = await deps.retrieveSubscription(subscriptionId);
  } catch {
    return { outcome: 'refused', error: W.cancel.stripeRefused, status: 502 };
  }
  // Stripe has already ended it (our record lagged): nothing is left to wait for.
  if (ENDED.has(sub.status)) {
    return { outcome: 'ended', ended: await applyEnding(account, { actor, reason: opts.reason, notifyOwner: opts.notifyOwner, origin: 'request' }, deps) };
  }

  let heldMovePlan: OrgPlan | null = null;
  const existing = await deps.findPending(account.orgId);
  if (!stripeCancelSignal(sub).scheduled) {
    const answer = futureMoveAnswer('schedule_cancel', { ownPlan: account.ownPlan, waitingMove: waitingMoveOf(sub) });
    if (answer.answer === 'refuse') return { outcome: 'refused', error: answer.reason, status: 409 };
    const waiting = waitingMoveOf(sub);
    if (answer.answer === 'carry' && waiting && waiting !== 'foreign') {
      try {
        await deps.releaseSchedule(waiting.scheduleId);
      } catch {
        return { outcome: 'refused', error: W.cancel.stripeRefused, status: 502 };
      }
      heldMovePlan = answer.plan;
    }
    try {
      sub = await deps.scheduleCancel(subscriptionId);
    } catch {
      // The move was released for nothing: put it back, so a refused cancel changes nothing at all.
      if (heldMovePlan) await deps.rescheduleMove(account, heldMovePlan, actor.email ?? 'plan-ending').catch(() => undefined);
      return { outcome: 'refused', error: W.cancel.stripeRefused, status: 502 };
    }
  } else {
    // A double click, or a cancel already set in Stripe's portal: record it, never set it twice.
    heldMovePlan = existing?.heldMovePlan ?? null;
  }

  const { endsAt } = stripeCancelSignal(sub);
  const now = deps.now();
  const effectiveAt = endsAt ?? now.toISOString();
  const fields = {
    effectiveAt,
    retentionUntil: retentionUntilFrom(effectiveAt, deps.retentionDays(account)),
    reason: opts.reason,
    fromPlan: account.ownPlan,
    createdBy: actor.userId,
    createdByEmail: actor.email,
    stripeSubscriptionId: subscriptionId,
    heldMovePlan,
    notifyOwner: opts.notifyOwner,
  };
  const entry = logEntry(now, actor, 'scheduled', heldMovePlan ? { move: 'carried', plan: heldMovePlan } : {});

  try {
    const written = await writePending(account.orgId, fields, entry, deps);
    if (written) await announceEndsOn(account, written, deps);
    return { outcome: 'scheduled', endsAt, intentId: written?.id ?? null, recorded: !!written, heldMovePlan };
  } catch {
    // Stripe holds the cancel; the `subscription.updated` arm records it from Stripe. Never a plain failure.
    return { outcome: 'scheduled', endsAt, intentId: null, recorded: false, heldMovePlan };
  }
}

/**
 * G6 a · "Your plan ends on {date}", once per waiting row whichever door wrote it (owner, operator — only with the "tell
 * the owner" tick — or Stripe's portal through the webhook); the row's stamp makes an `updated` storm send one.
 */
async function announceEndsOn(account: EndingAccount, intent: EndingIntent, deps: EndingDeps): Promise<void> {
  // Stripe gave no end date (the row fell back to now): no date to promise, so no "ends on" email.
  if (!upcomingDate(intent.effectiveAt, deps.now())) return;
  await sendEndingEmailOnce({ kind: 'ends_on', account, intent }, intent.notifyOwner, deps);
}

/** Find-then-write the one waiting row: update the one that is there (the webhook's, a double click's), else insert. */
async function writePending(
  orgId: string,
  fields: Omit<NewEndingIntent, 'orgId' | 'status' | 'changeLog'>,
  entry: EndingLogEntry,
  deps: EndingDeps,
): Promise<EndingIntent | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = await deps.findPending(orgId);
    if (existing) {
      return deps.updateIntent(existing.id, { ...fields, changeLog: [...existing.changeLog, entry] }, ['pending']);
    }
    const inserted = await deps.insertIntent({ ...fields, orgId, status: 'pending', changeLog: [entry] });
    if (inserted !== 'conflict') return inserted;
  }
  return null;
}

// ── Keep {Plan} ──────────────────────────────────────────────────────────────────────────────────

export type KeepResult =
  /** `movePlan`: the cheaper move the cancel carried; `renewsAs` is it when it was put back, null when `moveNotRestored` says why not. */
  | { outcome: 'kept'; renewsOn: string | null; renewsAs: OrgPlan | null; movePlan: OrgPlan | null; moveNotRestored: string | null }
  | { outcome: 'nothing' }
  | { outcome: 'refused'; error: string; status: number };

/**
 * Undo a waiting cancel. Stripe first (clear whichever signal it holds), then the row is withdrawn. A cheaper-plan move
 * the cancel carried is put back through the ordinary move (G1); if that fails, the plan is still kept and the caller is
 * told plainly — never a clean "kept" that quietly renews at the higher price.
 */
export async function keepEnding(account: EndingAccount, actor: EndingActor, deps: EndingDeps, opts: { notifyOwner: boolean } = { notifyOwner: true }): Promise<KeepResult> {
  const pending = await deps.findPending(account.orgId);
  const subscriptionId = pending?.stripeSubscriptionId ?? (account.subscriptionId?.startsWith('sub_') ? account.subscriptionId : null);
  let renewsOn: string | null = null;

  if (subscriptionId) {
    let sub: Stripe.Subscription;
    try {
      sub = await deps.retrieveSubscription(subscriptionId);
    } catch {
      return { outcome: 'refused', error: W.cancel.keepRefused, status: 502 };
    }
    if (ENDED.has(sub.status)) return { outcome: 'refused', error: W.cancel.alreadyEnded, status: 409 };
    const signal = stripeCancelSignal(sub);
    if (!signal.scheduled && !pending) return { outcome: 'nothing' };
    if (signal.scheduled) {
      try {
        sub = await deps.clearCancel(subscriptionId, signal.clear);
      } catch {
        return { outcome: 'refused', error: W.cancel.keepRefused, status: 502 };
      }
    }
    renewsOn = stripeCancelSignal(sub).endsAt;
  } else if (!pending) {
    return { outcome: 'nothing' };
  }

  const now = deps.now();
  let moveNotRestored: string | null = null;
  let renewsAs: OrgPlan | null = null;
  const answer = futureMoveAnswer('keep', { ownPlan: account.ownPlan, heldMovePlan: pending?.heldMovePlan ?? null });

  if (answer.answer === 'restore') {
    // A keep in progress (keepInProgress): marked BEFORE the slow calls, withdrawn only AFTER the move is back.
    if (pending) await deps.updateIntent(pending.id, { changeLog: [...pending.changeLog, logEntry(now, actor, 'kept')] }, ['pending']);
    const restored = await deps.rescheduleMove(account, answer.plan, actor.email ?? 'plan-ending')
      .catch(error => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }));
    if (restored.ok) renewsAs = answer.plan;
    else moveNotRestored = restored.error;
  }

  // 'canceled' too: Stripe's own event may have withdrawn it first — the keep's record still goes on it.
  const kept = pending
    ? await deps.updateIntent(pending.id, {
      status: 'canceled',
      changeLog: [...pending.changeLog, logEntry(now, actor, 'kept', answer.answer === 'restore'
        ? { move: moveNotRestored ? 'restore_failed' : 'restored', plan: answer.plan, ...(moveNotRestored ? { note: moveNotRestored } : {}) }
        : {})],
    }, ['pending', 'canceled'])
    : null;

  if (pending) {
    // G6 b · "Your plan will renew on {date}" (as the cheaper plan when it came back), once per row. The owner's own keep
    // always; the operator's only with the "email the owner" tick.
    await sendEndingEmailOnce({ kind: 'kept', account, intent: kept ?? pending, door: actor.door, renewsOn, renewsAs }, opts.notifyOwner, deps);
  }
  return { outcome: 'kept', renewsOn, renewsAs, movePlan: answer.answer === 'restore' ? answer.plan : null, moveNotRestored };
}

// ── The ending (end date, End now, no subscription, Stripe ending it) ────────────────────────────

export type ApplyResult = {
  applied: boolean;
  intentId: string | null;
  retentionUntil: string | null;
  retainedTournamentIds: string[];
  /** The "cancelled" email went to the owner in this run. */
  emailed: boolean;
  /** When the plan ended — the data clock's start. */
  endedAt: string | null;
};

/**
 * THE ending — the one place a plan stops. Promotes the waiting row (or writes one, for an ending with none), then:
 * restore records FIRST (every tournament still live, re-read now, and the account), then archive, then suspend, then the
 * one `subscription_canceled` event, then close the pay pages, then the "cancelled" email, then the flip to applied.
 * An applied row means it already ran: nothing happens.
 *
 * `origin`: 'request' when somebody asked (owner, operator, the customer in Stripe's portal); 'stripe' when Stripe ended it
 * with nobody asking (a card that failed for good). Only a request — or any Coaches Portal ending — sends the email,
 * as before; an operator's request honours the "tell the owner" tick.
 */
export async function applyEnding(
  account: EndingAccount,
  p: {
    actor: EndingActor;
    reason: string | null;
    notifyOwner: boolean;
    origin: 'request' | 'stripe';
    intent?: EndingIntent | null;
    stripeEndedAt?: string | null;
    /** Said on the row's "ended" entry — who finished an overdue ending, and why (G3). */
    note?: string;
  },
  deps: EndingDeps,
): Promise<ApplyResult> {
  const now = deps.now();
  let intent = p.intent ?? await deps.findPending(account.orgId);
  if (intent && intent.status === 'applied') {
    return { applied: false, intentId: intent.id, retentionUntil: intent.retentionUntil, retainedTournamentIds: [], emailed: false, endedAt: intent.effectiveAt };
  }

  const endedAt = endedAtFor(intent, now, p.stripeEndedAt);
  const retentionUntil = retentionUntilFrom(endedAt, deps.retentionDays(account));
  if (!intent) {
    const inserted = await deps.insertIntent({
      orgId: account.orgId, status: 'pending', effectiveAt: endedAt, retentionUntil, reason: p.reason, fromPlan: account.ownPlan,
      createdBy: p.actor.userId, createdByEmail: p.actor.email, stripeSubscriptionId: account.subscriptionId?.startsWith('sub_') ? account.subscriptionId : null,
      heldMovePlan: null, notifyOwner: p.notifyOwner, changeLog: [],
    });
    intent = inserted === 'conflict' ? await deps.findPending(account.orgId) : inserted;
    if (!intent) throw new Error('The ending could not be recorded.');
  } else if (p.notifyOwner !== intent.notifyOwner && p.actor.door === 'operator') {
    intent = { ...intent, notifyOwner: p.notifyOwner };
  }

  const isRequest = p.origin === 'request';
  const reason = intent.reason ?? p.reason;
  // Reactivation restores records by these reasons (lib/billing-reactivation.ts, the Coaches Portal restore): never new ones.
  const retentionReason = account.isCoachesPortal
    ? 'coaches_portal_cancellation'
    : isRequest ? 'account_cancellation' : 'stripe_subscription_deleted';
  const initiated = p.actor.door === 'operator'
    ? { initiatedBy: 'platform_admin', adminEmail: p.actor.email }
    : p.origin === 'stripe' ? { initiatedBy: 'stripe' } : {};

  // 1 · restore records, before anything is archived away (only what this intent has not recorded yet).
  const { tournaments, shutsDown } = await deps.preflight(account);
  const recorded = await deps.recordedFor(intent.id);
  const recordedTournaments = new Set(recorded.filter(r => r.recordType === 'tournament').map(r => r.recordId));
  const toRecord = tournaments.filter(t => !recordedTournaments.has(t.id));
  if (toRecord.length > 0) {
    await deps.supersedeOthers(account.orgId, toRecord.map(t => t.id), intent.id);
    await deps.insertRecords(toRecord.map(t => ({
      intentId: intent!.id, orgId: account.orgId, recordType: 'tournament' as const, recordId: t.id, displayName: t.name, retentionUntil,
      metadata: {
        previousStatus: t.status, slug: t.slug, year: t.year, startDate: t.startDate, endDate: t.endDate,
        retentionReason, fromPlan: account.ownPlan, ...initiated,
      },
    })));
  }
  if (!recorded.some(r => r.recordType === 'account')) {
    await deps.insertRecords([{
      intentId: intent.id, orgId: account.orgId, recordType: 'account', recordId: null, retentionUntil,
      displayName: account.isCoachesPortal ? `${account.name} Premium workspace` : account.name,
      metadata: account.isCoachesPortal
        ? { retentionReason, fromPlan: account.ownPlan, teamWorkspaceId: account.teamWorkspaceId, premiumToolsInactive: shutsDown, basicTournamentRecordsRemainAvailable: true, ...initiated }
        : { retentionReason, fromPlan: account.ownPlan, moduleShutdown: shutsDown, ...initiated },
    }]);
  }

  // 2 · archive what is still live (a replay finds the first run's tournaments already archived and not re-read).
  if (tournaments.length > 0) await deps.archive(account.orgId, tournaments.map(t => t.id));

  // 3 · suspend.
  await deps.suspend(account, { endedAt, reason });

  // 4 · one event per ending, at the END date, with who asked (churn dates here, not at the click).
  const allRetained = [...recordedTournaments].filter((id): id is string => !!id).concat(toRecord.map(t => t.id));
  await deps.writeEndedEvent({
    account, intentId: intent.id, source: isRequest ? 'app' : 'stripe', requestedBy: p.actor.door,
    actorUserId: p.actor.userId ?? intent.createdBy, actorEmail: p.actor.email ?? intent.createdByEmail, reason, endedAt, retentionUntil,
    retainedTournamentIds: allRetained, sourceEventId: `intent:${intent.id}:subscription_canceled`,
  });

  // 5 · the pay pages close (a Coaches Portal's too — decision 2, owner 2026-11-01). AFTER the event, so a slow Stripe can
  // never cost the event (/review of 12d-2 Part 3); a suspended account is refused Pay now by the pay facts regardless.
  await deps.closePayPages(account.orgId, payPagesWhere(p.actor.door));

  // 6 · the "cancelled" email, once per ending.
  const notify = isRequest ? intent.notifyOwner : account.isCoachesPortal;
  let endedEmailSentAt = intent.endedEmailSentAt;
  const emailed = notify && !endedEmailSentAt;
  if (emailed) {
    await deps.sendEndedEmail({ account, intentId: intent.id, retentionUntil, retainedTournaments: allRetained.length, askedBy: p.actor.userId ?? intent.createdBy });
    endedEmailSentAt = deps.now().toISOString();
    await deps.updateIntent(intent.id, { endedEmailSentAt }, ['pending']);
  }

  // 7 · LAST: the row says it is done.
  const dropped = futureMoveAnswer('end', { ownPlan: account.ownPlan, heldMovePlan: intent.heldMovePlan });
  const notes = [p.note, dropped.answer === 'drop' ? dropped.why : null].filter((n): n is string => !!n);
  const entry = logEntry(now, p.actor, 'ended', {
    ...(dropped.answer === 'drop' ? { move: 'dropped' as const, plan: dropped.plan } : {}),
    ...(notes.length ? { note: notes.join(' ') } : {}),
  });
  await deps.updateIntent(intent.id, {
    status: 'applied', appliedAt: now.toISOString(), effectiveAt: endedAt, retentionUntil, notifyOwner: intent.notifyOwner,
    endedEmailSentAt, changeLog: [...intent.changeLog, entry],
  }, ['pending']);

  return { applied: true, intentId: intent.id, retentionUntil, retainedTournamentIds: allRetained, emailed, endedAt };
}

// ── What Stripe says (the webhook) ───────────────────────────────────────────────────────────────

export type SignalResult = 'recorded' | 'rescheduled' | 'withdrawn' | 'unchanged';

/**
 * `customer.subscription.updated`: make the waiting row agree with Stripe. Always called with the LIVE subscription
 * (retrieved, never the event's copy — events arrive out of order: a late "true" after Keep's "false"), and keyed to the
 * subscription and its end date, so the many updates Stripe fires write once.
 */
export async function recordStripeSignal(account: EndingAccount, sub: Stripe.Subscription, deps: EndingDeps): Promise<SignalResult> {
  if (ENDED.has(sub.status)) return 'unchanged';
  const signal = stripeCancelSignal(sub);
  const pending = await deps.findPending(account.orgId);
  const now = deps.now();
  const stripe: EndingActor = { door: 'stripe_portal', userId: null, email: 'stripe-webhook' };

  if (signal.scheduled) {
    const effectiveAt = signal.endsAt ?? now.toISOString();
    const retentionUntil = retentionUntilFrom(effectiveAt, deps.retentionDays(account));
    if (!pending) {
      const inserted = await deps.insertIntent({
        orgId: account.orgId, status: 'pending', effectiveAt, retentionUntil, reason: 'Cancelled in the billing portal', fromPlan: account.ownPlan,
        createdBy: null, createdByEmail: 'stripe-webhook', stripeSubscriptionId: sub.id, heldMovePlan: null, notifyOwner: true,
        changeLog: [logEntry(now, stripe, 'scheduled')],
      });
      if (inserted === 'conflict') return 'unchanged';
      await announceEndsOn(account, inserted, deps);
      return 'recorded';
    }
    if (new Date(pending.effectiveAt).getTime() === new Date(effectiveAt).getTime()) return 'unchanged';
    await deps.updateIntent(pending.id, {
      effectiveAt, retentionUntil, stripeSubscriptionId: sub.id,
      changeLog: [...pending.changeLog, logEntry(now, stripe, 'rescheduled', { note: `Stripe moved the end to ${effectiveAt}` })],
    }, ['pending']);
    return 'rescheduled';
  }

  if (!pending || (pending.stripeSubscriptionId && pending.stripeSubscriptionId !== sub.id)) return 'unchanged';
  // Our own Keep cleared the cancel and is still putting a cheaper move back: the keep withdraws the row, not this event.
  if (keepInProgress(pending, now)) return 'unchanged';
  const withdrawn = await deps.updateIntent(pending.id, {
    status: 'canceled', changeLog: [...pending.changeLog, logEntry(now, stripe, 'withdrawn', { note: 'Renewed in Stripe' })],
  }, ['pending']);
  // G6 b · Renew in Stripe's portal is a keep too (owner 2026-11-02): the same email, once per row. A cheaper move the cancel
  // set aside is NOT put back on this path (see plan §4 item 1) — the email names the price it renews at, so nothing is silent.
  if (withdrawn) {
    await sendEndingEmailOnce({ kind: 'kept', account, intent: withdrawn, door: 'stripe_portal', renewsOn: signal.endsAt, renewsAs: null }, pending.notifyOwner, deps);
  }
  return 'withdrawn';
}

export type DeletedResult =
  | { kind: 'ended'; result: ApplyResult }
  | { kind: 'already'; intentType: 'cancellation' | 'downgrade' };

/**
 * `customer.subscription.deleted`: the end date (or an early end). The waiting row first — it carries the owner's reason
 * and the date. Else this subscription's own applied ending (an End now, an immediate cancel) means it already ran. Else
 * Stripe ended it with nobody asking.
 *
 * ⚠ The applied row must belong to THIS subscription (its id on the row, or for older rows applied after it was created;
 * a downgrade only when it was to the free plan). The old "latest applied, at any age" let a stale downgrade from an
 * earlier year skip the suspension of a later paid plan that Stripe ended — leaving it free for good (review S4).
 */
export async function endingForDeletedSubscription(account: EndingAccount, sub: Stripe.Subscription, deps: EndingDeps, note?: string): Promise<DeletedResult> {
  const stripeEndedAt = iso(sub.ended_at) ?? iso(sub.canceled_at);
  const pending = await deps.findPending(account.orgId);
  if (pending) {
    // Who asked is the door that scheduled it (its first log entry); the ending acts in their name.
    const door = pending.changeLog[0]?.door ?? (pending.createdByEmail === 'stripe-webhook' ? 'stripe_portal' : 'owner');
    const asker: EndingActor = { door, userId: pending.createdBy, email: door === 'stripe_portal' ? null : pending.createdByEmail };
    return { kind: 'ended', result: await applyEnding(account, { actor: asker, reason: pending.reason, notifyOwner: pending.notifyOwner, origin: 'request', intent: pending, stripeEndedAt, note }, deps) };
  }
  const applied = await deps.findAppliedFor(account.orgId, sub.id, iso(sub.created));
  if (applied) return { kind: 'already', intentType: applied.intentType };
  return {
    kind: 'ended',
    result: await applyEnding(account, {
      actor: { door: 'stripe', userId: null, email: 'stripe-webhook' }, reason: 'Stripe subscription deleted', notifyOwner: false, origin: 'stripe', stripeEndedAt,
    }, deps),
  };
}

// ── The safety net (G3): the daily job's steps and Finish this ending now ────────────────────────

/**
 * G6 · the daily job's email step: the click's "ends on" email that never went, then the seven-day reminder — each once
 * per row through `sendEndingEmailOnce`, so a re-run (by hand, or the next day after a crash) sends nothing twice. A row
 * whose "ends on" email goes out in this run waits for the next run for its reminder. One row's failure never stops the next.
 */
export async function sendDueEndingEmails(
  intents: EndingIntent[],
  readAccount: (orgId: string) => Promise<EndingAccount | null>,
  deps: EndingDeps,
): Promise<{ endsOn: number; reminders: number; failed: number }> {
  const now = deps.now();
  const tally = { endsOn: 0, reminders: 0, failed: 0 };
  for (const intent of intents) {
    const owedEndsOn = endsOnEmailOwed(intent, now);
    if (!owedEndsOn && !reminderDue(intent, now)) continue;
    const account = await readAccount(intent.orgId).catch(() => null);
    if (!account) { tally.failed += 1; continue; }
    if (owedEndsOn) {
      const sent = await sendEndingEmailOnce({ kind: 'ends_on', account, intent }, intent.notifyOwner, deps);
      if (sent === 'sent') tally.endsOn += 1;
      if (sent === 'failed') tally.failed += 1;
      continue;
    }
    const sent = await sendEndingEmailOnce({ kind: 'reminder', account, intent }, intent.notifyOwner, deps);
    if (sent === 'sent') tally.reminders += 1;
    if (sent === 'failed') tally.failed += 1;
  }
  return tally;
}

/** One row of the endings Stripe hasn't finished (the retention page's section, G3). */
export type OverdueEnding = {
  orgId: string; orgName: string; planLabel: string; shouldHaveEnded: string; daysOver: number;
  door: EndingDoor | null; by: string | null;
};

export type FinishResult =
  | { outcome: 'finished'; endedAt: string | null; retentionUntil: string | null; retainedTournaments: number; emailed: boolean }
  /** Stripe still bills it: the account is untouched. `nextDate` is its renewal, or the date it is set to end when
   *  `cancelScheduled`; `record` is what became of our waiting row (made to agree with Stripe, or left when it already did). */
  | { outcome: 'live'; status: string; nextDate: string | null; cancelScheduled: boolean; record: 'withdrawn' | 'rescheduled' | 'unchanged' }
  | { outcome: 'refused'; error: string; status: number };

/**
 * G3 · Finish this ending now — a platform admin's door for an overdue ending (Stage 0 Tab 6). It NEVER trusts our record
 * over Stripe: the live subscription is read first. Stripe says it ended → the very ending the missed `deleted` event would
 * have run (the waiting row promoted, the data clock from the day it should have ended — Stage 0 ruling 6 — the email as
 * the asker chose), then the record's subscription fields cleared as the webhook clears them. Stripe says it is still
 * live → the ACCOUNT is left exactly as it is; our record is wrong, and is made to agree with Stripe as the missed
 * `updated` message would have done (owner ruling 2026-11-02): no cancel in Stripe → the waiting row is withdrawn; a later
 * date in Stripe → the row moves to it. Never runs by itself.
 */
export async function finishOverdueEnding(account: EndingAccount, actor: EndingActor, why: string, deps: EndingDeps): Promise<FinishResult> {
  const pending = await deps.findPending(account.orgId);
  if (!pending) return { outcome: 'refused', error: W.cancel.finish.nothingWaiting, status: 409 };
  if (!isOverdueEnding(pending, deps.now())) return { outcome: 'refused', error: W.cancel.finish.notOverdue, status: 409 };
  const subscriptionId = pending.stripeSubscriptionId ?? (account.subscriptionId?.startsWith('sub_') ? account.subscriptionId : null);
  if (!subscriptionId) return { outcome: 'refused', error: W.cancel.finish.noSubscription, status: 409 };
  // ⚠ The webhook ends a plan only for the subscription our record follows (billing-one-subscription-record). A waiting row
  // left on an OLD subscription while the club pays on a new one must never suspend it (/review 2026-11-02).
  if (account.subscriptionId?.startsWith('sub_') && account.subscriptionId !== subscriptionId) {
    return { outcome: 'refused', error: W.cancel.finish.otherSubscription, status: 409 };
  }

  let sub: Stripe.Subscription;
  try {
    sub = await deps.retrieveSubscription(subscriptionId);
  } catch {
    return { outcome: 'refused', error: W.cancel.finish.stripeUnread, status: 502 };
  }
  if (!ENDED.has(sub.status)) {
    const signal = stripeCancelSignal(sub);
    const agreed = await recordStripeSignal(account, sub, deps);
    const record = agreed === 'withdrawn' || agreed === 'rescheduled' ? agreed : 'unchanged';
    return { outcome: 'live', status: sub.status, nextDate: signal.endsAt, cancelScheduled: signal.scheduled, record };
  }

  // The record's subscription fields first: the ending flips the row to applied LAST, and once it has, Finish has nothing
  // to finish — so a clear left for after it could be lost for good (/review 2026-11-02). Both are safe to run again.
  await deps.clearEndedSubscription(account, sub);
  const ended = await endingForDeletedSubscription(account, sub, deps, `Finished by ${actor.email ?? 'an operator'}: ${why}`);
  const result = ended.kind === 'ended' ? ended.result : null;
  return {
    outcome: 'finished',
    endedAt: result?.endedAt ?? null,
    retentionUntil: result?.retentionUntil ?? null,
    retainedTournaments: result?.retainedTournamentIds.length ?? 0,
    emailed: result?.emailed ?? false,
  };
}
