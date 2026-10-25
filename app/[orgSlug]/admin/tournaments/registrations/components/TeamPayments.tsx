'use client';
/**
 * A TEAM'S PAYMENTS — the list inside the record's Payment section (mig 345; drawn and ruled 2026-10-21,
 * TEAM_PAYMENTS_LIST_PLAN.md, mockup TEAM_PAYMENTS_LIST_MOCKUP.html).
 *
 *   Received    one row per payment: the day it arrived, its label, how, the amount, an "In ledger" chip on a plan with
 *               Accounting, a pencil. The pencil opens the row to change it or remove it.
 *   Still due   the deposit's and the balance's shortfall, from the fee and the SUM received. Record opens a form in place,
 *               filled with that amount and today. "+ Record a different amount" is for installments and odd amounts.
 *
 * A payment is a CREATED record, so it asks: nothing is saved or posted until Record is pressed (create asks, edit autosaves).
 * Changing a recorded payment asks too (a Save change button) — a change on an Accounting plan voids a ledger line and posts a
 * corrected one, so saving as you type would bring back one line per keystroke. Remove asks first and says what happens to the
 * line. The summary line and "Mark paid" are the record's own, above this; the paid figures are never typed.
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { TEAM_ROW_WORDS as OW, REFUND_WORDS as RW, money, receiptLabel } from '@/lib/online-payment-words';
import { PaymentViewWindow, RefundWindow } from './OnlinePaymentWindows';
import { RepChip } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { TEAM_PAYMENT_WORDS as W } from '@/lib/registration-words';
import {
  PAYMENT_METHODS, draftIssue, formatPaymentMoney, labelForDue, paymentDay, receivedOrder, stillDue,
  type DueRow, type PaymentMethod, type TeamOnlinePayment, type TeamPayment,
} from '@/lib/team-payments';
import { formatStoredDate } from '@/lib/timezone';
import type { FeeSchedule } from '@/lib/tournament-teams';
import styles from '../teams-admin.module.css';

interface Props {
  teamId: string;
  tournamentId: string;
  /** `?orgSlug=…` as the page builds it (empty for a single-org caller). */
  orgQuery: string;
  fee: FeeSchedule;
  today: string;
  /** May this person record, change and remove? False on a plan that only reads payments, and on a locked event. */
  canRecord: boolean;
  /** What the team's cached total says, used until the list has loaded. */
  paidTotal: number;
  /** The page re-reads its teams (the summary line and the list's rows follow the cached figures). */
  onChanged: () => Promise<void>;
  /** Something else on the record is working (Mark paid, Accept…): no payment control is live meanwhile. */
  busy?: boolean;
  /** A Record or change form is open: the window asks before it closes over typed work (KitDialog `dirty`). */
  onFormOpen?: (open: boolean) => void;
  /** The team's name, for the refund window's title (Club Tier Stage 12a). */
  teamName?: string;
}

/** Online payments on this record (Club Tier Stage 12a): may the pay link go out, when it last did, may a card be refunded. */
type OnlineInfo = { payLink: boolean; payLinkSentAt: string | null; refunds: boolean };

/** What a team has paid: posted rows only — a row refunded to the card stays on the record but never counts. */
const sumPaid = (list: TeamPayment[]) => list.reduce((s, p) => s + (p.status === 'refunded' ? 0 : p.amount), 0);

type Draft = { amount: string; paidOn: string; how: '' | PaymentMethod; error: string; saving: boolean };
type RecordForm = Draft & { key: DueRow['key'] | 'other' };

const toMethod = (v: string): '' | PaymentMethod => ((PAYMENT_METHODS as readonly string[]).includes(v) ? (v as PaymentMethod) : '');
const amountText = (n: number) => String(Math.round(n * 100) / 100);

export default function TeamPayments(props: Props) {
  const { teamId, tournamentId, orgQuery, fee, today, canRecord, paidTotal, onChanged, busy = false, onFormOpen, teamName = '' } = props;
  const uid = useId();
  const [payments, setPayments] = useState<TeamPayment[] | null>(null);
  const [postsToBook, setPostsToBook] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<RecordForm | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [asking, setAsking] = useState(false);
  const [online, setOnline] = useState<OnlineInfo | null>(null);
  const [viewing, setViewing] = useState<TeamOnlinePayment | null>(null);
  const [refunding, setRefunding] = useState<{ p: TeamOnlinePayment; anotherWay: boolean } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const base = `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations/payments`;
  const orgParam = orgQuery ? orgQuery.replace(/^\?/, '&') : '';

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await fetch(`${base}?teamId=${encodeURIComponent(teamId)}${orgParam}`, { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'load');
      setPayments(data.payments as TeamPayment[]);
      setPostsToBook(data.postsToBook === true);
      setOnline((data.online as OnlineInfo | undefined) ?? null);
    } catch {
      setLoadFailed(true);
    }
  }, [base, teamId, orgParam]);

  useEffect(() => { void load(); }, [load]);

  const paid = useMemo(() => (payments ? sumPaid(payments) : paidTotal), [payments, paidTotal]);
  const due = useMemo(() => stillDue(fee, paid), [fee, paid]);

  // The team's cached total moved without this list's own write (Mark paid, a bulk action, another screen): the list is
  // stale, and its Still due rows would offer to record money already received. The cache is the sum of the posted
  // payments, so any gap means "read again" — and once read, the two agree and this stops.
  useEffect(() => {
    if (payments && Math.abs(sumPaid(payments) - paidTotal) > 0.004) void load();
  }, [paidTotal, payments, load]);

  // The window asks before it closes over a form with typed work in it.
  const formOpen = form !== null || editId !== null;
  useEffect(() => { onFormOpen?.(formOpen); }, [formOpen, onFormOpen]);
  useEffect(() => () => onFormOpen?.(false), [onFormOpen]);

  // Nothing else is live while a write is in flight, the list is still loading, or the record is doing something else.
  const locked = busy || payments === null || Boolean(form?.saving) || Boolean(edit?.saving);

  /** One write: send it, say why in the form if it fails; on success the form closes at once (`done`), then the list and the
   *  page are re-read. */
  async function send(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>, fail: (message: string) => void, done: () => void): Promise<void> {
    try {
      const res = await fetch(`${base}${orgQuery}`, {
        method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { fail(typeof data.error === 'string' ? data.error : 'Couldn’t save the payment. Try again.'); return; }
    } catch {
      fail('Couldn’t save the payment. Try again.');
      return;
    }
    done();
    await Promise.all([load(), onChanged()]);
  }

  const issueText = (amount: number, paidOn: string) => {
    const issue = draftIssue(amount, paidOn, today);
    return issue === 'amount' ? W.amountError : issue === 'date' ? W.dateError : issue === 'future' ? W.futureError : '';
  };

  function openRecord(key: RecordForm['key']) {
    const row = due.find(d => d.key === key) ?? null;
    setEditId(null); setEdit(null); setAsking(false);
    setForm({ key, amount: amountText(row ? row.amount : Math.max(0, (fee.totalFeeAmount ?? 0) - paid)), paidOn: today, how: '', error: '', saving: false });
  }

  async function submitRecord() {
    if (!form) return;
    const amount = parseFloat(form.amount);
    const problem = issueText(amount, form.paidOn);
    if (problem) { setForm({ ...form, error: problem }); return; }
    const row = due.find(d => d.key === form.key) ?? null;
    setForm({ ...form, error: '', saving: true });
    await send('POST', { teamId, amount, paidOn: form.paidOn, label: labelForDue(row), method: form.how || null },
      message => setForm(f => (f ? { ...f, error: message, saving: false } : f)),
      () => setForm(null));
  }

  function openEdit(p: TeamPayment) {
    setForm(null); setAsking(false);
    setEditId(p.id);
    // An "Earlier payment" has no day: the field starts empty and required, never silently today (a saved date would
    // move an old receipt into the current period).
    setEdit({ amount: amountText(p.amount), paidOn: p.paidOn ?? '', how: p.method ?? '', error: '', saving: false });
  }

  async function submitEdit(p: TeamPayment) {
    if (!edit) return;
    const amount = parseFloat(edit.amount);
    const problem = issueText(amount, edit.paidOn);
    if (problem) { setEdit({ ...edit, error: problem }); return; }
    setEdit({ ...edit, error: '', saving: true });
    await send('PATCH', { paymentId: p.id, amount, paidOn: edit.paidOn, method: edit.how || null },
      message => setEdit(e => (e ? { ...e, error: message, saving: false } : e)),
      () => { setEditId(null); setEdit(null); });
  }

  async function submitRemove(p: TeamPayment) {
    if (!edit) return;
    setEdit({ ...edit, error: '', saving: true });
    await send('DELETE', { paymentId: p.id },
      message => setEdit(e => (e ? { ...e, error: message, saving: false } : e)),
      () => { setEditId(null); setEdit(null); setAsking(false); });
  }

  const onlineBase = `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations/online-payments${orgQuery}`;
  /** An online door (Club Tier Stage 12a): the refusal's words, or null when it went through. */
  async function onlineSend(body: Record<string, unknown>): Promise<{ error: string | null; data: Record<string, unknown> }> {
    try {
      const res = await fetch(onlineBase, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: typeof data.error === 'string' ? data.error : RW.failed, data };
      return { error: null, data };
    } catch {
      return { error: RW.failed, data: {} };
    }
  }

  async function emailPayLink() {
    setFlash(null);
    const { error, data } = await onlineSend({ action: 'email_pay_link', teamId });
    setFlash(error ? OW.linkFailedToast : OW.linkSentToast(String(data.sentTo ?? '')));
    if (!error) setOnline(o => (o ? { ...o, payLinkSentAt: String(data.sentAt ?? new Date().toISOString()) } : o));
  }

  async function refund(body: { feeIncluded: boolean; reason: 'organizer_ended' | 'team_left' | null; note: string | null }): Promise<string | null> {
    if (!refunding) return null;
    const { p, anotherWay } = refunding;
    const { error, data } = await onlineSend({ action: anotherWay ? 'refund_another_way' : 'refund', onlinePaymentId: p.id, ...body });
    if (error) return error;
    const back = body.feeIncluded ? p.totalCents : p.baseCents;
    setRefunding(null);
    setFlash(anotherWay ? RW.recordedToast : data.state === 'pending' ? RW.pendingToast : RW.doneToast(money(back / 100), p.payerEmail));
    await Promise.all([load(), onChanged()]);
    return null;
  }

  const hint = postsToBook ? W.hintBook : W.hintTeamOnly;

  const fields = (d: Draft, set: (next: Draft) => void, prefix: string) => (
    <div className={styles.payFormGrid}>
      <div className={ck.field}>
        <label className={ck.label} htmlFor={`${uid}-${prefix}-amount`}>{W.amount}<span className={ck.required} aria-hidden>*</span></label>
        <input id={`${uid}-${prefix}-amount`} className={ck.input} type="number" inputMode="decimal" min="0" step="0.01" autoFocus
          aria-required="true" aria-describedby={d.error ? `${uid}-${prefix}-error` : undefined}
          value={d.amount} onChange={e => set({ ...d, amount: e.target.value })} />
      </div>
      <div className={ck.field}>
        <label className={ck.label} htmlFor={`${uid}-${prefix}-date`}>{W.paidOn}<span className={ck.required} aria-hidden>*</span></label>
        <input id={`${uid}-${prefix}-date`} className={ck.input} type="date" max={today} aria-required="true"
          value={d.paidOn} onChange={e => set({ ...d, paidOn: e.target.value })} />
      </div>
      <div className={`${ck.field} ${styles.payHowField}`}>
        <label className={ck.label} htmlFor={`${uid}-${prefix}-how`}>{W.how}</label>
        <select id={`${uid}-${prefix}-how`} className={ck.select} value={d.how} onChange={e => set({ ...d, how: toMethod(e.target.value) })}>
          <option value="">{W.howNone}</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{W.methods[m]}</option>)}
        </select>
      </div>
    </div>
  );

  // The forms are real forms, so Enter in a field records (Cancel and Remove are `type="button"`).
  const recordForm = form && (
    <form className={styles.payForm} aria-label={W.recordTitle(form.key === 'other' ? null : (due.find(d => d.key === form.key)?.label ?? null))}
      onSubmit={e => { e.preventDefault(); void submitRecord(); }}>
      <p className={styles.payFormTitle}>{W.recordTitle(form.key === 'other' ? null : (due.find(d => d.key === form.key)?.label ?? null))}</p>
      {fields(form, next => setForm({ ...form, ...next, key: form.key }), 'rec')}
      <p className={styles.payHint}>{hint}</p>
      {form.error && <p id={`${uid}-rec-error`} className={styles.payErr} role="alert">{form.error}</p>}
      <div className={styles.payActs}>
        <button type="submit" className="btn btn-lime" disabled={form.saving}>{W.record}</button>
        <button type="button" className={screenParts.plainButton} onClick={() => setForm(null)} disabled={form.saving}>{W.cancel}</button>
      </div>
    </form>
  );

  const editBlock = (p: TeamPayment) => edit && (
    <form className={styles.payForm} aria-label={W.changeTitle} onSubmit={e => { e.preventDefault(); void submitEdit(p); }}>
      <p className={styles.payFormTitle}>{W.changeTitle}</p>
      {fields(edit, setEdit, 'chg')}
      {p.inLedger && <p className={styles.payHint}>{W.changeHintBook}</p>}
      {edit.error && <p id={`${uid}-chg-error`} className={styles.payErr} role="alert">{edit.error}</p>}
      <div className={styles.payActs}>
        <button type="submit" className="btn btn-lime" disabled={edit.saving}>{W.saveChange}</button>
        <button type="button" className={screenParts.plainButton} onClick={() => { setEditId(null); setEdit(null); setAsking(false); }} disabled={edit.saving}>{W.cancel}</button>
      </div>
      {asking ? (
        <div className={styles.payAsk}>
          <p className={styles.payFormTitle}>{W.removeAsk(formatPaymentMoney(p.amount))}</p>
          <p className={styles.payHint}>{p.inLedger ? W.removeBodyBook : W.removeBody(formatPaymentMoney(p.amount))}</p>
          <div className={styles.payActs}>
            <button type="button" className={`${screenParts.plainButton} ${styles.payDanger}`} onClick={() => void submitRemove(p)} disabled={edit.saving}>{W.removeConfirm}</button>
            <button type="button" className={screenParts.plainButton} onClick={() => setAsking(false)} disabled={edit.saving}>{W.keep}</button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.payRemove} onClick={() => setAsking(true)} disabled={edit.saving}>
          <Trash2 size={13} aria-hidden /> {W.removeLink}
        </button>
      )}
    </form>
  );

  const rows = payments ? receivedOrder(payments) : [];

  return (
    <>
      {payments === null && !loadFailed && <p className={screenParts.recordText}>{W.loading}</p>}
      {loadFailed && (
        <p className={styles.payErr} role="alert">
          {W.loadError} <button type="button" className={styles.inlineLink} onClick={() => void load()}>{W.retry}</button>
        </p>
      )}

      {rows.length > 0 && (
        <>
          <h4 className={styles.paySub}>{W.received}</h4>
          <div className={styles.payRows}>
            {rows.map(p => (editId === p.id ? <div key={p.id}>{editBlock(p)}</div> : (
              <div key={p.id} className={`${styles.payRow}${p.status === 'refunded' ? ` ${styles.payRefunded}` : ''}`}>
                <span className={styles.payDate}>{paymentDay(p.paidOn, W.earlier)}</span>
                <span>
                  {p.label}
                  {p.online
                    ? <span className={styles.payHow}> · {OW.method(receiptLabel(p.online.receiptNo ?? ''))}</span>
                    : p.method && <span className={styles.payHow}> · {W.methods[p.method]}</span>}
                  {p.inLedger && p.status !== 'refunded' && <span className={styles.payChip}><RepChip tone="good">{W.inLedger}</RepChip></span>}
                  {p.online?.test && <span className={styles.payTag}>{OW.test}</span>}
                  {p.online && p.status === 'refunded' && p.online.refundedOn && <span className={styles.payTag}>{OW.refunded(formatStoredDate(p.online.refundedOn, { withYear: false }))}</span>}
                  {p.online?.refund === 'pending' && <span className={styles.payTag}>{OW.refundPending}</span>}
                  {p.online?.refund === 'failed' && p.status !== 'refunded' && <span className={styles.payChip}><RepChip tone="warn">{OW.refundFailed}</RepChip></span>}
                </span>
                <span className={styles.payAmt}>{formatPaymentMoney(p.amount)}</span>
                {p.online ? (
                  <CoachToolbarMenu variant="glyph" overWindow label={OW.menuLabel} icon={<MoreHorizontal size={16} aria-hidden />} disabled={locked}>
                    <CoachToolbarMenuItem label={OW.menuView} onSelect={() => setViewing(p.online!)} />
                    {online?.refunds && p.status !== 'refunded' && p.online.refund !== 'pending' && (
                      <CoachToolbarMenuItem label={OW.menuRefund} onSelect={() => setRefunding({ p: p.online!, anotherWay: false })} />
                    )}
                    {online?.refunds && p.status !== 'refunded' && p.online.refund === 'failed' && (
                      <CoachToolbarMenuItem label={OW.menuAnotherWay} onSelect={() => setRefunding({ p: p.online!, anotherWay: true })} />
                    )}
                  </CoachToolbarMenu>
                ) : canRecord
                  ? <button type="button" className={styles.payPen} onClick={() => openEdit(p)} disabled={locked} aria-label={W.changeAria(formatPaymentMoney(p.amount), paymentDay(p.paidOn, W.earlier))}><Pencil size={15} aria-hidden /></button>
                  : <span />}
              </div>
            )))}
          </div>
        </>
      )}

      {due.length > 0 && (
        <>
          <h4 className={styles.paySub}>{W.stillDue}</h4>
          <div className={styles.payRows}>
            {due.map(d => (form?.key === d.key ? <div key={d.key}>{recordForm}</div> : (
              <div key={d.key} className={`${styles.payRow} ${styles.payDueRow}`}>
                <span>{d.label} <span className={styles.payAmt}>{formatPaymentMoney(d.amount)}</span></span>
                <span className={styles.payHow}>{d.dueDate ? W.dueOn(formatStoredDate(d.dueDate, { withYear: false })) : ''}</span>
                <span className={styles.payDueActs}>
                  {canRecord && (
                    <button type="button" className={screenParts.plainButton} onClick={() => openRecord(d.key)} disabled={locked} aria-label={`${W.record} ${d.label.toLowerCase()}`}>{W.record}</button>
                  )}
                  {online?.payLink && d === due[due.length - 1] && (
                    <CoachToolbarMenu variant="glyph" overWindow label={OW.dueMenuLabel} icon={<MoreHorizontal size={16} aria-hidden />} disabled={locked}>
                      <CoachToolbarMenuItem label={OW.menuEmailLink} onSelect={() => void emailPayLink()} />
                    </CoachToolbarMenu>
                  )}
                </span>
              </div>
            )))}
          </div>
          {online?.payLink && online.payLinkSentAt && <p className={styles.paySent}>{OW.linkSent(formatStoredDate(online.payLinkSentAt, { withYear: false }))}</p>}
          {canRecord && form?.key === 'other' && recordForm}
          {canRecord && !form && (
            <button type="button" className={styles.payLink} onClick={() => openRecord('other')} disabled={locked}>{W.recordOther}</button>
          )}
        </>
      )}

      {flash && <p className={styles.paySent} role="status">{flash}</p>}
      {viewing && <PaymentViewWindow p={viewing} onClose={() => setViewing(null)} />}
      {refunding && (
        <RefundWindow p={refunding.p} teamName={teamName} anotherWay={refunding.anotherWay} send={refund} onClose={() => setRefunding(null)} />
      )}
    </>
  );
}
