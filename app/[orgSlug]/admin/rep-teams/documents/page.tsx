'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { FileText, Upload, Download, Trash2, Eye, EyeOff, X } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../rep-teams.module.css';
import type { RepDocumentType } from '@/lib/types';

const DOC_TYPE_LABELS: Record<RepDocumentType, string> = {
  waiver:           'Waiver',
  medical_consent:  'Medical Consent',
  code_of_conduct:  'Code of Conduct',
  other:            'Other',
};
const VALID_DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as RepDocumentType[];

interface TemplateRow {
  id: string;
  teamId: string | null;
  name: string;
  documentType: RepDocumentType;
  fileName: string;
  fileSize: number;
  isActive: boolean;
  publishedBy: string | null;
  createdAt: string;
}

export default function AdminDocumentsPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [fetching, setFetching] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<RepDocumentType>('other');
  const [uploadTeamId, setUploadTeamId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TemplateRow | null>(null);

  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');

  function showFeedback(type: 'success' | 'error', msg: string) {
    setFeedbackType(type);
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 4000);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/admin/rep-teams/document-templates');
      const data = await res.json();
      if (res.ok) setTemplates(data.templates ?? []);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  if (!loading && (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams'))) {
    return (
      <div className={styles.accessDenied}>
        <h2>Access Denied</h2>
        <p>You do not have permission to manage rep team documents.</p>
      </div>
    );
  }

  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('name', uploadName.trim());
      form.append('documentType', uploadType);
      if (uploadTeamId.trim()) form.append('teamId', uploadTeamId.trim());
      const res = await fetch('/api/admin/rep-teams/document-templates', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      await load();
      setUploadOpen(false);
      setUploadFile(null);
      setUploadName('');
      setUploadTeamId('');
      if (fileRef.current) fileRef.current.value = '';
      showFeedback('success', 'Template uploaded.');
    } catch (e: any) {
      setUploadError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(templateId: string, fileName: string) {
    const res = await fetch(`/api/admin/rep-teams/document-templates/${templateId}`);
    const data = await res.json();
    if (!res.ok || !data.url) { showFeedback('error', 'Could not generate download link.'); return; }
    const a = document.createElement('a');
    a.href = data.url;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }

  async function handleToggleActive(t: TemplateRow) {
    setTogglingId(t.id);
    try {
      const res = await fetch(`/api/admin/rep-teams/document-templates/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      if (res.ok) {
        setTemplates(prev => prev.map(r => r.id === t.id ? { ...r, isActive: !r.isActive } : r));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(t: TemplateRow) {
    setDeletingId(t.id);
    try {
      const res = await fetch(`/api/admin/rep-teams/document-templates/${t.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(prev => prev.filter(r => r.id !== t.id));
        showFeedback('success', `"${t.name}" deleted.`);
      } else {
        showFeedback('error', 'Delete failed.');
      }
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  const orgWide = templates.filter(t => t.teamId === null);
  const teamSpecific = templates.filter(t => t.teamId !== null);

  function TemplateTable({ rows }: { rows: TemplateRow[] }) {
    if (rows.length === 0) return <p className={styles.detailPlaceholder}>No templates.</p>;
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>File</th>
              <th className={styles.th}>Size</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Added</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} className={styles.tr}>
                <td className={styles.td} style={{ fontWeight: 600 }}>{t.name}</td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${styles.badgeInfo}`}>
                    {DOC_TYPE_LABELS[t.documentType] ?? t.documentType}
                  </span>
                </td>
                <td className={styles.td} style={{ color: 'var(--white-60)', fontSize: '0.82rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.fileName}
                </td>
                <td className={styles.td} style={{ color: 'var(--white-50)', fontSize: '0.82rem' }}>
                  {formatBytes(t.fileSize)}
                </td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${t.isActive ? styles.badgeActive : styles.badgeDraft}`}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className={styles.td} style={{ color: 'var(--white-50)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td className={styles.td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', marginRight: '0.2rem' }}
                    onClick={() => handleDownload(t.id, t.fileName)}
                    title="Download"
                  >
                    <Download size={13} />
                  </button>
                  {canWrite && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', marginRight: '0.2rem', opacity: togglingId === t.id ? 0.5 : 1 }}
                        disabled={togglingId === t.id}
                        onClick={() => handleToggleActive(t)}
                        title={t.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {t.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', color: '#f87171', opacity: deletingId === t.id ? 0.5 : 1 }}
                        disabled={deletingId === t.id}
                        onClick={() => setConfirmDelete(t)}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}>
            <FileText size={22} />
          </div>
          <div>
            <h1 className={styles.pageTitle}>Document Templates</h1>
            <p className={styles.pageSub}>
              <Link href={`/${currentOrg?.slug}/admin/rep-teams`} style={{ color: 'var(--white-40)', textDecoration: 'none' }}>
                Rep Teams
              </Link>
              {' → '}Documents
            </p>
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
            onClick={() => { setUploadOpen(true); setUploadError(''); }}
          >
            <Upload size={14} /> Upload Template
          </button>
        )}
      </div>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '2px',
          marginBottom: '1rem',
          background: feedbackType === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          border: `1px solid ${feedbackType === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
          color: feedbackType === 'success' ? '#4ade80' : '#f87171',
          fontSize: '0.88rem',
        }}>
          {feedbackMsg}
        </div>
      )}

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {/* Org-wide templates */}
          <div className={styles.detailSection}>
            <p className={styles.detailSectionTitle}>Org-Wide Templates</p>
            <TemplateTable rows={orgWide} />
          </div>

          {/* Team-specific templates */}
          <div className={styles.detailSection}>
            <p className={styles.detailSectionTitle}>Team-Specific Templates</p>
            <TemplateTable rows={teamSpecific} />
          </div>
        </>
      )}

      {/* Upload modal */}
      {uploadOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Upload Template</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadName(''); setUploadTeamId(''); setUploadError(''); if (fileRef.current) fileRef.current.value = ''; }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className={styles.field}>
                <label className={styles.label}>Template Name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="e.g. Participant Waiver 2025"
                  maxLength={120}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Document Type</label>
                <select
                  className={styles.select}
                  value={uploadType}
                  onChange={e => setUploadType(e.target.value as RepDocumentType)}
                >
                  {VALID_DOC_TYPES.map(v => (
                    <option key={v} value={v}>{DOC_TYPE_LABELS[v]}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Team (optional)</label>
                <input
                  type="text"
                  className={styles.input}
                  value={uploadTeamId}
                  onChange={e => setUploadTeamId(e.target.value)}
                  placeholder="Team ID — leave blank for org-wide"
                />
                <p className={styles.hint}>Leave blank to make this template available to all teams.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>File <span style={{ fontWeight: 400, textTransform: 'none', fontSize: '0.75rem' }}>(PDF, JPG, PNG, DOCX — max 10 MB)</span></label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  className={styles.input}
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {uploadError && (
                <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>{uploadError}</p>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadName(''); setUploadTeamId(''); setUploadError(''); if (fileRef.current) fileRef.current.value = ''; }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!uploadFile || !uploadName.trim() || uploading}
                onClick={handleUpload}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p className={styles.confirmTitle}>Delete Template</p>
            <p className={styles.confirmMsg}>
              Delete &ldquo;{confirmDelete.name}&rdquo;? This cannot be undone. The file will be removed from storage.
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deletingId === confirmDelete.id}
                onClick={() => handleDelete(confirmDelete)}
              >
                {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
