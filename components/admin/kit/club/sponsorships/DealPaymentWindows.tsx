'use client';
/**
 * A DEAL'S MONEY (Board Ready Stage 6 Part 3a; round 1 tab 7). Record a payment — "the ledger's Add an entry, cut down to
 * what a deal needs: the amount, the date, how it came, and its reference. The rest is known from the deal" — built from
 * the shipped ledger fields (MethodField, DayField, TextField) and its foot; a part payment is allowed and leaves the rest
 * owing. Void a payment — the shipped correction question (a required reason, Keep it, never red), as bills and requests
 * void theirs.
 */
import { useState } from 'react';
import KitDialog, { DialogCancel } from '../KitDialog';
import { ClubSection } from '../RepKit';
import { DayField, MethodField, ReasonQuestion, TextField } from '../money/MoneyKit';
import ck from '../ClubKit.module.css';
import { DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import { DEAL_METHOD_LABEL, paymentHow, type DealPayment } from '@/lib/club-sponsor-invoice';
import { parsePrice } from '@/lib/club-sponsorships';
import type { DuesPaymentMethod } from '@/lib/types';
import { send } from './api';
import css from './Sponsorships.module.css';

export function RecordPaymentWindow({ url, business, number, owing, today, onClose, onRecorded, onStale }: {
  /** The deal's payments route. */
  url: string;
  business: string;
  number: string;
  owing: number;
  today: string;
  onClose: () => void;
  onRecorded: (r: { state: string; receipt: 'emailed' | 'not_emailed' | null }) => Promise<void>;
  /** The invoice has nothing owing now (another window paid it): the page re-reads and says so, rather than leaving a stale amount. */
  onStale: (text: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(owing.toFixed(2));
  const [on, setOn] = useState(today);
  const [method, setMethod] = useState<DuesPaymentMethod | ''>('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setError(null);
    const n = parsePrice(amount);
    if (n == null || n <= 0 || Math.round(n * 100) > Math.round(owing * 100)) { setError(D.deal.errRecordAmount(owing)); return; }
    if (!on || on > today) { setError(D.deal.errRecordDate); return; }
    if (!method) { setError(D.deal.errRecordHow); return; }
    setBusy(true);
    const r = await send<{ state: string; receipt: 'emailed' | 'not_emailed' | null }>(url, 'POST', { amount: n, receivedOn: on, method, reference, note });
    setBusy(false);
    if (!r.ok) {
      if (r.code === 'not_owing') { await onStale(r.error); return; }
      setError(r.error);
      return;
    }
    await onRecorded(r.data);
  }

  return (
    <KitDialog kind="form" busy={busy} onClose={onClose} eyebrow={D.deal.recordEyebrow(business, number)} title={D.deal.recordTitle}
      dirty={amount !== owing.toFixed(2) || on !== today || !!method || !!reference.trim() || !!note.trim()}
      footerStart={<span className={css.footLine}>{D.deal.recordFoot}</span>}
      footer={<><DialogCancel /><button type="button" className="btn btn-lime" disabled={busy} onClick={() => void record()}>{busy ? D.deal.recording : D.deal.recordButton}</button></>}>
      <div className={css.form}>
        <TextField id="deal-pay-amount" label={D.deal.recordAmount} required value={amount} onChange={setAmount} hint={D.deal.recordOwing(owing)} maxLength={12} />
        <DayField id="deal-pay-on" label={D.deal.recordDate} value={on} max={today} onChange={setOn} />
        <MethodField id="deal-pay-how" label={D.deal.recordHow} value={method} onChange={setMethod} labels={DEAL_METHOD_LABEL} />
        <TextField id="deal-pay-ref" label={D.deal.recordRef} value={reference} onChange={setReference} hint={D.deal.recordRefHint} maxLength={60} />
        <TextField id="deal-pay-note" label={D.deal.recordNote} value={note} onChange={setNote} maxLength={300} />
        {error && <p className={css.error} role="alert">{error}</p>}
      </div>
    </KitDialog>
  );
}

export function VoidPaymentQuestion({ url, payment, onClose, onVoided }: {
  url: string; payment: DealPayment; onClose: () => void;
  /** `keepOpen` when the answer was a refusal the club must read (the window stays up with the sentence). */
  onVoided: (keepOpen: boolean) => Promise<void>;
}) {
  return (
    <ReasonQuestion
      title={D.deal.voidAsk(payment.amount)}
      lead={D.deal.voidBody}
      label={D.deal.voidReason}
      missing={D.deal.errReason}
      confirmLabel={D.deal.voidButton}
      busyLabel={D.deal.voiding}
      failText={D.deal.voidFailed}
      submit={async reason => {
        const r = await send(url, 'POST', { reason });
        // Only "already voided" re-reads (and keeps the window up with its sentence); a closed fiscal year or a lost
        // connection is said in the window, which stays open for the club to read it.
        return r.ok ? { ok: true, text: '' } : { ok: false, error: r.error, stale: r.code === 'already_void' };
      }}
      onClose={onClose}
      onDone={(_text, keepOpen) => void onVoided(!!keepOpen)} />
  );
}

/** The payments under the money band: each with how it came, and Void; a voided one keeps its line, struck through. */
export function DealPayments({ payments, canVoid, onVoid }: {
  payments: readonly DealPayment[]; canVoid: boolean; onVoid: (p: DealPayment) => void;
}) {
  if (!payments.length) return null;
  return (
    <ClubSection id="payments-block" className={css.flushSection} title={D.deal.payments}>
      <ul className={css.paymentList}>
        {payments.map(p => (
          <li key={p.id} className={p.voided ? css.paymentVoided : undefined}>
            <span>{D.deal.paymentLine(p.receivedOn, paymentHow(p), p.amount)}</span>
            {p.voided
              ? <span className={ck.hint}>{D.deal.paymentVoided(p.voided.at, p.voided.byName, p.voided.reason)}</span>
              : canVoid && <button type="button" className={css.linkButton} aria-haspopup="dialog" onClick={() => onVoid(p)}>{D.deal.voidPayment}</button>}
          </li>
        ))}
      </ul>
    </ClubSection>
  );
}

