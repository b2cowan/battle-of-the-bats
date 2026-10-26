/**
 * NEEDS ATTENTION CLEARS ITSELF — the words (owner rulings 2026-10-16, hub Cv4TBP7XMMXnG4ZWVHB6J9, A1–A6 as
 * recommended; /marketing's polish pass at build, 2026-10-16). Client-safe: no server imports.
 *
 *   the hint     — beside the Needs-attention count (A1).
 *   the line     — a settled notification's line in the reader (A2): the OUTCOME (bold), then the stamp the reader
 *                  prints itself ("· Fri, Oct 16 · 5:10 p.m."), then what it did on a second line where it did
 *                  something. It names a person or a time only when the record keeps one — never a guess.
 *   the door     — a page that opens a request from its link says the exact outcome in its note (A5).
 *
 * "You" when the reader is the one who did it. Money is the house's `$216.00`.
 */

import { fmt } from './coach-money-summary';
import { possessive } from './utils';

export const NEEDS_ATTENTION_HINT = 'clears when it’s handled';

/** "You accepted it" / "Accepted by Morgan Ellis" / "Accepted" (nobody kept). */
function did(verbPast: string, verbBy: string, who: string | null, you: boolean): string {
  if (you) return `You ${verbPast} it`;
  return who ? `${verbBy} by ${who}` : verbBy;
}

const money = (cents: number) => fmt(cents / 100);

export const SETTLED_WORDS = {
  // A team asks for money back for time it hands back (club_hand_back_asked)
  accepted: (who: string | null, you: boolean) => did('accepted', 'Accepted', who, you),
  declined: (who: string | null, you: boolean) => did('declined', 'Declined', who, you),
  withdrawn: (who: string | null, you: boolean) => did('withdrew', 'Withdrawn', who, you),
  askClosed: 'The ask closed',
  askClosedThen: 'No practice in it was still to come.',
  creditedThen: (cents: number, team: string) => `${money(cents)} came off what ${team} owes.`,
  paidBackThen: (cents: number, team: string) => `The club pays ${team} back ${money(cents)}.`,
  reasonThen: (reason: string, you: boolean) => `${you ? 'Your reason' : 'Reason'}: “${reason}”.`,
  billUnchangedThen: (team: string) => `${possessive(team)} bill doesn’t change.`,

  // A team handed back time without asking for money (club_hand_back_unasked)
  askedLater: (who: string | null, you: boolean, cents: number) =>
    you ? `You asked the club for ${money(cents)} back` : `${who ?? 'The team'} asked the club for ${money(cents)} back`,
  tookBack: 'The team took the practices back.',

  // Coach filed a payment request (team_request_filed)
  approved: (who: string | null, you: boolean) => did('approved', 'Approved', who, you),
  reversed: (who: string | null, you: boolean) => did('reversed', 'Reversed', who, you),
  coachWithdrew: 'The coach withdrew it.',

  // Coach says "I sent the payment" (team_money_sent)
  confirmedReceived: (who: string | null, you: boolean) => (you ? 'You confirmed it was received' : who ? `Confirmed received by ${who}` : 'Confirmed received'),
  receivedUndone: (who: string | null, you: boolean) => (you ? 'You recorded it, then undid it' : who ? `Recorded, then undone by ${who}` : 'Recorded, then undone'),
  coachTookBack: 'The coach took it back.',

  // A family's payment the club passed to the head coach (club_payment_handed_off — Club Tier Stage 5c)
  handOffRecorded: (who: string | null, you: boolean) => (you ? 'You recorded it' : who ? `Recorded by ${who}` : 'Recorded'),
  handOffNotReceived: (who: string | null, you: boolean) => (you ? 'You said it never arrived' : who ? `${who} said it never arrived` : 'Marked as never arrived'),
  handOffNotReceivedThen: 'The club was told. Nothing was recorded.',
  handOffGone: 'The club’s record of this payment is gone.',

  // Online payments (Club Tier Stage 12a — CLUB_TIER_STAGE12A_COPY.md §19)
  payoutsBack: 'Online payments are back on',
  payoutsDisconnected: 'Payouts were disconnected.',
  onlinePaymentRecorded: 'It’s in the team’s record now.',
  onlinePaymentRefunded: 'It was refunded to the card.',
  onlineItemRecorded: 'It’s on the registration now.',
  onlinePaymentGone: 'The payment’s record is gone.',
  refundRecorded: 'Refund recorded',

  // Requests holding a coach's payout (team_request_holding_payout)
  allSettled: (n: number) => (n === 1 ? 'The request is settled.' : n === 2 ? 'Both requests are settled.' : `All ${n} requests are settled.`),

  // Schedule sent for review (club_schedule_review)
  answeredLooksGood: (who: string | null, you: boolean) => (you ? 'You answered: Looks good' : `${who ?? 'Your team'} answered: Looks good`),
  askedForChange: (who: string | null, you: boolean) => (you ? 'You asked for a change' : `${who ?? 'Your team'} asked for a change`),
  finalized: (who: string | null, you: boolean) => did('finalized', 'Finalized', who, you),
  scheduleDeleted: 'The schedule was deleted.',

  // Team move request (team_move_requested)
  moveAccepted: 'Accepted',
  moveDeclined: 'Declined',
  moveWithdrawn: 'Withdrawn',

  // Assistant coach waiting for approval (assistant_coach_approval_requested)
  inviteApproved: 'Approved.',
  inviteReplaced: 'A newer invite replaced it.',
  // The invite keeps no record of who said no, so this names both — never a guess at which.
  inviteDeclinedOrCancelled: 'It was declined or cancelled.',
  inviteExpired: 'It expired.',

  // A family's ask to withdraw a house-league child (house_league_withdraw_request, Club Tier 9b-2)
  withdrawDone: 'The registration has ended.',
  withdrawGone: 'The registration is no longer on the season.',

  // A free coach's payment reminder (team_coach_payment_reminder)
  paidInFull: 'Paid in full.',
  noLongerEntered: 'The team is no longer in the tournament.',
  notTracked: 'Payments aren’t tracked for this tournament any more.',

  // The club's card payment failed (payment_failed)
  billingGood: 'Billing is back in good standing.',
  planCancelled: 'The plan was cancelled.',

  // Team marked no-show (team_no_show)
  checkedInAfterAll: (team: string | null) => `${team ?? 'The team'} checked in after all.`,
  noShowUndone: 'The no-show was undone.',
  tournamentOver: 'The tournament is over.',
  teamRemoved: 'The team was removed from the tournament.',
} as const;

/** The doors (A5) — one sentence in the page's note, prose rather than the line's stamp. */
export const DOOR_WORDS = {
  /** "You accepted 15U AAA’s ask on Fri, Oct 16 at 5:10 p.m." */
  askAnswered: (p: { who: string | null; you: boolean; verb: 'accepted' | 'declined' | 'withdrew'; team: string; day: string | null; time: string | null }) => {
    const subject = p.you ? 'You' : p.who ?? (p.verb === 'withdrew' ? 'Its coach' : 'The club');
    const when = p.day ? ` on ${p.day}${p.time ? ` at ${p.time}` : ''}` : '';
    return `${subject} ${p.verb} ${possessive(p.team)} ask${when}.`;
  },
  /** "15U AAA’s ask closed on Sun, Mar 28: no practice in it was still to come." */
  askClosed: (team: string, day: string | null) => `${possessive(team)} ask closed${day ? ` on ${day}` : ''}: no practice in it was still to come.`,
  requestWithdrawn: 'The coach withdrew that request.',
} as const;
