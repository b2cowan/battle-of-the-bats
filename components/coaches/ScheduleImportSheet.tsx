'use client';
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { generateCSV, downloadCSVBlob, downloadXLSX } from '@/lib/export';
import {
  rowsFromSchedulePaste, reviewScheduleRows, committableScheduleRows, isBlankScheduleRow,
  buildScheduleTemplate, MAX_SCHEDULE_IMPORT_ROWS,
  type DraftScheduleRow, type ExistingScheduleEvent, type ScheduleTemplateKind,
} from '@/lib/coach-schedule-import';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './ScheduleImportSheet.module.css';

/**
 * Bring a season schedule in from a spreadsheet or a league email (Coach Portal chunk C, P1 #7).
 *
 * Same contract as the budget importer it is modelled on: two ways in, ONE review step, and
 * nothing is written until the coach confirms. A pasted block parses in the browser (works on a
 * phone, no file picker); an uploaded `.csv`/`.xlsx` is parsed server-side. Both land in the same
 * editable preview with a per-row verdict, which re-reviews on every keystroke against the events
 * the page already holds — and the commit route reviews AGAIN against live data.
 *
 * Two refusals are deliberate and are the point of the feature:
 *   • an ambiguous date is handed back, never resolved (03/04/2026 is April 3rd or March 4th);
 *   • a row that looks like a MIRRORED tournament game is surfaced, never merged — the organizer
 *     owns those facts, and "Keep both" is a real answer.
 *
 * Templates carry headings and the event-type word only. Every date, time and opponent cell ships
 * blank: a downloadable file with an example date in it is the product proposing a fact.
 */

type Step = 'input' | 'review';
type Tab = 'paste' | 'file';

const TEMPLATES: Array<{ id: ScheduleTemplateKind; title: string }> = [
  { id: 'games', title: 'Games sheet' },
  { id: 'practices', title: 'Practice block' },
];

export default function ScheduleImportSheet({
  orgSlug,
  teamId,
  existing,
  seasonStart,
  seasonEnd,
  onClose,
  onImported,
}: {
  orgSlug: string;
  teamId: string;
  /** What is already on the schedule, resolved to org-zone days by the caller. */
  existing: ExistingScheduleEvent[];
  seasonStart?: string | null;
  seasonEnd?: string | null;
  onClose: () => void;
  onImported: (summary: { created: number; updated: number }) => void;
}) {
  useOverlayOpen(true);

  const [step, setStep] = useState<Step>('input');
  const [tab, setTab] = useState<Tab>('paste');
  const [pasteText, setPasteText] = useState('');
  const [draft, setDraft] = useState<DraftScheduleRow[]>([]);
  const [keepBoth, setKeepBoth] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-review on EVERY keystroke, against data the client already holds — a fix in the preview
  // shows its new verdict immediately rather than after a round trip.
  const reviewed = useMemo(
    () => reviewScheduleRows(draft, existing, {
      keepBothRowNumbers: [...keepBoth],
      seasonStart, seasonEnd,
    }),
    [draft, existing, keepBoth, seasonStart, seasonEnd],
  );
  const writable = committableScheduleRows(reviewed);
  const blocked = reviewed.filter(r => r.outcome === 'blocked');
  const adds = reviewed.filter(r => r.outcome === 'add').length;
  const updates = reviewed.filter(r => r.outcome === 'update').length;

  const requestClose = useDiscardGuard({
    dirty: draft.length > 0,
    close: onClose,
    noun: 'import',
    detail: draft.length ? `${draft.length} row${draft.length === 1 ? '' : 's'} you haven’t imported yet` : undefined,
  });

  // ── templates ──────────────────────────────────────────────────────────────

  async function downloadTemplate(kind: ScheduleTemplateKind, format: 'xlsx' | 'csv') {
    const [headers, ...rows] = buildScheduleTemplate(kind);
    const name = `schedule-${kind}-template`;
    if (format === 'csv') downloadCSVBlob(`${name}.csv`, generateCSV(headers, rows));
    else await downloadXLSX(`${name}.xlsx`, headers, rows, 'Template');
  }

  // ── input ──────────────────────────────────────────────────────────────────

  function reviewPaste() {
    setError('');
    const text = pasteText.trim();
    if (!text) { setError('Paste your rows first — include the header row from your sheet if it has one.'); return; }
    const rows = rowsFromSchedulePaste(text).filter(r => !isBlankScheduleRow(r));
    if (!rows.length) { setError('No rows we could read. Keep one event per line, or start from a template.'); return; }
    setDraft(rows);
    setStep('review');
  }

  async function reviewFile(file: File) {
    setBusy(true); setError(''); setFileName(file.name);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/import/preview`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That file could not be read.');
      setDraft((data.rows ?? []) as DraftScheduleRow[]);
      setStep('review');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
      setFileName('');
    } finally {
      setBusy(false);
    }
  }

  function editCell(rowNumber: number, key: keyof DraftScheduleRow, value: string) {
    setDraft(rows => rows.map(r => (r.rowNumber === rowNumber ? { ...r, [key]: value } : r)));
  }

  function dropRow(rowNumber: number) {
    setDraft(rows => rows.filter(r => r.rowNumber !== rowNumber));
  }

  // ── commit ─────────────────────────────────────────────────────────────────

  async function commit() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: draft, keepBothRowNumbers: [...keepBoth] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Nothing could be imported.');
      onImported({ created: data.created ?? 0, updated: data.updated ?? 0 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Nothing could be imported.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${shared.modalOverlay} ${shared.sheetOnMobile}`} onPointerDown={e => { if (e.target === e.currentTarget) (requestClose)?.(); }}>
      <div
        className={`${shared.modal} ${shared.modalFlushFooter} ${styles.sheet}`}
        onClick={e => e.stopPropagation()}
      >
        <CoachModalHeader
          title={step === 'review' ? 'Review what we read' : 'Bring in a schedule'}
          onClose={requestClose}
        />

        <div className={shared.formBody}>
          {step === 'input' && (
            <>
              <p className={shared.formHint}>
                Paste it from an email, or upload the file the league sent.
              </p>

              <div className={styles.tabs} role="tablist" aria-label="How to bring the schedule in">
                <button
                  type="button" role="tab" aria-selected={tab === 'paste'}
                  className={`${styles.tab} ${tab === 'paste' ? styles.tabActive : ''}`}
                  onClick={() => setTab('paste')}
                >Paste</button>
                <button
                  type="button" role="tab" aria-selected={tab === 'file'}
                  className={`${styles.tab} ${tab === 'file' ? styles.tabActive : ''}`}
                  onClick={() => setTab('file')}
                >Upload a file</button>
              </div>

              {tab === 'paste' ? (
                <>
                  <textarea
                    className={styles.paste}
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder={'Paste rows here — date, time, event type, opponent, location…'}
                    aria-label="Paste your schedule rows"
                  />
                  <button type="button" className={shared.btnPrimary} onClick={reviewPaste}>
                    Review rows
                  </button>
                </>
              ) : (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xlsm,.txt"
                    className={styles.fileInput}
                    onChange={e => { const f = e.target.files?.[0]; if (f) void reviewFile(f); }}
                  />
                  <button
                    type="button" className={shared.btnSecondary} disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={15} aria-hidden /> {busy ? 'Reading…' : 'Choose a file'}
                  </button>
                  {fileName && <p className={shared.formHint}>{fileName}</p>}
                  <p className={shared.formHint}>Excel (.xlsx) or CSV, up to {MAX_SCHEDULE_IMPORT_ROWS} rows.</p>
                </>
              )}

              <div className={styles.templates}>
                <p className={styles.templatesHead}><FileSpreadsheet size={14} aria-hidden /> Templates</p>
                {TEMPLATES.map(t => (
                  <div key={t.id} className={styles.templateRow}>
                    <span>{t.title}</span>
                    <span className={styles.templateLinks}>
                      <button type="button" className={styles.linkBtn} onClick={() => void downloadTemplate(t.id, 'xlsx')}>
                        <Download size={13} aria-hidden /> Excel
                      </button>
                      <button type="button" className={styles.linkBtn} onClick={() => void downloadTemplate(t.id, 'csv')}>
                        CSV
                      </button>
                    </span>
                  </div>
                ))}
                <p className={shared.formHint}>
                  Already exported from here? Bring the same file back — it reads its own columns.
                </p>
              </div>

              {error && <p className={shared.errorText}>{error}</p>}
            </>
          )}

          {step === 'review' && (
            <>
              <p className={styles.summary}>
                <strong>{reviewed.length} row{reviewed.length === 1 ? '' : 's'} read</strong>
                {' · '}{adds} will be added
                {updates > 0 && <> · {updates} update{updates === 1 ? 's' : ''} something you have</>}
                {blocked.length > 0 && <> · {blocked.length} need{blocked.length === 1 ? 's' : ''} a fix</>}
              </p>

              <div className={styles.rows}>
                {reviewed.map(row => (
                  <div key={row.rowNumber} className={styles.row} data-outcome={row.outcome}>
                    <div className={styles.rowTop}>
                      <span className={styles.rowWhen}>
                        <input
                          className={styles.cellDate}
                          value={row.date}
                          aria-label={`Date on row ${row.rowNumber}`}
                          onChange={e => editCell(row.rowNumber, 'date', e.target.value)}
                        />
                        <input
                          className={styles.cellTime}
                          value={row.time}
                          aria-label={`Time on row ${row.rowNumber}`}
                          onChange={e => editCell(row.rowNumber, 'time', e.target.value)}
                        />
                      </span>
                      <span className={styles.verdict} data-outcome={row.outcome}>
                        {row.outcome === 'add' ? 'Adds'
                          : row.outcome === 'update' ? 'Updates'
                          : row.outcome === 'organizer' ? 'Already yours'
                          : 'Can’t import'}
                      </span>
                      <button
                        type="button" className={styles.rowDrop}
                        aria-label={`Remove row ${row.rowNumber}`}
                        onClick={() => dropRow(row.rowNumber)}
                      >✕</button>
                    </div>

                    <div className={styles.rowBody}>
                      <input
                        className={styles.cellType}
                        value={row.eventType}
                        aria-label={`Event type on row ${row.rowNumber}`}
                        placeholder="Event type"
                        onChange={e => editCell(row.rowNumber, 'eventType', e.target.value)}
                      />
                      <input
                        className={styles.cellOpponent}
                        value={row.opponent}
                        aria-label={`Opponent on row ${row.rowNumber}`}
                        placeholder="Opponent"
                        onChange={e => editCell(row.rowNumber, 'opponent', e.target.value)}
                      />
                      <input
                        className={styles.cellLocation}
                        value={row.location}
                        aria-label={`Location on row ${row.rowNumber}`}
                        placeholder="Location"
                        onChange={e => editCell(row.rowNumber, 'location', e.target.value)}
                      />
                    </div>

                    {row.reason && <p className={styles.reason}>{row.reason}</p>}
                    {row.warning && (
                      <p className={styles.warning}><TriangleAlert size={12} aria-hidden /> {row.warning}</p>
                    )}

                    {row.outcome === 'organizer' && (
                      <div className={styles.rowActions}>
                        <button
                          type="button" className={shared.btnSecondary}
                          onClick={() => setKeepBoth(s => new Set(s).add(row.rowNumber))}
                        >Keep both</button>
                        <button
                          type="button" className={shared.btnGhost}
                          onClick={() => dropRow(row.rowNumber)}
                        >Skip this row</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {error && <p className={shared.errorText}>{error}</p>}
            </>
          )}
        </div>

        <div className={shared.modalFooter}>
          {step === 'review' ? (
            <>
              <button type="button" className={shared.btnGhost} onClick={() => setStep('input')}>
                <ArrowLeft size={15} aria-hidden /> Back
              </button>
              <button
                type="button" className={shared.btnPrimary}
                disabled={busy || writable.length === 0}
                onClick={() => void commit()}
              >
                {busy ? 'Importing…' : `Import ${writable.length} row${writable.length === 1 ? '' : 's'}`}
              </button>
            </>
          ) : (
            <button type="button" className={shared.btnGhost} onClick={requestClose}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}
