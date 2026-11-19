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

/**
 * Board Ready call 12 (ask 3, the drawing's window 2): why the club's "Send a new link" can't go out now, as a CODE, so
 * the team record picks its own sentence. `refusalMessage` stays the pay page's and the pay route's: for a completed
 * event its "is no longer in" misreads on the club's side. null = the team can pay now and has an email.
 */
export type PayLinkCause = Exclude<PayRefusal, null> | 'no_email';

export function payLinkCause(f: { refusal: PayRefusal; teamEmail: string | null }): PayLinkCause | null {
  return f.refusal ?? (f.teamEmail ? null : 'no_email');
}

/**
 * The team record's "Pay link" line (call 12, ask 7): "sent", "replaced" or "stopped", from the two stamps the team row
 * already keeps. A stop moves `link_replaced_at`; a send moves `pay_link_sent_at`; "Send a new link" stamps BOTH with
 * the one moment (`replaceTeamPayLink`), so equal = replaced, a stop after the last send = stopped, a send after the
 * stop = sent again ("until the next send"). null = no stamp at all (the line reads just "Pay link").
 */
export function payLinkLineState(sentAt: string | null, replacedAt: string | null): { kind: 'sent' | 'replaced' | 'stopped'; at: string } | null {
  const s = sentAt ? Date.parse(sentAt) : NaN;
  const r = replacedAt ? Date.parse(replacedAt) : NaN;
  if (!Number.isNaN(r) && (Number.isNaN(s) || r > s)) return { kind: 'stopped', at: replacedAt! };
  if (!Number.isNaN(r) && r === s) return { kind: 'replaced', at: replacedAt! };
  if (!Number.isNaN(s)) return { kind: 'sent', at: sentAt! };
  return null;
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
