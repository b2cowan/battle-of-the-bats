/**
 * THE YEARLY RENEWAL REMINDER (GST/HST Stage 6 step 6.4 Part B; build prompt docs/projects/active/GST_HST_STAGE6_4_BUILD_PROMPT.md
 * §4.1 and the words of §6, reviewed by /accounting and /legal 2026-11-13). Who is due one, its words, and the once-only run, all
 * given their database, Stripe and mail service so the tests drive them. The reads are in lib/renewal-reminder-server.ts.
 *
 * ⚖ At least 30 days before a yearly plan's next charge (the Terms draft §8 "Yearly plans"), every owner is told the date and the
 *   amount with its tax AS STRIPE WOULD CHARGE IT THAT DAY: Stripe's preview of the next invoice, never the plan's list price and
 *   never `amount_due` (a credit balance distorts it). It writes no tax record and nothing to Bookkeeping.
 * ⚖ A renewal, a yearly trial ending, and a yearly next-season choice's first charge. Never a monthly plan, a waiting cancel or move
 *   to the free plan, a Founding comp (no subscription), a dev mock, an ended or failing subscription, or a trial whose purchase
 *   email (which states the date) went out under 38 days before its first charge.
 * ⚖ ONCE per charge date: the account's `renewal_reminded_for` holds the date last told of, claimed before the send and given back
 *   only when the email definitely did not go. Under 30 days and still untold (the job was down), it goes anyway: `late`.
 * ⚖ Transactional (CASL): the only link is the billing page.
 */
import { escText as escapeHtml, warmEmailButton, warmEmailDocument, warmEmailHeading, warmEmailParagraph } from './email-envelope-warm';
import { formatStoredDate } from './timezone';
import { BILLING_TAX_WORDS } from './billing-tax';
import { possessive } from './utils';
import { money } from './purchase-details';
import { sendToOwners, type SendResultLike } from './owners-send-outcome';

export const DAY_MS = 86_400_000;
const ms = (iso: string) => new Date(iso).getTime();
/** The window, in days before the charge: on time from 37 down to 30; under 30 and untold is late. */
export const REMINDER_WINDOW = { latestDays: 37, onTimeDays: 30 } as const;
/** A trial's purchase email this close to its first charge already gave the date: it is the notice (League's 30-day trial). */
export const PURCHASE_NOTICE_DAYS = 38;

/** A renewal of a yearly plan, a yearly free trial ending, or a yearly next-season choice's first charge. */
export type ReminderKind = 'renewal' | 'trial' | 'next_season';

/** One account the stored rows say may be due (the server's pre-filter, before any Stripe read). */
export type ReminderCandidate = {
  orgId: string;
  subscriptionId: string;
  kind: ReminderKind;
  /** The charge date as the stored row has it (the subscription's period end, its trial end, or the next-season first charge). */
  chargeIso: string;
  /** The account's `renewal_reminded_for`: the charge date it was last told of. */
  remindedFor: string | null;
};

/** Where a charge date sits against the window, or null when it is not in it (past, or more than 37 days away). */
export function reminderTiming(chargeIso: string, now: Date): 'on_time' | 'late' | null {
  const left = ms(chargeIso) - now.getTime();
  if (!(left > 0) || left > REMINDER_WINDOW.latestDays * DAY_MS) return null;
  return left < REMINDER_WINDOW.onTimeDays * DAY_MS ? 'late' : 'on_time';
}

export const sameInstant = (a: string | null, b: string) => a !== null && ms(a) === ms(b);

/**
 * One reminder per account per run, decided the same way every day: when the rows show an account two dates (a live yearly plan
 * and a next-season choice, which should not both exist), the earlier one. Two would each claim the one stamp in turn and both
 * send again every day.
 */
export function onePerAccount(candidates: ReadonlyArray<ReminderCandidate>): ReminderCandidate[] {
  const out = new Map<string, ReminderCandidate>();
  for (const c of candidates) {
    const held = out.get(c.orgId);
    if (!held || ms(c.chargeIso) < ms(held.chargeIso)) out.set(c.orgId, c);
  }
  return [...out.values()];
}

/** What Stripe says now: the subscription, and its preview of the next invoice. */
export type ReminderStripeFacts = {
  status: string;
  /** A cancel is set on the subscription (at the period end, or at a date). */
  cancelSet: boolean;
  /** The charge date as Stripe has it now (the trial end while trialing, else the item's period end). */
  chargeIso: string | null;
  /** The plan the preview's charged line is for, and its cycle (from our price list); null when the price is not ours. */
  previewPlan: { planId: string; cycle: 'monthly' | 'annual' } | null;
  /** The preview's amount before tax, after any discount (`total_excluding_tax`), its taxes by name, its total, its currency. */
  beforeTaxCents: number;
  taxLines: Array<{ label: string; cents: number }>;
  totalCents: number;
  currency: string;
  /** The preview works no tax out (a subscription made before GST/HST Stage 2 and never moved): its renewal is charged none. */
  taxOff: boolean;
};

/** One line of Stripe's preview, as the figures read it. */
export type PreviewLine = {
  /** `subscription_item_details` for the plan's own line; `invoice_item_details` for a queued item (a club's recovered fee). */
  parentType: string | null;
  amount: number;
  discountCents: number;
  priceId: string | null;
  taxes: Array<{ amount: number; exclusive: boolean; taxRateId: string | null }>;
};

/**
 * The renewal's figures from the PLAN's lines only (/accounting 2026-11-13). A club's recovered Stripe fees queued on the
 * subscription ride the same invoice (lib/platform-stripe-fees.ts `subscriptionToRide`) and would inflate the price, the tax and
 * the total; a returned fee would deflate them. Before tax = the lines' amount after their discounts; the taxes are those lines'
 * own; the total adds only the taxes charged on top (exclusive), so price + tax = total. The plan is the first such line's price.
 */
export function planLineFigures(lines: ReadonlyArray<PreviewLine>): {
  beforeTaxCents: number; taxes: PreviewLine['taxes']; totalCents: number; priceId: string | null;
} {
  const plan = lines.filter(l => l.parentType === 'subscription_item_details');
  const beforeTaxCents = plan.reduce((sum, l) => sum + l.amount - l.discountCents, 0);
  const taxes = plan.flatMap(l => l.taxes);
  const onTop = taxes.filter(t => t.exclusive).reduce((sum, t) => sum + t.amount, 0);
  return {
    beforeTaxCents, taxes, totalCents: beforeTaxCents + onTop,
    priceId: plan.find(l => l.amount > 0 && l.priceId)?.priceId ?? null,
  };
}

export type ReminderSkip =
  | 'already' | 'outside_window' | 'not_billing' | 'ending' | 'told_at_purchase' | 'not_yearly' | 'nothing_charged';

/** The checks that need no Stripe read (the stored row, the waiting change, the purchase email's stamp). */
export function skipBeforeStripe(c: ReminderCandidate, facts: { pendingEnding: boolean; purchaseEmailAt: string | null }, now: Date): ReminderSkip | null {
  if (sameInstant(c.remindedFor, c.chargeIso)) return 'already';
  if (!reminderTiming(c.chargeIso, now)) return 'outside_window';
  if (!c.subscriptionId || c.subscriptionId.startsWith('mock_')) return 'not_billing';
  if (facts.pendingEnding) return 'ending';
  if (c.kind !== 'renewal' && facts.purchaseEmailAt
    && ms(c.chargeIso) - ms(facts.purchaseEmailAt) < PURCHASE_NOTICE_DAYS * DAY_MS) return 'told_at_purchase';
  return null;
}

/** The checks on what Stripe says now. The stored row lags Stripe by an event; Stripe's own date and plan are the truth. */
export function skipAfterStripe(c: ReminderCandidate, s: ReminderStripeFacts, now: Date): ReminderSkip | null {
  if (s.status !== 'active' && s.status !== 'trialing') return 'not_billing';
  if (s.cancelSet) return 'ending';
  if (!s.chargeIso || !reminderTiming(s.chargeIso, now)) return 'outside_window';
  // A move down to a monthly plan (or a price that is not ours): the next charge is not a yearly one.
  if (s.previewPlan?.cycle !== 'annual') return 'not_yearly';
  // A 100% coupon: "$0.00 plus applicable taxes" is no notice of a charge (/accounting 2026-11-13).
  if (s.beforeTaxCents <= 0) return 'nothing_charged';
  return null;
}

// ── The words (§6, reviewed 2026-11-13: copy them exactly) ─────────────────────────────────────────────────────────────────

export type ReminderEmailInput = {
  kind: ReminderKind;
  orgName: string;
  /** Today's plan. */
  planLabel: string;
  /** The plan the preview renews into, when it differs from today's (a waiting move down): the price is that plan's, and the
   *  move-down line says so. Null otherwise. */
  nextPlanLabel: string | null;
  chargeIso: string;
  currency: string;
  beforeTaxCents: number;
  taxLines: Array<{ label: string; cents: number }>;
  totalCents: number;
  billingUrl: string;
};

const day = (iso: string) => formatStoredDate(iso, { longMonth: true });
const PLUS_TAX = BILLING_TAX_WORDS.plusTax;

export const REMINDER_WORDS = {
  subject: (k: ReminderKind, planLabel: string, date: string) =>
    k === 'renewal' ? `${planLabel} renews on ${date}` : `Your first yearly payment for ${planLabel} is on ${date}`,
  heading: (k: ReminderKind, date: string) =>
    k === 'renewal' ? `Your yearly plan renews on ${date}` : `Your first yearly payment is on ${date}`,
  opening(k: ReminderKind, orgName: string, planLabel: string, date: string, price: string): string {
    switch (k) {
      case 'renewal': return `${possessive(orgName)} yearly ${planLabel} plan renews on ${date}. We’ll charge the card on file ${price} ${PLUS_TAX}.`;
      case 'trial': return `${possessive(orgName)} free trial of yearly ${planLabel} ends on ${date}. We’ll then charge the card on file ${price} ${PLUS_TAX}.`;
      case 'next_season': return `${possessive(orgName)} yearly ${planLabel} plan starts on ${date}. We’ll charge the card on file ${price} ${PLUS_TAX}.`;
    }
  },
  /** Dropped when the preview carries no tax (the email still goes; /accounting 1). */
  estimate: (tax: string, total: string) =>
    `Based on today’s tax rates and your billing address on file, that’s ${tax}, for a total of ${total}. If either changes, the tax will too.`,
  moveDown: (date: string, orgName: string, nextPlanLabel: string) =>
    `On ${date}, ${orgName} moves to ${nextPlanLabel}, so this is the price of ${nextPlanLabel}.`,
  keepOrStop: (date: string) =>
    `To keep it, there’s nothing to do. To stop it, cancel from your billing page before ${date}; your plan stays active until then.`,
  button: 'Your billing page',
} as const;

/**
 * The whole email: subject, the template's variables (mig 478's `yearly_renewal_reminder` row), the fixed block and the built-in
 * html (the heading, then the fixed block).
 * ⚖ The FIXED block (the date-and-amount paragraph, the move-down line, the keep-or-stop sentence and the billing button) is what
 *   the Terms §8 promise rests on ("the renewal date and the amount, plus applicable taxes"), so it is rendered by code after a
 *   customised template's words, never by the template (GST/HST 6.6 fixes, owner ruling 2026-11-16; mig 490). Uncustomised, the
 *   email is byte-for-byte what it was before.
 */
export function renewalReminderEmail(i: ReminderEmailInput): { subject: string; vars: Record<string, string>; fixedHtml: string; html: string } {
  const W = REMINDER_WORDS;
  const date = day(i.chargeIso);
  // The code names any currency but ours, so a price is never read as Canadian dollars when it is not (/accounting 3; the
  // estimate's total always carries it). A new sentence shape for a non-CAD price only: nothing sells in another currency today.
  const price = `${money(i.beforeTaxCents, i.currency)}${i.currency.toLowerCase() === 'cad' ? '' : ` ${i.currency.toUpperCase()}`}`;
  const taxed = i.taxLines.filter(t => t.cents !== 0);
  const lead = [
    W.opening(i.kind, i.orgName, i.planLabel, date, price),
    taxed.length
      ? W.estimate(taxed.map(t => `${t.label} ${money(t.cents, i.currency)}`).join(' and '), `${money(i.totalCents, i.currency)} ${i.currency.toUpperCase()}`)
      : null,
  ].filter(Boolean).join(' ');
  const moveDownLine = i.nextPlanLabel ? W.moveDown(date, i.orgName, i.nextPlanLabel) : '';
  const subjectLine = W.subject(i.kind, i.planLabel, date);
  const headingLine = W.heading(i.kind, date);
  const fixedHtml = [
    warmEmailParagraph(escapeHtml(lead)),
    moveDownLine ? warmEmailParagraph(escapeHtml(moveDownLine)) : '',
    warmEmailParagraph(escapeHtml(W.keepOrStop(date))),
    warmEmailButton(escapeHtml(W.button), escapeHtml(i.billingUrl)),
  ].filter(Boolean).join('\n');
  return {
    subject: subjectLine,
    vars: { orgName: i.orgName, planLabel: i.planLabel, date, subjectLine, headingLine, lead, moveDownLine, billingUrl: i.billingUrl },
    fixedHtml,
    html: warmEmailDocument([warmEmailHeading(escapeHtml(headingLine)), fixedHtml].join('\n')),
  };
}

// ── The run: once per charge date, every owner ───────────────────────────────────────────────────────────────────────────

export type ReminderRunDeps = {
  pendingEnding(orgId: string): Promise<boolean>;
  /** When the subscription's first purchase email went (its `subscription_create` record's stamp), or null. */
  purchaseEmailAt(subscriptionId: string): Promise<string | null>;
  readStripe(c: ReminderCandidate): Promise<ReminderStripeFacts>;
  recipients(orgId: string): Promise<Array<{ userId: string; email: string }>>;
  /** Sets renewal_reminded_for = chargeIso where it is null or another date; true when this run won it. */
  claim(orgId: string, chargeIso: string): Promise<boolean>;
  /** Gives back only our own claim (renewal_reminded_for = chargeIso), to what it held before. */
  release(orgId: string, chargeIso: string, before: string | null): Promise<void>;
  /** The account's name, today's plan label and its billing page. */
  account(orgId: string): Promise<{ orgName: string; planId: string | null; billingUrl: string }>;
  planLabel(planId: string | null): string;
  send(to: { userId: string; email: string }, email: ReturnType<typeof renewalReminderEmail>, idempotencyKey: string, orgId: string):
    Promise<SendResultLike | undefined>;
  log(message: string, orgId: string): void;
};

export type ReminderResult =
  | { outcome: 'sent' | 'not_sent' | 'unknown'; late: boolean }
  | { outcome: 'skipped'; reason: ReminderSkip | 'no_recipient' | 'claimed_elsewhere' };

/**
 * One account's reminder, if it is due. Throws on a failed read before the claim (the next day tries again, still in the window);
 * after the claim, a failure that means nothing went gives the claim back. A failed preview sends nothing.
 */
export async function runRenewalReminder(c: ReminderCandidate, deps: ReminderRunDeps, now: Date): Promise<ReminderResult> {
  const [pendingEnding, purchaseEmailAt] = await Promise.all([
    deps.pendingEnding(c.orgId),
    c.kind === 'renewal' ? null : deps.purchaseEmailAt(c.subscriptionId),
  ]);
  const pre = skipBeforeStripe(c, { pendingEnding, purchaseEmailAt }, now);
  if (pre) return { outcome: 'skipped', reason: pre };
  const stripe = await deps.readStripe(c);
  const post = skipAfterStripe(c, stripe, now);
  if (post) return { outcome: 'skipped', reason: post };
  // Stripe's date is the one told of and stamped (the stored row can lag it by an event).
  const chargeIso = stripe.chargeIso!;
  if (sameInstant(c.remindedFor, chargeIso)) return { outcome: 'skipped', reason: 'already' };
  const recipients = await deps.recipients(c.orgId);
  if (!recipients.length) return { outcome: 'skipped', reason: 'no_recipient' };
  if (!(await deps.claim(c.orgId, chargeIso))) return { outcome: 'skipped', reason: 'claimed_elsewhere' };
  // The 30-day point is where a renewal that will be charged no tax is caught (/accounting 2): a person is told, once (after the
  // claim); the email still goes.
  if (stripe.taxOff) deps.log('the subscription works no tax out, so its renewal will be charged none', c.orgId);
  let email: ReturnType<typeof renewalReminderEmail>;
  try {
    const account = await deps.account(c.orgId);
    const nextPlan = stripe.previewPlan && stripe.previewPlan.planId !== account.planId ? deps.planLabel(stripe.previewPlan.planId) : null;
    email = renewalReminderEmail({
      kind: c.kind, orgName: account.orgName, planLabel: deps.planLabel(account.planId), nextPlanLabel: nextPlan, chargeIso,
      currency: stripe.currency, beforeTaxCents: stripe.beforeTaxCents, taxLines: stripe.taxLines, totalCents: stripe.totalCents,
      billingUrl: account.billingUrl,
    });
  } catch (error) {
    await deps.release(c.orgId, chargeIso, c.remindedFor); // nothing went
    throw error;
  }
  const outcome = await sendToOwners(recipients, r => deps.send(r, email, `renewal-reminder:${c.orgId}:${chargeIso}:${r.userId}`, c.orgId));
  if (outcome === 'not_sent') await deps.release(c.orgId, chargeIso, c.remindedFor);
  if (outcome === 'unknown') deps.log('the reminder may or may not have gone; not sent again', c.orgId);
  return { outcome, late: reminderTiming(chargeIso, now) === 'late' };
}
