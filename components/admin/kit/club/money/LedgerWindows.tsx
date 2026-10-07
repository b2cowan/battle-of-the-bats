'use client';
/**
 * THE LEDGER'S WINDOWS (Club Tier Stage 3a, specimen 1's "What opens from a line, and the questions it
 * asks" — Ask 3). Every one is the kit's window (`KitDialog`): a form fills a phone, a question is small.
 *
 *   a line you typed      — EDIT SAVES AS YOU GO (2026-09-24), the transient word in the head; Void
 *                           asks, with a reason (not red: a void is a correction, the line stays).
 *   a line from a source  — an allocation's, a request's, a house league fee's: read here and changed
 *                           where it came from. Who recorded it and when (C17), and ONE door to its
 *                           source — no Edit, no Void (C12's last part, C07).
 *   a transfer half       — both halves are named and voided together, with a reason (C13).
 *   Add entry             — creates ASK: Money In or Out (never a transfer half, C12), FILED UNDER a budget
 *                           word (Club Tier Stage 3b, Ask 4a — the word picker the Budget's Add line and every
 *                           coach money form use, money-out words for money out; the hint says whether the word
 *                           is on the year's plan — a word with no line counts as off-plan), the payee picker
 *                           with Manage payees at its foot (C01), how it was paid and the reference, Pending.
 *                           The free-text category retired with 3a's form: a line's word is what gives it an
 *                           Actual on Budget vs. Actual, matched to the plan by word (the coach's rule).
 *   Transfer              — between the club's OWN books only (a team never appears, C12).
 *
 * Every write answers 409/403 in words (lib/club-money-words.ts); a refused tap re-reads the book.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { RepChip, SavePill, repKit } from '../RepKit';
import PayeeCombobox, { type PayeeSelection } from '@/components/accounting/PayeeCombobox';
import { LedgerLineRead } from '@/components/coaches/kit';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { DUES_PAYMENT_METHODS, DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from '@/lib/types';
import { FILED_BY_ITS_SOURCE, filedUnderHint, howItCame, wasCategoryWord, CLUB_BUDGET_REFUSAL } from '@/lib/club-money-words';
import BudgetItemPicker, { type BudgetItemSelection } from '@/components/accounting/BudgetItemPicker';
import type { BudgetCategoryWithItems } from '@/lib/types';
import type { Filing } from '@/lib/club-ledger';
import { tournamentToday } from '@/lib/timezone';
import type { BookRowOut } from '@/lib/club-ledger-read';
import {
  DayField, FormError, MethodField, ReasonQuestion, TextField, day, jsonInit, money, moneyFetch, moneyKit, moneyMove, parseAmount, refusalText,
  type MoveResult,
} from './MoneyKit';

/** The book a window acts on. */
export interface BookRef { id: string; name: string; kind: string }

/** "Cheque 2204" back into its method and reference — a typed line stores how it was paid as one phrase. */
export function splitHow(paymentMethod: string | null): { method: DuesPaymentMethod | ''; reference: string } {
  const text = (paymentMethod ?? '').trim();
  for (const m of DUES_PAYMENT_METHODS) {
    const word = DUES_PAYMENT_METHOD_LABEL[m];
    if (text.toLowerCase() === word.toLowerCase()) return { method: m, reference: '' };
    if (text.toLowerCase().startsWith(`${word.toLowerCase()} `)) return { method: m, reference: text.slice(word.length + 1).trim() };
  }
  return { method: text ? 'other' : '', reference: text && text.toLowerCase() !== 'other' ? text : '' };
}

/** The words a club line can be filed under (the Budget's own picker list: standard and club-shared words). */
export type WordList = BudgetCategoryWithItems[];

/**
 * What the plan of the fiscal year a day falls in holds, by word — the "Filed under" hint's question: is this word
 * on the plan? The SERVER decides the year (`?day=`, Stage 3c — never a date's first four characters), and names
 * it. Read once per day the window asks about.
 */
function usePlanWords(q: string, day: string): { words: Map<string, number>; yearName: string } | null {
  const [byDay, setByDay] = useState<Record<string, { words: Map<string, number>; yearName: string }>>({});
  useEffect(() => {
    if (byDay[day]) return;
    let live = true;
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    void moneyFetch<{ year?: { name: string }; plan?: { revenue: { categories: { lines: { itemId: string | null; planned: number }[] }[] }; expenses: { categories: { lines: { itemId: string | null; planned: number }[] }[] } } }>(`/api/admin/accounting/budget-plan?${q}&day=${day}`)
      .then(r => {
        if (!live || !r.ok || !r.data.plan || !r.data.year) return;
        const m = new Map<string, number>();
        for (const c of [...r.data.plan.revenue.categories, ...r.data.plan.expenses.categories]) {
          for (const l of c.lines) if (l.itemId) m.set(l.itemId, l.planned);
        }
        const yearName = r.data.year.name;
        setByDay(prev => ({ ...prev, [day]: { words: m, yearName } }));
      })
      .catch(() => {});
    return () => { live = false; };
  }, [q, day, byDay]);
  return byDay[day] ?? null;
}

/** The word a line is filed under, as the picker holds it. */
const selectionOfFiling = (f: Filing | null): BudgetItemSelection | null =>
  (f && f.itemId && !f.byItsSource
    ? { categoryId: f.categoryId, categoryName: f.categoryName, itemId: f.itemId, itemName: f.itemName ?? '', suggestedAmount: null }
    : null);

/** FILED UNDER — the budget word picker (Ask 4a), money-out words for money out, money-in for money in, with
 *  the hint whether the word is on the year's plan. */
function FiledUnderField({ id, words, value, onChange, direction, orgSlug, q, date, hint }: {
  id: string; words: WordList | null; value: BudgetItemSelection | null; onChange: (v: BudgetItemSelection) => void;
  direction: 'in' | 'out'; orgSlug: string; q: string; date: string; hint?: string | null;
}) {
  const plan = usePlanWords(q, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : tournamentToday());
  const onPlan = value?.itemId && plan ? (plan.words.has(value.itemId) ? { planned: plan.words.get(value.itemId)! } : null) : undefined;
  return (
    <div className={ck.field}>
      <span className={ck.label} id={`${id}-label`}>Filed under<span className={repKit.req} aria-hidden>*</span></span>
      {words ? (
        <BudgetItemPicker
          categories={words}
          value={value}
          onChange={onChange}
          /* org-slug-ok: the picker appends `/{catId}/items`, so the org travels as `adminOrgSlug` */
          createItemEndpoint="/api/admin/accounting/budget-categories"
          createItemMode="admin"
          adminOrgSlug={orgSlug}
          direction={direction}
          selectId={`${id}-picker`}
        />
      ) : <p className={ck.hint}>Loading the budget’s words…</p>}
      {onPlan !== undefined && plan && <p className={ck.hint}>{filedUnderHint(onPlan, plan.yearName)}</p>}
      {hint && <p className={ck.hint}>{hint}</p>}
    </div>
  );
}

/** Money In or Out — never a transfer half (C12): a transfer has its own door. */
function DirectionField({ id, value, onChange }: { id: string; value: 'income' | 'expense'; onChange: (v: 'income' | 'expense') => void }) {
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>Money<span className={repKit.req} aria-hidden>*</span></span>
      <select id={id} className={ck.select} value={value} onChange={e => onChange(e.target.value as 'income' | 'expense')}>
        <option value="expense">Out — the club paid</option>
        <option value="income">In — the club received</option>
      </select>
    </label>
  );
}

function StatusField({ id, value, onChange }: { id: string; value: 'posted' | 'pending'; onChange: (v: 'posted' | 'pending') => void }) {
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>Status</span>
      <select id={id} className={ck.select} value={value} onChange={e => onChange(e.target.value as 'posted' | 'pending')}>
        <option value="posted">Posted</option>
        <option value="pending">Pending — a cheque written and not yet cleared</option>
      </select>
    </label>
  );
}

/** The payee picker, with "Manage payees…" as its last row (C01: the two spellings get merged there). */
function PayeeField({ id, q, value, onChange, payeesHref, label }: {
  id: string; q: string; value: PayeeSelection | null; onChange: (v: PayeeSelection | null) => void; payeesHref: string; label: string;
}) {
  return (
    <div className={ck.field}>
      <span className={ck.label} id={`${id}-label`}>{label}</span>
      <PayeeCombobox
        payeesApiUrl={`/api/admin/accounting/payees?${q}`}
        value={value}
        onChange={onChange}
        manageHref={payeesHref}
        kitField
      />
    </div>
  );
}

// ── Add an entry ─────────────────────────────────────────────────────────────────────────────────

export function AddEntryWindow({ book, q, orgSlug, words, payeesHref, onAdded, onClose }: {
  book: BookRef; q: string; orgSlug: string; words: WordList | null; payeesHref: string;
  onAdded: (text: string) => void; onClose: () => void;
}) {
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState(() => tournamentToday());
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [word, setWord] = useState<BudgetItemSelection | null>(null);
  const [payee, setPayee] = useState<PayeeSelection | null>(null);
  const [method, setMethod] = useState<DuesPaymentMethod | ''>('');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState<'posted' | 'pending'>('posted');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const n = parseAmount(amount);

  async function add() {
    if (busy) return;
    if (!what.trim()) { setError('Say what it was for.'); return; }
    if (n == null) { setError('Give an amount between $0.01 and $999,999.99.'); return; }
    if (!word?.itemId) { setError(CLUB_BUDGET_REFUSAL.word_required); return; }
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch(`/api/admin/accounting/ledgers/${book.id}/entries?${q}`, jsonInit('POST', {
        entryDate: date, description: what.trim(), amount: n, entryType, status, budgetItemId: word.itemId,
        paymentMethod: method ? howItCame(method, reference) : (reference.trim() || null),
        payeeId: payee?.payeeId ?? null, payeePayer: payee?.displayName ?? null, notes: notes.trim() || null,
      }));
      if (!r.ok) { setError(refusalText(r.data, 'The entry couldn’t be added. Please try again.')); return; }
      onAdded(`${what.trim()} added to ${book.name}.`);
    } catch {
      setError('The entry couldn’t be added. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      eyebrow={book.name}
      title="Add an entry"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void add()} disabled={busy}>{busy ? 'Adding…' : 'Add entry'}</button>
        </>
      }
    >
      <FormError>{error}</FormError>
      <div className={moneyKit.pair}>
        <DirectionField id="ae-money" value={entryType} onChange={v => { setEntryType(v); setWord(null); }} />
        <DayField id="ae-date" label="Date" value={date} onChange={setDate} />
      </div>
      <TextField id="ae-what" label="What" required value={what} onChange={setWhat} maxLength={500}
        placeholder="For example: Diamond permit" />
      <TextField id="ae-amount" label="Amount" required value={amount} onChange={setAmount} placeholder="$0.00" />
      <FiledUnderField id="ae-word" words={words} value={word} onChange={setWord} direction={entryType === 'income' ? 'in' : 'out'}
        orgSlug={orgSlug} q={q} date={date} />
      <PayeeField id="ae-payee" q={q} value={payee} onChange={setPayee} payeesHref={payeesHref}
        label={entryType === 'income' ? 'Paid by' : 'Paid to'} />
      <div className={moneyKit.pair}>
        <MethodField id="ae-method" label="How it was paid" value={method} onChange={setMethod} required={false} />
        <TextField id="ae-ref" label="Reference" value={reference} onChange={setReference} placeholder="Cheque or E-Transfer number" />
      </div>
      <StatusField id="ae-status" value={status} onChange={setStatus} />
      <label className={ck.field} htmlFor="ae-notes">
        <span className={ck.label}>Notes</span>
        <textarea id="ae-notes" className={ck.textarea} rows={2} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />
      </label>
    </KitDialog>
  );
}

// ── A transfer between the club's own books ─────────────────────────────────────────────────────

export function TransferWindow({ book, books, q, onDone, onClose }: {
  book: BookRef; books: readonly BookRef[]; q: string; onDone: (text: string) => void; onClose: () => void;
}) {
  const others = books.filter(b => b.id !== book.id && b.kind !== 'team');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => tournamentToday());
  const [what, setWhat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function move() {
    if (busy) return;
    const n = parseAmount(amount);
    if (!to) { setError('Choose the book it goes to.'); return; }
    if (n == null) { setError('Give an amount between $0.01 and $999,999.99.'); return; }
    if (!what.trim()) { setError('Say what the transfer is for.'); return; }
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch(`/api/admin/accounting/transfers?${q}`, jsonInit('POST', {
        fromLedgerId: book.id, toLedgerId: to, amount: n, entryDate: date, description: what.trim(), category: null,
      }));
      if (!r.ok) { setError(refusalText(r.data, 'The transfer couldn’t be recorded. Please try again.')); return; }
      onDone(`${money(n)} moved to ${others.find(b => b.id === to)?.name ?? 'the other book'}. Both books show it.`);
    } catch {
      setError('The transfer couldn’t be recorded. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      eyebrow={book.name}
      title="Transfer between the club’s books"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void move()} disabled={busy || others.length === 0}>{busy ? 'Recording…' : 'Record the transfer'}</button>
        </>
      }
    >
      <FormError>{error}</FormError>
      {others.length === 0 ? (
        <p className={ck.hint}>The club has no other book to move money to. Add one from the Overview tab first.</p>
      ) : (
        <>
          <label className={ck.field} htmlFor="tr-to">
            <span className={ck.label}>To<span className={repKit.req} aria-hidden>*</span></span>
            <select id="tr-to" className={ck.select} value={to} onChange={e => setTo(e.target.value)}>
              <option value="">Choose a book…</option>
              {others.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <div className={moneyKit.pair}>
            <TextField id="tr-amount" label="Amount" required value={amount} onChange={setAmount} placeholder="$0.00" />
            <DayField id="tr-date" label="Date" value={date} onChange={setDate} />
          </div>
          <TextField id="tr-what" label="What it’s for" required value={what} onChange={setWhat} maxLength={500} placeholder="For example: tournament float" />
          <p className={ck.hint}>Both books get a line: money out of {book.name}, money in to the other. A team’s book is its coaches’ and is never a transfer’s other side.</p>
        </>
      )}
    </KitDialog>
  );
}

// ── A line's window ──────────────────────────────────────────────────────────────────────────────

/** Where a sourced line is changed: its one door. */
function sourceDoor(row: BookRowOut, accountingBase: string): { href: string; label: string } | null {
  const s = row.source;
  if (s.kind === 'allocation' && s.allocationId) {
    return { href: `${accountingBase}/allocations/${s.allocationId}${s.splitId ? `?bill=${s.splitId}` : ''}`, label: 'Open the allocation' };
  }
  if (s.kind === 'request' && s.requestId) return { href: `${accountingBase}/payment-requests?request=${s.requestId}`, label: 'Open the request' };
  return null;
}

/**
 * The window a line opens. Which one is the server's to say (`row.can`): a typed line is editable, a
 * transfer half voids both halves, a line from a source (or on a team's book) is read here only.
 */
export function LineWindow({ row, book, q, orgSlug, words, accountingBase, payeesHref, canMove, onChanged, onClose }: {
  row: BookRowOut; book: BookRef; q: string; orgSlug: string; words: WordList | null; accountingBase: string; payeesHref: string;
  canMove: boolean;
  /** A write landed (or was refused because the line changed): re-read the book; the text is the notice. */
  onChanged: (text: string | null) => void;
  onClose: () => void;
}) {
  if (row.status !== 'void' && canMove && row.can.edit) {
    return <EditLineWindow row={row} book={book} q={q} orgSlug={orgSlug} words={words} payeesHref={payeesHref} onChanged={onChanged} onClose={onClose} />;
  }
  return <ReadLineWindow row={row} book={book} q={q} accountingBase={accountingBase} canMove={canMove} onChanged={onChanged} onClose={onClose} />;
}

type Draft = {
  entryType: 'income' | 'expense'; date: string; what: string; amount: string; word: BudgetItemSelection | null;
  payee: PayeeSelection | null; method: DuesPaymentMethod | ''; reference: string; status: 'posted' | 'pending'; notes: string;
};
const draftOf = (row: BookRowOut): Draft => {
  const how = splitHow(row.paymentMethod);
  return {
    entryType: row.moneyIn != null ? 'income' : 'expense',
    date: row.date, what: row.description, amount: (row.moneyIn ?? row.moneyOut ?? 0).toFixed(2), word: selectionOfFiling(row.filedUnder),
    payee: row.payeeId || row.payeeName ? { payeeId: row.payeeId, payeePayer: row.payeeId ? null : row.payeeName, displayName: row.payeeName ?? '' } : null,
    method: how.method, reference: how.reference, status: row.status === 'pending' ? 'pending' : 'posted', notes: row.notes ?? '',
  };
};
const draftSig = (d: Draft) => JSON.stringify({ ...d, what: d.what.trim(), amount: d.amount.trim(), word: d.word?.itemId ?? null, payee: d.payee?.payeeId ?? d.payee?.displayName ?? null });

/** A line you typed: it saves as you go; Void asks, with a reason. */
function EditLineWindow({ row, book, q, orgSlug, words, payeesHref, onChanged, onClose }: {
  row: BookRowOut; book: BookRef; q: string; orgSlug: string; words: WordList | null; payeesHref: string;
  onChanged: (text: string | null) => void; onClose: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftOf(row));
  const [voiding, setVoiding] = useState(false);
  const saved = useRef(false);
  const sig = draftSig(d);
  const n = parseAmount(d.amount);
  /* The word the server holds now: the line's own, then each save's (an old line stays Not filed until filed). */
  const [filedItemId, setFiledItemId] = useState<string | null>(row.filedUnder?.itemId ?? null);
  const blocked = !d.what.trim() ? 'Give the entry a name to save it.'
    : n == null ? 'Give an amount between $0.01 and $999,999.99 to save it.'
    : !d.date ? 'Give the entry a date to save it.'
    : filedItemId && !d.word?.itemId ? CLUB_BUDGET_REFUSAL.word_required : null;

  const write = useCallback(async (signal: AbortSignal) => {
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const res = await fetch(`/api/admin/accounting/ledgers/${book.id}/entries/${row.id}?${q}`, {
      ...jsonInit('PATCH', {
        entryDate: d.date, description: d.what.trim(), amount: parseAmount(d.amount), entryType: d.entryType, status: d.status,
        // The word goes only when it was chosen here — an old line stays Not filed until someone files it.
        ...(d.word?.itemId && d.word.itemId !== filedItemId ? { budgetItemId: d.word.itemId } : {}),
        paymentMethod: d.method ? howItCame(d.method, d.reference) : (d.reference.trim() || null),
        payeeId: d.payee?.payeeId ?? null, payeePayer: d.payee?.displayName ?? null, notes: d.notes.trim() || null,
      }),
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(data, 'Couldn’t save'));
    saved.current = true;
    if (d.word?.itemId) setFiledItemId(d.word.itemId);
  }, [book.id, row.id, q, d, filedItemId]);

  // The autosave holds while the Void question is open: a change typed in the last 0.9s must not
  // PATCH under a void. Keep it, and the pending change saves as usual.
  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: true, loading: voiding, sig, blocked, write, failText: 'Couldn’t save',
  });
  const set = (patch: Partial<Draft>) => { setD(x => ({ ...x, ...patch })); touch(); };

  // Closing inside the debounce sends the pending change first; the book re-reads once, on the way out.
  // ⚠ A save the server REFUSES (the line was voided elsewhere) holds the window once, with the reason
  // in its pill; closing again leaves the change unsaved — never a window that cannot be closed.
  const closeRefused = useRef(false);
  const close = async () => {
    if (dirty && !blocked && !closeRefused.current && !(await handleSave())) { closeRefused.current = true; return; }
    if (saved.current || closeRefused.current) onChanged(null);
    onClose();
  };

  return (
    <>
      <KitDialog
        kind="form"
        eyebrow={`${book.name} · ${day(row.date)}`}
        title={row.what}
        status={<SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} />}
        onClose={() => void close()}
        footerStart={
          <button type="button" className="btn btn-outline" onClick={() => setVoiding(true)}>Void this line</button>
        }
        footer={<button type="button" className="btn btn-outline" onClick={() => void close()}>Done</button>}
      >
        <div className={moneyKit.pair}>
          <DirectionField id="le-money" value={d.entryType} onChange={v => set({ entryType: v, word: v === d.entryType ? d.word : null })} />
          <DayField id="le-date" label="Date" value={d.date} onChange={v => set({ date: v })} />
        </div>
        <TextField id="le-what" label="What" required value={d.what} onChange={v => set({ what: v })} maxLength={500} />
        <TextField id="le-amount" label="Amount" required value={d.amount} onChange={v => set({ amount: v })} />
        <FiledUnderField id="le-word" words={words} value={d.word} onChange={v => set({ word: v })}
          direction={d.entryType === 'income' ? 'in' : 'out'} orgSlug={orgSlug} q={q} date={d.date}
          hint={!row.filedUnder && row.legacyCategory ? wasCategoryWord(row.legacyCategory) : null} />
        <PayeeField id="le-payee" q={q} value={d.payee} onChange={v => set({ payee: v })} payeesHref={payeesHref}
          label={d.entryType === 'income' ? 'Paid by' : 'Paid to'} />
        <div className={moneyKit.pair}>
          <MethodField id="le-method" label="How it was paid" value={d.method} onChange={v => set({ method: v })} required={false} />
          <TextField id="le-ref" label="Reference" value={d.reference} onChange={v => set({ reference: v })} />
        </div>
        <StatusField id="le-status" value={d.status} onChange={v => set({ status: v })} />
        <label className={ck.field} htmlFor="le-notes">
          <span className={ck.label}>Notes</span>
          <textarea id="le-notes" className={ck.textarea} rows={2} maxLength={2000} value={d.notes} onChange={e => set({ notes: e.target.value })} />
        </label>
        <p className={ck.hint}>Recorded by {row.recordedBy ?? 'someone at the club'}, {day(row.recordedAt)}. Changes save as you type.</p>
      </KitDialog>
      {voiding && (
        <VoidLineQuestion row={row} book={book} q={q}
          onClose={() => setVoiding(false)}
          onDone={(text, keepOpen) => { if (keepOpen) { onChanged(null); return; } setVoiding(false); onChanged(text); onClose(); }} />
      )}
    </>
  );
}

/**
 * A refused void re-reads the book behind the still-open question. The void routes answer "it changed
 * under you" as a 400 ("Entry is already voided") or a 409 `already_void` — not `money_state_changed` —
 * so every refusal is read as stale here: the server's sentence stays in the question, the book catches up.
 */
const rereadOnRefusal = (r: MoveResult): MoveResult => (r.ok ? r : { ...r, stale: true });

/** Void a line you typed: asks, with a reason; the line stays, marked void. Not red (a correction). */
function VoidLineQuestion({ row, book, q, onClose, onDone }: {
  row: BookRowOut; book: BookRef; q: string; onClose: () => void; onDone: (text: string | null, keepOpen?: boolean) => void;
}) {
  return (
    <ReasonQuestion
      eyebrow={`${book.name} · ${day(row.date)}`}
      title="Void this line?"
      lead={<>{money(row.moneyOut ?? row.moneyIn)} {row.moneyOut != null ? 'out' : 'in'} · {row.what}. It stays on {book.name}, marked void, with your reason, and counts nowhere.</>}
      label="Why are you voiding it?"
      placeholder="For example: entered twice"
      hint="Your reason and your name print under the line."
      missing="Say why it’s being voided."
      confirmLabel="Void the line"
      busyLabel="Voiding…"
      failText="The line couldn’t be voided."
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      submit={reason => moneyMove(`/api/admin/accounting/ledgers/${book.id}/entries/${row.id}?${q}`, jsonInit('DELETE', { reason }), {
        fallback: 'The line couldn’t be voided. Please try again.',
        done: `${row.what} is voided. It stays on ${book.name}, marked void, with your reason.`,
      }).then(rereadOnRefusal)}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

/**
 * A line from a source, a transfer half, a void line, or any line on a team's book: read here. ⚖ Its
 * BODY is the shared kit's `LedgerLineRead` (Ledger Parity D3, 2026-10-02) — the coach's Ledger opens
 * a line another tab wrote into the same read shape (facts, where it is changed, one door), so the two
 * windows cannot drift; the frame stays the admin's `KitDialog`.
 */
function ReadLineWindow({ row, book, q, accountingBase, canMove, onChanged, onClose }: {
  row: BookRowOut; book: BookRef; q: string; accountingBase: string; canMove: boolean;
  onChanged: (text: string | null) => void; onClose: () => void;
}) {
  const [voiding, setVoiding] = useState(false);
  const door = sourceDoor(row, accountingBase);
  const isTransfer = row.source.kind === 'transfer';
  const amount = `${money(row.moneyIn ?? row.moneyOut)} ${row.moneyIn != null ? 'in' : 'out'}`;
  const sourceWord = row.source.kind === 'allocation' ? 'Allocation' : row.source.kind === 'request' ? 'Payment request'
    : row.source.kind === 'league_fee' ? 'House league fee' : isTransfer ? 'Transfer' : book.name;
  const teamSide = row.source.kind === 'allocation' ? 'On their Club page as received'
    : row.source.kind === 'request' ? 'On their Club page as decided' : null;
  const canVoidBoth = canMove && row.status !== 'void' && row.can.void === 'both_halves';

  return (
    <>
      <KitDialog
        kind="form"
        eyebrow={`${sourceWord} · ${day(row.date)}`}
        title={row.what}
        onClose={onClose}
        footerStart={canVoidBoth ? (
          <button type="button" className="btn btn-outline" onClick={() => setVoiding(true)}>Void this transfer</button>
        ) : undefined}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
            {door && <Link href={door.href} className="btn btn-outline">{door.label} <ChevronRight size={14} aria-hidden /></Link>}
          </>
        }
      >
        <LedgerLineRead
          lead={row.status === 'void' && (
            <p className={moneyKit.lead1}><RepChip>Void</RepChip> {row.voided?.reason ? `“${row.voided.reason}”` : 'No reason was given.'}{row.voided?.by ? ` · ${row.voided.by}` : ''}{row.voided?.at ? `, ${day(row.voided.at)}` : ''}</p>
          )}
          facts={[
            ['Amount', amount],
            row.filedUnder
              ? ['Filed under', `${row.filedUnder.categoryName}${row.filedUnder.itemName && row.filedUnder.itemName !== row.filedUnder.categoryName ? ` › ${row.filedUnder.itemName}` : ''}${row.filedUnder.byItsSource ? ` · ${FILED_BY_ITS_SOURCE.toLowerCase()}` : ''}`]
              : row.category ? ['Filed under', `${row.category}${row.legacyCategory ? ` · ${wasCategoryWord(row.legacyCategory)}` : ''}`] : null,
            row.detail ? ['How it came', row.detail] : null,
            ['On', day(row.date)],
            isTransfer && row.source.kind === 'transfer' && row.source.partnerLedgerName
              ? ['The other half', `${row.moneyIn != null ? 'Out of' : 'Into'} ${row.source.partnerLedgerName}`] : null,
            ['Recorded by', `${row.recordedBy ?? 'Someone at the club'}, ${day(row.recordedAt)}`],
            teamSide ? ['The team’s side', teamSide] : null,
            row.status === 'pending' ? ['Status', 'Pending — not cleared yet'] : null,
          ]}
          where={book.kind === 'team'
            ? 'A team’s book is kept by its coaches and is read-only here. Money moves between the club and a team through allocations and payment requests.'
            : row.source.kind === 'allocation'
              ? 'This line was written when the payment was recorded. To change it, undo the payment on the allocation, and both books follow.'
              : row.source.kind === 'request'
                ? 'This line was written when the request was decided. To change it, reverse the approval on the request, and both books follow.'
                : row.source.kind === 'league_fee'
                  ? 'This line was written by a house league registration fee. Change it on the registration.'
                  : isTransfer && row.status !== 'void' && !canVoidBoth
                    ? 'A transfer is changed by voiding both halves and entering it again.'
                    : null}
        />
      </KitDialog>
      {voiding && row.source.kind === 'transfer' && (
        <VoidTransferQuestion row={row} book={book} q={q}
          onClose={() => setVoiding(false)}
          onDone={(text, keepOpen) => { if (keepOpen) { onChanged(null); return; } setVoiding(false); onChanged(text); onClose(); }} />
      )}
    </>
  );
}

/** Void a transfer: names BOTH halves and their books, and voids both (C13). Not red: a correction. */
function VoidTransferQuestion({ row, book, q, onClose, onDone }: {
  row: BookRowOut; book: BookRef; q: string; onClose: () => void; onDone: (text: string | null, keepOpen?: boolean) => void;
}) {
  const other = row.source.kind === 'transfer' ? row.source.partnerLedgerName ?? 'the other book' : 'the other book';
  const out = row.moneyOut != null;
  const amt = money(row.moneyIn ?? row.moneyOut);
  return (
    <ReasonQuestion
      eyebrow={`Transfer · ${day(row.date)}`}
      title="Void this transfer?"
      lead={<>Both halves are voided: {amt} {out ? `out of ${book.name} and ${amt} into ${other}` : `out of ${other} and ${amt} into ${book.name}`}. Each line stays on its own book, marked void, with your reason.</>}
      label="Why are you voiding it?"
      placeholder="For example: the float went on the wrong tournament"
      hint="Your reason and your name print under both lines."
      missing="Say why it’s being voided."
      confirmLabel="Void both halves"
      busyLabel="Voiding…"
      failText="The transfer couldn’t be voided."
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      submit={reason => moneyMove(`/api/admin/accounting/transfers/${row.id}/void?${q}`, jsonInit('POST', { reason }), {
        fallback: 'The transfer couldn’t be voided. Please try again.',
        done: 'The transfer is voided on both books. Each line stays, marked void, with your reason.',
      }).then(rereadOnRefusal)}
      onClose={onClose}
      onDone={onDone}
    />
  );
}
