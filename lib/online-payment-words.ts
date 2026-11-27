/**
 * The words of online payments (Club Tier Stage 12a). Source: `docs/projects/active/CLUB_TIER_STAGE12A_COPY.md`
 * (/marketing, 2026-10-25), keyed the same way. One home, so a screen, an email and a notice say a thing one way.
 *
 * ⚠ No rate is typed here: a rate is printed by `onlineFeeRateLabel()` from `lib/plan-config.ts`. No legal sentence is
 * written here either: the Payments Terms are a published legal page (`lib/legal-documents/payments/`), linked, never copied.
 */
import { formatStoredDate, utcToZonedInputs } from './timezone';
import { sponsorshipsOpen } from './sponsorships-open';
import { formatTime, joinWithAnd, pluralize, possessive } from './utils';
import { FACT_LABELS as L, capFactList, factRow, noticeFacts, type FactRow, type NoticeFacts } from './notification-facts';

/**
 * ══ THE DESK'S MONEY NOTICES, READ AT A GLANCE (Notifications read at a glance, Stage 2; drawing tabs 2–3, owner rulings
 * Q2, Q6, 2026-11-14). Each kind has ONE words entry that every sender of it calls with facts only, and it returns the
 * one line (`body`: the list rows, the push and any email read it) and the rows the opened notice draws (`facts`, stored
 * as `metadata.facts`). The rows' labels are the shared vocabulary (`FACT_LABELS`). Every line, row value and next step
 * here is draft copy owed to /marketing. [marketing]
 */
export interface NoticeText { body: string; facts: NoticeFacts }

/** A reason fragment (": the account is closed") as a row's own sentence ("The account is closed"). */
const asSentence = (fragment: string) => {
  const s = fragment.replace(/^:\s*/, '').trim();
  return s ? `${s[0].toUpperCase()}${s.slice(1)}` : '';
};
const railWord = (bank: boolean) => (bank ? 'bank debit' : 'card');
const railTarget = (bank: boolean) => (bank ? 'bank account' : 'card');
/** "Receipt 1042, $450.00": the payment, as the one lines name it. */
const receiptLead = (receiptNo: string, amount: string) => (receiptNo ? `Receipt ${receiptNo}, ${amount}` : amount);
const amountRow = (amount: string, receiptNo: string): FactRow[] => factRow(L.amount, amount, { lead: true, detail: receiptNo ? `receipt ${receiptNo}` : '' });
const MONEY_IN_STRIPE = 'In the club’s Stripe balance';
const bookRow = (book: 'season' | 'tournament') => factRow(L.book, `Out of the ${book === 'season' ? 'season’s' : 'tournament’s'} book`);
/** Who owes again: the figure leads only when it differs from the Amount row's (a figure is never written twice). */
const owesAgainRow = (who: string, owed: string, amount: string) =>
  (owed === amount ? factRow(L.owesAgain, who) : factRow(L.owesAgain, owed, { lead: true, detail: who }));
/** Who a returned payment was for: a team, or the children (first names already joined; `one` when there is one). */
export type MoneyNoticeWho = { team: string } | { children: string; one: boolean };
const isTeam = (w: MoneyNoticeWho): w is { team: string } => 'team' in w;
const whoName = (w: MoneyNoticeWho) => (isTeam(w) ? w.team : w.children);
const toldRow = (w: MoneyNoticeWho, emailed: boolean) =>
  factRow(L.told, emailed ? 'Emailed a way to pay' : 'No email address on file');
const tellYourself = (w: MoneyNoticeWho, emailed: boolean) => (emailed ? null : `Tell the ${isTeam(w) ? 'team' : 'family'} yourself.`);

/** "$1,234.50" — online payments always show cents (a receipt is exact). */
export function money(dollars: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(dollars);
}

/** "Oct 24, 2026, 8:14 p.m." — the moment a payment was made, in the club's zone. */
export function paidAtLabel(iso: string): string {
  const z = utcToZonedInputs(iso);
  return `${formatStoredDate(z.date)}, ${formatTime(z.time)}`;
}

export function receiptLabel(receiptNo: number | string): string {
  return String(receiptNo);
}

/** "Visa" from Stripe's "visa". */
export function brandLabel(brand: string | null): string {
  if (!brand) return 'Card';
  const known: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay', diners: 'Diners Club' };
  return known[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function cardLabel(brand: string | null, last4: string | null): string {
  return last4 ? `${brandLabel(brand)} •••• ${last4}` : brandLabel(brand);
}

/** The version of the Payments Terms an owner agrees to, recorded with the agreement: the newest date in
 *  `PAYMENTS_TERMS_VERSIONS` (`lib/legal-documents.ts`; a test holds the two equal). 2026-11-28 added a sponsor's card
 *  payment. The first published version, 2026-11-24, replaced the
 *  placeholder `'placeholder-counsel-pending'`; an owner who agreed to the placeholder is asked again (the daily job's notice).
 *  ⚠ Moving it asks EVERY connected club to agree again and emails its owners — minor change or not. */
export const PAYMENTS_TERMS_VERSION = '2026-11-28';

/** `/legal`'s short "What changed" for the current version (words §5.3 `{counselSummary}`). Empty: the window leaves the
 *  section out. Empty for 2026-11-24, the first published version (no production club had agreed before), and for 2026-11-28
 *  (to be published before any production club agrees; counted on release day). `/legal`'s text; the product never writes it. */
export const PAYMENTS_TERMS_SUMMARY = '';

/**
 * 12d-2 Part 4 (words §5; ask 6): a published version IS its date (`YYYY-MM-DD`), so changing the one constant above is
 * the whole act of publishing new terms. Anything else (the placeholder) is the draft: agreed "to the draft", and every
 * club is asked again when the first dated version replaces it.
 */
export function termsVersionDate(version: string | null | undefined): string | null {
  return version && /^\d{4}-\d{2}-\d{2}$/.test(version) ? version : null;
}

/** How a club stands on the current terms: agreed to it, agreed to the draft while the draft is current, or behind. */
export function termsStanding(agreedVersion: string | null | undefined, current: string = PAYMENTS_TERMS_VERSION): 'agreed' | 'draft' | 'stale' | 'none' {
  if (!agreedVersion) return 'none';
  if (agreedVersion !== current) return 'stale';
  return termsVersionDate(current) ? 'agreed' : 'draft';
}

/** GST/HST Stage 2 Part 2b (owner ruling A, 2026-11-05): a club connected before payouts asked for its billing address. Its
 *  The card asks for it, with the Billing address window as the door. The owner's. Stripe-owned pricing Stage 2: Stripe now
 *  charges the club its own fees, so the line no longer promises an invoice; it says only that our fee needs the address. */
export const PAYOUTS_ADDRESS_WORDS = {
  missing: 'Add your club’s billing address. FieldLogicHQ needs it for the fee it charges on your payments.',
  /** The address couldn't be read on the way to Stripe: the Before window stays, and pressing again reads again. */
  readFailed: 'We couldn’t check your club’s billing address. Try again.',
} as const;

/** THE PAYMENTS TERMS (words CLUB_TIER_STAGE12D_COPY.md §5): who agreed, and agreeing again. The owner's. */
export const TERMS_WORDS = {
  rowLabel: 'Payments terms',
  rowAgreed: (name: string, dateLong: string, versionDate: string) => `Agreed by ${name} on ${dateLong}, version of ${versionDate}`,
  rowDraft: (name: string, dateLong: string) => `Agreed by ${name} on ${dateLong}, to the draft. You’ll be asked again when the final terms are ready.`,
  rowStale: (name: string, dateLong: string, versionDate: string | null) =>
    `Agreed by ${name} on ${dateLong}${versionDate ? `, version of ${versionDate}` : ', to the draft'}. There are newer terms to read.`,
  readTerms: 'Read the terms',
  readAndAgree: 'Read and agree',
  noticeBody: (dateLong: string) => `The payments terms changed on ${dateLong}. Online payments stay on. Agree to the new terms before you set up payouts again or change who pays the fee.`,
  itemTitle: 'New payments terms to agree to',
  itemBody: (dateLong: string) => `FieldLogicHQ’s payments terms changed on ${dateLong}. Online payments stay on while you read them.`,
  itemSettled: (name: string) => `Agreed by ${name}`,
  refuseFee: 'Agree to the new payments terms to change who pays the processing fee.',
  refuseSetup: 'Agree to the payments terms first.',
  /** The version moved while the window was open — `connect` and `agree_terms` refuse alike (409 `terms_changed`). */
  refuseChanged: 'The payments terms changed while this window was open. Read them again.',
  emailSubject: (clubName: string) => `New payments terms for ${clubName}`,
  emailLead: (dateLong: string, clubName: string) => `FieldLogicHQ’s payments terms changed on ${dateLong}. Online payments for ${clubName} stay on while you read them.`,
  emailBody: 'Please read and agree. You’ll need the new terms to set up payouts again, to reconnect, or to change who pays the processing fee.',
  emailButton: 'Read and agree',
  reminderSubject: (clubName: string) => `Reminder: new payments terms for ${clubName}`,
  reminderLead: (clubName: string) => `You haven’t agreed to the new payments terms yet. Online payments for ${clubName} are still on.`,
  windowTitle: 'The new payments terms',
  changedHeading: 'What changed',
  termsHeading: 'The terms',
  later: 'Not now',
  agree: 'Agree',
  working: 'Agreeing…',
  done: 'Agreed. Thank you.',
} as const;

/** Needs attention (§19, plus the "not recorded" item derived for the landing that could not complete). */
export const ONLINE_NOTICE_WORDS = {
  stripeNeedsTitle: 'Stripe needs something to keep online payments on',
  stripeNeedsBodyPaused:
    'Online payments are paused. Stripe needs something more from you. Teams see your “How to pay” text until it’s done. Nothing already paid is affected.',
  // Copy 12a §20 (held for 12b): League and Club name families and teams.
  stripeNeedsBodyPausedFamilies:
    'Online payments are paused. Stripe needs something more from you. Families and teams see your “How to pay” text until it’s done. Nothing already paid is affected.',
  // The refund policy is required (owner 2026-11-17): a club connected before the ruling, with none, is paused until it writes one.
  policyNeedsTitle: 'Write a refund policy to turn online payments back on',
  policyNeedsBody:
    'Online payments are paused until your refund policy is written on the Payouts card. Teams see your “How to pay” text until then. Nothing already paid is affected.',
  policyNeedsBodyFamilies:
    'Online payments are paused until your refund policy is written on the Payouts card. Families and teams see your “How to pay” text until then. Nothing already paid is affected.',
  policyNeedsBodySponsors:
    'Online payments are paused until your refund policy is written on the Payouts card. Families, teams and sponsors see your “How to pay” text until then. Nothing already paid is affected.',
  // Derived (not in the copy): Stripe asks ahead of a deadline while payments still work.
  stripeNeedsBodyStillOn: (byDeadline: string) =>
    `Stripe needs something more from you${byDeadline}. Online payments stay on until then. Nothing already paid is affected.`,
  byDeadline: (iso: string) => ` by ${formatStoredDate(iso, { withYear: false })}`,
  notRecordedTitle: 'An online payment isn’t in the team’s record',
  // The organizer's "Payment received" bell: a team paid online and it is in the team's record. Told on every payment
  // (a part payment included); a bank debit is told the day it clears, never when it starts.
  receivedTitle: (team: string) => `Payment received: ${team}`,
  receivedBody: (amount: string, bank = false) => `${amount} was paid online by ${bank ? 'bank debit' : 'card'}.`,
} as const;

/**
 * "An online payment isn’t in the team’s record" and its house-league twins (`online_payment_not_recorded`): ONE
 * wording for its three senders and four cases (a team's landing, a child's share, a child's fee paid twice, a whole
 * sign-up). The titles stay each case's own (`ONLINE_NOTICE_WORDS.notRecordedTitle`, `LEAGUE_ONLINE_NOTICE_WORDS.unrecorded*`).
 * `team`: the money is refunded from the team's record or in Stripe; otherwise from the registration.
 */
export function notRecordedNotice(p: {
  amount: string; bank: boolean; day: string | null; payer: string | null; forWhat: string; reason: string; team: boolean;
}): NoticeText {
  return {
    body: `${p.amount} by ${railWord(p.bank)}${p.day ? ` on ${p.day}` : ''}. The money is in the club’s Stripe balance.`,
    facts: noticeFacts([
      factRow(L.amount, p.amount, { lead: true, detail: `by ${railWord(p.bank)}` }),
      factRow(L.paidBy, p.payer),
      factRow(L.paid, p.day),
      factRow(L.for, p.forWhat),
      factRow(L.reason, asSentence(p.reason)),
      factRow(L.money, MONEY_IN_STRIPE),
    ], p.team ? `Refund it to the ${railTarget(p.bank)} from the team’s record or in Stripe.` : `Refund it to the ${railTarget(p.bank)}.`),
  };
}

/**
 * "A refund didn’t reach the card" (`card_refund_failed`, owner ruling Q6, 2026-11-14): ONE words entry; all five senders
 * pass facts only — the amount, where it went, whose it was, card or bank, and whether it was sent and came back or could
 * not be sent at all (a send-back after a debit cleared that Stripe refused, or that no refund could be opened for). The
 * title keeps its two forms, "Ridge 12U’s refund…" / "Henry Doe’s refund…": the whose is the point.
 */
export function refundFailedNotice(p: {
  amount: string; bank: boolean; card: string | null; bankLast4: string | null; whose: { team: string } | { child: string }; sent: boolean;
}): NoticeText & { title: string } {
  const name = 'team' in p.whose ? p.whose.team : p.whose.child;
  const to = p.bank ? (p.bankLast4 ? `the account ending ${p.bankLast4}` : 'the bank account') : (p.card || 'the card');
  return {
    title: `${possessive(name)} refund didn’t reach the ${railTarget(p.bank)}`,
    body: p.sent ? `${p.amount} to ${to} came back.` : `${p.amount} to ${to} couldn’t be sent.`,
    facts: noticeFacts([
      factRow(L.amount, p.amount, { lead: true }),
      factRow(L.sentTo, asSentence(to)),
      factRow(L.for, 'team' in p.whose ? p.whose.team : `${possessive(p.whose.child)} family`),
      factRow(L.reason, p.sent ? `It came back, for example because the ${p.bank ? 'account' : 'card'} was closed` : 'It couldn’t be sent'),
    ], 'Send the money another way, then record the refund.'),
  };
}

/**
 * A SPONSOR'S refund that the card's bank sent back (Board Ready Stage 6 Part 3b, owner 2026-11-24, after-walk fix 6). The
 * deal page has no "record it sent another way" door, only another card refund, so the next step names what the club can
 * actually do. Draft copy owed to /marketing. [marketing]
 */
export function sponsorRefundFailedNotice(p: {
  amount: string; card: string | null; business: string; dealEnded: boolean;
}): NoticeText & { title: string } {
  const to = p.card || 'the card';
  return {
    title: `${possessive(p.business)} refund didn’t reach the card`,
    body: `${p.amount} to ${to} came back.`,
    facts: noticeFacts([
      factRow(L.amount, p.amount, { lead: true }),
      factRow(L.sentTo, asSentence(to)),
      factRow(L.for, p.business),
      factRow(L.reason, 'It came back, for example because the card was closed'),
    ], `${p.dealEnded ? 'The deal ended with this refund and stays ended. ' : ''}The refund is out of the books, so the money shows as still with the club. Refund it again from the payment, or send the money another way and record it in the Ledger.`),
  };
}

/** A sponsor's card dispute (Board Ready Stage 6 Part 3b, after-walk fix 8; /accounting 2026-11-24). Draft copy owed to /marketing. [marketing] */
export const SPONSOR_DISPUTE_WORDS = {
  openTitle: (business: string) => `${possessive(business)} card payment is disputed`,
  openBody: (amount: string, due: string | null) =>
    `The sponsor’s bank is disputing ${amount}. Answer it in Stripe${due ? ` by ${due}` : ''}. Don’t refund this sponsor while it is open, or they get the money back twice.`,
  // A bank only asking (an inquiry): nothing is taken, and a refund stays open (B-3, owner 2026-11-25). DRAFT; /marketing 2026-11-26.
  inquiryTitle: (business: string) => `${possessive(business)} bank is asking about a card payment`,
  inquiryBody: (amount: string, due: string | null) =>
    `The sponsor’s bank is asking about ${amount}. No money has been taken. Answer it in Stripe${due ? ` by ${due}` : ''}. If the money should go back, you can refund the payment.`,
  lostTitle: (business: string) => `${possessive(business)} dispute was lost`,
  lostLine: (amount: string, day: string) =>
    `The bank took back ${amount} on ${day}. The payment is out of the books and the deal is owing again. Ask the sponsor to pay again, or withdraw the deal. No credit note is needed.`,
  // A dispute WON after the sponsor paid again another way (mig 534): the first payment stands again, so more than the invoice stands.
  wonExtraTitle: (business: string) => `${possessive(business)} dispute was won, and they paid twice`,
  wonExtraBody: (extra: string) =>
    `The club won the dispute, so the first payment stands again. That leaves ${extra} over the invoice. Refund it from the payment, or press Done if it is settled another way.`,
  partialBody: (amount: string) =>
    `The bank took back ${amount}. Nothing was changed in the books. Either it is only part of what the sponsor paid, or the payment was never recorded here. Check the payment in Stripe, record what happened in the Ledger, and ask your accountant about the GST/HST.`,
} as const;

/**
 * THE REFUND BLOCK (Club Tier Stage 12c, words CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §4): one block, the same in every
 * email that carries a refund, in both flows. `bank` swaps the card's words for a bank account's (the rail table, §3.9 of
 * the bank-debit words). Replaces 12b's one-sentence `refundAmount`.
 */
export const REFUND_BLOCK_WORDS = {
  preheader: (amount: string, bank: boolean) => `${amount} refunded to your ${bank ? 'bank account' : 'card'}.`,
  amount: 'Refunded',
  forLabel: 'For',
  forValue: (name: string, amount: string) => `${name} · ${amount}`,
  to: 'To',
  bankTarget: (last4: string | null) => (last4 ? `Bank account ending ${last4}` : 'Your bank account'),
  on: 'On',
  receipt: 'Your receipt',
  receiptValue: (receiptNo: string, paid: string) => `${receiptNo} (paid ${paid})`,
  // {bankDays}: Stripe's refund to a bank account takes about 3 business days (plan §0k).
  arrives: (bank: boolean) => (bank ? 'It takes about 3 business days to appear.' : 'It can take 5 to 10 business days to appear, depending on the card company.'),
} as const;

/** Why a child's share couldn't land: the house-league writer's refusal, in the family's terms (12b copy §7 `why*`). */
export function leagueUnrecordedWhy(refusal: string): string {
  switch (refusal) {
    case 'ended': return 'the registration had already ended';
    case 'already_received': return 'the fee was already marked received';
    case 'over': return 'it was more than what was owing';
    case 'not_accepted': return 'the registration isn’t accepted';
    case 'gone': return 'the registration was deleted';
    default: return 'something went wrong on our side';
  }
}

/** Needs attention, house league (12b copy §7): one notice per child whose share couldn't land. */
export const LEAGUE_ONLINE_NOTICE_WORDS = {
  // 12c: a bank debit lands through the same door once it clears, so these say which rail the money came by.
  unrecordedTitle: (child: string, bank = false) => `A ${bank ? 'bank debit' : 'card payment'} for ${child} couldn’t be recorded`,
  // 12d words §2.3: only the "already marked received" reason gets a plain label; its words are `notRecordedNotice`'s.
  unrecordedTitleTwice: (childPossessive: string) => `${childPossessive} fee was paid twice`,
  // Derived: the whole landing threw (the season is gone, Stripe's amount differs) — no child's share is on a registration.
  // The desk's "Payment received" bell: a family paid online and it is on the registration (a bank debit, the day it clears).
  receivedTitle: 'Payment received: house league',
  receivedBody: (description: string, amount: string, bank = false) =>
    `${description}: ${amount} was paid online by ${bank ? 'bank debit' : 'card'}.`,
  unrecordedSignupTitle: 'A house-league card payment couldn’t be recorded',
  unrecordedSignupTitleBank: 'A house-league bank debit couldn’t be recorded',
  // 12c words §5 (a refund made in Stripe records itself; a person is asked only these). The 12b
  // `refundedInStripeBody` ("record the refund by hand") is retired: it had no door on an ended row (F4).
  whoseTitle: (amount: string, guardian: string | null) =>
    `${amount} was refunded in Stripe on ${guardian ? `${possessive(guardian)} payment` : 'the family’s payment'}`,
  /** `card_refund_whose`: its one sender (Notifications read at a glance, Stage 3; owner ruling 2026-11-15). The one line says why
   *  a person is asked; opened, the children are the list the desk chooses among, the payment and the book are rows, and the
   *  choice is the next step. [marketing] */
  whose: (p: { children: readonly (string | null)[]; total: string; receiptNo: string }): NoticeText => {
    const kids = p.children.map(c => (c ?? '').trim()).filter(Boolean);
    return {
      body: `It paid for ${kids.length ? joinWithAnd(kids) : 'more than one child'}, so we can’t tell whose fee it was.`,
      facts: noticeFacts([
        factRow(L.paidFor, null, { list: capFactList(kids, { one: 'child', many: 'children' }, n => `and ${n} more children`) }),
        factRow(L.payment, p.total, { lead: true, detail: p.receiptNo ? `receipt ${p.receiptNo}` : null }),
        factRow(L.book, 'Not in the season’s book until you choose'),
      ], 'Choose the child, and it goes on that registration.'),
    };
  },
  enrolledTitle: (child: string, childFirst: string) => `${possessive(child)} fee was refunded in Stripe, and ${childFirst} is still enrolled`,
  /** `card_refund_still_enrolled`: its one sender. The three choices are also the notice's buttons. */
  enrolled: (p: { amount: string; to: string; day: string; childFirst: string; owing: string }): NoticeText => ({
    body: `${p.amount} went back to ${p.to} on ${p.day}. ${p.childFirst} owes ${p.owing} again.`,
    facts: noticeFacts([
      factRow(L.amount, p.amount, { lead: true }),
      factRow(L.sentTo, asSentence(p.to)),
      factRow(L.refunded, p.day),
      factRow(L.owesAgain, p.owing, { lead: true, detail: p.childFirst }),
    ], `Withdraw ${p.childFirst}, email the family the pay link, or keep ${p.childFirst} enrolled; the family is emailed once you choose.`),
  }),
  noMatchTitle: 'A refund in Stripe matches no payment we recorded',
  noMatchBody: (amount: string, day: string) =>
    `${amount} was refunded in Stripe on ${day}, on a payment we haven’t recorded yet. It goes on the registration as soon as that payment arrives. If it’s still here tomorrow, the club’s owner can check the payment in Stripe.`,
} as const;

/** The receipt email (§14) and the refund email (§17). */
export const ONLINE_EMAIL_WORDS = {
  testPrefix: '[Test] ',
  receiptSubject: (receiptNo: string, clubName: string) => `Receipt ${receiptNo} from ${clubName}`,
  receiptThanks: (clubName: string, payerName: string | null) =>
    payerName ? `Thanks, ${payerName}. ${clubName} received your payment.` : `Thanks. ${clubName} received your payment.`,
  receiptLine: (parts: string[], base: string) => `${parts.filter(Boolean).join(' · ')} · ${base}`,
  receiptFee: (fee: string) => `Processing fee · ${fee}`,
  receiptTotal: (total: string, card: string, date: string) => `Total paid · ${total} · ${card} · ${date}`,
  receiptNumber: (receiptNo: string) => `Receipt ${receiptNo}`,
  receiptBalance: (balance: string, date: string | null) => (date ? `The ${balance} balance is due ${date}.` : `A ${balance} balance is still to pay.`),
  payBalance: 'Pay the balance',
  viewReceipt: 'View your receipt',
  questions: (clubName: string, contact: string | null) =>
    contact ? `Questions about this payment or a refund go to ${clubName}: ${contact}.` : `Questions about this payment or a refund go to ${clubName}.`,
  testNote: 'Test mode: no money moved.',
  refundSubject: (clubName: string) => `Refund from ${clubName}`,
  refundLead: (teamName: string, tournamentName: string) => `${possessive(teamName)} payment for ${tournamentName} was refunded.`,
  refundAmount: (amount: string, card: string, date: string) =>
    `${amount} refunded to ${card} on ${date}. It can take 5 to 10 business days to appear, depending on the card company.`,
  refundFeeIncluded: (fee: string) => `This includes the ${fee} processing fee.`,
  refundFeePartIncluded: (part: string, fee: string) => `This includes ${part} of the ${fee} processing fee.`,
  refundFeeKept: (fee: string) => `The ${fee} processing fee isn’t part of this refund.`,
  refundQuestions: (contact: string | null) => (contact ? `Questions: ${contact}.` : ''),
  // 12c words §4 (refund visibility): without a club contact the line names the club instead of going silent.
  refundQuestionsClub: (clubName: string) => `Questions go to ${clubName}.`,
  // 12c words §1.5: a team's part refund names what changed and what is left.
  refundLeadPart: (amount: string, team: string, scope: string, tournament: string) => `${amount} of ${possessive(team)} ${scope} for ${tournament} was refunded.`,
  refundReason: (club: string, why: string) => `${possessive(club)} reason: ${why}`,
  refundEntryNow: (entry: string) => `The entry fee is now ${entry}.`,
  refundBalanceNow: (balance: string, date: string | null) => (date ? `The balance is now ${balance}, due ${date}.` : `A ${balance} balance is still to pay.`),
  refundPaidInFull: (team: string) => `${team} is paid in full.`,
  // "Email the pay link" (copy §15, derived)
  linkSubject: (team: string, tournament: string) => `Pay for ${team} in ${tournament}`,
  linkBody: (club: string, team: string, division: string | null) =>
    division ? `${club} sent you a link to pay for ${team} in the ${division} division.` : `${club} sent you a link to pay for ${team}.`,
  linkAmount: (amount: string) => `Amount due: ${amount}`,
  payNow: 'Pay now',
  otherWays: (how: string) => `Or pay another way: ${how}`,
} as const;

/** The label a payment row and a receipt line carry, by what the payment paid. */
export const SCOPE_LINE: Record<'deposit' | 'balance' | 'full', string> = {
  deposit: 'Deposit',
  balance: 'Balance',
  full: 'Entry fee',
};

export type PayoutsHome = 'club' | 'tournament';

/** The Payouts card, its two windows, the status lines and the hub tile (copy §1–§7). */
export const PAYOUTS_WORDS = {
  path: (home: PayoutsHome) => (home === 'club' ? 'Settings › Payouts' : 'Settings & access › Payouts'),
  tile: {
    title: 'Payouts',
    sub: {
      not_set_up: 'Let teams pay online by card',
      setting_up: 'Setup isn’t finished',
      taking_payments: 'Taking payments',
      needs_attention: 'Needs attention',
      disconnected: 'Online payments are off',
    },
  },
  eyebrow: 'Payouts',
  testChip: 'Test mode',
  testLine: 'No real money moves while payouts are in test mode.',
  pill: {
    not_set_up: 'Not set up', setting_up: 'Setting up', taking_payments: 'Taking payments', needs_attention: 'Needs attention', disconnected: 'Disconnected',
  },
  title: {
    not_set_up: 'Let teams pay online', setting_up: 'Stripe needs a few more details', taking_payments: 'Teams can pay online',
    needs_attention: 'Online payments are paused', disconnected: 'Online payments are off',
  },
  // 12c Part 6, words §4: both rates wherever a rate prints, from the two labels; card only when the account takes no bank debit.
  // The not-set-up card reads as one lead sentence and two rows (the record's own idiom), so the fee and what Stripe asks for
  // can be found at a glance. The fee row's value is `record.feeRates` (both rates while bank debit is offered, card only otherwise).
  notSetUp: {
    lead: 'Payments go straight to your bank account through Stripe.',
    feeWho: 'You choose who pays it.',
    askLabel: 'Stripe will ask for',
    askValue: 'Your legal name, a signing officer and your bank account',
  },
  settingUpBody: (date: string) => `You started on ${date}. Teams keep seeing your “How to pay” text until setup is finished.`,
  takingBody: (clubName: string) => `Payouts go to your bank account on Stripe’s schedule. Receipts go out in the name “${clubName}”.`,
  // Paused: Stripe has switched card payments off, so the pay page shows "How to pay" (`takesPayments` is false).
  needsBody: 'Stripe needs something more from you. Until then teams see your “How to pay” text instead of Pay now. Nothing already paid is affected.',
  // Paused for the refund policy alone (owner 2026-11-17: required): the same paused card, its own reason and button.
  policyNeedsBody: 'Write your refund policy to turn them back on. Teams can read it beside Pay before they pay. Until then they see your “How to pay” text instead of Pay now. Nothing already paid is affected.',
  writePolicy: 'Write the refund policy',
  // Still on (derived, walk 2026-10-25): Stripe asks while card payments stay on — teams still see Pay now. Matches the
  // Needs-attention notice's "stay on" body; the card used to say "paused" here.
  needsTitleStillOn: 'Stripe needs something more from you',
  needsBodyStillOn: (deadline: string | null) =>
    deadline
      ? `Online payments are still on. Do it by ${deadline} to keep them on. Nothing already paid is affected.`
      : 'Online payments are still on. Nothing already paid is affected.',
  disconnectedBody: (date: string, name: string | null) =>
    `Disconnected ${date}${name ? ` by ${name}` : ''}. Payments already made stay in your books; refunds of them are made in Stripe. Teams see your “How to pay” text.`,
  button: {
    not_set_up: 'Set up payouts', setting_up: 'Continue setup', taking_payments: 'Open Stripe', needs_attention: 'Fix in Stripe', disconnected: 'Set up payouts again',
  },
  opening: 'Opening Stripe…',
  // Filled into Stripe's sign-up when the club has no public site Stripe can open (walk 2026-10-25, derived). The owner
  // sees it on Stripe's form and can change it there; Stripe reads it for its review of the account.
  stripeProductDescription: (clubName: string) =>
    `${clubName} runs community sports programs. Families and teams pay registration, team and tournament fees online through FieldLogicHQ, and find the club through its members, schools and local sports groups.`,
  rareDisconnect: 'Disconnect payouts',
  ownerOnly: (home: PayoutsHome) => `The owner sets this up in ${home === 'club' ? 'Settings › Payouts' : 'Settings & access › Payouts'}.`,
  before: {
    title: 'Before you set up payouts',
    costLabel: 'What it costs',
    costRate: (rate: string, bankRate: string | null = null) => (bankRate ? `${rate} per card payment · ${bankRate} per bank debit` : `${rate} per card payment`),
    costExample: (base: string, fee: string, bankFee: string | null = null) =>
      (bankFee ? `On a ${base} fee, the processing fee is ${fee} by card and ${bankFee} by bank debit.` : `On a ${base} fee, the card fee is ${fee}.`),
    // 12d-1 words §3.4 (§7 ruling 7): directly under the rates, before the example.
    otherFees: 'The processing fee covers Stripe’s charge and FieldLogicHQ’s. Stripe may take more for a card issued outside your country, a currency conversion, a dispute or a returned bank debit. That comes out of your Stripe balance, so you may receive less on those payments.',
    // Stripe-owned pricing Stage 5 (`/legal` Stage 2 finding; payments terms v0.2 §5): last in "What it costs". Says the
    // club's obligation only; never promise Stripe's backstop for a balance the club can't cover.
    stripeTerms: 'Stripe’s own agreement and prices apply, and Stripe can change its fees. If your Stripe balance goes below zero, your organization owes that amount, and Stripe may take it from your bank account.',
    whoLabel: 'Who pays it',
    whoTeams: 'Teams pay it',
    whoTeamsHint: 'Added to what the team pays.',
    whoClub: 'The club pays it',
    whoClubHint: 'The team pays the entry fee alone; the processing fee comes out of each payment.',
    whoChangeLater: 'You can change this later on the Payouts card.',
    moneyLabel: 'Where the money goes',
    moneyBody: 'Straight to your bank account through Stripe. FieldLogicHQ never holds it.',
    refundsLabel: 'Refunds',
    refundsBody: 'You set your own refund policy, and refunds come out of your Stripe balance.',
    // Required (owner 2026-11-17): written here, before Stripe; "Continue to Stripe" waits for it as it waits for the tick.
    policyLabel: 'Your refund policy',
    policyHint: 'Teams can read it beside Pay before they pay. You can change it later on the Payouts card.',
    policyRequired: 'Write your refund policy first.',
    termsCheckbox: (clubName: string) => `I agree to the FieldLogicHQ payments terms for ${clubName}.`,
    termsLink: 'Read the terms',
    cancel: 'Cancel',
    continue: 'Continue to Stripe',
  },
  record: {
    // The two sentences of `takingBody`, split into record rows (Payouts card redraw, drawings tab 1): same facts, same words.
    payoutsToLabel: 'Payouts go to',
    payoutsToValue: 'Your bank account, on Stripe’s schedule',
    receiptsLabel: 'Receipts say',
    receiptsValue: (clubName: string) => `“${clubName}”`,
    feeLabel: 'Processing fee',
    feeRead: { family: 'Teams pay it: it’s added to what they pay', club: 'The club pays it: it comes out of each payment' },
    feeRates: (rate: string, bankRate: string | null = null) => (bankRate ? `${rate} per card payment · ${bankRate} per bank debit` : `${rate} per card payment`),
    // 12d-1 words §3.4: under the rates line. (Stage 4 of Stripe-owned pricing retired `otherFeesPlan`, "Your plan doesn't
    // change": it answered the fees we used to bill back, which a club's balance now pays.)
    otherFees: 'The processing fee covers Stripe’s charge and FieldLogicHQ’s. Stripe takes more for a card issued outside your country, a currency conversion, a dispute or a returned bank debit. That comes out of your Stripe balance, so you may receive less on those payments.',
    feeEditLabel: 'Who pays the processing fee',
    choice: { family: 'Teams pay it', club: 'The club pays it' },
    choiceHint: {
      family: 'Added to what the team pays. You receive the full entry fee.',
      club: 'Teams pay the entry fee alone. The processing fee comes out of each payment and shows in your books as Payment processing.',
    },
    feeChangeNote: 'A change applies to payments started from now on. Anything already paid stays as it was.',
    policyLabel: 'Refund policy',
    policyHint: 'One or two sentences teams see beside Pay.',
    policyPlaceholder: 'For example: refunded in full until a date, then not refunded.',
    policyEmpty: 'None written. Online payments are paused until one is.',
    policyRequired: 'A refund policy is required, so it can’t be left blank. Change the words instead.',
    edit: 'Edit payouts',
    done: 'Done',
  },
  disconnect: {
    title: 'Disconnect payouts?',
    stops: 'Teams stop seeing Pay now right away, and pay links already emailed show your “How to pay” text instead.',
    owing: (n: number) =>
      n === 0 ? 'No team owes anything right now.' : n === 1 ? '1 team still owes money; it can pay you another way.' : `${n} teams still owe money; they can pay you another way.`,
    // 12c Part 6, words §3.8: between owing and past; not shown at 0.
    clearing: (n: number) => (n === 1
      ? '1 bank debit is still clearing. It’ll finish, and its money still reaches you.'
      : `${n} bank debits are still clearing. They’ll finish, and their money still reaches you.`),
    past: 'Payments already made stay in your books. Refunds of them are made in Stripe.',
    cancel: 'Cancel',
    confirm: 'Disconnect',
    done: 'Payouts disconnected.',
  },
  status: {
    takingLead: 'Taking payments',
    takingBody: 'Online payments go to the club’s bank account.',
    takingLink: 'Open Stripe',
    needsLead: 'Needs attention',
    needsBody: 'Online payments are paused: Stripe needs something from the owner.',
    needsBodyPolicy: 'Online payments are paused: the owner needs to write a refund policy.',
    needsBodyStillOn: (deadline: string | null) =>
      deadline ? `Online payments are still on. Stripe needs something from the owner by ${deadline}.` : 'Online payments are still on. Stripe needs something from the owner.',
    needsOwnerHint: (home: PayoutsHome) => `The owner fixes it in ${home === 'club' ? 'Settings › Payouts' : 'Settings & access › Payouts'}.`,
    offLead: 'Online payments are off',
    offBody: (date: string) => `The owner disconnected payouts on ${date}. Teams see the organizer’s payment instructions.`,
  },
  quiet: {
    line: 'Teams pay you directly, outside FieldLogicHQ.',
    link: 'Let them pay online',
  },
} as const;

/**
 * The words above, saying who actually pays (copy 12a §20, held for 12b; owner §0c): on League and Club (the card in
 * Settings › Payouts) families pay house-league fees online too, so "teams" becomes "families and teams". Tournament
 * Plus keeps "teams". One setting either way — only the words change.
 */
const PAYOUTS_WORDS_FAMILIES = {
  ...PAYOUTS_WORDS,
  tile: { ...PAYOUTS_WORDS.tile, sub: { ...PAYOUTS_WORDS.tile.sub, not_set_up: 'Let families and teams pay online by card' } },
  title: { ...PAYOUTS_WORDS.title, not_set_up: 'Let families and teams pay online', taking_payments: 'Families and teams can pay online' },
  settingUpBody: (date: string) => `You started on ${date}. Families and teams keep seeing your “How to pay” text until setup is finished.`,
  needsBody: 'Stripe needs something more from you. Until then families and teams see your “How to pay” text instead of Pay now. Nothing already paid is affected.',
  policyNeedsBody: 'Write your refund policy to turn them back on. Families and teams can read it beside Pay before they pay. Until then they see your “How to pay” text instead of Pay now. Nothing already paid is affected.',
  disconnectedBody: (date: string, name: string | null) =>
    `Disconnected ${date}${name ? ` by ${name}` : ''}. Payments already made stay in your books; refunds of them are made in Stripe. Families and teams see your “How to pay” text.`,
  before: {
    ...PAYOUTS_WORDS.before,
    whoTeams: 'Families and teams pay it',
    whoTeamsHint: 'Added to what the family or team pays.',
    whoClubHint: 'Families and teams pay the fee alone; the processing fee comes out of each payment.',
    policyHint: 'Families and teams can read it beside Pay before they pay. You can change it later on the Payouts card.',
  },
  record: {
    ...PAYOUTS_WORDS.record,
    feeRead: { ...PAYOUTS_WORDS.record.feeRead, family: 'Families and teams pay it: it’s added to what they pay' },
    choice: { ...PAYOUTS_WORDS.record.choice, family: 'Families and teams pay it' },
    choiceHint: {
      family: 'Added to what the family or team pays. You receive the full fee.',
      club: 'Families and teams pay the fee alone. The processing fee comes out of each payment and shows in your books as Payment processing.',
    },
    policyHint: 'One or two sentences families and teams see beside Pay.',
  },
  disconnect: { ...PAYOUTS_WORDS.disconnect, stops: 'Families and teams stop seeing Pay now right away, and pay links already emailed show your “How to pay” text instead.' },
  status: { ...PAYOUTS_WORDS.status, offBody: (date: string) => `The owner disconnected payouts on ${date}. Families and teams see the club’s payment instructions.` },
  quiet: { ...PAYOUTS_WORDS.quiet, line: 'Families and teams pay you directly, outside FieldLogicHQ.' },
};

/** A club's one refund policy is shown to its sponsors too (owner 2026-11-27), so the lines about it name them while clubs
 *  have Sponsorships. */
const PAYOUTS_WORDS_SPONSORS: typeof PAYOUTS_WORDS_FAMILIES = {
  ...PAYOUTS_WORDS_FAMILIES,
  policyNeedsBody: 'Write your refund policy to turn them back on. Families, teams and sponsors can read it beside Pay before they pay. Until then they see your “How to pay” text instead of Pay now. Nothing already paid is affected.',
  before: { ...PAYOUTS_WORDS_FAMILIES.before, policyHint: 'Families, teams and sponsors can read it beside Pay before they pay. You can change it later on the Payouts card.' },
  record: { ...PAYOUTS_WORDS_FAMILIES.record, policyHint: 'One or two sentences families, teams and sponsors see beside Pay.' },
};

/** The Payouts words for where the card lives: 'club' (League and Club) names families and teams; 'tournament'
 *  (Tournament Plus) names teams. */
export function payoutsWords(home: PayoutsHome): typeof PAYOUTS_WORDS_FAMILIES {
  if (home !== 'club') return PAYOUTS_WORDS;
  return sponsorshipsOpen() ? PAYOUTS_WORDS_SPONSORS : PAYOUTS_WORDS_FAMILIES;
}

/** "23 families still owe a house-league fee, and 2 teams still owe a tournament fee" (words §4.1 `disconnect.owing`). */
function oweClauses(families: number, teams: number): string {
  const f = families === 1 ? '1 family still owes a house-league fee' : `${families} families still owe a house-league fee`;
  const t = teams === 1 ? '1 team still owes a tournament fee' : `${teams} teams still owe a tournament fee`;
  return [families ? f : null, teams ? t : null].filter(Boolean).join(', and ');
}

/** "23 families and 2 teams still owe today." (words §4.2 `{owe}`), or nothing. */
function oweToday(families: number, teams: number): string {
  const f = families === 1 ? '1 family' : `${families} families`;
  const t = teams === 1 ? '1 team' : `${teams} teams`;
  if (families && teams) return `${f} and ${t} still owe today.`;
  if (families) return `${f} still ${families === 1 ? 'owes' : 'owe'} today.`;
  if (teams) return `${t} still ${teams === 1 ? 'owes' : 'owe'} today.`;
  return '';
}

/** The failed-subscription ending's first sentence: the owner's bell says only this; the Payouts card adds what follows. */
const LEAVING_FAILED_LINE = (clubName: string) => `${possessive(clubName)} subscription payment didn’t go through.`;

/** A bank's open questions, counted apart from disputes: no money is held on one (B-4, owner 2026-11-25). DRAFT. */
export const openBankQuestions = (n: number) => (n === 1 ? '1 bank question about a card payment is open' : `${n} bank questions about card payments are open`);
const allOf = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? '');

/** LEAVING ONLINE PAYMENTS (12d-2 Part 3; words CLUB_TIER_STAGE12D_COPY.md §4). One rule (ask 4): no ending disconnects
 *  the Stripe account; every ending closes open pay pages and counts them (ask 11). Marked "derived": no words-doc key,
 *  owed to /marketing. */
export const LEAVING_WORDS = {
  oweToday,
  disconnect: {
    owing: (families: number, teams: number) => (families || teams ? `${oweClauses(families, teams)}. They can pay you another way.` : 'Nobody owes anything right now.'),
    pages: (n: number) => (n === 1 ? '1 pay page is open right now. It closes when you disconnect.' : `${n} pay pages are open right now. They close when you disconnect.`),
    disputes: (n: number, due: string | null) => (n === 1
      ? `1 card dispute is open. Answer it in Stripe${due ? ` by ${due}` : ''}; Stripe holds its money until the bank decides.`
      : `${n} card disputes are open. Answer them in Stripe by their due dates; Stripe holds their money until the banks decide.`),
    inquiries: (n: number, due: string | null) => (n === 1
      ? `A bank is asking about a card payment. Answer it in Stripe${due ? ` by ${due}` : ''}. No money has been taken.`
      : `Banks are asking about ${n} card payments. Answer them in Stripe by their due dates. No money has been taken.`),
    past: 'Payments already made stay in your books. Refunds of them are made in Stripe, and your Stripe account stays yours.',
  },
  move: {
    heading: (dateLong: string) => `Online payments stop on ${dateLong}`,
    stops: (owe: string) => `Families and teams see your “How to pay” text instead of Pay now, and any pay pages still open then close.${owe ? ` ${owe}` : ''}`,
    finish: 'Bank debits still clearing finish and reach you. Refunds and disputes of payments already made keep working here, as now.',
    connected: 'Your payouts stay connected, so moving back up turns online payments on again.',
  },
  cancel: {
    heading: 'Online payments stop now',
    stops: (owe: string) => `Nobody can pay you online; pay pages still open close.${owe ? ` ${owe}` : ''}`,
    pages: (n: number) => (n === 1 ? '1 pay page is open right now.' : `${n} pay pages are open right now.`),
    clearing: (n: number) => (n === 1 ? '1 bank debit is still clearing. It finishes and reaches your bank.' : `${n} bank debits are still clearing. They finish and reach your bank.`),
    stripe: (disputes: number, inquiries = 0) => {
      const handled = allOf(['Refunds',
        disputes ? `the ${disputes} open ${disputes === 1 ? 'dispute' : 'disputes'}` : '',
        inquiries ? `the ${inquiries} open bank ${inquiries === 1 ? 'question' : 'questions'}` : ''].filter(Boolean));
      return `Your Stripe account stays yours: money in it keeps paying out to your bank. ${handled} are handled in Stripe while you’re suspended.`;
    },
  },
  // Plans end at the renewal date (Part C): a cancel that waits for its date. Its heading is the move's ("stop on {date}");
  // the rest is its own — nothing stops at the click, and the way back is keeping the plan, not "moving back up". Derived:
  // owed to /marketing (Stage 4).
  cancelOn: {
    stops: (owe: string) => `Until then families and teams pay you online as now. From that day they see your “How to pay” text instead of Pay now, and any pay pages still open close.${owe ? ` ${owe}` : ''}`,
    connected: (plan: string) => `Your payouts stay connected: keep ${plan} before then and nothing stops; reactivate later and online payments come back.`,
  },
  delete: {
    heading: 'Your online payments',
    waiting: (disputes: number, clearing: number, inquiries = 0) => {
      const d = disputes === 1 ? '1 card dispute is open' : `${disputes} card disputes are open`;
      const c = clearing === 1 ? '1 bank debit is still clearing' : `${clearing} bank debits are still clearing`;
      const parts = [disputes ? d : '', inquiries ? openBankQuestions(inquiries) : '', clearing ? c : ''].filter(Boolean);
      return parts.length ? `${allOf(parts)}. We wait for them before deleting.` : null;
    },
    owe: (owe: string) => (owe ? `${owe} Their pay pages close when we disconnect.` : null),
    disconnect: 'We disconnect your payouts before deleting. Your Stripe account stays yours, with any money in it.',
    /** Names a page the organization has (Settings in both workspaces Session 1, the build check on "from Accounting"): only
     *  the Club plans have Accounting; Tournament Plus exports from its Payouts tab, League Plus from Payouts on Settings. */
    export: {
      accounting: 'Your payment records here are deleted with everything else. Export them first from Accounting.',
      tournament_payouts: 'Your payment records here are deleted with everything else. Export them first from Payouts to your bank, on the Payouts tab.',
      settings_payouts: 'Your payment records here are deleted with everything else. Export them first from Payouts to your bank, under Payouts on your Settings page.',
    },
  },
  ending: {
    title: (dateLong: string) => `Online payments stop on ${dateLong}`,
    body: (endingSentence: string, owe: string) =>
      `${endingSentence} Families and teams will see your “How to pay” text instead of Pay now.${owe ? ` ${owe}` : ''} Your payouts stay connected.`,
    emailSubject: (clubName: string, dateLong: string) => `Online payments for ${clubName} stop on ${dateLong}`,
    emailBody: (owe: string) =>
      `From then, families and teams see your “How to pay” text instead of Pay now, and pay pages still open close.${owe ? ` ${owe}` : ''} Bank debits still clearing finish and reach you, and your Stripe account stays yours.`,
    emailButton: 'Open billing',
    // The comp's own sentence is the billing page's (words §4.2: reused, not reworded).
    compSentence: (targetPlan: string, dateLong: string) => `Your organization moves to the free ${targetPlan} plan on ${dateLong}.`,
    // Derived (owner 2026-10-27: a failed payment is warned the day it fails, with no date): owed to /marketing.
    failedTitle: 'Online payments stop if the subscription payment doesn’t go through',
    failedLine: LEAVING_FAILED_LINE,
    failedSentence: (clubName: string) => `${LEAVING_FAILED_LINE(clubName)} If it still doesn’t, ${clubName} is suspended and online payments stop.`,
    /** The owner's bell, opened (Notifications read at a glance, Stage 2). [marketing] The Payouts card keeps `body`. */
    bell: {
      planReason: (targetPlan: string) => `Moving to the free ${targetPlan} plan`,
      failedReason: 'The subscription payment didn’t go through',
      ifNotPaid: (clubName: string) => `${clubName} is suspended and online payments stop`,
      payNow: 'Becomes your “How to pay” text',
      payouts: 'Your Stripe account stays connected',
      /** "23 families and 2 teams", or nothing. */
      owing: (families: number, teams: number) => [families ? pluralize(families, 'family', 'families') : null, teams ? pluralize(teams, 'team') : null].filter(Boolean).join(' and '),
    },
    failedSubject: (clubName: string) => `Online payments for ${clubName} stop if the subscription payment doesn’t go through`,
  },
  // Derived (console words, owed to /marketing): what the operator's cancel or plan change stops, from the same count.
  // `when`: 'now', 'on the move', or 'on {date}' for a cancel that waits for its date (Plans end at the renewal date, Part C).
  operator: (o: { familiesOwing: number; teamsOwing: number; openPages: number; debitsClearing: number; openDisputes: number; openInquiries: number }, when: 'now' | 'on the move' | `on ${string}`) => {
    const parts = [
      oweToday(o.familiesOwing, o.teamsOwing).replace(/\.$/, ''),
      o.openPages ? (o.openPages === 1 ? '1 pay page closes' : `${o.openPages} pay pages close`) : '',
      o.debitsClearing ? (o.debitsClearing === 1 ? '1 bank debit is still clearing' : `${o.debitsClearing} bank debits are still clearing`) : '',
      o.openDisputes ? (o.openDisputes === 1 ? '1 card dispute is open' : `${o.openDisputes} card disputes are open`) : '',
      o.openInquiries ? openBankQuestions(o.openInquiries) : '',
    ].filter(Boolean);
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? '';
    return `Online payments stop ${when}${list ? `: ${list}` : ''}. The club’s Stripe account stays connected.`;
  },
  // Derived: the Payouts card after an ending while the account stays connected (the drawing's "wind-down card"; the
  // words doc has none). Built from §4.2's own sentences.
  windDown: {
    pill: 'Online payments off',
    title: 'Your plan doesn’t include online payments',
    body: 'Families and teams see your “How to pay” text instead of Pay now. Refunds and disputes of payments already made keep working here, as now.',
  },
} as const;

/** THE PAYOUTS LIST (12d-2 Part 2; words CLUB_TIER_STAGE12D_COPY.md §3). The line names live beside the mapping
 *  (`PAYOUT_LINE_WORDS`, lib/online-payouts-map.ts). Marked "derived": no words-doc key, owed to /marketing. */
export const PAYOUTS_LIST_WORDS = {
  tab: 'Payouts',
  find: 'Find an amount, a name or a receipt',
  dest: (last4: string) => `Paid out to the bank account ending ${last4}`,
  col: { sent: 'Sent', arrives: 'Arrives', status: 'Status', amount: 'Amount', date: 'Date', who: 'Who', what: 'What', receipt: 'Receipt' },
  status: { on_its_way: 'On its way', paid: 'Paid', failed: 'Didn’t arrive' },
  counts: (payments: number, refunds: number) => {
    const p = payments === 1 ? '1 payment' : `${payments} payments`;
    if (!refunds) return p;
    return `${p}, ${refunds === 1 ? '1 refund' : `${refunds} refunds`}`;
  },
  /** Phone row (words §3.1 `payouts.col.*`): "{amount} · {arrives or paid day}". */
  phoneRow: (amount: string, day: string) => `${amount} · ${day}`,
  phoneArrives: (day: string) => `arrives ${day}`,
  total: (last4: string | null, day: string) => (last4 ? `Paid to the bank account ending ${last4} on ${day}` : `Paid to the bank account on ${day}`),
  note: 'Amounts are what reached the club: after the processing fee when the club pays it.',
  noManual: 'Stripe lists what’s inside automatic payouts only.',
  // Derived: a payout Stripe hasn't finished matching yet (`reconciliation_status: in_progress`).
  matching: 'Stripe is still listing what’s inside this payout. Look again in a few minutes.',
  // Derived: a payout that didn't arrive carries nothing; its money stays in the club's Stripe balance.
  failedNone: 'This money stayed in the club’s Stripe balance. The next payout to a working account carries it.',
  loading: 'Loading payouts…',
  error: 'Stripe didn’t answer. Try again.',
  retry: 'Try again',
  empty: 'No payouts yet. Stripe sends the first one on its schedule after the first payment.',
  emptyDates: 'No payouts in these dates.',
  // Derived: Find matched nothing in the chosen dates.
  emptyFind: 'No payouts match.',
  exportFailed: 'The export didn’t finish. Try again.',
  fail: {
    info: (reason: string, answerer: string | null) => `Didn’t arrive${reason}${answerer ? ` · ${answerer} fixes it in Stripe` : ''}`,
    owner: (reason: string) => `Didn’t arrive${reason}`,
    ownerAria: 'Payout didn’t arrive. Fix in Stripe.',
    reason: { closed: ': the bank account is closed', invalid: ': the bank account details aren’t valid' } as Record<string, string>,
    tip: 'It clears itself when Stripe’s next payout to a working account goes through and carries this money.',
  },
  card: {
    heading: 'Payouts to your bank',
    summary: (onItsWay: string | null, lastPaid: { amount: string; day: string } | null) => {
      if (onItsWay && lastPaid) return `${onItsWay} on its way · last paid ${lastPaid.amount} on ${lastPaid.day}`;
      if (onItsWay) return `${onItsWay} on its way`;
      if (lastPaid) return `Last paid ${lastPaid.amount} on ${lastPaid.day}`;
      return null;
    },
  },
  // The export's columns (words §3.1 `payouts.export`: one row per payment with its payout's date and amount beside it).
  exportCols: ['Payout sent', 'Payout arrives', 'Payout status', 'Payout amount', 'Date', 'Who', 'What', 'Receipt', 'Amount'],
} as const;

/** The team's pay page and the pay block (copy §8, §9, §13 and §18). */
export const PAY_WORDS = {
  who: (team: string, division: string | null) => (division ? `${team} · ${division}` : team),
  // Public tournament pages Stage 7: the focused page's heading line (the band names the event) and its one way to ask (A1).
  focusedEyebrow: 'Team payment',
  questions: 'Questions about this payment?',
  heading: 'To pay now',
  chooseDeposit: (deposit: string) => `Pay the deposit, ${deposit}`,
  chooseDepositHint: (balance: string, date: string | null) => (date ? `The ${balance} balance is due ${date}.` : `The ${balance} balance is paid later.`),
  chooseFull: (total: string) => `Pay in full, ${total}`,
  savingLine: (saving: string) => `${saving} less in processing fees than paying the deposit and the balance separately.`,
  // 12c words §2.5 (ask 10): both rails, both computed, one sentence; only the rails the page offers.
  savingLineBoth: (card: string, bank: string) => `${card} less in processing fees by card, or ${bank} less by bank debit, than paying the deposit and the balance separately.`,
  noDepositHeading: (total: string) => `Pay the entry fee, ${total}`,
  balanceHeading: (balance: string) => `Pay the balance, ${balance}`,
  balanceDue: (date: string) => `Due ${date}.`,
  paidSoFar: (team: string, amount: string) => `${team} has paid ${amount} so far.`,
  emailLabel: 'Email for the receipt',
  button: (total: string) => `Pay ${total} by card`,
  // 12c words §2.1: a note under a button is a sentence (the bank note beside it carries a second one).
  buttonFeeNote: (fee: string) => `Includes a ${fee} processing fee.`,
  buttonBank: (total: string) => `Pay ${total} by bank debit`,
  buttonBankNote: (fee: string) => `Includes a ${fee} processing fee. Takes up to 5 business days.`,
  buttonBankNoteClubPays: 'Takes up to 5 business days.',
  refundPolicyLink: 'Refund policy',
  otherWays: (how: string) => `Or pay another way: ${how}`,
  opening: 'Opening the secure payment page…',
  confirmingTitle: 'Confirming your payment',
  // 12c words §6 decision 16: a family's words never name the processor (two 12a lines did).
  confirmingBody: 'We have your payment and are waiting for it to confirm. This usually takes a few seconds and the page updates by itself. Don’t pay again.',
  confirmingSlow: (email: string | null) =>
    email
      ? `This is taking longer than usual. You don’t need to pay again: we’ll email your receipt to ${email} as soon as it confirms.`
      : 'This is taking longer than usual. You don’t need to pay again: your receipt shows here as soon as it confirms.',
  notFinishedTitle: 'Payment not finished',
  notFinishedBody: 'You left the secure payment page before paying. Nothing was charged.',
  paidTitle: 'Paid, thank you',
  paidTo: (total: string, club: string) => `${total} to ${club}`,
  paidLine: (card: string, when: string, receiptNo: string) => `${card} · ${when} · receipt ${receiptNo}`,
  receiptLine: { deposit: 'Deposit', balance: 'Balance', full: 'Entry fee' } as Record<'deposit' | 'balance' | 'full', string>,
  receiptFee: 'Processing fee',
  receiptTotal: 'Paid',
  refundedTag: (date: string) => `Refunded to card, ${date}`,
  receiptsHeading: 'Receipts',
  revisit: 'This page shows your receipt any time you open your pay link.',
  nothingTitle: 'Nothing to pay',
  nothingBody: (team: string) => `There’s no entry fee to pay for ${team}.`,
  alreadyTitle: (team: string) => `${team} is paid in full`,
  alreadyBody: 'There’s nothing left to pay.',
  testLine: 'Test payment: no money moves.',
  testReceipt: 'Test payment · no money moved',
  // Today's words, verbatim, when the club isn't taking payments (A6; RegisterContent's PaymentPanel).
  notTakingHeader: 'Pay the organizer directly',
  notTakingTotal: 'Total fee',
  notTakingDeposit: 'Deposit',
  notTakingDue: (date: string) => `Due ${date}`,
  notTakingNoSchedule: 'The organizer has not published a fee schedule for this division yet.',
  notTakingHowLabel: 'How to pay',
  // Owner 2026-10-30: say what happens next, never "outside the platform" (a family has no word for our side of it).
  notTakingFoot: (hasHowToPay: boolean) => hasHowToPay
    ? 'You won’t be charged here. Pay the organizer using the instructions above.'
    : 'You won’t be charged here. The organizer will send you details on how to pay.',
  error: {
    notAccepted: (team: string) => `${team} hasn’t been accepted yet. You can pay once the organizer accepts it.`,
    ended: (team: string, tournament: string) => `${team} is no longer in ${tournament}, so there’s nothing to pay.`,
    alreadyPaid: (team: string) => `${team} is already paid in full.`,
    clubNotTaking: (club: string) => `${club} isn’t taking online payments right now.`,
    nothingOwed: (team: string) => `There’s nothing to pay for ${team} right now.`,
    linkInvalid: 'This payment link doesn’t work. Ask the organizer to email you a new one.',
    amountChanged: 'The amount to pay has changed. Check it below and try again.',
    couldntOpen: 'We couldn’t open the secure payment page. Nothing was charged. Try again.',
    switchOff: 'Online payments aren’t available yet.',
    tooSmall: 'This amount is too small to pay online. Pay the organizer another way.',
    // Derived (review 2026-10-25, M2): Stripe took a payment the organizer still has to settle; never a second payment.
    unrecorded: (team: string) => `A payment for ${team} is still being recorded by the organizer. Check back later before paying again.`,
  },
} as const;

/**
 * Board Ready call 12 — a team's "Pay link" line, its ⋯, the window in its three forms and the record's answer (drawing
 * BOARD_READY_PAY_LINK_BUTTON_DRAWINGS.html, asks 1A–9A ruled 2026-11-18). The window's words are the house league's
 * "Send a new link?" with "family" changed to the team. `cause` sentences are the record's own, from the server's cause
 * CODE (never the pay page's refusal: for a completed event it says the team "is no longer in" the tournament).
 */
export const PAY_LINK_LINE_WORDS = {
  line: 'Pay link',
  sent: (date: string) => `Pay link sent ${date}`,
  replaced: (date: string) => `Pay link replaced ${date}`,
  stopped: (date: string) => `Pay link stopped ${date}`,
  menuLabel: 'More for the pay link',
  menuNew: 'Send a new link',
  menuNewHint: 'Stops the link they have now',
  menuStop: 'Stop the pay link',
  menuStopHint: 'No new link goes out right now',
  newTitle: 'Send a new link?',
  stopTitle: 'Stop the pay link?',
  stopsNow: (team: string) => `${possessive(team)} current pay link stops working straight away, including any copy that was forwarded.`,
  /** "The new one goes to {email}." — the address bold, between the two parts. */
  goesToLead: 'The new one goes to',
  wrongAddress: 'If that address is wrong, change the email first.',
  underWay: 'A payment already on the card page still goes through. Anyone who has the old page open but hasn’t pressed Pay yet will need the new email.',
  underWayStop: 'A payment already on the card page still goes through.',
  // Board Ready leftover 6 (2026-11-19): a stopped link stays stopped in the automatic emails too.
  stopWhy: (cause: string) => `${cause}, so no new link goes out. Until someone sends the team a link again, its emails carry no Pay button.`,
  goNew: 'Send a new link',
  goStop: 'Stop the link',
  goOnlyStop: 'Only stop the link',
  /** Why no new link can go out, one sentence per cause (window 2's second paragraph; the answer lowers its first letter). */
  cause: {
    nothingOwed: 'Nothing is owed',
    over: 'The tournament is over',
    declined: 'The team was declined',
    withdrew: 'The team withdrew',
    notAccepted: 'The team hasn’t been accepted yet',
    notTaking: 'The club isn’t taking card payments right now',
    unrecorded: 'A card payment is still being recorded',
    clearing: 'A bank debit is still clearing',
    noEmail: 'This team has no email address',
  },
  // The answer, the record's quiet status line under the Pay link line (ask 7; never a toast).
  doneSent: (email: string) => `New link sent to ${email}. The old one has stopped.`,
  doneStopped: (because: string | null) => (because
    ? `The old link has stopped. No new link was sent, because ${because}.`
    : 'The old link has stopped. No new link was sent.'),
  notSent: (why: string) => `The old link has stopped, but the new one didn’t send. ${why}`,
  notSentNoEmail: 'This team has no email address. Add one with Edit this team, then use Email the pay link.',
  notSentRetry: 'Use Email the pay link to try again.',
  failed: 'Couldn’t replace the link. Try again. The old link still works.',
  failedStop: 'Couldn’t stop the link. Try again. The old link still works.',
  // Board Ready leftover 5 (owner ruling 2026-11-19): two people at the same moment. The second press does nothing.
  changedMeanwhile: 'Someone else just changed this pay link, so nothing was done here. The line shows what they did.',
  /** The bump landed, then someone stopped or replaced the link before the new one went: nothing was sent. */
  notSentChanged: 'The old link has stopped. Someone else changed the link at the same moment, so the new one wasn’t sent.',
  /** The new link went, but someone stopped or replaced it while it was sending: the team holds a link that doesn’t work. */
  doneOvertaken: (email: string) => `A new link went to ${email}, but someone else stopped or replaced it at the same moment, so it doesn’t work. The line shows what they did.`,
} as const;

/** The team's record: an online row, its ⋯, the view and the refund windows (copy §15–§16). */
export const TEAM_ROW_WORDS = {
  method: (receiptNo: string) => `Online, card · receipt ${receiptNo}`,
  // 12c words §3.9: a payment made by bank debit is refunded to the bank account, and every line says so (`bank`).
  refunded: (date: string, bank = false) => `Refunded to ${bank ? 'the bank account' : 'card'}, ${date}`,
  refundPending: (bank = false) => (bank ? 'Refunding to the bank account…' : 'Refunding to card…'),
  refundFailed: (bank = false) => `Refund didn’t reach the ${bank ? 'bank account' : 'card'}`,
  // 12c words §1.2: a part refund never strikes the row through; the reason is in View the payment.
  refundedPart: (amount: string, day: string, bank = false) => `${amount} refunded to ${bank ? 'the bank account' : 'card'}, ${day}`,
  refundedPartMore: (amount: string, day: string, bank = false) => `${amount} refunded to ${bank ? 'the bank account' : 'card'} · last ${day}`,
  refundPendingPart: (amount: string, bank = false) => `Refunding ${amount} to ${bank ? 'the bank account' : 'card'}…`,
  refundedPartStripe: (amount: string, day: string, bank = false) => `${amount} refunded to ${bank ? 'the bank account' : 'card'}, ${day} · made in Stripe`,
  refundFailedSub: (amount: string, day: string) => `${amount} sent back ${day}`,
  test: 'Test, no money moved',
  menuLabel: 'More for this payment',
  menuView: 'View the payment',
  menuRefund: (bank = false) => (bank ? 'Refund to the bank account' : 'Refund to the card'),
  // F6 (12c): one name for one act, in both flows.
  menuAnotherWay: 'Record the refund sent another way',
  menuEmailLink: 'Email the pay link',
  linkSent: (date: string) => `Pay link sent ${date}`,
  linkSentToast: (email: string) => `Pay link sent to ${email}.`,
  linkFailedToast: 'Couldn’t send the pay link. Try again.',
  /** Board Ready leftover 5: the email went, but someone stopped or replaced the link while it was sending. */
  linkOvertakenToast: (email: string) => `The pay link went to ${email}, but someone else stopped or replaced it at the same moment, so it doesn’t work.`,
  // 12c Part 6, words §3.7: a bank debit on the team's record.
  methodBank: (receiptNo: string) => `Online, bank debit · receipt ${receiptNo}`,
  methodBankClearing: 'Online, bank debit',
  clearing: 'Clearing',
  clearingSub: (started: string) => `Started ${started} · up to 5 business days`,
  debitReturned: (day: string, reasonShort: string) => `Bank debit returned ${day}${reasonShort ? ` · ${reasonShort}` : ''}`,
  debitReversed: (day: string) => `Returned by the bank, ${day}`,
  // A team declined or withdrawn while its debit clears (§3.3, a team's version; asked in its record, ask 7).
  clear: {
    lead: (total: string) => `A bank debit of ${total} is still clearing. It isn’t in the tournament’s book yet. When it clears:`,
    sendBack: 'Send it back to the bank account',
    sendBackSub: 'It goes back by itself when it clears, in your name.',
    sendBackSubClubPays: (base: string) => `The ${base} goes back by itself when it clears, in your name.`,
    feeBox: (fee: string, total: string) => `Include the ${fee} processing fee · ${total} back`,
    feeOnWhy: 'With the processing fee, because the club is declining.',
    feeOffWhy: 'Without the processing fee, because the team asked to leave.',
    feeOffPlain: 'Without the processing fee.',
    keep: 'Keep it',
    keepSub: 'Say why. It goes in the book as kept by the club.',
    keepReason: 'Reason',
    keepReasonError: 'Say why the club keeps it.',
    disconnected: 'Payouts are disconnected. Refund it in Stripe when it clears.',
    saveBack: 'Send it back when it clears',
    saveKeep: 'Keep it when it clears',
    saving: 'Saving…',
    decidedBack: (back: string) => `When it clears, ${back} goes back to the bank account.`,
    decidedKept: (base: string, reason: string) => `When it clears, the club keeps the ${base}. ${reason}`,
  },
} as const;

export const PAY_VIEW_WORDS = {
  title: (receiptNo: string) => `Payment ${receiptNo}`,
  paid: 'Paid',
  card: 'Card',
  base: 'Entry fee',
  feeTeam: 'Processing fee, paid by the team',
  feeClub: 'Processing fee, paid by the club',
  total: 'Total',
  from: 'From',
  close: 'Close',
  // 12c Part 6, words §3.7 `payView.bank`.
  bank: 'Bank account',
  bankValue: (last4: string) => `Account ending ${last4}`,
  started: 'Started',
  cleared: 'Cleared',
  // 12c words §1.4: each refund below the payment's facts (the house-league record's block, with the team's nouns).
  amountPart: (scopeNoun: string) => `Part of the ${scopeNoun}. A part refund never includes the processing fee.`,
  entry: 'Entry',
  entryValue: (lowered: string, entry: string) => `Lowered ${lowered} to ${entry}`,
  emailed: 'Team emailed',
  emailedNone: 'No email address on file. Tell the team yourself.',
  emailedNotFailed: 'Not emailed. Contact the team to arrange another way.',
} as const;

export const REFUND_WORDS = {
  // 12c words §1.1: titled for the payment ("Refund Riverside Rockets 12U’s deposit?").
  title: (team: string, scope: string) => `Refund ${possessive(team)} ${scope}?`,
  titleAnotherWay: 'Record the refund sent another way',
  paidTeams: (total: string, date: string, receiptNo: string, base: string, scopeNoun: string, fee: string) =>
    `Paid ${total} on ${date} (receipt ${receiptNo}): the ${base} ${scopeNoun} and a ${fee} processing fee.`,
  paidClub: (base: string, date: string, receiptNo: string, scopeNoun: string) => `Paid ${base} on ${date} (receipt ${receiptNo}): the ${scopeNoun}.`,
  choiceAll: 'All of it',
  // Where a refund goes is said once, above the choices: it is the same place whichever is picked.
  goesToCard: (card: string, both: boolean) => `${both ? 'Either way it' : 'It'} goes back to the card, ${card}, and can take 5 to 10 business days to appear, depending on the card company.`,
  goesToBank: (last4: string, both: boolean) => `${both ? 'Either way it' : 'It'} goes back to the bank account ending ${last4}, and arrives in about 3 business days.`,
  choicePart: 'Part of it',
  choicePartSub: (left: string) => `An amount up to ${left}, with a reason`,
  footChoose: 'Choose how much to refund.',
  partAmount: 'Amount to refund',
  partRest: (rest: string) => `${rest} stays paid`,
  partLimit: (left: string) => `Up to ${left}.`,
  partFeeNote: 'The processing fee isn’t part of a part refund.',
  partReason: 'Reason',
  partReasonHint: 'The team reads this in the refund email.',
  errAmount: (left: string) => `Enter an amount above $0 and up to ${left}.`,
  errReason: 'Say why only part is refunded.',
  partAlready: (refunded: string, day: string, left: string) => `${refunded} already refunded on ${day}. Up to ${left}.`,
  partAlreadyMany: (refunded: string, n: number, left: string) => `${refunded} already refunded in ${n} refunds. Up to ${left}.`,
  partBigger: (left: string, otherPossessive: string) => `Up to ${left} on this payment. Refund the rest from the ${otherPossessive} ⋯.`,
  partButton: (amount: string) => `Refund ${amount} and email`,
  footNoEmail: 'No email address on file. Tell the team yourself.',
  partDoneToast: (amount: string, rest: string, email: string | null, bank = false) =>
    `Refunded ${amount} to the ${bank ? 'bank account' : 'card'}. ${rest} stays paid.${email ? ` We emailed ${email}.` : ''}`,
  target: (card: string) => `Refund to the card, ${card}`,
  // {bankDays}: Stripe's refund to a bank account takes about 3 business days (plan §0k).
  arrivesBank: 'Arrives in about 3 business days',
  anotherWayLead: (bank = false) => `The refund to the ${bank ? 'bank account' : 'card'} came back. Record the money you sent the team another way, so the team’s record and the books match.`,
  whoLabel: 'Who is ending this?',
  whoOrganizer: 'The organizer is ending it',
  whoTeam: 'The team asked to leave',
  feeCheckbox: (fee: string, total: string) => `Include the ${fee} processing fee · ${total} back`,
  // Derived from §16 after the 2026-10-25 ruling (plan §0c). Neither part of the fee comes back on a refund (payments terms
  // v0.2 §4): on a Stripe-owned account Stripe keeps its part and FieldLogicHQ its own, so a fee the club gives back is the
  // club's whole cost and one "Payment processing" line. The words say whose cost it is, never how it splits.
  feeOnWhy: (fee: string) => `On because the organizer is ending it. The ${fee} comes from the club and shows in your books as Payment processing.`,
  feeOffWhy: (base: string) => `${base} back. Off because the team asked to leave; you can include it.`,
  feeOnChanged: (fee: string) => `The ${fee} comes from the club and shows in your books as Payment processing.`,
  noteLabel: 'Note to the team',
  noteHint: 'Goes in the refund email.',
  button: 'Refund and email',
  buttonAnotherWay: 'Record the refund',
  cancel: 'Cancel',
  working: 'Refunding…',
  doneToast: (amount: string, email: string | null, bank = false) => `Refunded ${amount} to the ${bank ? 'bank account' : 'card'}.${email ? ` We emailed ${email}.` : ''}`,
  pendingToast: (bank = false) => `The refund is on its way to the ${bank ? 'bank account' : 'card'}.`,
  recordedToast: 'Refund recorded.',
  failed: 'The refund didn’t go through. Nothing was refunded. Try again.',
  alreadyRefunded: 'This payment was already refunded.',
} as const;

/** A payment's label in a sentence (words `{scope}` / `{scopeNoun}`): "deposit", "balance", "payment" / "entry fee". */
export const SCOPE_WORDS = {
  scope: { deposit: 'deposit', balance: 'balance', full: 'payment' } as Record<'deposit' | 'balance' | 'full', string>,
  noun: { deposit: 'deposit', balance: 'balance', full: 'entry fee' } as Record<'deposit' | 'balance' | 'full', string>,
} as const;

/** 12c words §1.3: the team's record shows its entry lowered by part refunds, with the reason. */
export const TEAM_ENTRY_WORDS = {
  one: (entry: string, lowered: string, day: string, reason: string) => `Entry ${entry} for this team, lowered ${lowered} on ${day} · ${reason}`,
  head: (entry: string) => `Entry ${entry} for this team`,
  lowered: (lowered: string, day: string, reason: string) => `Lowered ${lowered} on ${day} · ${reason}`,
  stripe: 'made in Stripe',
  owesFailed: (owes: string, amount: string) => `Owes ${owes} · ${amount} refund didn’t reach the card`,
} as const;

/**
 * A BANK DEBIT, AS THE PAYER SEES IT (Club Tier Stage 12c Part 5; words CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md
 * §2). "Clearing" is the one word for a debit on its way (ask 5). A family's words say "spot", a team's "place". "Up to 5
 * business days" is Stripe's own figure (plan §0k). Family-facing words never name the processor or a bank.
 */
export const BANK_DEBIT_WORDS = {
  clearingTitle: 'Bank debit clearing',
  clearingBody: (total: string, last4: string, started: string) =>
    `${total} from the account ending ${last4}, started ${started}. Banks take up to 5 business days. We’ll email you when it clears.`,
  clearingBodyNoAccount: (total: string, started: string) =>
    `${total} by bank debit, started ${started}. Banks take up to 5 business days. We’ll email you when it clears.`,
  holdChild: (childPossessive: string) => `${childPossessive} spot is held.`,
  holdChildren: (children: string) => `Spots are held for ${children}.`,
  holdTeam: (teamPossessive: string) => `${teamPossessive} place is held.`,
  contact: (club: string, email: string | null) => (email ? `Wrong account, or a question? Contact ${club} at ${email}.` : `Wrong account, or a question? Contact ${club}.`),
  clearingBalance: (balance: string, date: string) => `The ${balance} balance is due ${date}.`,
  methodBankNoAccount: (started: string, cleared: string, receiptNo: string) =>
    `Bank debit · started ${started}, cleared ${cleared} · receipt ${receiptNo}`,
  methodBank: (last4: string, started: string, cleared: string, receiptNo: string) =>
    `Bank debit, account ending ${last4} · started ${started}, cleared ${cleared} · receipt ${receiptNo}`,
  returnedTitle: 'The bank debit didn’t go through',
  returnedBody: (day: string, reasonFull: string) => `Your bank returned it on ${day}${reasonFull}. Nothing was taken.`,
  reversedTitle: 'A bank payment was returned',
  reversedBody: (total: string, day: string, reasonFull: string, receiptNo: string, owesAgain: string) =>
    `Your bank reversed the ${total} debit on ${day}${reasonFull}. Receipt ${receiptNo} no longer counts, so ${owesAgain}.`,
  receiptReversedTitle: 'Returned by the bank',
  receiptReversedLine: (day: string) => `Reversed ${day}. This receipt no longer counts.`,
  // The pay route's refusal (words §2.6), page and JSON.
  errorClearing: (who: string, club: string) => `A bank debit for ${who} is clearing. You don’t need to pay again: ${club} will email you when it clears.`,
  // House league: a child on a clearing debit (words §2.2 `famPay.lineClearing`, `status.childClearing`).
  lineClearing: (child: string, division: string, fee: string) => `${child} · ${division} · ${fee} clearing`,
  childClearing: (fee: string) => `Fee ${fee} · clearing`,
} as const;

/** The bank's reason (words §2.3): mapped codes only; anything else prints no reason. */
export const BANK_REASON_WORDS: Record<string, { full: string; short: string }> = {
  insufficient_funds: { full: ': there wasn’t enough money in the account', short: 'not enough money' },
  account_closed: { full: ': the account is closed', short: 'account closed' },
  invalid_account: { full: ': the account details weren’t valid', short: 'invalid account' },
  not_authorized: { full: ': the debit wasn’t authorized', short: 'not authorized' },
};
export const reasonFull = (code: string | null | undefined) => (code ? BANK_REASON_WORDS[code]?.full ?? '' : '');
export const reasonShort = (code: string | null | undefined) => (code ? BANK_REASON_WORDS[code]?.short ?? '' : '');

/**
 * The desk's notices for a bank debit that came back (12c words §3.6), one per debit naming every child on it, to the desk
 * (house league) or whoever runs tournaments. `held` / `owesAgain` are composed by the caller ("Henry’s spot is", "Henry
 * owes $150.00 again").
 */
export const DEBIT_NOTICE_WORDS = {
  returnedTitle: (children: string) => `A bank debit for ${children} was returned`,
  returnedTitleTeam: (teamPossessive: string) => `${teamPossessive} bank debit was returned`,
  /** `debit_returned` (drawing tab 2): the amount leads with "nothing was taken"; the account, the day and the bank's
   *  reason each get a row (no reason from the bank, no row); the spot (a team's place) is still held; whether the family
   *  (the team's contact) was emailed, and when it wasn't, the next step says to tell them. */
  returned: (p: { who: MoneyNoticeWho; total: string; last4: string | null; day: string; reason: string | null; emailed: boolean }): NoticeText => ({
    body: `${p.total} didn’t go through on ${p.day}. Nothing was taken.`,
    facts: noticeFacts([
      factRow(L.amount, p.total, { lead: true, detail: 'nothing was taken' }),
      factRow(L.account, p.last4 ? `Ending ${p.last4}` : null),
      factRow(L.returned, p.day),
      factRow(L.reason, asSentence(reasonFull(p.reason))),
      factRow(isTeam(p.who) ? L.place : p.who.one ? L.spot : L.spots, 'Still held'),
      toldRow(p.who, p.emailed),
    ], tellYourself(p.who, p.emailed)),
  }),
  reversedTitleOne: (childPossessive: string) => `${childPossessive} bank payment was returned after it cleared`,
  reversedTitleMany: (children: string) => `A bank payment for ${children} was returned after it cleared`,
  reversedTitleTeam: (teamPossessive: string) => `${teamPossessive} bank payment was returned after it cleared`,
  /** `debit_reversed`: the payment, the day, out of which book, who owes what again, whether they were emailed. A team's
   *  copy says "team", never "family" (it used to reuse the family's sentence). */
  reversed: (p: { who: MoneyNoticeWho; receiptNo: string; total: string; day: string; owed: string; emailed: boolean }): NoticeText => ({
    body: `${receiptLead(p.receiptNo, p.total)}. The bank took it back on ${p.day}.`,
    facts: noticeFacts([
      amountRow(p.total, p.receiptNo),
      factRow(L.returned, p.day),
      bookRow(isTeam(p.who) ? 'tournament' : 'season'),
      owesAgainRow(whoName(p.who), p.owed, p.total),
      toldRow(p.who, p.emailed),
    ], tellYourself(p.who, p.emailed)),
  }),
  owesAgain: (who: string, amount: string, many: boolean) => `${who} ${many ? 'owe' : 'owes'} ${amount} again`,
  /** The family's own sentence (§2.2 reversedBody's `{owesAgain}`). */
  owingAgain: (amount: string) => `${amount} is owing again`,
} as const;

/**
 * PAID TWICE (Club Tier Stage 12d-1 Part 2; words CLUB_TIER_STAGE12D_COPY.md §2.2). "Paid twice" when the whole payment
 * was extra (the team had already paid in full), "more than owed" when only part was (D8: never "paid twice" for a team
 * that simply owed less). `bank` words the bank-debit rail. "Keep it" is a note, never a credit (owner, §7 ruling 5): the
 * button and the window's body are the ruling's; the title, toast and settled line drop "as a credit" to match it.
 */
export const OVER_WORDS = {
  pillTwice: (extra: string) => `${extra} paid twice`,
  pillMore: (extra: string) => `${extra} more than owed`,
  tagTwice: 'Paid after the team had already paid in full. Refund it from ⋯.',
  tagMore: (extra: string) => `Paid more than the team owed. Refund the extra ${extra} from ⋯.`,
  menuKeep: 'Keep it',
  titleTwice: (team: string, extra: string) => `${team} paid ${extra} twice`,
  titleMore: (team: string, extra: string) => `${team} paid ${extra} more than it owed`,
  /** `online_payment_over`, its one sender: "paid twice" (`whole`: the team had already paid in full) or "more than owed". */
  notice: (p: { amount: string; receiptNo: string; day: string; extra: string; bank: boolean; whole: boolean }): NoticeText => ({
    body: `${p.amount} landed on ${p.day}${p.whole ? ' after the team had already paid in full' : `, ${p.extra} more than the team owed`}.`,
    facts: noticeFacts([
      amountRow(p.amount, p.receiptNo),
      factRow(L.paid, p.day),
      p.whole ? factRow(L.extra, 'All of it', { lead: true, detail: 'the team had already paid in full' })
        : factRow(L.extra, p.extra, { lead: true, detail: 'more than the team owed' }),
      factRow(L.money, MONEY_IN_STRIPE),
    ], p.whole ? `Refund it to the ${railTarget(p.bank)}.` : `Refund the extra ${p.extra} to the ${railTarget(p.bank)}.`),
  }),
  // The settled lines live with the others (SETTLED_WORDS.overRefunded / overKept / overEntryRaised).
  // The refund window it opens (12c's, set; words §2.2 `refund.twice.*` / `refund.more.*`).
  allSub: (howPaid: string | null) => (howPaid ? `Paid twice: the team had already paid ${howPaid}` : 'Paid twice: the team had already paid in full'),
  prefillTwice: 'Paid twice',
  prefillMore: 'Paid more than the team owed',
  feeWhy: 'The processing fee comes back too, because the team shouldn’t pay a fee on money it didn’t owe.',
  // "Keep it" (§7 ruling 5: a note).
  keepTitle: (team: string, extra: string) => `Keep ${possessive(team)} extra ${extra}?`,
  keepBody: (team: string, extra: string) => `${team} paid ${extra} more than it owed. The club keeps the money. Say why.`,
  keepReason: 'Reason',
  keepReasonError: 'Say why the club keeps it.',
  keepButton: 'Keep it',
  keepWorking: 'Saving…',
  keepDone: (extra: string, team: string) => `Kept ${extra} paid by ${team}.`,
  keptLine: (extra: string, reason: string) => `Kept ${extra} · ${reason}`,
  keepGone: 'Nothing on this payment is extra any more.',
  keepRefundPending: 'A refund on this payment is on its way. Keep it once it has gone through, if anything is still extra.',
} as const;

/** `{howPaid}`: the earlier payment's method, lowercase in a sentence ("by e-transfer", "online"). */
export function howPaidWords(method: string | null | undefined): string | null {
  switch (method) {
    case 'etransfer': return 'by e-transfer';
    case 'cash': return 'in cash';
    case 'cheque': return 'by cheque';
    case 'card': return 'by card';
    case 'online_card': case 'online_bank': return 'online';
    default: return null;
  }
}

/** "7:59 p.m." today, "Nov 11 at 7:59 p.m." another day: the moment a pay page opened, in the club's zone. */
function openedWhen(iso: string, today: string): string {
  const z = utcToZonedInputs(iso);
  return z.date === today ? `at ${formatTime(z.time)}` : `on ${formatStoredDate(z.date, { withYear: false })} at ${formatTime(z.time)}`;
}

/**
 * A PAY PAGE IS OPEN WHILE THE DESK RECORDS BY HAND (12d-1 Part 2, ask 12; words §2.1). An info notice in the form, never
 * a block: recording closes the page. `family` swaps the team's words for a house-league family's.
 */
export const PAY_OPEN_WORDS = {
  // The clock ends "p.m.", so the sentence's own full stop is absorbed ("…at 7:59 p.m. Recording…").
  notice: (who: string | null, amount: string, openedAt: string, today: string, family: boolean) =>
    `${who ?? (family ? 'The family' : 'The team’s contact')} opened a pay page for ${amount} ${openedWhen(openedAt, today)} Recording this closes it, so the ${family ? 'family' : 'team'} can’t pay twice.`,
  noticeMany: (n: number, childFirst: string | null) =>
    childFirst
      ? `${n} pay pages are open for ${childFirst}. Recording this closes them, so the family can’t pay twice.`
      : `${n} pay pages are open for this team. Recording this closes them, so the team can’t pay twice.`,
  doneToast: (amount: string, name: string, many: boolean) =>
    `Recorded ${amount} for ${name}. ${many ? 'The open pay pages are closed.' : 'The open pay page is closed.'}`,
  partNote: (left: string, family: boolean) => `The ${family ? 'family’s' : 'team’s'} pay link still works for the ${left} still owing.`,
} as const;

/**
 * The cardholder's reason (12d words §1.2): Stripe's reason, mapped; anything else prints nothing and the sentence ends
 * after the date. "Fraud" is never printed (§7 ruling 4): a club reads it as an accusation of the family.
 */
const DISPUTE_REASON_WORDS: Record<string, { full: string; short: string }> = {
  fraudulent: { full: ': the cardholder says they didn’t make this payment', short: 'didn’t make it' },
  unrecognized: { full: ': the cardholder says they didn’t make this payment', short: 'didn’t make it' },
  duplicate: { full: ': the cardholder says they were charged twice', short: 'charged twice' },
  credit_not_processed: { full: ': the cardholder says a refund never arrived', short: 'refund never arrived' },
  product_not_received: { full: ': the cardholder says they didn’t get what they paid for', short: 'not received' },
  product_unacceptable: { full: ': the cardholder says it wasn’t as described', short: 'not as described' },
};
export const disputeWhyFull = (reason: string | null | undefined) => (reason ? DISPUTE_REASON_WORDS[reason]?.full ?? '' : '');
export const disputeWhyShort = (reason: string | null | undefined) => (reason ? DISPUTE_REASON_WORDS[reason]?.short ?? '' : '');

/** A sentence that ends on a clock ("…7:59 p.m.") absorbs its own full stop (Part 2's lesson, `PAY_OPEN_WORDS.notice`). */
export const endSentence = (s: string) => (s.endsWith('.') ? s : `${s}.`);
/** " Answer in Stripe by {due}.", or nothing when the bank allows no answer (no due date: /review 2026-10-27). */
const answerIn = (due: string) => (due ? ` Answer in Stripe by ${endSentence(due)}` : '');

/** `{due}` on a screen ("Nov 11") and with the clock ("Nov 11 at 7:59 p.m."), in the club's zone; `full` adds the year
 *  (an email, words "Dates"). */
export function disputeDue(iso: string | null | undefined, opts: { clock?: boolean; year?: boolean } = {}): string {
  if (!iso) return '';
  const z = utcToZonedInputs(iso);
  const day = formatStoredDate(z.date, { withYear: !!opts.year });
  return opts.clock ? `${day} at ${formatTime(z.time)}` : day;
}

/**
 * A CARD PAYMENT IS DISPUTED (Club Tier Stage 12d-1 Part 3; words CLUB_TIER_STAGE12D_COPY.md §1.1–§1.6). Amber and the
 * button are the answerer's alone (the person who set up payouts, the only one who can sign in to Stripe); everyone else
 * reads the same facts quietly, with that person's name (D3). Nothing is sent to a family (ask 2).
 */
export const DISPUTE_WORDS = {
  // §1.1 the Fee cell / a team's payment row.
  // An inquiry keeps "Bank asking" once answered or past due (B-4, owner 2026-11-25): it never turns into "Disputed" by time.
  chip: {
    disputed: 'Disputed', inquiry: 'Bank asking', withBank: 'Disputed · with the bank', notAnswered: 'Disputed · not answered',
    inquiryAnswered: 'Bank asking · answered', inquiryNotAnswered: 'Bank asking · not answered', // DRAFT
  },
  answerBy: (name: string, due: string) => `${name} answers by ${due}`,
  answerByYou: (due: string) => `Answer by ${due}`,
  answered: (day: string) => `Answered ${day}`,
  wasDue: (day: string) => `Was due ${day}`,
  wonSub: (day: string) => `dispute won ${day}`,
  lost: (fee: string) => `${fee} owing · dispute lost`,
  lostSub: (day: string, receiptNo: string) => `Taken back by the bank ${day} · receipt ${receiptNo}`,
  teamRowLost: (day: string) => `Taken back by the bank, ${day}`,
  tip: (held: string, book: 'season' | 'tournament') =>
    `The cardholder’s bank is disputing this payment. Stripe is holding ${held} from the club’s Stripe balance until the bank decides. The payment stays in the ${book === 'season' ? 'season’s' : 'tournament’s'} book.`,
  tipAnswered: 'The cardholder’s bank is disputing this payment. Nothing is left for the club to do; the bank decides, and this can take weeks.',
  // Derived (the item's inquiry words, §1.4) for the chip's tap on an inquiry, where nothing is held: owed to /marketing.
  tipInquiry: 'The cardholder’s bank is asking about this payment. Nothing has been taken.',
  tipInquiryAnswered: 'The cardholder’s bank is asking about this payment. Nothing has been taken, and nothing is left for the club to do.', // DRAFT
  // §1.2 the record block.
  heading: 'The cardholder’s bank is disputing this payment',
  headingInquiry: 'The cardholder’s bank is asking about this payment',
  headingWon: 'Dispute won',
  headingLost: 'Dispute lost',
  pillAnswerBy: (due: string) => `Answer by ${due}`,
  pillOwingAgain: 'Owing again',
  opened: 'Opened',
  why: 'Why',
  held: 'Held by Stripe',
  heldValue: (held: string) => `${held}, taken from the club’s Stripe balance until the bank decides`,
  heldNone: 'Nothing taken yet',
  answerByLabel: 'Answer by',
  answeredLabel: 'Answered',
  wasDueLabel: 'Was due',
  fee: 'Dispute fee',
  // Ruling 6 (owner 2026-10-27): printed only when Stripe reports the figure.
  feeFromClub: (fee: string) => `Stripe took its dispute fee, ${fee}, from the club’s Stripe balance.`,
  ref: 'Stripe reference',
  answer: 'Answer in Stripe',
  openFailed: 'Stripe didn’t open. Try again.',
  copy: 'Copy the facts',
  copyAria: 'Copy the facts for Stripe',
  copied: 'Copied',
  factsLead: (facts: string) => `Stripe asks for your side, with evidence. Copy the facts holds what we have: ${facts}.`,
  factSignup: (day: string, name: string) => `the sign-up on ${day} by ${name}`,
  factTeamSignup: (day: string, contact: string) => `the team’s registration on ${day} by ${contact}`,
  factPolicy: 'the refund policy shown beside Pay',
  factReceipt: (receiptNo: string, email: string, day: string) => `receipt ${receiptNo} emailed to ${email} on ${day}`,
  onlyAnswerer: (name: string, emailedDay: string | null, team: boolean) =>
    `Only ${name}, who set up payouts, can sign in to Stripe.${emailedDay ? ` We emailed ${name} on ${emailedDay}.` : ''} If the ${team ? 'team' : 'family'} calls, they can withdraw it with their bank.`,
  noRefund: (team: boolean) => `No refund while it’s open: Stripe has already taken the money back, and a refund on top would pay the ${team ? 'team' : 'family'} twice.`,
  refunded: (day: string) => `This payment was refunded on ${day}. Tell Stripe that in your answer.`,
  won: (day: string) => `Won ${day}. The money is back in the club’s Stripe balance.`,
  // The team's book is the tournament's (12c's reversed-debit sentence names its book the same way).
  lostLine: (day: string, receiptNo: string, book: 'season' | 'tournament', owesAgain: string) =>
    `Lost ${day}. The bank took back receipt ${receiptNo}. It’s out of the ${book === 'season' ? 'season’s' : 'tournament’s'} book, and ${owesAgain}.`,
  siblings: (children: string) => `This is one payment for ${children}. The dispute is on the whole payment.`,
  siblingsInquiry: (children: string) => `This is one payment for ${children}. The bank’s question is about the whole payment.`, // DRAFT
  againAfterOther: (childFirst: string) =>
    `${childFirst} paid again another way after the dispute was lost. If this dispute is now won, ${childFirst} has paid twice.`,
  // §1.4 Needs attention. `who` is "{childPossessive}" / "{teamNamePossessive}"; `payer` is "{guardianPossessive}".
  itemTitle: (who: string) => `${who} card payment is disputed`,
  itemTitleMany: (children: string) => `A card payment for ${children} is disputed`,
  itemTitleInquiry: (who: string) => `The bank is asking about ${who} card payment`, // DRAFT
  itemTitleManyInquiry: (children: string) => `The bank is asking about a card payment for ${children}`, // DRAFT
  /**
   * `card_disputed` (drawing tab 3): ONE entry for its four cases. The answerer's copy (`answers` null) carries the
   * bank's reason (no reason, no row), what Stripe holds (the figure leads only when it differs from the Amount row's;
   * an inquiry takes nothing) and the deadline as a row, "Answer by" (Q2, A), with the instruction as the line under the
   * rows. The desk's quieter copy says who answers and by when, and that a win changes nothing here.
   * `payer`: the guardian's name, or null when it isn't known (a team's cardholder) — no row then.
   */
  item: (p: {
    payer: string | null; receiptNo: string; amount: string; reason: string | null; held: string; inquiry: boolean;
    due: string; dueDay: string; answers: string | null;
  }): NoticeText => {
    const lead = receiptLead(p.receiptNo, p.amount);
    const head = [amountRow(p.amount, p.receiptNo), factRow(L.paidBy, p.payer)];
    if (p.answers != null) {
      return {
        body: `${lead}.${p.dueDay ? ` ${p.answers} answers it in Stripe by ${p.dueDay}.` : ''}`,
        facts: noticeFacts([...head, factRow(L.whoAnswers, `${p.answers}, in Stripe`), factRow(L.answerBy, p.due, { lead: true })],
          p.inquiry ? null : 'If the club wins, nothing changes here.'),
    };
    }
    const until = 'until the bank decides';
    const held = p.inquiry ? factRow(L.held, 'Nothing has been taken')
      : p.held === p.amount ? factRow(L.held, `From the club’s Stripe balance, ${until}`)
        : factRow(L.held, p.held, { lead: true, detail: `from the club’s Stripe balance, ${until}` });
    return {
      body: `${lead}.${answerIn(p.due)}`,
      facts: noticeFacts([...head, factRow(L.reason, asSentence(disputeWhyFull(p.reason))), held, factRow(L.answerBy, p.due, { lead: true })],
        !p.due ? null : p.inquiry ? 'Answer it in Stripe: answering can stop it becoming a dispute.' : 'Answer it in Stripe.'),
    };
  },
  lostTitle: (who: string) => `${who} dispute was lost`,
  lostTitleMany: (children: string) => `The dispute for ${children} was lost`,
  /** `card_dispute_lost`: the payment, the day the bank took it, out of which book, who owes again; nobody was emailed. */
  lostNotice: (p: { who: MoneyNoticeWho; receiptNo: string; amount: string; day: string; owed: string }): NoticeText => ({
    body: `${receiptLead(p.receiptNo, p.amount)}. The bank took it back on ${p.day}.`,
    facts: noticeFacts([
      amountRow(p.amount, p.receiptNo),
      factRow(L.returned, p.day),
      bookRow(isTeam(p.who) ? 'tournament' : 'season'),
      owesAgainRow(whoName(p.who), p.owed, p.amount),
      factRow(L.told, 'Not emailed'),
    ]),
  }),
  /** "{guardianPossessive}" when the payer is not named. */
  payerUnknown: 'The cardholder’s',
  // §1.5 money.
  band: (n: number, held: string) => (n === 1
    ? `1 card payment is disputed. Stripe is holding ${held} from the club’s balance until the bank decides; it stays in Received until then.`
    : `${n} card payments are disputed. Stripe is holding ${held} from the club’s balance until the banks decide; they stay in Received until then.`),
  moneyLine: (receiptNo: string, whyShort: string) => (whyShort ? `Dispute lost · ${whyShort} · receipt ${receiptNo}` : `Dispute lost · receipt ${receiptNo}`),
  moneyHow: 'Taken back by the bank',
  bulkWhy: 'a dispute was lost',
  // Ruling 5 (owner 2026-10-27): one "Email the pay link" after a lost dispute asks first, never skips; the bulk send
  // still leaves them out. Words: /marketing 2026-10-27 (copy doc §1.5).
  sendAnywayTitle: 'Email the pay link anyway?',
  sendAnywayBody: (team: boolean) => (team
    ? 'The bank took this team’s card payment back, and the club lost the dispute. Payment reminders leave the team out so someone can talk to them first. You can still send the pay link.'
    : 'The bank took this family’s card payment back, and the club lost the dispute. Email families who owe leaves them out so someone can talk to them first. You can still send the pay link.'),
  sendAnywayGo: 'Email the pay link',
} as const;

/**
 * §1.3 "Copy the facts": the one string the club pastes into Stripe, where a bank reads it. Plain statements in the club's
 * voice; every line is dropped when its fact is missing (nothing guessed or padded). Nothing is submitted (ask 13).
 */
export function disputeFactsText(f: {
  test: boolean; receiptNo: string; amount: string; paidDay: string; cardLast4: string | null;
  payerName: string | null; payerEmail: string | null; forLine: string;
  registeredDay: string | null; registeredBy: string | null; refundPolicy: string | null;
  receiptEmailedDay: string | null; club: string; contactEmail: string | null;
  /** The bank is only asking: the text never calls the payment disputed. */
  inquiry?: boolean;
}): string {
  const paidBy = f.payerName ? `${f.payerName}${f.payerEmail ? ` (${f.payerEmail})` : ''}` : f.payerEmail;
  return [
    f.test ? 'Test mode: no money moved.' : null,
    `${f.inquiry ? 'Payment the bank is asking about' : 'Disputed payment'}: receipt ${f.receiptNo}, ${f.amount}, paid ${f.paidDay} by card${f.cardLast4 ? ` ending ${f.cardLast4}` : ''}.`,
    paidBy ? `Paid by ${paidBy}.` : null,
    `For: ${f.forLine}.`,
    f.registeredDay ? `Registered ${f.registeredDay}${f.registeredBy ? ` by ${f.registeredBy}` : ''}.` : null,
    'The payer entered the card on Stripe’s secure payment page.',
    f.refundPolicy ? `Refund policy shown beside Pay: “${f.refundPolicy}”` : null,
    f.receiptEmailedDay && f.payerEmail ? `Receipt ${f.receiptNo} was emailed to ${f.payerEmail} on ${f.receiptEmailedDay}.` : null,
    `Contact: ${f.club}${f.contactEmail ? `, ${f.contactEmail}` : ''}.`,
  ].filter((l): l is string => !!l).join('\n');
}

/** §1.6: the email to the person who answers, when a dispute opens (FieldLogicHQ's own envelope). The reminder three days
 *  before it is due is the daily job's (Part 4). */
export const DISPUTE_EMAIL_WORDS = {
  subject: (club: string) => `A card payment to ${club} is disputed`,
  subjectInquiry: (club: string) => `A bank is asking about a card payment to ${club}`,
  preheader: (dueFull: string) => `Answer in Stripe by ${endSentence(dueFull)}`,
  lead: (payer: string, forWhom: string, receiptNo: string, day: string, whyFullSentence: string) =>
    `${payer} bank is disputing a card payment for ${forWhom} (receipt ${receiptNo}, ${day}).${whyFullSentence}`,
  leadInquiry: (payer: string, forWhom: string, receiptNo: string, day: string, whyFullSentence: string) =>
    `${payer} bank is asking about a card payment for ${forWhom} (receipt ${receiptNo}, ${day}).${whyFullSentence} Nothing has been taken.`,
  /** `{whyFullSentence}`: " The cardholder says they didn’t make this payment." or nothing. */
  whySentence: (whyFull: string) => (whyFull ? ` The ${whyFull.replace(/^: the /, '')}.` : ''),
  held: 'Held by Stripe',
  heldNone: 'Nothing taken',
  answerBy: 'Answer by',
  act: (recordPossessive: string | null) => `Answer it in Stripe with your evidence. ${recordPossessive ? `${recordPossessive} record has` : 'Each child’s record has'} the facts to copy.`,
  // Siblings: §1.4's "Open the registrations" (the link opens the season's list).
  button: (recordPossessive: string | null) => (recordPossessive ? `Open ${recordPossessive} record` : 'Open the registrations'),
  noChange: 'If the club wins, nothing changes in your books.',
  // §1.6 email 2: three days before the answer is due, only while unanswered (the daily job, 12d-1 Part 4).
  reminder: {
    subject: (due: string, club: string) => `Answer by ${due}: a card dispute for ${club}`,
    lead: (receiptNo: string, forWhom: string, dueFull: string) => `The dispute on receipt ${receiptNo} for ${forWhom} is due to be answered in Stripe on ${endSentence(dueFull)}`,
    after: 'If it isn’t answered by then, the bank decides without the club’s side.',
    // The bank only asking (B-4, owner 2026-11-25). DRAFT; /marketing 2026-11-26.
    subjectInquiry: (due: string, club: string) => `Answer by ${due}: a bank is asking about a card payment to ${club}`,
    leadInquiry: (receiptNo: string, forWhom: string, dueFull: string) => `The bank’s question about receipt ${receiptNo} for ${forWhom} is due to be answered in Stripe on ${endSentence(dueFull)}`,
    afterInquiry: 'Nothing has been taken. Answering can stop it becoming a dispute.',
  },
} as const;

/** A FieldLogicHQ Stripe-fee invoice from before Stripe-owned pricing Stage 4 (2026-11-18), as platform admin's Money tab names
 *  one read from its tax record (kind 'fee'). History only: nothing makes one now (Stripe takes those fees from the club's own
 *  balance), and production never had one. The rest of the fee-invoice words retired with the machinery. */
export const FEE_INVOICE_HISTORY_LABEL = (invoiceNo: string | null) => `Stripe fees on online payments${invoiceNo ? ` · invoice ${invoiceNo}` : ''}`;

/** The four bank-debit emails (words §2.4). A team's version swaps the children for the team, "spot" for "place". */
export const BANK_DEBIT_EMAIL_WORDS = {
  startedSubject: (club: string) => `Your bank debit to ${club} has started`,
  startedPreheader: (total: string, last4: string | null) =>
    (last4 ? `${total} from the account ending ${last4}. It takes up to 5 business days.` : `${total} by bank debit. It takes up to 5 business days.`),
  startedLead: (who: string, season: string) => `Your bank debit for ${who} in ${season} has started.`,
  amount: 'Amount',
  from: 'From',
  fromValue: (last4: string) => `Account ending ${last4}`,
  started: 'Started',
  notReceipt: 'This isn’t your receipt. We’ll send it when the debit clears.',
  takes: 'Banks take up to 5 business days.',
  receiptTotalBank: (total: string, last4: string | null, cleared: string) =>
    `Total paid · ${total} · Bank debit${last4 ? `, account ending ${last4}` : ''} · ${cleared}`,
  receiptBankDates: (started: string, cleared: string) => `Your bank debit started on ${started} and cleared on ${cleared}.`,
  returnedSubject: 'Your bank debit didn’t go through',
  returnedLead: (total: string, who: string, day: string, reasonFull: string) => `Your bank returned your ${total} debit for ${who} on ${day}${reasonFull}.`,
  returnedNothing: 'Nothing was taken from your account.',
  returnedHeldChild: (childPossessive: string) => `${childPossessive} spot is still held.`,
  returnedHeldChildren: (children: string) => `Spots are still held for ${children}.`,
  returnedHeldTeam: (teamPossessive: string) => `${teamPossessive} place is still held.`,
  payNow: 'Pay now',
  reversedSubject: (club: string) => `A payment to ${club} was returned`,
  reversedLead: (total: string, club: string, day: string) => `Your bank reversed a ${total} payment to ${club} on ${day}.`,
  reversedReason: (reasonFull: string) => `Your bank’s reason${reasonFull}.`,
  reversedOwes: (receiptNo: string, owesAgain: string) => `Receipt ${receiptNo} no longer counts, so ${owesAgain}.`,
} as const;

/** THE CONSOLE'S ONLINE PAYMENTS, READ ONLY (12d-2 Part 5; words CLUB_TIER_STAGE12D_COPY.md §6). Internal, but product
 *  words: sentence case, the house clock, no "Stripe error" jargon. */
export const PA_WORDS = {
  rail: 'Online payments',
  tab: 'Online payments',
  test: 'Test mode. Nothing here is real money.',
  tileAccount: 'Account',
  connected: (day: string, name: string | null) => (name ? `Connected ${day} by ${name}` : `Connected ${day}`),
  disconnected: (day: string, name: string | null) => (name ? `Disconnected ${day} by ${name}` : `Disconnected ${day}`),
  endedPlan: (day: string | null, targetPlan: string) => `Online payments ended${day ? ` ${day}` : ''}: the plan moved to ${targetPlan}`,
  endedSuspended: (day: string | null) => `Online payments ended${day ? ` ${day}` : ''}: the organization was suspended`,
  stripeClosed: (day: string) => `Stripe closed this account on ${day}`,
  tileTerms: 'Terms',
  termsDraft: 'Draft',
  termsVersion: (versionDate: string) => `Version of ${versionDate}`,
  termsStale: 'Out of date',
  termsSubDraft: (day: string) => `Agreed ${day} · ask again at final`,
  termsSub: (day: string) => `Agreed ${day}`,
  termsSubStale: (day: string) => `Agreed ${day} · newer terms exist`,
  termsNone: 'Not agreed',
  tileVolume: 'Last 30 days',
  volumeSub: (payments: number, refunds: number) =>
    `${payments === 1 ? '1 payment' : `${payments} payments`} · ${refunds === 1 ? '1 refund' : `${refunds} refunds`}`,
  tileClearing: 'Clearing',
  clearingSub: (n: number) => (n === 1 ? '1 bank debit' : `${n} bank debits`),
  tileDisputes: 'Open disputes',
  disputesSub: (fees: string) => `${fees} in Stripe’s fees so far`,
  panelDisputes: 'Open disputes',
  col: { payment: 'Payment', why: 'Why', answerBy: 'Answer by', held: 'Held', message: 'Message', error: 'Error', received: 'Received', tries: 'Tries' },
  disputeRow: (receiptNo: string, home: string) => `Receipt ${receiptNo} · ${home}`,
  showPlayer: 'Show the player',
  playerLogged: 'Opening a name is logged.',
  panelMessages: 'Stripe messages we couldn’t process',
  messagesStopped: 'Stopped retrying',
  empty: 'Nothing is open.',
  // Derived: the tab's own read failed (the console's "could not be read" shape).
  readFailed: 'The club’s online payments could not be read. Try again.',
  health: {
    title: 'Online payments',
    needs: 'Needs a look',
    col: { club: 'Club', what: 'What', since: 'Since' },
    dispute: (n: number, due: string | null) => (n === 1
      ? `1 open dispute${due ? `, due ${due}` : ''}`
      : `${n} open disputes${due ? `, first due ${due}` : ''}`),
    disconnected: (n: number) => (n === 1 ? 'Disconnected with 1 dispute open' : `Disconnected with ${n} disputes open`),
    closed: 'Stripe closed the account',
    messages: (n: number) => (n === 1 ? '1 Stripe message failed' : `${n} Stripe messages failed`),
    terms: 'Not on the current payments terms',
    empty: 'Nothing needs a look.',
    readFailed: 'The list could not be read. Try again.',
  },
} as const;
