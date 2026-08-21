'use client';
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { generateCSV, downloadCSVBlob, downloadXLSX } from '@/lib/export';
import { parseCSV } from '@/lib/import/csv';
import type { ParsedImportFile } from '@/lib/import/types';
import {
  rowsFromMonthGrid, rowsFromList, rowsFromPayables,
  reviewBudgetRows, reviewPayableRows, committable,
  monthGridTemplateHeaders, templateExampleRows, templateMonths,
  LIST_TEMPLATE_HEADERS, PAYABLES_TEMPLATE_HEADERS, MAX_IMPORT_ROWS,
  type BudgetImportShape, type DraftBudgetRow, type DraftPayableRow,
  type ReviewedBudgetRow, type ReviewedPayableRow, type KnownCategory, type ExistingBudgetLine,
} from '@/lib/coach-budget-import';
import { formatMonthLabel, type MonthKey } from '@/lib/coach-budget-months';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './BudgetImportSheet.module.css';

/**
 * Bring a budget in from a spreadsheet (Coach Portal chunk H2).
 *
 * Same contract as the roster bulk-add it is modelled on: two ways in, ONE review step, and
 * nothing is written until the coach confirms. A pasted block parses in the browser (works on a
 * phone, no file picker); an uploaded `.csv`/`.xlsx` is parsed server-side by the existing import
 * parsers. Both land in the same editable preview with a per-row verdict.
 *
 * The templates carry column headings and category/line NAMES only — every amount cell is empty.
 * A downloadable file with an example dollar in it is the product proposing a figure (D-G1).
 */

type Step = 'choose' | 'input' | 'review';
type Tab = 'file' | 'paste';

const SHAPES: Array<{ id: BudgetImportShape; title: string; blurb: string }> = [
  {
    id: 'month-grid',
    title: 'Month grid',
    blurb: 'A row per cost, a column per month — becomes budget lines with their payment dates.',
  },
  {
    id: 'list',
    title: 'Simple list',
    blurb: 'Category, line and one amount — becomes budget lines with no dates yet.',
  },
  {
    id: 'payables',
    title: 'Payables schedule',
    blurb: 'What you owe and when — becomes payables on your payment schedule.',
  },
];

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BudgetImportSheet({
  orgSlug,
  teamId,
  categories,
  existingLines,
  existingPayableDescriptions,
  seasonYear,
  gridMonths,
  todayMonth,
  initialShape,
  onClose,
  onImported,
}: {
  orgSlug: string;
  teamId: string;
  categories: KnownCategory[];
  existingLines: ExistingBudgetLine[];
  existingPayableDescriptions: string[];
  seasonYear: number;
  /** The months the team's own money already spans — the template follows them when it can. */
  gridMonths: MonthKey[];
  todayMonth: MonthKey;
  initialShape?: BudgetImportShape;
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  useOverlayOpen(true);

  const [shape, setShape] = useState<BudgetImportShape>(initialShape ?? 'month-grid');
  const [step, setStep] = useState<Step>(initialShape ? 'input' : 'choose');
  const [tab, setTab] = useState<Tab>('paste');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  /** null = still collecting input; an array = the coach is reviewing. */
  const [budgetDraft, setBudgetDraft] = useState<DraftBudgetRow[] | null>(null);
  const [payableDraft, setPayableDraft] = useState<DraftPayableRow[] | null>(null);

  const months = useMemo(() => templateMonths(gridMonths, todayMonth), [gridMonths, todayMonth]);

  // Re-reviewed on every edit against the plan this sheet already holds, so fixing a category in
  // the preview clears its verdict immediately. The commit route reviews again, independently.
  const budgetRows: ReviewedBudgetRow[] = useMemo(
    () => (budgetDraft ? reviewBudgetRows(budgetDraft, categories, existingLines) : []),
    [budgetDraft, categories, existingLines],
  );
  const payableRows: ReviewedPayableRow[] = useMemo(
    () => (payableDraft ? reviewPayableRows(payableDraft, categories, existingPayableDescriptions) : []),
    [payableDraft, categories, existingPayableDescriptions],
  );

  const isPayables = shape === 'payables';
  const reviewedCount = isPayables ? payableRows.length : budgetRows.length;
  const ready = isPayables ? committable(payableRows) : committable(budgetRows);
  const blockedCount = reviewedCount - ready.length;

  const dirty = step === 'review' || !!pasteText.trim() || !!fileName;
  const close = useDiscardGuard({
    dirty,
    close: onClose,
    noun: 'import',
    detail: reviewedCount > 0 ? `${reviewedCount} row${reviewedCount === 1 ? '' : 's'} you haven’t imported yet` : undefined,
  });

  // ── templates ──────────────────────────────────────────────────────────────

  function templateHeaders(): string[] {
    if (shape === 'payables') return [...PAYABLES_TEMPLATE_HEADERS];
    if (shape === 'list') return [...LIST_TEMPLATE_HEADERS];
    return monthGridTemplateHeaders(months);
  }

  async function downloadTemplate(format: 'xlsx' | 'csv') {
    const headers = templateHeaders();
    // Category and line NAMES from the coach's own taxonomy; every amount cell blank (D-G1).
    const rows = templateExampleRows(categories, headers.length);
    const name = `budget-${shape}-template`;
    if (format === 'csv') downloadCSVBlob(`${name}.csv`, generateCSV(headers, rows));
    else await downloadXLSX(`${name}.xlsx`, headers, rows, 'Template');
  }

  // ── input ──────────────────────────────────────────────────────────────────

  function reviewPaste() {
    setError('');
    // Clear any filename left by an earlier file attempt in the same sheet — it labels the
    // review AND (since migration 231) the import receipt, so a stale one would record a paste
    // as an upload of a file the coach abandoned.
    setFileName('');
    const text = pasteText.trim();
    if (!text) { setError('Paste your rows first — include the header row from your sheet.'); return; }
    try {
      // A pasted block is tab- or comma-separated; the CSV reader handles both once tabs are
      // normalised, and it is the same reader the uploaded file goes through.
      const parsed = parseCSV(text.replace(/\t/g, ','), MAX_IMPORT_ROWS);
      applyParsed(parsed);
    } catch {
      setError('That didn’t parse. Include the header row, and keep one row per line.');
    }
  }

  function applyParsed(parsed: ParsedImportFile) {
    if (shape === 'payables') {
      const rows = rowsFromPayables(parsed);
      if (rows.length === 0) { setError('No rows we could read. Check the header row, or start from the template.'); return; }
      setPayableDraft(rows);
    } else {
      const rows = shape === 'list' ? rowsFromList(parsed) : rowsFromMonthGrid(parsed, seasonYear);
      if (rows.length === 0) { setError('No rows we could read. Check the header row, or start from the template.'); return; }
      setBudgetDraft(rows);
    }
    setStep('review');
  }

  async function reviewFile(file: File) {
    setBusy(true); setError(''); setFileName(file.name);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('shape', shape);
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/import/preview`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That file could not be read.');
      if (shape === 'payables') setPayableDraft((data.rows ?? []) as DraftPayableRow[]);
      else setBudgetDraft((data.rows ?? []) as DraftBudgetRow[]);
      setStep('review');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
      setFileName('');
    } finally {
      setBusy(false);
    }
  }

  // ── commit ─────────────────────────────────────────────────────────────────

  async function commit() {
    if (ready.length === 0) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shape: isPayables ? 'payables' : 'budget',
          rows: ready,
          // Receipt-only fields (migration 231): what the coach chose and how the rows arrived,
          // so "Recent imports" can say "a month grid, pasted" rather than just "an import".
          // `shape` above stays the write discriminator and is untouched by these.
          sheetShape: shape,
          source: fileName ? 'file' : 'paste',
          sourceFilename: fileName || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Those rows could not be imported.');

      const created = (data.created ?? []) as unknown[];
      const updated = (data.updated ?? []) as unknown[];
      const failed = (data.failed ?? []) as { name: string }[];
      const skipped = (data.skipped ?? []) as { name: string; reason: string }[];

      const parts = [
        created.length ? `${created.length} added` : '',
        updated.length ? `${updated.length} updated` : '',
      ].filter(Boolean).join(', ');
      const trailing = [
        failed.length ? `${failed.length} couldn’t be saved (${failed.map(f => f.name).join(', ')})` : '',
        skipped.length ? `${skipped.length} skipped` : '',
      ].filter(Boolean).join(' · ');

      onImported(`${parts}.${trailing ? ` ${trailing}.` : ''}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Those rows could not be imported.');
    } finally {
      setBusy(false);
    }
  }

  function updateBudgetRow(index: number, patch: Partial<DraftBudgetRow>) {
    setBudgetDraft(prev => prev?.map((r, i) => (i === index ? { ...r, ...patch } : r)) ?? prev);
  }
  function updatePayableRow(index: number, patch: Partial<DraftPayableRow>) {
    setPayableDraft(prev => prev?.map((r, i) => (i === index ? { ...r, ...patch } : r)) ?? prev);
  }

  function restart() {
    setBudgetDraft(null); setPayableDraft(null);
    setPasteText(''); setFileName(''); setError('');
    setStep(initialShape ? 'input' : 'choose');
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const categoryOptions = categories.map(c => c.name);

  return (
    <div className={shared.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (close)?.(); }}>
      <div className={`${shared.modal} ${shared.modalFlushFooter} ${styles.panel}`} onClick={e => e.stopPropagation()}>
        <CoachModalHeader title="Import a spreadsheet" onClose={close} />

        {step === 'choose' && (
          <>
            <p className={styles.intro}>
              What shape is your sheet? Each one becomes something different, so it&apos;s worth
              picking the right one — you can change it before anything is saved.
            </p>
            <div className={styles.shapeList}>
              {SHAPES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.shapeCard} ${shape === s.id ? styles.shapeCardOn : ''}`}
                  onClick={() => { setShape(s.id); setStep('input'); }}
                >
                  <span className={styles.shapeTitle}>{s.title}</span>
                  <span className={styles.shapeBlurb}>{s.blurb}</span>
                </button>
              ))}
            </div>
            <div className={shared.modalFooter}>
              <button type="button" className={shared.btnGhost} onClick={close}>Cancel</button>
            </div>
          </>
        )}

        {step === 'input' && (
          <>
            <button type="button" className={styles.backBtn} onClick={() => setStep('choose')}>
              <ArrowLeft size={13} aria-hidden /> Choose a different shape
            </button>
            <p className={styles.intro}>
              <strong>{SHAPES.find(s => s.id === shape)?.title}</strong> — {SHAPES.find(s => s.id === shape)?.blurb}
            </p>

            <div className={styles.templateRow}>
              <span className={styles.templateLabel}>
                <FileSpreadsheet size={13} aria-hidden /> Start from a template
              </span>
              <span className={styles.templateBtns}>
                <button type="button" className={shared.btnSecondary} onClick={() => downloadTemplate('xlsx')}>
                  <Download size={13} aria-hidden /> Excel
                </button>
                <button type="button" className={shared.btnGhost} onClick={() => downloadTemplate('csv')}>
                  <Download size={13} aria-hidden /> CSV
                </button>
              </span>
            </div>
            <p className={styles.templateNote}>
              The template has the column headings and some standard cost names — the amounts are
              left blank for you to fill in. We never put a figure in your budget.
            </p>

            <div className={`${shared.segChoice} ${shared.segChoiceFull}`} role="group" aria-label="How to bring your rows in">
              {/* ⚠ Both locked while a file is being reviewed. Switching to Paste and reviewing a
                  block mid-upload let the slower file response land afterwards and REPLACE the
                  rows the coach was reading — and because the paste path clears the filename, the
                  eventual import would then have been recorded as pasted (/review, 2026-08-13). */}
              <button type="button" disabled={busy} className={`${shared.segBtn} ${tab === 'paste' ? shared.segBtnActive : ''}`} onClick={() => setTab('paste')}>Paste</button>
              <button type="button" disabled={busy} className={`${shared.segBtn} ${tab === 'file' ? shared.segBtnActive : ''}`} onClick={() => setTab('file')}>Upload a file</button>
            </div>

            {tab === 'paste' ? (
              <div className={styles.field}>
                <label className={shared.label} htmlFor="budget-import-paste">
                  Paste your rows, including the header row
                </label>
                <textarea
                  id="budget-import-paste"
                  className={shared.textarea}
                  rows={8}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={
                    shape === 'payables'
                      ? 'Payee, Description, Category, Amount, Due Date'
                      : shape === 'list'
                        ? 'Category, Line, Amount, Notes'
                        : `Category, Line, ${months.slice(0, 3).map(formatMonthLabel).join(', ')}, …`
                  }
                />
                <p className={styles.hint}>Copy straight out of Excel or Google Sheets — tabs and commas both work.</p>
              </div>
            ) : (
              <div className={styles.field}>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xlsm,.txt"
                  className={styles.fileInput}
                  onChange={e => { const f = e.target.files?.[0]; if (f) void reviewFile(f); }}
                />
                <button type="button" className={shared.btnSecondary} disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload size={13} aria-hidden /> {busy ? 'Reading…' : 'Choose a file'}
                </button>
                {fileName && <p className={styles.hint}>{fileName}</p>}
                <p className={styles.hint}>Excel (.xlsx) or CSV, up to {MAX_IMPORT_ROWS} rows.</p>
              </div>
            )}

            {error && <p className={shared.errorText}>{error}</p>}

            <div className={shared.modalFooter}>
              <button type="button" className={shared.btnGhost} onClick={close}>Cancel</button>
              {tab === 'paste' && (
                <button type="button" disabled={busy} className={shared.btnPrimary} onClick={reviewPaste}>Review rows</button>
              )}
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <button type="button" className={styles.backBtn} onClick={restart}>
              <ArrowLeft size={13} aria-hidden /> Start over
            </button>
            <p className={styles.intro}>
              Nothing has been saved yet. Check each row — fix anything flagged, or leave it and
              it will be skipped.
            </p>

            <div className={styles.reviewWrap}>
              {isPayables ? (
                <table className={styles.reviewTable}>
                  <thead>
                    <tr>
                      <th>#</th><th>What</th><th>Category</th><th className={styles.numCol}>Amount</th><th>What will happen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payableRows.map((row, i) => (
                      <tr key={row.rowNumber} className={row.outcome === 'blocked' ? styles.rowBlocked : ''}>
                        <td className={styles.rowNum}>{row.rowNumber}</td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={row.description}
                            aria-label={`Description, row ${row.rowNumber}`}
                            onChange={e => updatePayableRow(i, { description: e.target.value })}
                          />
                          {row.depositDueDate && <span className={styles.cellMeta}>Due {row.depositDueDate}</span>}
                        </td>
                        <td>
                          <select
                            className={styles.cellInput}
                            value={row.categoryName}
                            aria-label={`Category, row ${row.rowNumber}`}
                            onChange={e => updatePayableRow(i, { categoryName: e.target.value })}
                          >
                            <option value="">— none —</option>
                            {categoryOptions.map(name => <option key={name} value={name}>{name}</option>)}
                            {row.categoryName && !categoryOptions.includes(row.categoryName) && (
                              <option value={row.categoryName}>{row.categoryName} (not recognised)</option>
                            )}
                          </select>
                        </td>
                        <td className={styles.numCol}>{row.total > 0 ? fmt(row.total) : '—'}</td>
                        <td><Verdict row={row} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className={styles.reviewTable}>
                  <thead>
                    <tr>
                      <th>#</th><th>Category</th><th>Line</th><th className={styles.numCol}>Amount</th><th>Dates</th><th>What will happen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetRows.map((row, i) => (
                      <tr key={row.rowNumber} className={row.outcome === 'blocked' ? styles.rowBlocked : ''}>
                        <td className={styles.rowNum}>{row.rowNumber}</td>
                        <td>
                          <select
                            className={styles.cellInput}
                            value={row.categoryName}
                            aria-label={`Category, row ${row.rowNumber}`}
                            onChange={e => updateBudgetRow(i, { categoryName: e.target.value })}
                          >
                            <option value="">— pick one —</option>
                            {categoryOptions.map(name => <option key={name} value={name}>{name}</option>)}
                            {row.categoryName && !categoryOptions.includes(row.categoryName) && (
                              <option value={row.categoryName}>{row.categoryName} (not recognised)</option>
                            )}
                          </select>
                        </td>
                        <td>
                          <input
                            className={styles.cellInput}
                            value={row.lineName}
                            aria-label={`Line, row ${row.rowNumber}`}
                            onChange={e => updateBudgetRow(i, { lineName: e.target.value })}
                          />
                        </td>
                        <td className={styles.numCol}>
                          {row.periods.length > 0 ? (
                            // A month-grid row's total is the sum of its months — editing it here
                            // would silently disagree with the schedule it is about to write.
                            <span>{row.total > 0 ? fmt(row.total) : '—'}</span>
                          ) : (
                            <input
                              className={`${styles.cellInput} ${styles.cellInputNum}`}
                              value={row.amount}
                              inputMode="decimal"
                              aria-label={`Amount, row ${row.rowNumber}`}
                              onChange={e => updateBudgetRow(i, { amount: e.target.value })}
                            />
                          )}
                        </td>
                        <td className={styles.datesCell}>
                          {row.periods.length > 0
                            ? row.periods.map(p => formatMonthLabel(p.month)).join(' · ')
                            : <span className={styles.cellMeta}>no dates</span>}
                        </td>
                        <td><Verdict row={row} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {blockedCount > 0 && (
              <p className={styles.blockedNote}>
                <TriangleAlert size={13} aria-hidden />
                {/* One string, not an interpolated count beside a sentence: split across text
                    nodes it reads as "1 rowcan't" to anything walking the DOM. */}
                <span>
                  {blockedCount === 1
                    ? '1 row can’t be imported yet'
                    : `${blockedCount} rows can’t be imported yet`}
                  {' — fix them above, or import the rest and they’ll be left out.'}
                </span>
              </p>
            )}
            {error && <p className={shared.errorText}>{error}</p>}

            <div className={shared.modalFooter}>
              <button type="button" className={shared.btnGhost} onClick={close}>Cancel</button>
              <button type="button" className={shared.btnPrimary} disabled={busy || ready.length === 0} onClick={commit}>
                {busy ? 'Importing…' : `Import ${ready.length} row${ready.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The per-row verdict chip — the thing that makes this preview-first rather than hopeful. */
function Verdict({ row }: { row: { outcome: string; reason?: string; warning?: string } }) {
  const cls = row.outcome === 'add' ? styles.chipAdd : row.outcome === 'update' ? styles.chipUpdate : styles.chipBlocked;
  const label = row.outcome === 'add' ? 'Adds' : row.outcome === 'update' ? 'Updates' : 'Can’t import';
  return (
    <>
      <span className={`${styles.chip} ${cls}`}>{label}</span>
      {(row.reason || row.warning) && <span className={styles.why}>{row.reason ?? row.warning}</span>}
    </>
  );
}
