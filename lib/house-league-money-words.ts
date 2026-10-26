/**
 * The words of house-league money (Club Tier Stage 9b-2), from docs/projects/active/HOUSE_LEAGUE_STAGE9B2_COPY.md. Keys
 * follow that file's (`regs.*`, `end.*`, `price.*`, `err.*`…) so a word can be traced back to its ruling. One home: a
 * screen, a route and an email read the same string. Methods are worded by `DUES_PAYMENT_METHOD_LABEL`, never typed here.
 */
import { DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from './types';
import { joinWithAnd, pluralize, possessive } from './utils';

/** A stored method as staff read it: the label, or "Not recorded". */
export function paymentMethodWord(m: string | null | undefined): string {
  if (!m) return 'Not recorded';
  if (m === 'online_card') return 'Online, card';
  // 12c words §3.5: a pre-authorized bank debit, the twin of "Online, card".
  if (m === 'online_bank') return 'Online, bank debit';
  return DUES_PAYMENT_METHOD_LABEL[m as DuesPaymentMethod] ?? m;
}

/** " (E-Transfer)" after a date in a sentence; nothing for Other or Not recorded (copy §0). */
export function methodInBrackets(m: string | null | undefined): string {
  if (!m || m === 'other') return '';
  return ` (${paymentMethodWord(m)})`;
}

/** The owing threshold on the season's Registration block (copy §9, 9b·8). */
export const OWING_WORDS = {
  label: 'Owing turns amber',
  value: (n: number) => `After ${pluralize(n, 'day')}.`,
  sub: 'Counted from the day the child was accepted.',
  editLabel: 'Turn owing amber after',
  suffix: 'days',
  hint: 'An accepted player who hasn’t paid turns amber on Registrations after this many days. Counted from the day they were accepted.',
  err: 'Enter a whole number of days, from 1 to 365.',
} as const;

/** The family's "Ask to withdraw a child" on the status page, and the desk's notice (copy §14). */
export const ASK_WORDS = {
  door: (one: string | null) => (one ? `Ask to withdraw ${one}` : 'Ask to withdraw a child'),
  pick: 'Which child?',
  noteLabel: 'Note for the club',
  noteHint: 'For example, why. The club may use it to arrange a refund.',
  foot: (child: string | null) => `The club reads this and replies by email. ${child ?? 'Your child'} keeps their place until then.`,
  cancel: 'Cancel',
  submit: 'Send request',
  working: 'Sending…',
  sent: (email: string, child: string) => `Request sent. The club will email ${email} when ${child} is withdrawn.`,
  childLine: (child: string, day: string) => `You asked to withdraw ${child} on ${day}. The club will confirm by email.`,
  errEnded: (child: string, status: string) => (status === 'declined' ? 'This registration has already ended.' : `${child} is already withdrawn.`),
  errTwice: (child: string) => `You already asked to withdraw ${child}. The club will reply by email.`,
  errGeneric: 'Something went wrong. Please try again.',
  errFinished: 'This season has finished, so there is nothing to withdraw from. Contact the club if you have a question.',
  noticeTitle: (player: string) => `Withdrawal request: ${player}`,
  noticeBody: (guardian: string, season: string, note: string | null) =>
    [guardian, season, note ? (note.length > 120 ? `${note.slice(0, 119)}…` : note) : 'No note'].filter(Boolean).join(' · '),
} as const;

/** A house-league child's line on the family's record in Families (copy §13). */
export const FAMILY_LINE_WORDS = {
  fixed: (day: string) => `Price fixed at sign-up, ${day}`,
  corrected: (reason: string) => (reason ? `Price corrected · ${reason}` : 'Price corrected'),
  ghost: 'Pay link',
  ghostTip: 'Online payment isn’t available yet. Record the payment by hand.',
} as const;

/** The season's Money page (copy §10). */
export const MONEY_PAGE_WORDS = {
  eyebrow: (season: string) => `House league · ${season}`,
  title: 'Money',
  loading: 'Loading the season’s money…',
  failed: 'We couldn’t load the season’s money.',
  noAccess: 'You don’t have access to this page.',
  band: {
    owed: 'Owed', received: 'Received', owing: 'Still owing',
    players: (n: number) => pluralize(n, 'player'),
    afterRefunds: (amount: string) => `after ${amount} refunded`,
    // 12b copy §8 `money.band.online`.
    byCard: (amount: string) => `${amount} of it by card`,
    aria: (owed: string, received: string, owing: string) => `Owed ${owed}. Received ${received}. Still owing ${owing}.`,
  },
  finished: 'This season is finished. You can still mark fees received and record refunds.',
  tabs: { all: 'Every line', owing: 'Still owing', refunds: 'Refunds' },
  col: { date: 'Date', player: 'Player', what: 'What', how: 'How', amount: 'Amount', division: 'Division', since: 'Owing since', owing: 'Owing' },
  what: {
    fee: (kind: 'regular' | 'corrected' | null) => `Registration fee · ${kind === 'corrected' ? 'corrected price' : 'regular price'}`,
    refund: (why: string | null) => `Refund · ${why === 'released' ? 'spot released' : why === 'corrected' ? 'price corrected' : why ?? 'refund'}`,
    corrected: (from: string, to: string, reason: string) => `Price corrected ${from} → ${to} · ${reason}`,
    kept: (reason: string) => `Kept by the club · ${reason}`,
    voided: 'Voided · marked received by mistake',
    // 12b copy §8 `money.line.processing`: a club-paid processing fee, or a fee the club gave back on a refund — a cost.
    processing: (what: string) => `Payment processing · ${what}`,
    processingBack: (what: string) => `Payment processing · fee given back · ${what}`,
  },
  since: (day: string, days: number | null) => (days == null ? `Accepted ${day}` : `Accepted ${day} · ${pluralize(days, 'day')}`),
  sinceUnknown: 'Not known',
  empty: {
    all: { title: 'No money recorded yet', body: 'A fee shows here when you mark a registration received.' },
    owing: { title: 'Nobody owes anything', body: 'Every accepted player has paid.' },
    refunds: { title: 'No refunds', body: 'A refund shows here when you end a registration that had paid.' },
    free: { title: 'This season is free', body: 'There is nothing to collect.' },
  },
  hintClub: 'Fees file on the club’s Budget vs. Actual under House league registration fees, in the fiscal year each one is received.',
  hintLeague: 'This page is the season’s book.',
  registrations: 'Fees are marked received, refunded and corrected on Registrations.',
} as const;

/** The season Overview's two money tiles (copy §11). */
export const TILE_WORDS = {
  owed: 'Owed',
  owing: 'Still owing',
  aria: (label: string, amount: string, players: number) =>
    `${label} ${amount}, ${pluralize(players, 'player')}. Open Money.`,
} as const;

/** The refusals of the one money writer and the ending (copy §16). */
export const MONEY_REFUSAL = {
  ended: (name: string) => `${possessive(name)} registration has already ended.`,
  notAccepted: (name: string) => `${name} hasn’t been accepted yet, so there is no fee to receive.`,
  alreadyReceived: (name: string) => `${possessive(name)} fee is already received.`,
  free: (name: string) => `${possessive(name)} season is free, so there is no fee to receive.`,
  changed: 'The money on this registration changed since the window opened. Close it and open it again.',
  amount: 'Enter $0 or more.',
  priceSame: 'That is already the price. Enter a different amount.',
  priceReason: 'Say why the price is changing.',
  keptReason: (amount: string) => `Say why the club is keeping the ${amount}.`,
  money: (amount: string) => `Choose what happens to the ${amount}.`,
  nothingToUndo: (name: string) => `${name} has no received fee to undo.`,
  refundedUndo: 'This payment has a refund beside it, so it can’t be undone. The refund already records the money going back.',
  /** 12b copy §5 `regs.undoCard`: a card payment really arrived (mig 374). */
  card: 'A card payment comes off only by a refund. Use Withdraw or Correct the price.',
  futurePayment: 'A payment can’t be received after today.',
  futureRefund: 'A refund can’t be dated after today.',
  beforePayment: 'A refund can’t be dated before the payment it returns.',
  method: 'Choose how it was paid from the list.',
  date: 'Enter a date.',
  failed: 'That didn’t go through. Please try again.',
} as const;

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   THE REGISTRATIONS SCREEN (Club Tier Stage 9b-2, Part 3) — copy §1–§9 and §16 of the same file. A function takes the
   pieces already worded by the caller (an amount through `formatLeagueMoney`, a day through `regDay`, a method through
   `methodInBrackets`), so no screen assembles a sentence and no possessive is hand-built.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

const nFamilies = (n: number) => pluralize(n, 'family', 'families');

/** Which ending a window is: the club says no, the child leaves, or an unpaid spot goes back. */
export type EndMode = 'declined' | 'withdrawn' | 'released';

/** Registrations: the head, tabs, toolbar, columns, the Fee cell and the row's menu (copy §1). */
export const REGS_WORDS = {
  eyebrow: (season: string) => `House league · ${season}`,
  title: 'Registrations',
  add: 'Add registration',
  loading: 'Loading registrations…',
  failed: 'We couldn’t load the registrations.',
  noAccess: 'You don’t have access to this page.',
  tabsLabel: 'Registrations',
  tab: { review: 'To review', active: 'Active', waitlist: 'Waitlist', ended: 'Ended' },
  reviewAria: (n: number) => `${pluralize(n, 'registration')} to review`,
  scopeAll: 'All divisions',
  scopeToReview: (n: number) => `${pluralize(n, 'registration')} to review`,
  scopeElsewhere: 'Registrations to review in another division',
  search: 'Search players or parents',
  filter: 'Filter',
  filterOn: (n: number) => `${n} on`,
  filterFee: 'Fee',
  filterOwing: 'Owing',
  filterReceived: 'Received',
  filterRefunded: 'Refunded',
  filterClear: 'Clear filter',
  tools: 'Tools',
  toolsEmail: 'Email families',
  col: { player: 'Player', division: 'Division', guardian: 'Guardian', fee: 'Fee', actions: 'Actions', select: 'Select' },
  selectRow: (name: string) => `Select ${name}`,
  selectAll: 'Select all',
  moreFor: (name: string) => `More for ${name}`,
  waitingPosition: (n: number) => `#${n}`,
  player: {
    signedUp: (day: string) => `Signed up ${day}`,
    byHand: (day: string) => `Added by hand ${day}`,
    declined: (day: string) => `Declined ${day}`,
    withdrawn: (day: string) => `Withdrawn ${day}`,
    released: (day: string) => `Spot released ${day}`,
    /** The family asked from the status page to withdraw this child (mig 370): a quiet second line on the row. */
    asked: (day: string) => `Asked to withdraw ${day}`,
  },
  notPlaced: 'Not placed',
  noDivision: 'No division yet',
  noEmail: 'No email address',
  fee: {
    free: 'Free',
    nothingOwed: 'Nothing owed yet',
    onceAccepted: (amount: string) => `${amount} once accepted`,
    owing: (amount: string) => `${amount} owing`,
    owingDays: (amount: string, days: number) => `${amount} owing · ${pluralize(days, 'day')}`,
    acceptedToday: 'Accepted today',
    accepted: (day: string) => `Accepted ${day}`,
    received: (amount: string) => `${amount} received`,
    part: (got: string, owing: string) => `${got} received · ${owing} owing`,
    lastReceived: (day: string, how: string | null) => `Last received ${day}${how ? ` · ${how}` : ''}`,
    // 12b copy §5: a card payment's receipt after its method, and the trace of a pay link on an owing row.
    receipt: (n: number) => `receipt ${n}`,
    linkSent: (day: string) => `Pay link sent ${day}`,
    on: (day: string, how: string | null) => `${day}${how ? ` · ${how}` : ''}`,
    refunded: (amount: string) => `${amount} refunded`,
    kept: (amount: string) => `${amount} kept by the club`,
    corrected: (reason: string) => `Price corrected · ${reason}`,
    correctedTip: (was: string, now: string, day: string, reason: string) => `Was ${was}, now ${now}. Corrected on ${day}. ${reason}`,
    aria: (name: string, primary: string, sub: string | null) => `${name}: ${primary}.${sub ? ` ${sub}` : ''}`,
    foot: 'The fee shown is the price fixed on each registration when the family signed up.',
  },
  act: { approve: 'Approve', markReceived: 'Mark received', promote: 'Promote' },
  menu: {
    markReceived: { label: 'Mark received', hint: (amount: string) => `Records ${amount} received, with the date and how` },
    move: { label: 'Move to another division', hint: 'Checks the room, then asks about the price' },
    correct: { label: 'Correct the price', hint: 'Needs a reason' },
    release: { label: 'Release the spot', hint: 'Frees the spot for the waitlist. Asks first, then emails the family' },
    withdraw: { label: 'Withdraw', hint: 'Asks what happened to any money' },
    decline: { label: 'Decline', hint: 'Asks what happened to any money, then emails the family' },
    email: { label: 'Email this family', hint: 'Opens a message to the guardian' },
    undo: { label: 'Undo: marked received by mistake', hint: 'For a fee marked received that never arrived. Not a refund' },
    waitlist: { label: 'Waitlist', hint: (name: string) => `Moves ${name} to the waitlist and emails the family` },
    promote: { label: 'Promote', hint: (name: string, division: string) => `Accepts ${name} into ${division} and emails the family` },
    // 12b copy §5: owing rows only, while the club takes card payments.
    payLink: { label: 'Email the pay link', hint: 'Opens their status page to pay by card', hintSent: (day: string) => `Last sent ${day}` },
    // 12b copy §7: a card payment that couldn't go on this registration (the Needs-attention item's door).
    refundCard: { label: 'Refund the card payment', hint: (amount: string) => `${amount} paid by card couldn’t go on this registration` },
    // 12b copy §7: a card refund that came back, sent to the family another way.
    refundAnotherWay: { label: 'Record the refund sent another way', hint: (amount: string) => `${amount} came back from the card` },
  },
  refundAnotherWay: {
    title: (name: string) => `Record the refund for ${name} as sent another way?`,
    body: (amount: string) => `The card refund of ${amount} came back. Record that the club sent it to the family another way. The season’s book already shows it as refunded.`,
    submit: 'Record it',
    working: 'Recording…',
    done: (amount: string) => `Recorded the ${amount} refund as sent another way.`,
  },
  // 12b: the refund of a card payment that couldn't be recorded.
  refundCard: {
    title: (name: string) => `Refund the card payment for ${name}?`,
    body: (amount: string) => `${amount} was paid by card but couldn’t go on this registration. It goes back to the card; nothing changes in the season’s book.`,
    fee: 'The processing fee goes back too, because the club declined this registration.',
    submit: (amount: string) => `Refund ${amount} to the card`,
    working: 'Refunding…',
    done: (amount: string) => `Refunded ${amount} to the card.`,
  },
  // 12b copy §5: the pay link's toasts and the bulk bar.
  payLink: {
    sent: (email: string) => `Pay link sent to ${email}.`,
    failed: 'Couldn’t send the pay link. Try again.',
    nothingOwed: 'There’s nothing owing to send a pay link for.',
    bulk: 'Email the pay link',
    bulkDone: (n: number) => `${pluralize(n, 'pay link')} sent.`,
    bulkPartial: (n: number, m: number, why: string) => `${pluralize(n, 'pay link')} sent; ${m} skipped: ${why}.`,
  },
  sheetSub: (division: string, fee: string | null) => [division, fee].filter(Boolean).join(' · '),
  empty: {
    review: { title: 'Nothing to review', body: 'New sign-ups that need your answer show here.' },
    reviewAuto: { title: 'Nothing to review', body: 'This season accepts sign-ups on its own while a division has room.' },
    active: { title: 'No players yet', body: 'Accepted players show here.' },
    waitlist: { title: 'No one is waiting', body: 'A full division sends the next child here.' },
    ended: { title: 'Nothing has ended', body: 'Declined, withdrawn and released registrations show here, with what happened to any money.' },
    all: { title: 'No registrations yet', body: 'Families sign up on the season’s page. You can also add a registration by hand.' },
    search: 'No registrations match your search.',
    filter: 'No registrations match this filter.',
  },
  more: (n: number) => `… ${n} more`,
  record: { aria: (name: string) => `Open ${name}`, noun: 'registration' },
} as const;

/** The bulk bar, its confirms and its result lines (copy §2). */
export const BULK_WORDS = {
  count: (n: number) => `${n} selected`,
  approve: 'Approve',
  promote: 'Promote',
  waitlist: 'Waitlist',
  markReceived: 'Mark received',
  move: 'Move division',
  email: 'Email',
  // 12b copy §5: the bulk bar's pay link (one email per family).
  payLink: 'Email the pay link',
  clear: 'Clear',
  moreAria: 'More for the selected',
  barAria: 'Actions for the selected registrations',
  help: 'Decline and Withdraw are one at a time, because each asks what happened to that family’s money.',
  confirm: {
    approve: { title: (n: number) => `Approve ${n} registrations?`, body: 'Each family is emailed that their child is accepted, with the fee and how to pay.', go: (n: number) => `Approve ${n}` },
    promote: { title: (n: number) => `Promote ${n} children from the waitlist?`, body: 'Each family is emailed that a spot opened, with the fee and how to pay.', go: (n: number) => `Promote ${n}` },
    waitlist: { title: (n: number) => `Move ${n} children to the waitlist?`, body: 'Each family is emailed that their child is on the waitlist.', go: (n: number) => `Waitlist ${n}` },
    working: 'Working…',
    cancel: 'Cancel',
  },
  emailLine: (n: number, missing: number) => (missing > 0
    ? `${nFamilies(n)}. ${missing === 1 ? '1 has' : `${missing} have`} no email address and ${missing === 1 ? 'is' : 'are'} skipped.`
    : `${nFamilies(n)}.`),
  stayed: (m: number) => `The ${m} that stayed are still selected.`,
  dismiss: 'Dismiss',
  done: {
    approve: { clean: (n: number) => `${n} approved.`, partial: (n: number, m: number, why: string) => `${n} approved; ${m} stay in review: ${why}.` },
    promote: { clean: (n: number) => `${n} promoted from the waitlist.`, partial: (n: number, m: number, why: string) => `${n} promoted; ${m} stay on the waitlist: ${why}.` },
    waitlist: { clean: (n: number) => `${n} moved to the waitlist.`, partial: (n: number, m: number, why: string) => `${n} moved to the waitlist; ${m} stayed: ${why}.` },
    markReceived: { clean: (n: number) => `${n} marked received.`, partial: (n: number, m: number, why: string) => `${n} marked received; ${m} skipped: ${why}.` },
    move: {
      clean: (n: number, division: string) => `${n} moved to ${division}.`,
      partial: (n: number, division: string, m: number, why: string) => `${n} moved to ${division}; ${m} stayed: ${why}.`,
      kept: (k: number) => `${k} kept their price: paid. Correct one at a time.`,
    },
    email: {
      clean: (n: number) => `Emailed ${nFamilies(n)}.`,
      partial: (n: number, m: number) => `Emailed ${nFamilies(n)}; ${m === 1 ? '1 has' : `${m} have`} no email address.`,
    },
  },
  /** A batch refused whole by a closed fiscal year: nothing was recorded (copy §2.2, §16 `err.closed.batch`). */
  closedBatch: (rest: string) => `Nothing was recorded. ${rest}`,
  why: {
    full: (names: string[]) => `${joinWithAnd(names)} ${names.length === 1 ? 'is' : 'are'} full`,
    fullN: (n: number, names: string[]) => `${n} ${n === 1 ? 'is' : 'are'} full in ${names.join(', ')}`,
    received: 'already received',
    free: 'no fee to receive',
    notAccepted: 'still in review',
    noDivision: 'no division yet',
    ended: 'the registration has ended',
    sameDivision: (division: string) => `already in ${division}`,
    counted: (n: number, phrase: string) => `${n} ${phrase}`,
  },
} as const;

/** Mark received: one registration and a batch (copy §3). */
export const RECV_WORDS = {
  eyebrow: (season: string, division: string) => `${season} · ${division}`,
  title: (name: string) => `Mark ${possessive(name)} fee received`,
  amountLabel: 'Amount',
  hint: 'This is the whole amount still owing.',
  hintPart: (price: string, got: string, day: string) => `The price is ${price}; ${got} was received on ${day}.`,
  dateLabel: 'Date received',
  howLabel: 'How',
  howNone: 'Not recorded',
  foot: (amount: string) => `Records ${amount} received in the season’s book.`,
  cancel: 'Cancel',
  submit: 'Mark received',
  working: 'Recording…',
  done: (name: string) => `Marked ${possessive(name)} fee received.`,
  bulk: {
    title: (n: number) => `Mark ${n} fees received`,
    totalLabel: 'Total',
    total: (amount: string, n: number) => `${amount} across ${pluralize(n, 'player')}`,
    hint: 'Each player’s whole balance is recorded. One date and one way for all of them.',
    foot: (n: number, amount: string) => `Records ${pluralize(n, 'payment')}, ${amount} in all, in the season’s book.`,
    submit: (n: number) => `Mark ${n} received`,
  },
} as const;

/** Ending a registration: Decline, Withdraw, Release the spot (copy §4 and the owner's §18 rulings). */
export const END_WORDS = {
  title: (mode: EndMode, name: string) => (mode === 'declined' ? `Decline ${name}?` : mode === 'withdrawn' ? `Withdraw ${name}?` : `Release ${possessive(name)} spot?`),
  bodyPlain: (mode: EndMode, name: string, division: string) => (mode === 'declined'
    ? `${name} is not accepted. The family is emailed.`
    : mode === 'withdrawn'
      ? `${name} comes off the roster. The family is not emailed.`
      : `${possessive(name)} family hasn’t paid, so the spot goes back to ${division}. The family is emailed.`),
  bodyMoney: (name: string, amount: string, day: string, how: string) => `${possessive(name)} family paid ${amount} on ${day}${how}. What happens to it?`,
  bodyMoneyMany: (name: string, amount: string, day: string, how: string) => `${possessive(name)} family paid ${amount} in all; the last payment was on ${day}${how}. What happens to it?`,
  submit: { declined: 'Decline and email', withdrawn: 'Withdraw', released: 'Release and email' },
  working: { declined: 'Declining…', withdrawn: 'Withdrawing…', released: 'Releasing…' },
  cancel: 'Cancel',
  refunded: 'Refunded',
  refundedSub: (amount: string) => `Records ${amount} going back to the family`,
  refundedDate: 'Date refunded',
  refundedHow: 'How',
  howNone: 'Not recorded',
  kept: 'Kept by the club',
  keptSub: 'A reason is required, for example “withdrew after the refund date”.',
  keptReason: 'Reason',
  keptReasonHint: 'The family reads this in their email.',
  noteLabel: 'Note to the family',
  hintPlain: {
    declined: 'The family is emailed that the registration wasn’t accepted. Your note goes in the email.',
    withdrawn: 'The family is not emailed. Use Email this family to tell them.',
    released: 'The family is emailed that the spot was released. Your note goes in the email.',
  },
  hintRefunded: (mode: EndMode, name: string, amount: string, day: string, how: string) => (mode === 'declined'
    ? `The family is emailed that the registration wasn’t accepted and that ${amount} was refunded on ${day}${how}. The refund shows on the season’s Money page.`
    : mode === 'withdrawn'
      ? `The family is emailed that ${name} was withdrawn and that ${amount} was refunded on ${day}${how}.`
      : `The family is emailed that the spot was released and that ${amount} was refunded on ${day}${how}. The refund shows on the season’s Money page.`),
  hintKept: (mode: EndMode, name: string, amount: string) => (mode === 'declined'
    ? `The family is emailed that the registration wasn’t accepted and that the club is keeping the ${amount}, with your reason.`
    : mode === 'withdrawn'
      ? `The family is emailed that ${name} was withdrawn and that the club is keeping the ${amount}, with your reason.`
      : `The family is emailed that the spot was released and that the club is keeping the ${amount}, with your reason.`),
  /** The lead line of a Withdraw the family asked for (copy §4.1 `end.requested`); no note, the line ends after the date. */
  requested: (guardian: string, child: string, day: string, note: string | null) =>
    `${guardian} asked to withdraw ${child} on ${day}${note ? `: “${note}”` : '.'}`,
  waitlistNext: (first: string) => `${first} moves up from the waitlist and is emailed.`,
  waitlistManual: 'The spot stays open. You move the waitlist up yourself.',
  footRefunded: (amount: string) => `The ${amount} stays in the season’s book with the refund beside it.`,
  footKept: (amount: string) => `The ${amount} stays in the season’s book as the club’s.`,
  footChoose: (amount: string) => `Choose what happens to the ${amount}.`,
  // 12b copy §6.1: a card-paid child's ending refunds to the card — all of it, or part with a reason; A2's box only on all.
  cardFull: (card: string) => `Refund to the card, ${card}`,
  cardArrives: 'Arrives in 5 to 10 business days',
  cardPart: 'Refund part of it',
  cardPartSub: (left: string) => `An amount up to ${left}, with a reason`,
  cardPartAmount: 'Amount to refund',
  cardPartReason: 'Reason',
  cardPartReasonHint: 'The family reads this in their email.',
  cardPartRest: (rest: string) => `The club keeps ${rest}.`,
  feeBox: (fee: string, total: string) => `Include the ${fee} processing fee · ${total} back`,
  feeOnWhy: (fee: string) => `On because the club is ending it. The ${fee} comes from the club and shows in your books as Payment processing.`,
  feeOffWhy: (base: string) => `${base} back. Off because the family asked to leave; you can include it.`,
  feeOnChanged: (fee: string) => `The ${fee} comes from the club and shows in your books as Payment processing.`,
  submitCard: { declined: 'Decline, refund and email', withdrawn: 'Withdraw, refund and email', released: 'Release and email' } as Record<EndMode, string>,
  hintCard: (mode: EndMode, name: string, amount: string) =>
    `The family is emailed that ${name} was ${mode === 'declined' ? 'not accepted' : 'withdrawn'} and that ${amount} is on its way back to the card.`,
  doneCard: (amount: string) => `Refunded ${amount} to the card.`,
  cardPartAmountError: (left: string) => `Enter an amount above $0 and up to ${left}.`,
  cardPartReasonError: 'Say why only part is refunded.',
  done: {
    declined: (name: string) => `Declined ${name}. The family was emailed.`,
    withdrawn: (name: string) => `Withdrew ${name}.`,
    released: (name: string) => `Released ${possessive(name)} spot. The family was emailed.`,
    refunded: (amount: string) => `${amount} recorded as refunded.`,
    kept: (amount: string) => `The club is keeping the ${amount}.`,
    moved: (first: string) => `${first} moved up from the waitlist.`,
  },
} as const;

/** Correct a price (copy §5). */
export const PRICE_WORDS = {
  title: (name: string) => `Correct ${possessive(name)} price`,
  signedLabel: 'Signed up at',
  signed: (amount: string, kind: 'regular' | 'early' | 'corrected', day: string) =>
    `${amount} · ${kind === 'regular' ? 'regular price' : kind === 'early' ? 'early bird' : 'corrected price'}, ${day}`,
  newLabel: 'New price',
  reasonLabel: 'Reason',
  reasonPlaceholder: 'Coach’s child, club discount agreed by the board',
  cancel: 'Cancel',
  submit: 'Save price',
  working: 'Saving…',
  hintUnpaid: (name: string) => `${name} hasn’t paid. The new price is what the family owes.`,
  hintRaise: (name: string, paid: string, diff: string) => `${possessive(name)} family has paid ${paid}. The ${diff} difference shows as still owing.`,
  hintLower: (name: string, paid: string, diff: string) => `${possessive(name)} family has paid ${paid}. The ${diff} difference is recorded as a refund.`,
  // 12b copy §6.2 (drawn b6): a card-paid child — the difference goes back to the card, or a pay link asks for the rest.
  hintLowerCard: (name: string, paid: string, diff: string) => `${possessive(name)} family paid ${paid} by card. ${diff} goes back to them.`,
  lowerCardChoice: (diff: string) => `Refund ${diff} to the card`,
  lowerCardSub: 'Arrives in 5 to 10 business days',
  lowerOtherChoice: 'Refunded another way',
  hintRaiseCard: (name: string, diff: string) => `${possessive(name)} family will owe ${diff} more. We’ll email them a pay link for it.`,
  submitLowerCard: 'Save and refund',
  submitRaiseCard: 'Save and email',
  doneLowerCard: (name: string, price: string, diff: string) => `${possessive(name)} price is now ${price}. Refunded ${diff} to the card.`,
  doneRaiseCard: (name: string, price: string) => `${possessive(name)} price is now ${price}. We emailed the family a pay link.`,
  hintEven: (name: string, paid: string) => `${possessive(name)} family has paid ${paid}. Nothing more is owing.`,
  hintNoEmail: 'The family is not emailed. Use Email this family to tell them.',
  refundDate: 'Date refunded',
  refundHow: 'How',
  howNone: 'Not recorded',
  footDefault: 'Shown on the row and in the Money page’s history.',
  footLower: (diff: string) => `Records a ${diff} refund. Shown on the row and in the Money page’s history.`,
  done: (name: string, price: string) => `Saved ${possessive(name)} price: ${price}.`,
  doneLower: (name: string, price: string, diff: string) => `Saved ${possessive(name)} price: ${price}. ${diff} recorded as refunded.`,
} as const;

/** Move division: one registration and a batch (copy §6). */
export const MOVE_WORDS = {
  eyebrow: (season: string) => season,
  title: (name: string) => `Move ${name}`,
  toLabel: 'Move to',
  choose: 'Choose a division',
  optionSpot: (division: string, spots: string | null, price: string | null) => [division, spots, price].filter(Boolean).join(' · '),
  spotsLeft: (n: number) => `${pluralize(n, 'spot')} left`,
  optionFull: (division: string) => `${division} · full, joins the waitlist`,
  fullLine: (division: string, name: string, place: string) => `${division} is full. ${name} joins its waitlist, ${place} in line.`,
  priceLead: (division: string, price: string, name: string, was: string) => `${division} charges ${price}. ${name} signed up at ${was}.`,
  priceKeep: (name: string, was: string) => `Keep ${possessive(name)} price · ${was}`,
  priceUse: (division: string, price: string) => `Use ${possessive(division)} price · ${price}`,
  priceHint: (division: string, name: string) => `${possessive(division)} price is worked out for the day ${name} signed up, so an early bird still applies.`,
  paid: (name: string, price: string) => `${possessive(name)} family has paid, so the price stays ${price}. To change it, use Correct the price.`,
  foot: (name: string, from: string, to: string) => `${name} moves from ${from} to ${to}. The family is not emailed.`,
  footWaitlist: (name: string, from: string, to: string, place: string) => `${name} moves from ${from} to ${possessive(to)} waitlist, ${place} in line. The family is not emailed.`,
  footPromoted: (first: string, from: string) => `${first} moves up from the waitlist in ${from}.`,
  submit: 'Move',
  submitWaitlist: 'Move to the waitlist',
  working: 'Moving…',
  cancel: 'Cancel',
  done: (name: string, to: string) => `Moved ${name} to ${to}.`,
  sameDivision: (name: string, to: string) => `${name} is already in ${to}.`,
  bulk: {
    title: (n: number) => `Move ${n} children`,
    room: (division: string, room: number, stay: number) => `${division} has room for ${room}. The other ${stay} stay where they are.`,
    priceLead: (division: string, price: string) => `${division} charges ${price}. Some of these children signed up at a different price.`,
    keep: 'Keep each child’s price',
    use: (division: string) => `Use ${possessive(division)} price`,
    paid: (k: number, names: string) => `${k} ${k === 1 ? 'has' : 'have'} paid and ${k === 1 ? 'keeps' : 'keep'} their price: ${names}. To change one, use Correct the price.`,
    foot: (n: number, division: string, k: number) => `${n} move to ${division}. ${k > 0 ? `${k} paid and keep their price. ` : ''}The families are not emailed.`,
    submit: (n: number) => `Move ${n}`,
  },
} as const;

/** Approve or promote into a full division (copy §7). */
export const FULL_WORDS = {
  approve: (division: string) => `${division} is full. Add to the waitlist instead.`,
  promote: (division: string, name: string) => `${division} is full. ${name} stays on the waitlist until a spot frees.`,
  offer: (name: string) => `Waitlist ${name}`,
} as const;

/** Undo: marked received by mistake (copy §8). */
export const UNDO_WORDS = {
  title: (name: string) => `Undo ${possessive(name)} payment?`,
  body: (name: string, amount: string, day: string) => `This takes back the ${amount} marked received on ${day}. ${name} shows as owing again.`,
  not: 'It isn’t a refund. Use it only when the money never arrived. If it did and is going back, decline or withdraw instead.',
  foot: 'The line stays in the season’s history, marked as voided.',
  cancel: 'Cancel',
  submit: 'Undo payment',
  working: 'Undoing…',
  done: (name: string) => `Took back ${possessive(name)} payment.`,
} as const;

/** Email a family, the ticked families, or the season (the 9b-2 bulk bar; today's composer for the season). */
export const REGS_EMAIL_WORDS = {
  eyebrow: (season: string) => season,
  titleOne: 'Email this family',
  titleMany: (n: number) => `Email ${nFamilies(n)}`,
  titleSeason: 'Email families',
  subject: 'Subject',
  subjectPlaceholder: 'e.g. Season start reminder',
  message: 'Message',
  messagePlaceholder: 'Write your message here…',
  audience: 'Audience',
  audienceAll: 'All active registrants',
  audienceDivision: 'By division',
  audienceTeam: 'By team',
  audienceStatus: 'By status',
  division: 'Division',
  divisionPick: 'Select a division…',
  team: 'Team',
  teamPick: 'Select a team…',
  status: 'Status',
  statusOptions: { active: 'Active', waitlisted: 'Waitlisted', pending_review: 'To review', declined: 'Declined' },
  toOne: (email: string) => `Sends to ${email}.`,
  toSeason: (n: number) => (n > 0 ? `Sending to ${pluralize(n, 'guardian')}.` : 'No recipients match this selection.'),
  cancel: 'Cancel',
  send: 'Send',
  sendN: (n: number) => `Send to ${n}`,
  working: 'Sending…',
  needBoth: 'Write a subject and a message.',
  failed: 'That didn’t go through. Please try again.',
  sentSeason: (sent: number, skipped: number) => `Sent to ${pluralize(sent, 'guardian')}.${skipped ? ` ${skipped} skipped.` : ''}`,
} as const;

/** Add a registration by hand (today's form, on a window). */
export const ADD_REG_WORDS = {
  title: 'Add registration',
  eyebrow: (season: string) => season,
  player: 'Player',
  guardian: 'Guardian',
  assignment: 'Assignment',
  firstName: 'First name',
  lastName: 'Last name',
  dob: 'Date of birth',
  jersey: 'Jersey # pref',
  position: 'Position pref',
  notes: 'Player notes',
  email: 'Email',
  phone: 'Phone',
  division: 'Division',
  divisionPick: 'Select division…',
  status: 'Status',
  statusOptions: { active: 'Active', pending_review: 'To review', waitlisted: 'Waitlisted' },
  cancel: 'Cancel',
  submit: 'Add registration',
  working: 'Adding…',
  missing: 'Fill in the player’s and the guardian’s names, the guardian’s email and a division.',
  done: (name: string) => `Added ${name}.`,
} as const;

/** The registration's record window (reads first; the same actions as its row). */
export const REG_RECORD_WORDS = {
  eyebrow: (season: string, division: string | null) => (division ? `${season} · ${division}` : season),
  details: 'Details',
  fee: 'Fee',
  history: 'History',
  actions: 'What you can do',
  facts: {
    division: 'Division', team: 'Team', guardian: 'Guardian', email: 'Email', phone: 'Phone',
    born: 'Date of birth', signedUp: 'Signed up', addedByHand: 'Added by hand', accepted: 'Accepted',
    ended: 'Ended', reference: 'Sign-up reference', position: 'Waitlist place',
    price: 'Price', received: 'Received', owing: 'Still owing', refunded: 'Refunded', kept: 'Kept by the club',
    notes: 'Player notes', adminNotes: 'Notes',
  },
  timeline: {
    registered: 'Signed up',
    byHand: 'Added by hand',
    accepted: 'Accepted',
    received: (amount: string, how: string | null) => `Received ${amount}${how ? ` · ${how}` : ''}`,
    refund: (amount: string, how: string | null) => `Refunded ${amount}${how ? ` · ${how}` : ''}`,
    voided: (amount: string) => `${amount} · marked received by mistake, voided`,
    corrected: (from: string, to: string, reason: string) => `Price corrected ${from} → ${to}${reason ? ` · ${reason}` : ''}`,
    moved: (from: string, to: string) => `Price changed on a move ${from} → ${to}`,
    ended: { declined: 'Declined', withdrawn: 'Withdrawn', released: 'Spot released' },
    kept: (amount: string, reason: string) => `The club kept the ${amount}${reason ? ` · ${reason}` : ''}`,
  },
  stepsNoun: 'registration',
  position: (n: number, of: number) => `${n} of ${of}`,
  none: 'Nothing yet.',
  close: 'Close',
} as const;

const target = (bank: boolean) => (bank ? 'bank account' : 'card');
/** A sentence that ends on a clock ("2:15 p.m.") takes no second full stop. */
const stop = (t: string) => (t.endsWith('.') ? t : `${t}.`);

/**
 * A card refund you can see (Club Tier Stage 12c Part 2), from docs/projects/active/CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md
 * §1–3 (keys `regs.fee.*`, `rec.card.*`, `rec.hist.*`, `money.*`). `bank` swaps the card's words for a bank account's (the
 * rail table, CLUB_TIER_STAGE12C_PARTREFUND_BANKDEBIT_COPY.md §3.9). Every refund marked by hand keeps today's words.
 */
export const CARD_REFUND_WORDS = {
  cell: {
    toTarget: (amount: string, bank: boolean) => `${amount} to the ${target(bank)}`,
    pending: 'pending',
    madeInStripe: 'made in Stripe',
    sentAnotherWay: 'sent another way',
    failed: (bank: boolean) => `Refund didn’t reach the ${target(bank)}`,
    failedSub: (toTarget: string, day: string) => `${toTarget} · sent back ${day}`,
    failedAria: (bank: boolean) => `Refund didn’t reach the ${target(bank)}. Record the refund sent another way.`,
    keptAndRefunded: (kept: string, refunded: string) => `${kept} kept by the club · ${refunded} refunded`,
    neverBooked: {
      ended: 'Paid after the registration ended',
      already_received: 'Also paid by card · that payment was refunded',
      over: 'Paid more than was owing · the extra was refunded',
      not_accepted: 'Paid before the registration was accepted',
      other: 'Card payment not on this registration',
    } as Record<string, string>,
    neverBookedTip: (paidDay: string, paidTime: string, why: string, refundDay: string, refundTime: string, bank: boolean) =>
      `Paid by ${bank ? 'bank debit' : 'card'} on ${paidDay} at ${paidTime}, but it couldn’t go on this registration: ${why}. Refunded to the ${target(bank)} on ${refundDay} at ${stop(refundTime)}`,
    corrected: (amount: string, bank: boolean) => `Price corrected · ${amount} back to the ${target(bank)}`,
    correctedPending: (amount: string, bank: boolean) => `Price corrected · ${amount} back to the ${target(bank)} · pending`,
    correctedFailed: (amount: string, bank: boolean) => `Price corrected · ${amount} refund didn’t reach the ${target(bank)}`,
    correctedTip: (was: string, now: string, day: string, reason: string, amount: string, refundDay: string, bank: boolean) =>
      `Was ${was}, now ${now}. Corrected on ${day}. ${reason ? `${reason} ` : ''}${amount} went back to the ${target(bank)} on ${refundDay}.`,
  },
  record: {
    heading: (bank: boolean) => (bank ? 'To the bank account' : 'To the card'),
    headingAnother: 'Sent another way',
    pill: { refunded: 'Refunded', pending: 'Pending', failed: (bank: boolean) => `Refund didn’t reach the ${target(bank)}` },
    tagStripe: 'Made in Stripe',
    amount: 'Amount',
    amountValue: (amount: string, to: string) => `${amount} to ${to}`,
    amountSplit: (base: string, fee: string) => `${base} fee + ${fee} processing fee`,
    amountPart: (fee: string) => `Part of the ${fee} fee. A part refund never includes the processing fee.`,
    amountWhole: 'The whole payment, so the processing fee went back too.',
    fee: 'Processing fee',
    feeWhy: {
      declined: 'Given back, because the club declined',
      included: 'Given back, because the club chose to include it',
      whole: 'Given back with the whole payment',
      keptAsked: 'Not refunded, because the family asked to leave',
      keptPart: 'Not refunded. A part refund never includes it.',
    },
    feeBook: 'In the season’s book as Payment processing',
    by: 'Refunded by',
    byValue: (who: string, day: string, time: string) => `${who}, ${day} at ${time}`,
    byStripe: (day: string, time: string) => `Someone in the club’s Stripe dashboard, ${day} at ${time}`,
    byStripeSub: (time: string) => `Recorded here by itself at ${time}`,
    reached: (bank: boolean) => `Reached the ${target(bank)}`,
    reachedValue: (day: string, time: string) => `${day} at ${time}`,
    // A bank account's {bankDays} is Stripe's "about 3 business days" (plan §0k).
    reachedSub: (bank: boolean) => (bank
      ? 'It takes about 3 business days to appear on the family’s statement.'
      : 'It takes 5 to 10 business days to appear on the family’s statement.'),
    status: 'Status',
    statusValue: (day: string, time: string, bank: boolean) =>
      `Stripe accepted it ${day} at ${time} and is waiting on the ${bank ? 'bank' : 'card’s bank'}. It’s already in the season’s book. Nothing to do.`,
    what: 'What happened',
    whatValue: (sent: string, back: string, bank: boolean) => (bank
      ? `Sent ${sent}; the bank sent it back ${back}, for example because the account was closed. The club still owes it.`
      : `Sent ${sent}; the card’s bank sent it back ${back}, for example because the card was closed. The club still owes it.`),
    ref: 'Stripe reference',
    copy: 'Copy',
    copied: 'Copied',
    copyAria: 'Copy the Stripe reference',
    copyFailed: 'Selected. Press and hold to copy.',
    copyFailedDesk: 'Selected. Press Ctrl+C to copy.',
    paidWith: 'Paid with',
    paidWithValue: (receiptNo: number | null, day: string) => (receiptNo ? `Receipt ${receiptNo}, ${day}` : day),
    reason: 'Reason',
    kept: 'Kept by the club',
    before: 'Before it',
    beforeKept: (reason: string) => (reason ? `The club had kept the fee: “${reason}”` : 'The club had kept the fee.'),
    beforeFailed: (reference: string, day: string) => `The card refund (${reference}) was sent back ${day}`,
    anotherAmount: (amount: string, who: string, day: string) => `${amount}, recorded by ${who} on ${day}`,
    why: 'Why',
    whyEnded: (day: string, time: string, verb: 'declined' | 'withdrew', child: string, endTime: string) =>
      `Paid ${day} at ${time}, after the club ${verb} ${child} at ${stop(endTime)} It never went on this registration.`,
    whyReleased: (day: string, time: string, childPossessive: string, endTime: string) =>
      `Paid ${day} at ${time}, after the club released ${childPossessive} spot at ${stop(endTime)} It never went on this registration.`,
    whyOther: (day: string, time: string, why: string, bank: boolean) =>
      `Paid ${day} at ${time} by ${bank ? 'bank debit' : 'card'}, but it couldn’t go on this registration: ${why}.`,
    book: 'Season’s book',
    bookValue: (fee: string | null) => (fee ? `No fee line. The ${fee} given back is in it as Payment processing.` : 'No fee line.'),
    emailed: 'Family emailed',
    emailedSent: (email: string, day: string) => `${email}, ${day}`,
    emailedNone: 'No email address on file. Tell the family yourself.',
    emailedFailed: (day: string) => `Couldn’t be sent ${day}`,
    emailedNotFailed: 'Not emailed. Contact the family to arrange another way.',
    emailedAnotherWay: 'Not emailed by us. You told the family.',
    button: 'Record the refund sent another way',
  },
  history: {
    refund: (booked: string, amount: string, to: string) => `Refunded ${booked} · ${amount} to ${to}`,
    reached: (booked: string, amount: string, to: string, bank: boolean) => `Refunded ${booked} · ${amount} to ${to} · reached the ${target(bank)}`,
    pending: (booked: string, amount: string, to: string) => `Refunded ${booked} · ${amount} to ${to} · pending`,
    stripe: (booked: string, amount: string, to: string) => `Refunded ${booked} · ${amount} to ${to} · made in Stripe`,
    failed: (amount: string, to: string, bank: boolean) => `Refund didn’t reach the ${target(bank)} · ${amount} to ${to}`,
    anotherWay: (amount: string) => `Refund sent another way · ${amount}`,
    neverBooked: (amount: string, to: string) => `Card refund ${amount} to ${to} · not on this registration`,
  },
  money: {
    toTarget: (bank: boolean) => (bank ? 'To the bank account' : 'To the card'),
    toTargetPending: (bank: boolean) => `${bank ? 'To the bank account' : 'To the card'} · pending`,
    failed: (bank: boolean) => `Refund didn’t reach the ${target(bank)}`,
    anotherWay: 'Sent another way',
    madeInStripe: 'made in Stripe',
    neverBookedOne: 'One card refund isn’t in this book, because its payment never went on a registration:',
    neverBookedMany: (n: number) => `${n} card refunds aren’t in this book, because their payments never went on a registration:`,
    neverBookedItem: (amount: string, day: string) => `, ${amount} on ${day}`,
    neverBookedMore: (m: number) => `and ${m} more. See them under Ended on Registrations.`,
    neverBookedFee: (fee: string) => `Its ${fee} processing fee is under Payment processing.`,
    neverBookedFeeMany: 'Their processing fees are under Payment processing.',
    phoneHead: 'Not in this book',
    phoneLine: (name: string, amount: string, day: string) => `${name} · ${amount} card refund, ${day}. The payment never went on a registration.`,
  },
} as const;
