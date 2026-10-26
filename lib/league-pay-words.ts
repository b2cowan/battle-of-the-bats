/**
 * A HOUSE-LEAGUE FAMILY PAYS BY CARD — the words (Club Tier Stage 12b, `docs/projects/active/CLUB_TIER_STAGE12B_COPY.md`
 * §1, §2, §3, §10, §11). One home: the pay block, the status page's child lines, the pay route's refusals, the receipt and
 * the emails read these. The states that are the team pay block's (opening, confirming, not finished, the refund-policy
 * link, the button) are 12a's words (`PAY_WORDS`), reused, never retyped. No rate is typed here.
 */
import { possessive } from './utils';
import { nameList } from './league-signup';

/** The first names a payment covers, "Ava and Henry" (copy `{childList}`): the sign-up's one list joiner. */
export const childList = nameList;

export const LEAGUE_PAY_WORDS = {
  // §1 · the pay block
  heading: 'To pay now',
  lineChild: (child: string, division: string, owing: string) => `${child} · ${division} · ${owing}`,
  lineChildPart: (child: string, division: string, owing: string, fee: string) => `${child} · ${division} · ${owing} left of ${fee}`,
  lineWaitlisted: (child: string) => `${child} is on the waitlist. Nothing to pay unless a spot opens.`,
  linePending: (child: string) => `${child} is waiting for the club to review. Nothing to pay yet.`,
  linePaid: (child: string, division: string) => `${child} · ${division} · paid`,
  paidTitle: 'Everything is paid. Thank you.',
  endedTitle: 'Nothing to pay',
  endedWithdrawn: (child: string, date: string | null) =>
    date ? `${possessive(child)} registration was withdrawn on ${date}, so there is nothing to pay.` : `${possessive(child)} registration was withdrawn, so there is nothing to pay.`,
  endedDeclined: (child: string) => `${possessive(child)} registration wasn’t accepted, so there is nothing to pay.`,
  endedQuestions: (club: string, contact: string | null) => (contact ? `Questions go to ${club}: ${contact}.` : `Questions go to ${club}.`),
  endedReference: (reference: string) => `Reference ${reference}`,
  // §2 · the status page's child lines
  childReceipt: 'View receipt',
  // §10 · the receipt page and email
  receiptSeason: (season: string) => season,
  receiptLineChild: (child: string, division: string) => `${child} · ${division} · Registration fee`,
  receiptWaitlisted: (child: string) => `${child} is on the waitlist. If a spot opens, we’ll email you a link to pay.`,
  revisit: 'Your status page shows this receipt any time you open your pay link.',
  // Derived: 12a's "Refunded to card, {date}" without the date the status page does not carry (12b refunds bring it).
  receiptRefunded: 'Refunded to card',
  receiptEmailLine: (child: string, season: string, division: string, base: string) => `${child} · ${season} · ${division} · ${base}`,
  // §11 · the pay route's refusals
  error: {
    notAccepted: (child: string) => `${child} hasn’t been accepted yet. You can pay once the club accepts them.`,
    ended: (child: string) => `${possessive(child)} registration has ended, so there’s nothing to pay.`,
    alreadyPaid: (child: string) => `${child} is already paid.`,
    nothingOwed: 'There’s nothing to pay right now.',
    linkInvalid: (club: string | null) => (club ? `This payment link doesn’t work. Ask ${club} to email you a new one.` : 'This payment link doesn’t work. Ask the club to email you a new one.'),
    unrecorded: (club: string, contact: string | null) =>
      contact ? `A payment for this sign-up is being checked by ${club}. Contact them before paying again: ${contact}.` : `A payment for this sign-up is being checked by ${club}. Contact them before paying again.`,
  },
  // §4 · the pay-link email ("Email the pay link"; a price raise sends it too)
  linkEmail: {
    subject: (children: string, season: string) => `Pay for ${children} in ${season}`,
    body: (club: string, children: string, season: string) => `${club} sent you a link to pay for ${children} in ${season}.`,
    bodyRaised: (child: string, season: string, from: string, to: string, diff: string) =>
      `${possessive(child)} price for ${season} changed from ${from} to ${to}. ${diff} is left to pay.`,
    amount: (owing: string) => `Amount due: ${owing}`,
    button: 'Pay now',
    otherWays: (how: string) => `Or pay another way: ${how}`,
    reference: (ref: string) => `Reference ${ref}`,
  },
  // §6.3 · the refund email for a price correction (an ending's refund rides in the ending's own email)
  refundEmail: {
    subject: (club: string) => `Refund from ${club}`,
    leadPart: (amount: string, child: string, season: string) => `${amount} of ${possessive(child)} registration fee for ${season} was refunded.`,
    priceChanged: (from: string, to: string) => `The price changed from ${from} to ${to}.`,
    reason: (club: string, why: string) => `${possessive(club)} reason: ${why}`,
    amount: (amount: string) => `${amount} is on its way back to the card. It takes 5 to 10 business days to appear.`,
    questions: (contact: string) => `Questions: ${contact}.`,
  },
  // §3 · the emails' Pay now (while the club takes payments)
  mail: {
    payButton: 'Pay now',
    payLine: 'Pay online by card, or pay another way below.',
    payLineOnly: 'Pay online by card.',
    feeShown: 'The processing fee is shown before you pay.',
    otherWaysLabel: 'Other ways to pay',
  },
} as const;

