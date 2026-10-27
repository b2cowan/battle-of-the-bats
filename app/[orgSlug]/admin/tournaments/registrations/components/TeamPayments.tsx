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
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { TEAM_ENTRY_WORDS as EW, TEAM_ROW_WORDS as OW, REFUND_WORDS as RW, OVER_WORDS as XW, PAY_OPEN_WORDS as PW, SCOPE_WORDS, howPaidWords, money, reasonShort, receiptLabel } from '@/lib/online-payment-words';
import type { TeamDebit } from '@/lib/team-pay-facts';
import { KeepOverWindow, PaymentViewWindow, RefundWindow, type OverPreset, type RefundSend } from './OnlinePaymentWindows';
import type { OpenPayPage } from '@/lib/online-pay-pages';
import { RepChip } from '@/components/admin/kit/club/RepKit';
import DisputeBlock, { disputeShows } from '@/components/admin/kit/club/DisputeBlock';
import { blocksRefund, disputeChip, type DisputeRecord } from '@/lib/online-payment-dispute';
import { DISPUTE_WORDS as DPW, disputeDue } from '@/lib/online-payment-words';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useParams } from 'next/navigation';
import DateInput from '@/components/shared/DateInput';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { TEAM_PAYMENT_WORDS as W } from '@/lib/registration-words';
import {
  PAYMENT_METHODS, draftIssue, formatPaymentMoney, labelForDue, paymentDay, receivedOrder, stillDue,
  type DueRow, type EntryAdjustment, type PaymentMethod, type TeamOnlinePayment, type TeamPayment,
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
  /** 12d-1: open the refund window, set, on this payment once the list has loaded (the paid-twice item's link). */
  autoRefundId?: string | null;
  /** 12d-1: what a team paid past what it owed, still standing, for the summary's pill (null when nothing is, or this
   *  reader may not refund: the treasurer reads the summary plain). `open` opens the refund window set to it. */
  onOver?: (over: { extraCents: number; whole: boolean; open: () => void } | null) => void;
  /** 12d-1: the record's Mark paid closed an open pay page, said in this list's status line. */
  doneSaid?: string | null;
}

/** 12d-1: the extra still standing on a posted online payment, or null. */
const overOf = (p: TeamPayment) => (p.status === 'posted' && p.online?.over && p.online.over.leftCents > 0 ? p.online.over : null);

/** Online payments on this record (Club Tier Stage 12a): may the pay link go out, when it last did, may a card be refunded. */
type OnlineInfo = { payLink: boolean; payLinkSentAt: string | null; refunds: boolean };

/** What a team has paid: posted rows only, each net of its part refunds (12c) — a row refunded in full, or reversed by the
 *  bank (12c Part 6), stays on the record but never counts. */
const sumPaid = (list: TeamPayment[]) => list.reduce((s, p) => s + (p.status === 'refunded' || p.status === 'reversed' ? 0 : p.amount - (p.refundedAmount ?? 0)), 0);
const DEBIT_LABEL: Record<'deposit' | 'balance' | 'full', string> = { deposit: 'Deposit', balance: 'Balance', full: 'Payment' };

/** 12c words §1.2: what a row with part refunds says (a part refund never strikes it through). */
function partTag(o: TeamOnlinePayment): { text: string; warn: boolean; sub: string | null } | null {
  const parts = o.refunds.filter(r => r.part);
  if (!parts.length) return null;
  const bank = o.rail === 'bank_debit';
  const day = (iso: string | null) => (iso ? formatStoredDate(iso, { withYear: false }) : '');
  const failed = parts.find(r => r.state === 'failed');
  if (failed) return { text: OW.refundFailed(bank), warn: true, sub: OW.refundFailedSub(money(failed.amountCents / 100), day(failed.failedAt)) };
  const pending = parts.find(r => r.state === 'pending');
  if (pending) return { text: OW.refundPendingPart(money(pending.amountCents / 100), bank), warn: false, sub: null };
  const done = parts.filter(r => r.state === 'refunded' || r.state === 'anotherWay');
  const sum = money(done.reduce((n, r) => n + r.amountCents, 0) / 100);
  const last = done[0];
  if (done.length > 1) return { text: OW.refundedPartMore(sum, day(last.succeededAt ?? last.createdAt), bank), warn: false, sub: null };
  return { text: last.stripe ? OW.refundedPartStripe(sum, day(last.succeededAt ?? last.createdAt), bank) : OW.refundedPart(sum, day(last.succeededAt ?? last.createdAt), bank), warn: false, sub: null };
}

type Draft = { amount: string; paidOn: string; how: '' | PaymentMethod; error: string; saving: boolean };
type RecordForm = Draft & { key: DueRow['key'] | 'other' };

const toMethod = (v: string): '' | PaymentMethod => ((PAYMENT_METHODS as readonly string[]).includes(v) ? (v as PaymentMethod) : '');
const amountText = (n: number) => String(Math.round(n * 100) / 100);

export default function TeamPayments(props: Props) {
  const { teamId, tournamentId, orgQuery, fee, today, canRecord, paidTotal, onChanged, busy = false, onFormOpen, teamName = '', autoRefundId = null, onOver, doneSaid = null } = props;
  const uid = useId();
  const isPhone = useIsPhone();
  const orgSlug = useParams<{ orgSlug?: string }>()?.orgSlug ?? '';
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
  const [adjustments, setAdjustments] = useState<EntryAdjustment[]>([]);
  // 12c Part 6: the team's bank debit (clearing, returned, reversed), and for a team ended while it clears, the answer.
  const [debit, setDebit] = useState<TeamDebit | null>(null);
  const [teamStatus, setTeamStatus] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ choice: 'send_back' | 'keep'; feeBack: boolean; reason: string | null } | null>(null);
  const [payoutsOn, setPayoutsOn] = useState(false);
  const [canDecide, setCanDecide] = useState(false);
  const [clearChoice, setClearChoice] = useState<'send_back' | 'keep' | null>(null);
  const [clearFeeOn, setClearFeeOn] = useState(true);
  const [clearReason, setClearReason] = useState('');
  const [clearError, setClearError] = useState('');
  const [clearSaving, setClearSaving] = useState(false);
  // 12d-1: pay pages open now (ask 12), the club's day for their clock, and the "Keep it" window (ask 10).
  const [openPages, setOpenPages] = useState<OpenPayPage[]>([]);
  const [clubToday, setClubToday] = useState(today);
  const [keeping, setKeeping] = useState<TeamOnlinePayment | null>(null);

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
      setAdjustments((data.adjustments as EntryAdjustment[] | undefined) ?? []);
      setDebit((data.debit as TeamDebit | null | undefined) ?? null);
      setTeamStatus((data.teamStatus as string | null | undefined) ?? null);
      setDecision(data.decision ?? null);
      setPayoutsOn(data.payoutsOn === true);
      setCanDecide(data.canDecide === true);
      setOpenPages((data.openPages as OpenPayPage[] | undefined) ?? []);
      if (typeof data.today === 'string') setClubToday(data.today);
      // A2's box: on when the club declined the team, off when the team withdrew (ruled §7.5).
      setClearFeeOn(data.teamStatus !== 'withdrawn');
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
  async function send(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>, fail: (message: string) => void, done: (data: Record<string, unknown>) => void): Promise<void> {
    let data: Record<string, unknown> = {};
    try {
      const res = await fetch(`${base}${orgQuery}`, {
        method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) { fail(typeof data.error === 'string' ? data.error : 'Couldn’t save the payment. Try again.'); return; }
    } catch {
      fail('Couldn’t save the payment. Try again.');
      return;
    }
    done(data);
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
      data => {
        setForm(null);
        const closed = Number(data.pagesClosed ?? 0);
        // 12d-1 (words §2.1): what the team still owes now, from the server's own total (never this list's older figure).
        const leftAfter = Math.round(((fee.totalFeeAmount ?? 0) - Number(data.total ?? 0)) * 100) / 100;
        if (closed > 0) setFlash(`${PW.doneToast(money(amount), teamName, closed > 1)}${leftAfter > 0 ? ` ${PW.partNote(money(leftAfter), false)}` : ''}`);
      });
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

  async function refund(body: RefundSend): Promise<string | null> {
    if (!refunding) return null;
    const { p } = refunding;
    const bank = p.rail === 'bank_debit';
    const request = body.kind === 'part'
      ? { action: 'refund', onlinePaymentId: p.id, amount: body.amount, partialReason: body.partialReason, note: body.note }
      : { action: body.kind === 'anotherWay' ? 'refund_another_way' : 'refund', onlinePaymentId: p.id, feeIncluded: body.feeIncluded, reason: body.reason, note: body.note };
    const { error, data } = await onlineSend(request);
    if (error) return error;
    if (data.state === 'failed') return RW.failed;
    setRefunding(null);
    if (body.kind === 'anotherWay') setFlash(RW.recordedToast);
    else if (data.state === 'pending') setFlash(RW.pendingToast(bank));
    else if (body.kind === 'part') setFlash(RW.partDoneToast(money(body.amount), money((p.leftCents - Math.round(body.amount * 100)) / 100), p.payerEmail, bank));
    else setFlash(RW.doneToast(money((body.feeIncluded ? p.totalCents : p.baseCents) / 100), p.payerEmail, bank));
    await Promise.all([load(), onChanged()]);
    return null;
  }

  const hint = postsToBook ? W.hintBook : W.hintTeamOnly;

  // ── 12d-1: paid twice (ask 10) ──
  const received = payments ? receivedOrder(payments) : [];
  const overRow = online?.refunds ? received.find(p => overOf(p)) ?? null : null;
  /** The refund window's preset for a payment with extra still standing; {howPaid} is the payment just before it. */
  const presetFor = (o: TeamOnlinePayment): OverPreset | null => {
    const at = received.findIndex(p => p.online?.id === o.id);
    const row = at >= 0 ? received[at] : null;
    const over = row ? overOf(row) : null;
    if (!over) return null;
    const before = received.slice(0, at).reverse().find(p => p.status === 'posted');
    return { leftCents: over.leftCents, whole: over.whole, howPaid: before ? howPaidWords(before.online ? 'online_card' : before.method) : null };
  };
  const overKey = overRow?.online?.over ? `${overRow.online.id}:${overRow.online.over.leftCents}:${overRow.online.over.whole}` : '';
  useEffect(() => {
    const p = overRow?.online;
    const o = p?.over;
    onOver?.(p && o ? { extraCents: o.leftCents, whole: o.whole, open: () => setRefunding({ p, anotherWay: false }) } : null);
  }, [overKey]); // eslint-disable-line react-hooks/exhaustive-deps -- keyed on what the pill shows
  useEffect(() => () => onOver?.(null), [onOver]);
  // The item's link opens the window once, set (only for a reader who may refund).
  const autoDone = useRef(false);
  useEffect(() => {
    if (autoDone.current || !autoRefundId || !payments || !online) return;
    autoDone.current = true;
    const row = receivedOrder(payments).find(p => p.online?.id === autoRefundId);
    if (online.refunds && row?.online && overOf(row)) setRefunding({ p: row.online, anotherWay: false });
  }, [autoRefundId, payments, online]);
  useEffect(() => { if (doneSaid) setFlash(doneSaid); }, [doneSaid]);

  async function keepOver(reason: string): Promise<string | null> {
    if (!keeping) return null;
    const extra = money((keeping.over?.leftCents ?? 0) / 100);
    const { error } = await onlineSend({ action: 'keep_over', onlinePaymentId: keeping.id, reason });
    if (error) return error;
    setKeeping(null);
    setFlash(XW.keepDone(extra, teamName));
    await load();
    return null;
  }

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
        <DateInput id={`${uid}-${prefix}-date`} className={ck.input} max={today} aria-required="true"
          value={d.paidOn} onChange={v => set({ ...d, paidOn: v })} />
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
  const clearing = debit?.state === 'clearing' ? debit : null;
  const day = (iso: string | null) => (iso ? formatStoredDate(iso, { withYear: false }) : '');
  /** 12d-1 Part 3 (words §1.1): a dispute's chip under the row's label — amber for the answerer only — and its second line. */
  const disputeTag = (d: DisputeRecord) => {
    const chip = disputeChip(d);
    if (!chip) return null;
    const sub = d.answered ? DPW.answered(day(d.answeredAt))
      : chip === 'notAnswered' ? DPW.wasDue(disputeDue(d.dueBy))
        : d.dueBy ? (d.youAnswer ? DPW.answerByYou(disputeDue(d.dueBy)) : DPW.answerBy(d.answererName, disputeDue(d.dueBy))) : null;
    return <span className={styles.payChip}><RepChip tone={d.youAnswer ? 'warn' : 'info'}>{DPW.chip[chip]}</RepChip>{sub && <span className={styles.payTagSub}>{sub}</span>}</span>;
  };
  // A declined or withdrawn team's clearing debit: what happens when it clears (asked here, ask 7).
  const askClear = !!clearing && teamStatus !== 'accepted' && !decision && canDecide;
  const C = OW.clear;
  const clearFee = clearing && clearing.familyPaysFee ? clearing.feeCents : 0;

  async function saveClear() {
    if (!clearing || !clearChoice || clearSaving) return;
    if (clearChoice === 'keep' && !clearReason.trim()) { setClearError(C.keepReasonError); return; }
    setClearSaving(true); setClearError('');
    try {
      const res = await fetch(onlineBase, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_decision', onlinePaymentId: clearing.id, choice: clearChoice, feeBack: clearChoice === 'send_back' && clearFee > 0 && clearFeeOn, reason: clearReason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setClearError(String(data.error ?? C.keepReasonError)); return; }
      await load();
    } finally {
      setClearSaving(false);
    }
  }

  return (
    <>
      {payments === null && !loadFailed && <p className={screenParts.recordText}>{W.loading}</p>}
      {/* 12d-1 (ask 12, words §2.1): a pay page is open, and recording closes it. A notice, never a block. */}
      {canRecord && openPages.length > 0 && (
        <p className={ck.notice} role="note">
          {openPages.length > 1
            ? PW.noticeMany(openPages.length, null)
            : PW.notice(openPages[0].openedBy, money(openPages[0].amountCents / 100), openPages[0].openedAt, clubToday, false)}
        </p>
      )}
      {loadFailed && (
        <p className={styles.payErr} role="alert">
          {W.loadError} <button type="button" className={styles.inlineLink} onClick={() => void load()}>{W.retry}</button>
        </p>
      )}

      {adjustments.length > 0 && fee.totalFeeAmount != null && (() => {
        const entry = formatPaymentMoney(fee.totalFeeAmount);
        const lowered = (a: EntryAdjustment) => [formatPaymentMoney(a.amountCents / 100), formatStoredDate(a.at, { withYear: false }), a.stripe ? EW.stripe : (a.reason ?? '')] as const;
        return (
          <div className={styles.payEntry}>
            {adjustments.length === 1
              ? <p>{EW.one(entry, ...lowered(adjustments[0]))}</p>
              : <><p>{EW.head(entry)}</p>{adjustments.map((a, i) => <p key={i}>{EW.lowered(...lowered(a))}</p>)}</>}
          </div>
        );
      })()}

      {askClear && clearing && (
        <div className={styles.payEntry}>
          <p>{C.lead(money(clearing.totalCents / 100))}</p>
          {payoutsOn && (
            <label className={styles.payChoice}>
              <input type="radio" name={`${uid}-clear`} checked={clearChoice === 'send_back'} onChange={() => setClearChoice('send_back')} />
              <span><strong>{C.sendBack}</strong> <span className={styles.payHow}>{clearFee > 0 ? C.sendBackSub : C.sendBackSubClubPays(money(clearing.baseCents / 100))}</span></span>
            </label>
          )}
          {payoutsOn && clearChoice === 'send_back' && clearFee > 0 && (
            <label className={styles.payChoice}>
              <input type="checkbox" checked={clearFeeOn} onChange={e => setClearFeeOn(e.target.checked)} />
              <span><strong>{C.feeBox(money(clearFee / 100), money((clearing.baseCents + clearFee) / 100))}</strong> <span className={styles.payHow}>{clearFeeOn ? C.feeOnWhy : teamStatus === 'withdrawn' ? C.feeOffWhy : C.feeOffPlain}</span></span>
            </label>
          )}
          <label className={styles.payChoice}>
            <input type="radio" name={`${uid}-clear`} checked={clearChoice === 'keep'} onChange={() => setClearChoice('keep')} />
            <span><strong>{C.keep}</strong> <span className={styles.payHow}>{C.keepSub}</span></span>
          </label>
          {clearChoice === 'keep' && (
            <input className={ck.input} aria-label={C.keepReason} placeholder={C.keepReason} maxLength={200} value={clearReason} onChange={e => setClearReason(e.target.value)} />
          )}
          {!payoutsOn && <p className={styles.payHow}>{C.disconnected}</p>}
          {clearError && <p className={styles.payErr} role="alert">{clearError}</p>}
          {clearChoice && (
            <button type="button" className={screenParts.plainButton} onClick={() => void saveClear()} disabled={clearSaving || busy}>
              {clearSaving ? C.saving : clearChoice === 'send_back' ? C.saveBack : C.saveKeep}
            </button>
          )}
        </div>
      )}
      {clearing && decision && (
        <p className={styles.paySent}>
          {decision.choice === 'send_back'
            ? C.decidedBack(money((clearing.baseCents + (decision.feeBack ? clearing.feeCents : 0)) / 100))
            : C.decidedKept(money(clearing.baseCents / 100), decision.reason ?? '')}
        </p>
      )}

      {(rows.length > 0 || clearing) && (
        <>
          <h4 className={styles.paySub}>{W.received}</h4>
          <div className={styles.payRows}>
            {/* 12c Part 6 (words §3.7): a bank debit on its way — a row of its own, not counted in what was paid. */}
            {clearing && (
              <div className={styles.payRow}>
                <span className={styles.payDate}>{day(clearing.startedAt)}</span>
                <span>
                  {DEBIT_LABEL[clearing.scope]}
                  <span className={styles.payHow}> · {OW.methodBankClearing}</span>
                  <span className={styles.payChip}><RepChip tone="info">{OW.clearing}</RepChip></span>
                  <span className={styles.payTagSub}>{OW.clearingSub(day(clearing.startedAt))}</span>
                </span>
                <span className={styles.payAmt}>{formatPaymentMoney(clearing.baseCents / 100)}</span>
                <span />
              </div>
            )}
            {rows.map(p => (editId === p.id ? <div key={p.id}>{editBlock(p)}</div> : (
              <div key={p.id} className={`${styles.payRow}${p.status === 'refunded' || p.status === 'reversed' ? ` ${styles.payRefunded}` : ''}`}>
                <span className={styles.payDate}>{paymentDay(p.paidOn, W.earlier)}</span>
                <span>
                  {p.label}
                  {p.online
                    ? <span className={styles.payHow}> · {p.online.rail === 'bank_debit' ? OW.methodBank(receiptLabel(p.online.receiptNo ?? '')) : OW.method(receiptLabel(p.online.receiptNo ?? ''))}</span>
                    : p.method && <span className={styles.payHow}> · {W.methods[p.method]}</span>}
                  {p.inLedger && p.status !== 'refunded' && p.status !== 'reversed' && <span className={styles.payChip}><RepChip tone="good">{W.inLedger}</RepChip></span>}
                  {p.status === 'reversed' && p.online && (p.online.rail === 'card' && p.online.dispute?.lostBookedAt
                    ? <span className={styles.payTag}>{DPW.teamRowLost(day(p.online.dispute.lostBookedAt))}</span>
                    : <span className={styles.payTag}>{OW.debitReversed(day(p.online.reversedAt ?? null))}</span>)}
                  {/* 12d-1 Part 3 (words §1.1): a won dispute joins the method line, last and lowercase. */}
                  {p.online?.dispute?.status === 'won' && <span className={styles.payHow}> · {DPW.wonSub(day(p.online.dispute.wonBackAt ?? p.online.dispute.closedAt))}</span>}
                  {p.online?.test && <span className={styles.payTag}>{OW.test}</span>}
                  {p.online && p.status === 'refunded' && (p.online.refundedOn || p.online.refunds[0]) && (
                    <span className={styles.payTag}>{OW.refunded(formatStoredDate((p.online.refundedOn ?? p.online.refunds[0].succeededAt ?? p.online.refunds[0].createdAt), { withYear: false }), p.online.rail === 'bank_debit')}</span>
                  )}
                  {p.online && p.status !== 'refunded' && p.status !== 'reversed' && (() => {
                    // 12c: part refunds read their own tags; a refund in full keeps 12a's.
                    const part = partTag(p.online);
                    if (part) {
                      return part.warn
                        ? <span className={styles.payChip}><RepChip tone="warn">{part.text}</RepChip>{part.sub && <span className={styles.payTagSub}>{part.sub}</span>}</span>
                        : <span className={styles.payTag}>{part.text}</span>;
                    }
                    if (p.online.refund === 'pending') return <span className={styles.payTag}>{OW.refundPending(p.online.rail === 'bank_debit')}</span>;
                    if (p.online.refund === 'failed') return <span className={styles.payChip}><RepChip tone="warn">{OW.refundFailed(p.online.rail === 'bank_debit')}</RepChip></span>;
                    return null;
                  })()}
                  {/* 12d-1 (words §2.2): the extra, under its row, for whoever may refund it; the row stays "In ledger". */}
                  {online?.refunds && overOf(p) && (
                    <span className={styles.payTagSub}>{overOf(p)!.whole ? XW.tagTwice : XW.tagMore(money(overOf(p)!.leftCents / 100))}</span>
                  )}
                  {p.online?.over?.keptReason && <span className={styles.payTagSub}>{XW.keptLine(money(p.online.over.extraCents / 100), p.online.over.keptReason)}</span>}
                  {p.online?.dispute && disputeTag(p.online.dispute)}
                </span>
                <span className={styles.payAmt}>{formatPaymentMoney(p.amount)}</span>
                {p.online ? (
                  <CoachToolbarMenu variant="glyph" overWindow label={OW.menuLabel} icon={<MoreHorizontal size={16} aria-hidden />} disabled={locked}>
                    <CoachToolbarMenuItem label={OW.menuView} onSelect={() => setViewing(p.online!)} />
                    {online?.refunds && p.status !== 'refunded' && p.status !== 'reversed' && p.online.leftCents > 0 && p.online.refund !== 'pending'
                      && !blocksRefund(p.online.dispute?.status ?? '') && (
                      <CoachToolbarMenuItem label={OW.menuRefund(p.online.rail === 'bank_debit')} onSelect={() => setRefunding({ p: p.online!, anotherWay: false })} />
                    )}
                    {online?.refunds && p.online.refund === 'failed' && (
                      <CoachToolbarMenuItem label={OW.menuAnotherWay} onSelect={() => setRefunding({ p: p.online!, anotherWay: true })} />
                    )}
                    {online?.refunds && overOf(p) && p.online.refund !== 'failed' && p.online.refund !== 'pending' && (
                      <CoachToolbarMenuItem label={XW.menuKeep} onSelect={() => setKeeping(p.online!)} />
                    )}
                  </CoachToolbarMenu>
                ) : canRecord
                  ? <button type="button" className={styles.payPen} onClick={() => openEdit(p)} disabled={locked} aria-label={W.changeAria(formatPaymentMoney(p.amount), paymentDay(p.paidOn, W.earlier))}><Pencil size={15} aria-hidden /></button>
                  : <span />}
              </div>
            )))}
          </div>
          {/* 12d-1 Part 3 (words §1.2): each disputed payment's block, under the payment rows. */}
          {rows.map(p => (disputeShows(p.online?.dispute)
            ? <DisputeBlock key={`dispute-${p.id}`} d={p.online!.dispute!} orgSlug={orgSlug} team isPhone={isPhone} />
            : null))}
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
                  {canRecord && !clearing && (
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
          {/* 12c Part 6: a debit that came back before it cleared — on the due row's foot, with the bank's reason. */}
          {debit?.state === 'returned' && <p className={styles.paySent}>{OW.debitReturned(day(debit.returnedAt), reasonShort(debit.reason))}</p>}
          {online?.payLink && online.payLinkSentAt && <p className={styles.paySent}>{OW.linkSent(formatStoredDate(online.payLinkSentAt, { withYear: false }))}</p>}
          {canRecord && form?.key === 'other' && recordForm}
          {canRecord && !form && !clearing && (
            <button type="button" className={styles.payLink} onClick={() => openRecord('other')} disabled={locked}>{W.recordOther}</button>
          )}
        </>
      )}

      {flash && <p className={styles.paySent} role="status">{flash}</p>}
      {viewing && (
        <PaymentViewWindow p={viewing} onClose={() => setViewing(null)} entryNow={fee.totalFeeAmount ?? null} canDesk={!!online?.refunds}
          onAnotherWay={() => { const v = viewing; setViewing(null); setRefunding({ p: v, anotherWay: true }); }} />
      )}
      {refunding && (() => {
        // "Refund the rest from the balance’s ⋯" names the team's other card payment when there is one.
        const other = rows.find(r => r.online && r.online.id !== refunding.p.id && r.status !== 'refunded' && r.online.leftCents > 0)?.online;
        return (
          <RefundWindow p={refunding.p} teamName={teamName} anotherWay={refunding.anotherWay} send={refund} onClose={() => setRefunding(null)}
            otherLabel={other ? SCOPE_WORDS.scope[other.scope] : null} over={refunding.anotherWay ? null : presetFor(refunding.p)} />
        );
      })()}
      {keeping && (
        <KeepOverWindow teamName={teamName} extraCents={keeping.over?.leftCents ?? 0} keep={keepOver} onClose={() => setKeeping(null)} />
      )}
    </>
  );
}
