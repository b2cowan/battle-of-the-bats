'use client';
/**
 * THE BUDGET'S WINDOWS (Club Tier Stage 3b, session 2 — hub specimen 1; C10, C11, Asks 2, 4a, 4b, 4d).
 *
 *   a line            — READS FIRST AND EDITS WHOLE (owner, 2026-10-01, the standard): it opens to read —
 *                       what it plans, when, what it is filed under, its notes, and its allocations as a
 *                       section of the record with the unbilled part under them and its one action,
 *                       Allocate $X (outlined: it opens a form). ⚖ Stage 3c (Ask 6): Allocate TURNS THE WINDOW INTO
 *                       THE ALLOCATION FORM, in place (`AllocationWindow`) — no page; Cancel comes back to the line,
 *                       and Create comes back to it READING, the new allocation listed, Allocated updated, and the
 *                       floating pill saying what was made, once. The head's pencil turns the whole line into
 *                       its form; ✓ in the same spot turns it back. Edits save as you go (2026-09-24) with
 *                       the floating pill; a value the server would refuse is HELD and the pill says why,
 *                       once (the line-total floor: a total below what is allocated never saves — C11).
 *                       The record's name is among its fields in edit mode (the team record's precedent;
 *                       the drawing showed no name field — departure recorded at build).
 *   Add line          — creates ASK (2026-09-24): Money in or out, Filed under (money-in words too, Ask 4b),
 *                       the name, Planned, When, Notes. Planning a word already on the year ADDS to its line
 *                       (one word, one line, Ask 4a) — the form says so before it happens.
 *   From the teams    — the revenue row nobody types: the allocations it adds up, each opening its window.
 *   ⚖ Stage 3d (Ask 5): an allocation listed in a line's window or in From the teams opens BY HAND-OFF — this window
 *                       turns into the allocation's (`AllocationRecordWindow`), the way Allocate turns the line into
 *                       New allocation, and × turns it back, at the same place. Money moved inside it re-reads the plan.
 *   Tools             — the two rare panels that sat at the old page's foot, each a window: Categories
 *                       (rename the club's shared headings) and Words your teams use (publish a team's word).
 *
 * WHO: every write answers 3a's one money rule (owner, treasurer, an admin with Accounting — Ask 4d); the
 * page passes `canMove` and nothing here offers a write to anyone else. Every write button is disabled
 * while its request is in flight (session 1's call list: the server cannot tell a double click from a
 * second add).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus, X } from 'lucide-react';
import { useAllocationHandOff } from './AllocationRecordWindow';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { NoticePill, SavePill, repKit, useDeferredLoad } from '../RepKit';
import AllocationWindow from './AllocationWindow';
import { RecordFacts } from '@/components/coaches/kit';
import BudgetItemPicker, { type BudgetItemSelection } from '@/components/accounting/BudgetItemPicker';
import TeamBudgetItems from '@/components/accounting/TeamBudgetItems';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { NO_DATE_LABEL, whenSummary, whenMonthsText } from '@/lib/coach-budget-periods-view';
import { formatMonthLong, type MonthKey } from '@/lib/coach-budget-months';
import {
  CLUB_BUDGET_REFUSAL, FROM_THE_TEAMS_WORD, LINE_ALLOCATIONS_WORD, NOT_ALLOCATED_LEAD, YEAR_LINE_WORDS, allocationRowCaption,
} from '@/lib/club-money-words';
import { formatStoredDate } from '@/lib/timezone';
import { clubYearMonths, type ClubPlanPeriod, type PlanAllocationRow, type PlanLineRow } from '@/lib/club-budget-report';
import type { FiscalYear } from '@/lib/club-fiscal-year';
import type { BudgetCategoryWithItems } from '@/lib/types';
import { FormError, TextField, jsonInit, money, moneyFetch, moneyKit, parseAmount as parseKitAmount, refusalText } from './MoneyKit';
import cr from './ClubReport.module.css';

// ── When does this money move? The coach's three answers, the coach's words ─────────────────────

type WhenAnswer = 'month' | 'split' | 'none';
/** The coach's own order and words (budget panel `WHEN_ANSWERS`): dating first, the exception last. */
const WHEN_ANSWERS: { id: WhenAnswer; label: string }[] = [
  { id: 'month', label: 'One month' },
  { id: 'split', label: 'Split across periods' },
  { id: 'none', label: NO_DATE_LABEL },
];

interface PeriodDraft { key: number; date: string; label: string; amount: string }
interface WhenDraft { answer: WhenAnswer | null; month: string; periods: PeriodDraft[] }

let periodKey = 0;
const blankPeriod = (): PeriodDraft => ({ key: ++periodKey, date: '', label: '', amount: '' });

/** A plan line's amount: the ledger's parser with the plan's own cap. */
const parseAmount = (s: string) => parseKitAmount(s, 9_999_999.99);
const cents = (n: number) => Math.round(n * 100);

/** A saved line's dates read back into an answer: none → No date yet; one dated the 1st for the whole
 *  line → One month; anything else → Split. */
function whenFromPeriods(periods: readonly ClubPlanPeriod[], total: number): WhenDraft {
  if (periods.length === 0) return { answer: 'none', month: '', periods: [blankPeriod()] };
  const one = periods.length === 1 ? periods[0] : null;
  if (one?.date && one.date.endsWith('-01') && cents(one.amount) === cents(total)) {
    return { answer: 'month', month: one.date.slice(0, 7), periods: [blankPeriod()] };
  }
  return {
    answer: 'split', month: '',
    periods: periods.map(p => ({ key: ++periodKey, date: p.date ?? '', label: p.label, amount: p.amount.toFixed(2) })),
  };
}

/** The payload's dates for an answer, or why they can't be saved yet. */
function periodsFromWhen(w: WhenDraft, total: number | null): { periods: { label: string; date: string | null; amount: number }[] | null; problem: string | null } {
  if (w.answer === null) return { periods: null, problem: 'Choose when this money moves.' };
  if (w.answer === 'none') return { periods: [], problem: null };
  if (total == null) return { periods: null, problem: null };
  if (w.answer === 'month') {
    if (!w.month) return { periods: null, problem: 'Choose the month.' };
    return { periods: [{ label: formatMonthLong(w.month as MonthKey), date: `${w.month}-01`, amount: total }], problem: null };
  }
  const out: { label: string; date: string | null; amount: number }[] = [];
  for (const p of w.periods) {
    const amount = parseAmount(p.amount);
    if (amount == null) return { periods: null, problem: CLUB_BUDGET_REFUSAL.bad_period_amount };
    const label = p.label.trim() || (p.date ? formatStoredDate(p.date, { withYear: false }) : '');
    if (!label) return { periods: null, problem: 'Each period needs a date or a name.' };
    out.push({ label, date: p.date || null, amount });
  }
  const sum = out.reduce((s, p) => s + cents(p.amount), 0);
  if (Math.abs(sum - cents(total)) > 2) return { periods: null, problem: CLUB_BUDGET_REFUSAL.periods_dont_add_up(sum / 100, total) };
  return { periods: out, problem: null };
}

/** The year's twelve months, for One month (a dropdown — a form picking one value is a dropdown). */
const yearMonths = (year: FiscalYearRef) => clubYearMonths(year).map(id => ({ id, label: formatMonthLong(id) }));

/** The fiscal year a window is about (Stage 3c): its key (addresses) and its name (words). */
type FiscalYearRef = Pick<FiscalYear, 'key' | 'name' | 'firstDay' | 'lastDay'>;

function WhenFields({ idBase, year, value, onChange, total, held }: {
  idBase: string; year: FiscalYearRef; value: WhenDraft; onChange: (next: WhenDraft) => void; total: number | null; held: boolean;
}) {
  const set = (patch: Partial<WhenDraft>) => onChange({ ...value, ...patch });
  const setPeriod = (key: number, patch: Partial<PeriodDraft>) =>
    set({ periods: value.periods.map(p => (p.key === key ? { ...p, ...patch } : p)) });
  const sum = value.periods.reduce((s, p) => s + cents(parseAmount(p.amount) ?? 0), 0) / 100;
  const adds = total != null && Math.abs(cents(sum) - cents(total)) <= 2;
  return (
    <>
      <label className={ck.field} htmlFor={`${idBase}-when`}>
        <span className={ck.label}>When<span className={repKit.req} aria-hidden>*</span></span>
        <select id={`${idBase}-when`} className={ck.select} value={value.answer ?? ''}
          onChange={e => set({ answer: (e.target.value || null) as WhenAnswer | null })}>
          <option value="">Choose…</option>
          {WHEN_ANSWERS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>
      {value.answer === 'month' && (
        <label className={ck.field} htmlFor={`${idBase}-month`}>
          <span className={ck.label}>Month<span className={repKit.req} aria-hidden>*</span></span>
          <select id={`${idBase}-month`} className={ck.select} value={value.month} onChange={e => set({ month: e.target.value })}>
            <option value="">Choose…</option>
            {yearMonths(year).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      )}
      {value.answer === 'split' && (
        <>
          {value.periods.map((p, i) => (
            <div key={p.key} className={cr.periodRow}>
              <label className={ck.field} htmlFor={`${idBase}-pd-${p.key}`}>
                <span className={ck.label}>Date</span>
                <input id={`${idBase}-pd-${p.key}`} type="date" className={ck.input} value={p.date} onChange={e => setPeriod(p.key, { date: e.target.value })} />
              </label>
              <label className={ck.field} htmlFor={`${idBase}-pl-${p.key}`}>
                <span className={ck.label}>Name</span>
                <input id={`${idBase}-pl-${p.key}`} className={ck.input} value={p.label} maxLength={100}
                  placeholder={i === 0 ? 'For example: Spring permit' : undefined} onChange={e => setPeriod(p.key, { label: e.target.value })} />
              </label>
              <label className={ck.field} htmlFor={`${idBase}-pa-${p.key}`}>
                <span className={ck.label}>Amount</span>
                <input id={`${idBase}-pa-${p.key}`} className={`${ck.input}${held && !adds ? ` ${cr.held}` : ''}`} value={p.amount} inputMode="decimal"
                  placeholder="$0.00" onChange={e => setPeriod(p.key, { amount: e.target.value })} />
              </label>
              <button type="button" className={`btn btn-outline ${cr.removePeriod}`} aria-label={`Remove this period${p.label ? `, ${p.label}` : ''}`}
                disabled={value.periods.length === 1} onClick={() => set({ periods: value.periods.filter(x => x.key !== p.key) })}>
                <X size={14} aria-hidden />
              </button>
            </div>
          ))}
          <p className={`${cr.periodSum}${total != null && !adds ? ` ${cr.periodSumBad}` : ''}`}>
            {total != null ? <>The dates add up to {money(sum)} of {money(total)}.</> : <>The dates add up to {money(sum)}.</>}
          </p>
          <button type="button" className="btn btn-outline" onClick={() => set({ periods: [...value.periods, blankPeriod()] })}>
            <Plus size={14} aria-hidden /> Add a period
          </button>
        </>
      )}
    </>
  );
}

/** A line's word for the picker. */
const selectionOf = (l: { categoryId: string | null; categoryName: string | null; itemId: string | null; itemName: string | null }): BudgetItemSelection | null =>
  (l.categoryId && l.itemId ? { categoryId: l.categoryId, categoryName: l.categoryName ?? '', itemId: l.itemId, itemName: l.itemName ?? '', suggestedAmount: null } : null);

/** The word picker, as the old page and every coach money form wear it (`createItemMode="admin"`). */
function FiledUnderField({ id, categories, value, onChange, direction, orgSlug, held }: {
  id: string; categories: BudgetCategoryWithItems[]; value: BudgetItemSelection | null; onChange: (v: BudgetItemSelection) => void;
  direction: 'in' | 'out'; orgSlug: string; held?: boolean;
}) {
  return (
    <div className={ck.field}>
      <span className={ck.label} id={`${id}-label`}>Filed under<span className={repKit.req} aria-hidden>*</span></span>
      <BudgetItemPicker
        categories={categories}
        value={value}
        onChange={onChange}
        /* org-slug-ok: the picker appends `/{catId}/items`, so the org travels separately as `adminOrgSlug`
           and is added after the path (the old page's own wiring). */
        createItemEndpoint="/api/admin/accounting/budget-categories"
        createItemMode="admin"
        adminOrgSlug={orgSlug}
        suggestAmount
        direction={direction}
        selectId={`${id}-picker`}
        invalid={held}
      />
    </div>
  );
}

// ── A line: read first, edit whole ──────────────────────────────────────────────────────────────

/** "9U A, 10U A and 11U AA" up to three; else "9 teams". Teams outside the reader's groups are counted, never named. */
function teamsPhrase(a: PlanAllocationRow): string {
  const n = a.teamNames.length + a.otherTeams;
  if (a.otherTeams === 0 && a.teamNames.length > 0 && a.teamNames.length <= 3) {
    const t = a.teamNames;
    return t.length === 1 ? t[0] : `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}`;
  }
  return `${n} ${n === 1 ? 'team' : 'teams'}`;
}

/** The allocations a line carries — each opens the allocation's window in this one's place (Stage 3d, Ask 5). */
export function AllocationRows({ rows, onOpen }: { rows: readonly PlanAllocationRow[]; onOpen: (allocationId: string) => void }) {
  return (
    <div className={cr.windowRows}>
      {rows.map(a => (
        <button key={a.id} type="button" className={cr.windowRow} aria-haspopup="dialog" onClick={() => onOpen(a.id)}>
          <span className={cr.windowRowMain}>
            <span className={cr.windowRowTitle}>{a.description}</span>
            <span className={cr.windowRowSub}>{allocationRowCaption(teamsPhrase(a), 0, a.allocated, a.collected)}</span>
          </span>
          <ChevronRight size={16} aria-hidden className={cr.windowRowEnd} />
        </button>
      ))}
    </div>
  );
}

type LineDraft = { name: string; total: string; word: BudgetItemSelection | null; when: WhenDraft; notes: string };

const draftOfLine = (l: PlanLineRow): LineDraft => ({
  name: l.description, total: l.planned.toFixed(2), word: selectionOf(l), when: whenFromPeriods(l.periods, l.planned), notes: l.notes ?? '',
});

export function BudgetLineWindow({ line, year, q, orgSlug, canMove, locked = false, categories, onChanged, onClose }: {
  line: PlanLineRow; year: FiscalYearRef; q: string; orgSlug: string; canMove: boolean;
  /** The line's fiscal year is CLOSED (Ask 1): it reads with its two writes gone (no pencil — `canMove` is false —
   *  and no Allocate), and its unbilled part says the club paid it. */
  locked?: boolean;
  categories: BudgetCategoryWithItems[];
  /** A write landed (or was refused because the line changed): re-read the plan; the text is the notice. */
  onChanged: (text: string | null) => void;
  onClose: () => void;
}) {
  const isCost = line.direction === 'out';
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  /** The window turned into New allocation (Ask 6), and what it made — said once in the floating pill on return. */
  const [allocating, setAllocating] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  /** An allocation from the line's list, open in the window's place (Stage 3d, Ask 5) — × turns it back into the line. */
  const allocation = useAllocationHandOff({ q, orgSlug, onChanged: () => onChanged(null) });
  const original = useMemo(() => draftOfLine(line), [line]);
  const [d, setD] = useState<LineDraft>(original);
  const updatedAt = useRef(line.updatedAt);
  const saved = useRef(false);
  /* What the server holds now: the line as opened, then each save's own values. Diffing against the line
     as OPENED let an edit changed back (100 → 200 → 100) skip the total and say Saved over 200 (review). */
  const [held, setHeld] = useState(() => ({
    planned: line.planned, itemId: line.itemId, periods: JSON.stringify(periodsFromWhen(original.when, line.planned).periods),
  }));

  const total = parseAmount(d.total);
  const when = periodsFromWhen(d.when, total);
  const totalChanged = total != null && cents(total) !== cents(held.planned);
  const whenChanged = held.periods !== JSON.stringify(when.periods);
  const sendPeriods = totalChanged || whenChanged;
  const allocated = line.allocated ?? 0;
  /* ⚖ A HELD EDIT SAYS WHY, ONCE (the admin kit's pill carries the reason; the field takes the red edge). */
  const heldTotal = total != null && isCost && cents(total) < cents(allocated);
  const blocked = !d.name.trim() ? 'Give the line a name to save it.'
    : total == null ? CLUB_BUDGET_REFUSAL.bad_total
    : heldTotal ? CLUB_BUDGET_REFUSAL.below_allocated(allocated)
    : !d.word?.itemId ? CLUB_BUDGET_REFUSAL.word_required
    : sendPeriods && when.problem ? when.problem
    : null;
  const sig = JSON.stringify({ ...d, word: d.word?.itemId ?? null, when: when.periods });

  const write = useCallback(async (signal: AbortSignal) => {
    const body: Record<string, unknown> = {
      description: d.name.trim(), notes: d.notes.trim(), expectUpdatedAt: updatedAt.current,
    };
    if (d.word?.itemId && d.word.itemId !== held.itemId) body.itemId = d.word.itemId;
    if (totalChanged) body.totalAmount = total;
    if (sendPeriods && when.periods) body.periods = when.periods;
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const res = await fetch(`/api/admin/accounting/budget-plan/lines/${line.id}?${q}`, { ...jsonInit('PATCH', body), signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(refusalText(data, 'Couldn’t save'));
    if (data?.line?.updated_at) updatedAt.current = data.line.updated_at;
    saved.current = true;
    setHeld(h => ({
      planned: totalChanged && total != null ? total : h.planned,
      itemId: (body.itemId as string | undefined) ?? h.itemId,
      periods: body.periods ? JSON.stringify(body.periods) : h.periods,
    }));
  }, [d, line.id, held.itemId, q, total, totalChanged, sendPeriods, when.periods]);

  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: canMove && editing, loading: removing, sig, blocked, write, failText: 'Couldn’t save',
  });
  const set = (patch: Partial<LineDraft>) => { setD(x => ({ ...x, ...patch })); touch(); };

  // Closing inside the debounce sends the pending change first; a refused save holds the window ONCE,
  // with the reason in its pill — never a window that cannot be closed (3a's lesson).
  const closeRefused = useRef(false);
  const close = async () => {
    if (editing && dirty && !blocked && !closeRefused.current && !(await handleSave())) { closeRefused.current = true; return; }
    if (saved.current || closeRefused.current) onChanged(null);
    onClose();
  };
  const toggleEdit = async () => {
    if (editing && dirty && !blocked && !(await handleSave())) return;
    if (editing && saved.current) onChanged(null);
    setMade(null); // said once: the pencil ends it, and ✓ never says it again
    setEditing(e => !e);
  };

  const whenWords = line.periods.length === 0 ? NO_DATE_LABEL : null;

  if (allocation.shown) return allocation.shown;

  if (allocating) {
    return (
      <AllocationWindow
        q={q}
        line={{ id: line.id, description: line.description, left: line.notAllocated ?? 0, allocated: line.allocated ?? 0, yearName: year.name }}
        onCancel={() => setAllocating(false)}
        onMade={text => { setAllocating(false); setMade(text); onChanged(null); }}
      />
    );
  }

  return (
    <>
      <KitDialog
        kind="form"
        eyebrow={`Budget line · ${year.name}`}
        title={line.description}
        onClose={() => void close()}
        edit={canMove ? { editing, onToggle: () => void toggleEdit(), label: `Edit ${line.description}` } : undefined}
        status={editing ? <SavePill inline saving={saving} dirty={dirty} error={saveError || null} held={blocked} onRetry={() => void handleSave()} />
          : made ? <NoticePill inline key={made} message={made} onDone={() => setMade(null)} /> : undefined}
        footerStart={editing && canMove && line.allocations.length === 0 ? (
          <button type="button" className="btn btn-outline" onClick={() => setRemoving(true)}>Remove this line</button>
        ) : undefined}
        footer={<button type="button" className="btn btn-outline" onClick={() => void close()}>Done</button>}
      >
        {!editing ? (
          <>
            <RecordFacts rows={[
              ['Planned', money(line.planned)],
              // What the teams were billed from it — the figure Create updates when the window comes back (Ask 6).
              isCost && line.allocations.length > 0 ? ['Allocated', money(line.allocated)] : null,
              ['Filed under', line.categoryName && line.itemName ? `${line.categoryName} › ${line.itemName}` : 'Not filed under a word yet'],
              ['When', whenWords ?? (
                <span>
                  {line.periods.map((p, i) => (
                    <span key={i} className={cr.periodLine}>
                      <span className={cr.periodWhen}>{p.date ? formatStoredDate(p.date, { withYear: false }) : p.label}</span>
                      <span>{money(p.amount)}</span>
                    </span>
                  ))}
                </span>
              )],
              line.notes ? ['Notes', line.notes] : null,
            ]} />
            {isCost && (
              <section className={cr.recordSection} aria-label={LINE_ALLOCATIONS_WORD}>
                <h3 className={cr.recordSectionTitle}>{LINE_ALLOCATIONS_WORD}</h3>
                {line.allocations.length > 0
                  ? <AllocationRows rows={line.allocations} onOpen={id => { setMade(null); allocation.open(id); }} />
                  : <p className={ck.hint}>Nothing is allocated from this line yet.</p>}
                {(line.notAllocated ?? 0) > 0.005 && (
                  <div className={cr.leftBox}>
                    <span className={cr.leftBoxText}>
                      <span className={cr.leftBoxFigure}>{money(line.notAllocated)} not allocated</span>
                      <span className={cr.leftBoxSub}>{locked ? YEAR_LINE_WORDS.clubPaidLead : NOT_ALLOCATED_LEAD}</span>
                    </span>
                    {canMove && (
                      <button type="button" className="btn btn-outline" onClick={() => setAllocating(true)}>
                        Allocate {money(line.notAllocated)}
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            <TextField id="bl-name" label="Name" required value={d.name} onChange={v => set({ name: v })} maxLength={200} />
            <div className={moneyKit.pair}>
              <label className={ck.field} htmlFor="bl-total">
                <span className={ck.label}>Planned<span className={repKit.req} aria-hidden>*</span></span>
                <input id="bl-total" className={`${ck.input}${heldTotal ? ` ${cr.held}` : ''}`} value={d.total} inputMode="decimal"
                  onChange={e => set({ total: e.target.value })} aria-invalid={heldTotal || undefined} />
                {isCost && allocated > 0.005 && <p className={ck.hint}>{money(allocated)} is allocated from it.</p>}
              </label>
              <FiledUnderField id="bl-word" categories={categories} value={d.word} onChange={v => set({ word: v })}
                direction={line.direction} orgSlug={orgSlug} />
            </div>
            <WhenFields idBase="bl" year={year} value={d.when} onChange={v => set({ when: v })} total={total}
              held={!!blocked && blocked === when.problem} />
            <label className={ck.field} htmlFor="bl-notes">
              <span className={ck.label}>Notes</span>
              <textarea id="bl-notes" className={ck.textarea} rows={2} maxLength={2000} value={d.notes} onChange={e => set({ notes: e.target.value })} />
            </label>
            {line.allocations.length > 0 && <p className={ck.hint}>A line with an allocation drawn from it stays on the plan; it can’t be removed.</p>}
          </>
        )}
      </KitDialog>
      {removing && (
        <RemoveLineQuestion line={line} year={year} q={q} onClose={() => setRemoving(false)}
          onRemoved={text => { setRemoving(false); onChanged(text); onClose(); }} />
      )}
    </>
  );
}

/** Remove a line: asks first. Red — the line leaves the plan (nothing billed or recorded moves). */
function RemoveLineQuestion({ line, year, q, onClose, onRemoved }: {
  line: PlanLineRow; year: FiscalYearRef; q: string; onClose: () => void; onRemoved: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch(`/api/admin/accounting/budget-plan/lines/${line.id}?${q}`, { method: 'DELETE' });
      if (!r.ok) { setError(refusalText(r.data, 'The line couldn’t be removed. Please try again.')); return; }
      onRemoved(`${line.description} is off the ${year.name} plan.`);
    } catch {
      setError('The line couldn’t be removed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="question"
      eyebrow={`Budget line · ${year.name}`}
      title={`Remove ${line.description}?`}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Keep it</button>
          <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={busy}>{busy ? 'Removing…' : 'Remove the line'}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <p className={moneyKit.lead1}>{money(line.planned)} leaves the {year.name} plan. Nothing billed or recorded changes.</p>
    </KitDialog>
  );
}

// ── Add a line (creates ask) ────────────────────────────────────────────────────────────────────

export function AddLineWindow({ year, q, orgSlug, categories, onWord, onAdded, onClose }: {
  year: FiscalYearRef; q: string; orgSlug: string; categories: BudgetCategoryWithItems[];
  /** Is this word already on the year's plan? Its line's name and figure, for the one-word-one-line note. */
  onWord: (itemId: string) => { description: string; planned: number } | null;
  onAdded: (text: string) => void;
  onClose: () => void;
}) {
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [word, setWord] = useState<BudgetItemSelection | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState<WhenDraft>({ answer: null, month: '', periods: [blankPeriod()] });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = parseAmount(amount);
  const already = word?.itemId ? onWord(word.itemId) : null;

  async function add() {
    if (busy) return;
    if (!word?.itemId) { setError(CLUB_BUDGET_REFUSAL.word_required); return; }
    if (total == null) { setError(CLUB_BUDGET_REFUSAL.bad_total); return; }
    const w = periodsFromWhen(when, total);
    if (w.problem || !w.periods) { setError(w.problem ?? 'Choose when this money moves.'); return; }
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch<{ line: { description: string }; joined: boolean }>(`/api/admin/accounting/budget-plan/lines?${q}`, jsonInit('POST', {
        fiscalYear: year.key, itemId: word.itemId, totalAmount: total,
        description: name.trim() || undefined, notes: notes.trim() || undefined, periods: w.periods,
      }));
      if (!r.ok) { setError(refusalText(r.data, 'The line couldn’t be added. Please try again.')); return; }
      onAdded(r.data.joined
        ? `${r.data.line.description} was already on the ${year.name} plan, so ${money(total)} was added to its line.`
        : `${r.data.line.description} added to the ${year.name} plan.`);
    } catch {
      setError('The line couldn’t be added. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      eyebrow={`Budget · ${year.name}`}
      title="Add a line"
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={() => void add()} disabled={busy}>{busy ? 'Adding…' : 'Add line'}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <label className={ck.field} htmlFor="al-money">
        <span className={ck.label}>Money<span className={repKit.req} aria-hidden>*</span></span>
        <select id="al-money" className={ck.select} value={direction} onChange={e => { setDirection(e.target.value as 'out' | 'in'); setWord(null); }}>
          <option value="out">Money the club spends</option>
          <option value="in">Money coming in</option>
        </select>
      </label>
      <FiledUnderField id="al-word" categories={categories} value={word} onChange={v => { setWord(v); if (!amount && v.suggestedAmount) setAmount(String(v.suggestedAmount)); }}
        direction={direction} orgSlug={orgSlug} />
      {already && (
        <p className={ck.hint}>
          {already.description} is already on the {year.name} plan at {money(already.planned)}. One word carries one line, so this adds to it.
        </p>
      )}
      <div className={moneyKit.pair}>
        <TextField id="al-name" label="Name" value={name} onChange={setName} maxLength={200}
          placeholder={word?.itemName || 'The word, unless you name it'} />
        <TextField id="al-amount" label="Planned" required value={amount} onChange={setAmount} placeholder="$0.00" />
      </div>
      <WhenFields idBase="al" year={year} value={when} onChange={setWhen} total={total} held={false} />
      <label className={ck.field} htmlFor="al-notes">
        <span className={ck.label}>Notes</span>
        <textarea id="al-notes" className={ck.textarea} rows={2} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} />
      </label>
    </KitDialog>
  );
}

// ── From the teams: the allocations it adds up ─────────────────────────────────────────────────

export function FromTheTeamsWindow({ year, rows, planned, periods, q, orgSlug, accountingBase, onChanged, onClose }: {
  year: FiscalYearRef; rows: readonly PlanAllocationRow[]; planned: number; periods: readonly ClubPlanPeriod[];
  q: string; orgSlug: string;
  /** Open Allocations, at the foot. */
  accountingBase: string;
  /** Money moved inside an allocation opened from here: re-read the plan. */
  onChanged: () => void;
  onClose: () => void;
}) {
  const months = whenMonthsText(whenSummary(periods.map(p => ({ periodDate: p.date, amount: p.amount })), planned));
  /** An allocation from the list, open in this window's place (Stage 3d, Ask 5) — × turns it back. */
  const allocation = useAllocationHandOff({ q, orgSlug, onChanged });
  if (allocation.shown) return allocation.shown;
  return (
    <KitDialog
      kind="form"
      eyebrow={`Revenue · ${year.name}`}
      title={FROM_THE_TEAMS_WORD}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Done</button>
          <Link className="btn btn-outline" href={`${accountingBase}/allocations`}>Open Allocations <ChevronRight size={14} aria-hidden /></Link>
        </>
      )}
    >
      <RecordFacts rows={[['Planned', money(planned)], ['When', months]]} />
      <p className={ck.hint}>What the club billed its teams from the year’s cost lines. Nobody types it: it is read from the allocations, each due on its installments’ dates.</p>
      {rows.length > 0
        ? <AllocationRows rows={rows} onOpen={id => allocation.open(id)} />
        : <p className={ck.hint}>Nothing is allocated from the {year.name} plan yet. A cost line’s window allocates it.</p>}
    </KitDialog>
  );
}

// ── Tools: Categories, and the words your teams use ─────────────────────────────────────────────

/** "Used by 6 teams and your club’s own budget" — what a rename would reach. */
function usageLine(cat: BudgetCategoryWithItems, usage: Record<string, { teamCount: number; usedByClub: boolean }>): string {
  if (cat.teamId) return cat.teamName ?? 'One of your teams';
  const use = usage[cat.id];
  if (!use) return cat.orgId ? 'Every team can plan under this' : 'Standard across every club';
  const parts: string[] = [];
  if (use.teamCount > 0) parts.push(`${use.teamCount} ${use.teamCount === 1 ? 'team' : 'teams'}`);
  if (use.usedByClub) parts.push('your club’s own budget');
  if (!parts.length) return cat.orgId ? 'Nobody is planning under it yet' : 'Standard across every club';
  return `Used by ${parts.join(' and ')}`;
}

/**
 * The headings every budget in the club sits under — ⚠ THE ONLY PLACE A CATEGORY CAN BE RENAMED (mig 277,
 * owner ruling Q4 2026-09-04), moved behind Tools from the old page's foot unchanged in what it does. ALL
 * THREE TIERS, grouped: the club's own (renamed here), the product's (fixed), the teams' (renamed by them).
 */
export function CategoriesWindow({ q, canMove, onRenamed, onClose }: {
  q: string; canMove: boolean; onRenamed: () => void; onClose: () => void;
}) {
  const [cats, setCats] = useState<BudgetCategoryWithItems[] | null>(null);
  const [usage, setUsage] = useState<Record<string, { teamCount: number; usedByClub: boolean }>>({});
  const [failed, setFailed] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
    const r = await moneyFetch<{ categories?: BudgetCategoryWithItems[]; usage?: Record<string, { teamCount: number; usedByClub: boolean }> }>(`/api/admin/accounting/budget-categories?usage=1&${q}`).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    setCats(r.data.categories ?? []);
    setUsage(r.data.usage ?? {});
  }, [q]);
  useDeferredLoad(true, load);

  async function save() {
    if (!renaming || busy) return;
    const name = renaming.value.trim();
    if (!name) { setError('A name is required.'); return; }
    setBusy(true); setError('');
    try {
      // org-slug-ok: `q` is the page's "orgSlug=…" query, passed in as a prop
      const r = await moneyFetch(`/api/admin/accounting/budget-categories/${renaming.id}?${q}`, jsonInit('PATCH', { name }));
      if (!r.ok) { setError(refusalText(r.data, 'The category couldn’t be renamed. Please try again.')); return; }
      setRenaming(null);
      await load();
      onRenamed();
    } finally {
      setBusy(false);
    }
  }

  const groups: { key: string; label: string; rows: BudgetCategoryWithItems[] }[] = cats ? [
    { key: 'club', label: 'Your club’s — every team uses these', rows: cats.filter(c => c.orgId && !c.teamId) },
    { key: 'platform', label: 'Comes with the product', rows: cats.filter(c => !c.orgId) },
    { key: 'team', label: 'Teams’ own — visible to you, renamed by them', rows: cats.filter(c => c.teamId) },
  ].filter(g => g.rows.length > 0) : [];

  return (
    <KitDialog kind="form" title="Categories" onClose={onClose} busy={busy}
      footer={<button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Done</button>}>
      <p className={ck.hint}>The headings every budget in the club sits under — yours and your teams’. Rename one of the club’s own and every team’s plan follows.</p>
      {/* The rename's own reason: its Save and Enter are in the body, not the foot (Done) — so it stays here (/review, Ask 11). */}
      <FormError inPlace>{error}</FormError>
      {failed ? <p className={ck.hint}>The categories couldn’t be loaded.</p> : !cats ? <p className={ck.loading}>Loading…</p> : groups.map(g => (
        <section key={g.key} className={cr.recordSection}>
          <h3 className={cr.recordSectionTitle}>{g.label}</h3>
          <div className={cr.windowRows}>
            {g.rows.map(cat => {
              const editing = renaming?.id === cat.id;
              const canRename = canMove && !!cat.orgId && !cat.teamId;
              return (
                <div key={cat.id} className={cr.windowRow}>
                  {editing ? (
                    <>
                      <input className={ck.input} value={renaming.value} maxLength={80} aria-label="Category name" data-autofocus=""
                        onChange={e => setRenaming({ id: cat.id, value: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') void save(); }} />
                      <button type="button" className="btn btn-outline" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                      <button type="button" className="btn btn-outline" onClick={() => { setRenaming(null); setError(''); }} disabled={busy}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className={cr.windowRowMain}>
                        <span className={cr.windowRowTitle}>{cat.name}</span>
                        <span className={cr.windowRowSub}>{usageLine(cat, usage)}</span>
                      </span>
                      {canRename && (
                        <button type="button" className="btn btn-outline" onClick={() => setRenaming({ id: cat.id, value: cat.name })}>Rename</button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </KitDialog>
  );
}

/** The club's window onto its teams' own budget words (mig 240) — publish one to every team. */
export function TeamWordsWindow({ orgSlug, canMove, onClose }: { orgSlug: string; canMove: boolean; onClose: () => void }) {
  return (
    <KitDialog kind="form" title="Words your teams use" onClose={onClose}
      footer={<button type="button" className="btn btn-outline" onClick={onClose}>Done</button>}>
      <TeamBudgetItems orgSlug={orgSlug} canWrite={canMove} inWindow />
    </KitDialog>
  );
}

