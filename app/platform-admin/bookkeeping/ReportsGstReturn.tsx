'use client';

/**
 * Reports › GST/HST return (GST/HST Stage 4b Session B; build prompt docs/projects/active/GST_HST_STAGE4B_BUILD_PROMPT.md,
 * drawings tab 5 the worksheet, tab 6 states A-C, tab 9 the phone half).
 *
 * ⚖ THE SCREEN WORDS AND LAYS OUT THE ENGINE'S WORKSHEET; IT DECIDES NOTHING. Every figure, part, state and "Before you file"
 * item comes from `buildWorksheet` (lib/gst-return-worksheet.ts) through the route; the words are lib/gst-return-worksheet-text.ts.
 * ⚖ "Not available" is never $0; negative money is in words; calculated lines (105, 108, 109) open nothing.
 * ⚖ Nothing here reaches the Overview.
 * Session C, "Mark as filed…" (state D): the door asks GstReturnFilingQuestion; a filed period shows its FILED tag, the figures as
 * filed and "Changed since you filed" (all worked out by the route from lib/gst-return-filing.ts), with today's figures folded below.
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
  changeSentence, copyLinesText, FILING, filedFigure, FOOTNOTE, formatMoney, LINE_104_UNTRACKED, lineFigure, NOT_AVAILABLE,
  NOT_ON_RETURN_STEPS, RETURN_LINES, taxGroupLabel, UNRESOLVED_ORDER, unresolvedCount, worksheetCsvRows,
} from '@/lib/gst-return-worksheet-text';
import KitDialog from '@/components/shared/KitDialog';
import type { FilingSummary, GstReturnResponse, ReturnFiling } from '@/app/api/platform-admin/bookkeeping/gst-return/route';
import type { ReportPeriod } from './ReportsSpending';
import GstReturnWindow, { lineWindow, type ReturnWindow } from './GstReturnWindows';
import GstReturnFilingQuestion from './GstReturnFilingQuestion';
import bk from './bookkeeping.module.css';
import styles from './ReportsGstReturn.module.css';

const PERIODS: { id: Exclude<ReportPeriod, 'all'>; label: string }[] = [
  { id: 'year', label: 'This year to date' }, { id: 'last_year', label: 'Last calendar year' },
  { id: 'last_quarter', label: 'Last quarter' }, { id: 'last_month', label: 'Last month' }, { id: 'month', label: 'This month to date' },
  { id: 'custom', label: 'Custom dates' },
];
const FOLDS: readonly LineNumber[] = [101, 103, 106, 107];
const SALES_FAILURES = ['sales_unread', 'registration_unread'] as const;
type Load = { state: 'idle' | 'loading' } | { state: 'ready'; body: GstReturnResponse } | { state: 'error'; error: string };

/** One "can't know" sentence per failure (drawing tab 6, state A, and the registration date's two cases). */
function failureNote(why: NotAvailableWhy, registration: GstReturnResponse['registration']): { title: string; body: string; retry: boolean } {
  if (why === 'sales_unread') return { title: 'Sales couldn’t be read', body: 'The record of your invoices didn’t answer. Lines 101, 103, 104, 105, 107, 108 and 109 need it. Line 106 still stands: it comes from your expenses.', retry: true };
  if (why === 'expenses_unread') return { title: 'Your expenses couldn’t be read', body: 'The Bookkeeping store didn’t answer. Lines 106, 108 and 109 need it. The sales lines still stand.', retry: true };
  if (why === 'expenses_too_many') return { title: 'Too many expense records to add up here', body: 'This worksheet reads up to 1,000 expense records so it never leaves the oldest out. Lines 106, 108 and 109 need them all. Use the accountant package until this read is paged.', retry: false };
  if (why === 'filings_unread') return { title: 'Your filed periods couldn’t be read', body: 'Line 106 includes credits released after an earlier period was filed, so lines 106, 108 and 109 need them. The sales lines still stand.', retry: true };
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
  /** Session C: the "Mark as filed…" question, the filing history window, and today's figures under a filed period. */
  const [asking, setAsking] = useState(false);
  const [askNotice, setAskNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Today's figures under a filed period open for ONE period: another period starts folded again (quiet by default). */
  const [liveFor, setLiveFor] = useState<string | null>(null);
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

  const periodKey = `${from}|${to}`;
  const liveOpen = liveFor === periodKey;
  const filing: ReturnFiling | null = body?.filing ?? null;
  const filed = filing?.state === 'filed' ? filing : null;
  /** The door shows for dates no filing covers or overlaps, once the filings could be read. */
  const canAsk = Boolean(worksheet && filing?.state === 'open');
  const live = worksheet && body ? <WorksheetBody worksheet={worksheet} registration={body.registration} open={open} onToggle={toggle}
    onWindow={setWindowOpen} onRetry={retry} /> : null;

  return <section className={`${kit.card} ${styles.view}`} aria-labelledby="gst-return-title">
    <div className={`${kit.toolbar} ${styles.toolbar}`}>
      {period}
      {filed
        // State D (drawing tab 6): the toolbar holds the period and the FILED tag; the tag opens the period's filings.
        ? <span className={kit.toolbarEnd}><button type="button" aria-haspopup="dialog" className={`${kit.chip} ${kit.chipOk} ${styles.filedChip}`} onClick={() => setHistoryOpen(true)}>{FILING.chip(filed.latest.filedOn)}</button></span>
        : <>
          <button type="button" className={`btn btn-secondary ${styles.deskOnly}`} disabled={!worksheet}
            onClick={() => setOpen(allOpen ? new Set() : new Set(FOLDS))}>{allOpen ? 'Fold all' : 'Expand all'}</button>
          <span className={kit.toolbarEnd}>
            <button type="button" className="btn btn-secondary" disabled={!worksheet} onClick={() => worksheet && void copy(copyLinesText(worksheet))}>{copied ? 'Copied' : 'Copy lines'}</button>
            <button type="button" className={`btn btn-secondary ${styles.deskOnly}`} disabled={!worksheet} onClick={() => worksheet && exportWorksheet(worksheet)}>Worksheet CSV</button>
            {canAsk && <button type="button" className={`btn btn-secondary ${styles.deskOnly}`} onClick={() => setAsking(true)}>{FILING.door}</button>}
          </span>
        </>}
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

      {filed ? <>
        <FiledBody filing={filed} />
        {/* The live figures never disappear: today's worksheet for the same dates, quiet and folded below the filing. */}
        <button type="button" className={styles.fold} aria-expanded={liveOpen} aria-controls="gst-return-live" onClick={() => setLiveFor(liveOpen ? null : periodKey)}>
          <span aria-hidden>{liveOpen ? '▾' : '▸'}</span><b>{FILING.live}</b></button>
        {liveOpen && <div id="gst-return-live" className={styles.liveBody}>{live}</div>}
      </> : <>
        {filing?.state === 'overlaps' && <div role="status" className={kit.callout}><span>{FILING.overlaps(filing.with[0])}</span></div>}
        {live}
        {canAsk && <button type="button" className={`btn btn-secondary ${styles.phoneOnly}`} onClick={() => setAsking(true)}>{FILING.door}</button>}
        {filing?.state === 'unread' && worksheet && <p className={kit.caption}>{FILING.unreadDoor}</p>}
      </>}
    </div>

    {windowOpen && worksheet && body && <GstReturnWindow open={windowOpen} worksheet={worksheet} clubs={body.clubs} periodLabel={periodLabel}
      expenses={expenses} onOpenExpense={onOpenExpense} onAddNumber={onAddNumber} onClose={() => setWindowOpen(null)} />}
    {asking && worksheet && body && <GstReturnFilingQuestion worksheet={worksheet} revision={filed?.latest.periodRevision ?? 0} today={body.today}
      notice={askNotice} onClose={() => { setAsking(false); setAskNotice(null); }} onSaved={retry}
      onStale={why => { setAskNotice(why); retry(); }} />}
    {historyOpen && filed && <FilingHistory history={filed.history} onClose={() => setHistoryOpen(false)}
      onAgain={() => { setHistoryOpen(false); setAsking(true); }} />}
  </section>;
}

/** State D: the lines as filed, then what changed since (drawing tab 6). Every figure here is the filing's; nothing opens. */
function FiledBody({ filing }: { filing: Extract<ReturnFiling, { state: 'filed' }> }) {
  const f = filing.latest;
  const c = filing.comparison;
  const notes = [f.openItems > 0 ? FILING.filedWithOpen(f.openItems) : '', f.partial ? FILING.filedPartial : '', filing.history.length > 1 ? FILING.markedAgain(filing.history.length) : '']
    .filter(Boolean).join(' ');
  const moved = c.state === 'compared' && (c.lines.length > 0 || c.changes.length > 0);
  return <>
    <div role="status" className={kit.callout}><span><strong>{FILING.asFiledTitle}</strong> {FILING.asFiledBody(f.createdAt)}{notes ? ` ${notes}` : ''}</span></div>
    <div className={`${styles.frame} ${styles.deskOnly}`}><table className={styles.lines}>
      <thead><tr><th>Line</th><th>What goes in it</th><th className={kit.num}>As filed</th></tr></thead>
      <tbody>{WORKSHEET_LINES.map(line => <tr key={line} className={`${[105, 108, 109].includes(line) ? styles.calc : ''} ${line === 109 ? styles.net : ''}`}>
        <td className={styles.ln}>{line}</td>
        <td><span className={styles.foldless}><b>{RETURN_LINES[line].caption}</b></span> <span className={kit.caption}>· {RETURN_LINES[line].hint}</span></td>
        <td className={kit.num}>{filedFigure(line, f.lines[line], f.wholeDollars101)}</td>
      </tr>)}</tbody>
    </table></div>
    <ol className={`${styles.cards} ${styles.phoneOnly}`}>{WORKSHEET_LINES.map(line => <li key={line} className={`${styles.card} ${line === 109 ? styles.net : ''}`}>
      <div className={styles.cardDoor}><span className={styles.ln}>{line}</span><span className={styles.cardText}><b>{RETURN_LINES[line].caption}</b></span>
        <span className={styles.cardValue}>{filedFigure(line, f.lines[line], f.wholeDollars101)}</span><span className={styles.chev} aria-hidden /></div>
    </li>)}</ol>
    {c.state === 'unknown'
      ? <div role="status" className={`${kit.callout} ${kit.calloutWarn}`}><span><strong>{FILING.changedTitle}</strong> {FILING.cantCompare[c.why]}</span></div>
      : moved
        ? <div role="status" className={`${kit.callout} ${kit.calloutWarn} ${styles.beforeYouFile}`}><strong>{FILING.changedTitle}</strong>
          <ul className={styles.changes}>
            {c.lines.map(l => <li key={`line-${l.line}`}>{FILING.lineMoved(l.line, l.filed, l.today)}</li>)}
            {c.changes.map((ch, i) => <li key={`${ch.kind}-${i}`}>{changeSentence(ch)}</li>)}
          </ul></div>
        : <p className={kit.caption}>{FILING.unchanged}</p>}
  </>;
}

/** The FILED tag's window: each filing of these dates, newest first, and the way to mark it again (an amended return). */
function FilingHistory({ history, onClose, onAgain }: { history: FilingSummary[]; onClose: () => void; onAgain: () => void }) {
  return <KitDialog kind="form" eyebrow={FILING.eyebrow} title={FILING.historyTitle} onClose={onClose}
    footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
      <button type="button" className="btn btn-primary" onClick={onAgain}>{FILING.doorAgain}</button></>}>
    <p className={bk.hint}>{FILING.history(history.length)}</p>
    <ul className={styles.changes}>{history.map(h => <li key={h.filingNo}>{FILING.historyRow(h.filedOn, h.createdAt, h.reason)}</li>)}</ul>
  </KitDialog>;
}

function WorksheetBody({ worksheet, registration, open, onToggle, onWindow, onRetry }: {
  worksheet: Worksheet; registration: GstReturnResponse['registration']; open: Set<LineNumber>;
  onToggle: (line: LineNumber) => void; onWindow: (w: ReturnWindow) => void; onRetry: () => void;
}) {
  // One sentence per thing the worksheet can't know. A registration failure blanks both sides, so it stands alone.
  // Unread filings say nothing more once the expenses themselves are unread (both blank line 106).
  const failures = worksheet.failures.includes('registration_unread') ? (['registration_unread'] as NotAvailableWhy[])
    : worksheet.failures.filter(f => f !== 'filings_unread' || !worksheet.failures.some(g => g.startsWith('expenses')));
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
  // Session C: line 106 folds only when it carries credits from earlier periods (released after that period was filed).
  const earlier = worksheet.parts[106].earlierCents;
  const line106 = worksheet.lines[106].cents;
  const creditRows: Partial<Record<LineNumber, { key: string; label: string; cents: number; onOpen?: () => void }[]>> = earlier && line106 != null ? {
    106: [{ key: 'this', label: 'Credits on this period’s expenses', cents: line106 - earlier }, { key: 'earlier', label: FILING.earlierCredits, cents: earlier }],
  } : {};
  const subRows: Partial<Record<LineNumber, { key: string; label: string; cents: number; onOpen?: () => void }[]>> = salesKnown ? { ...creditRows,
    101: [
      { key: 'zero', label: 'Zero-rated sales included', cents: worksheet.parts[101].zeroRatedCad },
      { key: 'notes', label: 'Credit notes issued · beside the line, not taken off it', cents: worksheet.parts[101].creditNotesIssuedCad },
    ],
    103: worksheet.parts[103].groups.map(g => ({ key: `${g.taxType}|${g.rate}|${g.region}`, label: taxGroupLabel(g), cents: g.cents, onOpen: () => onWindow({ kind: 'sales', line: 103, group: g }) })),
    107: [
      { key: 'notes', label: 'Credit notes issued', cents: notes, onOpen: worksheet.parts[107].creditNotes.length ? () => onWindow({ kind: 'relief', line: 107, part: 'notes' }) : undefined },
      { key: 'bad', label: 'Bad debts written off', cents: badDebts, onOpen: worksheet.parts[107].badDebts.length ? () => onWindow({ kind: 'relief', line: 107, part: 'badDebts' }) : undefined },
    ],
  } : creditRows;
  const foldable = (line: LineNumber) => FOLDS.includes(line) && Boolean(subRows[line]?.length);
  const earlierNote = earlier ? FILING.earlierNote(earlier) : '';
  const phoneNote: Partial<Record<LineNumber, string>> = salesKnown ? {
    101: worksheet.parts[101].zeroRatedCad ? `Includes ${formatMoney(worksheet.parts[101].zeroRatedCad)} zero-rated sales` : '',
    103: worksheet.parts[103].groups.length ? `${new Set(worksheet.parts[103].groups.map(g => g.region)).size} provinces · ${worksheet.parts[103].invoices.length} invoices` : '',
    107: notes || badDebts ? `Credit notes ${formatMoney(notes)} · bad debts ${formatMoney(badDebts)}` : '',
    106: earlierNote,
  } : { 106: earlierNote };

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
