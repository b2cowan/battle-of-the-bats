'use client';
/**
 * THE IMPORT SHEET — Tournament admin redesign Stage 5 (E10, A59; hub v45, ruled as drawn 2026-10-10). Data tools
 * retired: each import lives with its data, through this one sheet in the coach budget's shape (BudgetImportSheet —
 * sharing that shell across the portals is a named follow-up, not this build):
 *
 *   Start from a template   this event's rows (to update them) or an empty one (for new rows) · Excel or CSV
 *   Your file               choose it, and the preview reads it at once
 *   the preview             what each row will do — Adds, Updates, No change, Can't import and why — and what the
 *                           file can't change (rows missing from it stay as they are)
 *   Import N rows           only from a clean preview (today's rule: a row that can't import is fixed in the file,
 *                           then the file chosen again); nothing changes before it
 *   N earlier imports       the list Data tools called Recent imports, inside the import it belongs to
 *
 * Teams' Export menu opens it for teams, the schedule's Tools for games; an empty list offers it beside its create.
 * The routes are today's (preview → batch → commit), unchanged.
 */
import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { ClubRow, ClubRowList } from '@/components/admin/kit/club/RepKit';
import { FormError } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CheckChoice, RecordSection } from '@/components/admin/tournament/ScreenParts';
import type { ImportCommitResult, ImportPreview } from '@/lib/import/types';
import {
  IMPORT_WORDS as W, earlierLine, importAction, previewHead, rowCaption, type ImportKind,
} from '@/lib/tournament-import-words';
import { formatTime } from '@/lib/utils';
import { formatStoredDate, utcToZonedInputs } from '@/lib/timezone';
import styles from './ImportSheet.module.css';

type Earlier = {
  id: string;
  importType: string;
  status: 'previewed' | 'committed' | 'failed' | 'expired';
  sourceFilename: string | null;
  createdAt: string;
  committedAt: string | null;
  summary: { commit: { created: number; updated: number } | null };
};

const IMPORT_TYPE: Record<ImportKind, string> = { teams: 'tournament_teams', games: 'tournament_schedule' };
const ROUTE: Record<ImportKind, string> = { teams: 'registrations/import', games: 'schedule/import' };
const FIRST_ROWS = 20;

/** "Oct 9 · 4:12 p.m." in the org's zone — the house date and the house clock. */
const when = (iso: string | null) => (iso ? `${formatStoredDate(iso, { withYear: false })} · ${formatTime(utcToZonedInputs(iso).time)}` : '');

export default function ImportSheet({ kind, tournament, orgSlug, fieldWord = 'fields', onClose, onImported }: {
  kind: ImportKind;
  tournament: { id: string; name: string };
  orgSlug: string;
  /** The sport's word for its playing surfaces, plural ("diamonds") — the games preview's unmatched names. */
  fieldWord?: string;
  onClose: () => void;
  /** Re-reads the list the import changed. */
  onImported: () => void | Promise<void>;
}) {
  const base = `/api/admin/tournaments/${encodeURIComponent(tournament.id)}`;
  const org = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const [mode, setMode] = useState<'current' | 'empty'>('current');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [emailCoaches, setEmailCoaches] = useState(false);
  const [allRows, setAllRows] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Earlier imports: this kind's, the ones that went in or failed (a preview alone is not an import) ──
  const [earlier, setEarlier] = useState<Earlier[] | null>(null);
  const [earlierFailed, setEarlierFailed] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  // Re-read once an import lands (it joins the list), never on a file merely chosen.
  const [historyKey, setHistoryKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/imports/history?${org}&limit=20&kind=${IMPORT_TYPE[kind]}&applied=1`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('history'))))
      .then((data: { imports?: Earlier[] }) => {
        if (cancelled) return;
        setEarlier((data.imports ?? []).filter(i => i.importType === IMPORT_TYPE[kind] && (i.status === 'committed' || i.status === 'failed')));
      })
      .catch(() => { if (!cancelled) { setEarlier([]); setEarlierFailed(true); } });
    return () => { cancelled = true; };
  }, [base, org, kind, historyKey]);

  async function read(chosen: File) {
    setFile(chosen);
    setPreview(null);
    setResult(null);
    setError('');
    setEmailCoaches(false); // the opt-in is a fresh decision per file
    setAllRows(false);
    setReading(true);
    try {
      const form = new FormData();
      form.append('file', chosen);
      const res = await fetch(`${base}/${ROUTE[kind]}/preview?${org}`, { method: 'POST', credentials: 'same-origin', body: form });
      const data = await res.json().catch(() => null) as { preview?: ImportPreview; error?: string } | null;
      if (!res.ok || !data?.preview) throw new Error(data?.error && res.status < 500 ? data.error : W.previewFailed);
      setPreview(data.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : W.previewFailed);
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const changing = preview ? preview.summary.creates + preview.summary.updates : 0;
  async function doImport() {
    if (!preview?.canCommit || importing || result || changing === 0) return;
    setImporting(true);
    setError('');
    try {
      const res = await fetch(`${base}/${ROUTE[kind]}/commit?${org}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'teams' ? { batchId: preview.batchId, sendPortalEmails: emailCoaches } : { batchId: preview.batchId }),
      });
      const data = await res.json().catch(() => null) as { result?: ImportCommitResult; error?: string } | null;
      if (!res.ok || !data?.result) throw new Error(data?.error && res.status < 500 ? data.error : W.importFailed);
      setResult(data.result);
      setHistoryKey(k => k + 1);
      await onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : W.importFailed);
    } finally {
      setImporting(false);
    }
  }

  const rows = preview?.rows ?? [];
  const shown = allRows ? rows : rows.slice(0, FIRST_ROWS);
  const blocked = preview?.summary.blocked ?? 0;
  const templateHref = `${base}/${ROUTE[kind]}/template?mode=${mode}&format=${format}&${org}`;

  return (
    <KitDialog
      kind="form"
      title={W.title(kind)}
      identity={W.identity(tournament.name)}
      onClose={() => { if (!importing) onClose(); }}
      busy={importing}
      footer={result ? (
        <button type="button" className="btn btn-lime" onClick={onClose}>{W.done}</button>
      ) : (
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={importing}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void doImport()}
            disabled={!preview?.canCommit || importing || reading || changing === 0}>
            {importing ? W.importing : preview ? importAction(changing) : W.importBare}
          </button>
        </>
      )}
    >
      <FormError>{error}</FormError>

      <RecordSection title={W.template}>
        <div className={styles.templateRow}>
          <label className={ck.field} htmlFor={`import-${kind}-mode`}>
            <span className="sr-only">{W.template}</span>
            <select id={`import-${kind}-mode`} className={ck.select} value={mode} onChange={e => setMode(e.target.value as 'current' | 'empty')}>
              <option value="current">{W.templateCurrent(kind)}</option>
              <option value="empty">{W.templateEmpty(kind)}</option>
            </select>
          </label>
          <label className={ck.field} htmlFor={`import-${kind}-format`}>
            <span className="sr-only">{W.format}</span>
            <select id={`import-${kind}-format`} className={ck.select} value={format} onChange={e => setFormat(e.target.value as 'xlsx' | 'csv')}>
              <option value="xlsx">{W.excel}</option>
              <option value="csv">{W.csv}</option>
            </select>
          </label>
          <a className={`btn btn-outline ${styles.download}`} href={templateHref}>
            <Download size={14} aria-hidden /> {W.download}
          </a>
        </div>
      </RecordSection>

      <RecordSection title={W.file}>
        <input ref={inputRef} type="file" accept=".xlsx,.csv" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); }} />
        {file && (
          <p className={styles.fileLine} role="status">
            {reading ? W.reading : preview ? W.fileLine(file.name, preview.summary.totalRows) : file.name}
          </p>
        )}
        {!result && (
          <button type="button" className={`btn btn-outline ${styles.choose}`} onClick={() => inputRef.current?.click()} disabled={reading || importing}>
            <Upload size={14} aria-hidden /> {file ? W.chooseAnother : W.choose}
          </button>
        )}
      </RecordSection>

      {preview && (
        <RecordSection title={previewHead(preview.summary.creates, preview.summary.updates, blocked)}>
          <p className={styles.quiet}>{changing === 0 && blocked === 0 ? W.nothingChanges : W.missingStay(kind)}</p>
          {(preview.notices ?? []).map(n => <p key={n} className={styles.notice}>{n}</p>)}
          {kind === 'games' && preview.unmatchedLocations && preview.unmatchedLocations.length > 0 && (
            <div className={styles.notice}>
              <b>{W.unmatched(preview.unmatchedLocations.length, fieldWord)}</b>
              <ul className={styles.plainList}>
                {preview.unmatchedLocations.map(u => <li key={u.name}>{W.unmatchedRow(u.name, u.rows)}{u.ambiguous ? W.ambiguous : ''}</li>)}
              </ul>
              <span className={styles.quiet}>{W.unmatchedLine}</span>
            </div>
          )}
          <ClubRowList inset label={previewHead(preview.summary.creates, preview.summary.updates, blocked)}>
            {shown.map(r => (
              <ClubRow
                key={r.rowNumber}
                title={r.displayName || `Row ${r.rowNumber}`}
                caption={<span className={r.operation === 'blocked' ? styles.blocked : undefined}>
                  {rowCaption(r.operation, r.changes.map(c => c.field), r.errors, r.warnings)}
                </span>}
                lead={`Row ${r.rowNumber}`}
              />
            ))}
          </ClubRowList>
          {!allRows && rows.length > FIRST_ROWS && (
            <button type="button" className={styles.more} onClick={() => setAllRows(true)}>{W.showAll(rows.length)}</button>
          )}
          {blocked > 0 && <p className={styles.blockedFoot} role="alert">{W.blockedFoot}</p>}
          {kind === 'teams' && !result && preview.summary.creates > 0 && preview.canCommit && (
            <CheckChoice checked={emailCoaches} onChange={setEmailCoaches} title={W.emailCoaches} disabled={importing} />
          )}
          {result && (
            <p className={styles.done} role="status">
              {W.imported(result.summary.created, result.summary.updated)}{result.emailsSent ? W.emailed(result.emailsSent) : ''}
            </p>
          )}
        </RecordSection>
      )}

      {earlier && (earlier.length > 0 || earlierFailed) && (
        <RecordSection>
          <button type="button" className={styles.more} aria-expanded={showEarlier} onClick={() => setShowEarlier(v => !v)}>
            {earlierFailed ? W.earlierFailed : earlierLine(earlier.length)}
          </button>
          {showEarlier && earlier.length > 0 && (
            <ClubRowList inset label={W.earlierTitle}>
              {earlier.map(i => (
                <ClubRow
                  key={i.id}
                  title={i.sourceFilename || W.file}
                  caption={i.status === 'committed'
                    ? `${W.importedOn} ${when(i.committedAt ?? i.createdAt)}${i.summary.commit ? ` · ${i.summary.commit.created} added · ${i.summary.commit.updated} updated` : ''}`
                    : `${W.failedOn} · ${when(i.createdAt)}`}
                />
              ))}
            </ClubRowList>
          )}
        </RecordSection>
      )}
    </KitDialog>
  );
}

/** The import's door on an empty list, beside its create ("An event with no teams also offers it"). */
export function ImportDoor({ kind, onOpen }: { kind: ImportKind; onOpen: () => void }) {
  return (
    <button type="button" className={`btn btn-outline ${styles.door}`} onClick={onOpen} aria-haspopup="dialog">
      <Upload size={14} aria-hidden /> {W.door(kind)}
    </button>
  );
}
