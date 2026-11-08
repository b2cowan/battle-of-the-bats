'use client';

/**
 * The windows a GST/HST return figure or a "Before you file" item opens (GST/HST Stage 4b Session B; drawings tab 5).
 * Each lists what the ENGINE put behind the figure (lib/gst-return-worksheet.ts): nothing here sorts, sums or decides; a
 * total shown in a window is the engine's own figure or a plain sum of the rows the engine listed.
 *   · Lines 101 / 103: the invoices (one province-and-rate part of 103 narrows it). The invoice number opens its club's Money
 *     tab in a new tab: the "needs a look" list for a sale with no answer. A shared customer's sale is on no club's list
 *     (Stage 3's rule, read by the route) and says so instead of linking to a tab that would refuse it.
 *   · Lines 104 / 107: recoveries, credit notes and bad debts written off.
 *   · Line 106: the bridge from GST/HST paid; each step filters the list under it.
 *   · A "Before you file" kind: its items; an expense row opens the expense (a missing number opens the correction form with
 *     the number field ready).
 * House window: `KitDialog` form, `wide` for an invoice table, `medium` for the rest; a phone fills the screen.
 */
import { useMemo, useState } from 'react';
import KitDialog from '@/components/shared/KitDialog';
import kit from '../console.module.css';
import { consoleDate, consoleDay } from '@/lib/console-dates';
import { csvCell, type ExpenseRevision } from '@/lib/bookkeeping-expenses';
import { formatCad, TAX_TYPES } from '@/lib/bookkeeping-gst';
import { downloadCSVBlob } from '@/lib/export';
import { pluralize, possessive } from '@/lib/utils';
import type { LineNumber, NotOnReturnStep, ReliefItem, TaxGroup, UnresolvedItem, UnresolvedKind, Worksheet, WorksheetSaleItem } from '@/lib/gst-return-worksheet';
import { buyerWords, FILING, formatMoney, NOT_ON_RETURN_STEPS, RETURN_LINES, SALE_KINDS, taxGroupLabel, taxRateLabel, UNRESOLVED } from '@/lib/gst-return-worksheet-text';
import type { ReturnClub } from '@/app/api/platform-admin/bookkeeping/gst-return/route';
import styles from './ReportsGstReturn.module.css';

export type ReturnWindow =
  | { kind: 'sales'; line: 101 | 103; group?: TaxGroup }
  | { kind: 'relief'; line: 104 | 107; part?: 'notes' | 'badDebts' }
  | { kind: 'credits'; step?: NotOnReturnStep | 'counted' }
  | { kind: 'unresolved'; item: UnresolvedKind };

type Clubs = Record<string, ReturnClub | null> | null;
const FIRST = 25;
const STATUS: Record<string, { label: string; tone: string }> = {
  paid: { label: 'PAID', tone: kit.chipOk }, open: { label: 'OPEN', tone: kit.chipQuiet },
  uncollectible: { label: 'UNCOLLECTIBLE', tone: kit.chipWarn }, void: { label: 'VOID', tone: kit.chipQuiet },
};
const csv = (rows: (string | number)[][]) => rows.map(row => row.map(csvCell).join(',')).join('\n');
const groupKey = (g: Pick<TaxGroup, 'taxType' | 'rate' | 'region'>) => `${g.taxType}|${g.rate}|${g.region ?? ''}`;

/** The invoice number, as a door to its club's Money tab when a club's tab shows it. */
function InvoiceRef({ invoiceId, number, clubs, needsLook }: { invoiceId: string; number: string | null; clubs: Clubs; needsLook?: boolean }) {
  const label = number ?? invoiceId;
  const club = clubs?.[invoiceId];
  if (club) {
    return <a className={kit.nameLink} target="_blank" rel="noopener noreferrer"
      href={`/platform-admin/orgs/${encodeURIComponent(club.orgId)}?tab=money${needsLook ? '&show=needs_look' : ''}`}
      title={`Opens ${possessive(club.name)} Money tab in a new tab`}>{label}</a>;
  }
  return <span>{label}{clubs && club === null && <span className={kit.sub}>On no club’s list (its Stripe customer is shared)</span>}</span>;
}
const buyerOf = (sale: WorksheetSaleItem, clubs: Clubs): string => buyerWords(sale.buyerKind, clubs?.[sale.invoiceId]?.name);
function taxedIn(sale: WorksheetSaleItem): string {
  if (sale.position === 'zero_rated') return 'Zero-rated';
  if (!sale.lines.length) return sale.position === 'missing' ? 'No answer' : 'No GST/HST';
  return [...new Set(sale.lines.map(l => `${sale.region ?? ''}${sale.region ? ' · ' : ''}${taxRateLabel(l)}`))].join(', ');
}

function ShowAll({ count, all, onAll }: { count: number; all: boolean; onAll: () => void }) {
  if (count <= FIRST || all) return null;
  return <button type="button" className={kit.door} onClick={onAll}>Show all {count}</button>;
}

function SalesWindow({ worksheet, line, group, clubs, periodLabel, onClose }: {
  worksheet: Worksheet; line: 101 | 103; group?: TaxGroup; clubs: Clubs; periodLabel: string; onClose: () => void;
}) {
  const [all, setAll] = useState(false);
  const missing = useMemo(() => new Set(worksheet.unresolved.filter(u => u.kind === 'sale_missing_answer').map(u => u.invoiceId)), [worksheet]);
  const invoices = group
    ? worksheet.parts[103].invoices.filter(s => s.lines.some(l => groupKey({ taxType: l.taxType, rate: l.rate, region: s.region }) === groupKey(group)))
    : line === 103 ? worksheet.parts[103].invoices : worksheet.parts[101].invoices;
  const shown = all ? invoices : invoices.slice(0, FIRST);
  const beforeTax = invoices.reduce((sum, s) => sum + (s.beforeTaxCad ?? 0), 0);
  const tax = group ? group.cents : worksheet.lines[103].cents ?? 0;
  function exportCsv() {
    downloadCSVBlob(`fieldlogichq-gst-hst-line-${line}.csv`, csv([
      ['Issued', 'Invoice', 'Buyer', 'Taxed in', 'Currency', 'Bank of Canada rate', 'Before tax (CAD)', 'GST/HST (CAD)', 'Status'],
      ...invoices.map(s => [s.issuedOn, s.invoiceNumber ?? s.invoiceId, buyerOf(s, clubs), taxedIn(s), s.currency.toUpperCase(), s.fxRate ?? '',
        s.beforeTaxCad == null ? 'No rate yet' : (s.beforeTaxCad / 100).toFixed(2), s.gstHstCad == null ? 'No rate yet' : (s.gstHstCad / 100).toFixed(2), s.status]),
    ]));
  }
  return <KitDialog kind="form" size="wide" record onClose={onClose}
    eyebrow={`GST/HST return · line ${line}`} title={group ? taxGroupLabel(group) : RETURN_LINES[line].caption}
    identity={`${periodLabel} · by issue date`}
    footerStart="Figures from each invoice as Stripe issued it, in Canadian dollars at the Bank of Canada rate for the invoice day."
    footer={<button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!invoices.length}>Export CSV</button>}>
    <dl className={styles.figures}>
      <div><dt>Invoices issued</dt><dd>{invoices.length}</dd></div>
      <div><dt>Before tax</dt><dd>{formatMoney(beforeTax)}</dd></div>
      {line === 101 && !group
        ? <div className={styles.total}><dt>On line 101 · whole dollars</dt><dd>{formatMoney(worksheet.lines[101].cents ?? 0)}</dd></div>
        : <div className={styles.total}><dt>Tax collected or collectible</dt><dd>{formatMoney(tax)}</dd></div>}
    </dl>
    {line === 101 && !group && worksheet.parts[101].zeroRatedCad > 0 && <p className={kit.caption}>Includes {formatMoney(worksheet.parts[101].zeroRatedCad)} of zero-rated sales.</p>}
    <p className={kit.caption}>A voided or uncollectible invoice stays in this line: the tax was owed when it was issued. Only a credit note or a write-off takes it off, on line 107.</p>
    <div className={`table-cards ${styles.frame}`}><table className={styles.table}>
      <thead><tr><th>Issued</th><th>Invoice</th><th>Buyer</th><th>Taxed in</th><th className={kit.num}>{line === 101 && !group ? 'Before tax' : 'Tax'}</th><th>Status</th></tr></thead>
      <tbody>{shown.length ? shown.map(s => <tr key={s.invoiceId}>
        <td data-label="Issued">{consoleDay(s.issuedOn)}</td>
        <td className="table-cards-title"><InvoiceRef invoiceId={s.invoiceId} number={s.invoiceNumber} clubs={clubs} needsLook={missing.has(s.invoiceId)} /></td>
        <td data-label="Buyer">{buyerOf(s, clubs)}</td>
        <td data-label="Taxed in">{taxedIn(s)}</td>
        <td data-label={line === 101 && !group ? 'Before tax' : 'Tax'} className={kit.num}>{(line === 101 && !group ? s.beforeTaxCad : s.gstHstCad) == null ? 'No rate yet' : formatMoney((line === 101 && !group ? s.beforeTaxCad : s.gstHstCad)!)}</td>
        <td data-label="Status"><span className={`${kit.chip} ${STATUS[s.status]?.tone ?? ''}`}>{STATUS[s.status]?.label ?? s.status.toUpperCase()}</span></td>
      </tr>) : <tr><td colSpan={6} className={kit.empty}>No invoice was issued in this period.</td></tr>}</tbody>
    </table></div>
    <ShowAll count={invoices.length} all={all} onAll={() => setAll(true)} />
  </KitDialog>;
}

function ReliefWindow({ worksheet, line, part, clubs, periodLabel, onClose }: {
  worksheet: Worksheet; line: 104 | 107; part?: 'notes' | 'badDebts'; clubs: Clubs; periodLabel: string; onClose: () => void;
}) {
  const rows: (ReliefItem & { what: string })[] = line === 104
    ? worksheet.parts[104].recoveries.map(r => ({ ...r, what: 'Bad debt recovered' }))
    : [
      ...(part !== 'badDebts' ? worksheet.parts[107].creditNotes.map(r => ({ ...r, what: `Credit note${r.noteNumber ? ` ${r.noteNumber}` : ''}` })) : []),
      ...(part !== 'notes' ? worksheet.parts[107].badDebts.map(r => ({ ...r, what: 'Bad debt written off' })) : []),
    ].sort((a, b) => a.on.localeCompare(b.on));
  const total = rows.reduce((sum, r) => sum + r.cents, 0);
  const title = part === 'notes' ? 'Credit notes issued' : part === 'badDebts' ? 'Bad debts written off' : RETURN_LINES[line].caption;
  return <KitDialog kind="form" size="medium" record onClose={onClose}
    eyebrow={`GST/HST return · line ${line}`} title={title} identity={`${periodLabel} · by the date of each adjustment`}
    footerStart={line === 104 ? 'Supplier refunds of tax you claimed and the meals add-back aren’t tracked here.' : 'Valued at each invoice’s own Bank of Canada rate.'}
    footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>}>
    <dl className={styles.figures}>
      <div><dt>{line === 104 ? 'Recoveries' : 'Adjustments'}</dt><dd>{rows.length}</dd></div>
      <div className={styles.total}><dt>{line === 104 ? 'Added to net tax' : 'Deducted from net tax'}</dt><dd>{formatMoney(total)}</dd></div>
    </dl>
    <div className={`table-cards ${styles.frame}`}><table className={styles.table}>
      <thead><tr><th>Date</th><th>Invoice</th><th>What</th><th className={kit.num}>GST/HST</th></tr></thead>
      <tbody>{rows.length ? rows.map(r => <tr key={`${r.what}-${r.noteId ?? r.invoiceId}-${r.on}`}>
        <td data-label="Date">{consoleDay(r.on)}</td>
        <td className="table-cards-title"><InvoiceRef invoiceId={r.invoiceId} number={r.invoiceNumber} clubs={clubs} /></td>
        <td data-label="What">{r.what}{r.share && r.share.writtenOff !== r.share.total && <span className={kit.sub}>{formatCad(r.share.writtenOff)} of {formatCad(r.share.total)} written off</span>}</td>
        <td data-label="GST/HST" className={kit.num}>{formatMoney(r.cents)}{r.capped && <span className={kit.sub}>Capped at the invoice’s tax</span>}</td>
      </tr>) : <tr><td colSpan={4} className={kit.empty}>{line === 104 ? 'No written-off invoice was paid in this period.' : 'No credit note or write-off in this period.'}</td></tr>}</tbody>
    </table></div>
  </KitDialog>;
}

function CreditsWindow({ worksheet, step: initialStep, periodLabel, expenses, onOpenExpense, onClose }: {
  worksheet: Worksheet; step?: NotOnReturnStep | 'counted'; periodLabel: string; expenses: ExpenseRevision[];
  onOpenExpense: (row: ExpenseRevision, list: ExpenseRevision[]) => void; onClose: () => void;
}) {
  const [step, setStep] = useState<NotOnReturnStep | 'counted' | 'earlier' | null>(initialStep ?? null);
  const [all, setAll] = useState(false);
  const bridge = worksheet.parts[106].notOnReturn!;
  const credits = worksheet.parts[106].credits;
  const counted = credits.filter(c => c.state === 'counted');
  const typeNotSet = worksheet.unresolved.filter(u => u.kind === 'type_not_set');
  // Session C: credits released after an earlier period was filed are IN line 106 on top of this period's (the engine's).
  const earlier = worksheet.parts[106].earlierCredits;
  const earlierCents = worksheet.parts[106].earlierCents;
  const line106 = worksheet.lines[106].cents;
  type Row = { expenseId: string; on: string; supplier: string; taxes: string; paid: number | null; credit: number };
  const earlierRows: Row[] = earlier.map(c => ({ expenseId: c.expenseId, on: c.incurredOn, supplier: c.supplier,
    taxes: `${FILING.earlierCredits}: filed ${consoleDate(c.filedPeriod.from)} to ${consoleDate(c.filedPeriod.to)}`, paid: null, credit: c.cents }));
  const rows: Row[] = step === 'earlier' ? earlierRows : step === 'typeNotSet'
    // The step holds only the expenses whose GST/HST-typed tax it took off (the engine's bridgeCents), at that amount.
    ? typeNotSet.filter(u => u.bridgeCents != null).map(u => ({ expenseId: u.expenseId!, on: u.on ?? '', supplier: u.supplier ?? '', taxes: 'Type not set', paid: u.bridgeCents!, credit: 0 }))
    : [...credits.filter(c => step == null ? true : step === 'counted' ? c.state === 'counted' : c.notOnReturn[step] != null)
      .map(c => ({ expenseId: c.expenseId, on: c.incurredOn, supplier: c.supplier, taxes: c.taxTypes.map(t => TAX_TYPES[t]?.label ?? t).join(', '),
        paid: step && step !== 'counted' ? c.notOnReturn[step]! : c.gstHstPaid, credit: c.creditCents })), ...(step == null ? earlierRows : [])];
  const shown = all ? rows : rows.slice(0, FIRST);
  const list = rows.flatMap(r => expenses.find(e => e.expense_id === r.expenseId) ?? []);
  function open(id: string) { const row = expenses.find(e => e.expense_id === id); if (row) { onClose(); onOpenExpense(row, list); } }
  function exportCsv() {
    downloadCSVBlob('fieldlogichq-gst-hst-line-106.csv', csv([
      ['Date', 'Supplier', 'Tax', step && step !== 'counted' ? 'Not on the return (CAD)' : 'GST/HST paid (CAD)', 'Credit on line 106 (CAD)'],
      ...rows.map(r => [r.on, r.supplier, r.taxes, r.paid == null ? '' : (r.paid / 100).toFixed(2), (r.credit / 100).toFixed(2)]),
    ]));
  }
  const toggle = (next: NotOnReturnStep | 'counted' | 'earlier') => { setAll(false); setStep(current => current === next ? null : next); };
  return <KitDialog kind="form" size="medium" record onClose={onClose}
    eyebrow="GST/HST return · line 106" title={RETURN_LINES[106].caption} identity={`${periodLabel} · by expense date`}
    footerStart="Each row opens the expense."
    footer={<button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>}>
    <dl className={styles.figures}>
      <div><dt>GST/HST paid on {pluralize(bridge.gstHstPaid.count, 'expense')}</dt><dd>{formatMoney(bridge.gstHstPaid.cents)}</dd></div>
      {NOT_ON_RETURN_STEPS.filter(s => bridge[s.key].cents > 0).map(s => <div key={s.key}>
        <dt><button type="button" className={`${styles.stepDoor} ${step === s.key ? styles.stepOn : ''}`} aria-pressed={step === s.key} onClick={() => toggle(s.key)}>{s.label} · {bridge[s.key].count}</button></dt>
        <dd>less {formatMoney(bridge[s.key].cents)}</dd>
      </div>)}
      <div className={earlier.length ? undefined : styles.total}>
        <dt><button type="button" className={`${styles.stepDoor} ${step === 'counted' ? styles.stepOn : ''}`} aria-pressed={step === 'counted'} onClick={() => toggle('counted')}>{earlier.length ? 'Credits on this period’s expenses' : 'Credits on line 106'} · {pluralize(counted.length, 'expense')}</button></dt>
        <dd>{line106 == null ? 'Not available' : formatMoney(line106 - earlierCents)}</dd>
      </div>
      {earlier.length > 0 && <>
        <div>
          <dt><button type="button" className={`${styles.stepDoor} ${step === 'earlier' ? styles.stepOn : ''}`} aria-pressed={step === 'earlier'} onClick={() => toggle('earlier')}>{FILING.earlierCredits} · {pluralize(earlier.length, 'expense')}</button></dt>
          <dd>plus {formatMoney(earlierCents)}</dd>
        </div>
        <div className={styles.total}><dt>Credits on line 106</dt><dd>{line106 == null ? 'Not available' : formatMoney(line106)}</dd></div>
      </>}
    </dl>
    <div className={`table-cards ${styles.frame}`}><table className={styles.table}>
      <thead><tr><th>Date</th><th>Supplier</th><th>Tax</th><th className={kit.num}>{step && step !== 'counted' ? 'Not on the return' : 'Tax paid'}</th><th className={kit.num}>Credit</th><th aria-label="Open expense" /></tr></thead>
      <tbody>{shown.length ? shown.map(r => <tr key={r.expenseId} className={kit.clickableRow} onClick={() => open(r.expenseId)}>
        <td data-label="Date">{r.on ? consoleDay(r.on) : '—'}</td>
        <td className="table-cards-title"><button type="button" className={styles.rowName} onClick={event => { event.stopPropagation(); open(r.expenseId); }}>{r.supplier}</button></td>
        <td data-label="Tax">{r.taxes}</td>
        <td data-label={step && step !== 'counted' ? 'Not on the return' : 'Tax paid'} className={kit.num}>{r.paid == null ? '—' : formatMoney(r.paid)}</td>
        <td data-label="Credit" className={kit.num}>{formatMoney(r.credit)}</td>
        <td className={kit.rowDoor} aria-hidden>›</td>
      </tr>) : <tr><td colSpan={6} className={kit.empty}>No expense carried GST or HST in this period.</td></tr>}</tbody>
    </table></div>
    <ShowAll count={rows.length} all={all} onAll={() => setAll(true)} />
  </KitDialog>;
}

function UnresolvedWindow({ worksheet, item, clubs, periodLabel, expenses, onOpenExpense, onAddNumber, onClose }: {
  worksheet: Worksheet; item: UnresolvedKind; clubs: Clubs; periodLabel: string; expenses: ExpenseRevision[];
  onOpenExpense: (row: ExpenseRevision, list: ExpenseRevision[]) => void; onAddNumber: (row: ExpenseRevision, list: ExpenseRevision[]) => void; onClose: () => void;
}) {
  const items: UnresolvedItem[] = worksheet.unresolved.filter(u => u.kind === item);
  const text = UNRESOLVED[item];
  const sale = SALE_KINDS.has(item);
  const list = items.flatMap(u => expenses.find(e => e.expense_id === u.expenseId) ?? []);
  const held = item === 'credit_held' ? items.reduce((sum, u) => sum + (u.cents ?? 0), 0) : 0;
  const figureHead = item === 'credit_held' ? 'Credit held' : item === 'registration_unchecked' ? 'Counted for now' : item === 'relief_capped' ? 'Left over' : sale ? 'GST/HST' : 'Tax';
  function open(u: UnresolvedItem) {
    const row = expenses.find(e => e.expense_id === u.expenseId);
    if (!row) return;
    onClose();
    if (item === 'credit_held') onAddNumber(row, list); else onOpenExpense(row, list);
  }
  return <KitDialog kind="form" size="medium" record onClose={onClose}
    eyebrow="GST/HST return · before you file" title={text.title} identity={periodLabel}
    footerStart={item === 'credit_held' ? `${formatMoney(held)} of credit held` : pluralize(items.length, sale ? 'item' : 'expense')}
    footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>}>
    <div className={`table-cards ${styles.frame}`}><table className={styles.table}>
      <thead><tr><th>Date</th><th>{sale ? 'Invoice' : 'Supplier'}</th>{!sale && <th className={kit.num}>Amount</th>}<th className={kit.num}>{figureHead}</th>{!sale && <th aria-label="Open expense" />}</tr></thead>
      <tbody>{items.map((u, i) => {
        if (sale) return <tr key={`${u.invoiceId}-${u.noteId ?? ''}-${i}`}>
          <td data-label="Date">{u.on ? consoleDay(u.on) : '—'}</td>
          <td className="table-cards-title"><InvoiceRef invoiceId={u.invoiceId!} number={u.noteNumber ? `${u.invoiceNumber ?? u.invoiceId} · note ${u.noteNumber}` : u.invoiceNumber ?? null} clubs={clubs} needsLook={item === 'sale_missing_answer'} />
            {u.why && item !== 'sale_no_rate' && <span className={kit.sub}>{u.why.replaceAll('_', ' ')}</span>}</td>
          <td data-label={figureHead} className={kit.num}>{u.cents == null ? (item === 'sale_no_rate' ? `${u.why ?? ''} · no rate yet` : '—') : formatMoney(u.cents)}</td>
        </tr>;
        const row = expenses.find(e => e.expense_id === u.expenseId);
        return <tr key={`${u.expenseId}-${i}`} className={kit.clickableRow} onClick={() => open(u)}>
          <td data-label="Date">{u.on ? consoleDay(u.on) : '—'}</td>
          <td className="table-cards-title"><button type="button" className={styles.rowName} onClick={event => { event.stopPropagation(); open(u); }}>{u.supplier}</button></td>
          <td data-label="Amount" className={kit.num}>{row ? formatMoney(row.cad_cents) : '—'}</td>
          <td data-label={figureHead} className={kit.num}>{u.cents == null ? '—' : formatMoney(u.cents)}</td>
          <td className={kit.rowDoor} aria-hidden>›</td>
        </tr>;
      })}</tbody>
    </table></div>
    <p className={kit.caption}>{text.hint}</p>
  </KitDialog>;
}

export default function GstReturnWindow({ open, worksheet, clubs, periodLabel, expenses, onOpenExpense, onAddNumber, onClose }: {
  open: ReturnWindow; worksheet: Worksheet; clubs: Clubs; periodLabel: string; expenses: ExpenseRevision[];
  onOpenExpense: (row: ExpenseRevision, list: ExpenseRevision[]) => void; onAddNumber: (row: ExpenseRevision, list: ExpenseRevision[]) => void;
  onClose: () => void;
}) {
  if (open.kind === 'sales') return <SalesWindow worksheet={worksheet} line={open.line} group={open.group} clubs={clubs} periodLabel={periodLabel} onClose={onClose} />;
  if (open.kind === 'relief') return <ReliefWindow worksheet={worksheet} line={open.line} part={open.part} clubs={clubs} periodLabel={periodLabel} onClose={onClose} />;
  if (open.kind === 'credits') return <CreditsWindow worksheet={worksheet} step={open.step} periodLabel={periodLabel} expenses={expenses} onOpenExpense={onOpenExpense} onClose={onClose} />;
  return <UnresolvedWindow worksheet={worksheet} item={open.item} clubs={clubs} periodLabel={periodLabel} expenses={expenses}
    onOpenExpense={onOpenExpense} onAddNumber={onAddNumber} onClose={onClose} />;
}

/** Which window a line's figure (or its phone card) opens; null = it opens nothing (calculated, or nothing behind it). */
export function lineWindow(worksheet: Worksheet, line: LineNumber): ReturnWindow | null {
  if (worksheet.lines[line].cents == null || worksheet.lines[line].calculated) return null;
  if (line === 101 || line === 103) return worksheet.parts[101].invoices.length ? { kind: 'sales', line } : null;
  if (line === 104) return worksheet.parts[104].recoveries.length ? { kind: 'relief', line } : null;
  if (line === 107) return worksheet.parts[107].creditNotes.length || worksheet.parts[107].badDebts.length ? { kind: 'relief', line } : null;
  if (line === 106) return worksheet.parts[106].notOnReturn && (worksheet.parts[106].notOnReturn.gstHstPaid.count || worksheet.parts[106].earlierCredits.length) ? { kind: 'credits' } : null;
  return null;
}
