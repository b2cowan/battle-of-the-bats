'use client';
/**
 * A DEAL'S MONEY (Board Ready Stage 6 Part 3a; round 1 tab 7). Record a payment — "the ledger's Add an entry, cut down to
 * what a deal needs: the amount, the date, how it came, and its reference. The rest is known from the deal" — built from
 * the shipped ledger fields (MethodField, DayField, TextField) and its foot; a part payment is allowed and leaves the rest
 * owing. Void a payment — the shipped correction question (a required reason, Keep it, never red), as bills and requests
 * void theirs.
 * Part 3b (the card-refund drawing, RULED 2026-11-23): a payment's line opens the payment's own window; a card payment has
 * Refund at its foot (never Void), a cheque or e-transfer Void; the refund window is the shipped one, whole or part, never the fee.
 */
import { useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import { Callout, ClubSection, RepChip, repKit } from '../RepKit';
import { DayField, Facts, MethodField, ReasonQuestion, TextField } from '../money/MoneyKit';
import ck from '../ClubKit.module.css';
import { DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import { finishAsksOutcome, finishLeavesDeal, finishOwesAgain, owingBlock, nextCreditNumber, paymentHow, refundCounts, refundDay, refundedTotal, refundLeft, refundMadeOn, refundParts, refundReturnedTwice, refundTaxPart, refundToFinish, type DealPayment, type DealRefund } from '@/lib/club-sponsor-invoice';
import { cardLabel, money, REFUND_WORDS as RW_ROOT } from '@/lib/online-payment-words';
import { CARD_REFUND_WORDS } from '@/lib/house-league-money-words';
import { clockOf } from '@/lib/league-card-refunds';
import { formatStoredDate, orgDayKey } from '@/lib/timezone';
import { parsePrice } from '@/lib/club-sponsorships';
import type { DuesPaymentMethod } from '@/lib/types';
import { send } from './api';
import css from './Sponsorships.module.css';

const C = D.card;
/** The shipped "To the card" block's words (one wording for a refund everywhere). */
const RW = CARD_REFUND_WORDS.record;

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
        <MethodField id="deal-pay-how" label={D.deal.recordHow} value={method} onChange={setMethod} />
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
      followKeyboard
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

// ── Part 3b: a payment opens as its own window (the card-refund drawing's tab 1, ask 1) ─────────────────────────────────

// A refund made in Stripe that went back twice, or still to finish (Part A), wears amber like a failed one.
const tone = (r: DealRefund) => (r.status === 'failed' || refundReturnedTwice(r) || refundToFinish(r) ? 'warn' : r.status === 'pending' ? 'info' : 'good') as 'warn' | 'info' | 'good';
// "Refunded" says the money all went back; when some of it is still the club's, the chip says "Partly refunded".
const chip = (r: DealRefund, partly = false) => (refundReturnedTwice(r) ? C.chipReturnedTwice : refundToFinish(r) ? C.chipToFinish
  : r.status === 'failed' ? C.chipFailed : r.status === 'pending' ? C.chipPending : partly ? C.chipPartlyRefunded : C.chipRefunded);

/**
 * The payments under the money band (ask 1, RULED 2026-11-23): each row is a door that opens the payment's own window — a list
 * row holds no buttons, so Void moved into the window's foot. The row reads the day and how it came, what happened to it
 * since (recorded by, refunded, voided), the newest refund's chip, and the amount.
 */
export function DealPayments({ payments, refunds, onOpen }: {
  payments: readonly DealPayment[]; refunds: readonly DealRefund[]; onOpen: (p: DealPayment) => void;
}) {
  if (!payments.length) return null;
  return (
    <ClubSection id="payments-block" className={css.flushSection} title={D.deal.payments} list>
      <ul className={css.paymentList}>
        {payments.map(p => {
          const mine = refunds.filter(r => r.paymentId === p.id);
          const last = mine.at(-1);
          const back = refundedTotal(mine);
          // A payment that holds no money and was not refunded: the sponsor's bank took it back (a dispute the club lost, mig 532).
          const takenBack = p.returned && !p.voided && !mine.some(r => r.status === 'succeeded');
          // A refund made in Stripe (Part A): "Returned twice" when the bank already had it back, else "To finish" until the club
          // finishes it — whichever refund on the payment says it, the row's chip says it.
          const flagged = mine.find(refundReturnedTwice) ?? mine.find(refundToFinish) ?? last;
          const twice = !!flagged && refundReturnedTwice(flagged);
          const fromStripe = last?.origin === 'stripe';
          // The row's total says "in Stripe" only when every refund in it was made there.
          const allFromStripe = fromStripe && mine.filter(refundCounts).every(r => r.origin === 'stripe');
          const sub = p.voided ? D.deal.paymentVoided(p.voided.at, p.voided.byName, p.voided.reason)
            : takenBack ? C.lineTakenBack
            : twice ? C.lineReturnedTwice
            : last?.status === 'pending' ? (fromStripe ? C.lineRefundStripePending : C.lineRefundPending)(last.amount)
              : back > 0 && last ? (allFromStripe ? C.lineRefundedStripe(back, refundMadeOn(last)) : C.lineRefunded(back, refundDay(last)))
                : p.card ? C.lineSubCard : C.lineSubRecorded(p.recordedByName, orgDayKey(p.recordedAt));
          const how = paymentHow(p);
          return (
            <li key={p.id} className={p.voided ? css.paymentVoided : undefined}>
              <button type="button" className={css.paymentRow} aria-haspopup="dialog" aria-label={C.lineOpen(`${D.deal.paymentLine(p.receivedOn, how, p.amount)}`)} onClick={() => onOpen(p)}>
                <span className={css.paymentMain}>
                  <span className={css.paymentWhat}>{`${formatStoredDate(p.receivedOn, { withYear: false })} · ${how}`}</span>
                  <span className={ck.hint}>{sub}</span>
                </span>
                <span className={css.paymentEnd}>
                  {takenBack ? <RepChip tone="warn">{C.chipTakenBack}</RepChip>
                    : flagged && !p.voided && <RepChip tone={tone(flagged)}>{chip(flagged, refundLeft(p, refunds).left > 0)}</RepChip>}
                  <span className={css.money}>{money(p.amount)}</span>
                  <ChevronRight size={16} aria-hidden className={css.paymentChevron} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ClubSection>
  );
}

/** Stripe's reference with Copy (the shipped "To the card" block's control, cut down). */
function Reference({ value }: { value: string }) {
  const [said, setSaid] = useState(false);
  return (
    <span className={css.refLine}>
      <span className={css.refValue}>{value}</span>
      <button type="button" className={css.linkButton} onClick={async () => {
        try { await navigator.clipboard.writeText(value); setSaid(true); setTimeout(() => setSaid(false), 2000); } catch { /* the reference is on screen */ }
      }}>{said ? RW.copied : RW.copy}</button>
    </span>
  );
}

const withSub = (value: ReactNode, sub: string | null): ReactNode => (sub ? <>{value}<span className={css.factSub}>{sub}</span></> : value);

/**
 * THE PAYMENT'S WINDOW (520). A card payment: its amount and tax, when it was paid, the card, the processing fee and who paid
 * it, Stripe's reference, and each refund as the shipped "To the card" block; Refund at the foot's start while something is
 * left to give back. A cheque or e-transfer: amount, received, how, recorded by; Void at the foot's start (it was recorded by
 * mistake). A card payment is never voided: the money moved.
 */
export function PaymentWindow({ payment, refunds, deal, business, businessEmail, refundsOn, canVoid, creditHref, onClose, onRefund, onVoid, onFinish }: {
  payment: DealPayment; refunds: readonly DealRefund[]; deal: { number: string; taxKind: string | null };
  business: string; businessEmail: string | null; refundsOn: boolean; canVoid: boolean;
  creditHref: (refundId: string) => string; onClose: () => void; onRefund: () => void; onVoid: () => void;
  /** A refund made in Stripe to finish (Part A, tab 2): the oldest one waiting. */
  onFinish: (refund: DealRefund) => void;
}) {
  const p = payment;
  const kind = deal.taxKind ?? 'GST/HST';
  const mine = refunds.filter(r => r.paymentId === p.id).slice().reverse();
  const { left } = refundLeft(p, refunds);
  const day = (iso: string) => formatStoredDate(iso.length > 10 ? orgDayKey(iso) : iso, { withYear: false });
  const card = p.card;
  const rows = card ? [
    // A payment the bank took back (a dispute the club lost): the row said so; the window says it too, so a missing Refund has its reason.
    p.returned && !p.voided && !mine.some(r => r.status === 'succeeded') ? [C.chipTakenBack, C.lineTakenBack] as const : null,
    [C.amount, withSub(money(p.amount), p.taxPart > 0 ? C.ofItTax(kind, p.taxPart) : null)] as const,
    [C.paid, card.paidAt ? C.paidAt(orgDayKey(card.paidAt), clockOf(card.paidAt)) : day(p.receivedOn)] as const,
    [C.paidWithLabel, cardLabel(card.brand, card.last4)] as const,
    card.fee > 0 ? [C.fee, withSub(card.feePaidBy === 'sponsor' ? C.feeSponsor(card.feeCharged + card.feeTax, business) : C.feeClub(card.fee),
      card.feePaidBy === 'sponsor' ? C.feeBookSponsor : C.feeBookClub)] as const : null,
    card.reference ? [C.stripeRef, <Reference key="ref" value={card.reference} />] as const : null,
    [C.recorded, C.recordedByItself] as const,
  ] : [
    [C.amount, withSub(money(p.amount), p.taxPart > 0 ? C.ofItTax(kind, p.taxPart) : null)] as const,
    [C.received, day(p.receivedOn)] as const,
    [C.how, paymentHow(p)] as const,
    [C.recordedBy, C.recordedByValue(p.recordedByName, orgDayKey(p.recordedAt))] as const,
    p.note ? [C.note, p.note] as const : null,
    p.voided ? [C.voided, D.deal.paymentVoided(p.voided.at, p.voided.byName, p.voided.reason)] as const : null,
  ];
  const start = card
    ? (refundsOn && left > 0 && !p.returned && !card.disputed ? <button type="button" className="btn btn-outline" aria-haspopup="dialog" onClick={onRefund}>{C.refund}</button> : undefined)
    : (canVoid && !p.voided ? <button type="button" className="btn btn-outline" aria-haspopup="dialog" onClick={onVoid}>{D.deal.voidPayment}</button> : undefined);
  // Card refunds are switched off (the server refuses them too): say so, rather than a payment with no way back and no reason.
  // A dispute the sponsor opened stops a refund until it is decided (the server refuses it): said before the club types a reason (/ux 390, decision 1).
  const why = !card || left <= 0 || p.returned ? null : !refundsOn ? C.errRefundOff : card.disputed ? C.errDisputed : null;
  // A refund made in Stripe that went through and still needs the club (Part A): "Finish the refund" sits beside Refund. It never
  // reaches Stripe, so the launch switch and a dispute don't hide it. The oldest waiting one first (mine is newest first).
  const finishing = card ? mine.filter(refundToFinish).at(-1) ?? null : null;
  const finishButton = finishing
    ? <button type="button" className="btn btn-outline" aria-haspopup="dialog" onClick={() => onFinish(finishing)}>{C.finishButton}</button> : null;
  const startOrWhy = finishButton || start
    ? <>{finishButton}{start}</>
    : (why ? <span className={css.footLine}>{why}</span> : undefined);
  return (
    <KitDialog kind="form" onClose={onClose} eyebrow={C.windowEyebrow(deal.number)} title={C.windowTitle(business)}
      footerStart={startOrWhy}
      footer={<DialogCancel>{C.close}</DialogCancel>}>
      <Facts rows={rows} />
      {card && mine.map(r => {
        const reached = r.status === 'succeeded' && r.succeededAt;
        const stripe = r.origin === 'stripe';
        const toFinish = refundToFinish(r);
        const twice = refundReturnedTwice(r);
        // When the money left: Stripe's own moment for a refund made there, else when the club pressed Refund.
        const made = r.stripeCreatedAt ?? r.createdAt;
        const parts = refundParts(r);
        // The opening rows say who made it and why; the rest is the same for every refund (Part A, tab 2).
        const opening = stripe ? [
          [RW.amount, withSub(RW.amountValue(money(r.amount), cardLabel(card.brand, card.last4)),
            C.refundSplitStripe(parts.sponsorshipPre, parts.sponsorshipTax, kind, r.feePart, parts.feeTax))] as const,
          [C.madeInStripe, C.madeInStripeValue(orgDayKey(made), clockOf(made), stripeReasonWords(r.stripeReason))] as const,
          r.finished && r.reason ? [C.reason, r.reason] as const : null,
          r.finished ? [C.finishedLabel, C.finishedValue(r.finished.byName, orgDayKey(r.finished.at))] as const : null,
        ] : [
          [RW.amount, withSub(RW.amountValue(money(r.amount), cardLabel(card.brand, card.last4)), C.refundSplit(parts.sponsorshipPre, parts.sponsorshipTax, kind))] as const,
          [C.reason, r.reason ?? ''] as const,
          [RW.by, RW.byValue(r.createdByName ?? '', day(r.createdAt), clockOf(r.createdAt))] as const,
          reached ? [RW.reached(false), withSub(RW.reachedValue(day(r.succeededAt!), clockOf(r.succeededAt)), C.reachedSub)] as const : null,
        ];
        const facts = [
          ...opening,
          r.status === 'pending' ? [RW.status, C.statusPending(orgDayKey(r.createdAt), clockOf(r.createdAt))] as const : null,
          twice ? [RW.what, C.lineReturnedTwice] as const : null,
          // A refund the card company refused before it booked moved nothing: only one that booked and then bounced has voided lines.
          r.status === 'failed' ? [RW.what, r.booked ? C.whatFailed(orgDayKey(made), orgDayKey(r.failedAt ?? r.createdAt)) : C.failedBody] as const : null,
          r.stripeRefundId ? [RW.ref, <Reference key="ref" value={r.stripeRefundId} />] as const : null,
          r.creditNumber && r.status === 'succeeded'
            ? [C.creditNoteLabel, <a key="cn" className={`${css.inlineLink} ${css.touchLink}`} href={creditHref(r.id)} download>{C.creditNoteValue(r.creditNumber)}</a>] as const
            : toFinish && deal.taxKind && !mine.some(x => x.finished?.outcome === 'owing') ? [C.creditNoteLabel, C.notYet] as const : null,
          toFinish ? [C.businessEmailed, C.notYet] as const
            : r.status === 'succeeded' && !twice ? [C.businessEmailed, r.emailedAt && businessEmail ? C.emailedValue(businessEmail, orgDayKey(r.emailedAt)) : C.notEmailed] as const : null,
        ];
        return (
          <section key={r.id} className={css.refundBlock} aria-label={RW.heading(false)}>
            <h3 className={css.refundHead}><span>{RW.heading(false)}</span><RepChip tone={tone(r)}>{chip(r)}</RepChip></h3>
            <Facts rows={facts} />
          </section>
        );
      })}
    </KitDialog>
  );
}

/** Stripe's reason code in words ("requested_by_customer" → "requested by the customer"); a code we don't know is shown as Stripe sent it. */
function stripeReasonWords(code: string | null): string | null {
  if (!code) return null;
  return (C.stripeReasons as Record<string, string>)[code] ?? code.replace(/_/g, ' ');
}

/**
 * FINISH A REFUND MADE IN STRIPE (Part A, tab 2; the shipped refund question's shape, raised over the payment's window). Stripe's
 * amount and day are fixed; the club writes the reason the business reads. On the last of the deal's money it first asks what
 * happens to the deal ("It has ended" or "They still owe it"), nothing picked, no button until it is chosen.
 */
export function FinishRefundQuestion({ url, refund, payments, refunds, dealState, total, cardFee, number, taxed, taxKind, business, businessEmail, clubCanEmail, onClose, onStale, onDone }: {
  url: string; refund: DealRefund; payments: readonly DealPayment[]; refunds: readonly DealRefund[]; dealState: string;
  /** The invoice's total: whether the money left standing still covers it. */
  total: number;
  /** The processing fee the sponsor paid by card, with its tax (0 when the invoice carries none). */
  cardFee: number;
  number: string; taxed: boolean; taxKind: string | null; business: string; businessEmail: string | null;
  /** The club has a mailing address and a contact for sponsors: without them no refund email can go. */
  clubCanEmail: boolean; onClose: () => void;
  /** The refund or the deal moved since this opened (finished elsewhere, or another refund changed the question): re-read and say so. */
  onStale: (text: string) => Promise<void>;
  onDone: (r: { endsDeal: boolean; owingAgain: boolean; emailedTo: string | null }) => Promise<void>;
}) {
  const asks = finishAsksOutcome(payments, refunds, refund, dealState);
  const payment = payments.find(x => x.id === refund.paymentId);
  const card = payment?.card ? cardLabel(payment.card.brand, payment.card.last4) : '';
  const kind = taxKind ?? 'GST/HST';
  const [outcome, setOutcome] = useState<'ended' | 'owing' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field: boolean } | null>(null);
  const on = refundMadeOn(refund);
  const parts = refundParts(refund);
  // "All of the payment" only when this one refund is all of it: the last of several says its own part.
  const all = !!payment && parts.sponsorship >= refundLeft(payment, []).refundable;
  // No fee in it, so the sponsorship's parts are the refund's (amount less its tax); a fee that went back is named.
  const lead = refund.feePart > 0
    ? (parts.sponsorship > 0 ? C.finishLeadFee(refund.amount, card, on, parts.sponsorship, refund.feePart, refund.taxPart > 0) : C.finishLeadFeeOnly(refund.amount, card, on))
    : (all ? C.finishLeadAll : C.finishLeadPart)(refund.amount, card, on, parts.sponsorshipPre, parts.sponsorshipTax, kind);
  // "They still owe it" waits for the whole payment, fee included, to be back, and money owed again gets no credit note.
  const owingOff = asks ? owingBlock(payments, refunds, refund) : null;
  const owesAgain = finishOwesAgain(payments, refunds, refund, dealState, total, outcome);
  const note = owesAgain ? null : nextCreditNumber(number, taxed, refunds);
  const emailed = !!businessEmail && clubCanEmail;
  const ready = !asks || !!outcome;

  async function go() {
    setError(null);
    if (asks && !outcome) { setError({ text: C.errOutcome, field: true }); return; }
    if (!reason.trim()) { setError({ text: C.finishErrReason, field: true }); return; }
    setBusy(true);
    const r = await send<{ endsDeal: boolean; owingAgain: boolean; emailedTo: string | null }>(url, 'POST', { reason: reason.trim(), ...(asks ? { outcome } : {}) });
    setBusy(false);
    if (!r.ok) {
      // 'outcome' on a window that asked nothing: another refund or payment made this the last money since it opened.
      if (r.code === 'already' || r.code === 'nothing' || r.code === 'outcome_changed' || r.code === 'not_found' || (r.code === 'outcome' && !asks)) {
        await onStale(r.code === 'outcome' ? C.errOutcomeChanged : r.error); return;
      }
      setError({ text: r.error, field: r.code === 'reason' || r.code === 'outcome' });
      return;
    }
    await onDone(r.data);
  }

  return (
    <KitDialog kind="question" raised followKeyboard busy={busy} dirty={!!reason.trim() || !!outcome} onClose={onClose} title={C.finishAsk(business)}
      footerStart={!ready ? <span className={css.footLine}>{C.chooseFirst}</span> : !emailed ? <span className={css.footLine}>{businessEmail ? C.footClubCantEmail : C.footNoEmail}</span> : undefined}
      footer={<>
        <DialogCancel />
        {ready && (
          <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void go()}>
            {busy ? C.finishWorking : outcome === 'ended' ? C.buttonFinishEnd(emailed) : C.buttonFinish(emailed)}
          </button>
        )}
      </>}>
      <p className={ck.hint}>{lead}</p>
      {refund.feePart > 0 && <p className={ck.hint}>{C.finishFeeBack}</p>}
      {!asks && <p className={ck.hint}>{C.finishPartBody(business, note, emailed, finishLeavesDeal(payments, refunds, refund, dealState, total))}</p>}
      {asks && (
        <fieldset className={css.refundChoice}>
          <legend className={repKit.srOnly}>{C.chooseFirst}</legend>
          <label className={css.choiceRow}>
            <input type="radio" name="deal-finish" checked={outcome === 'ended'} onChange={() => setOutcome('ended')} />
            <span>
              <span className={css.choiceName}>{C.choiceEnded}</span>
              <span className={ck.hint}>{C.choiceEndedSub}</span>
            </span>
          </label>
          {!owingOff && (
            <label className={css.choiceRow}>
              <input type="radio" name="deal-finish" checked={outcome === 'owing'} onChange={() => setOutcome('owing')} />
              <span>
                <span className={css.choiceName}>{C.choiceOwing}</span>
                <span className={ck.hint}>{C.choiceOwingSub(taxed, cardFee > 0 ? { total, fee: cardFee } : null)}</span>
              </span>
            </label>
          )}
          {owingOff && <p className={ck.hint}>{owingOff.why === 'fee' ? C.owingNeedsFee(owingOff.left) : C.owingNoted}</p>}
        </fieldset>
      )}
      {ready && (
        <TextField id="deal-finish-reason" label={C.reason} required value={reason} onChange={setReason} maxLength={300} hint={C.reasonHint(business)} />
      )}
      <QuestionError error={error} />
    </KitDialog>
  );
}

/** A money question's error (the refund window's and the finish question's): red only for a field the club got wrong; trouble it
 *  cannot fix by typing (the card company refused, a dispute, a failed send) wears the amber callout every refund-trouble line wears. */
function QuestionError({ error }: { error: { text: string; field: boolean } | null }) {
  if (!error) return null;
  return error.field
    ? <p className={css.error} role="alert">{error.text}</p>
    : <Callout tone="warn" role="alert" flush icon={<AlertTriangle size={16} aria-hidden />}>{error.text}</Callout>;
}

/**
 * THE REFUND WINDOW (520; the card-refund drawing's tab 2, RULED 2026-11-23). It opens over the payment's window with nothing
 * picked and no button until the club chooses — a refund is money leaving the club. All of it (what is left) or part of it
 * with an amount; a reason either way, which the business reads in the refund email. Never a fee box: a sponsorship refund
 * never returns the fee. When all of it would give back the last of the deal's money, the window says the deal ends.
 */
export function RefundWindow({ url, payment, refunds, endsDeal, number, taxKind, business, businessEmail, place, onClose, onStale, onDone }: {
  url: string; payment: DealPayment; refunds: readonly DealRefund[]; endsDeal: boolean; number: string; taxKind: string | null; business: string;
  businessEmail: string | null; place: string | null; onClose: () => void;
  /** Nothing is left to give back now (another window refunded it): the page re-reads and says so, rather than leaving a stale amount. */
  onStale: (text: string) => Promise<void>;
  onDone: (r: { state: 'succeeded' | 'pending' | 'failed'; amount: number; endsDeal: boolean; emailedTo: string | null; message?: string }) => Promise<void>;
}) {
  const p = payment;
  const card = p.card!;
  const { refundable, left } = refundLeft(p, refunds);
  const already = Math.round((refundable - left) * 100) / 100;
  const [choice, setChoice] = useState<'all' | 'part' | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  // Red only for a field the club got wrong (the reason, the amount); trouble it cannot fix by typing (the card company refused,
  // the sponsor disputed it, a failed send) wears the amber callout every other refund-trouble line wears (/ux 390, decision 4).
  const [error, setError] = useState<{ text: string; field: boolean } | null>(null);
  const typed = parsePrice(amount);
  const partOk = typed != null && typed > 0 && Math.round(typed * 100) <= Math.round(left * 100);
  const tax = partOk ? refundTaxPart(p, refunds, typed!) : 0;
  // "Part of it" for exactly what is left gives back the last of the deal's money, and the database ends the deal as it does for "All of it".
  const partEnds = endsDeal && choice === 'part' && partOk && Math.round(typed! * 100) === Math.round(left * 100);
  const label = cardLabel(card.brand, card.last4);
  const sponsorFee = card.feePaidBy === 'sponsor';
  const lead = sponsorFee
    ? C.refundLeadSponsor(p.amount, p.receivedOn, number, refundable, card.feeCharged + card.feeTax, left)
    : C.refundLeadClub(p.amount, p.receivedOn, number, card.fee);

  async function go() {
    setError(null);
    if (choice === 'part' && !partOk) { setError({ text: C.errAmount(left), field: true }); return; }
    if (!reason.trim()) { setError({ text: C.errReason, field: true }); return; }
    setBusy(true);
    const r = await send<{ state: 'succeeded' | 'pending' | 'failed'; amount: number; endsDeal: boolean; emailedTo: string | null; message?: string }>(
      url, 'POST', choice === 'all' ? { all: true, reason: reason.trim() } : { amount: typed, reason: reason.trim() });
    setBusy(false);
    if (!r.ok) {
      if (r.code === 'nothing_left') { await onStale(r.error); return; }
      setError({ text: r.error, field: r.code === 'reason' || r.code === 'amount' });
      return;
    }
    if (r.data.state === 'failed') { setError({ text: C.failedBody, field: false }); return; }
    await onDone(r.data);
  }

  return (
    <KitDialog kind="question" raised followKeyboard busy={busy} dirty={!!reason.trim() || !!amount.trim()} onClose={onClose} title={C.refundAsk(business)}
      footerStart={choice && businessEmail ? undefined : <span className={css.footLine}>{choice ? C.footNoEmail : RW_ROOT.footChoose}</span>}
      footer={<>
        <DialogCancel />
        {choice && (
          <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void go()}>
            {/* "Part of it" names money only once a valid amount is typed: before that the neutral word, never the whole remainder (/ux 390, decision 2). */}
            {busy ? RW_ROOT.working : choice === 'all' ? (endsDeal ? C.buttonEnd : C.buttonAll(left)) : partEnds ? C.buttonEnd : partOk ? C.buttonAll(typed!) : RW_ROOT.button}
          </button>
        )}
      </>}>
      <p className={ck.hint}>{lead}{already > 0 ? ` ${C.refundLeadAgain(already, left)}` : ''}</p>
      <p className={ck.hint}>{C.refundTarget(label)}</p>
      <fieldset className={css.refundChoice}>
        <legend className={repKit.srOnly}>{C.refundAsk(business)}</legend>
        <label className={css.choiceRow}>
          <input type="radio" name="deal-refund" checked={choice === 'all'} onChange={() => setChoice('all')} />
          <span>
            <span className={css.choiceName}>{C.choiceAll}</span>
            <span className={ck.hint}>{C.allBack(left)}</span>
          </span>
        </label>
        {choice === 'all' && endsDeal && <p className={css.choiceNote}>{place ? C.endsDeal(place) : C.endsDealClub}</p>}
        <label className={css.choiceRow}>
          <input type="radio" name="deal-refund" checked={choice === 'part'} onChange={() => setChoice('part')} />
          <span>
            <span className={css.choiceName}>{RW_ROOT.choicePart}</span>
            <span className={ck.hint}>{RW_ROOT.choicePartSub(money(left))}</span>
          </span>
        </label>
      </fieldset>
      {choice === 'part' && (
        <TextField id="deal-refund-amount" label={RW_ROOT.partAmount} required value={amount} onChange={setAmount} maxLength={12}
          hint={partOk ? C.partRest(Math.round((p.amount - already - typed!) * 100) / 100, tax, typed!, taxKind ?? 'GST/HST') : RW_ROOT.partLimit(money(left))} />
      )}
      {partEnds && <p className={css.choiceNote}>{place ? C.endsDeal(place) : C.endsDealClub}</p>}
      {choice && (
        <TextField id="deal-refund-reason" label={C.reason} required value={reason} onChange={setReason} maxLength={300} hint={C.reasonHint(business)} />
      )}
      <QuestionError error={error} />
    </KitDialog>
  );
}
