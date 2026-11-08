'use client';

/**
 * Reports › GST/HST return (GST/HST Stage 4b Session B; build prompt docs/projects/active/GST_HST_STAGE4B_BUILD_PROMPT.md,
 * drawings tab 5 the worksheet, tab 6 states A-C, tab 9 the phone half).
 *
 * ⚖ THE SCREEN WORDS AND LAYS OUT THE ENGINE'S WORKSHEET; IT DECIDES NOTHING. Every figure, part, state and "Before you file"
 * item comes from `buildWorksheet` (lib/gst-return-worksheet.ts) through the route; the words are lib/gst-return-worksheet-text.ts.
 * ⚖ "Not available" is never $0; negative money is in words; calculated lines (105, 108, 109) open nothing.
 * ⚖ Nothing here reaches the Overview. "Mark as filed…" (state D) is Session C.
 * The period is the page's (shared with Spending); a return needs dates, so "All confirmed dates" is not offered here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import kit from '../console.module.css';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import DateInput from '@/components/shared/DateInput';
import { consoleDate } from '@/lib/console-dates';
import { csvCell, type ExpenseRevision } from '@/lib/bookkeeping-expenses';
import { downloadCSVBlob } from '@/lib/export';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { WORKSHEET_LINES, type LineNumber, type NotAvailableWhy, type UnresolvedKind, type Worksheet } from '@/lib/gst-return-worksheet';
import {
  copyLinesText, FOOTNOTE, formatMoney, LINE_104_UNTRACKED, lineFigure, NOT_AVAILABLE, NOT_ON_RETURN_STEPS, RETURN_LINES,
  taxGroupLabel, UNRESOLVED_ORDER, unresolvedCount, worksheetCsvRows,
} from '@/lib/gst-return-worksheet-text';
import type { GstReturnResponse } from '@/app/api/platform-admin/bookkeeping/gst-return/route';
import type { ReportPeriod } from './ReportsSpending';
import GstReturnWindow, { lineWindow, type ReturnWindow } from './GstReturnWindows';
import styles from './ReportsGstReturn.module.css';

const PERIODS: { id: Exclude<ReportPeriod, 'all'>; label: string }[] = [
  { id: 'year', label: 'This year to date' }, { id: 'last_year', label: 'Last calendar year' },
  { id: 'last_quarter', label: 'Last quarter' }, { id: 'last_month', label: 'Last month' }, { id: 'month', label: 'This month to date' },
  { id: 'custom', label: 'Custom dates' },
];
const FOLDS: readonly LineNumber[] = [101, 103, 107];
const SALES_FAILURES = ['sales_unread', 'registration_unread'] as const;
type Load = { state: 'idle' | 'loading' } | { state: 'ready'; body: GstReturnResponse } | { state: 'error'; error: string };

/** One "can't know" sentence per failure (drawing tab 6, state A, and the registration date's two cases). */
function failureNote(why: NotAvailableWhy, registration: GstReturnResponse['registration']): { title: string; body: string; retry: boolean } {
  if (why === 'sales_unread') return { title: 'Sales couldn’t be read', body: 'The record of your invoices didn’t answer. Lines 101, 103, 104, 105, 107, 108 and 109 need it. Line 106 still stands: it comes from your expenses.', retry: true };
  if (why === 'expenses_unread') return { title: 'Your expenses couldn’t be read', body: 'The Bookkeeping store didn’t answer. Lines 106, 108 and 109 need it. The sales lines still stand.', retry: true };
  if (why === 'expenses_too_many') return { title: 'Too many expense records to add up here', body: 'This worksheet reads up to 1,000 expense records so it never leaves the oldest out. Lines 106, 108 and 109 need them all. Use the accountant package until this read is paged.', retry: false };
  if (registration === 'unset') return { title: 'Your GST/HST registration date isn’t recorded yet', body: 'Every line needs it: sales and credits dated before it are outside the return. It is recorded once bookkeeping storage is updated.', retry: false };
  return { title: 'Your registration date couldn’t be read', body: 'Every line needs it: sales and credits dated before it are outside the return.', retry: true };
}

export default function ReportsGstReturn({
  reportPeriod, onChooseReportPeriod, onCustomPeriod, from, to, onFrom, onTo, invalidPeriod, expenses, onOpenExpense, onAddNumber,
}: {
  reportPeriod: ReportPeriod; onChooseReportPeriod: (value: ReportPeriod) => void; onCustomPeriod: () => void;
  from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void; invalidPeriod: boolean;
  expenses: ExpenseRevision[];
  onOpenExpense: (row: ExpenseRevision, list: ExpenseRevision[]) => void; onAddNumber: (row: ExpenseRevision, list: ExpenseRevision[]) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; body?: GstReturnResponse; error?: string } | null>(null);
  const [open, setOpen] = useState<Set<LineNumber>>(() => new Set([103]));
  const [windowOpen, setWindowOpen] = useState<ReturnWindow | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const ready = Boolean(from && to && !invalidPeriod);
  /** One read per period (and per Try again); the answer is kept only for the read that asked for it. */
  const key = ready ? `${from}|${to}|${attempt}` : null;

  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    fetch(`/api/platform-admin/bookkeeping/gst-return?${new URLSearchParams({ from, to })}`, { cache: 'no-store', signal: abort.signal })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? 'Unable to work out the return');
        setResult({ key, body: body as GstReturnResponse });
      })
      .catch(cause => { if (!abort.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : 'Unable to work out the return' }); });
    return () => abort.abort();
  }, [key, from, to]);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  const load: Load = !key ? { state: 'idle' } : result?.key !== key ? { state: 'loading' }
    : result.body ? { state: 'ready', body: result.body } : { state: 'error', error: result.error ?? 'Unable to work out the return' };

  const body = load.state === 'ready' ? load.body : null;
  const worksheet = body?.worksheet ?? null;
  const periodLabel = from && to ? `${consoleDate(from)} to ${consoleDate(to)}` : 'Choose the dates';
  const toggle = (line: LineNumber) => setOpen(current => { const next = new Set(current); if (next.has(line)) next.delete(line); else next.add(line); return next; });
  const allOpen = FOLDS.every(line => open.has(line));

  function exportWorksheet(ws: Worksheet) {
    downloadCSVBlob(`fieldlogichq-gst-hst-worksheet-${ws.period.from}-to-${ws.period.to}.csv`,
      worksheetCsvRows(ws).map(row => row.map(csvCell).join(',')).join('\n'));
  }

  const period = <>
    <SingleSelectDropdown lead label="Period" options={PERIODS} value={reportPeriod === 'all' ? 'year' : reportPeriod}
      onChange={next => onChooseReportPeriod(next as ReportPeriod)} />
    {reportPeriod === 'custom' && <span className={styles.dates}>
      <label>From<DateInput className={kit.field} value={from} onChange={v => { onFrom(v); onCustomPeriod(); }} /></label>
      <label>To<DateInput className={kit.field} value={to} onChange={v => { onTo(v); onCustomPeriod(); }} /></label>
    </span>}
  </>;

  return <section className={`${kit.card} ${styles.view}`} aria-labelledby="gst-return-title">
    <div className={`${kit.toolbar} ${styles.toolbar}`}>
      {period}
      <button type="button" className={`btn btn-secondary ${styles.deskOnly}`} disabled={!worksheet}
        onClick={() => setOpen(allOpen ? new Set() : new Set(FOLDS))}>{allOpen ? 'Fold all' : 'Expand all'}</button>
      <span className={kit.toolbarEnd}>
        <button type="button" className="btn btn-secondary" disabled={!worksheet} onClick={() => worksheet && void copy(copyLinesText(worksheet))}>{copied ? 'Copied' : 'Copy lines'}</button>
        <button type="button" className={`btn btn-secondary ${styles.deskOnly}`} disabled={!worksheet} onClick={() => worksheet && exportWorksheet(worksheet)}>Worksheet CSV</button>
      </span>
    </div>

    <div className={styles.body}>
      <div>
        <p className={kit.eye} id="gst-return-title">Worksheet for your return · regular method</p>
        <p className={kit.caption}>Sales by the date each invoice was issued, paid or not. Credits by expense date. Nothing is filed from here.</p>
      </div>

      {!ready && <p role="status" className={kit.callout}>{invalidPeriod ? 'Choose a From date on or before the To date.' : 'Choose both dates to work out the return.'}</p>}
      {load.state === 'loading' && <p role="status" className={kit.caption}>Working out the return…</p>}
      {load.state === 'error' && <div role="alert" className={`${kit.callout} ${kit.calloutBad}`}><span><strong>The return couldn’t be worked out.</strong> {load.error}</span>
        <span className={kit.calloutEnd}><button type="button" className={kit.door} onClick={retry}>Try again</button></span></div>}

      {worksheet && body && <WorksheetBody worksheet={worksheet} registration={body.registration} open={open} onToggle={toggle}
        onWindow={setWindowOpen} onRetry={retry} />}
    </div>

    {windowOpen && worksheet && body && <GstReturnWindow open={windowOpen} worksheet={worksheet} clubs={body.clubs} periodLabel={periodLabel}
      expenses={expenses} onOpenExpense={onOpenExpense} onAddNumber={onAddNumber} onClose={() => setWindowOpen(null)} />}
  </section>;
}

function WorksheetBody({ worksheet, registration, open, onToggle, onWindow, onRetry }: {
  worksheet: Worksheet; registration: GstReturnResponse['registration']; open: Set<LineNumber>;
  onToggle: (line: LineNumber) => void; onWindow: (w: ReturnWindow) => void; onRetry: () => void;
}) {
  // One sentence per thing the worksheet can't know. A registration failure blanks both sides, so it stands alone.
  const failures = worksheet.failures.includes('registration_unread') ? (['registration_unread'] as NotAvailableWhy[]) : worksheet.failures;
  const kinds = useMemo(() => {
    const counts = new Map<UnresolvedKind, number>();
    for (const u of worksheet.unresolved) counts.set(u.kind, (counts.get(u.kind) ?? 0) + 1);
    return UNRESOLVED_ORDER.filter(k => counts.has(k)).map(k => ({
      kind: k, count: counts.get(k)!, info: worksheet.unresolved.find(u => u.kind === k)!.affects.length === 0,
    }));
  }, [worksheet]);
  const action = kinds.filter(k => !k.info);
  const info = kinds.filter(k => k.info);
  const notes = worksheet.parts[107].creditNotes.reduce((sum, r) => sum + r.cents, 0);
  const badDebts = worksheet.parts[107].badDebts.reduce((sum, r) => sum + r.cents, 0);
  const bridge = worksheet.parts[106].notOnReturn;
  const fromDay = consoleDate(worksheet.period.from);
  const toDay = consoleDate(worksheet.period.to);

  /** A line's figure: a dotted door when something stands behind it, plain otherwise; Not available in words. */
  function figure(line: LineNumber) {
    const shown = lineFigure(worksheet, line);
    if (shown == null) return <span className={styles.na}>{NOT_AVAILABLE}</span>;
    const door = lineWindow(worksheet, line);
    return door ? <button type="button" className={styles.figure} onClick={() => onWindow(door)}>{shown}</button> : <span>{shown}</span>;
  }
  const partial = (line: LineNumber) => worksheet.lines[line].partial && <span className={`${kit.chip} ${kit.chipWarn}`}>PARTIAL</span>;
  const salesKnown = !SALES_FAILURES.some(f => worksheet.failures.includes(f));
  const subRows: Partial<Record<LineNumber, { key: string; label: string; cents: number; onOpen?: () => void }[]>> = salesKnown ? {
    101: [
      { key: 'zero', label: 'Zero-rated sales included', cents: worksheet.parts[101].zeroRatedCad },
      { key: 'notes', label: 'Credit notes issued · beside the line, not taken off it', cents: worksheet.parts[101].creditNotesIssuedCad },
    ],
    103: worksheet.parts[103].groups.map(g => ({ key: `${g.taxType}|${g.rate}|${g.region}`, label: taxGroupLabel(g), cents: g.cents, onOpen: () => onWindow({ kind: 'sales', line: 103, group: g }) })),
    107: [
      { key: 'notes', label: 'Credit notes issued', cents: notes, onOpen: worksheet.parts[107].creditNotes.length ? () => onWindow({ kind: 'relief', line: 107, part: 'notes' }) : undefined },
      { key: 'bad', label: 'Bad debts written off', cents: badDebts, onOpen: worksheet.parts[107].badDebts.length ? () => onWindow({ kind: 'relief', line: 107, part: 'badDebts' }) : undefined },
    ],
  } : {};
  const foldable = (line: LineNumber) => FOLDS.includes(line) && Boolean(subRows[line]?.length);
  const phoneNote: Partial<Record<LineNumber, string>> = salesKnown ? {
    101: worksheet.parts[101].zeroRatedCad ? `Includes ${formatMoney(worksheet.parts[101].zeroRatedCad)} zero-rated sales` : '',
    103: worksheet.parts[103].groups.length ? `${new Set(worksheet.parts[103].groups.map(g => g.region)).size} provinces · ${worksheet.parts[103].invoices.length} invoices` : '',
    107: notes || badDebts ? `Credit notes ${formatMoney(notes)} · bad debts ${formatMoney(badDebts)}` : '',
  } : {};

  return <>
    {failures.map(why => { const note = failureNote(why, registration); return <div key={why} role="alert" className={`${kit.callout} ${kit.calloutWarn}`}>
      <span><strong>{note.title}</strong> {note.body}</span>
      {note.retry && <span className={kit.calloutEnd}><button type="button" className={kit.door} onClick={onRetry}>Try again</button></span>}
    </div>; })}
    {worksheet.partial && <div role="status" className={`${kit.callout} ${kit.calloutWarn}`}><span>
      {worksheet.salesRecordStart
        ? <><strong>Sales are recorded from {consoleDate(worksheet.salesRecordStart)}</strong> Invoices issued before that day aren’t in these lines, so the sales lines are marked partial.</>
        : <><strong>We can’t yet tell where the sales record starts</strong> Until the daily job confirms its catch-up of older invoices, the sales lines are marked partial.</>}
    </span></div>}
    {worksheet.nothingSold && <div role="status" className={kit.callout}><span><strong>Nothing sold in this period</strong> No invoice was issued between {fromDay} and {toDay}. Enter 0 on lines 101 and 103. Your credits still count.</span></div>}

    {kinds.length > 0 && <div className={`${kit.callout} ${kit.calloutWarn} ${styles.beforeYouFile}`}>
      <strong>Before you file</strong>
      {action.length > 0 && <span className={styles.items}>{action.map((k, i) => <span key={k.kind}>{i > 0 && ' · '}
        <button type="button" className={styles.itemDoor} onClick={() => onWindow({ kind: 'unresolved', item: k.kind })}>{unresolvedCount(k.kind, k.count)}</button></span>)}</span>}
      {info.length > 0 && <span className={styles.items}><span className={styles.infoLabel}>For your information:</span> {info.map((k, i) => <span key={k.kind}>{i > 0 && ' · '}
        <button type="button" className={styles.itemDoor} onClick={() => onWindow({ kind: 'unresolved', item: k.kind })}>{unresolvedCount(k.kind, k.count)}</button></span>)}</span>}
    </div>}

    {/* Desktop: the return's lines in the return's order. */}
    <div className={`${styles.frame} ${styles.deskOnly}`}><table className={styles.lines}>
      <thead><tr><th>Line</th><th>What goes in it</th><th className={kit.num}>Amount</th></tr></thead>
      <tbody>{WORKSHEET_LINES.flatMap(line => {
        const l = worksheet.lines[line];
        const text = RETURN_LINES[line];
        const isOpen = foldable(line) && open.has(line);
        const row = <tr key={line} className={`${l.calculated ? styles.calc : ''} ${line === 109 ? styles.net : ''}`}>
          <td className={styles.ln}>{line}</td>
          <td>
            {foldable(line)
              ? <button type="button" className={styles.fold} aria-expanded={isOpen} onClick={() => onToggle(line)}><span aria-hidden>{isOpen ? '▾' : '▸'}</span><b>{text.caption}</b></button>
              : <span className={styles.foldless}>{l.calculated ? <span className={styles.calcLabel}>{text.caption}</span> : <b>{text.caption}</b>}</span>}
            {' '}<span className={kit.caption}>· {text.hint}{l.calculated ? ' · Calculated' : ''}</span> {partial(line)}
            {line === 104 && <span className={styles.untracked}>{LINE_104_UNTRACKED}</span>}
          </td>
          <td className={kit.num}>{figure(line)}</td>
        </tr>;
        const subs = isOpen ? (subRows[line] ?? []).map(s => <tr key={`${line}-${s.key}`} className={styles.sub}>
          <td /><td>{s.label}</td>
          <td className={kit.num}>{s.onOpen ? <button type="button" className={`${styles.figure} ${styles.figureSub}`} onClick={s.onOpen}>{formatMoney(s.cents)}</button> : formatMoney(s.cents)}</td>
        </tr>) : [];
        return [row, ...subs];
      })}</tbody>
    </table></div>

    {/* Phone (drawing tab 9): one white card per line; tapping it opens its window as a full-screen sheet. */}
    <ol className={`${styles.cards} ${styles.phoneOnly}`}>{WORKSHEET_LINES.map(line => {
      const l = worksheet.lines[line];
      const door = lineWindow(worksheet, line);
      const shown = lineFigure(worksheet, line);
      const inner = <>
        <span className={styles.ln}>{line}</span>
        <span className={styles.cardText}>{l.calculated ? <span className={styles.calcLabel}>{RETURN_LINES[line].caption}</span> : <b>{RETURN_LINES[line].caption}</b>} {partial(line)}
          {phoneNote[line] && <small>{phoneNote[line]}</small>}
          {line === 104 && <small>{LINE_104_UNTRACKED}</small>}</span>
        <span className={shown == null ? styles.na : styles.cardValue}>{shown ?? NOT_AVAILABLE}</span>
        <span className={styles.chev} aria-hidden>{door ? '›' : ''}</span>
      </>;
      return <li key={line} className={`${l.calculated ? styles.cardCalc : styles.card} ${line === 109 ? styles.net : ''}`}>
        {door ? <button type="button" className={styles.cardDoor} onClick={() => onWindow(door)}>{inner}</button> : <div className={styles.cardDoor}>{inner}</div>}
      </li>;
    })}</ol>

    {bridge && NOT_ON_RETURN_STEPS.some(s => bridge[s.key].cents > 0) && <div className={styles.frame}>
      {NOT_ON_RETURN_STEPS.filter(s => bridge[s.key].cents > 0).map((s, i) => <div key={s.key} className={styles.lrow}>
        <span>{i === 0 && <><b>Not on the return</b> · </>}{s.label}</span>
        <button type="button" className={styles.figure} onClick={() => onWindow({ kind: 'credits', step: s.key })}>{formatMoney(bridge[s.key].cents)}</button>
      </div>)}
    </div>}
    <p className={kit.caption}>{FOOTNOTE}</p>
  </>;
}
