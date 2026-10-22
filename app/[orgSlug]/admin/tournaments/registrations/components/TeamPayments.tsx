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
import { Pencil, Trash2 } from 'lucide-react';
import { RepChip } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { TEAM_PAYMENT_WORDS as W } from '@/lib/registration-words';
import {
  PAYMENT_METHODS, draftIssue, formatPaymentMoney, labelForDue, paymentDay, receivedOrder, stillDue,
  type DueRow, type PaymentMethod, type TeamPayment,
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
}

type Draft = { amount: string; paidOn: string; how: '' | PaymentMethod; error: string; saving: boolean };
type RecordForm = Draft & { key: DueRow['key'] | 'other' };

const toMethod = (v: string): '' | PaymentMethod => ((PAYMENT_METHODS as readonly string[]).includes(v) ? (v as PaymentMethod) : '');
const amountText = (n: number) => String(Math.round(n * 100) / 100);

export default function TeamPayments(props: Props) {
  const { teamId, tournamentId, orgQuery, fee, today, canRecord, paidTotal, onChanged, busy = false, onFormOpen } = props;
  const uid = useId();
  const [payments, setPayments] = useState<TeamPayment[] | null>(null);
  const [postsToBook, setPostsToBook] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<RecordForm | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [asking, setAsking] = useState(false);

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
    } catch {
      setLoadFailed(true);
    }
  }, [base, teamId, orgParam]);

  useEffect(() => { void load(); }, [load]);

  const paid = useMemo(() => (payments ? payments.reduce((s, p) => s + p.amount, 0) : paidTotal), [payments, paidTotal]);
  const due = useMemo(() => stillDue(fee, paid), [fee, paid]);

  // The team's cached total moved without this list's own write (Mark paid, a bulk action, another screen): the list is
  // stale, and its Still due rows would offer to record money already received. The cache is the sum of the posted
  // payments, so any gap means "read again" — and once read, the two agree and this stops.
  useEffect(() => {
    if (payments && Math.abs(payments.reduce((s, p) => s + p.amount, 0) - paidTotal) > 0.004) void load();
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
          {W.loadError} <button type="button" className={styles.payLink} onClick={() => void load()}>{W.retry}</button>
        </p>
      )}

      {rows.length > 0 && (
        <>
          <h4 className={styles.paySub}>{W.received}</h4>
          <div className={styles.payRows}>
            {rows.map(p => (editId === p.id ? <div key={p.id}>{editBlock(p)}</div> : (
              <div key={p.id} className={styles.payRow}>
                <span className={styles.payDate}>{paymentDay(p.paidOn, W.earlier)}</span>
                <span>
                  {p.label}
                  {p.method && <span className={styles.payHow}> · {W.methods[p.method]}</span>}
                  {p.inLedger && <span className={styles.payChip}><RepChip tone="good">{W.inLedger}</RepChip></span>}
                </span>
                <span className={styles.payAmt}>{formatPaymentMoney(p.amount)}</span>
                {canRecord
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
                {canRecord && (
                  <button type="button" className={screenParts.plainButton} onClick={() => openRecord(d.key)} disabled={locked} aria-label={`${W.record} ${d.label.toLowerCase()}`}>{W.record}</button>
                )}
              </div>
            )))}
          </div>
          {canRecord && form?.key === 'other' && recordForm}
          {canRecord && !form && (
            <button type="button" className={styles.payLink} onClick={() => openRecord('other')} disabled={locked}>{W.recordOther}</button>
          )}
        </>
      )}
    </>
  );
}
