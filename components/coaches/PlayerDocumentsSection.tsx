'use client';
import { useState, useEffect, useRef } from 'react';
import { Upload, Download, Trash2, X } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import type { RepDocumentType } from '@/lib/types';

const DOC_TYPE_LABELS: Record<RepDocumentType, string> = {
  waiver:           'Waiver',
  medical_consent:  'Medical Consent',
  code_of_conduct:  'Code of Conduct',
  other:            'Other',
};

interface DocRow {
  id: string;
  documentType: RepDocumentType;
  fileName: string;
  fileSize: number;
  templateId: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface Props {
  orgSlug: string;
  teamId: string;
  playerId: string;
}

export default function PlayerDocumentsSection({ orgSlug, teamId, playerId }: Props) {
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}/documents`;

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<RepDocumentType>('other');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(base);
      const data = await res.json();
      if (res.ok) setDocs(data.documents ?? []);
    } finally {
      setLoading(false);
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
      const res = await fetch(base, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setDocs(prev => [data.document, ...prev]);
      setUploadOpen(false);
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setUploadError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
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

  async function handleDelete(docId: string) {
    setDeletingId(docId);
    try {
      await fetch(`${base}/${docId}`, { method: 'DELETE' });
      setDocs(prev => prev.filter(d => d.id !== docId));
    } finally {
      setDeletingId(null);
    }
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <p className={styles.detailSectionTitle} style={{ margin: 0 }}>Documents</p>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          onClick={() => { setUploadOpen(true); setUploadError(''); }}
        >
          <Upload size={13} /> Upload
        </button>
      </div>

      {loading ? (
        <div className={styles.loadingState} style={{ padding: '0.5rem 0' }}>Loading documents…</div>
      ) : docs.length === 0 ? (
        <p className={styles.detailPlaceholder}>No documents uploaded yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>File</th>
                <th className={styles.th}>Type</th>
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
                    <span className={`${styles.badge} ${styles.badgeTryout}`}>
                      {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                    </span>
                  </td>
                  <td className={styles.td} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
                    {formatBytes(doc.fileSize)}
                  </td>
                  <td className={styles.td} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className={styles.td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', marginRight: '0.25rem' }}
                      onClick={() => handleDownload(doc.id, doc.fileName)}
                      title="Download"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', color: '#f87171', opacity: deletingId === doc.id ? 0.5 : 1 }}
                      disabled={deletingId === doc.id}
                      onClick={() => handleDelete(doc.id)}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {uploadOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Upload Document</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadError(''); if (fileRef.current) fileRef.current.value = ''; }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className={styles.field}>
                <label className={styles.label}>Document Type</label>
                <select
                  className={styles.select}
                  value={uploadType}
                  onChange={e => setUploadType(e.target.value as RepDocumentType)}
                >
                  {(Object.entries(DOC_TYPE_LABELS) as [RepDocumentType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
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
                onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadError(''); if (fileRef.current) fileRef.current.value = ''; }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!uploadFile || uploading}
                onClick={handleUpload}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
