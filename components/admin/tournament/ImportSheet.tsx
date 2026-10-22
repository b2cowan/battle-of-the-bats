'use client';
/**
 * THE IMPORT SHEET — Tournament admin redesign Stage 5 (E10, A59; hub v45, ruled as drawn 2026-10-10). Data tools
 * retired: each import lives with its data, through this one sheet in the coach budget's shape (BudgetImportSheet —
 * sharing that shell across the portals is a named follow-up, not this build):
 *
 *   Start from a template   this event's rows (to update them) or an empty one (for new rows) · Excel or CSV
 *   Your file               choose it, and the preview reads it at once
 *   the preview             A SUMMARY (owner, 2026-10-12 — the Import Preview Redraw, A1–A8): one frame of the list
 *                           standard's group rows, Can't import · To add · To update · No change, each with its count;
 *                           only Can't import opens by itself, and an open group shows twenty rows, then "Show all". A
 *                           note rows share is said once on the group, a row's own note stays on it and leads
 *                           (`previewGroups`); an added game says when and where, an added team its division, an
 *                           update each change as "Column: old → new". What the file can't change is said above it
 *                           (rows missing from it stay as they are). On a phone, reading a file brings the preview up.
 *   Import N rows           only from a clean preview (today's rule: a row that can't import is fixed in the file,
 *                           then the file chosen again); nothing changes before it. While a row can't import, the foot
 *                           says so IN ITS PLACE ("1 row can't import. Fix it…") — seen at any scroll, and never a
 *                           greyed "Import 2 rows" promising rows it won't import (owner, 2026-10-12)
 *   N earlier imports       the list Data tools called Recent imports, inside the import it belongs to
 *
 * Teams' Tools opens it for teams, the schedule's Tools for games — and only Tools: an empty list no longer offers a
 * second button beside its create (owner, 2026-10-12).
 * The routes are today's (preview → batch → commit), unchanged.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, TriangleAlert, Upload } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { ClubRow, ClubRowList } from '@/components/admin/kit/club/RepKit';
import { FormError } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CheckChoice, RecordSection } from '@/components/admin/tournament/ScreenParts';
import type { ImportCommitResult, ImportPreview, ImportPreviewRow } from '@/lib/import/types';
import {
  IMPORT_WORDS as W, changeLine, changedColumns, changedOnly, earlierLine, importAction, previewGroups, type ImportKind, type ImportVerb,
} from '@/lib/tournament-import-words';
import { formatMoney } from '@/lib/tournament-teams';
import { formatTime } from '@/lib/utils';
import { formatShortWeekdayDate, formatStoredDate, utcToZonedInputs } from '@/lib/timezone';
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

/** A changed ID column is said by its NAME, which the preview keeps beside it in the same record (A4). */
const NAME_OF: Readonly<Record<string, string>> = {
  Division: 'divisionName', 'Home Team': 'homeTeamName', 'Away Team': 'awayTeamName', Venue: 'venueName', Facility: 'venueFacilityName',
};
const MONEY_COLUMNS = new Set(['Deposit Paid', 'Total Paid']);
const WORD_COLUMNS = new Set(['Status', 'Payment Status']);
const CENTS = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** The event's money, its cents kept when it has any: the whole-dollar format read $25.10 → $25.40 as "$25 → $25". */
const money = (n: number) => (Number.isInteger(n) ? formatMoney(n) : CENTS.format(n));

/** One side of a change, in the house formats: the day as a schedule row says it, the house clock, the event's money. */
function shownValue(field: string, value: unknown, record: Record<string, unknown> | undefined): string {
  const v = NAME_OF[field] ? record?.[NAME_OF[field]] : value;
  if (v == null || v === '') return W.blank;
  const text = String(v);
  if (field === 'Game Date') return formatShortWeekdayDate(text);
  if (field === 'Start Time') return formatTime(text);
  if (MONEY_COLUMNS.has(field) && typeof v === 'number') return money(v);
  if (WORD_COLUMNS.has(field)) return text.charAt(0).toUpperCase() + text.slice(1);
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

/**
 * What a row says when its group is open (A4): why it can't import; each change as "Column: old → new"; an added or
 * unchanged game its day, time and field; an added or unchanged team its division.
 */
function itemCaption(kind: ImportKind, key: ImportVerb, row: ImportPreviewRow): string {
  if (key === 'blocked') return row.errors.join(' ');
  if (key === 'update') {
    return row.changes.map(c => {
      const before = shownValue(c.field, c.before, row.before);
      const after = shownValue(c.field, c.after, row.after);
      return before === after ? changedOnly(c.field) : changeLine(c.field, before, after);
    }).join(' · ');
  }
  const rec = row.after ?? row.normalized;
  if (kind === 'teams') return typeof rec.divisionName === 'string' ? rec.divisionName : '';
  const where = rec.venueFacilityName || rec.venueName || rec.location;
  return [
    typeof rec.gameDate === 'string' && rec.gameDate ? formatShortWeekdayDate(rec.gameDate) : '',
    typeof rec.startTime === 'string' && rec.startTime ? formatTime(rec.startTime) : '',
    typeof where === 'string' ? where : '',
  ].filter(Boolean).join(' · ');
}

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
  // Only Can't import opens by itself, at every file size (A2); "Show all" is per group.
  const [open, setOpen] = useState<ReadonlySet<ImportVerb>>(() => new Set<ImportVerb>(['blocked']));
  const [showAll, setShowAll] = useState<ReadonlySet<ImportVerb>>(() => new Set<ImportVerb>());
  const inputRef = useRef<HTMLInputElement>(null);
  const previewTop = useRef<HTMLSpanElement>(null);

  // A8: on a phone the preview sits under the template and file sections, below the fold — once a file is read, the
  // window brings it up. A desk already shows it, so nothing moves there.
  useEffect(() => {
    if (!preview || !window.matchMedia('(max-width: 640px)').matches) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    previewTop.current?.parentElement?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
  }, [preview]);

  const toggleGroup = (key: ImportVerb) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

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
        setEarlier(data.imports ?? []); // the route answers this kind's applied imports (kind, applied=1)
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
    setOpen(new Set<ImportVerb>(['blocked']));
    setShowAll(new Set<ImportVerb>());
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

  // Can't import leads, then To add, To update, No change; a group with nothing in it is absent (A1).
  const groups = previewGroups(preview?.rows ?? []);
  const blocked = preview?.summary.blocked ?? 0;
  const templateHref = `${base}/${ROUTE[kind]}/template?mode=${mode}&format=${format}&${org}`;

  return (
    <KitDialog
      kind="form"
      size="medium"
      title={W.title(kind)}
      identity={W.identity(tournament.name)}
      onClose={() => { if (!importing) onClose(); }}
      busy={importing}
      /* A standing state, not a refusal: written in the foot rather than in the window's reason slot, which quiets on
         any click in the body ("Show all rows" would hide it) — and at the foot's LEFT, as every sentence in a window's
         foot is (owner, 2026-10-12). */
      footerStart={!result && blocked > 0 ? <p className={styles.blockedFoot} role="alert">{W.blockedFoot(blocked)}</p> : undefined}
      footer={result ? (
        <button type="button" className="btn btn-lime" onClick={onClose}>{W.done}</button>
      ) : (
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={importing}>{W.cancel}</button>
          {blocked === 0 && (
            <button type="button" className="btn btn-lime" onClick={() => void doImport()}
              disabled={!preview?.canCommit || importing || reading || changing === 0}>
              {importing ? W.importing : preview ? importAction(changing) : W.importBare}
            </button>
          )}
        </>
      )}
    >
      <FormError>{error}</FormError>

      <RecordSection title={W.template}>
        {/* A row of controls, not a form: the two choices take the toolbar height so they sit level with Download
            template (One control height, 2026-10-03; owner, 2026-10-12). */}
        <div className={styles.templateRow}>
          <label className={ck.field} htmlFor={`import-${kind}-mode`}>
            <span className="sr-only">{W.template}</span>
            <select id={`import-${kind}-mode`} className={`${ck.select} ${ck.toolbarSelect}`} value={mode} onChange={e => setMode(e.target.value as 'current' | 'empty')}>
              <option value="current">{W.templateCurrent(kind)}</option>
              <option value="empty">{W.templateEmpty(kind)}</option>
            </select>
          </label>
          <label className={ck.field} htmlFor={`import-${kind}-format`}>
            <span className="sr-only">{W.format}</span>
            <select id={`import-${kind}-format`} className={`${ck.select} ${ck.toolbarSelect}`} value={format} onChange={e => setFormat(e.target.value as 'xlsx' | 'csv')}>
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
        <RecordSection title={W.preview}>
          {/* A8's mark: its parent is this section, which a phone scrolls to the top once a file is read. */}
          <span ref={previewTop} hidden />
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
          {groups.length > 0 && (
            <div className={styles.groups}>
              {groups.map(g => {
                const isOpen = open.has(g.key);
                const all = showAll.has(g.key);
                const listId = `import-${kind}-${g.key}`;
                const aboutId = `${listId}-about`;
                const hasAbout = g.columns.length > 0 || g.shared.length > 0 || g.ownCount > 0;
                return (
                  <div key={g.key} className={styles.group} data-import-group={g.key}>
                    {/* Its name is the group and its count; what the lines under the title say is its description, so a
                        screen reader hears both (/review, 2026-10-12). */}
                    <button type="button" className={styles.groupRow} onClick={() => toggleGroup(g.key)}
                      aria-expanded={isOpen} aria-controls={isOpen ? listId : undefined} aria-label={W.groupLabel(g.key, g.items.length)}
                      aria-describedby={hasAbout ? aboutId : undefined}>
                      {/* Only Can't import carries a mark: a "+" beside "To add" read as a create button (/design). */}
                      <span className={styles.groupMark} aria-hidden>{g.key === 'blocked' && <TriangleAlert size={16} />}</span>
                      <span className={styles.groupMain}>
                        <span className={styles.groupTitle}>{W.group[g.key]}</span>
                        {hasAbout && (
                          <span id={aboutId} className={styles.groupAbout}>
                            {g.columns.length > 0 && <span className={styles.groupNote}>{changedColumns(g.columns)}</span>}
                            {g.shared.map(n => <span key={n.text} className={styles.groupNote}><b>{n.count}</b> · {n.text}</span>)}
                            {g.ownCount > 0 && <span className={styles.groupNote}>{W.ownNotes(g.ownCount)}</span>}
                          </span>
                        )}
                      </span>
                      <span className={styles.groupCount}>{g.items.length}</span>
                      <ChevronDown size={16} className={styles.groupChevron} aria-hidden />
                    </button>
                    {isOpen && (
                      <ul id={listId} className={styles.items} aria-label={W.group[g.key]}>
                        {(all ? g.items : g.items.slice(0, FIRST_ROWS)).map(({ row, ownNotes }) => {
                          const caption = itemCaption(kind, g.key, row);
                          return (
                            <li key={row.rowNumber} className={styles.item}>
                              <span className={styles.itemLead}>{W.row(row.rowNumber)}</span>
                              <span className={styles.itemMain}>
                                <span className={styles.itemTitle}>{row.displayName || W.row(row.rowNumber)}</span>
                                {/* On a phone the number moves onto this line, in the quiet ink: it is not part of the reason. */}
                                <span className={`${styles.itemCaption}${g.key === 'blocked' ? ` ${styles.itemBad}` : ''}`}>
                                  <span className={styles.itemRowInline}>{W.row(row.rowNumber)}{caption ? ' · ' : ''}</span>{caption}
                                </span>
                                {ownNotes.map(n => <span key={n} className={`${styles.itemCaption} ${styles.itemNote}`}>{n}</span>)}
                              </span>
                            </li>
                          );
                        })}
                        {!all && g.items.length > FIRST_ROWS && (
                          <li className={styles.itemMore}>
                            <button type="button" className={styles.more} onClick={() => setShowAll(prev => new Set(prev).add(g.key))}>
                              {W.showAll(g.items.length)}
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {kind === 'teams' && !result && preview.summary.creates > 0 && preview.canCommit && (
            <CheckChoice checked={emailCoaches} onChange={setEmailCoaches} title={W.emailCoaches} disabled={importing} />
          )}
          {result && (
            <p className={styles.done} role="status">
              {W.imported(result.summary.created, result.summary.updated)}{result.emailsSent ? W.emailed(result.emailsSent) : ''}{result.paymentsRecorded ? W.paymentsRecorded(result.paymentsRecorded) : ''}
            </p>
          )}
          {result?.paymentIssues?.map((i, n) => (
            <p key={`${i.rowNumber}-${n}`} className={styles.refused} role="alert">{W.paymentRefused(i.rowNumber, i.teamName, i.message)}</p>
          ))}
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
