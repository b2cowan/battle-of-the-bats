'use client';
/**
 * A PAYMENT REQUEST, AND THE QUESTIONS BEFORE MONEY MOVES (Club Tier Stage 3a, specimen 4 — Asks 1, 3
 * and 5b; C07, C15, S3A-03, J4-014).
 *
 *   the request — the coach's own words; the direction in the coach's words (To club / From club);
 *                 how the coach FILED it (new money or money back — read, never changed by the club,
 *                 D1); the budget item it hits in the team's plan; who asked and when; how they'd like
 *                 it. Decline · Approve (lime). A waiting request that holds up the team's end-of-season
 *                 payout says so in a red-edged notice — the one thing only the club can unblock.
 *   approve     — asks for the day, how and the reference, and names the line and the coach's side.
 *                 A To-club request reads "Confirm $180.00 received".
 *   decline     — keeps its required reason (the coach reads it).
 *   reverse     — quiet, at the foot of an approved request, with a reason; NOT red (a correction:
 *                 both lines stay, marked void).
 * On a phone the request opens full-screen (a form covers the nav), its answers docked at its foot.
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import KitDialog from '../KitDialog';
import { Callout, RepChip, RowAction } from '../RepKit';
import { REQUEST_DIRECTION_WORD, UNLINKED_APPROVAL, methodWord, requestStatusWord } from '@/lib/club-money-words';
import { clubMoneyInWord } from '@/lib/coach-club-money';
import { tournamentToday } from '@/lib/timezone';
import { DUES_PAYMENT_METHODS, type DuesPaymentMethod } from '@/lib/types';
import {
  DayField, Facts, FormError, MethodField, Quote, ReasonQuestion, TextField, day, isStale, jsonInit, money, moneyFetch, moneyKit, moneyMove, refusalText,
} from './MoneyKit';

export interface RequestRow {
  id: string; teamId: string; teamName: string;
  requestType: 'payment_to_org' | 'charge_to_org';
  amount: number; description: string; paymentMethod: string | null; notes: string | null;
  status: 'pending' | 'approved' | 'denied' | 'reversed' | string;
  denialReason: string | null;
  moneyInMeaning: 'funding' | 'reimbursement' | null;
  budgetCategoryName: string | null; budgetItemName: string | null;
  createdAt: string; reviewedAt: string | null;
  paidOn: string | null; paidMethod: string | null; paidReference: string | null;
  reversedAt: string | null; reversedReason: string | null;
  askedBy: string | null; decidedBy: string | null; reversedByName: string | null;
  waitingDays: number | null; holdingPayout: boolean;
}

export const toClub = (r: Pick<RequestRow, 'requestType'>) => r.requestType === 'payment_to_org';

/** "New money" / "Money back" / null (a To-club request), or "—" filed before mig 271 asked. */
export function filedAs(r: RequestRow): { word: string | null; legacy: boolean } {
  if (toClub(r)) return { word: null, legacy: false };
  if (!r.moneyInMeaning) return { word: null, legacy: true };
  return { word: clubMoneyInWord(r), legacy: false };
}

/** The decided request's line: "Approved Sep 5 by Priya Nair · E-Transfer" / "Declined Sep 2 · “…”". */
export function decisionLine(r: RequestRow): string | null {
  if (r.status === 'approved') {
    return [`Approved ${day(r.paidOn ?? r.reviewedAt)}${r.decidedBy ? ` by ${r.decidedBy}` : ''}`, methodWord(r.paidMethod)].filter(Boolean).join(' · ');
  }
  if (r.status === 'denied') return `Declined ${day(r.reviewedAt)}${r.denialReason ? ` · “${r.denialReason}”` : ''}`;
  if (r.status === 'reversed') return `Reversed ${day(r.reversedAt)}${r.reversedReason ? ` · “${r.reversedReason}”` : ''}`;
  return null;
}

export function StateChip({ r }: { r: RequestRow }) {
  if (r.status === 'approved') return <RepChip tone="good">{requestStatusWord(r.status)}</RepChip>;
  if (r.status === 'pending') return null;
  return <RepChip>{requestStatusWord(r.status)}</RepChip>;
}

export function RequestWindow({ r, canMove, onAsk, onClose }: {
  r: RequestRow; canMove: boolean;
  onAsk: (kind: 'approve' | 'decline' | 'reverse') => void;
  onClose: () => void;
}) {
  const out = toClub(r);
  const filed = filedAs(r);
  const waiting = r.status === 'pending';
  const eyebrow = waiting
    ? `Payment request · waiting ${r.waitingDays === 0 ? 'since today' : `${r.waitingDays} ${r.waitingDays === 1 ? 'day' : 'days'}`}`
    : `Payment request · ${requestStatusWord(r.status).toLowerCase()}`;
  const title = out ? `${r.teamName} pays the club ${money(r.amount)}` : `${r.teamName} asks the club for ${money(r.amount)}`;
  const budget = [r.budgetCategoryName, r.budgetItemName].filter(Boolean).join(' › ');
  const decided = decisionLine(r);
  return (
    <KitDialog
      kind="form"
      eyebrow={eyebrow}
      title={title}
      onClose={onClose}
      footerStart={canMove && r.status === 'approved'
        ? <RowAction quiet onClick={() => onAsk('reverse')}>Reverse this approval</RowAction>
        : undefined}
      footer={canMove && waiting ? (
        <>
          <button type="button" className="btn btn-outline" onClick={() => onAsk('decline')}>Decline</button>
          <button type="button" className="btn btn-lime" onClick={() => onAsk('approve')}>{out ? `Confirm ${money(r.amount)} received` : 'Approve'}</button>
        </>
      ) : <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>}
    >
      {waiting && r.holdingPayout && (
        <Callout tone="bad" role="note" icon={<AlertTriangle size={16} aria-hidden />}>
          {/* One paragraph at one size, as drawn: the bold sentence, a space, the reason (/design 2026-10-01). */}
          <b>This is holding up {r.teamName}’s end-of-season payout.</b>{' '}
          {r.askedBy ?? 'The coach'} can’t pay families their share while a request to the club is unanswered.
        </Callout>
      )}
      {/* The coach's own words — only when they wrote some; the request's name is already "For" below. */}
      {r.notes?.trim() && <Quote>{r.notes.trim()}</Quote>}
      <Facts rows={[
        ['Direction', out ? `${REQUEST_DIRECTION_WORD.payment_to_org} — ${r.teamName} pays the club` : `${REQUEST_DIRECTION_WORD.charge_to_org} — the club pays ${r.teamName}`],
        out ? ['For', r.description] : null,
        !out ? ['Filed by the coach as', filed.legacy ? '— (filed before we asked)' : filed.word === 'New money' ? 'New money for the season' : 'Money back for a cost'] : null,
        budget ? ['In the team’s budget', budget] : null,
        ['Asked by', `${r.askedBy ?? 'A coach'} · ${day(r.createdAt)}`],
        r.paymentMethod ? [out ? 'How it’s coming' : 'How they’d like it', methodWord(r.paymentMethod) ?? r.paymentMethod] : null,
        decided ? ['Decided', decided] : null,
        r.status === 'approved' && r.paidReference ? ['Reference', r.paidReference] : null,
      ]} />
      {!out && waiting && filed.word === 'New money' && (
        <p className={moneyKit.who}>New money adds to what {r.teamName}’s season has. Money back would instead repay a cost the team already spent.</p>
      )}
    </KitDialog>
  );
}

const methodOf = (v: string | null): DuesPaymentMethod | '' =>
  v && (DUES_PAYMENT_METHODS as readonly string[]).includes(v) ? v as DuesPaymentMethod : '';

/** Approve (From club) / Confirm received (To club): the decision and both ledger lines in ONE step. */
export function ApproveWindow({ r, q, onClose, onDone }: {
  r: RequestRow; q: string; onClose: () => void; onDone: (text: string | null, keepOpen?: boolean) => void;
}) {
  const out = toClub(r);
  const today = tournamentToday();
  const [on, setOn] = useState(today);
  const [method, setMethod] = useState<DuesPaymentMethod | ''>(methodOf(r.paymentMethod));
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = money(r.amount);

  async function go() {
    if (busy) return;
    if (!on) { setError(out ? 'Give the day it came.' : 'Give the day it was paid.'); return; }
    if (!method) { setError(out ? 'Choose how it came.' : 'Choose how it was paid.'); return; }
    setBusy(true); setError('');
    try {
      const res = await moneyFetch(`/api/admin/accounting/payment-requests/${r.id}?${q}`,
        jsonInit('PATCH', { action: 'approve', paidOn: on, method, reference: reference.trim() || null }));
      if (!res.ok) {
        setError(refusalText(res.data, 'The request couldn’t be approved. Please try again.'));
        if (isStale(res.status, res.data)) onDone(null, true);
        return;
      }
      onDone(out
        ? `${amount} from ${r.teamName} is recorded.${r.holdingPayout ? ` ${r.teamName}’s coach can now pay families.` : ''} Their coaches are told.`
        : `${r.teamName}’s request is approved and ${amount} is recorded. Their coaches are told.`);
    } catch {
      setError('The request couldn’t be approved. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      eyebrow={`${r.teamName} · ${r.description}`}
      title={out ? `Confirm ${amount} received from ${r.teamName}?` : `Approve and pay ${r.teamName} ${amount}?`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
            {busy ? 'Recording…' : out ? `Confirm ${amount} received` : `Approve and record ${amount}`}
          </button>
        </>
      }
    >
      <FormError>{error}</FormError>
      <div className={moneyKit.pair}>
        <DayField id="ap-on" label={out ? 'Received on' : 'Paid on'} value={on} onChange={setOn} max={today} />
        <MethodField id="ap-how" label={out ? 'How it came' : 'How it was paid'} value={method} onChange={setMethod} />
      </div>
      <TextField id="ap-ref" label="Reference" value={reference} onChange={setReference} maxLength={100} placeholder="E-Transfer or cheque reference" />
      <Facts rows={[
        ['General ledger', `${amount} ${out ? 'in' : 'out'}`],
        ['The line reads', out ? `From ${r.teamName} · ${r.description}` : `Paid to ${r.teamName} · ${r.description}`],
        [`${r.teamName}’s coaches`, out
          ? (r.holdingPayout ? 'See it confirmed, are told, and can pay families' : 'See it confirmed, and are told')
          : 'See it approved, and are told'],
      ]} />
    </KitDialog>
  );
}

/** Decline — the coach reads the reason; no ledger line. */
export function DeclineWindow({ r, q, onClose, onDone }: {
  r: RequestRow; q: string; onClose: () => void; onDone: (text: string | null, keepOpen?: boolean) => void;
}) {
  return (
    <ReasonQuestion
      eyebrow={`${r.teamName} · ${r.description}`}
      title={`Decline ${r.teamName}’s ${money(r.amount)} request?`}
      placeholder="For example: not in this year’s budget"
      hint="The coach reads this."
      missing="Say why — the coach reads it."
      keepLabel="Keep it waiting"
      confirmLabel="Decline"
      busyLabel="Declining…"
      failText="The request couldn’t be declined."
      submit={reason => moneyMove(`/api/admin/accounting/payment-requests/${r.id}?${q}`, jsonInit('PATCH', { action: 'decline', reason }), {
        fallback: 'The request couldn’t be declined. Please try again.',
        done: `${r.teamName}’s request is declined. Their coaches are told why.`,
      })}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

/** Reverse an approval — both lines voided, kept, with a reason; not red (Ask 3). */
export function ReverseWindow({ r, q, onClose, onDone }: {
  r: RequestRow; q: string; onClose: () => void; onDone: (text: string | null, keepOpen?: boolean) => void;
}) {
  return (
    <ReasonQuestion
      eyebrow={`${r.teamName} · approved ${day(r.paidOn ?? r.reviewedAt)}`}
      title="Reverse this approval?"
      lead={<>The {money(r.amount)} line on the General ledger is voided: it stays, marked void, with your reason. The request reads Reversed, and {r.teamName}’s coaches see it and are told.</>}
      placeholder="For example: approved against the wrong team"
      hint="Reversing corrects the books. If money really went out, getting it back is between the club and the team."
      missing="Say why the approval is being reversed."
      confirmLabel="Reverse the approval"
      busyLabel="Reversing…"
      failText="The approval couldn’t be reversed."
      submit={reason => moneyMove(`/api/admin/accounting/payment-requests/${r.id}?${q}`, jsonInit('PATCH', { action: 'reverse', reason }), {
        fallback: 'The approval couldn’t be reversed. Please try again.',
        done: `The approval is reversed. ${r.teamName}’s coaches see it and are told why.`,
        codeWords: { unlinked: UNLINKED_APPROVAL },
      })}
      onClose={onClose}
      onDone={onDone}
    />
  );
}
