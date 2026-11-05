'use client';
import { useState, useEffect, useId, useRef } from 'react';
import { Upload, Download, Trash2 } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import CoachPageSection from '@/components/coaches/CoachPageSection';
import QuestionShell, { QuestionCancel, QuestionReason } from '@/components/coaches/QuestionShell';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import type { RepDocumentType } from '@/lib/types';
import { DOCUMENT_TYPE_LABEL, DOCUMENT_TYPE_ORDER, type DocumentStateRow } from '@/lib/document-state';
import { formatStoredDate } from '@/lib/timezone';

/* ⚖ Club Tier Stage 14 S4 (owner 2026-11-04, Ask 10 A; drawings tab 3 + 5B): the section lists the child's papers on
   THIS team, every season. Above the files, one row per form the team asks for (or the child signed before here):
   "Needs signing" / "On file" for the working season, with an Upload on a row that needs one. An earlier season's copy
   is listed with its season and can be downloaded, never deleted (a record). Labels are sentence case in both portals. */

interface DocRow {
  id: string;
  documentType: RepDocumentType;
  fileName: string;
  fileSize: number;
  templateId: string | null;
  uploadedBy: string | null;
  createdAt: string;
  seasonName: string;
  /** On THIS season's entry — the only copies Delete is offered on. */
  thisSeason: boolean;
}

interface Props {
  orgSlug: string;
  teamId: string;
  playerId: string;
  /**
   * Whether THIS coach may upload/delete. Mirrors `canManagePlayerDocuments` (documents:'manage'
   * AND rosterPii) — the POST and DELETE routes both 403 without it, and an assistant's documents
   * default is view-only, so an ungated Upload button was an action they could never complete.
   * Fails OPEN (the routes are the real gate); the player page only mounts this section when
   * `canViewPlayerDocuments` already passed, so the default is never the effective value there.
   */
  canManage?: boolean;
}

export default function PlayerDocumentsSection({ orgSlug, teamId, playerId, canManage = true }: Props) {
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/documents`;

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [rows, setRows] = useState<DocumentStateRow[]>([]);
  const [toSign, setToSign] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<RepDocumentType>('other');
  // The template a row's Upload answers (the server keeps it only when it applies to this team and matches the type).
  const [uploadTemplateId, setUploadTemplateId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const confirm = useConfirm();
  const ids = useId();
  const isPhone = useIsPhone();

  // A slow read for the player just left must not overwrite the one now open.
  const latestLoad = useRef(0);
  async function load() {
    const mine = ++latestLoad.current;
    setLoading(true);
    try {
      const res = await fetch(base);
      const data = await res.json();
      if (res.ok && mine === latestLoad.current) {
        setDocs(data.documents ?? []);
        setRows(data.rows ?? []);
        setToSign(data.toSign ?? null);
      }
    } finally {
      if (mine === latestLoad.current) setLoading(false);
    }
  }

  useEffect(() => { load(); }, [playerId]);

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('documentType', uploadType);
      if (uploadTemplateId) form.append('templateId', uploadTemplateId);
      const res = await fetch(base, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setUploadOpen(false);
      setUploadFile(null);
      // Re-read: the rows' state ("Needs signing" → "On file") is the server's rule, not recomputed here.
      await load();
    } catch (e: any) {
      setUploadError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // The window's one closer (×, Cancel, Escape, Back — after the ask when a file is chosen). The file field leaves with
  // the window, so the next opening starts empty.
  function closeUpload() {
    setUploadOpen(false);
    setUploadFile(null);
    setUploadError('');
  }

  /** Opens the upload window — from the head (any type) or from a row (that form, already chosen). */
  function openUpload(row?: DocumentStateRow) {
    setUploadType(row?.documentType ?? 'other');
    setUploadTemplateId(row?.templateId ?? null);
    setUploadError('');
    setUploadOpen(true);
  }

  async function handleDownload(docId: string, fileName: string) {
    const res = await fetch(`${base}/${docId}`);
    const data = await res.json();
    if (!res.ok || !data.url) return;
    const a = document.createElement('a');
    a.href = data.url;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }

  /** Asks first, then deletes (Row doors stage 1, owner 2026-10-20: the bin deleted on one tap, and dropped the row
   *  even when the server refused). A document has nothing else to open, so its two doors stay on the row. */
  async function handleDelete(doc: DocRow) {
    if (deletingId) return;
    const ok = await confirm({
      title: 'Delete this document?',
      message: `“${doc.fileName}” is removed from this player’s file. This can’t be undone.`,
      confirmText: 'Delete',
      cancelText: 'Keep',
      tone: 'danger',
    });
    if (!ok) return;
    setDeletingId(doc.id);
    setDeleteError('');
    try {
      const res = await fetch(`${base}/${doc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setDeleteError(`Couldn’t delete “${doc.fileName}” — try again.`);
    } finally {
      setDeletingId(null);
    }
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  /* ⚠ UPLOAD SITS IN THE SECTION HEAD, where every other section's action does (owner, §228 walk
     2026-09-24: "the upload button is pushed down, shouldn't it be in line with the header like
     the other tiles' edit buttons?"). So this component draws its own section rather than the page
     wrapping it and leaving the button on a row of its own under the title. On a phone it is the
     glyph alone, drawn as the section pencils are (no border, no fill); above 640 it keeps its word.
     It names its own object for AT either way (/review 2026-08-02). */
  const uploadButton = canManage ? (
    <button
      type="button"
      className={isPhone ? `${styles.footerIconBtn} ${styles.sectionEditBtn}` : 'btn btn-ghost'}
      style={isPhone ? undefined : { fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
      onClick={() => openUpload()}
      aria-label="Upload document"
      title={isPhone ? 'Upload' : undefined}
    >
      {isPhone ? <Upload size={18} aria-hidden /> : <><Upload size={13} aria-hidden /> Upload</>}
    </button>
  ) : undefined;

  // "2 to sign" — the section head's count (drawing 5A/5B), the same amber chip as the rows'.
  const toSignChip = toSign ? <span className={`${styles.pastChip} ${styles.pastChipWarn}`}>{toSign}</span> : undefined;

  return (
    <>
    <CoachPageSection sectionId="documents" title="Documents" meta={toSignChip} action={uploadButton}>

      {loading ? (
        <div className={styles.loadingState} style={{ padding: '0.5rem 0' }}>Loading documents…</div>
      ) : docs.length === 0 && rows.length === 0 ? (
        <p className={styles.detailPlaceholder}>No documents uploaded yet.</p>
      ) : (
        <>
        {rows.length > 0 && (
          <ul className={styles.docStateList}>
            {rows.map(row => (
              <li key={row.documentType} className={styles.docStateRow}>
                <span className={styles.docStateWhat}>
                  <span className={styles.docStateName}>
                    {row.label}
                    <span className={`${styles.pastChip} ${row.state === 'on_file' ? styles.pastChipGood : styles.pastChipWarn}`}>{row.chip}</span>
                  </span>
                  <span className={styles.docStateLine}>{row.line}</span>
                </span>
                {canManage && row.state === 'needs_signing' && (
                  <button
                    type="button"
                    className={isPhone ? styles.docStateUploadIcon : `btn btn-ghost ${styles.docStateUploadText}`}
                    style={isPhone ? undefined : { fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => openUpload(row)}
                    aria-label={`Upload ${row.label.toLowerCase()}`}
                    title={isPhone ? 'Upload' : undefined}
                  >
                    {isPhone ? <Upload size={18} aria-hidden /> : <><Upload size={13} aria-hidden /> Upload</>}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {docs.length > 0 && (<>
        {deleteError && <p className={styles.errorText} role="alert">{deleteError}</p>}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>File</th>
                <th className={styles.th}>Type</th>
                <th className={styles.th}>Season</th>
                <th className={styles.th}>Size</th>
                <th className={styles.th}>Uploaded</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id} className={styles.tr}>
                  <td className={styles.td} style={{ fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.fileName}
                  </td>
                  <td className={styles.td}>
                    <span className={styles.chipQuiet}>
                      {DOCUMENT_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                    </span>
                  </td>
                  <td className={styles.td} style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {doc.seasonName}
                  </td>
                  <td className={styles.td} style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))', fontSize: '0.82rem' }}>
                    {formatBytes(doc.fileSize)}
                  </td>
                  <td className={styles.td} style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {formatStoredDate(doc.createdAt)}
                  </td>
                  <td className={styles.td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {/* The shared row icon button: named for a screen reader, 44px under a finger. */}
                    <span style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className={styles.rowIconBtn}
                        onClick={() => handleDownload(doc.id, doc.fileName)}
                        aria-label={`Download ${doc.fileName}`}
                        title="Download"
                      >
                        <Download size={14} aria-hidden />
                      </button>
                      {canManage && doc.thisSeason && (
                      <button
                        type="button"
                        className={`${styles.rowIconBtn} ${styles.rowIconBtnDanger}`}
                        disabled={deletingId === doc.id}
                        onClick={() => handleDelete(doc)}
                        aria-label={`Delete ${doc.fileName}`}
                        title="Delete"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>)}
        </>
      )}
    </CoachPageSection>

      {/* The dialog is a sibling of the section, never inside its card.
          ⚖ THE ONE WINDOW (One Window Stage 2c, owner B3 + B5, 2026-10-19): a form that fills a phone, and with a file
          chosen ×, Cancel, Escape and the phone's Back ask in the foot first (it closed at once before). A refused upload
          says why beside the button. Never closes while the file is going up. */}
      <QuestionShell open={uploadOpen} onClose={closeUpload} dirty={uploadFile != null} busy={uploading}
        ariaLabel="Upload Document" title="Upload Document"
        footer={<>
          <QuestionCancel className="btn btn-ghost" />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!uploadFile || uploading}
            onClick={handleUpload}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${ids}-type`}>Document type</label>
            <select
              id={`${ids}-type`}
              className={styles.select}
              value={uploadType}
              onChange={e => { setUploadType(e.target.value as RepDocumentType); setUploadTemplateId(null); }}
            >
              {DOCUMENT_TYPE_ORDER.map(v => (
                <option key={v} value={v}>{DOCUMENT_TYPE_LABEL[v]}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${ids}-file`}>File <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.75rem' }}>(PDF, JPG, PNG, DOCX — max 10 MB)</span></label>
            <input
              id={`${ids}-file`}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              className={styles.input}
              onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadError(''); }}
            />
          </div>

          <QuestionReason className={styles.errorText}>{uploadError}</QuestionReason>
        </div>
      </QuestionShell>
    </>
  );
}
