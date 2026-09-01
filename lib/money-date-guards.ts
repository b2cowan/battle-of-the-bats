/**
 * The future-date rule — "Record is for money that has already MOVED" — one sentence per door,
 * stated ONCE (QA §123 Phase C; centralized by the same build's /simplify pass, which found six
 * hand copies of two sentences the moment they shipped).
 *
 * ⚠ PURE ON PURPOSE, like lib/dues-credit-guards.ts: no next/server import, so the client
 * pre-checks (the recording conversation's branches, the drawer's correction form) and the
 * server refusals (the payment POST/PATCH, the drive entries POST) speak the SAME words from the
 * SAME place. A wording change edits this map and nothing else.
 *
 * ⚠ The dues sentence deliberately offers NO hand-off (owner Q18): a future dues payment is not
 * a bill — the family's installment schedule is already the promise. Do not append a door.
 *
 * ⚠ The two sponsor doors (fundraisers POST, arrivals POST) predate this helper and still carry
 * their own copies of the arrival variant — and those two have ALREADY drifted from each other,
 * which is this file's whole argument. Migrate them here when those routes are next touched.
 */
import { tournamentToday } from './timezone';

const FUTURE_DATE_SENTENCES = {
  payment:
    'That hasn’t happened yet — a payment is money that has already come in. The installment schedule is the promise of what’s still to come.',
  'drive entry':
    'That hasn’t happened yet — a drive entry is money that has already come in.',
  /* ⚖ THE SPONSOR SENTENCE HANDS OFF (owner-ruled 2026-08-30, money-date consistency). A flat
     refusal is the wrong answer here, and this is the only door where that is true: a sponsor is
     ALREADY a pledge, and a pledge already carries an expected-by date (Q13, mig 269). A coach
     typing a future date is not confused about what a cheque is — they are telling us when it is
     due, in the only box on screen that takes a date. So point at the control that wants that
     fact, in the same grammar as the bill door. */
  'sponsor cheque':
    'That date hasn’t arrived yet — a cheque you’re expecting isn’t recorded, it’s promised. Set it as the pledge’s expected-by date instead.',
  'money back':
    'That hasn’t happened yet — money back is money that has already returned to the team.',
  income:
    'That hasn’t happened yet — income is money that has already come in.',
  cost:
    'That hasn’t happened yet — a cost is money that has already gone out. Money you have agreed to pay later is a bill.',
} as const;

/**
 * The latest day a MONEY-THAT-MOVED picker may offer.
 *
 * ⚠ IT EXISTS SO THE RULE HAS ONE NAME. Six money fields hand-rolled `max={tournamentToday()}` and
 * three more simply forgot it — not because anyone disagreed, but because there was nothing to
 * reuse and so nothing to notice the omission. Pass this to a date input’s `max` on every field
 * that records money which has ALREADY moved.
 *
 * ⚠⚠ DO NOT PUT IT ON A FORWARD-LOOKING DATE. A pledge’s expected-by, a drive’s start/end and a
 * dues installment’s due date are all SUPPOSED to be ahead of today. Consistency here means the
 * same question answered the same way — not every calendar wearing the same cap.
 */
export function moneyMovedMaxDate(): string {
  return tournamentToday();
}

/** The refusal for a money-in date after today, or null when the date has already happened.
 *  `receivedDate` is a YYYY-MM-DD org-timezone date, like every stored date in this repo. */
export function futureReceivedDateRefusal(
  receivedDate: string,
  noun: keyof typeof FUTURE_DATE_SENTENCES,
): string | null {
  return receivedDate > tournamentToday() ? FUTURE_DATE_SENTENCES[noun] : null;
}
