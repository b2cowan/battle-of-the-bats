/**
 * Why a tournament team cannot pay online right now, in words (Club Tier Stage 12a, copy §18). Pure, so the unit suite
 * holds every refusal; the pay route's JSON and the pay page say the same sentence.
 */
import { BANK_DEBIT_WORDS as B, PAY_WORDS as W } from './online-payment-words';

/** 12c: 'clearing' — a bank debit for this team is on its way; nothing more is offered until it clears or comes back (ask 6). */
export type PayRefusal = 'switch_off' | 'not_accepted' | 'not_taking_payments' | 'not_tracked' | 'our_team' | 'nothing_owed' | 'tournament_over' | 'unrecorded_payment' | 'clearing' | null;

export interface RefusalFacts {
  refusal: PayRefusal;
  teamName: string;
  teamStatus: string;
  totalPaid: number;
  org: { name: string };
  tournament: { name: string };
}

export function refusalMessage(f: RefusalFacts): string | null {
  switch (f.refusal) {
    case null: return null;
    case 'switch_off': return W.error.switchOff;
    case 'not_taking_payments':
    case 'not_tracked': return W.error.clubNotTaking(f.org.name);
    case 'not_accepted': return f.teamStatus === 'rejected' ? W.error.ended(f.teamName, f.tournament.name) : W.error.notAccepted(f.teamName);
    case 'tournament_over': return W.error.ended(f.teamName, f.tournament.name);
    case 'unrecorded_payment': return W.error.unrecorded(f.teamName);
    case 'clearing': return B.errorClearing(f.teamName, f.org.name);
    case 'our_team':
    case 'nothing_owed': return f.totalPaid > 0 ? W.error.alreadyPaid(f.teamName) : W.error.nothingOwed(f.teamName);
  }
}
