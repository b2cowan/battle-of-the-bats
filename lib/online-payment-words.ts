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
  partialInStripeBody: (description: string, amount: string) =>
    `${description}: ${amount} was refunded in Stripe, which is only part of the payment. Record the change by hand.`,
  refundFailedTitle: 'A refund didn’t reach the card',
  refundFailedBody: (description: string) =>
    `${description}: the refund to the card was returned, for example because the card was closed. Send the team the money another way, then record the refund.`,
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
  // Derived, until 12b's refunds land (Part 5): a refund started in Stripe's dashboard on a house-league payment.
  refundedInStripeBody: (description: string, amount: string) =>
    `${description}: ${amount} was refunded in Stripe. Record the refund by hand on Registrations so the season’s book matches.`,
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
  noDepositHeading: (total: string) => `Pay the entry fee, ${total}`,
  balanceHeading: (balance: string) => `Pay the balance, ${balance}`,
  balanceDue: (date: string) => `Due ${date}.`,
  paidSoFar: (team: string, amount: string) => `${team} has paid ${amount} so far.`,
  emailLabel: 'Email for the receipt',
  button: (total: string) => `Pay ${total} by card`,
  buttonFeeNote: (fee: string) => `includes a ${fee} processing fee`,
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
  test: 'Test, no money moved',
  menuLabel: 'More for this payment',
  dueMenuLabel: 'More for what is due',
  menuView: 'View the payment',
  menuRefund: 'Refund to the card',
  menuAnotherWay: 'Record a refund made another way',
  menuEmailLink: 'Email the pay link',
  linkSent: (date: string) => `Pay link sent ${date}`,
  linkSentToast: (email: string) => `Pay link sent to ${email}.`,
  linkFailedToast: 'Couldn’t send the pay link. Try again.',
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
} as const;

export const REFUND_WORDS = {
  title: (team: string) => `Refund ${possessive(team)} payment?`,
  titleAnotherWay: 'Record a refund made another way',
  paidTeams: (team: string, total: string, date: string, base: string, fee: string) =>
    `${team} paid ${total} online on ${date}: the ${base} entry fee and a ${fee} processing fee.`,
  paidClub: (team: string, base: string, date: string) => `${team} paid ${base} online on ${date}.`,
  target: (card: string) => `Refund to the card, ${card}`,
  arrives: 'Arrives in 5 to 10 business days',
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
} as const;
