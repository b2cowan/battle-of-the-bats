'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, FileText, RefreshCw, Upload, X } from 'lucide-react';
import type { ImportCommitResult, ImportPreview } from '@/lib/import/types';
import styles from './TournamentTeamsImportDialog.module.css';

type Props = {
  open: boolean;
  tournamentId: string;
  orgSlug?: string;
  onClose: () => void;
  onCommitted?: () => void | Promise<void>;
};

function buildQuery(orgSlug?: string) {
  return orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
}

function buildTemplateUrl(tournamentId: string, mode: 'current' | 'empty', format: 'xlsx' | 'csv', orgSlug?: string) {
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  return `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations/import/template?mode=${mode}&format=${format}${orgParam}`;
}

function statusLabel(preview: ImportPreview) {
  if (preview.summary.blocked > 0) return `${preview.summary.blocked} blocked`;
  if (preview.summary.warnings > 0) return `${preview.summary.warnings} warning${preview.summary.warnings === 1 ? '' : 's'}`;
  return 'Ready';
}

export default function TournamentTeamsImportDialog({ open, tournamentId, orgSlug, onClose, onCommitted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [sendPortalEmails, setSendPortalEmails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(() => buildQuery(orgSlug), [orgSlug]);

  if (!open) return null;

  async function runPreview() {
    if (!file || !tournamentId) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setCommitResult(null);
    setSendPortalEmails(false); // opt-in is a fresh decision per preview
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations/import/preview${query}`,
        { method: 'POST', credentials: 'same-origin', body: form },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Import preview failed.');
      setPreview(data.preview as ImportPreview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import preview failed.');
    } finally {
      setLoading(false);
    }
  }

  async function runCommit() {
    if (!preview || !preview.canCommit || !tournamentId || commitResult) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations/import/commit${query}`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: preview.batchId, sendPortalEmails }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Import apply failed.');
      setCommitResult(data.result as ImportCommitResult);
      await onCommitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import apply failed.');
    } finally {
      setCommitting(false);
    }
  }

  function closeAndReset() {
    setFile(null);
    setPreview(null);
    setCommitResult(null);
    setError(null);
    setLoading(false);
    setCommitting(false);
    setSendPortalEmails(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={closeAndReset}>
      <div className={`modal ${styles.modal}`} onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              <Upload size={18} aria-hidden />
              <h3>Add or Update Teams</h3>
            </div>
            <p>Download a template, edit it in Excel or Google Sheets, then preview and apply add/update rows. Missing teams are not deleted.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-data" onClick={closeAndReset} aria-label="Close import dialog">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.templateSection}>
            <div className={styles.sectionHeader}>
              <FileSpreadsheet size={16} aria-hidden />
              <span>Templates</span>
            </div>
            <div className={styles.templateRows}>
              <div className={styles.templateRow}>
                <div className={styles.templateCopy}>
                  <strong>Current data</strong>
                  <span>Best for bulk edits. Includes existing teams and IDs so updates match the right records.</span>
                </div>
                <div className={styles.templateActions}>
                  <a className={styles.templateButton} href={buildTemplateUrl(tournamentId, 'current', 'xlsx', orgSlug)}>
                    <Download size={13} aria-hidden />
                    <span>XLSX</span>
                  </a>
                  <a className={styles.templateButton} href={buildTemplateUrl(tournamentId, 'current', 'csv', orgSlug)}>
                    <FileText size={13} aria-hidden />
                    <span>CSV</span>
                  </a>
                </div>
              </div>
              <div className={styles.templateRow}>
                <div className={styles.templateCopy}>
                  <strong>Empty template</strong>
                  <span>Best for adding teams from scratch. Fill in team names, divisions, contacts, and payment fields.</span>
                </div>
                <div className={styles.templateActions}>
                  <a className={styles.templateButton} href={buildTemplateUrl(tournamentId, 'empty', 'xlsx', orgSlug)}>
                    <Download size={13} aria-hidden />
                    <span>XLSX</span>
                  </a>
                  <a className={styles.templateButton} href={buildTemplateUrl(tournamentId, 'empty', 'csv', orgSlug)}>
                    <FileText size={13} aria-hidden />
                    <span>CSV</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.uploadSection}>
            <div className={styles.sectionHeader}>
              <Upload size={16} aria-hidden />
              <span>Upload for Preview</span>
            </div>
            <div className={styles.uploadRow}>
              <label className={styles.filePicker}>
                <input
                  className={styles.fileInput}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={event => {
                    setFile(event.target.files?.[0] ?? null);
                    setPreview(null);
                    setCommitResult(null);
                    setError(null);
                    setSendPortalEmails(false);
                  }}
                />
                <span className={styles.filePickerButton}>
                  <FileSpreadsheet size={13} aria-hidden />
                  Choose file
                </span>
                <span className={styles.fileName}>{file?.name ?? 'No file selected'}</span>
              </label>
              <button type="button" className="btn btn-primary btn-data" onClick={runPreview} disabled={!file || loading}>
                {loading ? <RefreshCw size={13} className="spin" /> : <Upload size={13} />}
                {loading ? 'Previewing...' : 'Preview'}
              </button>
            </div>
            {error && (
              <div className={styles.errorBox}>
                <AlertCircle size={15} aria-hidden />
                <span>{error}</span>
              </div>
            )}
          </section>

          {preview && (
            <section className={styles.previewPanel}>
              <div className={styles.summaryHeader}>
                <div className={styles.previewTitle}>
                  {preview.summary.blocked > 0 ? <AlertCircle size={17} aria-hidden /> : <CheckCircle2 size={17} aria-hidden />}
                  <span>{statusLabel(preview)}</span>
                </div>
                <span className={styles.batchId}>Batch {preview.batchId.slice(0, 8)}</span>
              </div>
              <p className={styles.modeNote}>Add/update only. Teams missing from this file stay unchanged.</p>
              {preview.notices && preview.notices.length > 0 && (
                <div className={styles.noticeBox}>
                  <AlertCircle size={15} aria-hidden />
                  <ul className={styles.noticeList}>
                    {preview.notices.map(notice => <li key={notice}>{notice}</li>)}
                  </ul>
                </div>
              )}
              <div className={styles.summaryGrid}>
                <span><strong>{preview.summary.totalRows}</strong> rows</span>
                <span><strong>{preview.summary.creates}</strong> creates</span>
                <span><strong>{preview.summary.updates}</strong> updates</span>
                <span><strong>{preview.summary.unchanged}</strong> unchanged</span>
              </div>
              {!commitResult && preview.summary.creates > 0 && (
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', margin: '0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={sendPortalEmails}
                    onChange={event => setSendPortalEmails(event.target.checked)}
                    disabled={committing}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <span>Email these coaches a link to their Coaches Portal (new teams that have an email address only).</span>
                </label>
              )}
              {commitResult && (
                <div className={styles.successBox}>
                  <CheckCircle2 size={15} aria-hidden />
                  <span>
                    Applied {commitResult.summary.created} create{commitResult.summary.created === 1 ? '' : 's'} and {commitResult.summary.updated} update{commitResult.summary.updated === 1 ? '' : 's'}.
                    {commitResult.emailsSent ? ` Emailed ${commitResult.emailsSent} coach${commitResult.emailsSent === 1 ? '' : 'es'} a portal link.` : ''}
                  </span>
                </div>
              )}
              <div className={styles.tableWrap}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Action</th>
                      <th>Team</th>
                      <th>Changes</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(row => (
                      <tr key={row.rowNumber} data-blocked={row.operation === 'blocked' || undefined}>
                        <td>{row.rowNumber}</td>
                        <td><span className={styles.operation}>{row.operation}</span></td>
                        <td>{row.displayName}</td>
                        <td>
                          {row.changes.length === 0 ? (
                            <span className={styles.muted}>No changes</span>
                          ) : (
                            <ul className={styles.changeList}>
                              {row.changes.slice(0, 4).map(change => (
                                <li key={`${row.rowNumber}-${change.field}`}>
                                  <strong>{change.field}</strong>: {String(change.before ?? '') || 'blank'} to {String(change.after ?? '') || 'blank'}
                                </li>
                              ))}
                              {row.changes.length > 4 && <li>{row.changes.length - 4} more changes</li>}
                            </ul>
                          )}
                        </td>
                        <td>
                          {[...row.errors, ...row.warnings].length === 0 ? (
                            <span className={styles.muted}>None</span>
                          ) : (
                            <ul className={styles.noteList}>
                              {row.errors.map(note => <li key={`e-${note}`} className={styles.errorNote}>{note}</li>)}
                              {row.warnings.map(note => <li key={`w-${note}`}>{note}</li>)}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="modal-footer">
          <span className={styles.footerNote}>
            {commitResult ? 'Team data was updated.' : 'Preview first, then apply add/update changes.'}
          </span>
          {preview && !commitResult && (
            <button type="button" className="btn btn-primary btn-data" onClick={runCommit} disabled={!preview.canCommit || committing || loading}>
              {committing ? <RefreshCw size={13} className="spin" /> : <CheckCircle2 size={13} />}
              {committing ? 'Applying...' : preview.canCommit ? 'Apply Add/Update' : 'Resolve Blocked Rows'}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-data" onClick={closeAndReset}>Done</button>
        </div>
      </div>
    </div>
  );
}
