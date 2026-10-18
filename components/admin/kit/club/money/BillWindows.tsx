'use client';
/**
 * A TEAM'S BILL, AND THE THREE THINGS THE CLUB DOES WITH IT (Club Tier Stage 3a, specimen 3 — Asks 1
 * and 3; J4-013, C07, C08, S3A-01, C17).
 *
 *   the bill   — a ROOM in the portal's money grammar (List · Room · Question, owner 2026-09-02): its money
 *                figures as the portal's ONE joined band (Stage 3d, owner 2026-10-08 — they were four separate
 *                tiles; since 2026-10-16 the money only, adding up, with the date as a line under Outstanding),
 *                then the installments, each with its due date and, once received, the day, how,
 *                the reference and who recorded it. "Record received" sits on each unpaid installment,
 *                OLIVE (it repeats down the rows — lime is one main action per screen). Named neighbours
 *                at its foot through the teams on the same band ("‹ 10U A · 1 of 3 · 16U Girls ›",
 *                2026-09-30), drawn only when there is a neighbour. A quiet Undo; the door to the team's account
 *                at the payments' foot; "Remind {team}" the window's one foot button (2026-10-09, no Close).
 *   record     — asks for the day (the club's), how (a dropdown) and the reference, and says what will
 *                be written and where, naming the team (J4-016). ONE database step behind it.
 *   confirm    — the same window, filled in from the coach's "sent" note (Ask 1).
 *   undo       — asks for a reason, names both sides, and is NOT red (a correction: the line stays).
 *
 * Who: whoever holds the club's accounting (`canMove`, Ask 1). A tap on a bill that changed under the
 * screen is refused in words and the bill re-reads in place (409 `money_state_changed`).
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Lock, Users } from 'lucide-react';
import KitDialog, { type KitStep } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { kit } from '@/components/coaches/kit';
import { Callout, RepChip, RowAction, repKit } from '../RepKit';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import { UNLINKED_PAYMENT, billOutstandingLine, lockedRecordWords } from '@/lib/club-money-words';
import { HAND_BACK_WORDS } from '@/lib/club-hand-back-words';
import fy from './FiscalYear.module.css';
import { daysBetweenDateStrings, tournamentToday } from '@/lib/timezone';
import { DUES_PAYMENT_METHODS, type DuesPaymentMethod } from '@/lib/types';
import type { ClubBillFigures, ClubInstallmentState } from '@/lib/club-money-figures';
import {
  DayField, Facts, FormError, LateChip, MethodField, ReasonQuestion, TextField, day, isStale, jsonInit, money, moneyFetch, moneyKit, moneyMove, refusalText,
} from './MoneyKit';
import { possessive } from '@/lib/utils';

export interface BillInstallment {
  id: string; installmentNumber: number; amount: number; dueDate: string; state: ClubInstallmentState; daysLate: number;
  /** Stage 11d: what credits took off it, and what is left to pay on it (amount − credited). */
  credited: number; due: number;
  received: null | {
    on: string; how: string | null; method: string | null; reference: string | null; recordedBy: string | null; recordedAt: string;
    /** Its line sits in a CLOSED fiscal year (Stage 3c, Ask 8d): Undo is not offered — to undo it, reopen the year. */
    locked?: boolean;
    lockedIn?: { yearName: string; reopen: string | null } | null;
  };
  sent: null | { on: string; how: string | null; method: string | null; reference: string | null; sentBy: string | null; sentAt: string };
  undone: null | { at: string; by: string | null; reason: string };
}
export interface TeamBill {
  splitId: string; teamId: string; teamName: string; groupName: string | null; programYearId: string; headCoaches: string[];
  allocated: number; figures: ClubBillFigures; chip: string; band: 'needs_you' | 'on_track'; installments: BillInstallment[];
}

const ofN = (i: BillInstallment, bill: TeamBill) => `${i.installmentNumber} of ${bill.installments.length}`;

/** "Due Aug 15 · received Aug 12 · Cheque 1051 · Priya Nair" — an installment's quiet line. */
function installmentLine(i: BillInstallment): string {
  const parts: (string | null)[] = [`Due ${day(i.dueDate)}`];
  if (i.received) parts.push(`received ${day(i.received.on)}`, i.received.how, i.received.recordedBy);
  else if (i.sent) parts.push(`sent ${day(i.sent.on)}${i.sent.sentBy ? ` by ${i.sent.sentBy}` : ''}`, i.sent.how);
  if (!i.received && i.undone) parts.push(`undone ${day(i.undone.at)} · “${i.undone.reason}”`);
  return parts.filter(Boolean).join(' · ');
}

/**
 * ⚖ Stage 3d (Ask 4): the bill opens ONE LEVEL INSIDE its allocation's window, in place — `back` names the allocation
 * ("← Diamond fees 2026"), and the window keeps the allocation's 800 px (`wide`), so the two levels of one window never
 * jump in size. `status` is the window's floating pill (what a money move just did, said once).
 */
export function BillRoom({ allocation, bill, bandWord, position, steps, canMove, accountingBase, back, wide = false, status, address, onRecord, onUndo, onRemind, onClose }: {
  allocation: { id: string; description: string };
  bill: TeamBill;
  /** "needs you" / "on track". */
  bandWord: string;
  /** "1 of 3". */
  position: string;
  steps: { prev: KitStep | null; next: KitStep | null };
  canMove: boolean;
  accountingBase: string;
  /** The allocation behind it, named — the way up one level (Stage 3d). */
  back?: { label: string; onBack: () => void };
  wide?: boolean;
  status?: ReactNode;
  /** The bill as a place in the URL bar (the allocation window over Allocations — KitDialog `address`). */
  address?: string;
  onRecord: (i: BillInstallment, mode: 'receive' | 'confirm') => void;
  onUndo: () => void;
  onRemind: () => void;
  onClose: () => void;
}) {
  const asOf = tournamentToday();
  const f = bill.figures;
  // ⚖ Option A (owner 2026-10-16): the date that was a fifth figure is a line under Outstanding — red when late. Its
  // days late are the oldest late payment's own, as its row's chip reads them (server-counted), so the two never differ.
  const owedLine = billOutstandingLine(f, Math.max(0, ...bill.installments.filter(i => i.state === 'overdue').map(i => i.daysLate)));
  // ⚖ A payment recorded in a CLOSED fiscal year can't be undone here (Ask 8d): its Undo is absent, one locked
  // sentence in its place. A payment still OWED on a closed year's bill stays receivable (dated today, in the open year).
  const anyReceived = bill.installments.some(i => i.received && !i.received.locked);
  const lockedIn = bill.installments.find(i => i.received?.locked)?.received?.lockedIn ?? null;
  const owes = f.outstanding > 0;
  // ⚖ ONE FOOT ROW AT MOST (owner, 2026-10-09, §285 W8: "not a huge fan of the format and size of this footer" — on a
  // phone it was three rows, a quarter of the screen). The foot holds the bill's one act, Remind; with nothing to remind
  // there is no foot. Close went: × (a desk) and ← (a phone) already close it, the reason Payees lost Done (3d Ask 2).
  // The door to the team's account is the payments card's foot, the portal's card-foot door. The position left the
  // eyebrow: Previous · Next says it, and with no neighbour there is nothing to say.
  const canRemind = canMove && owes && bill.headCoaches.length > 0;
  return (
    <KitDialog
      kind="form"
      eyebrow={`${allocation.description} · ${bandWord}`}
      title={bill.teamName}
      onClose={onClose}
      back={back}
      levelKey={bill.splitId}
      size={wide ? 'wide' : 'medium'}
      status={status}
      address={address}
      steps={{ ...steps, position, positionWide: `${position} ${bandWord}`, noun: 'team' }}
      footer={canRemind ? <button type="button" className="btn btn-outline" onClick={onRemind}>Remind {bill.teamName}</button> : undefined}
    >
      <div className={moneyKit.windowBand}>
        <MoneySummaryBand
          ariaLabel={`${possessive(bill.teamName)} bill`}
          /* ⚖ MONEY THAT ADDS UP, ONE ROW (owner 2026-10-16, option A of the decision sheet
             https://claude.ai/artifact/EDktV4ykGYaSx6fLxMKC2t): Billed − Credited − Collected = Outstanding. Stage 11d's
             Credited had made this band five figures, and the band holds four across — the fifth (Next due, a DATE, the
             payment rows below already carry it) fell to a row of its own. The date is now the line under Outstanding:
             the bill's verdict, red when a payment is late (colour on the verdict, never on the total). */
          tiles={[
            { key: 'billed', label: 'Billed', figure: money(f.billed) },
            // Stage 11d (Ask 6): what credits took off the bill — a figure of its own, only on a bill that has one.
            ...(f.credited > 0 ? [{ key: 'credited', label: HAND_BACK_WORDS.credited, figure: money(f.credited) }] : []),
            { key: 'collected', label: 'Collected', figure: money(f.collected) },
            {
              key: 'outstanding', label: 'Outstanding', figure: money(f.outstanding),
              caption: owedLine && (owedLine.late
                ? <span className={moneyKit.owedLate}><AlertTriangle size={11} aria-hidden />{owedLine.text}</span>
                : owedLine.text),
            },
          ]}
        />
      </div>
      {bill.headCoaches.length === 0 && owes && (
        <Callout role="note" icon={<Users size={16} aria-hidden />}>
          {bill.teamName} has no head coach yet, so there is nobody to remind. Invite one from the team’s page.
        </Callout>
      )}
      <div className={moneyKit.lines}>
        {bill.installments.map(i => (
          <div key={i.id} className={moneyKit.line}>
            <div className={moneyKit.lineMain}>
              <span className={moneyKit.lineTitle}>{ofN(i, bill)} · {money(i.due)}</span>
              <span className={moneyKit.lineSub}>{[i.credited > 0 ? HAND_BACK_WORDS.lessCredit(Math.round(i.amount * 100), Math.round(i.credited * 100)) : null, installmentLine(i)].filter(Boolean).join(' · ')}</span>
            </div>
            <div className={moneyKit.lineEnd}>
              {i.state === 'received' && <RepChip tone="good">Received</RepChip>}
              {i.state === 'credited' && <RepChip>{HAND_BACK_WORDS.credited}</RepChip>}
              {i.state === 'sent' && <RepChip tone="info">Sent</RepChip>}
              {i.state === 'overdue' && <LateChip days={i.daysLate} />}
              {i.state === 'upcoming' && <span className={moneyKit.lineQuiet}>{inDays(i.dueDate, asOf)}</span>}
              {canMove && i.state === 'sent' && <RowAction onClick={() => onRecord(i, 'confirm')}>Confirm received</RowAction>}
              {canMove && (i.state === 'overdue' || i.state === 'upcoming') && <RowAction onClick={() => onRecord(i, 'receive')}>Record received</RowAction>}
            </div>
          </div>
        ))}
        <div className={moneyKit.linesFoot}>
          <Link href={`${accountingBase}/teams/${bill.teamId}`} className={kit.footLink}>Open {possessive(bill.teamName)} account</Link>
        </div>
      </div>
      {canMove && anyReceived && (
        <p className={moneyKit.quietDoor}>
          <RowAction quiet onClick={onUndo}>Undo a payment</RowAction>
        </p>
      )}
      {lockedIn && (
        <p className={fy.lockedNote}>
          <Lock size={13} aria-hidden className={fy.lockedNoteIcon} />
          <span>{lockedRecordWords('undo', lockedIn.yearName, lockedIn.reopen)}</span>
        </p>
      )}
    </KitDialog>
  );
}

function inDays(due: string, asOf: string): string {
  const d = daysBetweenDateStrings(asOf, due);
  if (d <= 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `In ${d} days`;
}

/** Record received / Confirm received — the one moment money enters the club's ledger (Ask 1). */
export function RecordWindow({ mode, allocation, bill, installment, q, onClose, onDone }: {
  mode: 'receive' | 'confirm';
  allocation: { id: string; description: string };
  bill: TeamBill;
  installment: BillInstallment;
  q: string;
  onClose: () => void;
  /** A write landed (or the bill changed under us): re-read; the text is the page's notice. */
  onDone: (text: string | null, keepOpen?: boolean) => void;
}) {
  const sent = mode === 'confirm' ? installment.sent : null;
  const today = tournamentToday();
  const [on, setOn] = useState(sent?.on && sent.on <= today ? sent.on : today);
  const [method, setMethod] = useState<DuesPaymentMethod | ''>(
    sent?.method && (DUES_PAYMENT_METHODS as readonly string[]).includes(sent.method) ? sent.method as DuesPaymentMethod : '');
  const [reference, setReference] = useState(sent?.reference ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = money(installment.due);
  const verb = mode === 'confirm' ? 'Confirm' : 'Record';

  async function go() {
    if (busy) return;
    if (!on) { setError('Give the day it came.'); return; }
    if (!method) { setError('Choose how it came.'); return; }
    setBusy(true); setError('');
    try {
      const r = await moneyFetch(
        `/api/admin/accounting/allocations/${allocation.id}/installments/${installment.id}?${q}`,
        jsonInit('PATCH', { action: mode, receivedOn: on, method, reference: reference.trim() || null }),
      );
      if (!r.ok) {
        setError(refusalText(r.data, 'The payment couldn’t be recorded. Please try again.'));
        if (isStale(r.status, r.data)) onDone(null, true);
        return;
      }
      onDone(`${amount} from ${bill.teamName} is recorded. ${possessive(bill.teamName)} coaches see it received, and are told.`);
    } catch {
      setError('The payment couldn’t be recorded. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      eyebrow={`${allocation.description} · ${bill.teamName} · ${ofN(installment, bill)}`}
      title={`${verb} ${amount} received`}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>{busy ? 'Recording…' : `${verb} ${amount} received`}</button>
        </>
      }
    >
      {sent && (
        <p className={moneyKit.lead1}>
          {sent.sentBy ?? `${possessive(bill.teamName)} coach`} recorded {amount} sent on {day(sent.on)}{sent.how ? ` by ${sent.how}` : ''}. It counts as collected once you confirm it arrived.
        </p>
      )}
      <FormError>{error}</FormError>
      <div className={moneyKit.pair}>
        <DayField id="rr-on" label="Received on" value={on} onChange={setOn} max={today} />
        <MethodField id="rr-how" label="How it came" value={method} onChange={setMethod} />
      </div>
      <TextField id="rr-ref" label="Reference" value={reference} onChange={setReference} maxLength={100}
        hint={`The cheque number or the E-Transfer reference. It prints on the club’s ledger line and on ${possessive(bill.teamName)} Club page.`} />
      <Facts rows={[
        ['General ledger', `${amount} in`],
        ['The line reads', `Allocation received · ${bill.teamName}`],
        [`${possessive(bill.teamName)} coaches`, 'See it received, and are told'],
      ]} />
    </KitDialog>
  );
}

/** Undo a payment the club recorded: a reason, both sides named, not red (Ask 3; S3A-01's club half). */
export function UndoWindow({ allocation, bill, q, onClose, onDone }: {
  allocation: { id: string; description: string };
  bill: TeamBill;
  q: string;
  onClose: () => void;
  onDone: (text: string | null, keepOpen?: boolean) => void;
}) {
  const received = bill.installments.filter(i => i.received && !i.received.locked);
  const [pick, setPick] = useState(received[received.length - 1]?.id ?? '');
  // Never falls back to another payment: after a re-read the picked one may be gone, and the
  // question then waits, disabled, rather than quietly aiming at a different installment.
  const i = received.find(x => x.id === pick) ?? null;
  return (
    <ReasonQuestion
      eyebrow={i ? `${bill.teamName} · ${allocation.description}, ${ofN(i, bill)}` : bill.teamName}
      title={i?.received ? `Undo the ${money(i.due)} received on ${day(i.received.on)}?` : 'Undo a payment?'}
      ready={!!i}
      extra={received.length > 1 && (
        <label className={ck.field} htmlFor="undo-which">
          <span className={ck.label}>Which payment?<span className={repKit.req} aria-hidden>*</span></span>
          <select id="undo-which" className={ck.select} value={pick} onChange={e => setPick(e.target.value)}>
            {received.map(x => <option key={x.id} value={x.id}>{ofN(x, bill)} · {money(x.due)} · received {day(x.received!.on)}</option>)}
          </select>
        </label>
      )}
      lead={<>The General ledger’s line is voided: it stays, marked void, with your reason. The installment is due again. {possessive(bill.teamName)} coaches see it on their Club page and are told.</>}
      placeholder="For example: the E-Transfer was returned by the bank"
      hint="The coaches read this. Undo only a payment that didn’t happen or went against the wrong team."
      missing="Say why the payment is being undone."
      confirmLabel="Undo the payment"
      busyLabel="Undoing…"
      failText="The payment couldn’t be undone."
      submit={reason => moneyMove(`/api/admin/accounting/allocations/${allocation.id}/installments/${i!.id}?${q}`, jsonInit('PATCH', { action: 'undo', reason }), {
        fallback: 'The payment couldn’t be undone. Please try again.',
        done: `The ${money(i!.due)} from ${bill.teamName} is undone. The installment is due again, and ${possessive(bill.teamName)} coaches are told why.`,
        codeWords: { unlinked: UNLINKED_PAYMENT },
      })}
      onClose={onClose}
      onDone={onDone}
    />
  );
}
