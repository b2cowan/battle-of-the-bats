/**
 * The words of online payments (Club Tier Stage 12a). Source: `docs/projects/active/CLUB_TIER_STAGE12A_COPY.md`
 * (/marketing, 2026-10-25), keyed the same way. One home, so a screen, an email and a notice say a thing one way.
 *
 * ⚠ No rate is typed here: a rate is printed by `onlineFeeRateLabel()` from `lib/plan-config.ts`. No legal sentence is
 * written here either: the payments terms are counsel's (TERMS_PLACEHOLDER).
 */
import { formatStoredDate, utcToZonedInputs } from './timezone';
import { formatTime, possessive } from './utils';

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

export const TERMS_PLACEHOLDER = '[PAYMENTS TERMS — counsel to write]';

/** The version of the payments terms an owner agrees to, recorded with the agreement. A placeholder until counsel writes
 *  the terms; the real version replaces it, and an owner who agreed to the placeholder is asked again then. */
export const PAYMENTS_TERMS_VERSION = 'placeholder-counsel-pending';

/** Needs attention (§19, plus the "not recorded" item derived for the landing that could not complete). */
export const ONLINE_NOTICE_WORDS = {
  stripeNeedsTitle: 'Stripe needs something to keep online payments on',
  stripeNeedsBodyPaused:
    'Online payments are paused. Stripe needs something more from you. Teams see your “How to pay” text until it’s done. Nothing already paid is affected.',
  // Copy 12a §20 (held for 12b): League and Club name families and teams.
  stripeNeedsBodyPausedFamilies:
    'Online payments are paused. Stripe needs something more from you. Families and teams see your “How to pay” text until it’s done. Nothing already paid is affected.',
  // Derived (not in the copy): Stripe asks ahead of a deadline while payments still work.
  stripeNeedsBodyStillOn: (byDeadline: string) =>
    `Stripe needs something more from you${byDeadline}. Online payments stay on until then. Nothing already paid is affected.`,
  byDeadline: (iso: string) => ` by ${formatStoredDate(iso, { withYear: false })}`,
  notRecordedTitle: 'An online payment isn’t in the team’s record',
  notRecordedBody: (description: string, amount: string, reason: string) =>
    `${description}: ${amount} was paid by card, but it couldn’t be added to the team’s record (${reason}). Refund it to the card from the team’s record or in Stripe.`,
  refundFailedTitle: 'A refund didn’t reach the card',
  // 12c words §1.6: a team can have a part refund and a later one, so the item names which.
  refundFailedBody: (amount: string, card: string, team: string) =>
    `${amount} to ${card} was returned, for example because the card was closed. Send ${team} the money another way, then record the refund.`,
  refundFailedTitleTeam: (team: string) => `${possessive(team)} refund didn’t reach the card`,
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
  ref: 'Refund reference',
  receipt: 'Your receipt',
  receiptValue: (receiptNo: string, paid: string) => `${receiptNo} (paid ${paid})`,
  // {bankDays}: Stripe's refund to a bank account takes about 3 business days (plan §0k).
  arrives: (bank: boolean) => (bank ? 'It takes about 3 business days to appear.' : 'It takes 5 to 10 business days to appear.'),
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
  unrecordedTitle: (child: string) => `A card payment for ${child} couldn’t be recorded`,
  unrecordedBody: (guardian: string | null, amount: string, date: string | null, child: string, why: string) =>
    `${guardian ?? 'The family'} paid ${amount} by card${date ? ` on ${date}` : ''} for ${child}, but it couldn’t go on the registration: ${why}. The money is in the club’s Stripe balance. Refund it to the card.`,
  // Derived: the whole landing threw (the season is gone, Stripe's amount differs) — no child's share is on a registration.
  unrecordedSignupTitle: 'A house-league card payment couldn’t be recorded',
  unrecordedSignupBody: (description: string, amount: string, reason: string) =>
    `${description}: ${amount} was paid by card, but it couldn’t go on the registrations (${reason}). The money is in the club’s Stripe balance. Refund it to the card.`,
  // 12b copy §7: a child's card refund Stripe returned (it was booked when Stripe accepted it).
  refundFailedTitle: (child: string) => `${possessive(child)} refund didn’t reach the card`,
  refundFailedBody: (amount: string, card: string) =>
    `${amount} to ${card} was returned, for example because the card was closed. Send the family the money another way, then record the refund.`,
  // 12c words §5 (a refund made in Stripe records itself; a person is asked only these). The 12b
  // `refundedInStripeBody` ("record the refund by hand") is retired: it had no door on an ended row (F4).
  whoseTitle: (amount: string, guardian: string | null) =>
    `${amount} was refunded in Stripe on ${guardian ? `${possessive(guardian)} payment` : 'the family’s payment'}`,
  whoseBody: (children: string, total: string, receiptNo: string) =>
    `It paid for ${children} (${total}, receipt ${receiptNo}), so we can’t tell whose fee it was. Choose the child, and it goes on that registration. Until then it isn’t in the season’s book.`,
  enrolledTitle: (child: string, childFirst: string) => `${possessive(child)} fee was refunded in Stripe, and ${childFirst} is still enrolled`,
  enrolledBody: (amount: string, card: string, day: string, childFirst: string, owing: string) =>
    `${amount} went back to ${card} on ${day}. It’s recorded, and ${childFirst} owes ${owing} again. Withdraw ${childFirst}, email the family the pay link, or keep ${childFirst} enrolled. The family is emailed once you choose.`,
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
    `${amount} refunded to ${card} on ${date}. It takes 5 to 10 business days to appear.`,
  refundFeeIncluded: (fee: string) => `This includes the ${fee} processing fee.`,
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
  notSetUpBody: (rate: string) =>
    `Payments go straight to your bank account through Stripe. Each card payment has a processing fee of ${rate}, and you choose who pays it. Stripe will ask for your legal name, a signing officer and your bank account.`,
  settingUpBody: (date: string) => `You started on ${date}. Teams keep seeing your “How to pay” text until setup is finished.`,
  takingBody: (clubName: string) => `Payouts go to your bank account on Stripe’s schedule. Receipts go out in the name “${clubName}”.`,
  // Paused: Stripe has switched card payments off, so the pay page shows "How to pay" (`takesPayments` is false).
  needsBody: 'Stripe needs something more from you. Until then teams see your “How to pay” text instead of Pay now. Nothing already paid is affected.',
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
  ratesLine: (rate: string) => `Processing fee: ${rate} per card payment.`,
  rareDisconnect: 'Disconnect payouts',
  ownerOnly: (home: PayoutsHome) => `The owner sets this up in ${home === 'club' ? 'Settings › Payouts' : 'Settings & access › Payouts'}.`,
  before: {
    title: 'Before you set up payouts',
    costLabel: 'What it costs',
    costRate: (rate: string) => `${rate} per card payment`,
    costExample: (base: string, fee: string) => `On a ${base} fee, the card fee is ${fee}.`,
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
    termsCheckbox: (clubName: string) => `I agree to the FieldLogicHQ payments terms for ${clubName}.`,
    termsLink: 'Read the terms',
    cancel: 'Cancel',
    continue: 'Continue to Stripe',
  },
  record: {
    feeLabel: 'Processing fee',
    feeRead: { family: 'Teams pay it: it’s added to what they pay', club: 'The club pays it: it comes out of each payment' },
    feeRates: (rate: string) => `${rate} per card payment`,
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
    policyEmpty: 'None written. Teams won’t see a Refund policy link.',
    edit: 'Edit payouts',
    done: 'Done',
  },
  disconnect: {
    title: 'Disconnect payouts?',
    stops: 'Teams stop seeing Pay now right away, and pay links already emailed show your “How to pay” text instead.',
    owing: (n: number) =>
      n === 0 ? 'No team owes anything right now.' : n === 1 ? '1 team still owes money; it can pay you another way.' : `${n} teams still owe money; they can pay you another way.`,
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
  disconnectedBody: (date: string, name: string | null) =>
    `Disconnected ${date}${name ? ` by ${name}` : ''}. Payments already made stay in your books; refunds of them are made in Stripe. Families and teams see your “How to pay” text.`,
  before: {
    ...PAYOUTS_WORDS.before,
    whoTeams: 'Families and teams pay it',
    whoTeamsHint: 'Added to what the family or team pays.',
    whoClubHint: 'Families and teams pay the fee alone; the processing fee comes out of each payment.',
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
    policyEmpty: 'None written. Families and teams won’t see a Refund policy link.',
  },
  disconnect: { ...PAYOUTS_WORDS.disconnect, stops: 'Families and teams stop seeing Pay now right away, and pay links already emailed show your “How to pay” text instead.' },
  status: { ...PAYOUTS_WORDS.status, offBody: (date: string) => `The owner disconnected payouts on ${date}. Families and teams see the club’s payment instructions.` },
  quiet: { ...PAYOUTS_WORDS.quiet, line: 'Families and teams pay you directly, outside FieldLogicHQ.' },
};

/** The Payouts words for where the card lives: 'club' (League and Club) names families and teams; 'tournament'
 *  (Tournament Plus) names teams. */
export function payoutsWords(home: PayoutsHome): typeof PAYOUTS_WORDS_FAMILIES {
  return home === 'club' ? PAYOUTS_WORDS_FAMILIES : PAYOUTS_WORDS;
}

/** The team's pay page and the pay block (copy §8, §9, §13 and §18). */
export const PAY_WORDS = {
  who: (team: string, division: string | null) => (division ? `${team} · ${division}` : team),
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
  confirmingBody: 'Stripe has your payment; we’re waiting for it to confirm. This usually takes a few seconds and the page updates by itself. Don’t pay again.',
  confirmingSlow: (email: string | null) =>
    email
      ? `This is taking longer than usual. You don’t need to pay again: we’ll email your receipt to ${email} as soon as it confirms.`
      : 'This is taking longer than usual. You don’t need to pay again: your receipt shows here as soon as it confirms.',
  notFinishedTitle: 'Payment not finished',
  notFinishedBody: 'You left Stripe’s page before paying. Nothing was charged.',
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
  notTakingHeader: 'Payment handled by organizer',
  notTakingTotal: 'Total fee',
  notTakingDeposit: 'Deposit',
  notTakingDue: (date: string) => `Due ${date}`,
  notTakingNoSchedule: 'The organizer has not published a fee schedule for this division yet.',
  notTakingHowLabel: 'How to pay',
  notTakingFoot: 'Payments are made directly to the organizer, outside the platform.',
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

/** The team's record: an online row, its ⋯, the view and the refund windows (copy §15–§16). */
export const TEAM_ROW_WORDS = {
  method: (receiptNo: string) => `Online, card · receipt ${receiptNo}`,
  refunded: (date: string) => `Refunded to card, ${date}`,
  refundPending: 'Refunding to card…',
  refundFailed: 'Refund didn’t reach the card',
  // 12c words §1.2: a part refund never strikes the row through; the reason is in View the payment.
  refundedPart: (amount: string, day: string) => `${amount} refunded to card, ${day}`,
  refundedPartMore: (amount: string, day: string) => `${amount} refunded to card · last ${day}`,
  refundPendingPart: (amount: string) => `Refunding ${amount} to card…`,
  refundedPartStripe: (amount: string, day: string) => `${amount} refunded to card, ${day} · made in Stripe`,
  refundFailedSub: (amount: string, day: string) => `${amount} sent back ${day}`,
  test: 'Test, no money moved',
  menuLabel: 'More for this payment',
  dueMenuLabel: 'More for what is due',
  menuView: 'View the payment',
  menuRefund: 'Refund to the card',
  // F6 (12c): one name for one act, in both flows.
  menuAnotherWay: 'Record the refund sent another way',
  menuEmailLink: 'Email the pay link',
  linkSent: (date: string) => `Pay link sent ${date}`,
  linkSentToast: (email: string) => `Pay link sent to ${email}.`,
  linkFailedToast: 'Couldn’t send the pay link. Try again.',
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
  choiceAll: (card: string) => `All of it to the card, ${card}`,
  choiceAllBank: (last4: string) => `All of it to the bank account ending ${last4}`,
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
  foot: 'The team’s contact is emailed.',
  footNoEmail: 'No email address on file. Tell the team yourself.',
  partDoneToast: (amount: string, rest: string, email: string | null) =>
    (email ? `Refunded ${amount} to the card. ${rest} stays paid. We emailed ${email}.` : `Refunded ${amount} to the card. ${rest} stays paid.`),
  target: (card: string) => `Refund to the card, ${card}`,
  arrives: 'Arrives in 5 to 10 business days',
  // {bankDays}: Stripe's refund to a bank account takes about 3 business days (plan §0k).
  arrivesBank: 'Arrives in about 3 business days',
  anotherWayLead: 'The refund to the card came back. Record the money you sent the team another way, so the team’s record and the books match.',
  whoLabel: 'Who is ending this?',
  whoOrganizer: 'The organizer is ending it',
  whoTeam: 'The team asked to leave',
  feeCheckbox: (fee: string, total: string) => `Include the ${fee} processing fee · ${total} back`,
  // Derived from §16 after the 2026-10-25 ruling (plan §0c): FieldLogicHQ keeps its fee on every refund, so a fee the club
  // gives back is the club's whole cost — never "Stripe keeps part of it".
  feeOnWhy: (fee: string) => `On because the organizer is ending it. The ${fee} comes from the club and shows in your books as Payment processing.`,
  feeOffWhy: (base: string) => `${base} back. Off because the team asked to leave; you can include it.`,
  feeOnChanged: (fee: string) => `The ${fee} comes from the club and shows in your books as Payment processing.`,
  noteLabel: 'Note to the team',
  noteHint: 'Goes in the refund email.',
  button: 'Refund and email',
  buttonAnotherWay: 'Record the refund',
  cancel: 'Cancel',
  working: 'Refunding…',
  doneToast: (amount: string, email: string | null) => (email ? `Refunded ${amount} to the card. We emailed ${email}.` : `Refunded ${amount} to the card.`),
  pendingToast: 'The refund is on its way to the card.',
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
  returnedBody: (total: string, last4: string | null, day: string, reasonFull: string, held: string, emailed: boolean) =>
    `${total}${last4 ? ` from the account ending ${last4}` : ''} didn’t go through (${day}${reasonFull}). Nothing was taken, and ${held} still held. ${emailed ? 'We emailed the family a way to pay.' : 'There’s no email address on file, so tell the family yourself.'}`,
  returnedBodyTeam: (total: string, last4: string | null, day: string, reasonFull: string, teamPossessive: string, emailed: boolean) =>
    `${total}${last4 ? ` from the account ending ${last4}` : ''} didn’t go through (${day}${reasonFull}). Nothing was taken. ${teamPossessive} place is still held. ${emailed ? 'We emailed the team’s contact a way to pay.' : 'There’s no email address on file, so tell the team yourself.'}`,
  heldOne: (childPossessive: string) => `${childPossessive} spot is`,
  heldMany: 'their spots are',
  reversedTitleOne: (childPossessive: string) => `${childPossessive} bank payment was returned after it cleared`,
  reversedTitleMany: (children: string) => `A bank payment for ${children} was returned after it cleared`,
  reversedTitleTeam: (teamPossessive: string) => `${teamPossessive} bank payment was returned after it cleared`,
  reversedBody: (receiptNo: string, total: string, day: string, book: 'season' | 'tournament', owesAgain: string, emailed: boolean) =>
    `The bank reversed receipt ${receiptNo} (${total}) on ${day}. It’s out of the ${book}’s book, and ${owesAgain}. ${emailed ? 'We emailed the family a way to pay.' : 'There’s no email address on file, so tell the family yourself.'}`,
  owesAgain: (who: string, amount: string, many: boolean) => `${who} ${many ? 'owe' : 'owes'} ${amount} again`,
  /** The family's own sentence (§2.2 reversedBody's `{owesAgain}`). */
  owingAgain: (amount: string) => `${amount} is owing again`,
} as const;

/** The line on the club's FieldLogicHQ invoice for Stripe's returned-debit fee (§0k answer 2; words via /marketing). */
export const RETURNED_DEBIT_FEE_WORDS = {
  invoiceLine: (day: string) => `Returned bank debit · ${day}`,
} as const;

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
