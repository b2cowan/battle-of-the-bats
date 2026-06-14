'use client';
import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { ChevronRight, Download, Upload, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import HelpCallout from '@/components/help/HelpCallout';
import styles from '../../../coaches.module.css';
import type { RepDocumentType } from '@/lib/types';

const DOC_TYPE_LABELS: Record<RepDocumentType, string> = {
  waiver:           'Waiver',
  medical_consent:  'Medical Consent',
  code_of_conduct:  'Code of Conduct',
  other:            'Other',
};

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
  downloadUrl: string | null;
}

export default function TeamDocumentsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === params.teamId);
  const base = `/${params.orgSlug}/coaches/teams/${params.teamId}`;
  const apiBase = `/api/coaches/${params.orgSlug}/teams/${params.teamId}/documents/templates`;

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<RepDocumentType>('other');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (res.ok) setTemplates(data.templates ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!assignmentsLoading) load();
  }, [assignmentsLoading, params.teamId]);

  const orgWide = templates.filter(t => t.teamId === null);
  const teamSpecific = templates.filter(t => t.teamId !== null);

  async function handleUpload() {
    if (!uploadFile || !uploadName.trim()) return;
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('name', uploadName.trim());
      form.append('documentType', uploadType);
      const res = await fetch(apiBase, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      await load();
      setUploadOpen(false);
      setUploadFile(null);
      setUploadName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setUploadError(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (assignmentsLoading || loading) return <div className={styles.loadingState}>Loading documents…</div>;

  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  function TemplateTable({ rows }: { rows: TemplateRow[] }) {
    if (rows.length === 0) return <p className={styles.detailPlaceholder}>No templates yet.</p>;
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>File</th>
              <th className={styles.th}>Size</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} className={styles.tr}>
                <td className={styles.td} style={{ fontWeight: 600 }}>{t.name}</td>
                <td className={styles.td}>
                  <span className={`${styles.badge} ${styles.badgeTryout}`}>
                    {DOC_TYPE_LABELS[t.documentType] ?? t.documentType}
                  </span>
                </td>
                <td className={styles.td} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>
                  {t.fileName}
                </td>
                <td className={styles.td} style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
                  {formatBytes(t.fileSize)}
                </td>
                <td className={styles.td} style={{ textAlign: 'right' }}>
                  {t.downloadUrl ? (
                    <a
                      href={t.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={t.fileName}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Download size={13} /> Download
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>Unavailable</span>
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
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`/${params.orgSlug}/coaches`}>Coaches Portal</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={base}>{assignment.teamName}</Link>
        <span><ChevronRight size={12} /></span>
        <span>Documents</span>
      </div>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>Documents</h1>
            <p className={styles.pageSub}>{assignment.teamName} — {assignment.programYearName}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
          onClick={() => { setUploadOpen(true); setUploadError(''); }}
        >
          <Upload size={14} /> Upload Template
        </button>
      </div>

      {orgWide.length === 0 && teamSpecific.length === 0 && (
        <HelpCallout
          variant="info"
          title="No document templates yet"
          body="Your org admin publishes document templates here (waivers, medical consent forms, codes of conduct). Once available, you can download them to share with players and families, or upload team-specific templates using the button above."
        />
      )}

      {/* Org-wide templates */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Org-Wide Templates</p>
        <TemplateTable rows={orgWide} />
      </div>

      {/* Team templates */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Team Templates</p>
        <TemplateTable rows={teamSpecific} />
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Upload Team Template</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadName(''); setUploadError(''); if (fileRef.current) fileRef.current.value = ''; }}
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
                  placeholder="e.g. Photo Permission Form"
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
                onClick={() => { setUploadOpen(false); setUploadFile(null); setUploadName(''); setUploadError(''); if (fileRef.current) fileRef.current.value = ''; }}
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
    </div>
  );
}
